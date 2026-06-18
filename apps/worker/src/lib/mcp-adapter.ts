import type {
  CallToolOptions,
  MCPServerInfo as AgentMCPServerInfo,
  McpClientPort,
} from '@meek/agent-core';
import type {
  MCPClientManager,
  MCPServerInfo as RuntimeMCPServerInfo,
  McpEnsureOptions,
  ServerInfo as RuntimeServerInfo,
} from '@meek/mcp-runtime';

function mapServerInfo(server: RuntimeServerInfo): AgentMCPServerInfo['server'] {
  return {
    id: server.id,
    name: server.name,
    version: server.version,
    status: server.status,
  };
}

function mapRuntimeServerInfo(info: RuntimeMCPServerInfo): AgentMCPServerInfo {
  return {
    currentServerId: info.currentServerId,
    server: mapServerInfo(info.server),
    tools: info.tools,
    availableServers: info.availableServers?.map(mapServerInfo),
    connectedServers: info.connectedServers?.map(mapServerInfo),
    serverTools: info.serverTools,
  };
}

export function createMcpClientPort(manager: MCPClientManager): McpClientPort {
  return {
    getServerIdForTool(codeName: string) {
      return manager.getServerIdForTool(codeName);
    },
    getServerName(serverId: string) {
      return manager.getServerName(serverId);
    },
    async callTool<T>(
      codeName: string,
      args: Record<string, unknown>,
      options?: CallToolOptions
    ): Promise<T> {
      return manager.callTool<T>(codeName, args, options);
    },
    async getServerInfo(): Promise<AgentMCPServerInfo> {
      return mapRuntimeServerInfo(await manager.getServerInfo());
    },
    getInstructions(serverIds?: string[]) {
      return manager.getInstructions(serverIds);
    },
    async ensureServersReachable(
      serverIds: string[],
      options?: { mode: string }
    ): Promise<void> {
      const ensureOptions: McpEnsureOptions | undefined = options?.mode
        ? { mode: options.mode as McpEnsureOptions['mode'] }
        : undefined;
      await manager.ensureServersReachable(serverIds, ensureOptions);
    },
  };
}
