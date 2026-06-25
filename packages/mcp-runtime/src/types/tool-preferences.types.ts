import type { UnifiedToolResult } from '@meek/agent-core';

/** serverId → 工具原名 → 是否启用（缺省视为启用） */
export type McpToolPreferencesStore = Record<string, Record<string, boolean>>;

export interface ServerToolPreferencesBody {
  preferences: Record<string, boolean>;
}

export interface CallServerToolBody {
  toolName: string;
  arguments?: Record<string, unknown>;
}

export interface CallServerToolResponse {
  ok: boolean;
  ms: number;
  output: string;
  error?: string;
  unified?: UnifiedToolResult;
}

export interface McpPromptPreviewBody {
  name: string;
  arguments?: Record<string, unknown>;
}
