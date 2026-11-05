import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/authenticate';
import { presentAsset, presentCustomer, presentMembership, presentPage, presentSite, presentUser } from '../presenters/presenters';
import { command } from './command';
import { parse } from '../validation/parse';
import {
  assetSchema,
  assetStatusSchema,
  customerPatchSchema,
  customerQuerySchema,
  customerSchema,
  idParams,
  memberSchema,
  siteSchema,
  technicianSchema,
} from '../validation/schemas';
import { normalizePage } from '../../shared/kernel/pagination';
import { presentTechnician } from '../presenters/presenters';

export async function registerDirectoryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/members', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'members:write');
    const body = parse(memberSchema, request.body);
    return command(request, reply, 201, body, async () => {
      const created = await app.container.identity.addMember(request.principal!, body);
      return { user: presentUser(created.user), membership: presentMembership(created.membership) };
    });
  });

  app.get('/api/v1/members', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'members:read');
    const members = app.container.identity.listMembers(principal).map((member) => ({
      user: presentUser(member.user),
      membership: presentMembership(member.membership),
    }));
    return reply.send({ data: members });
  });

  app.post('/api/v1/technicians', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'members:write');
    const body = parse(technicianSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentTechnician(app.container.workforce.create(request.principal!, body)),
    );
  });

  app.get('/api/v1/technicians', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'work_orders:read');
    return reply.send({ data: app.container.workforce.list(request.principal!).map(presentTechnician) });
  });

  app.post('/api/v1/customers', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'customers:write');
    const body = parse(customerSchema, request.body);
    return command(request, reply, 201, body, () => presentCustomer(app.container.customers.create(request.principal!, body)));
  });

  app.get('/api/v1/customers', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'customers:read');
    const query = parse(customerQuerySchema, request.query);
    const page = normalizePage(query);
    const result = app.container.customers.list(principal, { ...page, query: query.q, status: query.status });
    return reply.send(presentPage(result, presentCustomer));
  });

  app.get('/api/v1/customers/:id', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'customers:read');
    const params = parse(idParams, request.params);
    return reply.send({ data: presentCustomer(app.container.customers.get(principal, params.id)) });
  });

  app.patch('/api/v1/customers/:id', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'customers:write');
    const params = parse(idParams, request.params);
    const body = parse(customerPatchSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentCustomer(app.container.customers.update(request.principal!, params.id, body)),
    );
  });

  app.post('/api/v1/customers/:id/sites', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'customers:write');
    const params = parse(idParams, request.params);
    const body = parse(siteSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentSite(app.container.customers.addSite(request.principal!, params.id, body)),
    );
  });

  app.get('/api/v1/customers/:id/sites', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'customers:read');
    const params = parse(idParams, request.params);
    return reply.send({ data: app.container.customers.listSites(principal, params.id).map(presentSite) });
  });

  app.post('/api/v1/sites/:id/assets', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'customers:write');
    const params = parse(idParams, request.params);
    const body = parse(assetSchema, request.body);
    return command(request, reply, 201, body, () =>
      presentAsset(app.container.customers.addAsset(request.principal!, params.id, body)),
    );
  });

  app.get('/api/v1/sites/:id/assets', { preHandler: requireAuth }, async (request, reply) => {
    const principal = requirePermission(request, 'customers:read');
    const params = parse(idParams, request.params);
    return reply.send({ data: app.container.customers.listAssets(principal, params.id).map(presentAsset) });
  });

  app.post('/api/v1/assets/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    requirePermission(request, 'customers:write');
    const params = parse(idParams, request.params);
    const body = parse(assetStatusSchema, request.body);
    return command(request, reply, 200, body, () =>
      presentAsset(app.container.customers.changeAssetStatus(request.principal!, params.id, body.status)),
    );
  });
}
