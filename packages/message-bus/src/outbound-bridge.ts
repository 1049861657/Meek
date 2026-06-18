import type { AgentOutboundEnvelope } from './channel.types.js';
import { parseAgentOutboundEnvelope } from './channel.schema.js';
import {
  buildAbortRedisChannel,
  buildOutboundRedisChannel,
} from './queue-constants.js';
import { createRedisSubscriber, getRedisPublisher } from './redis-bridge.js';

export async function publishOutboundEvent(
  requestId: string,
  envelope: AgentOutboundEnvelope
): Promise<void> {
  await getRedisPublisher().publish(
    buildOutboundRedisChannel(requestId),
    JSON.stringify(envelope)
  );
}

export async function publishAbortSignal(requestId: string): Promise<void> {
  await getRedisPublisher().publish(buildAbortRedisChannel(requestId), '1');
}

export function subscribeOutboundEvents(
  requestId: string,
  onEnvelope: (envelope: AgentOutboundEnvelope) => void,
  signal?: AbortSignal
): () => void {
  const subscriber = createRedisSubscriber();
  const channel = buildOutboundRedisChannel(requestId);
  let closed = false;

  const cleanup = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    signal?.removeEventListener('abort', onAbort);
    try {
      await subscriber.unsubscribe(channel);
      subscriber.disconnect();
    } catch {
      subscriber.disconnect();
    }
  };

  const onAbort = (): void => {
    void cleanup();
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  void subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`[BUS] outbound subscribe failed requestId=${requestId}:`, err);
    }
  });

  subscriber.on('message', (receivedChannel, message) => {
    if (receivedChannel !== channel || closed) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(message);
      onEnvelope(parseAgentOutboundEnvelope(parsed));
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BUS] outbound parse failed requestId=${requestId}: ${errMessage}`);
    }
  });

  return () => {
    void cleanup();
  };
}

export function subscribeAbortSignal(
  requestId: string,
  onAbort: () => void
): () => void {
  const subscriber = createRedisSubscriber();
  const channel = buildAbortRedisChannel(requestId);
  let closed = false;

  const cleanup = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    try {
      await subscriber.unsubscribe(channel);
      subscriber.disconnect();
    } catch {
      subscriber.disconnect();
    }
  };

  void subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`[BUS] abort subscribe failed requestId=${requestId}:`, err);
    }
  });

  subscriber.on('message', (receivedChannel) => {
    if (receivedChannel !== channel || closed) {
      return;
    }
    onAbort();
    void cleanup();
  });

  return () => {
    void cleanup();
  };
}
