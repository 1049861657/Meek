import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleWorkerError, requireAuthUser, workerResultToResponse } from '@/lib/mcp/mcp-api-utils';
import {
  workerMcpGetToolPreferences,
  workerMcpSaveToolPreferences,
} from '@/lib/worker/worker-client';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ serverId: string }> }
): Promise<Response> {
  try {
    const { serverId } = await context.params;
    const trimmedId = serverId?.trim();
    if (!trimmedId) {
      return Response.json(
        { error: '缺少服务器 ID', details: '必须指定 serverId' },
        { status: 400 }
      );
    }

    const result = await workerMcpGetToolPreferences(trimmedId);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '获取工具偏好失败');
  }
}

export async function PUT(
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

    const body = (await req.json()) as { preferences?: Record<string, boolean> };
    const preferences = body?.preferences ?? {};
    const result = await workerMcpSaveToolPreferences(trimmedId, preferences);
    return workerResultToResponse(result);
  } catch (error: unknown) {
    return handleWorkerError(error, '保存工具偏好失败');
  }
}
