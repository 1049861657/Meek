'use client';

import type { AssistantMessage } from '@/lib/chat/chat-ui-types';

import { ToolCallCard } from './tool-call-card';

interface AssistantMessageViewProps {
  message: AssistantMessage;
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

export function AssistantMessageView({
  message,
  onResolvePermission,
}: AssistantMessageViewProps): React.ReactElement {
  return (
    <article
      className={`chat-message chat-message--assistant ${message.isError ? 'chat-message--error' : ''}`}
    >
      <div className="chat-message__bubble">
        {message.isStreaming && !message.content && message.toolCalls.length === 0 ? (
          <div className="chat-message__thinking">AI 正在思考…</div>
        ) : null}
        {message.contextCompacted ? (
          <p className="chat-message__notice">上下文已自动压缩</p>
        ) : null}
        {message.reasoning ? (
          <details className="chat-message__reasoning">
            <summary>推理过程</summary>
            <pre>{message.reasoning}</pre>
          </details>
        ) : null}
        {message.toolCalls.map((tool) => (
          <ToolCallCard
            key={tool.id}
            tool={tool}
            onResolvePermission={(toolCallId, decision, alwaysAllow) => {
              if (!tool.permission) {
                return;
              }
              void onResolvePermission?.(toolCallId, decision, {
                alwaysAllowSession: alwaysAllow,
                codeName: tool.permission.codeName,
                permissionSessionKey: tool.permission.permissionSessionKey,
              });
            }}
          />
        ))}
        {message.content ? (
          <div className="chat-message__content">{message.content}</div>
        ) : null}
        {typeof message.elapsedSeconds === 'number' ? (
          <footer className="chat-message__meta">{message.elapsedSeconds} 秒</footer>
        ) : null}
      </div>
    </article>
  );
}
