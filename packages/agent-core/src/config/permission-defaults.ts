import { READ_PERSISTED_OUTPUT_CODE_NAME } from '../system-tools/read-persisted-output.js';

export const PERMISSION_DENY_PATTERNS: readonly string[] = [
  '*write*',
  '*delete*',
  '*shell*',
  '*apply_patch*',
  '*run_*',
];

export const PERMISSION_ALLOW_READONLY_PATTERNS: readonly string[] = [
  READ_PERSISTED_OUTPUT_CODE_NAME,
  'mcp__*__listAllApis',
  'mcp__*__getApiDetails',
  'mcp__*__askKnowledgeBase',
];

export function matchesPermissionPattern(pattern: string, codeName: string): boolean {
  const normalized = codeName.trim();
  if (!normalized) {
    return false;
  }
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(normalized);
}

export function matchesAnyPattern(patterns: readonly string[], codeName: string): boolean {
  return patterns.some((pattern) => matchesPermissionPattern(pattern, codeName));
}

export function isMcpCodeName(codeName: string): boolean {
  return codeName.startsWith('mcp__');
}
