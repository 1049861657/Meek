import { loadRootEnv } from '@meek/shared';

import {
  handlePermissionResolve,
  type PermissionResolveBody,
} from '@/lib/chat/permission-resolve';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  loadRootEnv();

  try {
    const body = (await req.json()) as PermissionResolveBody;
    const result = await handlePermissionResolve(body);
    return Response.json(result.body, { status: result.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] permission-resolve 失败:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
