import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './auth-routes';
import { registerDirectoryRoutes } from './directory-routes';
import { registerWorkOrderRoutes } from './work-order-routes';
import { registerBillingRoutes, registerInventoryRoutes } from './commerce-routes';
import { registerInsightRoutes } from './insight-routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerInsightRoutes(app);
  await registerAuthRoutes(app);
  await registerDirectoryRoutes(app);
  await registerWorkOrderRoutes(app);
  await registerInventoryRoutes(app);
  await registerBillingRoutes(app);
}
