'use client';

import type { PlanningItemState } from '@/lib/chat/chat-ui-types';
import { normalizePlanningItems } from '@/lib/chat/tool-renderers';

interface TodoToolCardProps {
  summary?: string;
  items?: PlanningItemState[];
  onOpenPlanning?: () => void;
}

/** Todo 工具卡 — 对齐 todo-card-view.js renderTodoCard */
export function TodoToolCard({
  summary,
  items = [],
  onOpenPlanning,
}: TodoToolCardProps): React.ReactElement {
  const normalized = normalizePlanningItems(items);
  const done = normalized.filter((item) => item.status === 'completed').length;
  const total = normalized.length;

  return (
    <button
      type="button"
      className="todo-tool-card"
      onClick={onOpenPlanning}
      title="查看任务计划"
    >
      <span className="todo-tool-card__title">Todo</span>
      <span className="todo-tool-card__summary">{summary || (total > 0 ? `${done}/${total} 已完成` : '执行中…')}</span>
      {total > 0 ? (
        <span className="todo-tool-card__bar">
          <span
            className="todo-tool-card__bar-fill"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </span>
      ) : null}
    </button>
  );
}
