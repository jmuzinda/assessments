import type { OutboxStore } from '../../../shared/application/ports';
import type { DomainEvent } from '../../../shared/kernel/domain-event';
import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, readDate, readNullableDate, readString } from '../../../infrastructure/db/rows';

export class OutboxRepository implements OutboxStore {
  constructor(private readonly db: Db) {}

  append(event: DomainEvent): void {
    this.db
      .prepare(
        `INSERT INTO outbox_events (id, organization_id, type, payload_json, created_at, published_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      )
      .run(event.id, event.organizationId, event.type, JSON.stringify(event.payload), iso(event.createdAt));
  }

  unpublished(limit: number): DomainEvent[] {
    return queryAll(
      this.db,
      `SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT ?`,
      [limit],
    ).map((row) => ({
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      type: readString(row, 'type'),
      payload: JSON.parse(readString(row, 'payload_json')) as Record<string, unknown>,
      createdAt: readDate(row, 'created_at'),
      publishedAt: readNullableDate(row, 'published_at'),
    }));
  }

  markPublished(id: string, publishedAt: Date): void {
    this.db.prepare('UPDATE outbox_events SET published_at = ? WHERE id = ?').run(iso(publishedAt), id);
  }
}
