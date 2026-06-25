import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpCallServerTool } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function POST(
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
        { error: '缺少服务器 ID', details: '必须指定 serverId' },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      toolName?: string;
      arguments?: Record<string, unknown>;
    };

    const result = await workerMcpCallServerTool(
      auth,
      trimmedId,
      {
        toolName: body.toolName ?? '',
        ...(body.arguments !== undefined ? { arguments: body.arguments } : {}),
      },
      req.signal
    );
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '调用 MCP 工具失败');
  }
}
