/**
 * 工具渲染纯逻辑 — 对齐 renderers.js / todo-card-view.js
 */

import type { PlanningItemState } from './chat-ui-types';
import type { StoredToolCall } from './storage-contract';

const SYSTEM_TOOL_NAMES = new Set(['read_persisted_output', 'todo']);

export type ToolSource = 'system' | 'mcp';

export function resolveToolSource(toolOrSource: string | { source?: string; name?: string }): ToolSource {
  if (typeof toolOrSource === 'string') {
    if (toolOrSource === 'system' || toolOrSource === 'mcp') {
      return toolOrSource;
    }
    return SYSTEM_TOOL_NAMES.has(toolOrSource) ? 'system' : 'mcp';
  }
  if (toolOrSource.source === 'system' || toolOrSource.source === 'mcp') {
    return toolOrSource.source;
  }
  if (toolOrSource.name && SYSTEM_TOOL_NAMES.has(toolOrSource.name)) {
    return 'system';
  }
  return 'mcp';
}

export type TodoCardTone = 'idle' | 'active' | 'done' | 'cleared';

export interface TodoCardMetrics {
  tone: TodoCardTone;
  total: number;
  done: number;
  segments: PlanningItemState[];
}

/** 对齐 todo-card-view.js resolveTodoCardMetrics */
export function resolveTodoCardMetrics(
  summary: string,
  items: PlanningItemState[] = [],
): TodoCardMetrics {
  const list = normalizePlanningItems(items);
  if (list.length > 0) {
    const done = list.filter((item) => item.status === 'completed').length;
    const tone: TodoCardTone =
      done === list.length
        ? 'done'
        : list.some((item) => item.status === 'in_progress' || item.status === 'pending')
          ? 'active'
          : 'cleared';
    return { tone, total: list.length, done, segments: list };
  }

  const text = (summary || '').trim();
  if (!text || text === '执行中…') {
    return { tone: 'idle', total: 0, done: 0, segments: [] };
  }
  if (text === 'Todo 已清空') {
    return { tone: 'cleared', total: 0, done: 0, segments: [] };
  }

  const allDone = text.match(/^(\d+)\/(\d+)\s*已完成$/);
  if (allDone) {
    const total = Number.parseInt(allDone[2] ?? '0', 10);
    return {
      tone: 'done',
      total,
      done: total,
      segments: Array.from({ length: total }, (_, index) => ({
        id: String(index + 1),
        content: '',
        status: 'completed',
      })),
    };
  }

  const updated = text.match(/^已更新\s+(\d+)\s+项$/);
  if (updated) {
    const total = Number.parseInt(updated[1] ?? '0', 10);
    return {
      tone: 'active',
      total,
      done: 0,
      segments: Array.from({ length: total }, (_, index) => ({
        id: String(index + 1),
        content: '',
        status: 'pending',
      })),
    };
  }

  const inProg = text.match(/进行中\s+(\d+)/);
  const pending = text.match(/待办\s+(\d+)/);
  if (inProg || pending) {
    const nActive = inProg ? Number.parseInt(inProg[1] ?? '0', 10) : 0;
    const nPending = pending ? Number.parseInt(pending[1] ?? '0', 10) : 0;
    const total = nActive + nPending;
    const segments: PlanningItemState[] = [];
    for (let index = 0; index < nActive; index += 1) {
      segments.push({ id: `a${index}`, content: '', status: 'in_progress' });
    }
    for (let index = 0; index < nPending; index += 1) {
      segments.push({ id: `p${index}`, content: '', status: 'pending' });
    }
    return { tone: 'active', total, done: 0, segments };
  }

  return { tone: 'active', total: 0, done: 0, segments: [] };
}

export function getToolSourceLabel(source: ToolSource): string {
  return source === 'system' ? 'System' : 'MCP';
}

export function getToolSourceTitle(source: ToolSource): string {
  return source === 'system' ? 'System · 本地系统工具' : 'MCP · 外部工具';
}

export function hasActivePlanItems(items: PlanningItemState[]): boolean {
  return items.some(
    (item) => item.status === 'pending' || item.status === 'in_progress'
  );
}

export function normalizePlanningItems(raw: unknown): PlanningItemState[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (item): item is PlanningItemState =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as PlanningItemState).id === 'string' &&
      typeof (item as PlanningItemState).content === 'string' &&
      ['pending', 'in_progress', 'completed'].includes(String((item as PlanningItemState).status))
  );
}

/** 历史回放：同轮多条 todo 合并为单卡 */
export function mergeHistoricalTodoCalls(toolCalls: StoredToolCall[]): StoredToolCall[] {
  const todos = toolCalls.filter((tc) => tc.name === 'todo');
  if (todos.length <= 1) {
    return toolCalls;
  }
  const last = todos[todos.length - 1]!;
  const mergedTodo: StoredToolCall = {
    ...last,
    revision: last.revision ?? todos.length,
  };
  const out: StoredToolCall[] = [];
  let todoMerged = false;
  for (const tc of toolCalls) {
    if (tc.name === 'todo') {
      if (!todoMerged) {
        out.push(mergedTodo);
        todoMerged = true;
      }
      continue;
    }
    out.push(tc);
  }
  return out;
}

export function formatStoredToolArgs(args: unknown): string {
  if (typeof args === 'string') {
    return args;
  }
  try {
    return JSON.stringify(args ?? {}, null, 2);
  } catch {
    return String(args ?? '');
  }
}

export function formatStoredToolResult(result: unknown, isError?: boolean): string {
  if (result === null || result === undefined) {
    return '';
  }
  if (typeof result === 'object' && result !== null && (result as { _truncated?: boolean })._truncated) {
    const truncated = result as { preview?: string; originalSize?: number };
    return `[结果已截断，原始大小: ${truncated.originalSize ?? '?'} 字节]\n${truncated.preview ?? ''}...`;
  }
  const str = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return isError ? str : str;
}
