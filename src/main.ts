import { createApp } from './app/create-app';
import { loadEnv } from './config/env';
import { startOutboxWorker } from './workers/outbox-worker';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await createApp({
    databasePath: env.databasePath,
    jwtSecret: env.jwtSecret,
    logger: { level: env.logLevel },
  });
  const worker = startOutboxWorker(app.container.outbox, 2_000);

  const shutdown = async (): Promise<void> => {
    worker.stop();
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().then(() => process.exit(0));
  });
  await app.listen({ port: env.port, host: '0.0.0.0' });
}

void main();
