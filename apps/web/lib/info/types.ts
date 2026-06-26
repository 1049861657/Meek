import type {
  McpPromptInfo,
  McpResourceInfo,
  MCPServerInfo,
  ServerInfo,
  ToolInfo,
} from '@meek/mcp-runtime';

export type { McpPromptInfo, McpResourceInfo, ServerInfo, ToolInfo };

export type InfoData = MCPServerInfo;

export type InfoView = 'empty' | 'detail' | 'form';

export type InfoTab = 'general' | 'tools' | 'prompts' | 'resources';

export type ConnectionPending = {
  serverId: string;
  action: 'connect' | 'disconnect';
};

export type ServerFormMode = 'add' | 'edit';

export type ConnectionType = 'STDIO' | 'HTTP';

export interface ServerFormState {
  mode: ServerFormMode;
  serverId: string;
  name: string;
  connectionType: ConnectionType;
  command: string;
  args: string;
  mcpUrl: string;
  headers: Array<{ key: string; value: string }>;
}

export interface ToolTestTarget {
  serverId: string;
  tool: ToolInfo;
}
