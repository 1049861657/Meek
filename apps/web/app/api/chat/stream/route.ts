import { handleChatStream } from '@/lib/chat/stream';
import { resolvePrincipal } from '@/lib/chat/resolve-principal';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const principal = await resolvePrincipal();
    return await handleChatStream(body, principal);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] 处理流式聊天请求时出错:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
