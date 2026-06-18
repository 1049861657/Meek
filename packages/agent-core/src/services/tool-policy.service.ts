import { createHash } from 'node:crypto';

import type { ResolvedProfile } from '@meek/shared';
import type { ChatTool } from '../types.js';
import { getMcpClientForUser } from '../ports/mcp-client-port.js';
import { resolveMcpPoolKey } from '../lib/mcp-pool-key.js';
import type { ToolInfo, McpToolPreferencesStore } from '../mcp-types.js';
import { getToolPreferencesService } from '../ports/tool-preferences-port.js';

/** 工具启用策略 SSOT：Schema / Prompt / Web 入站 / 执行层共用 */
export class ToolPolicyService {
  static isToolEnabled(
    store: McpToolPreferencesStore,
    serverId: string,
    toolName: string
  ): boolean {
    const serverPrefs = store[serverId];
    if (!serverPrefs || serverPrefs[toolName] === undefined) {
      return true;
    }
    return serverPrefs[toolName];
  }

  static resolveEnabledCodeNames(
    serverIds: string[],
    serverTools: Record<string, ToolInfo[]>,
    store: McpToolPreferencesStore
  ): string[] {
    const codeNames: string[] = [];
    for (const serverId of serverIds) {
      for (const tool of serverTools[serverId] ?? []) {
        if (this.isToolEnabled(store, serverId, tool.name)) {
          codeNames.push(tool.codeName);
        }
      }
    }
    return codeNames;
  }

  static buildEnabledSetHash(serverIds: string[], enabledCodeNames: string[]): string {
    const payload = JSON.stringify({
      serverIds: [...serverIds].sort(),
      toolCodeNames: [...enabledCodeNames].sort(),
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  static buildAllowedCodeNames(chatTools: ChatTool[]): Set<string> {
    const allowed = new Set<string>();
    for (const tool of chatTools) {
      const name = tool.function?.name;
      if (typeof name === 'string' && name.length > 0) {
        allowed.add(name);
      }
    }
    return allowed;
  }

  static assertToolCallable(
    codeName: string,
    allowedCodeNames: Set<string>
  ): { allowed: true } | { allowed: false; message: string } {
    if (allowedCodeNames.has(codeName)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      message:
        `工具「${codeName}」未启用或未在本轮可用工具列表中，无法执行。` +
        '请仅调用系统提示中「启用工具（摘要）」列出的工具。',
    };
  }

  static async resolveEnabledCodeNamesForProfile(
    resolvedProfile?: Pick<
      ResolvedProfile,
      'mcpServerIds' | 'enabledToolNames' | 'configUserId'
    >,
    configUserId: string | null = null
  ): Promise<string[] | undefined> {
    if (resolvedProfile?.enabledToolNames !== undefined) {
      return [...resolvedProfile.enabledToolNames];
    }
    const serverIds = resolvedProfile?.mcpServerIds;
    if (!serverIds?.length) {
      return undefined;
    }
    const poolKey = resolveMcpPoolKey(resolvedProfile) ?? configUserId;
    const [serverInfo, store] = await Promise.all([
      getMcpClientForUser(poolKey).getServerInfo(),
      getToolPreferencesService().getAll(),
    ]);
    return this.resolveEnabledCodeNames(
      serverIds,
      serverInfo.serverTools ?? {},
      store
    );
  }

  static async sanitizeWebEnabledToolNames(
    names: string[],
    mcpServerIds: string[],
    configUserId: string | null = null
  ): Promise<string[]> {
    if (!mcpServerIds.length) {
      return [];
    }
    const enabled = await this.resolveEnabledCodeNamesForProfile(
      { mcpServerIds, configUserId: configUserId ?? undefined },
      configUserId
    );
    if (!enabled?.length) {
      return [];
    }
    const allowed = new Set(enabled);
    return names.filter((name) => allowed.has(name));
  }

  static collectEnabledTools(
    serverIds: string[],
    serverTools: Record<string, ToolInfo[]>,
    store: McpToolPreferencesStore
  ): ToolInfo[] {
    const enabledTools: ToolInfo[] = [];
    for (const serverId of serverIds) {
      for (const tool of serverTools[serverId] ?? []) {
        if (this.isToolEnabled(store, serverId, tool.name)) {
          enabledTools.push(tool);
        }
      }
    }
    return enabledTools;
  }

  static countEnabledTools(
    serverId: string,
    serverTools: Record<string, ToolInfo[]>,
    store: McpToolPreferencesStore
  ): { enabled: number; total: number } {
    const tools = serverTools[serverId] ?? [];
    let enabled = 0;
    for (const tool of tools) {
      if (this.isToolEnabled(store, serverId, tool.name)) {
        enabled += 1;
      }
    }
    return { enabled, total: tools.length };
  }

  static async collectEnabledToolsForServerIds(
    serverIds: string[],
    configUserId: string | null = null
  ): Promise<ToolInfo[]> {
    const [serverInfo, store] = await Promise.all([
      getMcpClientForUser(configUserId).getServerInfo(),
      getToolPreferencesService().getAll(),
    ]);
    return this.collectEnabledTools(serverIds, serverInfo.serverTools ?? {}, store);
  }
}
