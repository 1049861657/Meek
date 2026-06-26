'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { showToast } from '@/components/ui/toast';
import {
  ChatOrchestrator,
  createInitialOrchestratorState,
} from '@/lib/chat/chat-orchestrator';
import { historyEntriesToChatMessages } from '@/lib/chat/chat-message-mapper';
import {
  buildChatSettingsFromState,
  loadChatSettings,
  saveChatSettings,
} from '@/lib/chat/chat-settings-storage';
import {
  createAssistantMessage,
  createUserMessage,
  type AssistantMessage,
  type ChatMessage,
  type PlanningItemState,
} from '@/lib/chat/chat-ui-types';
import {
  fetchChatFeatureConfig,
  fetchChatProviderConfig,
  type FeatureConfigResult,
  type ProviderConfigResult,
} from '@/lib/chat/config-fetch';
import { countKnownEnabledMcpServers, fetchMcpServers } from '@/lib/chat/mcp-selection';
import { resolveChatToolPermission } from '@/lib/chat/permission-resolve-client';
import { consumeSseStream, feedTurnCollectorFromPayload, type StreamRuntime } from '@/lib/chat/stream-handler';
import { ChatSessionData } from '@/lib/chat/session-data';
import { createSessionStore, type ChatSessionStore } from '@/lib/chat/session-store';
import type { HistoryEntry, PermissionMode } from '@/lib/chat/storage-contract';
import { formatMessageTimeWithElapsed } from '@/lib/chat/time';
import type { QuickBubbleMode } from '@/lib/chat/quick-messages-storage';
import { useAuth } from '@/providers/auth-provider';

export type ChatStreamStatus = 'idle' | 'loading' | 'streaming' | 'error';

export type ChatModalId =
  | 'history'
  | 'settings'
  | 'context'
  | 'system-tools'
  | 'mcp'
  | 'quick-messages'
  | 'edit-message'
  | 'memory-debug'
  | 'prompts';

export interface ChatStreamInternals {
  orchestratorRef: React.RefObject<ChatOrchestrator | null>;
  sessionStoreRef: React.RefObject<ChatSessionStore | null>;
  guestDataRef: React.RefObject<ChatSessionData | null>;
  featureConfigRef: React.RefObject<FeatureConfigResult | null>;
  providerConfigRef: React.RefObject<ProviderConfigResult | null>;
  syncMcpCounter: () => void;
  syncSessionDisplay: (sessionId: string) => void;
  loadHistoryToUi: (entries: HistoryEntry[]) => void;
  setContextCompactedState: (value: boolean) => void;
  setPlanningItems: Dispatch<SetStateAction<PlanningItemState[]>>;
  composerInsertRef: React.RefObject<((text: string) => void) | null>;
  persistSettings: () => void;
}

export interface UseChatStreamResult {
  messages: ChatMessage[];
  status: ChatStreamStatus;
  error: string | null;
  configReady: boolean;
  sessionDisplayId: string;
  contextCompacted: boolean;
  planningItems: PlanningItemState[];
  mcpEnabledCount: number;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  retryLast: () => void;
  clearChat: () => void;
  newSession: () => void;
  resolvePermission: (
    toolCallId: string,
    decision: 'approve' | 'deny',
    options: {
      alwaysAllowSession: boolean;
      codeName: string;
      permissionSessionKey: string;
    }
  ) => Promise<void>;
  activeModal: ChatModalId | null;
  openModal: (id: ChatModalId) => void;
  closeModal: () => void;
  quickBubbleMode: QuickBubbleMode | null;
  internals: ChatStreamInternals;
}

const VALID_PERMISSION_MODES: PermissionMode[] = ['open', 'interactive', 'locked'];

function applyStoredSettings(
  orchestrator: ChatOrchestrator,
  feature: FeatureConfigResult,
  stored: ReturnType<typeof loadChatSettings>
): void {
  const { state } = orchestrator;
  if (stored.model) {
    state.model = stored.model;
  }
  if (stored.compactModel) {
    state.compactModel = stored.compactModel;
  }
  if (typeof stored.skipMemory === 'boolean') {
    state.skipMemory = stored.skipMemory;
  }
  if (typeof stored.enableAutoCompact === 'boolean') {
    state.enableAutoCompact = stored.enableAutoCompact;
  }
  if (typeof stored.temperature === 'number') {
    state.temperature = stored.temperature;
  }
  if (typeof stored.maxTokens === 'number') {
    state.maxTokens = stored.maxTokens;
  }
  if (typeof stored.enableMCPTools === 'boolean') {
    state.enableMCPTools = stored.enableMCPTools;
  }
  if (typeof stored.enablePrompts === 'boolean') {
    state.enablePrompts = stored.enablePrompts;
  }
  if (typeof stored.enableMessageHistory === 'boolean') {
    state.enableMessageHistory = stored.enableMessageHistory;
  }
  if (typeof stored.messageHistoryCount === 'number') {
    state.messageHistoryCount = stored.messageHistoryCount;
  }
  if (typeof stored.maxToolCallRounds === 'number') {
    state.maxToolCallRounds = stored.maxToolCallRounds;
  }
  if (
    stored.permissionMode &&
    VALID_PERMISSION_MODES.includes(stored.permissionMode)
  ) {
    state.permissionMode = stored.permissionMode;
  }
  if (Array.isArray(stored.enabledServerIds)) {
    state.enabledServerIds = stored.enabledServerIds.filter(
      (id): id is string => typeof id === 'string'
    );
  }
  if (Array.isArray(stored.enabledSystemToolNames)) {
    state.enabledSystemToolNames = stored.enabledSystemToolNames.filter(
      (name): name is string => typeof name === 'string'
    );
  } else {
    state.enabledSystemToolNames = feature.enabledSystemToolNames;
  }
}

export function useChatStream(): UseChatStreamResult {
  useAuth(); // init-once 会话模式由 sessionStore.init 判定
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [sessionDisplayId, setSessionDisplayId] = useState('');
  const [contextCompacted, setContextCompacted] = useState(false);
  const [planningItems, setPlanningItems] = useState<PlanningItemState[]>([]);
  const [mcpEnabledCount, setMcpEnabledCount] = useState(0);
  const [activeModal, setActiveModal] = useState<ChatModalId | null>(null);
  const [quickBubbleMode, setQuickBubbleMode] = useState<QuickBubbleMode | null>(null);

  const guestDataRef = useRef<ChatSessionData | null>(null);
  const sessionStoreRef = useRef<ChatSessionStore | null>(null);
  const orchestratorRef = useRef<ChatOrchestrator | null>(null);
  const featureConfigRef = useRef<FeatureConfigResult | null>(null);
  const providerConfigRef = useRef<ProviderConfigResult | null>(null);
  const composerInsertRef = useRef<((text: string) => void) | null>(null);
  const streamRuntimeRef = useRef<StreamRuntime>({ reader: null, userAborted: false });
  const pendingUserTextRef = useRef<string | null>(null);
  const lastFailedTextRef = useRef<string | null>(null);
  const initOnceRef = useRef(false);
  const quickBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearQuickBubbleTimer = useCallback((): void => {
    if (quickBubbleTimerRef.current) {
      clearTimeout(quickBubbleTimerRef.current);
      quickBubbleTimerRef.current = null;
    }
  }, []);

  const scheduleQuickBubbles = useCallback(
    (mode: QuickBubbleMode, delayMs = 100): void => {
      clearQuickBubbleTimer();
      quickBubbleTimerRef.current = setTimeout(() => {
        setQuickBubbleMode(mode);
      }, delayMs);
    },
    [clearQuickBubbleTimer]
  );

  const syncSessionDisplay = useCallback((sessionId: string): void => {
    const store = sessionStoreRef.current;
    if (!store) {
      setSessionDisplayId(sessionId);
      return;
    }
    setSessionDisplayId(store.displayId(sessionId));
  }, []);

  const syncMcpCounter = useCallback((): void => {
    const orchestrator = orchestratorRef.current;
    if (!orchestrator) {
      return;
    }
    setMcpEnabledCount(
      countKnownEnabledMcpServers(
        orchestrator.state.enabledServerIds,
        orchestrator.state.mcpServers
      )
    );
  }, []);

  const loadHistoryToUi = useCallback((entries: HistoryEntry[]): void => {
    setMessages(historyEntriesToChatMessages(entries));
    const lastAssistant = [...entries].reverse().find((entry) => entry.role === 'assistant');
    const todoItems = lastAssistant?.toolCalls?.find((tc) => tc.name === 'todo')?.planningItems;
    if (todoItems?.length) {
      setPlanningItems(todoItems as PlanningItemState[]);
    }
    if (entries.length > 0) {
      scheduleQuickBubbles('appended', 300);
    } else {
      scheduleQuickBubbles('random', 100);
    }
  }, [scheduleQuickBubbles]);

  const setContextCompactedState = useCallback((value: boolean): void => {
    setContextCompacted(value);
  }, []);

  const persistSettings = useCallback((): void => {
    const orchestrator = orchestratorRef.current;
    if (!orchestrator) {
      return;
    }
    saveChatSettings(buildChatSettingsFromState(orchestrator.state));
  }, []);

  const openModal = useCallback((id: ChatModalId): void => {
    setActiveModal(id);
  }, []);

  const closeModal = useCallback((): void => {
    setActiveModal(null);
  }, []);

  useEffect(() => {
    if (initOnceRef.current) {
      return;
    }
    initOnceRef.current = true;

    const guestData = new ChatSessionData({
      isAuthed: () => sessionStoreRef.current?.isAuthed() ?? false,
      getProvider: () => orchestratorRef.current?.state.vendor ?? '',
      isConfigLoaded: () => orchestratorRef.current?.state.isConfigLoaded ?? false,
      onSessionChanged: (sessionId) => {
        orchestratorRef.current!.state.sessionId = sessionId;
        syncSessionDisplay(sessionId);
      },
      onHistoryLoaded: (entries) => {
        orchestratorRef.current!.state.messageHistory = entries;
        loadHistoryToUi(entries);
      },
      onCompactBaselineLoaded: (baseline) => {
        if (orchestratorRef.current) {
          orchestratorRef.current.state.compactedBaseline = baseline;
        }
        setContextCompacted(Boolean(baseline));
      },
    });

    const sessionStore = createSessionStore(guestData, {
      onSessionChanged: (sessionId) => {
        orchestratorRef.current!.state.sessionId = sessionId;
        syncSessionDisplay(sessionId);
      },
      onHistoryLoaded: (entries) => {
        orchestratorRef.current!.state.messageHistory = entries;
        loadHistoryToUi(entries);
      },
      onResetContext: () => {
        orchestratorRef.current?.resetContextCompressionState();
        setContextCompacted(false);
      },
      onClearPlanning: () => setPlanningItems([]),
    });

    const orchestrator = new ChatOrchestrator(
      createInitialOrchestratorState(),
      sessionStore,
      () => guestData.saveMessageHistory()
    );

    guestDataRef.current = guestData;
    sessionStoreRef.current = sessionStore;
    orchestratorRef.current = orchestrator;

    guestData.init();

    void (async () => {
      try {
        await sessionStore.init();
        const [feature, providerConfig, mcpData] = await Promise.all([
          fetchChatFeatureConfig(),
          fetchChatProviderConfig().catch(() => null),
          fetchMcpServers(),
        ]);

        featureConfigRef.current = feature;
        providerConfigRef.current = providerConfig;

        orchestrator.state.isConfigLoaded = true;
        orchestrator.state.enableMCPTools = feature.enableMCPTools;
        orchestrator.state.enablePrompts = feature.enablePrompts;
        orchestrator.state.maxToolCallRounds = feature.maxToolCallRounds;
        orchestrator.state.enableMessageHistory = feature.enableMessageHistory;
        orchestrator.state.messageHistoryCount = feature.messageHistoryCount;
        orchestrator.state.enableAutoCompact = feature.enableAutoCompact;
        orchestrator.state.enabledSystemToolNames = feature.enabledSystemToolNames;
        orchestrator.state.mcpServers = mcpData.servers;
        orchestrator.state.temperature = 0.7;
        orchestrator.state.maxTokens = 4096;

        if (providerConfig) {
          orchestrator.state.vendor = providerConfig.defaultProvider;
          const models =
            providerConfig.providers[providerConfig.defaultProvider]?.models ?? [];
          orchestrator.state.model = models[0]?.value ?? '';
          orchestrator.state.compactModel = models[0]?.value ?? '';
        }

        applyStoredSettings(orchestrator, feature, loadChatSettings());

        syncMcpCounter();

        if (!sessionStore.isAuthed()) {
          await guestData.whenIdbReady();
          await guestData.loadLatestProviderSession().catch(() => guestData.createNewSession());
        } else if (sessionStore.isAuthedSessionsGated()) {
          sessionStore.newSession();
          scheduleQuickBubbles('random', 100);
        } else {
          await sessionStore.loadLatest().catch(() => sessionStore.newSession());
        }

        syncSessionDisplay(guestData.sessionId);
        setConfigReady(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '加载配置失败';
        setError(message);
        showToast(message, 'error');
      }
    })();
  }, [loadHistoryToUi, scheduleQuickBubbles, syncMcpCounter, syncSessionDisplay]);

  useEffect(() => {
    return () => {
      clearQuickBubbleTimer();
    };
  }, [clearQuickBubbleTimer]);

  const updateAssistantById = useCallback(
    (assistantId: string, updater: (prev: AssistantMessage) => AssistantMessage): void => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId && message.role === 'assistant'
            ? updater(message)
            : message
        )
      );
    },
    []
  );

  const stop = useCallback((): void => {
    const orchestrator = orchestratorRef.current;
    streamRuntimeRef.current.userAborted = true;
    orchestrator!.streamRuntime.userAborted = true;

    const reader = streamRuntimeRef.current.reader;
    if (reader) {
      void reader.cancel().catch(() => undefined);
      streamRuntimeRef.current.reader = null;
    }

    setStatus('idle');

    if (pendingUserTextRef.current) {
      const pendingText = pendingUserTextRef.current;
      pendingUserTextRef.current = null;
      orchestrator?.handleStreamAborted();
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'user' && last.content === pendingText) {
          return prev.slice(0, -2);
        }
        if (last?.role === 'assistant') {
          return prev.slice(0, -2);
        }
        return prev;
      });
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.role === 'assistant' && message.isStreaming
          ? { ...message, isStreaming: false }
          : message
      )
    );
  }, []);

  const resolvePermission = useCallback(
    async (
      toolCallId: string,
      decision: 'approve' | 'deny',
      options: {
        alwaysAllowSession: boolean;
        codeName: string;
        permissionSessionKey: string;
      }
    ): Promise<void> => {
      const requestId = orchestratorRef.current?.streamRuntime.requestId;
      if (!requestId) {
        console.warn('[permission] 缺少 requestId');
        return;
      }
      await resolveChatToolPermission({
        requestId,
        toolCallId,
        decision,
        alwaysAllowSession: options.alwaysAllowSession,
        codeName: options.codeName,
        permissionSessionKey: options.permissionSessionKey,
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming' || status === 'loading') {
        return;
      }

      const orchestrator = orchestratorRef.current;
      const sessionStore = sessionStoreRef.current;
      if (!orchestrator || !sessionStore || !orchestrator.state.isConfigLoaded) {
        setError('配置尚未加载完成，请稍后再试');
        return;
      }

      setError(null);
      lastFailedTextRef.current = null;
      streamRuntimeRef.current.userAborted = false;
      pendingUserTextRef.current = trimmed;
      setQuickBubbleMode(null);
      clearQuickBubbleTimer();

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();

      orchestrator.beginSend(trimmed);

      setMessages((prev) => [
        ...prev,
        createUserMessage(userId, trimmed),
        createAssistantMessage(assistantId),
      ]);
      setStatus('loading');

      try {
        if (sessionStore.isAuthed()) {
          await orchestrator.ensureActiveSessionBeforeSend();
        }

        const body = orchestrator.buildStreamRequestBody({
          message: trimmed,
          enableMcpTools: orchestrator.state.enableMCPTools,
          isAuthed: sessionStore.isAuthed(),
        });

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        setStatus('streaming');
        const turnCollector = orchestrator.streamRuntime.turnCollector;

        const result = await consumeSseStream(
          response,
          assistantId,
          streamRuntimeRef.current,
          {
            onBegin: (requestId) => {
              orchestrator.setRequestId(requestId);
            },
            onAssistantUpdate: (updater) => {
              updateAssistantById(assistantId, updater);
            },
            onContextCompacted: (summaryContent) => {
              if (summaryContent) {
                orchestrator.setAutoCompactSummary(summaryContent);
              }
              setContextCompacted(true);
              updateAssistantById(assistantId, (prev) => ({ ...prev, contextCompacted: true }));
            },
            onUsage: (elapsedSeconds) => {
              if (typeof elapsedSeconds === 'number') {
                updateAssistantById(assistantId, (prev) => ({
                  ...prev,
                  elapsedSeconds,
                }));
              }
            },
            onStreamError: (message) => {
              setError(message);
              setStatus('error');
            },
            onDone: () => {
              setStatus('idle');
            },
            onPayload: (payload) => {
              feedTurnCollectorFromPayload(turnCollector, payload);
              if (payload.planning_update && typeof payload.planning_update === 'object') {
                const items = (payload.planning_update as { items?: unknown[] }).items ?? [];
                setPlanningItems(items as PlanningItemState[]);
                updateAssistantById(assistantId, (prev) => ({
                  ...prev,
                  planningItems: items as PlanningItemState[],
                }));
              }
            },
          }
        );

        pendingUserTextRef.current = null;

        if (streamRuntimeRef.current.userAborted || orchestrator.streamRuntime.userAborted) {
          setStatus('idle');
          return;
        }

        if (result.readError && !result.aborted) {
          setStatus('error');
          lastFailedTextRef.current = trimmed;
          return;
        }

        const assistantText = result.fullText;
        if (assistantText || turnCollector) {
          orchestrator.finalizeSuccessfulStream(assistantText);
          const snapshot = turnCollector?.collect();
          const todoItems = snapshot?.toolCalls?.find((tc) => tc.name === 'todo')?.planningItems;
          if (todoItems?.length) {
            setPlanningItems(todoItems as PlanningItemState[]);
          }
          setContextCompacted(Boolean(orchestrator.state.compactedBaseline));
          scheduleQuickBubbles('appended', 300);
        }
        setStatus('idle');
      } catch (err: unknown) {
        if (streamRuntimeRef.current.userAborted) {
          setStatus('idle');
          return;
        }
        const message = err instanceof Error ? err.message : '与服务器通信失败';
        setError(message);
        setStatus('error');
        lastFailedTextRef.current = trimmed;
        orchestrator.handleStreamAborted();
        updateAssistantById(assistantId, (prev) => ({
          ...prev,
          content: `错误: ${message}`,
          isError: true,
          isStreaming: false,
        }));
        pendingUserTextRef.current = null;
      }
    },
    [status, updateAssistantById, clearQuickBubbleTimer, scheduleQuickBubbles]
  );

  const retryLast = useCallback((): void => {
    const text = lastFailedTextRef.current;
    if (!text) {
      return;
    }
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last.isError) {
        return prev.slice(0, -2);
      }
      return prev;
    });
    const orchestrator = orchestratorRef.current;
    if (orchestrator) {
      orchestrator.state.messageHistory.pop();
      if (orchestrator.state.messageHistory.at(-1)?.role === 'user') {
        orchestrator.state.messageHistory.pop();
      }
    }
    void sendMessage(text);
  }, [sendMessage]);

  const clearChat = useCallback((): void => {
    if (messages.length === 0) {
      showToast('没有对话可清除', 'info');
      return;
    }
    setMessages([]);
    setPlanningItems([]);
    setContextCompacted(false);
    setQuickBubbleMode(null);
    const orchestrator = orchestratorRef.current;
    if (orchestrator) {
      orchestrator.state.messageHistory = [];
      orchestrator.resetContextCompressionState();
    }
    scheduleQuickBubbles('random', 100);
    showToast('对话已清除', 'info');
  }, [messages.length, scheduleQuickBubbles]);

  const newSession = useCallback((): void => {
    const sessionStore = sessionStoreRef.current;
    const orchestrator = orchestratorRef.current;
    if (!sessionStore || !orchestrator) {
      return;
    }
    if (status === 'streaming' || status === 'loading') {
      showToast('请等待当前回复完成', 'info');
      return;
    }
    const sessionId = sessionStore.newSession();
    orchestrator.state.sessionId = sessionId;
    orchestrator.state.messageHistory = [];
    orchestrator.resetContextCompressionState();
    setMessages([]);
    setPlanningItems([]);
    setContextCompacted(false);
    setQuickBubbleMode(null);
    syncSessionDisplay(sessionId);
    scheduleQuickBubbles('random', 100);
    showToast('已创建新会话', 'info');
  }, [status, syncSessionDisplay, scheduleQuickBubbles]);

  const internals: ChatStreamInternals = {
    orchestratorRef,
    sessionStoreRef,
    guestDataRef,
    featureConfigRef,
    providerConfigRef,
    syncMcpCounter,
    syncSessionDisplay,
    loadHistoryToUi,
    setContextCompactedState,
    setPlanningItems,
    composerInsertRef,
    persistSettings,
  };

  return {
    messages,
    status,
    error,
    configReady,
    sessionDisplayId,
    contextCompacted,
    planningItems,
    mcpEnabledCount,
    sendMessage,
    stop,
    retryLast,
    clearChat,
    newSession,
    resolvePermission,
    activeModal,
    openModal,
    closeModal,
    quickBubbleMode,
    internals,
  };
}

// Re-export for assistant meta formatting in UI
export { formatMessageTimeWithElapsed };
