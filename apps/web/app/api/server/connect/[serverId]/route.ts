import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpConnectServer } from '@/lib/worker/worker-client';

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
      return Response.json({ error: '缺少服务器ID参数' }, { status: 400 });
    }

    const result = await workerMcpConnectServer(auth, trimmedId);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '连接服务器失败');
  }
}
