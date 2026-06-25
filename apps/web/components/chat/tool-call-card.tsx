'use client';

import { useState } from 'react';

import type { ToolCallState } from '@/lib/chat/chat-ui-types';
import { resolveToolSource } from '@/lib/chat/tool-renderers';

import { TodoToolCard } from './todo-tool-card';

interface ToolCallCardProps {
  tool: ToolCallState;
  onResolvePermission?: (
    toolCallId: string,
    decision: 'approve' | 'deny',
    alwaysAllow: boolean
  ) => void;
  onOpenPlanning?: () => void;
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
  return `tool-card__status--${tool.status}`;
}

/** Tool 卡片状态机 — 对齐 tool-cards.js + renderers */
export function ToolCallCard({
  tool,
  onResolvePermission,
  onOpenPlanning,
}: ToolCallCardProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(true);
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const permission = tool.permission;
  const source = resolveToolSource({ name: tool.name, source: tool.source });

  if (tool.name === 'todo') {
    return (
      <TodoToolCard
        summary={tool.result}
        items={tool.planningItems}
        onOpenPlanning={onOpenPlanning}
      />
    );
  }

  return (
    <div
      className={`tool-card tool-card--${source} ${collapsed ? 'tool-card--collapsed' : 'tool-card--expanded'}`}
    >
      <button
        type="button"
        className="tool-card__header"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <span className={`tool-card__source tool-card__source--${source}`}>
          {source === 'system' ? 'System' : 'MCP'}
        </span>
        <span className="tool-card__name">{tool.name}</span>
        <span className={`tool-card__status ${statusClass(tool)}`}>{statusLabel(tool)}</span>
      </button>

      {!collapsed ? (
        <div className="tool-card__body">
          {tool.args ? <pre className="tool-card__args">{tool.args}</pre> : null}

          {tool.progressSteps && tool.progressSteps.length > 0 ? (
            <ul className="tool-card__progress-steps">
              {tool.progressSteps.map((step, index) => (
                <li key={`${step.message}-${index}`} className="tool-card__progress-step">
                  <span>{step.message || `步骤 ${index + 1}`}</span>
                  {typeof step.elapsedMs === 'number' ? (
                    <span className="tool-card__step-time">{step.elapsedMs}ms</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : tool.progress?.message ? (
            <p className="tool-card__progress">{tool.progress.message}</p>
          ) : null}

          {permission && tool.status === 'approval' ? (
            <div className="tool-card__permission">
              <p>{permission.toolName} 需要你的确认</p>
              {permission.argsPreview ? (
                <pre className="tool-card__permission-preview">{permission.argsPreview}</pre>
              ) : null}
              <label className="tool-card__permission-remember">
                <input
                  type="checkbox"
                  checked={alwaysAllow}
                  onChange={(event) => setAlwaysAllow(event.target.checked)}
                />
                本会话始终允许
              </label>
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
                    onResolvePermission?.(permission.toolCallId, 'approve', alwaysAllow)
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
      ) : null}
    </div>
  );
}
