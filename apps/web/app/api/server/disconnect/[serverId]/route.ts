import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpDisconnectServer } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function POST(
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
        { error: '断开服务器连接失败', details: '必须指定服务器ID' },
        { status: 400 }
      );
    }

    const result = await workerMcpDisconnectServer(auth, trimmedId);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '断开服务器连接失败');
  }
}
