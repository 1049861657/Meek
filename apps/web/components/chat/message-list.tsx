'use client';

import { useRef } from 'react';

import type { ChatMessage } from '@/lib/chat/chat-ui-types';
import type { QuickBubbleMode } from '@/lib/chat/quick-messages-storage';
import { useChatAutoScroll } from '@/hooks/use-chat-auto-scroll';
import { formatMessageTime } from '@/lib/chat/time';

import { Spinner } from '@/components/ui/spinner';

import { AssistantMessageView } from './assistant-message';
import { ContextCompactNotice } from './context-compact-notice';
import { QuickMessageBubbles } from './quick-message-bubbles';

interface MessageListProps {
  messages: ChatMessage[];
  configReady?: boolean;
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
  onOpenPlanning?: (items?: PlanningItemState[]) => void;
}

/** 消息列表 + scrollToBottom — 对齐 chat-shell-ui scrollToBottom */
export function MessageList({
  messages,
  configReady = true,
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
    configReady &&
    quickBubbleMode === 'random' &&
    messages.length === 0 &&
    Boolean(onQuickBubbleSelect);
  const showAppendedBubbles =
    configReady &&
    quickBubbleMode === 'appended' &&
    messages.length > 0 &&
    Boolean(onQuickBubbleSelect);

  return (
    <div ref={containerRef} id="chat-messages" className="chat-messages" aria-live="polite">
      {!configReady ? (
        <div className="chat-messages__loading" role="status" aria-live="polite">
          <Spinner size="md" />
          <p className="chat-messages__loading-title">正在初始化聊天…</p>
          <p className="chat-messages__loading-hint">加载模型配置、MCP 服务与会话</p>
        </div>
      ) : null}
      {configReady && messages.length === 0 && quickBubbleMode !== 'random' ? (
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
          <article key={message.id} className="chat-message user">
            <div className="avatar" aria-hidden="true">
              U
            </div>
            <div className="user-message-wrap">
              <div className="chat-bubble">
                <div className="user-message-text">{message.content}</div>
              </div>
              <div className="user-message-meta">{formatMessageTime(message.timestamp)}</div>
            </div>
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
