'use client';

import { useEffect, useState } from 'react';

import type { PlanningItemState, ToolCallState } from '@/lib/chat/chat-ui-types';
import {
  getToolSourceLabel,
  getToolSourceTitle,
  resolveToolSource,
  type ToolSource,
} from '@/lib/chat/tool-renderers';

import { TodoToolCard } from './todo-tool-card';

interface ToolCallCardProps {
  tool: ToolCallState;
  planningItems?: PlanningItemState[];
  onResolvePermission?: (
    toolCallId: string,
    decision: 'approve' | 'deny',
    alwaysAllow: boolean
  ) => void;
  onOpenPlanning?: (items?: PlanningItemState[]) => void;
}

function ToolSourceIcon({ source }: { source: ToolSource }): React.ReactElement {
  if (source === 'system') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}

function formatExecutionTime(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function renderStatus(tool: ToolCallState): React.ReactElement {
  if (tool.status === 'running') {
    return (
      <>
        <div className="status-indicator status-running" />
        <span>执行中…</span>
      </>
    );
  }

  if (tool.status === 'approval') {
    return (
      <span className="tool-permission-gate__status" aria-live="polite">
        <span className="tool-permission-gate__status-dot" aria-hidden="true" />
        待确认
      </span>
    );
  }

  if (tool.status === 'error') {
    return <span className="status-error">调用失败</span>;
  }

  return (
    <>
      <span className="status-success">调用成功</span>
      {typeof tool.executionTime === 'number' ? (
        <span className="tool-execution-time">{formatExecutionTime(tool.executionTime)}</span>
      ) : null}
    </>
  );
}

/** Tool 卡片 — 对齐 tool-cards.js + renderers */
export function ToolCallCard({
  tool,
  planningItems,
  onResolvePermission,
  onOpenPlanning,
}: ToolCallCardProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(tool.status !== 'approval');
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const permission = tool.permission;
  const source = resolveToolSource({ name: tool.name, source: tool.source });

  useEffect(() => {
    if (tool.status === 'approval') {
      setCollapsed(false);
    }
  }, [tool.status]);

  if (tool.name === 'todo') {
    const todoItems = tool.planningItems ?? planningItems;
    return (
      <TodoToolCard
        summary={tool.result}
        items={todoItems}
        revision={tool.revision}
        onOpenPlanning={() => onOpenPlanning?.(todoItems)}
      />
    );
  }

  const permissionPending = tool.status === 'approval';

  return (
    <div
      className={`tool-call tool-call--${source}${collapsed ? ' collapsed' : ''}${permissionPending ? ' tool-call--permission-pending' : ''}`}
      data-tool-name={tool.name}
      data-tool-id={tool.id}
      data-tool-source={source}
    >
      <div
        className="tool-call-header"
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCollapsed((prev) => !prev);
          }
        }}
      >
        <div className="tool-call-title">
          <span
            className={`tool-source-icon-wrap tool-source-icon-wrap--${source}`}
            title={getToolSourceTitle(source)}
          >
            <ToolSourceIcon source={source} />
          </span>
          <span className={`tool-source-badge tool-source-badge--${source}`} title={getToolSourceTitle(source)}>
            {getToolSourceLabel(source)}
          </span>
          <span className="tool-call-name-row">
            <code className="tool-call-name">{tool.name}</code>
            <div className="tool-call-toggle" title="展开 / 折叠详情" aria-label="展开或折叠工具详情">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </span>
        </div>
        <div className="tool-call-status">{renderStatus(tool)}</div>
      </div>

      <div className="tool-call-content">
        {permission && permissionPending ? (
          <div className="tool-permission-gate" role="group" aria-label={`确认是否执行 ${permission.toolName}`}>
            <p className="tool-permission-gate__lead">是否允许执行此工具？</p>
            <p className="tool-permission-gate__explain">{permission.reason || permission.toolName}</p>
            {permission.argsPreview ? (
              <details className="tool-permission-gate__params" open>
                <summary>调用参数</summary>
                <pre>{permission.argsPreview}</pre>
              </details>
            ) : null}
            <label className="tool-permission-gate__remember">
              <input
                type="checkbox"
                className="tool-permission-gate__remember-cb"
                checked={alwaysAllow}
                onChange={(event) => setAlwaysAllow(event.target.checked)}
              />
              <span className="tool-permission-gate__remember-text">
                <span className="tool-permission-gate__remember-title">记住此工具</span>
                <span className="tool-permission-gate__remember-desc">本聊天 24 小时内不再询问</span>
              </span>
            </label>
            <div className="tool-permission-gate__actions">
              <button
                type="button"
                className="tool-permission-gate__deny"
                onClick={() => onResolvePermission?.(permission.toolCallId, 'deny', false)}
              >
                拒绝
              </button>
              <button
                type="button"
                className="tool-permission-gate__approve"
                onClick={() =>
                  onResolvePermission?.(permission.toolCallId, 'approve', alwaysAllow)
                }
              >
                允许执行
              </button>
            </div>
          </div>
        ) : null}

        {tool.args && !permissionPending ? (
          <div className="tool-call-args" data-complete={tool.argsComplete ? 'true' : undefined}>
            {tool.args}
          </div>
        ) : null}

        {tool.progressSteps && tool.progressSteps.length > 0 ? (
          <div className="tool-progress-container">
            <div className="tpc-body">
              <div className="tpc-timeline">
                {tool.progressSteps.map((step, index) => (
                  <div
                    key={`${step.message ?? 'step'}-${index}`}
                    className={`tpc-step${step.progress >= 1 ? ' complete' : ' running'}`}
                  >
                    <span>{step.message || `步骤 ${index + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : tool.progress?.message ? (
          <div className="tool-progress-container">
            <div className="tpc-body">
              <div className="tpc-timeline">
                <div className="tpc-step running">
                  <span>{tool.progress.message}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tool.result !== undefined && tool.status !== 'approval' ? (
          <div className={`tool-call-result${tool.resultError ? ' error' : ''}`}>
            <strong>{tool.resultError ? '错误:' : '结果:'}</strong>
            <pre>{tool.resultError ? tool.result : tool.result}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
