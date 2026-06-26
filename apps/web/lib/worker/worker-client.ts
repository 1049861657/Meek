/** Web 调 Worker 内部 API（与 apps/worker 健康检查端口一致） */
const WORKER_HTTP_BASE = 'http://127.0.0.1:4001';

type WorkerApiSuccess<T> = { ok: true } & T;
type WorkerApiFailure = { ok: false; error: string };

export type WorkerForwardResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; details?: string };

async function postWorkerJson<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<WorkerForwardResult<T>> {
  const response = await fetch(`${WORKER_HTTP_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json()) as T | WorkerApiFailure | { error: string; details?: string };
  if (!response.ok) {
    const errPayload = payload as { error?: string; details?: string };
    return {
      ok: false,
      status: response.status,
      error: errPayload.error ?? `Worker 请求失败 (${response.status})`,
      details: errPayload.details,
    };
  }

  if (typeof payload === 'object' && payload !== null && 'ok' in payload && payload.ok === false) {
    const failure = payload as WorkerApiFailure;
    return { ok: false, status: response.status, error: failure.error };
  }

  return { ok: true, status: response.status, data: payload as T };
}

export async function workerMcpGetInfo(
  configUserId: string | null
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/info', { configUserId });
}

export async function workerMcpGetClientInfo(
  configUserId: string | null
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/client-info', { configUserId });
}

export async function workerMcpConnectServer(
  configUserId: string,
  serverId: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/connect', { configUserId, serverId });
}

export async function workerMcpDisconnectServer(
  configUserId: string,
  serverId: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/disconnect', { configUserId, serverId });
}

export async function workerMcpSwitchServer(
  configUserId: string,
  serverId: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/switch', { configUserId, serverId });
}

export async function workerMcpReloadConfig(
  configUserId: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/reload-config', { configUserId });
}

export async function workerMcpAddServer(
  configUserId: string,
  serverData: Record<string, unknown>
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/add', { configUserId, ...serverData });
}

export async function workerMcpUpdateServer(
  configUserId: string,
  serverId: string,
  serverData: Record<string, unknown>
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/update', {
    configUserId,
    serverId,
    ...serverData,
  });
}

export async function workerMcpDeleteServer(
  configUserId: string,
  serverId: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/delete', { configUserId, serverId });
}

export async function workerMcpGetToolPreferences(
  serverId: string
): Promise<WorkerForwardResult<{ preferences: Record<string, boolean> }>> {
  return postWorkerJson('/internal/mcp/server/tool-preferences/get', { serverId });
}

export async function workerMcpSaveToolPreferences(
  serverId: string,
  preferences: Record<string, boolean>
): Promise<WorkerForwardResult<{ ok: true; preferences: Record<string, boolean> }>> {
  return postWorkerJson('/internal/mcp/server/tool-preferences/save', {
    serverId,
    preferences,
  });
}

export async function workerMcpCallServerTool(
  configUserId: string,
  serverId: string,
  body: { toolName: string; arguments?: Record<string, unknown> },
  signal?: AbortSignal
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson(
    '/internal/mcp/server/tools/call',
    { configUserId, serverId, ...body },
    signal
  );
}

export async function workerMcpPreviewResource(
  configUserId: string | null,
  serverId: string,
  uri: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/resources/preview', {
    configUserId,
    serverId,
    uri,
  });
}

export async function workerMcpPreviewPrompt(
  configUserId: string | null,
  serverId: string,
  body: { name: string; arguments?: Record<string, unknown> }
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/server/prompts/preview', {
    configUserId,
    serverId,
    ...body,
  });
}

export async function workerMcpListServers(
  configUserId: string | null,
  scope?: string
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/servers', {
    configUserId,
    ...(scope ? { scope } : {}),
  });
}

export async function workerMcpProbeServers(
  configUserId: string | null,
  serverIds: string[]
): Promise<WorkerForwardResult<unknown>> {
  return postWorkerJson('/internal/mcp/probe', { configUserId, serverIds });
}

export async function workerMcpPartitionForPersistence(
  configUserId: string | null,
  serverIds: string[],
  enableTools: boolean
): Promise<
  WorkerForwardResult<{
    persistIds: string[];
    skipped: Array<{ id: string; name: string }>;
  }>
> {
  return postWorkerJson('/internal/mcp/reachability/partition', {
    configUserId,
    serverIds,
    enableTools,
  });
}

export async function workerMcpOAuthAuthorize(
  configUserId: string | null,
  serverId: string,
  webOrigin?: string
): Promise<{ authorizationUrl: string }> {
  const result = await postWorkerJson<{ ok: true; authorizationUrl: string }>(
    '/internal/mcp/oauth/authorize',
    {
      configUserId,
      serverId,
      ...(webOrigin ? { webOrigin } : {}),
    }
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { authorizationUrl: result.data.authorizationUrl };
}

export async function workerMcpOAuthFinish(
  code: string,
  state: string
): Promise<{ serverId: string }> {
  const result = await postWorkerJson<{ ok: true; serverId: string }>(
    '/internal/mcp/oauth/finish',
    { code, state }
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { serverId: result.data.serverId };
}
