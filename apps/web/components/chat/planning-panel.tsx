'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { PlanningItemState } from '@/lib/chat/chat-ui-types';
import { hasActivePlanItems, normalizePlanningItems } from '@/lib/chat/tool-renderers';

const PLAN_GAP = 12;
const PLAN_RING_LEN = 88;
const POPOVER_BOTTOM_PAD = 24;
export const CHAT_MESSAGES_ELEMENT_ID = 'chat-messages';

export interface PlanningPanelHandle {
  openSnapshot: (items?: PlanningItemState[], footText?: string) => void;
  clearPlanning: () => void;
}

interface PlanningPanelProps {
  items: PlanningItemState[];
}

function statusChar(status: string | undefined): string {
  if (status === 'completed') {
    return '✓';
  }
  if (status === 'in_progress') {
    return '●';
  }
  return '';
}

/** 任务计划浮层 — 对齐 planning-panel.js（fixed 锚定 #chat-messages 右上外侧） */
export const PlanningPanel = forwardRef<PlanningPanelHandle, PlanningPanelProps>(
  function PlanningPanel({ items }, ref) {
    const [mounted, setMounted] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [visible, setVisible] = useState(false);
    const [displayItems, setDisplayItems] = useState<PlanningItemState[]>([]);
    const [footText, setFootText] = useState<string | undefined>();
    const [updateCount, setUpdateCount] = useState(0);

    const dockRef = useRef<HTMLDivElement>(null);
    const fabRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const forceVisibleRef = useRef(false);

    const normalized = useMemo(() => normalizePlanningItems(items), [items]);

    const fitPopoverHeight = useCallback((): void => {
      const popover = popoverRef.current;
      const fab = fabRef.current;
      if (!popover || !fab || !expanded || !visible) {
        if (popover) {
          popover.style.height = '';
        }
        return;
      }
      const fabRect = fab.getBoundingClientRect();
      const popoverTop = fabRect.bottom + 10;
      const maxAvail = Math.max(120, window.innerHeight - popoverTop - POPOVER_BOTTOM_PAD);
      popover.style.height = 'auto';
      const natural = popover.scrollHeight;
      popover.style.height = `${Math.min(natural, maxAvail)}px`;
    }, [expanded, visible]);

    const syncPlanAnchor = useCallback((): void => {
      const dock = dockRef.current;
      const box = document.getElementById(CHAT_MESSAGES_ELEMENT_ID);
      if (!dock || !(box instanceof HTMLElement)) {
        return;
      }
      const rect = box.getBoundingClientRect();
      dock.style.top = `${Math.round(rect.top)}px`;
      dock.style.left = `${Math.round(rect.right + PLAN_GAP)}px`;
      fitPopoverHeight();
    }, [fitPopoverHeight]);

    const renderFromItems = useCallback(
      (list: PlanningItemState[], nextFootText?: string): void => {
        setDisplayItems(list);
        if (nextFootText !== undefined) {
          setFootText(nextFootText);
        }
      },
      []
    );

    const showDock = useCallback(
      (show: boolean): void => {
        setVisible(show);
        if (!show) {
          setExpanded(false);
          if (popoverRef.current) {
            popoverRef.current.style.height = '';
          }
        } else {
          requestAnimationFrame(syncPlanAnchor);
        }
      },
      [syncPlanAnchor]
    );

    const openSnapshot = useCallback(
      (snapshotItems?: PlanningItemState[], snapshotFootText?: string): void => {
        const list = normalizePlanningItems(snapshotItems ?? normalized);
        if (list.length === 0) {
          return;
        }
        forceVisibleRef.current = true;
        renderFromItems(list, snapshotFootText ?? '来自对话回溯');
        showDock(true);
        setExpanded(true);
        requestAnimationFrame(syncPlanAnchor);
      },
      [normalized, renderFromItems, showDock, syncPlanAnchor]
    );

    const clearPlanning = useCallback((): void => {
      forceVisibleRef.current = false;
      setUpdateCount(0);
      showDock(false);
      renderFromItems([]);
      setFootText(undefined);
    }, [renderFromItems, showDock]);

    useImperativeHandle(ref, () => ({ openSnapshot, clearPlanning }), [
      openSnapshot,
      clearPlanning,
    ]);

    useEffect(() => {
      setMounted(true);
    }, []);

    useEffect(() => {
      const list = normalized;
      if (list.length === 0) {
        forceVisibleRef.current = false;
        showDock(false);
        renderFromItems(list);
        return;
      }
      if (!hasActivePlanItems(list) && !forceVisibleRef.current) {
        showDock(false);
        renderFromItems(list);
        return;
      }
      if (hasActivePlanItems(list)) {
        forceVisibleRef.current = false;
        setUpdateCount((count) => count + 1);
      }
      renderFromItems(list);
      showDock(true);
    }, [normalized, renderFromItems, showDock]);

    useEffect(() => {
      if (!expanded && forceVisibleRef.current && !hasActivePlanItems(normalized)) {
        forceVisibleRef.current = false;
        showDock(false);
      }
    }, [expanded, normalized, showDock]);

    useEffect(() => {
      if (!mounted || !visible) {
        return;
      }
      syncPlanAnchor();
      const box = document.getElementById(CHAT_MESSAGES_ELEMENT_ID);
      if (!(box instanceof HTMLElement)) {
        return;
      }

      const onScroll = (): void => {
        syncPlanAnchor();
      };
      const resizeObserver = new ResizeObserver(() => {
        syncPlanAnchor();
      });

      box.addEventListener('scroll', onScroll, { passive: true });
      resizeObserver.observe(box);
      window.addEventListener('resize', syncPlanAnchor);

      return () => {
        box.removeEventListener('scroll', onScroll);
        resizeObserver.disconnect();
        window.removeEventListener('resize', syncPlanAnchor);
      };
    }, [mounted, visible, syncPlanAnchor]);

    useEffect(() => {
      if (expanded) {
        requestAnimationFrame(fitPopoverHeight);
      }
    }, [displayItems, expanded, fitPopoverHeight]);

    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && expanded) {
          setExpanded(false);
        }
      };
      const onDocumentClick = (event: MouseEvent): void => {
        if (!expanded || !visible) {
          return;
        }
        const dock = dockRef.current;
        if (dock && event.target instanceof Node && !dock.contains(event.target)) {
          setExpanded(false);
        }
      };
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('click', onDocumentClick);
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('click', onDocumentClick);
      };
    }, [expanded, visible]);

    const done = displayItems.filter((item) => item.status === 'completed').length;
    const total = displayItems.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const openCount = displayItems.filter((item) => item.status !== 'completed').length;
    const footerLabel =
      footText ?? (total > 0 ? `planning_update #${updateCount}` : '等待 planning_update…');

    if (!mounted) {
      return null;
    }

    const dock = (
      <div
        ref={dockRef}
        id="plan-dock"
        className={`plan-dock${visible ? '' : ' plan-dock--hidden'}${expanded ? ' plan-dock--open' : ''}`}
        role="region"
        aria-label="任务计划"
      >
        <button
          ref={fabRef}
          type="button"
          className="plan-fab"
          id="plan-fab"
          aria-expanded={expanded}
          aria-controls="plan-popover"
          title={expanded ? '收起任务计划' : '展开任务计划'}
          aria-label="任务计划"
          style={
            {
              '--plan-pct': String(pct),
              '--plan-ring-len': String(PLAN_RING_LEN),
            } as React.CSSProperties
          }
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className="plan-fab__visual" aria-hidden="true">
            <svg className="plan-fab__ring" viewBox="0 0 36 36">
              <circle className="plan-fab__ring-track" cx="18" cy="18" r="14" />
              <circle className="plan-fab__ring-progress" cx="18" cy="18" r="14" />
            </svg>
            <svg className="plan-fab__glyph" viewBox="0 0 24 24" fill="none">
              <rect
                x="4.5"
                y="3.5"
                width="15"
                height="17"
                rx="2.25"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8.25 8.25h7.5M8.25 12h7.5M8.25 15.75h4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M6.6 8.4l1.05 1.05 1.9-1.9M6.6 12l1.05 1.05 1.9-1.9"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="plan-fab__badge" hidden={openCount === 0}>
            {openCount}
          </span>
        </button>

        <div
          ref={popoverRef}
          id="plan-popover"
          className="plan-popover"
          aria-hidden={expanded ? 'false' : 'true'}
        >
          <div className="plan-popover__card">
            <header className="plan-dock__head">
              <div className="plan-dock__title-block">
                <h2 className="plan-dock__title">任务计划</h2>
              </div>
              <div className="plan-dock__actions">
                <button
                  type="button"
                  className="plan-dock__action"
                  title="收起到入口"
                  aria-label="收起"
                  onClick={() => setExpanded(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </header>
            <div className="plan-dock__progress-wrap">
              <div className="plan-dock__progress-meta">
                <span>
                  {done} / {total} 已完成
                </span>
                <span>{pct}%</span>
              </div>
              <div className="plan-dock__progress-bar">
                <div className="plan-dock__progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <ul className="plan-dock__list" id="plan-list">
              {displayItems.map((item) => (
                <li
                  key={item.id}
                  className={`plan-dock__item plan-dock__item--${item.status ?? 'pending'}`}
                >
                  <span className="plan-dock__status" aria-hidden="true">
                    {statusChar(item.status)}
                  </span>
                  <span className="plan-dock__item-text">
                    {item.content}
                    {item.status === 'in_progress' && item.activeForm ? (
                      <span className="plan-dock__item-active">{String(item.activeForm)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <footer className="plan-dock__foot">
              <span className="plan-dock__foot-dot" aria-hidden="true" />
              <span>{footerLabel}</span>
            </footer>
          </div>
        </div>
      </div>
    );

    return createPortal(dock, document.body);
  }
);
