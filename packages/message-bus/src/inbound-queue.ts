import { Queue, Worker, type Job } from 'bullmq';

import { getQueueConnectionOptions, getWorkerConnectionOptions } from '@meek/shared';

import type { AgentMessageEnvelope, AgentMessageEnvelopeSerialized } from './channel.types.js';
import { parseAgentMessageEnvelopeSerialized } from './channel.schema.js';
import { tryAcquireIdempotency } from './idempotency.js';
import { prepareSerializedInbound } from './inbound-envelope.js';
import {
  INBOUND_ATTEMPTS,
  INBOUND_BACKOFF_DELAY_MS,
  INBOUND_JOB_NAME,
  INBOUND_QUEUE_NAME,
  REDIS_KEY_PREFIX,
} from './queue-constants.js';

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

export async function publishInbound(envelope: AgentMessageEnvelope): Promise<void> {
  const idempotencyKey = envelope.trace.idempotencyKey;
  const acquired = await tryAcquireIdempotency(idempotencyKey);
  if (!acquired) {
    console.info(
      `[BUS] inbound skipped duplicate idempotencyKey=${idempotencyKey} requestId=${envelope.channelMeta.requestId}`
    );
    return;
  }

  const serialized = prepareSerializedInbound(envelope);
  const queue = getOrCreateInboundQueue();
  await queue.add(INBOUND_JOB_NAME, serialized, {
    jobId: idempotencyKey,
  });
  console.info(
    `[BUS] publishInbound requestId=${envelope.channelMeta.requestId} traceId=${envelope.trace.traceId}`
  );
}

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
    console.error(
      `[BUS] inbound job failed jobId=${job?.id ?? 'unknown'}: ${error.message}`
    );
  });

  console.info(`[BUS] Inbound Worker started concurrency=${concurrency}`);
  return inboundWorker;
}

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
