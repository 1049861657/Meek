import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpPreviewPrompt } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  context: { params: Promise<{ serverId: string }> }
): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const { serverId } = await context.params;
    const trimmedId = serverId?.trim();
    if (!trimmedId) {
      return Response.json(
        { error: '缺少服务器 ID', details: '必须指定 serverId' },
        { status: 400 }
      );
    }

    const body = (await req.json()) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };

    const result = await workerMcpPreviewPrompt(principal.configUserId, trimmedId, {
      name: body.name ?? '',
      ...(body.arguments !== undefined ? { arguments: body.arguments } : {}),
    });
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '预览 MCP Prompt 失败');
  }
}
