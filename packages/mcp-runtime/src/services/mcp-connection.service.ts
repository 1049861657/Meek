import { randomUUID } from 'node:crypto';

import { ToolPolicyService } from '@meek/agent-core';

import { getMcpClientForUser } from '../mcp/mcp-client-manager.js';
import type { MCPClientManager } from '../mcp/mcp-client-manager.js';
import type { ToolInfo } from '../types/mcp-runtime.types.js';

import { McpConfigService } from './mcp-config.service.js';
import type { McpProbeSelectionResult, McpReachabilityEntry } from './mcp-reachability.service.js';
import { McpReachabilityService } from './mcp-reachability.service.js';
import { ToolPreferencesService } from './tool-preferences.service.js';

type ToolPartitionContext = {
  serverTools: Record<string, ToolInfo[]>;
  store: Awaited<ReturnType<typeof ToolPreferencesService.getAll>>;
  nameById: Map<string, string>;
};

/**
 * MCP 运行时连接编排 SSOT。
 * 配置归属见 McpConfigStore；Web 聊天选择见 localStorage enabledServerIds。
 */
export class McpConnectionService {
  static beginChatScope(configUserId: string | null, chatRequestId: string): void {
    getMcpClientForUser(configUserId).beginChatEphemeralScope(chatRequestId);
  }

  static async releaseChatScope(configUserId: string | null, chatRequestId: string): Promise<void> {
    await getMcpClientForUser(configUserId).releaseChatEphemeralConnections(chatRequestId);
  }

  static async filterConfiguredServerIds(
    requestedIds: string[],
    configUserId: string | null
  ): Promise<string[]> {
    const configured = await McpConfigService.listConfiguredMcpServers(configUserId ?? undefined);
    const allowed = new Set(configured.map((row) => row.serverId));
    return [...new Set(requestedIds)].filter((id) => allowed.has(id));
  }

  static async filterPoolEnabledServerIds(
    requestedIds: string[],
    configUserId: string | null
  ): Promise<string[]> {
    const config = await McpConfigService.getMCPConfig(configUserId ?? undefined);
    const allowed = new Set(
      config.servers.filter((server) => server.enabled).map((server) => server.serverId)
    );
    return [...new Set(requestedIds)].filter((id) => allowed.has(id));
  }

  static async ensureForChat(
    serverIds: string[],
    configUserId: string | null,
    chatRequestId: string
  ) {
    return McpReachabilityService.filterReachableServerIds(serverIds, configUserId, {
      mode: 'chat-ephemeral',
      chatRequestId,
    });
  }

  static async filterServersWithEnabledTools(
    serverIds: string[],
    configUserId: string | null
  ): Promise<string[]> {
    if (serverIds.length === 0) {
      return [];
    }
    const ctx = await McpConnectionService.loadToolPartitionContext(configUserId, serverIds);
    return McpConnectionService.partitionByEnabledTools(serverIds, ctx).usableIds;
  }

  static async probeForSelection(
    serverIds: string[],
    configUserId: string | null
  ): Promise<McpProbeSelectionResult> {
    const uniqueIds = [...new Set(serverIds)];
    if (uniqueIds.length === 0) {
      return { reachableIds: [], unreachable: [], skippedNoTools: [] };
    }

    const probeRequestId = `probe-${randomUUID()}`;
    this.beginChatScope(configUserId, probeRequestId);
    try {
      const { reachableIds, unreachable } = await this.ensureForChat(
        uniqueIds,
        configUserId,
        probeRequestId
      );
      const ctx = await McpConnectionService.loadToolPartitionContext(configUserId, reachableIds);
      const { usableIds, skippedNoTools } = McpConnectionService.partitionByEnabledTools(
        reachableIds,
        ctx
      );
      return { reachableIds: usableIds, unreachable, skippedNoTools };
    } finally {
      await this.releaseChatScope(configUserId, probeRequestId);
    }
  }

  private static async loadToolPartitionContext(
    configUserId: string | null,
    serverIds: string[]
  ): Promise<ToolPartitionContext> {
    const client = getMcpClientForUser(configUserId);
    await client.ensureReady();
    const config = await McpConfigService.getMCPConfig(configUserId ?? undefined);
    const nameById = new Map(config.servers.map((server) => [server.serverId, server.name]));
    const [serverInfo, store] = await Promise.all([
      client.getServerInfo(),
      ToolPreferencesService.getAll(),
    ]);
    const serverTools = McpConnectionService.mergeServerTools(
      client,
      serverInfo.serverTools ?? {},
      serverIds
    );
    return { serverTools, store, nameById };
  }

  private static mergeServerTools(
    client: MCPClientManager,
    serverTools: Record<string, ToolInfo[]>,
    serverIds: string[]
  ): Record<string, ToolInfo[]> {
    const merged = { ...serverTools };
    for (const serverId of serverIds) {
      if (!merged[serverId]?.length) {
        const cached = client.getCachedTools(serverId);
        if (cached.length > 0) {
          merged[serverId] = cached;
        }
      }
    }
    return merged;
  }

  private static partitionByEnabledTools(
    serverIds: string[],
    ctx: ToolPartitionContext
  ): { usableIds: string[]; skippedNoTools: McpReachabilityEntry[] } {
    const usableIds: string[] = [];
    const skippedNoTools: McpReachabilityEntry[] = [];
    for (const serverId of serverIds) {
      const { enabled } = ToolPolicyService.countEnabledTools(serverId, ctx.serverTools, ctx.store);
      if (enabled > 0) {
        usableIds.push(serverId);
      } else {
        skippedNoTools.push({ id: serverId, name: ctx.nameById.get(serverId) ?? serverId });
      }
    }
    return { usableIds, skippedNoTools };
  }
}
