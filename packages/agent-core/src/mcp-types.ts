/** 调用工具时可传入的运行时选项 */
export interface CallToolOptions {
  timeout?: number;
  supportsProgress?: boolean;
  onProgress?: (
    progress: number,
    total: number | undefined,
    message: string | undefined,
    elapsed_ms?: number
  ) => void;
  signal?: AbortSignal;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
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
  version: string;
  status: string;
}

export interface MCPServerInfo {
  currentServerId?: string;
  server: ServerInfo;
  tools: ToolInfo[];
  availableServers?: ServerInfo[];
  connectedServers?: ServerInfo[];
  serverTools?: Record<string, ToolInfo[]>;
  toolPreferences?: Record<string, Record<string, boolean>>;
}

export type ToolResultSource = 'mcp' | 'system';
export type UnifiedToolResultStatus = 'success' | 'error';

export interface UnifiedToolResult {
  source: ToolResultSource;
  serverId?: string;
  serverName?: string;
  tool: string;
  status: UnifiedToolResultStatus;
  preview: string;
  structured?: unknown;
  rawPath?: string;
  isMcpError?: boolean;
}

export type McpToolPreferencesStore = Record<string, Record<string, boolean>>;
