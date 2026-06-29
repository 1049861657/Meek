import { Logger } from '@meek/agent-core';

import { handleToolsList } from '@/lib/chat/tools-list';
import { resolvePrincipal } from '@/lib/chat/resolve-principal';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const principal = await resolvePrincipal();
    const result = await handleToolsList(principal);
    return Response.json(result.body, { status: result.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('API', `获取可用工具时出错: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
