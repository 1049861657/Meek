import type { CallToolOptions, MCPServerInfo, McpClientPort } from '@meek/agent-core';
import { setMcpClientResolver } from '@meek/agent-core';

import { workerMcpGetInfo } from '@/lib/worker/worker-client';

const EMPTY_SERVER_INFO: MCPServerInfo = {
  currentServerId: '',
  server: { id: '', name: '', version: '', status: 'disconnected' },
  tools: [],
  serverTools: {},
};

function mapWorkerInfo(data: unknown): MCPServerInfo {
  if (!data || typeof data !== 'object') {
    return EMPTY_SERVER_INFO;
  }
  const info = data as Partial<MCPServerInfo>;
  return {
    currentServerId: info.currentServerId ?? '',
    server: info.server ?? EMPTY_SERVER_INFO.server,
    tools: Array.isArray(info.tools) ? info.tools : [],
    serverTools:
      info.serverTools && typeof info.serverTools === 'object' ? info.serverTools : {},
    availableServers: info.availableServers,
    connectedServers: info.connectedServers,
  };
}

export function createWorkerBackedMcpPort(configUserId: string | null): McpClientPort {
  return {
    getServerIdForTool() {
      return undefined;
    },
    getServerName() {
      return undefined;
    },
    async callTool<T>(
      _codeName: string,
      _args: Record<string, unknown>,
      _options?: CallToolOptions,
    ): Promise<T> {
      throw new Error('Web 进程不支持 MCP 工具调用');
    },
    async getServerInfo(): Promise<MCPServerInfo> {
      const result = await workerMcpGetInfo(configUserId);
      if (!result.ok) {
        return EMPTY_SERVER_INFO;
      }
      return mapWorkerInfo(result.data);
    },
    getInstructions(_serverIds?: string[]): string {
      return '';
    },
    async ensureServersReachable(): Promise<void> {
      /* preview only */
    },
  };
}

/** Web 启动时注入：按 configUserId 委托 Worker 读取 MCP 元数据 */
export function installWebMcpClientResolver(): void {
  setMcpClientResolver((userId) => createWorkerBackedMcpPort(userId));
}
