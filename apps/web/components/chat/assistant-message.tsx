'use client';

import type { AssistantMessage } from '@/lib/chat/chat-ui-types';
import { formatMessageTime, formatMessageTimeWithElapsed } from '@/lib/chat/time';

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
  onOpenPlanning?: (items?: PlanningItemState[]) => void;
}

/** Assistant 消息 — 对齐 chat-shell-ui addAIMessage DOM 结构 */
export function AssistantMessageView({
  message,
  onResolvePermission,
  onOpenPlanning,
}: AssistantMessageViewProps): React.ReactElement {
  const showThinking =
    message.isStreaming &&
    !message.content &&
    !message.reasoning &&
    message.toolCalls.length === 0;
  const showCursor = message.isStreaming && !showThinking;
  const showFooter =
    !message.isStreaming ||
    Boolean(message.tokenUsage) ||
    typeof message.elapsedSeconds === 'number' ||
    typeof message.timestamp === 'number';
  const timeLabel =
    typeof message.elapsedSeconds === 'number'
      ? formatMessageTimeWithElapsed(message.elapsedSeconds, message.timestamp)
      : formatMessageTime(message.timestamp);

  return (
    <article className="chat-message ai" data-ai-message="true">
      <div className="avatar" aria-hidden="true">
        AI
      </div>
      <div className="ai-message-wrap">
        <div className="chat-bubble">
          <div className="ai-bubble-inner">
            {showThinking ? (
              <div className="ai-thinking">
                <div className="thinking-spinner" aria-hidden="true" />
                AI正在思考中...
              </div>
            ) : null}

            {message.reasoning ? (
              <ReasoningBlock reasoning={message.reasoning} isStreaming={message.isStreaming} />
            ) : null}

            {message.toolCalls.map((tool) => (
              <ToolCallCard
                key={tool.id}
                tool={tool}
                planningItems={message.planningItems}
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

            {showCursor ? <span className="cursor" aria-hidden="true" /> : null}
          </div>
        </div>

        {showFooter ? (
          <div className="ai-message-footer">
            <span className="ai-message-meta message-time">{timeLabel}</span>
            {message.tokenUsage ? <TokenUsageBadge usage={message.tokenUsage} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
