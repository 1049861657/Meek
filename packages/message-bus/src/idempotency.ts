import { buildIdempotencyRedisKey, IDEMPOTENCY_TTL_SECONDS } from './queue-names.js';
import { getIdempotencyRedisConnection } from './redis-bridge.js';

/**
 * 尝试占用幂等键（SET NX EX 24h）。
 * Meek 键：`meek:idem:{key}`；参考等价：`mcp-client:idem:{key}`（见 `REFERENCE_REDIS_KEY_PREFIX`）。
 * @returns true 表示首次请求可入队；false 表示重复应跳过
 */
export async function tryAcquireIdempotency(idempotencyKey: string): Promise<boolean> {
  const redis = getIdempotencyRedisConnection();
  const key = buildIdempotencyRedisKey(idempotencyKey);
  const result = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
  return result === 'OK';
}

/** 测试专用：释放幂等键 */
export async function releaseIdempotency(idempotencyKey: string): Promise<void> {
  const redis = getIdempotencyRedisConnection();
  await redis.del(buildIdempotencyRedisKey(idempotencyKey));
}
