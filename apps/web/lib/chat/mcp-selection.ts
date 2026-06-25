/**
 * Web 聊天 MCP 选择 + probe 封装 — 对齐 mcp-selection.js / chat-api.js
 */

import { fetchJson } from '@/lib/api/fetch-json';

export const MCP_CHECKBOX_PREFIX = 'mcp-server-';

export interface McpServerSummary {
  id: string;
  name?: string;
  toolsEnabled?: number;
}

export interface McpProbeResult {
  reachableIds?: string[];
  unreachable?: Array<{ id: string; name?: string }>;
  skippedNoTools?: Array<{ id: string; name?: string }>;
  error?: string;
}

export function isMcpServerEnabled(enabledIds: string[], serverId: string): boolean {
  return enabledIds.includes(serverId);
}

export function filterEnabledToKnownServers(
  enabledIds: string[],
  servers: McpServerSummary[]
): string[] {
  const known = new Set(servers.map((server) => server.id));
  return enabledIds.filter((id) => known.has(id));
}

/** 顶栏 MCP 数量：与用户勾选一致，不要求 toolsEnabled>0 */
export function countKnownEnabledMcpServers(
  enabledIds: string[],
  servers: McpServerSummary[]
): number {
  return filterEnabledToKnownServers(enabledIds, servers).length;
}

export function filterServersWithUsableTools(
  enabledIds: string[],
  servers: McpServerSummary[]
): string[] {
  const byId = new Map(servers.map((server) => [server.id, server]));
  return enabledIds.filter((id) => {
    const server = byId.get(id);
    if (!server) {
      return false;
    }
    const enabled = typeof server.toolsEnabled === 'number' ? server.toolsEnabled : 0;
    return enabled > 0;
  });
}

export function getSelectableMcpServerIds(
  enabledServerIds: string[],
  mcpServers: McpServerSummary[]
): string[] {
  return filterServersWithUsableTools(
    filterEnabledToKnownServers(enabledServerIds, mcpServers),
    mcpServers
  );
}

export function commitMcpSelection(
  enabledIds: string[],
  servers: McpServerSummary[]
): string[] {
  if (servers.length === 0) {
    throw new Error('MCP 服务器列表未就绪，无法保存选择');
  }
  return filterEnabledToKnownServers(enabledIds, servers);
}

export async function fetchMcpServers(): Promise<{ servers: McpServerSummary[] }> {
  try {
    const data = (await fetchJson('/api/mcp/servers?scope=pool-enabled')) as {
      servers?: McpServerSummary[];
      error?: string;
    };
    if (data.error) {
      console.error('获取MCP服务器列表失败:', data.error);
      return { servers: [] };
    }
    return { servers: data.servers ?? [] };
  } catch (error: unknown) {
    console.error('获取MCP服务器出错:', error);
    return { servers: [] };
  }
}

export async function probeMcpServers(serverIds: string[]): Promise<McpProbeResult> {
  const data = (await fetchJson('/api/mcp/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverIds }),
  })) as McpProbeResult;
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function fetchAvailableMcpTools(): Promise<unknown[]> {
  try {
    const data = (await fetchJson('/api/tools/list')) as { tools?: unknown[]; error?: string };
    if (data.error) {
      console.error('获取MCP工具列表失败:', data.error);
      return [];
    }
    return data.tools ?? [];
  } catch (error: unknown) {
    console.error('获取MCP工具出错:', error);
    return [];
  }
}

export function mcpCheckboxId(serverId: string): string {
  return `${MCP_CHECKBOX_PREFIX}${serverId}`;
}
