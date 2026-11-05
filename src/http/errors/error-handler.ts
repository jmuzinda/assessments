import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyError } from 'fastify';
import { AppError } from '../../shared/kernel/errors';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof AppError) {
    void reply.code(error.status).send({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }
  request.log.error({ err: error }, 'request failed');
  void reply.code(500).send({
    error: { code: 'INTERNAL', message: 'Internal server error', details: null },
  });
}
