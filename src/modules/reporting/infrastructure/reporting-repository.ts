import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, queryOne, readNumber, readString } from '../../../infrastructure/db/rows';
import type { LowStockRow, OperationsRaw, ReportingStore, RevenueRaw } from '../application/ports';

export class ReportingRepository implements ReportingStore {
  constructor(private readonly db: Db) {}

  operations(organizationId: string, from: Date, to: Date, now: Date): OperationsRaw {
    const counts = queryAll(
      this.db,
      `SELECT status, COUNT(*) AS count FROM work_orders WHERE organization_id = ? GROUP BY status`,
      [organizationId],
    ).map((row) => ({ status: readString(row, 'status'), count: readNumber(row, 'count') }));
    const openOverdue = this.count(
      `SELECT COUNT(*) AS count FROM work_orders
       WHERE organization_id = ? AND status NOT IN ('completed', 'cancelled') AND sla_due_at < ?`,
      [organizationId, iso(now)],
    );
    const completedInWindow = this.count(
      `SELECT COUNT(*) AS count FROM work_orders
       WHERE organization_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?`,
      [organizationId, iso(from), iso(to)],
    );
    const averageRow = queryOne(
      this.db,
      `SELECT AVG((julianday(completed_at) - julianday(created_at)) * 24 * 60) AS minutes
       FROM work_orders
       WHERE organization_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?`,
      [organizationId, iso(from), iso(to)],
    );
    const average = averageRow?.minutes;
    const completedLate = this.count(
      `SELECT COUNT(*) AS count FROM work_orders
       WHERE organization_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?
         AND completed_at > sla_due_at`,
      [organizationId, iso(from), iso(to)],
    );
    return {
      counts,
      openOverdue,
      completedInWindow,
      averageCycleMinutes: typeof average === 'number' ? Math.round(average) : null,
      completedLate,
    };
  }

  revenue(organizationId: string): RevenueRaw {
    const summary = queryOne(
      this.db,
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('issued', 'partial', 'paid') THEN 1 ELSE 0 END), 0) AS issued_count,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
         COALESCE(SUM(CASE WHEN status = 'void' THEN 1 ELSE 0 END), 0) AS void_count,
         COALESCE(SUM(CASE WHEN status IN ('issued', 'partial', 'paid') THEN total_cents ELSE 0 END), 0) AS invoiced_cents,
         COALESCE(SUM(CASE WHEN status IN ('issued', 'partial', 'paid') THEN amount_paid_cents ELSE 0 END), 0) AS collected_cents,
         COALESCE(SUM(CASE WHEN status IN ('issued', 'partial') THEN total_cents - amount_paid_cents ELSE 0 END), 0) AS outstanding_cents,
         COALESCE(SUM(CASE WHEN status IN ('issued', 'partial', 'paid') THEN tax_cents ELSE 0 END), 0) AS tax_cents
       FROM invoices WHERE organization_id = ?`,
      [organizationId],
    );
    const topCustomers = queryAll(
      this.db,
      `SELECT invoices.customer_id, customers.name,
              COALESCE(SUM(invoices.total_cents), 0) AS invoiced_cents,
              COALESCE(SUM(invoices.amount_paid_cents), 0) AS collected_cents
       FROM invoices
       JOIN customers ON customers.id = invoices.customer_id
       WHERE invoices.organization_id = ? AND invoices.status IN ('issued', 'partial', 'paid')
       GROUP BY invoices.customer_id
       ORDER BY invoiced_cents DESC
       LIMIT 5`,
      [organizationId],
    ).map((row) => ({
      customerId: readString(row, 'customer_id'),
      name: readString(row, 'name'),
      invoicedCents: readNumber(row, 'invoiced_cents'),
      collectedCents: readNumber(row, 'collected_cents'),
    }));
    return {
      issuedCount: summary ? readNumber(summary, 'issued_count') : 0,
      paidCount: summary ? readNumber(summary, 'paid_count') : 0,
      voidCount: summary ? readNumber(summary, 'void_count') : 0,
      invoicedCents: summary ? readNumber(summary, 'invoiced_cents') : 0,
      collectedCents: summary ? readNumber(summary, 'collected_cents') : 0,
      outstandingCents: summary ? readNumber(summary, 'outstanding_cents') : 0,
      taxCents: summary ? readNumber(summary, 'tax_cents') : 0,
      topCustomers,
    };
  }

  lowStock(organizationId: string): LowStockRow[] {
    return queryAll(
      this.db,
      `SELECT parts.id AS part_id, parts.sku, parts.name, parts.reorder_point,
              COALESCE(SUM(stock_levels.on_hand), 0) AS on_hand,
              COALESCE(SUM(stock_levels.reserved), 0) AS reserved
       FROM parts
       LEFT JOIN stock_levels ON stock_levels.part_id = parts.id
       WHERE parts.organization_id = ? AND parts.active = 1
       GROUP BY parts.id
       HAVING on_hand <= parts.reorder_point
       ORDER BY parts.sku`,
      [organizationId],
    ).map((row) => ({
      partId: readString(row, 'part_id'),
      sku: readString(row, 'sku'),
      name: readString(row, 'name'),
      reorderPoint: readNumber(row, 'reorder_point'),
      onHand: readNumber(row, 'on_hand'),
      reserved: readNumber(row, 'reserved'),
    }));
  }

  private count(sql: string, params: SQLInputValue[]): number {
    const row = queryOne(this.db, sql, params);
    return row ? Number(row.count) : 0;
  }
}

type SQLInputValue = import('node:sqlite').SQLInputValue;
