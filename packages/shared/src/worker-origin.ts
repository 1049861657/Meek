const WORKER_LISTEN_HOST = '127.0.0.1';
const DEFAULT_WORKER_PORT = 4001;

function parsePortEnv(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }
  const port = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return fallback;
  }
  return port;
}

/** Worker HTTP 端口（`WORKER_PORT` 环境变量，否则 4001） */
export function resolveDefaultWorkerPort(): number {
  return parsePortEnv(process.env.WORKER_PORT, DEFAULT_WORKER_PORT);
}

/** Web 调 Worker 内部 API 的 base URL（与 Worker 健康检查端口一致） */
export function resolveWorkerHttpBase(): string {
  return `http://${WORKER_LISTEN_HOST}:${resolveDefaultWorkerPort()}`;
}
