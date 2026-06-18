import { getDefaultEnabledSystemToolNames } from '@meek/agent-core';

/** Web 请求体 mcpServerIds：M2 前仅做字符串过滤 */
export function sanitizeWebMcpServerIds(body: Record<string, unknown>): void {
  if (!Array.isArray(body.mcpServerIds)) {
    return;
  }
  body.mcpServerIds = body.mcpServerIds.filter((id): id is string => typeof id === 'string');
}

export function sanitizeWebEnabledSystemToolNames(body: Record<string, unknown>): void {
  if (!Array.isArray(body.enabledSystemToolNames)) {
    return;
  }
  const allowed = new Set(getDefaultEnabledSystemToolNames());
  body.enabledSystemToolNames = body.enabledSystemToolNames.filter(
    (name): name is string => typeof name === 'string' && allowed.has(name)
  );
}

export function sanitizeWebEnabledToolNames(body: Record<string, unknown>): void {
  if (!Array.isArray(body.enabledToolNames)) {
    return;
  }
  const names = body.enabledToolNames.filter(
    (name): name is string => typeof name === 'string' && name.length > 0
  );
  body.enabledToolNames = [...new Set(names)];
}
