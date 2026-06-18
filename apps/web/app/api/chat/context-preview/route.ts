import { handleContextPreview, type ContextPreviewBody } from '@/lib/chat/context-preview';
import { resolvePrincipal } from '@/lib/chat/resolve-principal';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as ContextPreviewBody;
    const principal = await resolvePrincipal();
    const result = await handleContextPreview(body, principal);
    return Response.json(result.body, { status: result.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] 上下文预览失败:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
