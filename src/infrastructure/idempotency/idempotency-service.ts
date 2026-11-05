import type { IdempotencyStore, UnitOfWork } from '../../shared/application/ports';
import type { Clock } from '../../shared/kernel/clock';
import { Errors } from '../../shared/kernel/errors';
import { requestFingerprint } from '../../shared/kernel/stable-json';
import type { OutboxDispatcher } from '../../modules/notifications/infrastructure/dispatcher';

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

export class IdempotencyService {
  constructor(
    private readonly store: IdempotencyStore,
    private readonly unitOfWork: UnitOfWork,
    private readonly dispatcher: OutboxDispatcher,
    private readonly clock: Clock,
  ) {}

  async run<T>(
    input: {
      organizationId: string;
      userId: string;
      key?: string;
      method: string;
      path: string;
      body: unknown;
    },
    produce: () => { statusCode: number; body: T } | Promise<{ statusCode: number; body: T }>,
  ): Promise<IdempotentResult<T>> {
    if (input.key && (input.key.length < 8 || input.key.length > 128)) {
      throw Errors.validation('Idempotency-Key must be between 8 and 128 characters');
    }
    const requestHash = requestFingerprint({ method: input.method, path: input.path, body: input.body });
    const result = await this.unitOfWork.runAsync(async () => {
      if (input.key) {
        const existing = this.store.get(input.organizationId, input.userId, input.key);
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw Errors.conflict('Idempotency key was already used with a different request');
          }
          return { statusCode: existing.statusCode, body: existing.response as T, replayed: true };
        }
      }
      const produced = await produce();
      if (input.key) {
        this.store.put({
          organizationId: input.organizationId,
          userId: input.userId,
          key: input.key,
          requestHash,
          statusCode: produced.statusCode,
          response: produced.body,
          createdAt: this.clock.now(),
        });
      }
      return { ...produced, replayed: false };
    });
    this.dispatcher.publishPending();
    return result;
  }
}
