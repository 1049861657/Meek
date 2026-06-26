/** @deprecated 从 `queue-names.ts` 导入；保留 re-export 以减少调用方 diff */
export {
  INBOUND_ATTEMPTS,
  INBOUND_BACKOFF_DELAY_MS,
  REDIS_KEY_PREFIX,
  REFERENCE_REDIS_KEY_PREFIX,
  INBOUND_QUEUE_NAME,
  DEFAULT_INBOUND_WORKER_CONCURRENCY,
  INBOUND_JOB_NAME,
  IDEMPOTENCY_TTL_SECONDS,
  resolveInboundWorkerConcurrency,
  buildIdempotencyRedisKey,
  buildOutboundRedisChannel,
  buildAbortRedisChannel,
} from './queue-names.js';
