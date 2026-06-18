import { Logger } from './lib/logger.js';
import type { TransitionReason, UsageInfo } from './types.js';

/** P1-07：已实现恢复路径（对齐 s11 子集） */
export type RecoveryKind = 'none' | 'backoff' | 'compact' | 'fail_fast' | 'fail';

/** 审计日志中的 token 快照 */
export interface AuditUsageSnapshot {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 单次 MCP / 内置工具调用审计（P0-06-01；token 见 llm_step_audit / agent_run_audit） */
export interface ToolCallAuditLog {
  requestId: string;
  round: number;
  toolName: string;
  codeName: string;
  serverId: string | null;
  durationMs: number;
  success: boolean;
  error?: string;
  permissionDecision?: string;
}

/** 单轮 LLM 调用审计（P1-07） */
export interface LlmStepAuditLog {
  requestId: string;
  round: number;
  stepTokens?: AuditUsageSnapshot;
  cumulativeTokens: AuditUsageSnapshot;
  recoveryKind: RecoveryKind;
  retryAttempts?: number;
}

/** 上下文压缩等恢复事件（P1-07） */
export interface RecoveryAuditLog {
  requestId: string;
  round: number;
  recoveryKind: 'compact' | 'fail_fast' | 'fail';
  reason?: string;
}

/** 单次 Agent 运行收尾审计（P1-07） */
export interface AgentRunAuditLog {
  requestId: string;
  sessionKey?: string;
  turnCount: number;
  transitionReason: TransitionReason;
  totalTokens: AuditUsageSnapshot;
  toolSuccess: number;
  toolFail: number;
  providerName: string;
}

export function toAuditUsage(usage: UsageInfo): AuditUsageSnapshot {
  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens
  };
}

export function logToolCallAudit(entry: ToolCallAuditLog): void {
  Logger.audit({
    type: 'tool_call_audit',
    ...entry
  });
}

export function logLlmStepAudit(entry: LlmStepAuditLog): void {
  Logger.audit({
    type: 'llm_step_audit',
    ...entry
  });
}

export function logRecoveryAudit(entry: RecoveryAuditLog): void {
  Logger.audit({
    type: 'recovery_audit',
    ...entry
  });
}

export function logAgentRunAudit(entry: AgentRunAuditLog): void {
  Logger.audit({
    type: 'agent_run_audit',
    ...entry
  });
}

/** P3-02-B：Hindsight recall 审计（对话日志可按时序重建） */
export function logMemoryRecallAudit(entry: {
  requestId: string;
  bankId: string;
  query: string;
  skipped: boolean;
  skipReason?: string;
  resultCount: number;
  results: Array<{ type: string; text: string }>;
}): void {
  Logger.audit({
    type: 'memory_recall_audit',
    ...entry
  });
}

/** P3-01：规划提醒注入审计 */
export function logPlanningReminderAudit(entry: {
  requestId: string;
  round: number;
  kind: 'plan_refresh' | 'active_plan';
  itemCount: number;
}): void {
  Logger.audit({
    type: 'planning_reminder_audit',
    ...entry
  });
}
