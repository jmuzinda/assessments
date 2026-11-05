import type { SQLInputValue } from 'node:sqlite';
import type { AuditStore } from '../../../shared/application/ports';
import type { AuditEntry, AuditFilter } from '../../../shared/kernel/domain-event';
import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, queryOne, readDate, readString } from '../../../infrastructure/db/rows';

export class AuditRepository implements AuditStore {
  constructor(private readonly db: Db) {}

  append(entry: AuditEntry): void {
    this.db
      .prepare(
        `INSERT INTO audit_entries (
           id, organization_id, actor_id, action, entity_type, entity_id, metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.organizationId,
        entry.actorId,
        entry.action,
        entry.entityType,
        entry.entityId,
        JSON.stringify(entry.metadata),
        iso(entry.createdAt),
      );
  }

  list(organizationId: string, filter: AuditFilter): { rows: AuditEntry[]; total: number } {
    const where = ['organization_id = ?'];
    const params: SQLInputValue[] = [organizationId];
    if (filter.action) {
      where.push('action = ?');
      params.push(filter.action);
    }
    if (filter.entityType) {
      where.push('entity_type = ?');
      params.push(filter.entityType);
    }
    if (filter.entityId) {
      where.push('entity_id = ?');
      params.push(filter.entityId);
    }
    const clause = where.join(' AND ');
    const totalRow = queryOne(this.db, `SELECT COUNT(*) AS count FROM audit_entries WHERE ${clause}`, params);
    const rows = queryAll(
      this.db,
      `SELECT * FROM audit_entries WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset],
    ).map((row) => ({
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      actorId: readString(row, 'actor_id'),
      action: readString(row, 'action'),
      entityType: readString(row, 'entity_type'),
      entityId: readString(row, 'entity_id'),
      metadata: JSON.parse(readString(row, 'metadata_json')) as Record<string, unknown>,
      createdAt: readDate(row, 'created_at'),
    }));
    return { rows, total: totalRow ? Number(totalRow.count) : 0 };
  }
}
