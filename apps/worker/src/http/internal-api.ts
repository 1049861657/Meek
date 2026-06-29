import type { IncomingMessage, ServerResponse } from 'node:http';

import type { MCPServer } from '@meek/mcp-runtime';
import { Logger } from '@meek/shared/logger';

import { handleMcpOAuthAuthorize, handleMcpOAuthFinish } from '../lib/mcp-oauth-handlers.js';
import {
  handleMcpListServers,
  handleMcpPartitionForPersistence,
  handleMcpProbeServers,
  type McpAgentHandlerResult,
} from '../lib/mcp-agent-handlers.js';
import {
  handleMcpAddServer,
  handleMcpCallServerTool,
  handleMcpConnectServer,
  handleMcpDeleteServer,
  handleMcpDisconnectServer,
  handleMcpGetClientInfo,
  handleMcpGetInfo,
  handleMcpGetToolPreferences,
  handleMcpPreviewPrompt,
  handleMcpPreviewResource,
  handleMcpReloadConfig,
  handleMcpSaveToolPreferences,
  handleMcpSwitchServer,
  handleMcpUpdateServer,
  parseConfigUserId,
  parseServerId,
  requireConfigUserId,
  type McpInfoHandlerResult,
} from '../lib/mcp-info-handlers.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('请求体必须是 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}

function forwardAgentHandlerResult<T>(
  res: ServerResponse,
  result: McpAgentHandlerResult<T>
): void {
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error, details: result.details });
    return;
  }
  sendJson(res, result.status, result.data);
}

function forwardHandlerResult<T>(
  res: ServerResponse,
  result: McpInfoHandlerResult<T>
): void {
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error, details: result.details });
    return;
  }
  sendJson(res, result.status, result.data);
}

export async function handleInternalApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (!pathname.startsWith('/internal/')) {
    return false;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: '仅支持 POST' });
    return true;
  }

  try {
    const body = await readJsonBody(req);

    if (pathname === '/internal/mcp/oauth/authorize') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { ok: false, error: '缺少 serverId' });
        return true;
      }
      const configUserId = parseConfigUserId(body.configUserId);
      const webOrigin =
        typeof body.webOrigin === 'string' && body.webOrigin.trim().length > 0
          ? body.webOrigin.trim()
          : undefined;
      const result = await handleMcpOAuthAuthorize(configUserId, serverId, webOrigin);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (pathname === '/internal/mcp/oauth/finish') {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const state = typeof body.state === 'string' ? body.state.trim() : '';
      if (!code || !state) {
        sendJson(res, 400, { ok: false, error: '缺少 code 或 state' });
        return true;
      }
      const result = await handleMcpOAuthFinish(code, state);
      sendJson(res, 200, { ok: true, ...result });
      return true;
    }

    if (pathname === '/internal/mcp/info') {
      forwardHandlerResult(res, await handleMcpGetInfo(parseConfigUserId(body.configUserId)));
      return true;
    }

    if (pathname === '/internal/mcp/client-info') {
      forwardHandlerResult(
        res,
        await handleMcpGetClientInfo(parseConfigUserId(body.configUserId))
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/connect') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '缺少服务器ID参数' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpConnectServer(requireConfigUserId(body.configUserId), serverId)
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/disconnect') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '断开服务器连接失败', details: '必须指定服务器ID' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpDisconnectServer(requireConfigUserId(body.configUserId), serverId)
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/switch') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '查看服务器失败', details: '服务器ID不能为空' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpSwitchServer(requireConfigUserId(body.configUserId), serverId)
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/reload-config') {
      forwardHandlerResult(
        res,
        await handleMcpReloadConfig(requireConfigUserId(body.configUserId))
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/add') {
      forwardHandlerResult(
        res,
        await handleMcpAddServer(
          requireConfigUserId(body.configUserId),
          body as unknown as MCPServer
        )
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/update') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '更新服务器失败', details: '服务器ID不能为空' });
        return true;
      }
      const { serverId: _ignored, configUserId: _user, ...serverData } = body;
      forwardHandlerResult(
        res,
        await handleMcpUpdateServer(
          requireConfigUserId(body.configUserId),
          serverId,
          serverData as Partial<MCPServer>
        )
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/delete') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '删除服务器失败', details: '服务器ID不能为空' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpDeleteServer(requireConfigUserId(body.configUserId), serverId)
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/tool-preferences/get') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '缺少服务器 ID', details: '必须指定 serverId' });
        return true;
      }
      forwardHandlerResult(res, await handleMcpGetToolPreferences(serverId));
      return true;
    }

    if (pathname === '/internal/mcp/server/tool-preferences/save') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '缺少服务器 ID', details: '必须指定 serverId' });
        return true;
      }
      const preferences = body.preferences;
      forwardHandlerResult(
        res,
        await handleMcpSaveToolPreferences(
          serverId,
          preferences && typeof preferences === 'object' && !Array.isArray(preferences)
            ? (preferences as Record<string, unknown>)
            : {}
        )
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/tools/call') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '缺少服务器 ID', details: '必须指定 serverId' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpCallServerTool(
          requireConfigUserId(body.configUserId),
          serverId,
          {
            toolName: typeof body.toolName === 'string' ? body.toolName : '',
            ...(body.arguments !== undefined
              ? { arguments: body.arguments as Record<string, unknown> }
              : {}),
          }
        )
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/resources/preview') {
      const serverId = parseServerId(body.serverId);
      const uri = typeof body.uri === 'string' ? body.uri.trim() : '';
      if (!serverId) {
        sendJson(res, 400, { error: '缺少服务器 ID', details: '必须指定 serverId' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpPreviewResource(parseConfigUserId(body.configUserId), serverId, uri)
      );
      return true;
    }

    if (pathname === '/internal/mcp/server/prompts/preview') {
      const serverId = parseServerId(body.serverId);
      if (!serverId) {
        sendJson(res, 400, { error: '缺少服务器 ID', details: '必须指定 serverId' });
        return true;
      }
      forwardHandlerResult(
        res,
        await handleMcpPreviewPrompt(parseConfigUserId(body.configUserId), serverId, {
          name: typeof body.name === 'string' ? body.name : '',
          ...(body.arguments !== undefined
            ? { arguments: body.arguments as Record<string, unknown> }
            : {}),
        })
      );
      return true;
    }

    if (pathname === '/internal/mcp/servers') {
      const scope = typeof body.scope === 'string' ? body.scope : undefined;
      forwardAgentHandlerResult(
        res,
        await handleMcpListServers(parseConfigUserId(body.configUserId), scope)
      );
      return true;
    }

    if (pathname === '/internal/mcp/probe') {
      forwardAgentHandlerResult(
        res,
        await handleMcpProbeServers(parseConfigUserId(body.configUserId), body.serverIds)
      );
      return true;
    }

    if (pathname === '/internal/mcp/reachability/partition') {
      const enableTools = body.enableTools === true;
      forwardAgentHandlerResult(
        res,
        await handleMcpPartitionForPersistence(
          parseConfigUserId(body.configUserId),
          body.serverIds,
          enableTools
        )
      );
      return true;
    }

    sendJson(res, 404, { ok: false, error: '未找到内部 API 路由' });
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('WORKER', `Internal API 失败: ${message}`);
    sendJson(res, 500, { ok: false, error: message });
    return true;
  }
}
