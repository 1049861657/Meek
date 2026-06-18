import type { CallToolOptions, MCPServerInfo } from '../mcp-types.js';

/** MCP 客户端端口（M4 前由 apps/worker 注入实现） */
export interface McpClientPort {
  getServerIdForTool(codeName: string): string | null | undefined;
  getServerName(serverId: string): string | undefined;
  callTool<T>(
    codeName: string,
    args: Record<string, unknown>,
    options?: CallToolOptions
  ): Promise<T>;
  getServerInfo(): Promise<MCPServerInfo>;
  getInstructions(serverIds?: string[]): string;
  ensureServersReachable(
    serverIds: string[],
    options?: { mode: string }
  ): Promise<void>;
}

export interface McpConnectionServicePort {
  ensureForChat(
    serverIds: string[],
    configUserId: string | null,
    chatRequestId: string
  ): Promise<{ reachableIds: string[] }>;
}

type McpClientResolver = (userId: string | null) => McpClientPort;

let mcpClientResolver: McpClientResolver = () => {
  throw new Error('McpClientPort 未注入：调用 setMcpClientResolver');
};

let mcpConnectionService: McpConnectionServicePort = {
  async ensureForChat(serverIds) {
    return { reachableIds: serverIds };
  },
};

export function setMcpClientResolver(resolver: McpClientResolver): void {
  mcpClientResolver = resolver;
}

export function getMcpClientForUser(userId: string | null): McpClientPort {
  return mcpClientResolver(userId);
}

export function setMcpConnectionService(service: McpConnectionServicePort): void {
  mcpConnectionService = service;
}

export function getMcpConnectionService(): McpConnectionServicePort {
  return mcpConnectionService;
}
