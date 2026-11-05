import type { FastifyInstance } from 'fastify';
import { Errors } from '../../shared/kernel/errors';
import { normalizePage } from '../../shared/kernel/pagination';
import { requireAuth, requirePermission } from '../middleware/authenticate';
import { presentAudit, presentNotification, presentPage } from '../presenters/presenters';
import { parse } from '../validation/parse';
import { auditQuerySchema, idParams, notificationQuerySchema, reportWindowSchema } from '../validation/schemas';
import { command } from './command';

export async function registerInsightRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    app.container.ping();
    return reply.send({ data: { status: 'ok', service: 'helio', time: app.container.clock.now().toISOString() } });
  });

  app.get('/api/v1/reports/operations', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'reports:read');
    const query = parse(reportWindowSchema, request.query);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to.getTime() <= from.getTime()) {
      throw Errors.validation('to must be after from');
    }
    const report = app.container.reporting.operations(principal, from, to);
    return reply.send({
      data: {
        ...report,
        generatedAt: report.generatedAt.toISOString(),
        window: { from: report.window.from.toISOString(), to: report.window.to.toISOString() },
      },
    });
  });

  app.get('/api/v1/reports/revenue', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'reports:read');
    const report = app.container.reporting.revenue(principal);
    return reply.send({ data: { ...report, generatedAt: report.generatedAt.toISOString() } });
  });

  app.get('/api/v1/reports/inventory', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'reports:read');
    return reply.send({ data: app.container.reporting.lowStock(principal) });
  });

  app.get('/api/v1/audit', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'audit:read');
    const query = parse(auditQuerySchema, request.query);
    const page = normalizePage(query);
    const result = app.container.audit.list(principal, {
      ...page,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
    });
    return reply.send(presentPage(result, presentAudit));
  });

  app.get('/api/v1/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'notifications:read');
    const query = parse(notificationQuerySchema, request.query);
    const page = normalizePage(query);
    const result = app.container.notifications.list(principal, {
      ...page,
      unreadOnly: query.unreadOnly === 'true',
    });
    return reply.send(presentPage(result, presentNotification));
  });

  app.post('/api/v1/notifications/:id/read', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'notifications:read');
    const params = parse(idParams, request.params);
    return command(request, reply, 200, {}, () =>
      presentNotification(app.container.notifications.markRead(request.principal!, params.id)),
    );
  });
}
