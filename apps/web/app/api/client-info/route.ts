import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpGetClientInfo } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const result = await workerMcpGetClientInfo(principal.configUserId);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '获取MCP信息失败');
  }
}
