'use client';

import { useRef } from 'react';

import type { ChatMessage } from '@/lib/chat/chat-ui-types';
import type { QuickBubbleMode } from '@/lib/chat/quick-messages-storage';
import { useChatAutoScroll } from '@/hooks/use-chat-auto-scroll';

import { AssistantMessageView } from './assistant-message';
import { ContextCompactNotice } from './context-compact-notice';
import { QuickMessageBubbles } from './quick-message-bubbles';

interface MessageListProps {
  messages: ChatMessage[];
  contextCompacted?: boolean;
  isStreaming?: boolean;
  quickBubbleMode?: QuickBubbleMode | null;
  onQuickBubbleSelect?: (text: string) => void;
  onResolvePermission?: (
    toolCallId: string,
    decision: 'approve' | 'deny',
    options: {
      alwaysAllowSession: boolean;
      codeName: string;
      permissionSessionKey: string;
    }
  ) => void;
  onOpenPlanning?: () => void;
}

/** 消息列表 + scrollToBottom — 对齐 chat-shell-ui scrollToBottom */
export function MessageList({
  messages,
  contextCompacted = false,
  isStreaming = false,
  quickBubbleMode = null,
  onQuickBubbleSelect,
  onResolvePermission,
  onOpenPlanning,
}: MessageListProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useChatAutoScroll(containerRef, {
    messageCount: messages.length,
    isStreaming,
    quickBubbleMode,
  });

  const showRandomBubbles =
    quickBubbleMode === 'random' && messages.length === 0 && Boolean(onQuickBubbleSelect);
  const showAppendedBubbles =
    quickBubbleMode === 'appended' && messages.length > 0 && Boolean(onQuickBubbleSelect);

  return (
    <div ref={containerRef} className="chat-messages" aria-live="polite">
      {messages.length === 0 && quickBubbleMode !== 'random' ? (
        <p className="chat-messages__empty">发送消息开始对话</p>
      ) : null}
      {showRandomBubbles ? (
        <QuickMessageBubbles
          mode="random"
          visible
          onSelect={(text) => onQuickBubbleSelect?.(text)}
        />
      ) : null}
      {messages.map((message) =>
        message.role === 'user' ? (
          <article key={message.id} className="chat-message chat-message--user">
            <div className="chat-message__bubble">{message.content}</div>
          </article>
        ) : (
          <AssistantMessageView
            key={message.id}
            message={message}
            onResolvePermission={onResolvePermission}
            onOpenPlanning={onOpenPlanning}
          />
        )
      )}
      {contextCompacted ? <ContextCompactNotice /> : null}
      {showAppendedBubbles ? (
        <QuickMessageBubbles
          mode="appended"
          visible
          onSelect={(text) => onQuickBubbleSelect?.(text)}
        />
      ) : null}
    </div>
  );
}
