import { getMcpClientForUser } from '@meek/agent-core';

import { ensureWebMcpStub } from '@/lib/mcp/mcp-stub';
import type { RequestPrincipal } from '@/lib/chat/resolve-principal';

export interface ToolsListSuccess {
  success: true;
  server: string;
  tools: unknown[];
}

export interface ToolsListFailure {
  error: string;
}

export type ToolsListResponse = ToolsListSuccess | ToolsListFailure;

export interface ToolsListHttpResult {
  status: number;
  body: ToolsListResponse;
}

export async function handleToolsList(
  principal: RequestPrincipal
): Promise<ToolsListHttpResult> {
  try {
    ensureWebMcpStub();
    const serverInfo = await getMcpClientForUser(principal.configUserId).getServerInfo();
    return {
      status: 200,
      body: {
        success: true,
        server: serverInfo.server.name,
        tools: serverInfo.tools,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] 获取可用工具时出错:', message);
    return { status: 500, body: { error: message } };
  }
}
