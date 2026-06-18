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
  _principal: RequestPrincipal
): Promise<ToolsListHttpResult> {
  return {
    status: 503,
    body: {
      error:
        'Web 进程不承载 MCP 运行时；GET /api/tools/list 将在 M2-04 Info API 对接 worker 后提供',
    },
  };
}
