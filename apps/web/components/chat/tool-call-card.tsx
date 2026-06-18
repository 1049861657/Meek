'use client';

import type { ToolCallState } from '@/lib/chat/chat-ui-types';

interface ToolCallCardProps {
  tool: ToolCallState;
  onResolvePermission?: (
    toolCallId: string,
    decision: 'approve' | 'deny',
    alwaysAllow: boolean
  ) => void;
}

function statusLabel(tool: ToolCallState): string {
  switch (tool.status) {
    case 'running':
      return '执行中…';
    case 'success':
      return '调用成功';
    case 'error':
      return '调用失败';
    case 'approval':
      return '待确认';
    default:
      return '';
  }
}

function statusClass(tool: ToolCallState): string {
  switch (tool.status) {
    case 'running':
      return 'tool-card__status--running';
    case 'success':
      return 'tool-card__status--success';
    case 'error':
      return 'tool-card__status--error';
    case 'approval':
      return 'tool-card__status--approval';
    default:
      return '';
  }
}

export function ToolCallCard({ tool, onResolvePermission }: ToolCallCardProps): React.ReactElement {
  const permission = tool.permission;

  return (
    <div className={`tool-card ${tool.source === 'system' ? 'tool-card--system' : ''}`}>
      <div className="tool-card__header">
        <span className="tool-card__name">{tool.name}</span>
        <span className={`tool-card__status ${statusClass(tool)}`}>{statusLabel(tool)}</span>
      </div>
      {tool.args ? (
        <pre className="tool-card__args">{tool.args}</pre>
      ) : null}
      {permission && tool.status === 'approval' ? (
        <div className="tool-card__permission">
          <p>{permission.toolName} 需要你的确认</p>
          <div className="tool-card__permission-actions">
            <button
              type="button"
              className="chat-btn chat-btn--ghost"
              onClick={() =>
                onResolvePermission?.(permission.toolCallId, 'deny', false)
              }
            >
              拒绝
            </button>
            <button
              type="button"
              className="chat-btn chat-btn--primary"
              onClick={() =>
                onResolvePermission?.(permission.toolCallId, 'approve', false)
              }
            >
              允许执行
            </button>
          </div>
        </div>
      ) : null}
      {tool.result !== undefined ? (
        <pre className={`tool-card__result ${tool.resultError ? 'tool-card__result--error' : ''}`}>
          {tool.resultError ? `错误: ${tool.result}` : tool.result}
        </pre>
      ) : null}
      {typeof tool.executionTime === 'number' ? (
        <span className="tool-card__time">
          {tool.executionTime < 1000
            ? `${tool.executionTime}ms`
            : `${(tool.executionTime / 1000).toFixed(2)}s`}
        </span>
      ) : null}
    </div>
  );
}
