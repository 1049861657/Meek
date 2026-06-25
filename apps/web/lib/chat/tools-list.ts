import type { RequestPrincipal } from '@/lib/chat/resolve-principal';
import { workerMcpGetInfo } from '@/lib/worker/worker-client';

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

interface McpInfoPayload {
  server?: { name?: string };
  tools?: unknown[];
}

export async function handleToolsList(
  principal: RequestPrincipal
): Promise<ToolsListHttpResult> {
  try {
    const result = await workerMcpGetInfo(principal.configUserId);
    if (!result.ok) {
      return {
        status: result.status,
        body: { error: result.error },
      };
    }

    const info = result.data as McpInfoPayload;
    return {
      status: 200,
      body: {
        success: true,
        server: info.server?.name ?? '',
        tools: info.tools ?? [],
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 500,
      body: { error: message },
    };
  }
}
