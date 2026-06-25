import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpReloadConfig } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const auth = requireAuthUser(principal);
    if (auth instanceof Response) {
      return auth;
    }

    const result = await workerMcpReloadConfig(auth);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '重新加载MCP配置失败');
  }
}
