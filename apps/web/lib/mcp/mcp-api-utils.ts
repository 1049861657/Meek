import { Logger } from '@meek/agent-core';

import type { RequestPrincipal } from '@/lib/chat/resolve-principal';
import type { WorkerForwardResult } from '@/lib/worker/worker-client';

export function requireAuthUser(principal: RequestPrincipal): string | Response {
  if (!principal.userId) {
    return Response.json(
      { error: '需要登录', details: 'MCP 写操作需要登录用户' },
      { status: 401 }
    );
  }
  return principal.userId;
}

export function workerResultToResponse<T>(result: WorkerForwardResult<T>): Response {
  if (!result.ok) {
    return Response.json(
      { error: result.error, ...(result.details ? { details: result.details } : {}) },
      { status: result.status }
    );
  }
  return Response.json(result.data, { status: result.status });
}

export async function handleWorkerError(error: unknown, label: string): Promise<Response> {
  const message = error instanceof Error ? error.message : String(error);
  Logger.error('API', `${label}: ${message}`);
  return Response.json({ error: label, details: message }, { status: 500 });
}
