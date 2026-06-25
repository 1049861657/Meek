import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpProbeServers } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const body = (await req.json()) as { serverIds?: unknown };
    const serverIds = Array.isArray(body.serverIds)
      ? body.serverIds.filter((id): id is string => typeof id === 'string')
      : [];
    const result = await workerMcpProbeServers(principal.configUserId, serverIds);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, 'MCP 连通性嗅探失败');
  }
}
