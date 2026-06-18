import { Redis } from 'ioredis';

let idempotencyConnection: Redis | null = null;

/** 读取 REDIS_URL；缺失时 throw（进程启动 / 首次连接时 fail-fast）。 */
export function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error('REDIS_URL is required for message bus');
  }
  return url;
}

/** BullMQ Queue 连接：快速失败，避免 HTTP 入队长时间阻塞 */
export function getQueueConnectionOptions(): {
  url: string;
  maxRetriesPerRequest: number;
} {
  return {
    url: getRedisUrl(),
    maxRetriesPerRequest: 3,
  };
}

/** BullMQ Worker 连接：blocking 命令须 maxRetriesPerRequest: null */
export function getWorkerConnectionOptions(): {
  url: string;
  maxRetriesPerRequest: null;
} {
  return {
    url: getRedisUrl(),
    maxRetriesPerRequest: null,
  };
}

/** 幂等 SET NX（独立连接，禁止 ioredis keyPrefix） */
export function getIdempotencyRedisConnection(): Redis {
  idempotencyConnection ??= new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 3,
  });
  return idempotencyConnection;
}

/** 测试 / 进程退出：关闭幂等 Redis 连接 */
export async function closeRedisConnections(): Promise<void> {
  if (idempotencyConnection) {
    await idempotencyConnection.quit();
    idempotencyConnection = null;
  }
}
