import {
  closeInboundMessageBus,
  closeMessageBusRedisConnections,
  resolveInboundWorkerConcurrency,
  startInboundWorker,
} from '@meek/message-bus';

import { processInboundJob } from './inbound-worker.js';

export interface MessageBusHandle {
  close(): Promise<void>;
}

export function startMessageBus(): MessageBusHandle {
  const concurrency = resolveInboundWorkerConcurrency();
  const worker = startInboundWorker(processInboundJob, concurrency);

  return {
    async close(): Promise<void> {
      await worker.close();
      await closeInboundMessageBus();
      await closeMessageBusRedisConnections();
    },
  };
}
