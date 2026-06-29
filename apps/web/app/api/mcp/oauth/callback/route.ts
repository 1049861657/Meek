import { handleMcpOAuthCallback } from '@/lib/mcp/mcp-oauth-handlers';

export const runtime = 'nodejs';

function redirectToMcp(params: Record<string, string>): Response {
  const query = new URLSearchParams(params).toString();
  const location = query.length > 0 ? `/mcp?${query}` : '/mcp';
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code')?.trim() ?? '';
  const state = url.searchParams.get('state')?.trim() ?? '';

  if (!code || !state) {
    return Response.json(
      { ok: false, error: 'OAuth 回调无效', message: '缺少 code 或 state' },
      { status: 400 }
    );
  }

  try {
    const result = await handleMcpOAuthCallback(code, state);
    return redirectToMcp({
      serverId: result.serverId,
      oauth: 'ok',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] OAuth callback 失败:', message);
    return redirectToMcp({
      oauth: 'error',
      message,
    });
  }
}
