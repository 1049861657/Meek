import { ToolPolicyService } from '@meek/agent-core';
import {
  getMcpClientForUser,
  McpConfigService,
  McpConnectionService,
  ToolPreferencesService,
  type ToolInfo,
} from '@meek/mcp-runtime';

import { ensureWorkerRuntimeForUser } from './runtime-bootstrap.js';

export type McpAgentHandlerSuccess<T> = { ok: true; status: number; data: T };
export type McpAgentHandlerFailure = {
  ok: false;
  status: number;
  error: string;
  details?: string;
};
export type McpAgentHandlerResult<T> = McpAgentHandlerSuccess<T> | McpAgentHandlerFailure;

type McpServerRow = {
  id: string;
  name: string;
  isConnected: boolean;
  poolEnabled: boolean;
  toolsEnabled: number;
  toolsTotal: number;
};

function fail(status: number, error: string, details?: string): McpAgentHandlerFailure {
  return { ok: false, status, error, ...(details ? { details } : {}) };
}

function ok<T>(data: T, status = 200): McpAgentHandlerSuccess<T> {
  return { ok: true, status, data };
}

export async function handleMcpListServers(
  configUserId: string | null,
  scopeRaw: string | undefined
): Promise<McpAgentHandlerResult<{ success: true; servers: McpServerRow[] }>> {
  try {
    await ensureWorkerRuntimeForUser(configUserId);
    const scope = scopeRaw ?? 'connected';
    const client = getMcpClientForUser(configUserId);
    const [serverInfo, store, mcpConfig] = await Promise.all([
      client.getServerInfo(),
      ToolPreferencesService.getAll(),
      McpConfigService.getMCPConfig(configUserId ?? undefined),
    ]);
    const connectedIds = new Set((serverInfo.connectedServers ?? []).map((server) => server.id));
    const poolEnabledById = new Map(
      mcpConfig.servers.map((server) => [server.serverId, server.enabled])
    );
    const serverTools = { ...(serverInfo.serverTools ?? {}) };

    const resolveToolsForServer = (serverId: string): ToolInfo[] => {
      if (serverTools[serverId]?.length) {
        return serverTools[serverId];
      }
      const cached = client.getCachedTools(serverId);
      if (cached.length > 0) {
        serverTools[serverId] = cached;
      }
      return serverTools[serverId] ?? [];
    };

    const toRow = (id: string, name: string, isConnected: boolean): McpServerRow => {
      resolveToolsForServer(id);
      const { enabled, total } = ToolPolicyService.countEnabledTools(id, serverTools, store);
      const poolEnabled = poolEnabledById.get(id) ?? false;
      return {
        id,
        name,
        isConnected,
        poolEnabled,
        toolsEnabled: enabled,
        toolsTotal: total,
      };
    };

    if (scope === 'configured') {
      const rows = await McpConfigService.listConfiguredMcpServers(configUserId ?? undefined);
      const servers = rows.map((row) =>
        toRow(row.serverId, row.name, connectedIds.has(row.serverId))
      );
      return ok({ success: true, servers });
    }

    if (scope === 'pool-enabled') {
      const servers = mcpConfig.servers
        .filter((server) => server.enabled)
        .map((server) => toRow(server.serverId, server.name, connectedIds.has(server.serverId)));
      return ok({ success: true, servers });
    }

    if (scope !== 'connected') {
      return fail(400, 'scope 须为 connected、configured 或 pool-enabled');
    }

    const connected = serverInfo.connectedServers ?? [];
    const servers = connected.map((server) => toRow(server.id, server.name, true));
    return ok({ success: true, servers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, message);
  }
}

export async function handleMcpProbeServers(
  configUserId: string | null,
  serverIdsRaw: unknown
): Promise<
  McpAgentHandlerResult<{
    success: true;
    reachableIds: string[];
    unreachable: Array<{ id: string; name: string }>;
    skippedNoTools: Array<{ id: string; name: string }>;
  }>
> {
  try {
    if (!Array.isArray(serverIdsRaw)) {
      return fail(400, 'serverIds 必须为数组');
    }
    const serverIds = serverIdsRaw.filter((id): id is string => typeof id === 'string');
    await ensureWorkerRuntimeForUser(configUserId);
    const poolEnabledIds = await McpConnectionService.filterPoolEnabledServerIds(
      serverIds,
      configUserId
    );
    const result = await McpConnectionService.probeForSelection(poolEnabledIds, configUserId);
    return ok({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, message);
  }
}
