'use client';

import type { ChatMessage } from '@/lib/chat/chat-ui-types';

import { AssistantMessageView } from './assistant-message';

interface MessageListProps {
  messages: ChatMessage[];
  onResolvePermission?: (
    toolCallId: string,
    decision: 'approve' | 'deny',
    options: {
      alwaysAllowSession: boolean;
      codeName: string;
      permissionSessionKey: string;
    }
  ) => void;
}

export function MessageList({
  messages,
  onResolvePermission,
}: MessageListProps): React.ReactElement {
  return (
    <div className="chat-messages" aria-live="polite">
      {messages.length === 0 ? (
        <p className="chat-messages__empty">发送消息开始对话（M1 基线：guest 模式，历史保存在本页会话）</p>
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
          />
        )
      )}
    </div>
  );
}
