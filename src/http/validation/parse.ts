import type { ZodType } from 'zod';
import { Errors } from '../../shared/kernel/errors';

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw Errors.validation('Request validation failed', { issues: result.error.issues });
  }
  return result.data;
}
