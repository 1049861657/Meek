import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleMcpOAuthAuthorize } from '@/lib/mcp/mcp-oauth-handlers';
import { Logger } from '@meek/agent-core';
import { resolveRequestPublicOrigin } from '@meek/shared';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ serverId: string }> }
): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    if (!principal.userId) {
      return Response.json(
        { ok: false, error: '需要登录', message: 'OAuth 授权需要登录用户' },
        { status: 401 }
      );
    }

    const { serverId } = await context.params;
    const trimmedId = serverId?.trim();
    if (!trimmedId) {
      return Response.json(
        { ok: false, error: '缺少服务器 ID', message: '必须指定 serverId' },
        { status: 400 }
      );
    }

    const result = await handleMcpOAuthAuthorize(
      principal.configUserId ?? principal.userId,
      trimmedId,
      resolveRequestPublicOrigin(req)
    );
    return Response.json({ authorizationUrl: result.authorizationUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('API', `OAuth authorize 失败: ${message}`);
    return Response.json(
      { ok: false, error: '获取 OAuth 授权 URL 失败', message },
      { status: 500 }
    );
  }
}
