import type {
  ToolResultSource,
  UnifiedToolResult,
  UnifiedToolResultStatus
} from './mcp-types.js';

type McpBlock = { type?: string; text?: string };

function mcpPreview(
  tool: string,
  raw: unknown
): { preview: string; structured?: unknown; isError: boolean } {
  if (typeof raw === 'string') {
    return { preview: raw, isError: false };
  }
  if (typeof raw !== 'object' || raw === null) {
    const kind = raw === null ? 'null' : typeof raw;
    throw new Error(`MCP 工具 ${tool} 返回非 CallToolResult（${kind}）`);
  }

  const record = raw as Record<string, unknown>;
  const isError = record.isError === true;
  const structured = 'structuredContent' in record ? record.structuredContent : undefined;
  let preview = '';

  if (Array.isArray(record.content)) {
    preview = (record.content as McpBlock[])
      .map((block) => {
        const type = typeof block.type === 'string' ? block.type : 'unknown';
        return type === 'text' && typeof block.text === 'string'
          ? block.text
          : `[${type} content omitted]`;
      })
      .join('\n');
  }
  if (!preview.trim() && structured !== undefined) {
    preview = JSON.stringify(structured, null, 2);
  }
  if (!preview.trim()) {
    if (isError) {
      return { preview: '[MCP tool error: no content]', structured, isError: true };
    }
    throw new Error(`MCP 工具 ${tool} 返回空结果`);
  }
  return { preview, structured, isError };
}

/** MCP / System 工具返回值 → UnifiedToolResult */
export function normalizeToolResult(input: {
  source: ToolResultSource;
  tool: string;
  raw: unknown;
  serverId?: string;
  serverName?: string;
}): UnifiedToolResult {
  if (input.source === 'system') {
    return {
      source: 'system',
      tool: input.tool,
      status: 'success',
      preview: typeof input.raw === 'string' ? input.raw : JSON.stringify(input.raw, null, 2)
    };
  }

  const { preview, structured, isError } = mcpPreview(input.tool, input.raw);
  const status: UnifiedToolResultStatus = isError ? 'error' : 'success';

  return {
    source: 'mcp',
    tool: input.tool,
    status,
    preview,
    ...(input.serverId !== undefined ? { serverId: input.serverId } : {}),
    ...(input.serverName !== undefined ? { serverName: input.serverName } : {}),
    ...(structured !== undefined ? { structured } : {}),
    ...(isError ? { isMcpError: true } : {})
  };
}

/** 工具结果规范化入口（任务书 ToolExecutor） */
export const ToolExecutor = {
  normalizeResult: normalizeToolResult,
} as const;
