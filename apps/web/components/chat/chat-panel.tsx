'use client';

import { useCallback, useState } from 'react';

import { useChatStream } from '@/hooks/use-chat-stream';

import { ChatComposer } from './chat-composer';
import { ChatToolbar } from './chat-toolbar';
import { MessageList } from './message-list';
import { PlanningPanel } from './planning-panel';

/** 聊天页 Client 岛 — 对齐 chat-shell + ai.html 布局 */
export function ChatPanel(): React.ReactElement {
  const {
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
  } = useChatStream();

  const [planningForced, setPlanningForced] = useState(false);

  const isStreaming = status === 'streaming' || status === 'loading';
  const disabled = !configReady || (status === 'loading' && !isStreaming);

  const handleOpenPlanning = useCallback((): void => {
    setPlanningForced(true);
  }, []);

  return (
    <div className="chat-shell">
      <div className="chat-panel">
        {!configReady ? (
          <header className="chat-panel__header">
            <span className="chat-panel__badge">加载配置…</span>
          </header>
        ) : null}

        {error ? (
          <div className="chat-panel__error" role="alert">
            {error}
          </div>
        ) : null}

        <MessageList
          messages={messages}
          contextCompacted={contextCompacted}
          onResolvePermission={resolvePermission}
          onOpenPlanning={handleOpenPlanning}
        />

        {planningItems.length > 0 || planningForced ? (
          <PlanningPanel items={planningItems} />
        ) : null}

        <div className="chat-panel__footer">
          <ChatToolbar
            sessionDisplayId={sessionDisplayId}
            mcpEnabledCount={mcpEnabledCount}
            isStreaming={isStreaming}
            onClearChat={clearChat}
          />
          <ChatComposer
            disabled={disabled}
            isStreaming={isStreaming}
            hasError={status === 'error'}
            onSend={(text) => {
              void sendMessage(text);
            }}
            onStop={stop}
            onRetry={retryLast}
            onNewSession={newSession}
          />
        </div>
      </div>
    </div>
  );
}
