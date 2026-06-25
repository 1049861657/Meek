import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpDeleteServer } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
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
        { error: '删除服务器失败', details: '服务器ID不能为空' },
        { status: 400 }
      );
    }

    const result = await workerMcpDeleteServer(auth, trimmedId);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '删除服务器失败');
  }
}
