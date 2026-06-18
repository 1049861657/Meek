import { HookConfig } from './config/feature-config.js';
import { logToolCallAudit, type ToolCallAuditLog } from './audit.js';
import { registerChatPersistHook } from './chat-persist-hook.js';
import { registerMemoryRetainHook } from './memory-retain-hook.js';
import { registerHook } from './hook-runner.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAuditPayload(payload: Record<string, unknown>): ToolCallAuditLog | null {
  const {
    requestId,
    round,
    toolName,
    codeName,
    serverId,
    durationMs,
    success,
    error,
    permissionDecision
  } = payload;

  if (
    typeof requestId !== 'string'
    || typeof round !== 'number'
    || typeof toolName !== 'string'
    || typeof codeName !== 'string'
    || typeof durationMs !== 'number'
    || typeof success !== 'boolean'
  ) {
    return null;
  }

  return {
    requestId,
    round,
    toolName,
    codeName,
    serverId: typeof serverId === 'string' || serverId === null ? serverId : null,
    durationMs,
    success,
    error: typeof error === 'string' ? error : undefined,
    permissionDecision: typeof permissionDecision === 'string' ? permissionDecision : undefined
  };
}

function preToolArgsSizeCheck(payload: Record<string, unknown>): { exit_code: 0 | 1; message: string } {
  const input = payload.input;
  if (!isRecord(input)) {
    return { exit_code: 0, message: '' };
  }

  const serialized = JSON.stringify(input);
  if (serialized.length <= HookConfig.maxToolArgsChars) {
    return { exit_code: 0, message: '' };
  }

  const toolName = typeof payload.toolName === 'string' ? payload.toolName : 'unknown';
  return {
    exit_code: 1,
    message: `工具 ${toolName} 参数过大（${serialized.length} 字符，上限 ${HookConfig.maxToolArgsChars}）`
  };
}

function postToolAudit(payload: Record<string, unknown>): { exit_code: 0; message: string } {
  const audit = parseAuditPayload(payload);
  if (audit) {
    logToolCallAudit(audit);
  }
  return { exit_code: 0, message: '' };
}

export function registerBuiltinHooks(): void {
  if (HookConfig.enableArgsSizeCheck) {
    registerHook('PreToolUse', preToolArgsSizeCheck);
  }
  if (HookConfig.enableAuditHook) {
    registerHook('PostToolUse', postToolAudit);
  }
  registerMemoryRetainHook();
  registerChatPersistHook();
}
