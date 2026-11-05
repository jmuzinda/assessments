import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/authenticate';
import { presentMembership, presentUser } from '../presenters/presenters';
import { parse } from '../validation/parse';
import { loginSchema, registerSchema } from '../validation/schemas';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/auth/register', async (request, reply) => {
    const body = parse(registerSchema, request.body);
    const result = await app.container.identity.register(body);
    return reply.code(201).send({
      data: {
        token: result.token,
        user: presentUser(result.user),
        organization: result.organization,
        membership: presentMembership(result.membership),
      },
    });
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = parse(loginSchema, request.body);
    const result = await app.container.identity.login({ ...body, ip: request.ip });
    return reply.send({
      data: {
        token: result.token,
        user: presentUser(result.user),
        organization: result.organization,
        membership: presentMembership(result.membership),
      },
    });
  });

  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ data: request.principal });
  });
}
