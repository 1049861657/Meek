import { createServer, type Server } from 'node:http';
import { cleanupExpiredAgentOutputs } from '@meek/agent-core/context';
import { getRedisUrl } from '@meek/shared';
import { startChannels } from './channels/bootstrap.js';
import { bootstrapMcpConfig } from './lib/mcp-config-bootstrap.js';
import { handleInternalApi } from './http/internal-api.js';
import { startMessageBus } from './message-bus/bootstrap.js';

const WORKER_PORT = 4001;

async function main(): Promise<void> {
  getRedisUrl();

  await cleanupExpiredAgentOutputs();
  await bootstrapMcpConfig();

  const messageBus = startMessageBus();
  startChannels();

  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

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
      console.error('[WORKER] HTTP 处理失败:', message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: message }));
      }
    });
  });

  server.listen(WORKER_PORT, () => {
    console.log(`Worker health at http://localhost:${WORKER_PORT}/health`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, shutting down worker...`);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await messageBus.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

try {
  void main();
} catch (err: unknown) {
  console.error('Worker startup failed:', err);
  process.exit(1);
}
