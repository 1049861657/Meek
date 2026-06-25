import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpUpdateServer } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function PUT(
  req: Request,
  context: { params: Promise<{ serverId: string }> }
): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const auth = requireAuthUser(principal);
    if (auth instanceof Response) {
      return auth;
    }

    const { serverId } = await context.params;
    const trimmedId = serverId?.trim();
    if (!trimmedId) {
      return Response.json(
        { error: '更新服务器失败', details: '服务器ID不能为空' },
        { status: 400 }
      );
    }

    const serverData = (await req.json()) as Record<string, unknown>;
    const result = await workerMcpUpdateServer(auth, trimmedId, serverData);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '更新服务器失败');
  }
}
