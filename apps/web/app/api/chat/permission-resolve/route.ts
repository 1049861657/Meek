import { Logger } from '@meek/agent-core';

import {
  handlePermissionResolve,
  type PermissionResolveBody,
} from '@/lib/chat/permission-resolve';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as PermissionResolveBody;
    const result = await handlePermissionResolve(body);
    return Response.json(result.body, { status: result.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('API', `permission-resolve 失败: ${message}`);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
