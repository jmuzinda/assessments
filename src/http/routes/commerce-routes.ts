import type { FastifyInstance } from 'fastify';
import { normalizePage } from '../../shared/kernel/pagination';
import { requireAuth, requirePermission } from '../middleware/authenticate';
import {
  presentInvoice,
  presentInvoiceDetail,
  presentLevel,
  presentLocation,
  presentPage,
  presentPart,
  presentReservation,
} from '../presenters/presenters';
import { parse } from '../validation/parse';
import {
  adjustSchema,
  idParams,
  invoiceQuerySchema,
  locationSchema,
  partSchema,
  paymentSchema,
  receiveSchema,
  reservationQuerySchema,
  transferSchema,
  reserveSchema,
} from '../validation/schemas';
import { command } from './command';

export async function registerInventoryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/parts', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const body = parse(partSchema, request.body);
    return command(request, reply, 201, body, () => presentPart(app.container.inventory.createPart(request.principal!, body)));
  });

  app.get('/api/v1/parts', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'inventory:read');
    return reply.send({ data: app.container.inventory.listParts(principal).map(presentPart) });
  });

  app.post('/api/v1/locations', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const body = parse(locationSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentLocation(app.container.inventory.createLocation(request.principal!, body)),
    );
  });

  app.get('/api/v1/locations', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'inventory:read');
    return reply.send({ data: app.container.inventory.listLocations(principal).map(presentLocation) });
  });

  app.get('/api/v1/stock', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'inventory:read');
    return reply.send({ data: app.container.inventory.listLevels(principal).map(presentLevel) });
  });

  app.post('/api/v1/stock/receive', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const body = parse(receiveSchema, request.body);
    return command(request, reply, 200, body, () => presentLevel(app.container.inventory.receive(request.principal!, body)));
  });

  app.post('/api/v1/stock/transfers', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const body = parse(transferSchema, request.body);
    return command(request, reply, 200, body, () => app.container.inventory.transfer(request.principal!, body));
  });

  app.post('/api/v1/stock/adjust', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const body = parse(adjustSchema, request.body);
    return command(request, reply, 200, body, () => presentLevel(app.container.inventory.adjust(request.principal!, body)));
  });

  app.post('/api/v1/stock/reservations', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const body = parse(reserveSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentReservation(app.container.inventory.reserve(request.principal!, body)),
    );
  });

  app.post('/api/v1/stock/reservations/:id/release', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'inventory:write');
    const params = parse(idParams, request.params);
    return command(request, reply, 200, {}, () =>
      presentReservation(app.container.inventory.release(request.principal!, params.id)),
    );
  });

  app.get('/api/v1/stock/reservations', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'inventory:read');
    const query = parse(reservationQuerySchema, request.query);
    return reply.send({
      data: app.container.inventory.listReservations(principal, query.workOrderId).map(presentReservation),
    });
  });
}

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/work-orders/:id/invoice', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'billing:write');
    const params = parse(idParams, request.params);
    return command(request, reply, 201, {}, () =>
      presentInvoiceDetail(app.container.billing.draftFromWorkOrder(request.principal!, params.id)),
    );
  });

  app.get('/api/v1/invoices', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'billing:read');
    const query = parse(invoiceQuerySchema, request.query);
    const page = normalizePage(query);
    const result = app.container.billing.list(principal, { ...page, status: query.status, customerId: query.customerId });
    return reply.send(presentPage(result, presentInvoice));
  });

  app.get('/api/v1/invoices/:id', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'billing:read');
    const params = parse(idParams, request.params);
    return reply.send({ data: presentInvoiceDetail(app.container.billing.get(principal, params.id)) });
  });

  app.post('/api/v1/invoices/:id/issue', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'billing:write');
    const params = parse(idParams, request.params);
    return command(request, reply, 200, {}, () =>
      presentInvoiceDetail(app.container.billing.issue(request.principal!, params.id)),
    );
  });

  app.post('/api/v1/invoices/:id/payments', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'billing:write');
    const params = parse(idParams, request.params);
    const body = parse(paymentSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentInvoiceDetail(app.container.billing.pay(request.principal!, params.id, body)),
    );
  });

  app.post('/api/v1/invoices/:id/void', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'billing:write');
    const params = parse(idParams, request.params);
    return command(request, reply, 200, {}, () =>
      presentInvoiceDetail(app.container.billing.voidInvoice(request.principal!, params.id)),
    );
  });
}
