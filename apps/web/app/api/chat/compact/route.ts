import { Logger } from '@meek/agent-core';

import { handleCompactChat, type CompactChatBody } from '@/lib/chat/compact';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as CompactChatBody;
    const result = await handleCompactChat(body, null);
    return Response.json(result.body, { status: result.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('API', `压缩会话失败: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
