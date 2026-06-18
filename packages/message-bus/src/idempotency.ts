import {
  buildIdempotencyRedisKey,
  IDEMPOTENCY_TTL_SECONDS,
} from './queue-names.js';
import { getIdempotencyRedisConnection } from './redis-bridge.js';

export async function tryAcquireIdempotency(idempotencyKey: string): Promise<boolean> {
  const redis = getIdempotencyRedisConnection();
  const key = buildIdempotencyRedisKey(idempotencyKey);
  const result = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
  return result === 'OK';
}

export async function releaseIdempotency(idempotencyKey: string): Promise<void> {
  const redis = getIdempotencyRedisConnection();
  await redis.del(buildIdempotencyRedisKey(idempotencyKey));
}
