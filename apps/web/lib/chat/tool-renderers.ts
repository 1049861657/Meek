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
