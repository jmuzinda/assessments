import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentPrincipal } from '../middleware/authenticate';

export async function command<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  body: unknown,
  produce: () => T | Promise<T>,
): Promise<FastifyReply> {
  const principal = currentPrincipal(request);
  const header = request.headers['idempotency-key'];
  const result = await request.server.container.idempotency.run(
    {
      organizationId: principal.organizationId,
      userId: principal.userId,
      key: typeof header === 'string' ? header : undefined,
      method: request.method,
      path: request.url.split('?')[0] ?? request.url,
      body,
    },
    async () => ({ statusCode, body: { data: await produce() } }),
  );
  return reply.code(result.statusCode).send(result.body);
}
