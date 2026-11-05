import type { SQLInputValue } from 'node:sqlite';
import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, queryOne, readDate, readNullableDate, readNullableString, readString } from '../../../infrastructure/db/rows';
import type { NotificationListFilter, NotificationStore } from '../application/ports';
import type { Notification, NotificationDraft } from '../domain/notification-policy';

export class NotificationRepository implements NotificationStore {
  constructor(private readonly db: Db) {}

  insert(notification: NotificationDraft): void {
    this.db
      .prepare(
        `INSERT INTO notifications (
           id, organization_id, recipient_user_id, type, title, body, entity_type, entity_id, read_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(
        notification.id,
        notification.organizationId,
        notification.recipientUserId,
        notification.type,
        notification.title,
        notification.body,
        notification.entityType,
        notification.entityId,
        iso(notification.createdAt),
      );
  }

  list(organizationId: string, filter: NotificationListFilter): { rows: Notification[]; total: number } {
    const where = ['organization_id = ?'];
    const params: SQLInputValue[] = [organizationId];
    if (filter.recipientUserId) {
      where.push('recipient_user_id = ?');
      params.push(filter.recipientUserId);
    }
    if (filter.unreadOnly) {
      where.push('read_at IS NULL');
    }
    const clause = where.join(' AND ');
    const totalRow = queryOne(this.db, `SELECT COUNT(*) AS count FROM notifications WHERE ${clause}`, params);
    const rows = queryAll(
      this.db,
      `SELECT * FROM notifications WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset],
    ).map((row) => this.map(row));
    return { rows, total: totalRow ? Number(totalRow.count) : 0 };
  }

  find(organizationId: string, id: string): Notification | undefined {
    const row = queryOne(this.db, 'SELECT * FROM notifications WHERE organization_id = ? AND id = ?', [
      organizationId,
      id,
    ]);
    return row ? this.map(row) : undefined;
  }

  markRead(organizationId: string, id: string, readAt: Date): void {
    this.db
      .prepare(
        'UPDATE notifications SET read_at = ? WHERE organization_id = ? AND id = ? AND read_at IS NULL',
      )
      .run(iso(readAt), organizationId, id);
  }

  private map(row: Record<string, unknown>): Notification {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      recipientUserId: readNullableString(row, 'recipient_user_id'),
      type: readString(row, 'type'),
      title: readString(row, 'title'),
      body: readString(row, 'body'),
      entityType: readNullableString(row, 'entity_type'),
      entityId: readNullableString(row, 'entity_id'),
      readAt: readNullableDate(row, 'read_at'),
      createdAt: readDate(row, 'created_at'),
    };
  }
}
