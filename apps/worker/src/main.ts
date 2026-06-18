import { createServer, type Server } from 'node:http';
import { cleanupExpiredAgentOutputs } from '@meek/agent-core/context';
import { getRedisUrl, loadRootEnv } from '@meek/shared';
import { startChannels } from './channels/bootstrap';
import { startMessageBus } from './message-bus/bootstrap';

loadRootEnv();
const WORKER_PORT = 4001;

async function main(): Promise<void> {
  getRedisUrl();

  await cleanupExpiredAgentOutputs();

  const messageBus = startMessageBus();
  startChannels();

  const server: Server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
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
