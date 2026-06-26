/** Meek Redis key 前缀（BullMQ prefix + 幂等 key）；参考等价 `mcp-client` */
export const REDIS_KEY_PREFIX = 'meek';

/** 参考产品幂等前缀（文档对照用，运行时不使用） */
export const REFERENCE_REDIS_KEY_PREFIX = 'mcp-client';

/** Inbound 队列逻辑名（BullMQ 内部会加 prefix） */
export const INBOUND_QUEUE_NAME = 'inbound';

export const DEFAULT_INBOUND_WORKER_CONCURRENCY = 5;

/** Inbound job 名称 */
export const INBOUND_JOB_NAME = 'agent.message.inbound';

/** Inbound job 最大重试次数 */
export const INBOUND_ATTEMPTS = 3;

/** Inbound job 指数退避初始延迟（毫秒） */
export const INBOUND_BACKOFF_DELAY_MS = 1000;

/** 幂等 key TTL（秒，24h） */
export const IDEMPOTENCY_TTL_SECONDS = 86_400;

/**
 * 解析 Inbound Worker 并发数。
 * @throws 环境变量非法时
 */
export function resolveInboundWorkerConcurrency(): number {
  const raw = process.env.INBOUND_WORKER_CONCURRENCY;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_INBOUND_WORKER_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error(`Invalid INBOUND_WORKER_CONCURRENCY: ${raw}`);
  }
  return parsed;
}

/**
 * 幂等 Redis key：`meek:idem:{idempotencyKey}`（参考：`mcp-client:idem:{idempotencyKey}`）
 */
export function buildIdempotencyRedisKey(idempotencyKey: string): string {
  return `${REDIS_KEY_PREFIX}:idem:${idempotencyKey}`;
}

/** Web 出站 Pub/Sub channel */
export function buildOutboundRedisChannel(requestId: string): string {
  return `${REDIS_KEY_PREFIX}:outbound:${requestId}`;
}

/** Web 中止信号 Pub/Sub channel */
export function buildAbortRedisChannel(requestId: string): string {
  return `${REDIS_KEY_PREFIX}:abort:${requestId}`;
}
