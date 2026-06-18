'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PublicFeatureConfig } from '@meek/shared';

import { buildChatStreamRequestBody } from '@/lib/chat/chat-request-body';
import { getOrCreateWebChatSessionId } from '@/lib/chat/chat-session';
import {
  createAssistantMessage,
  createUserMessage,
  type AssistantMessage,
  type ChatMessage,
} from '@/lib/chat/chat-ui-types';
import { consumeSseStream, type StreamRuntime } from '@/lib/chat/process-sse-stream';

export type ChatStreamStatus = 'idle' | 'loading' | 'streaming' | 'error';

interface ApiHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseChatStreamResult {
  messages: ChatMessage[];
  status: ChatStreamStatus;
  error: string | null;
  configReady: boolean;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
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

async function fetchFeatureConfig(): Promise<PublicFeatureConfig | null> {
  const response = await fetch('/api/config/features');
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { success?: boolean; config?: PublicFeatureConfig };
  return data.success && data.config ? data.config : null;
}

export function useChatStream(): UseChatStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [featureConfig, setFeatureConfig] = useState<PublicFeatureConfig | null>(null);

  const sessionIdRef = useRef('');
  const requestIdRef = useRef<string | null>(null);
  const streamRuntimeRef = useRef<StreamRuntime>({ reader: null, userAborted: false });
  const apiHistoryRef = useRef<ApiHistoryEntry[]>([]);
  const pendingUserTextRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = getOrCreateWebChatSessionId();
    void fetchFeatureConfig()
      .then((config) => {
        setFeatureConfig(config);
      })
      .catch(() => {
        setError('加载特性配置失败');
      });
  }, []);

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
    streamRuntimeRef.current.userAborted = true;
    const reader = streamRuntimeRef.current.reader;
    if (reader) {
      void reader.cancel().catch(() => undefined);
      streamRuntimeRef.current.reader = null;
    }
    setStatus('idle');

    if (pendingUserTextRef.current) {
      const pendingText = pendingUserTextRef.current;
      pendingUserTextRef.current = null;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'user' && last.content === pendingText) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      const history = apiHistoryRef.current;
      const lastHistory = history[history.length - 1];
      if (lastHistory?.role === 'user' && lastHistory.content === pendingText) {
        apiHistoryRef.current = history.slice(0, -1);
      }
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
      const requestId = requestIdRef.current;
      if (!requestId) {
        console.warn('[permission] 缺少 requestId');
        return;
      }
      try {
        const res = await fetch('/api/chat/permission-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            toolCallId,
            decision,
            alwaysAllowSession: options.alwaysAllowSession,
            sessionKey: options.permissionSessionKey,
            codeName: options.codeName,
          }),
        });
        const data = (await res.json()) as { success?: boolean };
        if (!res.ok || !data.success) {
          console.warn('[permission] resolve 失败', data);
        }
      } catch (err: unknown) {
        console.error('[permission] resolve 请求异常', err);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming' || status === 'loading') {
        return;
      }
      if (!featureConfig) {
        setError('配置尚未加载完成，请稍后再试');
        return;
      }
      if (!sessionIdRef.current) {
        sessionIdRef.current = getOrCreateWebChatSessionId();
      }

      setError(null);
      streamRuntimeRef.current.userAborted = false;
      requestIdRef.current = null;
      pendingUserTextRef.current = trimmed;

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        createUserMessage(userId, trimmed),
        createAssistantMessage(assistantId),
      ]);
      setStatus('loading');

      const outgoingMessages = [
        ...apiHistoryRef.current.map((entry) => ({ role: entry.role, content: entry.content })),
        { role: 'user' as const, content: trimmed },
      ];

      const body = buildChatStreamRequestBody({
        message: trimmed,
        messages: outgoingMessages,
        temperature: featureConfig.chat.defaultTemperature,
        maxTokens: featureConfig.chat.defaultMaxTokens,
        enableTools: featureConfig.tools.enableMCPTools,
        enablePrompts: featureConfig.tools.enablePrompts,
        maxToolCallRounds: featureConfig.tools.maxToolCallRounds,
        enableAutoCompact: featureConfig.context.enableAutoCompact,
        compactModel: featureConfig.context.summarizeModel,
        sessionId: sessionIdRef.current,
        permissionMode: 'interactive',
        mcpServerIds: [],
      });

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        setStatus('streaming');

        const result = await consumeSseStream(
          response,
          assistantId,
          streamRuntimeRef.current,
          {
          onBegin: (requestId) => {
            requestIdRef.current = requestId;
          },
          onAssistantUpdate: (updater) => {
            updateAssistantById(assistantId, updater);
          },
          onContextCompacted: () => {
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
        });

        pendingUserTextRef.current = null;

        if (streamRuntimeRef.current.userAborted) {
          setStatus('idle');
          return;
        }

        if (result.readError && !result.aborted) {
          setStatus('error');
          return;
        }

        const assistantText = result.fullText;
        if (assistantText) {
          apiHistoryRef.current = [
            ...apiHistoryRef.current,
            { role: 'user', content: trimmed },
            { role: 'assistant', content: assistantText },
          ];
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
        updateAssistantById(assistantId, (prev) => ({
          ...prev,
          content: `错误: ${message}`,
          isError: true,
          isStreaming: false,
        }));
        pendingUserTextRef.current = null;
      }
    },
    [featureConfig, status, updateAssistantById]
  );

  return {
    messages,
    status,
    error,
    configReady: featureConfig !== null,
    sendMessage,
    stop,
    resolvePermission,
  };
}
