export const INBOUND_ATTEMPTS = 3;
export const INBOUND_BACKOFF_DELAY_MS = 1000;

export {
  REDIS_KEY_PREFIX,
  INBOUND_QUEUE_NAME,
  DEFAULT_INBOUND_WORKER_CONCURRENCY,
  INBOUND_JOB_NAME,
  IDEMPOTENCY_TTL_SECONDS,
  resolveInboundWorkerConcurrency,
  buildIdempotencyRedisKey,
  buildOutboundRedisChannel,
  buildAbortRedisChannel,
} from './queue-names.js';
