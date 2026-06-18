/** Web 调 Worker 内部 API（与 apps/worker 健康检查端口一致） */
const WORKER_HTTP_BASE = 'http://127.0.0.1:4001';

type WorkerApiSuccess<T> = { ok: true } & T;
type WorkerApiFailure = { ok: false; error: string };

async function postWorkerJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<WorkerApiSuccess<T>> {
  const response = await fetch(`${WORKER_HTTP_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as WorkerApiSuccess<T> | WorkerApiFailure;
  if (!response.ok || !payload.ok) {
    const message =
      payload.ok === false ? payload.error : `Worker 请求失败 (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function workerMcpOAuthAuthorize(
  configUserId: string | null,
  serverId: string,
  webOrigin?: string
): Promise<{ authorizationUrl: string }> {
  return postWorkerJson<{ authorizationUrl: string }>('/internal/mcp/oauth/authorize', {
    configUserId,
    serverId,
    ...(webOrigin ? { webOrigin } : {}),
  });
}

export async function workerMcpOAuthFinish(
  code: string,
  state: string
): Promise<{ serverId: string }> {
  return postWorkerJson<{ serverId: string }>('/internal/mcp/oauth/finish', {
    code,
    state,
  });
}
