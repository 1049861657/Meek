'use client';

import { useEffect, useState } from 'react';

import type { PlanningItemState } from '@/lib/chat/chat-ui-types';
import {
  getToolSourceTitle,
  normalizePlanningItems,
  resolveTodoCardMetrics,
  type TodoCardTone,
} from '@/lib/chat/tool-renderers';

interface TodoToolCardProps {
  summary?: string;
  items?: PlanningItemState[];
  revision?: number;
  onOpenPlanning?: () => void;
}

function statusPillLabel(tone: TodoCardTone): string {
  switch (tone) {
    case 'idle':
      return '同步中';
    case 'active':
      return '跟踪中';
    case 'done':
      return '已完成';
    case 'cleared':
      return '已清空';
    default:
      return '跟踪中';
  }
}

function renderSegments(
  segments: PlanningItemState[],
  tone: TodoCardTone,
): React.ReactElement {
  if (tone === 'idle') {
    return (
      <div className="todo-card__segments">
        <span className="todo-card__seg todo-card__seg--idle" aria-hidden="true" />
        <span className="todo-card__seg todo-card__seg--idle" aria-hidden="true" />
        <span className="todo-card__seg todo-card__seg--idle" aria-hidden="true" />
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="todo-card__segments">
        <span className="todo-card__seg todo-card__seg--empty" aria-hidden="true" />
      </div>
    );
  }

  const maxShow = 8;
  const visible = segments.slice(0, maxShow);
  const overflow = segments.length - maxShow;
  const ariaLabel =
    segments.length > 0
      ? `todo ${segments.filter((item) => item.status === 'completed').length} / ${segments.length} 已完成，点击在右侧面板查看`
      : 'todo，点击在右侧面板查看';

  return (
    <div className="todo-card__segments" aria-label={ariaLabel}>
      {visible.map((item) => (
        <span
          key={item.id}
          className={`todo-card__seg todo-card__seg--${item.status}`}
          title={item.content || item.status}
          aria-hidden="true"
        />
      ))}
      {overflow > 0 ? (
        <span className="todo-card__seg todo-card__seg--more" title={`+${overflow}`}>
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

/** Todo 工具卡 — 对齐 todo-card-view.js renderTodoCard */
export function TodoToolCard({
  summary,
  items = [],
  revision,
  onOpenPlanning,
}: TodoToolCardProps): React.ReactElement {
  const normalized = normalizePlanningItems(items);
  const metrics = resolveTodoCardMetrics(summary ?? '', normalized);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!revision || revision <= 1) {
      return;
    }
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 650);
    return () => window.clearTimeout(timer);
  }, [revision]);

  const open = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation();
    onOpenPlanning?.();
  };

  return (
    <div
      className={`tool-call collapsed tool-call--system tool-call--todo-slot tool-call--todo-clickable${flash ? ' tool-call--todo-flash' : ''}`}
      data-todo-slot="single"
      data-todo-revision={revision ?? 1}
      role="button"
      tabIndex={0}
      aria-label={
        metrics.total > 0
          ? `todo ${metrics.done} / ${metrics.total} 已完成，点击在右侧面板查看`
          : 'todo，点击在右侧面板查看'
      }
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(event);
        }
      }}
    >
      <div className="tool-call-header todo-card-header">
        <div className="tool-call-title">
          <span
            className="tool-source-icon-wrap tool-source-icon-wrap--system"
            title={getToolSourceTitle('system')}
          >
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
          </span>
          <span className="tool-source-badge tool-source-badge--system" title={getToolSourceTitle('system')}>
            System
          </span>
          <span className="tool-call-name-row">
            <code className="tool-call-name">todo</code>
          </span>
        </div>
        <div className="tool-call-status todo-card-status">
          <div className="todo-card__viz" aria-hidden="true">
            {renderSegments(metrics.segments, metrics.tone)}
          </div>
          <span className={`todo-card__pill todo-card__pill--${metrics.tone}`}>
            {statusPillLabel(metrics.tone)}
          </span>
          <span className="todo-card__panel-hint" aria-hidden="true" title="在右侧面板查看">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
      <div className="tool-call-content" />
    </div>
  );
}
