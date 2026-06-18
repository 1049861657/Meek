import type { ChannelId } from '@meek/shared';

/** 工具执行方式：open 自动 · interactive 确认 · locked 只读 */
export type PermissionMode = 'open' | 'interactive' | 'locked';

export function parsePermissionMode(value: unknown): PermissionMode {
  if (value === 'open' || value === 'interactive' || value === 'locked') {
    return value;
  }
  throw new Error(`无效的 permissionMode: ${String(value)}`);
}

export function parseImPermissionMode(value: unknown): 'open' | 'locked' {
  if (value === 'open' || value === 'locked') {
    return value;
  }
  throw new Error('IM 渠道 permissionMode 须为 open 或 locked');
}

export type PermissionBehavior = 'allow' | 'deny' | 'ask';

export interface PermissionDecision {
  behavior: PermissionBehavior;
  reason: string;
}

export interface PermissionCheckContext {
  codeName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  mode: PermissionMode;
  channel: ChannelId;
  sessionKey: string;
  requestId: string;
}

export type PermissionResolveDecision = 'approve' | 'deny';
