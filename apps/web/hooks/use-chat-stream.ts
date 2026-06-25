'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { showToast } from '@/components/ui/toast';
import {
  ChatOrchestrator,
  createInitialOrchestratorState,
} from '@/lib/chat/chat-orchestrator';
import { historyEntriesToChatMessages } from '@/lib/chat/chat-message-mapper';
import {
  createAssistantMessage,
  createUserMessage,
  type AssistantMessage,
  type ChatMessage,
  type PlanningItemState,
} from '@/lib/chat/chat-ui-types';
import { fetchChatFeatureConfig, fetchChatProviderConfig } from '@/lib/chat/config-fetch';
import { countKnownEnabledMcpServers, fetchMcpServers } from '@/lib/chat/mcp-selection';
import { resolveChatToolPermission } from '@/lib/chat/permission-resolve-client';
import { consumeSseStream, type StreamRuntime } from '@/lib/chat/process-sse-stream';
import { ChatSessionData } from '@/lib/chat/session-data';
import { createSessionStore, type ChatSessionStore } from '@/lib/chat/session-store';
import type { HistoryEntry } from '@/lib/chat/storage-contract';
import { feedTurnCollectorFromPayload } from '@/lib/chat/sync-turn-collector';
import { formatMessageTimeWithElapsed } from '@/lib/chat/time';
import { useAuth } from '@/providers/auth-provider';

export type ChatStreamStatus = 'idle' | 'loading' | 'streaming' | 'error';

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

  const guestDataRef = useRef<ChatSessionData | null>(null);
  const sessionStoreRef = useRef<ChatSessionStore | null>(null);
  const orchestratorRef = useRef<ChatOrchestrator | null>(null);
  const streamRuntimeRef = useRef<StreamRuntime>({ reader: null, userAborted: false });
  const pendingUserTextRef = useRef<string | null>(null);
  const lastFailedTextRef = useRef<string | null>(null);
  const initOnceRef = useRef(false);

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

        syncMcpCounter();

        if (!sessionStore.isAuthed()) {
          if (guestData.db.isReady) {
            await guestData.loadLatestProviderSession().catch(() => guestData.createNewSession());
          } else {
            guestData.createNewSession();
          }
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
  }, [loadHistoryToUi, syncMcpCounter, syncSessionDisplay]);

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
    [status, updateAssistantById]
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
    const orchestrator = orchestratorRef.current;
    if (orchestrator) {
      orchestrator.state.messageHistory = [];
      orchestrator.resetContextCompressionState();
    }
    showToast('对话已清除', 'info');
  }, [messages.length]);

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
    syncSessionDisplay(sessionId);
    showToast('已创建新会话', 'info');
  }, [status, syncSessionDisplay]);

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
  };
}

// Re-export for assistant meta formatting in UI
export { formatMessageTimeWithElapsed };
