import type { CallToolOptions } from '@meek/agent-core';
import type { ConnectionType } from '@meek/db';

import type { McpConnectionStatus } from './mcp-connection.types.js';

export type { CallToolOptions };

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface McpResourceInfo {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  serverId: string;
  serverName: string;
}

export interface McpPromptArgumentInfo {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPromptInfo {
  name: string;
  description?: string;
  arguments?: McpPromptArgumentInfo[];
  serverId: string;
  serverName: string;
}

export interface ToolInfo {
  name: string;
  codeName: string;
  description: string;
  parameters: ToolParameter[];
  serverId: string;
  serverName: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  internalName?: string;
  version: string;
  status: McpConnectionStatus;
  authorizationUrl?: string;
  usesOAuth?: boolean;
  connectionDetails: {
    connectionType: ConnectionType;
    command?: string;
    args?: string;
    mcpUrl?: string;
    headers?: Record<string, string>;
    displayCommand?: string;
  };
}

export interface ClientInfo {
  name: string;
  version: string;
}

export interface MCPServerInfo {
  server: ServerInfo;
  currentServerId?: string;
  tools: ToolInfo[];
  availableServers?: ServerInfo[];
  connectedServers?: ServerInfo[];
  serverTools?: Record<string, ToolInfo[]>;
  serverResources?: Record<string, McpResourceInfo[]>;
  serverPrompts?: Record<string, McpPromptInfo[]>;
}
