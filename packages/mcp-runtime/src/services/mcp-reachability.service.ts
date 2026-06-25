import { getMcpClientForUser } from '../mcp/mcp-client-manager.js';
import type { MCPClientManager } from '../mcp/mcp-client-manager.js';
import type { McpEnsureOptions } from '../types/mcp-connection.types.js';

import { McpConfigService } from './mcp-config.service.js';

export type McpReachabilityEntry = { id: string; name: string };

export type McpReachabilityResult = {
  reachableIds: string[];
  unreachable: McpReachabilityEntry[];
};

/** Web MCP 弹窗保存嗅探：reachableIds 已排除无启用工具的服 */
export type McpProbeSelectionResult = McpReachabilityResult & {
  skippedNoTools: McpReachabilityEntry[];
};

/** 保存门禁输出：仅 persistIds 写入 Profile，skipped 返回给 UI 提示 */
export type McpPersistencePartition = {
  persistIds: string[];
  skipped: McpReachabilityEntry[];
};

/**
 * MCP 连通性探测与保存门禁（编排层）。
 * 运行时探测委托 MCPClientManager.ensureServerReachable / partitionServerIdsByReachability。
 */
export class McpReachabilityService {
  static async partitionForPersistence(
    requestedIds: string[],
    configUserId: string | null,
    enableTools: boolean
  ): Promise<McpPersistencePartition> {
    if (!enableTools) {
      return { persistIds: [], skipped: [] };
    }

    const uniqueIds = [...new Set(requestedIds)];
    if (uniqueIds.length === 0) {
      return { persistIds: [], skipped: [] };
    }

    const { reachableIds, unreachable } = await McpReachabilityService.filterReachableServerIds(
      uniqueIds,
      configUserId
    );
    return { persistIds: reachableIds, skipped: unreachable };
  }

  static async filterReachableServerIds(
    serverIds: string[],
    configUserId: string | null = null,
    options?: McpEnsureOptions
  ): Promise<McpReachabilityResult> {
    const configured = await McpConfigService.listConfiguredMcpServers(configUserId ?? undefined);
    const nameById = new Map(configured.map((row) => [row.serverId, row.name]));

    const uniqueIds = [...new Set(serverIds)];
    const unknownIds: string[] = [];
    const probeIds: string[] = [];

    for (const serverId of uniqueIds) {
      if (nameById.has(serverId)) {
        probeIds.push(serverId);
      } else {
        unknownIds.push(serverId);
      }
    }

    const client = getMcpClientForUser(configUserId);
    await client.ensureReady();
    const ensureOptions: McpEnsureOptions = options?.chatRequestId
      ? { mode: options.mode ?? 'chat-ephemeral', chatRequestId: options.chatRequestId }
      : { mode: options?.mode ?? 'admin-probe' };
    const { reachableIds, unreachableIds } = await client.partitionServerIdsByReachability(
      probeIds,
      ensureOptions
    );

    const unreachable: McpReachabilityEntry[] = [
      ...unknownIds.map((id) => ({ id, name: id })),
      ...unreachableIds.map((id) => ({ id, name: nameById.get(id) ?? id })),
    ];

    return { reachableIds, unreachable };
  }

  static async probeServerConnection(
    serverId: string,
    configUserId: string | null = null,
    clientOverride?: MCPClientManager
  ): Promise<boolean> {
    const client = clientOverride ?? getMcpClientForUser(configUserId);
    await client.ensureReady();
    return client.ensureServerReachable(serverId);
  }
}
