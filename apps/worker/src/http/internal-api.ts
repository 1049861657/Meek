import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleMcpOAuthAuthorize, handleMcpOAuthFinish } from '../lib/mcp-oauth-handlers.js';

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

function parseConfigUserId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('configUserId 必须是 string 或 null');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
      const serverId = typeof body.serverId === 'string' ? body.serverId.trim() : '';
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

    sendJson(res, 404, { ok: false, error: '未找到内部 API 路由' });
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[WORKER] Internal API 失败:', message);
    sendJson(res, 500, { ok: false, error: message });
    return true;
  }
}
