import type { AuditEntry, AuditFilter, DomainEvent } from '../kernel/domain-event';

export interface UnitOfWork {
  run<T>(work: () => T): T;
  runAsync<T>(work: () => Promise<T>): Promise<T>;
}

export interface AuditStore {
  append(entry: AuditEntry): void;
  list(organizationId: string, filter: AuditFilter): { rows: AuditEntry[]; total: number };
}

export interface OutboxStore {
  append(event: DomainEvent): void;
  unpublished(limit: number): DomainEvent[];
  markPublished(id: string, publishedAt: Date): void;
}

export interface SequenceStore {
  next(organizationId: string, name: string): number;
}

export interface IdempotencyRecord {
  organizationId: string;
  userId: string;
  key: string;
  requestHash: string;
  statusCode: number;
  response: unknown;
  createdAt: Date;
}

export interface IdempotencyStore {
  get(organizationId: string, userId: string, key: string): IdempotencyRecord | undefined;
  put(record: IdempotencyRecord): void;
}
