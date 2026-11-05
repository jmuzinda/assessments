import { Errors } from '../../shared/kernel/errors';

export function createFixedWindowLimiter(limit: number, windowMs: number): (key: string, nowMs: number) => void {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (key: string, nowMs: number): void => {
    const current = buckets.get(key);
    if (!current || nowMs >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
      return;
    }
    if (current.count >= limit) {
      throw Errors.rateLimited();
    }
    current.count += 1;
  };
}
