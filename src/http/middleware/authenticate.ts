import type { FastifyReply, FastifyRequest } from 'fastify';
import { Errors } from '../../shared/kernel/errors';
import type { Principal } from '../../shared/auth/principal';
import { assertRole, type Permission } from '../../shared/auth/permissions';

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw Errors.unauthenticated();
  }
  const token = header.slice('Bearer '.length).trim();
  request.principal = request.server.container.identity.authenticate(token);
}

export function currentPrincipal(request: FastifyRequest): Principal {
  if (!request.principal) {
    throw Errors.unauthenticated();
  }
  return request.principal;
}

export function requirePermission(request: FastifyRequest, permission: Permission): Principal {
  const principal = currentPrincipal(request);
  assertRole(principal.role, permission);
  return principal;
}
