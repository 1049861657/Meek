import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import { workerMcpPreviewResource } from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function GET(
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

    const url = new URL(req.url);
    const uri = url.searchParams.get('uri')?.trim() ?? '';
    if (!uri) {
      return Response.json(
        { error: '缺少资源 URI', details: 'query.uri 为必填项' },
        { status: 400 }
      );
    }

    const result = await workerMcpPreviewResource(principal.configUserId, trimmedId, uri);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '预览 MCP Resource 失败');
  }
}
