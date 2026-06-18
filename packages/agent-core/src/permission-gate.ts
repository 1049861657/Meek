import {
  matchesAnyPattern,
  PERMISSION_ALLOW_READONLY_PATTERNS,
  PERMISSION_DENY_PATTERNS,
  isMcpCodeName
} from './config/permission-defaults.js';
import type {
  PermissionBehavior,
  PermissionCheckContext,
  PermissionDecision,
  PermissionMode
} from './config/permission.types.js';
import { parsePermissionMode } from './config/permission.types.js';
import type { ChannelId, MemoryIdentityScope } from '@meek/shared';
import { isSessionToolAllowed } from './permission-session.js';

/** 按渠道校验并返回最终 permissionMode（Profile / Web body 已解析） */
export function resolvePermissionMode(
  channel: ChannelId,
  mode: PermissionMode
): PermissionMode {
  const parsed = parsePermissionMode(mode);
  if (channel === 'web') {
    return parsed;
  }
  if (parsed !== 'open' && parsed !== 'locked') {
    throw new Error(
      `渠道 ${channel} 不支持确认模式（interactive），Profile 须为 open 或 locked`
    );
  }
  return parsed;
}

function decision(behavior: PermissionBehavior, reason: string): PermissionDecision {
  return { behavior, reason };
}

/**
 * 执行前权限判定：deny → mode（open / locked / interactive + allow / ask）
 */
export async function checkPermission(ctx: PermissionCheckContext): Promise<PermissionDecision> {
  if (matchesAnyPattern(PERMISSION_DENY_PATTERNS, ctx.codeName)) {
    return decision('deny', 'matched_deny_rule');
  }

  if (ctx.mode === 'open') {
    return decision('allow', 'mode:open');
  }

  const readonlyAllow = matchesAnyPattern(PERMISSION_ALLOW_READONLY_PATTERNS, ctx.codeName);

  if (ctx.mode === 'locked') {
    return readonlyAllow
      ? decision('allow', 'mode:locked_readonly')
      : decision('deny', 'mode:locked_not_allowlisted');
  }

  if (readonlyAllow) {
    return decision('allow', 'allowReadonly');
  }

  if (await isSessionToolAllowed(ctx.sessionKey, ctx.codeName)) {
    return decision('allow', 'session_always_allow');
  }

  if (isMcpCodeName(ctx.codeName) || ctx.toolName === 'executeApi') {
    return decision('ask', 'interactive_gray');
  }

  return decision('ask', 'interactive_unlisted');
}

export function buildArgsPreview(args: Record<string, unknown>, maxLen = 800): string {
  try {
    const text = JSON.stringify(args);
    if (text.length <= maxLen) {
      return text;
    }
    return `${text.slice(0, maxLen)}…`;
  } catch {
    return String(args);
  }
}
