import { normalizeToolResult, setToolPreferencesStore } from '@meek/agent-core';
import { ConnectionType } from '@meek/db';
import {
  clearMcpServerAuth,
  getMcpClientForUser,
  McpConfigService,
  McpConfigStore,
  McpConnectionStatus,
  McpInfoAssembler,
  reloadMCPConfig,
  ToolPreferencesService,
  type CallServerToolBody,
  type CallServerToolResponse,
  type MCPServer,
  type MCPServerInfo,
  type McpPromptPreviewBody,
} from '@meek/mcp-runtime';

import { ensureWorkerRuntimeForUser } from './runtime-bootstrap.js';

export type McpInfoHandlerSuccess<T> = { ok: true; status: number; data: T };
export type McpInfoHandlerFailure = {
  ok: false;
  status: number;
  error: string;
  details?: string;
};
export type McpInfoHandlerResult<T> = McpInfoHandlerSuccess<T> | McpInfoHandlerFailure;

function getErrorMessage(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;

  while (current instanceof Error) {
    const message = current.message.trim();
    if (message !== '' && !messages.includes(message)) {
      messages.push(message);
    }
    current = current.cause;
    if (messages.length >= 3) {
      break;
    }
  }

  if (messages.length > 0) {
    return messages.join(' → ');
  }

  return error instanceof Error ? error.message : String(error);
}

function fail(status: number, error: string, details?: string): McpInfoHandlerFailure {
  return { ok: false, status, error, ...(details ? { details } : {}) };
}

function ok<T>(data: T, status = 200): McpInfoHandlerSuccess<T> {
  return { ok: true, status, data };
}

async function prepareClient(configUserId: string | null) {
  await ensureWorkerRuntimeForUser(configUserId);
  return getMcpClientForUser(configUserId);
}

export async function handleMcpGetInfo(
  configUserId: string | null
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    await ensureWorkerRuntimeForUser(configUserId);
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '获取MCP信息失败', getErrorMessage(error));
  }
}

export async function handleMcpGetClientInfo(
  configUserId: string | null
): Promise<McpInfoHandlerResult<{ name: string; version: string }>> {
  try {
    const client = await prepareClient(configUserId);
    const info = await client.getClientInfo();
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '获取MCP信息失败', getErrorMessage(error));
  }
}

export async function handleMcpConnectServer(
  configUserId: string,
  serverId: string
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    const client = await prepareClient(configUserId);
    const success = await client.connect(serverId);
    if (success) {
      await McpConfigStore.setServerEnabled(configUserId, serverId, true);
      client.syncServerEnabled(serverId, true);
      client.switchCurrentServer(serverId);
    }
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    const server = info.availableServers?.find((item) => item.id === serverId) ?? info.server;

    if (success) {
      return ok(info);
    }
    if (server.status === McpConnectionStatus.NeedsAuth) {
      return ok(info);
    }
    return fail(400, '连接服务器失败', '连接未成功建立，请检查命令、URL 或网络后重试');
  } catch (error: unknown) {
    return fail(500, '连接服务器失败', getErrorMessage(error));
  }
}

export async function handleMcpDisconnectServer(
  configUserId: string,
  serverId: string
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    const client = await prepareClient(configUserId);
    await client.disconnect(serverId, { clearAuth: true });
    await McpConfigStore.setServerEnabled(configUserId, serverId, false);
    client.syncServerEnabled(serverId, false);
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '断开服务器连接失败', getErrorMessage(error));
  }
}

export async function handleMcpSwitchServer(
  configUserId: string,
  serverId: string
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    const client = await prepareClient(configUserId);
    client.switchCurrentServer(serverId);
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '查看服务器失败', getErrorMessage(error));
  }
}

export async function handleMcpReloadConfig(
  configUserId: string
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    await ensureWorkerRuntimeForUser(configUserId);
    const success = await reloadMCPConfig(configUserId, 'all');
    if (!success) {
      return fail(500, '重新加载MCP配置失败', '无法完成配置重新加载');
    }
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '重新加载MCP配置失败', getErrorMessage(error));
  }
}

function validateNewServer(serverData: MCPServer): McpInfoHandlerFailure | null {
  if (!serverData.name || !serverData.connectionType) {
    return fail(400, '服务器数据无效', '必须提供name和connectionType字段');
  }
  if (serverData.connectionType === ConnectionType.STDIO) {
    if (!serverData.command || !serverData.args || !Array.isArray(serverData.args)) {
      return fail(400, '服务器数据无效', 'stdio连接类型必须提供command和args数组');
    }
  } else if (serverData.connectionType === ConnectionType.HTTP) {
    if (!serverData.mcpUrl) {
      return fail(400, '服务器数据无效', 'HTTP 连接类型必须提供 mcpUrl（MCP 端点）');
    }
  } else {
    return fail(400, '服务器数据无效', 'connectionType 必须是 STDIO 或 HTTP');
  }
  return null;
}

export async function handleMcpAddServer(
  configUserId: string,
  serverData: MCPServer
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    const validation = validateNewServer(serverData);
    if (validation) {
      return validation;
    }

    const config = await McpConfigService.getMCPConfig(configUserId);
    if (config.servers.some((server) => server.serverId === serverData.serverId)) {
      return fail(400, '服务器ID已存在', `ID为${serverData.serverId}的服务器已存在`);
    }

    config.servers.push(serverData);
    const newServerId = serverData.serverId;
    await McpConfigService.saveMCPConfig(config, configUserId);
    await reloadMCPConfig(configUserId, { serverId: newServerId });
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '添加服务器失败', getErrorMessage(error));
  }
}

export async function handleMcpUpdateServer(
  configUserId: string,
  serverId: string,
  serverData: Partial<MCPServer>
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    if ('enabled' in serverData) {
      return fail(400, '更新服务器失败', 'enabled 请通过 connect/disconnect 切换');
    }

    const config = await McpConfigService.getMCPConfig(configUserId);
    const serverIndex = config.servers.findIndex((server) => server.serverId === serverId);
    if (serverIndex === -1) {
      return fail(404, '服务器不存在', `ID为${serverId}的服务器不存在`);
    }

    const existing = config.servers[serverIndex];
    const updatedServer = {
      ...existing,
      ...serverData,
      serverId,
    } as MCPServer;
    if (serverData.connectionType === ConnectionType.HTTP && 'headers' in serverData) {
      updatedServer.headers =
        serverData.headers && Object.keys(serverData.headers).length > 0
          ? serverData.headers
          : undefined;
    }

    config.servers[serverIndex] = updatedServer;
    await McpConfigService.saveMCPConfig(config, configUserId);
    await reloadMCPConfig(configUserId, { serverId });
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '更新服务器失败', getErrorMessage(error));
  }
}

export async function handleMcpDeleteServer(
  configUserId: string,
  serverId: string
): Promise<McpInfoHandlerResult<MCPServerInfo>> {
  try {
    const client = await prepareClient(configUserId);
    const config = await McpConfigService.getMCPConfig(configUserId);
    const serverIndex = config.servers.findIndex((server) => server.serverId === serverId);
    if (serverIndex === -1) {
      return fail(404, '服务器不存在', `ID为${serverId}的服务器不存在`);
    }

    const serverInfo = await client.getServerInfo();
    const isConnected = serverInfo.connectedServers?.some(
      (server) => server.id === serverId && server.status === McpConnectionStatus.Connected
    );
    if (isConnected) {
      await client.disconnect(serverId, { clearAuth: true });
    }

    config.servers.splice(serverIndex, 1);
    await clearMcpServerAuth(serverId, configUserId);
    await McpConfigService.saveMCPConfig(config, configUserId);
    await reloadMCPConfig(configUserId, { serverId });
    const info = await McpInfoAssembler.assembleForInfoPage(configUserId);
    return ok(info);
  } catch (error: unknown) {
    return fail(500, '删除服务器失败', getErrorMessage(error));
  }
}

export async function handleMcpGetToolPreferences(
  serverId: string
): Promise<McpInfoHandlerResult<{ preferences: Record<string, boolean> }>> {
  try {
    const preferences = await ToolPreferencesService.getForServer(serverId);
    return ok({ preferences });
  } catch (error: unknown) {
    return fail(500, '获取工具偏好失败', getErrorMessage(error));
  }
}

export async function handleMcpSaveToolPreferences(
  serverId: string,
  preferences: Record<string, unknown>
): Promise<McpInfoHandlerResult<{ ok: true; preferences: Record<string, boolean> }>> {
  try {
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return fail(400, '请求无效', 'preferences 必须为对象');
    }
    const normalized: Record<string, boolean> = {};
    for (const [name, value] of Object.entries(preferences)) {
      if (typeof value === 'boolean') {
        normalized[name] = value;
      }
    }
    await ToolPreferencesService.saveForServer(serverId, normalized);
    const all = await ToolPreferencesService.getAll();
    setToolPreferencesStore(all);
    return ok({ ok: true, preferences: normalized });
  } catch (error: unknown) {
    return fail(500, '保存工具偏好失败', getErrorMessage(error));
  }
}

export async function handleMcpCallServerTool(
  configUserId: string,
  serverId: string,
  body: CallServerToolBody,
  signal?: AbortSignal
): Promise<McpInfoHandlerResult<CallServerToolResponse>> {
  const started = Date.now();
  try {
    if (!body?.toolName || typeof body.toolName !== 'string') {
      return fail(400, '请求无效', 'toolName 为必填项');
    }

    const args =
      body.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments)
        ? body.arguments
        : {};

    const toolName = body.toolName.trim();
    const client = await prepareClient(configUserId);
    const result = await client.callToolOnServer(serverId, toolName, args, {
      signal,
      timeout: 300_000,
    });

    const unified = normalizeToolResult({
      source: 'mcp',
      tool: toolName,
      serverId,
      serverName: client.getServerName(serverId),
      raw: result,
    });

    return ok({
      ok: unified.status === 'success',
      ms: Date.now() - started,
      output: unified.preview,
      unified,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || /aborted/i.test(error.message))
    ) {
      return {
        ok: true,
        status: 499,
        data: {
          ok: false,
          ms: Date.now() - started,
          output: '已取消',
          error: '已取消',
        },
      };
    }
    const message = getErrorMessage(error);
    return {
      ok: true,
      status: 500,
      data: {
        ok: false,
        ms: Date.now() - started,
        output: message,
        error: message,
      },
    };
  }
}

export async function handleMcpPreviewResource(
  configUserId: string | null,
  serverId: string,
  uri: string
): Promise<McpInfoHandlerResult<CallServerToolResponse>> {
  const started = Date.now();
  try {
    if (!uri) {
      return fail(400, '缺少资源 URI', 'query.uri 为必填项');
    }
    const client = await prepareClient(configUserId);
    const result = await client.readResourceOnServer(serverId, uri);
    return ok({
      ok: true,
      ms: Date.now() - started,
      output: JSON.stringify(result, null, 2),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return {
      ok: true,
      status: 500,
      data: {
        ok: false,
        ms: Date.now() - started,
        output: message,
        error: message,
      },
    };
  }
}

export async function handleMcpPreviewPrompt(
  configUserId: string | null,
  serverId: string,
  body: McpPromptPreviewBody
): Promise<McpInfoHandlerResult<CallServerToolResponse>> {
  const started = Date.now();
  try {
    if (!body?.name || typeof body.name !== 'string') {
      return fail(400, '请求无效', 'name 为必填项');
    }

    let args: Record<string, string> | undefined;
    if (body.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments)) {
      args = {};
      for (const [key, value] of Object.entries(body.arguments)) {
        if (typeof value === 'string') {
          args[key] = value;
        } else if (value !== undefined && value !== null) {
          args[key] = String(value);
        }
      }
    }

    const client = await prepareClient(configUserId);
    const result = await client.getPromptOnServer(serverId, body.name.trim(), args);
    return ok({
      ok: true,
      ms: Date.now() - started,
      output: JSON.stringify(result, null, 2),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return {
      ok: true,
      status: 500,
      data: {
        ok: false,
        ms: Date.now() - started,
        output: message,
        error: message,
      },
    };
  }
}

export function parseServerId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseConfigUserId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('configUserId 必须是 string 或 null');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requireConfigUserId(value: unknown): string {
  const configUserId = parseConfigUserId(value);
  if (!configUserId) {
    throw new Error('MCP 写操作需要登录用户');
  }
  return configUserId;
}
