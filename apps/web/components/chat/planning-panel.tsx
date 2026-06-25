'use client';

import { useMemo, useState } from 'react';

import type { PlanningItemState } from '@/lib/chat/chat-ui-types';
import { normalizePlanningItems } from '@/lib/chat/tool-renderers';

interface PlanningPanelProps {
  items: PlanningItemState[];
}

/** 任务计划浮层 — 对齐 planning-panel.js */
export function PlanningPanel({ items }: PlanningPanelProps): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const normalized = useMemo(() => normalizePlanningItems(items), [items]);

  if (normalized.length === 0) {
    return null;
  }

  const done = normalized.filter((item) => item.status === 'completed').length;
  const total = normalized.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`plan-dock ${open ? 'plan-dock--open' : ''}`} role="region" aria-label="任务计划">
      <button
        type="button"
        className="plan-fab"
        aria-expanded={open}
        title="任务计划"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="plan-fab__badge">{done}/{total}</span>
        <span className="plan-fab__label">计划</span>
      </button>
      {open ? (
        <div className="plan-popover">
          <header className="plan-dock__head">
            <h2 className="plan-dock__title">任务计划</h2>
            <button type="button" className="plan-dock__action" onClick={() => setOpen(false)}>
              收起
            </button>
          </header>
          <div className="plan-dock__progress-meta">
            <span>{done} / {total} 已完成</span>
            <span>{pct}%</span>
          </div>
          <div className="plan-dock__progress-bar">
            <div className="plan-dock__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <ul className="plan-dock__list">
            {normalized.map((item) => (
              <li
                key={item.id}
                className={`plan-dock__item plan-dock__item--${item.status ?? 'pending'}`}
              >
                {item.content}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
