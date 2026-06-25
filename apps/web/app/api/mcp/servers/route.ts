import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpListServers } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') ?? undefined;
    const result = await workerMcpListServers(principal.configUserId, scope);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '获取MCP服务器列表时出错');
  }
}
