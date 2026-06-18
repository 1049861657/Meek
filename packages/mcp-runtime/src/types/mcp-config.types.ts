import type { ConnectionType } from '@meek/db';

export interface MCPServer {
  serverId: string;
  name: string;
  enabled: boolean;
  connectionType: ConnectionType;
  command?: string;
  args?: string[];
  mcpUrl?: string;
  headers?: Record<string, string>;
}

export interface MCPConfigType {
  servers: MCPServer[];
  toolPrompt: string;
  enabledToolServerIds?: string[];
}
