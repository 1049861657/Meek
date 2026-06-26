import type { ToolInfo } from '@/lib/info/types';

/** 与后端 ToolPolicyService.isToolEnabled 语义一致（未写入 preference 视为启用） */
export function isToolEnabled(
  prefs: Record<string, boolean>,
  toolName: string,
): boolean {
  if (prefs[toolName] === undefined) {
    return true;
  }
  return prefs[toolName];
}

export function countEnabledTools(
  tools: ToolInfo[],
  prefs: Record<string, boolean>,
): { enabled: number; total: number; ratio: string } {
  const enabled = tools.filter((tool) => isToolEnabled(prefs, tool.name)).length;
  return { enabled, total: tools.length, ratio: `${enabled}/${tools.length}` };
}
