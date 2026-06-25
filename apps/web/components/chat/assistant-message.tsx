'use client';

import type { AssistantMessage } from '@/lib/chat/chat-ui-types';
import { formatMessageTimeWithElapsed } from '@/lib/chat/time';

import { ChatMarkdown } from './chat-markdown';
import { ReasoningBlock } from './reasoning-block';
import { TokenUsageBadge } from './token-usage-badge';
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
  onOpenPlanning?: () => void;
}

/** Assistant 消息：reasoning / tool / markdown / usage / 耗时 */
export function AssistantMessageView({
  message,
  onResolvePermission,
  onOpenPlanning,
}: AssistantMessageViewProps): React.ReactElement {
  const showThinking =
    message.isStreaming && !message.content && message.toolCalls.length === 0;

  return (
    <article
      className={`chat-message chat-message--assistant ${message.isError ? 'chat-message--error' : ''} ${message.isStreaming ? 'chat-message--streaming' : ''}`}
    >
      <div className="chat-message__bubble">
        {showThinking ? (
          <div className="chat-message__thinking">
            <span className="chat-message__thinking-spinner" aria-hidden="true" />
            AI 正在思考…
          </div>
        ) : null}

        {message.contextCompacted ? (
          <p className="chat-message__notice">上下文已自动压缩</p>
        ) : null}

        {message.reasoning ? <ReasoningBlock reasoning={message.reasoning} /> : null}

        {message.toolCalls.map((tool) => (
          <ToolCallCard
            key={tool.id}
            tool={tool}
            onOpenPlanning={onOpenPlanning}
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

        {message.content ? <ChatMarkdown content={message.content} /> : null}

        <footer className="chat-message__meta">
          {message.tokenUsage ? <TokenUsageBadge usage={message.tokenUsage} /> : null}
          {typeof message.elapsedSeconds === 'number' ? (
            <span className="chat-message__time">
              {formatMessageTimeWithElapsed(message.elapsedSeconds)}
            </span>
          ) : null}
        </footer>
      </div>
    </article>
  );
}
