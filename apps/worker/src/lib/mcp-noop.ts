import type { CallToolOptions, MCPServerInfo, McpClientPort } from '@meek/agent-core';

export function createNoopMcpClient(): McpClientPort {
const emptyInfo: MCPServerInfo = {
  server: { id: 'none', name: 'none', version: '0', status: 'disconnected' },
    tools: [],
    connectedServers: [],
    serverTools: {},
  };

  return {
    getServerIdForTool() {
      return null;
    },
    getServerName() {
      return undefined;
    },
    async callTool<T>(): Promise<T> {
      throw new Error('MCP 未配置（M2 前 noop）');
    },
    async getServerInfo() {
      return emptyInfo;
    },
    getInstructions() {
      return '';
    },
    async ensureServersReachable(): Promise<void> {
      return;
    },
  };
}
