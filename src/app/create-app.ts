import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { createContainer, defaultAppConfig, type AppConfig, type Container } from './container';
import { openDatabase } from '../infrastructure/db/connection';
import { migrate } from '../infrastructure/db/migrate';
import { errorHandler } from '../http/errors/error-handler';
import { registerRoutes } from '../http/routes/index';
import '../http/types';
import type { Clock } from '../shared/kernel/clock';
import { systemClock } from '../shared/kernel/clock';

export interface AppOptions {
  databasePath?: string;
  clock?: Clock;
  logger?: boolean | { level: string };
  jwtSecret?: string;
  tokenTtlSeconds?: number;
  scryptCost?: number;
  taxRateBps?: number;
  invoiceDueDays?: number;
  planLimits?: AppConfig['planLimits'];
  authRateLimit?: number;
  authRateWindowMs?: number;
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance & { container: Container }> {
  const config: AppConfig = {
    ...defaultAppConfig,
    ...(options.jwtSecret ? { jwtSecret: options.jwtSecret } : {}),
    ...(options.tokenTtlSeconds ? { tokenTtlSeconds: options.tokenTtlSeconds } : {}),
    ...(options.scryptCost ? { scryptCost: options.scryptCost } : {}),
    ...(options.taxRateBps ? { taxRateBps: options.taxRateBps } : {}),
    ...(options.invoiceDueDays ? { invoiceDueDays: options.invoiceDueDays } : {}),
    ...(options.planLimits ? { planLimits: options.planLimits } : {}),
    ...(options.authRateLimit ? { authRateLimit: options.authRateLimit } : {}),
    ...(options.authRateWindowMs ? { authRateWindowMs: options.authRateWindowMs } : {}),
  };
  const db = openDatabase(options.databasePath ?? ':memory:');
  migrate(db);
  const clock = options.clock ?? systemClock;
  const container = createContainer(db, clock, config);
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1_000_000,
    genReqId: (request) => {
      const incoming = request.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 100) {
        return incoming;
      }
      return randomUUID();
    },
  });
  app.decorate('container', container);
  app.setErrorHandler(errorHandler);
  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
    const origin = request.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      void reply.header('access-control-allow-origin', origin);
      void reply.header('vary', 'origin');
      void reply.header('access-control-allow-headers', 'content-type, authorization, idempotency-key');
      void reply.header('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });
  app.addHook('onClose', async () => {
    db.close();
  });
  await registerRoutes(app);
  return app;
}
