export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  unauthenticated(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHENTICATED', message, 401);
  },
  forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError('FORBIDDEN', message, 403);
  },
  notFound(entity: string): AppError {
    return new AppError('NOT_FOUND', `${entity} not found`, 404);
  },
  conflict(message: string, details?: unknown): AppError {
    return new AppError('CONFLICT', message, 409, details ?? null);
  },
  invalidState(message: string): AppError {
    return new AppError('INVALID_STATE', message, 409);
  },
  validation(message: string, details?: unknown): AppError {
    return new AppError('VALIDATION', message, 422, details ?? null);
  },
  rateLimited(): AppError {
    return new AppError('RATE_LIMITED', 'Too many requests. Try again shortly.', 429);
  },
  insufficientStock(sku: string, available: number, requested: number): AppError {
    return new AppError('INSUFFICIENT_STOCK', `Not enough stock for ${sku}`, 409, {
      sku,
      available,
      requested,
    });
  },
};
