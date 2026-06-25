import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpAddServer } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const auth = requireAuthUser(principal);
    if (auth instanceof Response) {
      return auth;
    }

    const serverData = (await req.json()) as Record<string, unknown>;
    const result = await workerMcpAddServer(auth, serverData);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '添加服务器失败');
  }
}
