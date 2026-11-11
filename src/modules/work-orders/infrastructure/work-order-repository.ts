import type { SQLInputValue } from 'node:sqlite';
import type { Db } from '../../../infrastructure/db/connection';
import {
  iso,
  queryAll,
  queryOne,
  readDate,
  readNullableDate,
  readNullableString,
  readNumber,
  readString,
} from '../../../infrastructure/db/rows';
import { escapeLike } from '../../../shared/kernel/slug';
import { Errors } from '../../../shared/kernel/errors';
import type { WorkOrderStore } from '../application/ports';
import type { Priority, TimeEntry, WorkOrder, WorkOrderNote, WorkOrderStatus } from '../domain/types';

export class WorkOrderRepository implements WorkOrderStore {
  constructor(private readonly db: Db) {}

  insert(workOrder: WorkOrder): void {
    this.db
      .prepare(
        `INSERT INTO work_orders (
           id, organization_id, number, customer_id, site_id, asset_id, title, description, priority, status,
           sla_due_at, scheduled_start, scheduled_end, technician_id, created_by, version, cancel_reason,
           completed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        workOrder.id,
        workOrder.organizationId,
        workOrder.number,
        workOrder.customerId,
        workOrder.siteId,
        workOrder.assetId,
        workOrder.title,
        workOrder.description,
        workOrder.priority,
        workOrder.status,
        iso(workOrder.slaDueAt),
        workOrder.scheduledStart ? iso(workOrder.scheduledStart) : null,
        workOrder.scheduledEnd ? iso(workOrder.scheduledEnd) : null,
        workOrder.technicianId,
        workOrder.createdBy,
        workOrder.version,
        workOrder.cancelReason,
        workOrder.completedAt ? iso(workOrder.completedAt) : null,
        iso(workOrder.createdAt),
        iso(workOrder.updatedAt),
      );
  }

  update(workOrder: WorkOrder): void {
    const changes = this.db
      .prepare(
        `UPDATE work_orders SET
           status = ?, scheduled_start = ?, scheduled_end = ?, technician_id = ?, version = ?,
           cancel_reason = ?, completed_at = ?, updated_at = ?
         WHERE id = ? AND organization_id = ? AND version = ?`,
      )
      .run(
        workOrder.status,
        workOrder.scheduledStart ? iso(workOrder.scheduledStart) : null,
        workOrder.scheduledEnd ? iso(workOrder.scheduledEnd) : null,
        workOrder.technicianId,
        workOrder.version,
        workOrder.cancelReason,
        workOrder.completedAt ? iso(workOrder.completedAt) : null,
        iso(workOrder.updatedAt),
        workOrder.id,
        workOrder.organizationId,
        workOrder.version - 1,
      ).changes;
    if (Number(changes) !== 1) {
      throw Errors.conflict('Work order was updated by someone else');
    }
  }

  findById(organizationId: string, id: string): WorkOrder | undefined {
    const row = queryOne(this.db, 'SELECT * FROM work_orders WHERE organization_id = ? AND id = ?', [
      organizationId,
      id,
    ]);
    return row ? this.mapWorkOrder(row) : undefined;
  }

  list(
    organizationId: string,
    filter: Parameters<WorkOrderStore['list']>[1],
  ): { rows: WorkOrder[]; total: number } {
    const where = ['organization_id = ?'];
    const params: SQLInputValue[] = [organizationId];
    if (filter.status) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.priority) {
      where.push('priority = ?');
      params.push(filter.priority);
    }
    if (filter.customerId) {
      where.push('customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.technicianId) {
      where.push('technician_id = ?');
      params.push(filter.technicianId);
    }
    if (filter.query) {
      where.push(`(title LIKE ? ESCAPE '\\' OR CAST(number AS TEXT) = ?)`);
      params.push(`%${escapeLike(filter.query)}%`, filter.query.replace(/^WO-/i, ''));
    }
    const clause = where.join(' AND ');
    const totalRow = queryOne(this.db, `SELECT COUNT(*) AS count FROM work_orders WHERE ${clause}`, params);
    const rows = queryAll(
      this.db,
      `SELECT * FROM work_orders WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset],
    ).map((row) => this.mapWorkOrder(row));
    return { rows, total: totalRow ? Number(totalRow.count) : 0 };
  }

  countCreatedBetween(organizationId: string, from: Date, to: Date): number {
    const row = queryOne(
      this.db,
      `SELECT COUNT(*) AS count FROM work_orders
       WHERE organization_id = ? AND created_at >= ? AND created_at < ?`,
      [organizationId, iso(from), iso(to)],
    );
    return row ? Number(row.count) : 0;
  }

  hasTechnicianOverlap(input: {
    organizationId: string;
    technicianId: string;
    start: Date;
    end: Date;
    excludingWorkOrderId?: string;
  }): boolean {
    const params: SQLInputValue[] = [
      input.organizationId,
      input.technicianId,
      iso(input.end),
      iso(input.start),
    ];
    let sql = `SELECT id FROM work_orders
      WHERE organization_id = ?
        AND technician_id = ?
        AND status IN ('scheduled', 'dispatched', 'in_progress')
        AND scheduled_start < ?
        AND scheduled_end > ?`;
    if (input.excludingWorkOrderId) {
      sql += ' AND id != ?';
      params.push(input.excludingWorkOrderId);
    }
    return queryOne(this.db, sql, params) !== undefined;
  }

  countOpenAssignments(organizationId: string, technicianId: string): number {
    const row = queryOne(
      this.db,
      `SELECT COUNT(*) AS total FROM work_orders
       WHERE organization_id = ?
         AND technician_id = ?
         AND status IN ('scheduled', 'dispatched', 'in_progress')`,
      [organizationId, technicianId],
    );
    return row ? readNumber(row, 'total') : 0;
  }

  insertNote(note: WorkOrderNote): void {
    this.db
      .prepare(
        `INSERT INTO work_order_notes (id, organization_id, work_order_id, author_id, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(note.id, note.organizationId, note.workOrderId, note.authorId, note.body, iso(note.createdAt));
  }

  listNotes(organizationId: string, workOrderId: string): WorkOrderNote[] {
    return queryAll(
      this.db,
      `SELECT * FROM work_order_notes
       WHERE organization_id = ? AND work_order_id = ?
       ORDER BY created_at`,
      [organizationId, workOrderId],
    ).map((row) => ({
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      workOrderId: readString(row, 'work_order_id'),
      authorId: readString(row, 'author_id'),
      body: readString(row, 'body'),
      createdAt: readDate(row, 'created_at'),
    }));
  }

  insertTimeEntry(entry: TimeEntry): void {
    this.db
      .prepare(
        `INSERT INTO time_entries (
           id, organization_id, work_order_id, technician_id, started_at, ended_at, minutes,
           hourly_rate_cents, notes, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.organizationId,
        entry.workOrderId,
        entry.technicianId,
        iso(entry.startedAt),
        iso(entry.endedAt),
        entry.minutes,
        entry.hourlyRateCents,
        entry.notes,
        iso(entry.createdAt),
      );
  }

  listTimeEntries(organizationId: string, workOrderId: string): TimeEntry[] {
    return queryAll(
      this.db,
      `SELECT * FROM time_entries WHERE organization_id = ? AND work_order_id = ? ORDER BY started_at`,
      [organizationId, workOrderId],
    ).map((row) => ({
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      workOrderId: readString(row, 'work_order_id'),
      technicianId: readString(row, 'technician_id'),
      startedAt: readDate(row, 'started_at'),
      endedAt: readDate(row, 'ended_at'),
      minutes: readNumber(row, 'minutes'),
      hourlyRateCents: readNumber(row, 'hourly_rate_cents'),
      notes: readString(row, 'notes'),
      createdAt: readDate(row, 'created_at'),
    }));
  }

  private mapWorkOrder(row: Record<string, unknown>): WorkOrder {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      number: readNumber(row, 'number'),
      customerId: readString(row, 'customer_id'),
      siteId: readString(row, 'site_id'),
      assetId: readNullableString(row, 'asset_id'),
      title: readString(row, 'title'),
      description: readString(row, 'description'),
      priority: readString(row, 'priority') as Priority,
      status: readString(row, 'status') as WorkOrderStatus,
      slaDueAt: readDate(row, 'sla_due_at'),
      scheduledStart: readNullableDate(row, 'scheduled_start'),
      scheduledEnd: readNullableDate(row, 'scheduled_end'),
      technicianId: readNullableString(row, 'technician_id'),
      createdBy: readString(row, 'created_by'),
      version: readNumber(row, 'version'),
      cancelReason: readNullableString(row, 'cancel_reason'),
      completedAt: readNullableDate(row, 'completed_at'),
      createdAt: readDate(row, 'created_at'),
      updatedAt: readDate(row, 'updated_at'),
    };
  }
}
