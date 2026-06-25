'use client';

import type { TokenUsageDisplayState } from '@/lib/chat/chat-ui-types';
import { formatTokenCount } from '@/lib/chat/usage-telemetry';

interface TokenUsageBadgeProps {
  usage: TokenUsageDisplayState;
}

/** Token 计量展示 — 对齐 usage-telemetry applyStepUsage / applyFinalUsage */
export function TokenUsageBadge({ usage }: TokenUsageBadgeProps): React.ReactElement {
  return (
    <span
      className={`token-info token-info--${usage.phase}`}
      role="status"
      title={usage.title}
    >
      {usage.showIncrement && usage.stepDelta !== undefined ? (
        <span className="token-meta token-meta--split">
          <span className="token-meta__count">{formatTokenCount(usage.totalTokens)}</span>
          <span className="token-meta__sep" aria-hidden="true">
            ·
          </span>
          <span className="token-meta__delta">+{formatTokenCount(usage.stepDelta)}</span>
        </span>
      ) : (
        <span className="token-meta token-meta--final">
          <span className="token-meta__count">{formatTokenCount(usage.totalTokens)}</span>
          <span className="token-meta__label">tokens</span>
        </span>
      )}
    </span>
  );
}
