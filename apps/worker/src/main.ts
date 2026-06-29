import { createServer, type Server } from 'node:http';
import { cleanupExpiredAgentOutputs } from '@meek/agent-core/context';
import { ensureSeedFollowDefault, initConfigPlane } from '@meek/config-plane';
import { getRedisUrl, resolveDefaultWorkerPort } from '@meek/shared';
import { Logger } from '@meek/shared/logger';
import { startChannels, stopChannels } from './channels/bootstrap.js';
import { ensureWorkerRuntime } from './lib/runtime-bootstrap.js';
import { handleChannelStatusGet } from './http/channel-status-api.js';
import { handleInternalApi } from './http/internal-api.js';
import { startMessageBus, type MessageBusHandle } from './message-bus/bootstrap.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function listenServer(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onListenError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        Logger.error(
          'WORKER',
          `端口 ${port} 已被占用（可能有残留 Worker 进程）。请执行: netstat -ano | findstr :${port}`
        );
      }
      reject(error);
    };

    server.once('error', onListenError);
    server.listen(port, host, () => {
      server.off('error', onListenError);
      server.on('error', (error: Error) => {
        Logger.error('WORKER', 'HTTP server error', error);
      });
      resolve();
    });
  });
}

function createHttpServer(): Server {
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      if (req.method === 'GET' && pathname === '/internal/channels/status') {
        handleChannelStatusGet(res);
        return;
      }

      if (await handleInternalApi(req, res, pathname)) {
        return;
      }

      if (req.method === 'GET' && pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      res.writeHead(404);
      res.end();
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error('WORKER', `HTTP 处理失败: ${message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: message }));
      }
    });
  });
}

async function main(): Promise<void> {
  getRedisUrl();

  await cleanupExpiredAgentOutputs();
  await initConfigPlane();
  await ensureSeedFollowDefault();
  await ensureWorkerRuntime();

  const workerPort = resolveDefaultWorkerPort();
  const server = createHttpServer();
  await listenServer(server, workerPort, '127.0.0.1');
  Logger.info('WORKER', `health at http://127.0.0.1:${workerPort}/health`);

  const messageBus = startMessageBus();
  startChannels();

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    Logger.info('WORKER', `Received ${signal}, shutting down worker...`);

    const forceExit = setTimeout(() => {
      Logger.error('WORKER', 'Shutdown timeout, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    stopChannels();
    server.close(() => {
      void closeMessageBus(messageBus, forceExit);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function closeMessageBus(messageBus: MessageBusHandle, forceExit: NodeJS.Timeout): Promise<void> {
  try {
    await messageBus.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error: unknown) {
    Logger.error('WORKER', 'Shutdown failed', error);
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  Logger.error('WORKER', 'Worker startup failed', error);
  process.exit(1);
});
