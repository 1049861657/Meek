import { Redis } from 'ioredis';

import { getRedisUrl } from '@meek/shared';

let idempotencyConnection: Redis | null = null;
let publisherConnection: Redis | null = null;

export function getIdempotencyRedisConnection(): Redis {
  idempotencyConnection ??= new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 3,
  });
  return idempotencyConnection;
}

export function getRedisPublisher(): Redis {
  publisherConnection ??= new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 3,
  });
  return publisherConnection;
}

export function createRedisSubscriber(): Redis {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
  });
}

export async function closeMessageBusRedisConnections(): Promise<void> {
  const connections = [idempotencyConnection, publisherConnection].filter(
    (conn): conn is Redis => conn !== null
  );
  idempotencyConnection = null;
  publisherConnection = null;
  await Promise.all(connections.map((conn) => conn.quit()));
}
