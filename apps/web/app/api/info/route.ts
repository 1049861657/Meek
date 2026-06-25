import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpGetInfo } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const result = await workerMcpGetInfo(principal.configUserId);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '获取MCP信息失败');
  }
}
