import { Errors } from './errors';

export interface PageQuery {
  limit: number;
  offset: number;
}

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  total: number;
}

export function normalizePage(input: { limit?: number; offset?: number }): PageQuery {
  const limit = input.limit ?? 25;
  const offset = input.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw Errors.validation('limit must be an integer between 1 and 100');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw Errors.validation('offset must be an integer greater than or equal to 0');
  }
  return { limit, offset };
}
