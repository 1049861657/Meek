'use client';

import { useEffect, useRef } from 'react';

import type { ChatMessage } from '@/lib/chat/chat-ui-types';

import { AssistantMessageView } from './assistant-message';
import { ContextCompactNotice } from './context-compact-notice';

interface MessageListProps {
  messages: ChatMessage[];
  contextCompacted?: boolean;
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
  onResolvePermission,
  onOpenPlanning,
}: MessageListProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="chat-messages" aria-live="polite">
      {messages.length === 0 ? (
        <p className="chat-messages__empty">发送消息开始对话</p>
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
    </div>
  );
}
