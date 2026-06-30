'use client';

import { useCallback, useRef } from 'react';

import type { PlanningItemState } from '@/lib/chat/chat-ui-types';
import { useChatStream } from '@/hooks/use-chat-stream';

import { ChatComposer } from './chat-composer';
import { ChatModalsHost } from './modals/chat-modals-host';
import { ChatToolbar, type ChatToolbarAction } from './chat-toolbar';
import { MessageList } from './message-list';
import { PlanningPanel, type PlanningPanelHandle } from './planning-panel';

/** 聊天页 Client 岛 — 对齐 chat-shell + ai.html 布局 */
export function ChatPanel(): React.ReactElement {
  const chat = useChatStream();
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
    activeModal,
    openModal,
    closeModal,
    quickBubbleMode,
    internals,
  } = chat;

  const planningPanelRef = useRef<PlanningPanelHandle>(null);

  const isStreaming = status === 'streaming' || status === 'loading';
  const disabled = !configReady || (status === 'loading' && !isStreaming);

  const handleOpenPlanning = useCallback(
    (items?: PlanningItemState[]): void => {
      planningPanelRef.current?.openSnapshot(items ?? planningItems);
    },
    [planningItems]
  );

  const handleToolbarAction = useCallback(
    (action: ChatToolbarAction): void => {
      const map: Record<Exclude<ChatToolbarAction, 'clear'>, Parameters<typeof openModal>[0]> = {
        mcp: 'mcp',
        history: 'history',
        compact: 'context',
        settings: 'settings',
      };
      if (action !== 'clear') {
        openModal(map[action]);
      }
    },
    [openModal]
  );

  return (
    <div className="chat-shell">
      <div className="chat-panel">
        {error ? (
          <div className="chat-panel__error" role="alert">
            {error}
          </div>
        ) : null}

        <MessageList
          messages={messages}
          configReady={configReady}
          contextCompacted={contextCompacted}
          isStreaming={isStreaming}
          quickBubbleMode={quickBubbleMode}
          onQuickBubbleSelect={(text) => {
            void sendMessage(text);
          }}
          onResolvePermission={resolvePermission}
          onOpenPlanning={handleOpenPlanning}
        />

        <PlanningPanel ref={planningPanelRef} items={planningItems} />

        <div className="chat-panel__footer">
          <ChatToolbar
            sessionDisplayId={sessionDisplayId}
            mcpEnabledCount={mcpEnabledCount}
            isStreaming={isStreaming}
            onClearChat={clearChat}
            onToolbarAction={handleToolbarAction}
          />
          <ChatComposer
            disabled={disabled}
            isStreaming={isStreaming}
            hasError={status === 'error'}
            composerInsertRef={internals.composerInsertRef}
            onSend={(text) => {
              void sendMessage(text);
            }}
            onStop={stop}
            onRetry={retryLast}
            onNewSession={newSession}
            onOpenQuickMessages={() => openModal('quick-messages')}
          />
        </div>
      </div>

      <ChatModalsHost
        activeModal={activeModal}
        onClose={closeModal}
        onOpenModal={openModal}
        internals={internals}
      />
    </div>
  );
}
