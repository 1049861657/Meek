import { Queue, Worker, type Job } from 'bullmq';

import { getQueueConnectionOptions, getWorkerConnectionOptions } from '@meek/shared';
import { Logger } from '@meek/shared/logger';

import type { AgentMessageEnvelope, AgentMessageEnvelopeSerialized } from './channel.types.js';
import { parseAgentMessageEnvelopeSerialized } from './channel.schema.js';
import { tryAcquireIdempotency } from './idempotency.js';
import { prepareSerializedInbound } from './inbound-envelope.js';
import {
  logInboundDeadLetter,
  logInboundJobFailed,
  logInboundPublished,
  logInboundSkippedDuplicate,
} from './inbound-log.js';
import {
  INBOUND_ATTEMPTS,
  INBOUND_BACKOFF_DELAY_MS,
  INBOUND_JOB_NAME,
  INBOUND_QUEUE_NAME,
  REDIS_KEY_PREFIX,
} from './queue-names.js';

export type InboundJobHandler = (envelope: AgentMessageEnvelopeSerialized) => Promise<void>;

let inboundQueue: Queue | null = null;
let inboundWorker: Worker<AgentMessageEnvelopeSerialized> | null = null;

function getOrCreateInboundQueue(): Queue {
  inboundQueue ??= new Queue(INBOUND_QUEUE_NAME, {
    connection: getQueueConnectionOptions(),
    prefix: REDIS_KEY_PREFIX,
    defaultJobOptions: {
      attempts: INBOUND_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: INBOUND_BACKOFF_DELAY_MS,
      },
      removeOnComplete: true,
      removeOnFail: true,
    },
  });
  return inboundQueue;
}

function resolveMaxAttempts(job: Job<AgentMessageEnvelopeSerialized>): number {
  return job.opts.attempts ?? INBOUND_ATTEMPTS;
}

function handleInboundJobFailed(
  job: Job<AgentMessageEnvelopeSerialized> | undefined,
  error: Error
): void {
  if (!job) {
    console.error(`[BUS] inbound job failed jobId=unknown: ${error.message}`);
    return;
  }

  const maxAttempts = resolveMaxAttempts(job);
  const jobId = job.id ?? 'unknown';

  if (job.attemptsMade >= maxAttempts) {
    let envelope: AgentMessageEnvelopeSerialized | undefined;
    try {
      envelope = parseAgentMessageEnvelopeSerialized(job.data);
    } catch {
      envelope = undefined;
    }
    logInboundDeadLetter(jobId, envelope, error, job.attemptsMade);
    return;
  }

  logInboundJobFailed(jobId, job.attemptsMade, maxAttempts, error);
}

/**
 * 入站 Envelope 入队。
 * 幂等：Redis SET NX + BullMQ jobId 双保险；重复请求静默跳过。
 */
export async function publishInbound(envelope: AgentMessageEnvelope): Promise<void> {
  const idempotencyKey = envelope.trace.idempotencyKey;
  const acquired = await tryAcquireIdempotency(idempotencyKey);
  if (!acquired) {
    logInboundSkippedDuplicate(idempotencyKey, envelope.channelMeta.requestId);
    return;
  }

  const serialized = prepareSerializedInbound(envelope);
  const queue = getOrCreateInboundQueue();
  await queue.add(INBOUND_JOB_NAME, serialized, {
    jobId: idempotencyKey,
  });
  logInboundPublished(envelope);
}

/**
 * 启动 Inbound Worker 订阅队列。
 * @returns Worker 实例（进程生命周期内保持）
 */
export function startInboundWorker(
  handler: InboundJobHandler,
  concurrency: number
): Worker<AgentMessageEnvelopeSerialized> {
  if (inboundWorker) {
    return inboundWorker;
  }

  inboundWorker = new Worker<AgentMessageEnvelopeSerialized>(
    INBOUND_QUEUE_NAME,
    async (job: Job<AgentMessageEnvelopeSerialized>) => {
      const envelope = parseAgentMessageEnvelopeSerialized(job.data);
      await handler(envelope);
    },
    {
      connection: getWorkerConnectionOptions(),
      prefix: REDIS_KEY_PREFIX,
      concurrency,
    }
  );

  inboundWorker.on('failed', (job, error) => {
    handleInboundJobFailed(job, error);
  });

  Logger.info('BUS', `Inbound Worker started concurrency=${concurrency}`);
  return inboundWorker;
}

/** 测试 / 优雅关闭 */
export async function closeInboundMessageBus(): Promise<void> {
  if (inboundWorker) {
    await inboundWorker.close();
    inboundWorker = null;
  }
  if (inboundQueue) {
    await inboundQueue.close();
    inboundQueue = null;
  }
}
