import type { Principal } from '../shared/auth/principal';
import type { Container } from '../app/container';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }

  interface FastifyInstance {
    container: Container;
  }
}
