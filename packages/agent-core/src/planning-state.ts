import { PlanningConfig } from './config/feature-config.js';
import { logPlanningReminderAudit } from './audit.js';
import type { InternalMessage } from './types.js';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  activeForm?: string;
}

/** 会话内规划状态（独立于 messages[]） */
export interface PlanningState {
  items: TodoItem[];
  roundsSinceUpdate: number;
}

export interface HarnessReminderPayload {
  type: 'harness_reminder';
  kind?: 'plan_refresh' | 'memory_conflict';
  summary: string;
}

export const TODO_TOOL_CODE_NAME = 'todo';

export function createPlanningState(): PlanningState {
  return {
    items: [],
    roundsSinceUpdate: 0
  };
}

export function hasActivePlan(planning: PlanningState): boolean {
  return planning.items.some(
    item => item.status === 'pending' || item.status === 'in_progress'
  );
}

function buildHarnessReminderSummary(
  planning: PlanningState,
  kind?: 'plan_refresh'
): string {
  const active = planning.items.filter(
    item => item.status === 'pending' || item.status === 'in_progress'
  );
  const inProgress = planning.items.find(item => item.status === 'in_progress');
  let summary = `计划仍有 ${active.length} 项未完成`;
  if (inProgress) {
    summary += `，当前进行中：${inProgress.activeForm ?? inProgress.content}`;
  }
  if (kind === 'plan_refresh') {
    summary += '。请用 todo 工具刷新进度';
  }
  return summary;
}

export function buildHarnessReminderContent(
  planning: PlanningState,
  kind?: 'plan_refresh'
): string {
  const payload: HarnessReminderPayload = {
    type: 'harness_reminder',
    summary: buildHarnessReminderSummary(planning, kind)
  };
  if (kind === 'plan_refresh') {
    payload.kind = 'plan_refresh';
  }
  return JSON.stringify(payload);
}

export function appendPlanningReminder(
  messages: InternalMessage[],
  planning: PlanningState,
  kind?: 'plan_refresh'
): void {
  messages.push({
    role: 'user',
    content: buildHarnessReminderContent(planning, kind),
    _source: 'reminder'
  });
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} 须为非空字符串`);
  }
  return value.trim();
}

function parseTodoStatus(value: unknown): TodoStatus {
  if (value !== 'pending' && value !== 'in_progress' && value !== 'completed') {
    throw new Error('status 须为 pending | in_progress | completed');
  }
  return value;
}

function parseTodoItem(raw: unknown): TodoItem {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('items 元素须为对象');
  }
  const record = raw as Record<string, unknown>;
  const id = assertNonEmptyString(record.id, 'id');
  const content = assertNonEmptyString(record.content, 'content');
  const status = parseTodoStatus(record.status);
  const item: TodoItem = { id, content, status };
  if (record.activeForm !== undefined && record.activeForm !== null) {
    item.activeForm = assertNonEmptyString(record.activeForm, 'activeForm');
  }
  return item;
}

function assertAtMostOneInProgress(items: TodoItem[]): void {
  const inProgress = items.filter(item => item.status === 'in_progress');
  if (inProgress.length > 1) {
    throw new Error('至多 1 个 in_progress');
  }
}

/** 校验并合并 todo 入参，返回新 items 快照 */
export function applyTodoUpdate(
  current: TodoItem[],
  merge: boolean,
  rawItems: unknown
): TodoItem[] {
  if (!Array.isArray(rawItems)) {
    throw new Error('items 须为数组');
  }
  const incoming = rawItems.map(parseTodoItem);
  if (incoming.length > PlanningConfig.maxTodoItems) {
    throw new Error(`Todo 最多 ${PlanningConfig.maxTodoItems} 条`);
  }
  assertAtMostOneInProgress(incoming);

  if (!merge) {
    return incoming;
  }

  const byId = new Map(current.map(item => [item.id, { ...item }]));
  for (const item of incoming) {
    byId.set(item.id, { ...item });
  }
  const merged = [...byId.values()];
  if (merged.length > PlanningConfig.maxTodoItems) {
    throw new Error(`Todo 最多 ${PlanningConfig.maxTodoItems} 条`);
  }
  assertAtMostOneInProgress(merged);
  return merged;
}

/** 工具轮结束后：更新未调用计数并按需注入 harness_reminder */
export function finalizePlanningAfterToolRound(
  messages: InternalMessage[],
  planning: PlanningState,
  roundHadSuccessfulTodo: boolean,
  audit?: { requestId: string; round: number }
): void {
  if (!hasActivePlan(planning)) {
    return;
  }

  if (!roundHadSuccessfulTodo) {
    planning.roundsSinceUpdate += 1;
  }

  const kind = planning.roundsSinceUpdate >= PlanningConfig.planRefreshRounds
    ? 'plan_refresh'
    : undefined;

  appendPlanningReminder(messages, planning, kind);

  if (audit?.requestId) {
    logPlanningReminderAudit({
      requestId: audit.requestId,
      round: audit.round,
      kind: kind ?? 'active_plan',
      itemCount: planning.items.length
    });
  }
}

/** 工具结果仅一行摘要，禁止整表 items 进入 messages[] */
export function formatTodoToolResult(items: TodoItem[]): string {
  if (items.length === 0) {
    return 'Todo 已清空';
  }
  const inProgress = items.filter(item => item.status === 'in_progress').length;
  const pending = items.filter(item => item.status === 'pending').length;
  const completed = items.filter(item => item.status === 'completed').length;
  if (inProgress > 0 || pending > 0) {
    const parts: string[] = [];
    if (inProgress > 0) {
      parts.push(`进行中 ${inProgress} 项`);
    }
    if (pending > 0) {
      parts.push(`待办 ${pending} 项`);
    }
    return parts.join(' · ');
  }
  if (completed === items.length) {
    return `${completed}/${items.length} 已完成`;
  }
  return `已更新 ${items.length} 项`;
}
