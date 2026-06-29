/** MCP OAuth 浏览器回调路径（挂在 Web 上） */
export const MCP_OAUTH_CALLBACK_PATH = '/api/mcp/oauth/callback';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

/** Next.js Web 端口（`PORT` 环境变量，否则 3000） */
export function resolveDefaultWebPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) {
    return DEFAULT_PORT;
  }
  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return DEFAULT_PORT;
  }
  return port;
}

/** 无 HTTP 请求上下文时的 Web 公网 origin（Worker 回退、better-auth fallback） */
export function resolveDefaultWebOrigin(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }
  return `http://${DEFAULT_HOST}:${resolveDefaultWebPort()}`;
}

/** 从入站 HTTP 请求解析对外 origin（反代 / 任意 dev 端口） */
export function resolveRequestPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim();
    if (host) {
      const proto = forwardedProto?.split(',')[0]?.trim() || 'https';
      return `${proto}://${host}`;
    }
  }

  const hostHeader = request.headers.get('host');
  if (hostHeader) {
    try {
      const url = new URL(request.url);
      return `${url.protocol}//${hostHeader}`;
    } catch {
      return `http://${hostHeader}`;
    }
  }

  return new URL(request.url).origin;
}

/** MCP OAuth redirect_uri（优先用请求 origin，否则进程默认） */
export function resolveMcpOAuthRedirectUrl(origin?: string): string {
  const base = (origin ?? resolveDefaultWebOrigin()).replace(/\/$/, '');
  return `${base}${MCP_OAUTH_CALLBACK_PATH}`;
}
