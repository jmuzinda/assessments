import type { FastifyInstance } from 'fastify';
import { normalizePage } from '../../shared/kernel/pagination';
import { requireAuth, requirePermission } from '../middleware/authenticate';
import {
  presentNote,
  presentPage,
  presentTimeEntry,
  presentUsage,
  presentWorkOrder,
  presentWorkOrderDetail,
} from '../presenters/presenters';
import { parse } from '../validation/parse';
import {
  consumeSchema,
  dispatchSchema,
  idParams,
  noteSchema,
  reasonSchema,
  scheduleSchema,
  timeEntrySchema,
  versionSchema,
  workOrderQuerySchema,
  workOrderSchema,
} from '../validation/schemas';
import { command } from './command';

export async function registerWorkOrderRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/work-orders', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:write');
    const body = parse(workOrderSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentWorkOrder(app.container.workOrders.create(request.principal!, body)),
    );
  });

  app.get('/api/v1/work-orders', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'work_orders:read');
    const query = parse(workOrderQuerySchema, request.query);
    const page = normalizePage(query);
    const result = app.container.workOrders.list(principal, {
      ...page,
      status: query.status,
      priority: query.priority,
      customerId: query.customerId,
      technicianId: query.technicianId,
      query: query.q,
    });
    return reply.send(presentPage(result, presentWorkOrder));
  });

  app.get('/api/v1/work-orders/:id', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'work_orders:read');
    const params = parse(idParams, request.params);
    return reply.send({ data: presentWorkOrderDetail(app.container.workOrders.get(principal, params.id)) });
  });

  app.post('/api/v1/work-orders/:id/schedule', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:dispatch');
    const params = parse(idParams, request.params);
    const body = parse(scheduleSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(
        app.container.workOrders.schedule(request.principal!, params.id, {
          expectedVersion: body.expectedVersion,
          start: new Date(body.scheduledStart),
          end: new Date(body.scheduledEnd),
        }),
      ),
    );
  });

  app.post('/api/v1/work-orders/:id/dispatch', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:dispatch');
    const params = parse(idParams, request.params);
    const body = parse(dispatchSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(app.container.workOrders.dispatch(request.principal!, params.id, body)),
    );
  });

  app.post('/api/v1/work-orders/:id/start', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:execute');
    const params = parse(idParams, request.params);
    const body = parse(versionSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(app.container.workOrders.start(request.principal!, params.id, body.expectedVersion)),
    );
  });

  app.post('/api/v1/work-orders/:id/hold', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:execute');
    const params = parse(idParams, request.params);
    const body = parse(reasonSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(app.container.workOrders.hold(request.principal!, params.id, body)),
    );
  });

  app.post('/api/v1/work-orders/:id/resume', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:execute');
    const params = parse(idParams, request.params);
    const body = parse(versionSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(app.container.workOrders.resume(request.principal!, params.id, body.expectedVersion)),
    );
  });

  app.post('/api/v1/work-orders/:id/complete', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:execute');
    const params = parse(idParams, request.params);
    const body = parse(versionSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(app.container.workOrders.complete(request.principal!, params.id, body.expectedVersion)),
    );
  });

  app.post('/api/v1/work-orders/:id/cancel', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:dispatch');
    const params = parse(idParams, request.params);
    const body = parse(reasonSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentWorkOrder(app.container.workOrders.cancel(request.principal!, params.id, body)),
    );
  });

  app.post('/api/v1/work-orders/:id/notes', { preHandler: requireAuth }, async (request, reply) => {
    const params = parse(idParams, request.params);
    const body = parse(noteSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentNote(app.container.workOrders.addNote(request.principal!, params.id, body.body)),
    );
  });

  app.post('/api/v1/work-orders/:id/time-entries', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:execute');
    const params = parse(idParams, request.params);
    const body = parse(timeEntrySchema, request.body);
    return command(request, reply, 201, body, () =>
      presentTimeEntry(
        app.container.workOrders.addTimeEntry(request.principal!, params.id, {
          startedAt: new Date(body.startedAt),
          endedAt: new Date(body.endedAt),
          notes: body.notes ?? '',
        }),
      ),
    );
  });

  app.post('/api/v1/work-orders/:id/parts', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:execute');
    const params = parse(idParams, request.params);
    const body = parse(consumeSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentUsage(app.container.workOrders.consumePart(request.principal!, params.id, body)),
    );
  });
}
