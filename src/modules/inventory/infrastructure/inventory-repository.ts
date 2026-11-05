import type { Db } from '../../../infrastructure/db/connection';
import { iso, queryAll, queryOne, readBoolean, readDate, readNumber, readString } from '../../../infrastructure/db/rows';
import type { InventoryStore } from '../application/ports';
import type {
  Part,
  PartUsage,
  StockLevel,
  StockLevelView,
  StockLocation,
  StockMovement,
  StockReservation,
} from '../domain/types';

export class InventoryRepository implements InventoryStore {
  constructor(private readonly db: Db) {}

  insertPart(part: Part): void {
    this.db
      .prepare(
        `INSERT INTO parts (
           id, organization_id, sku, name, unit_cost_cents, unit_price_cents, reorder_point, active, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        part.id,
        part.organizationId,
        part.sku,
        part.name,
        part.unitCostCents,
        part.unitPriceCents,
        part.reorderPoint,
        part.active ? 1 : 0,
        iso(part.createdAt),
      );
  }

  findPart(organizationId: string, id: string): Part | undefined {
    const row = queryOne(this.db, 'SELECT * FROM parts WHERE organization_id = ? AND id = ?', [organizationId, id]);
    return row ? this.mapPart(row) : undefined;
  }

  findPartBySku(organizationId: string, sku: string): Part | undefined {
    const row = queryOne(this.db, 'SELECT * FROM parts WHERE organization_id = ? AND sku = ?', [organizationId, sku]);
    return row ? this.mapPart(row) : undefined;
  }

  listParts(organizationId: string): Part[] {
    return queryAll(this.db, 'SELECT * FROM parts WHERE organization_id = ? ORDER BY sku', [organizationId]).map((row) =>
      this.mapPart(row),
    );
  }

  insertLocation(location: StockLocation): void {
    this.db
      .prepare(
        `INSERT INTO stock_locations (id, organization_id, name, kind, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(location.id, location.organizationId, location.name, location.kind, iso(location.createdAt));
  }

  findLocation(organizationId: string, id: string): StockLocation | undefined {
    const row = queryOne(this.db, 'SELECT * FROM stock_locations WHERE organization_id = ? AND id = ?', [
      organizationId,
      id,
    ]);
    return row ? this.mapLocation(row) : undefined;
  }

  listLocations(organizationId: string): StockLocation[] {
    return queryAll(this.db, 'SELECT * FROM stock_locations WHERE organization_id = ? ORDER BY name', [
      organizationId,
    ]).map((row) => this.mapLocation(row));
  }

  getLevel(partId: string, locationId: string): StockLevel | undefined {
    const row = queryOne(this.db, 'SELECT * FROM stock_levels WHERE part_id = ? AND location_id = ?', [
      partId,
      locationId,
    ]);
    return row ? this.mapLevel(row) : undefined;
  }

  saveLevel(level: StockLevel): void {
    this.db
      .prepare(
        `INSERT INTO stock_levels (organization_id, part_id, location_id, on_hand, reserved)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(part_id, location_id) DO UPDATE SET
           on_hand = excluded.on_hand,
           reserved = excluded.reserved`,
      )
      .run(level.organizationId, level.partId, level.locationId, level.onHand, level.reserved);
  }

  totalOnHand(partId: string): number {
    const row = queryOne(this.db, 'SELECT COALESCE(SUM(on_hand), 0) AS total FROM stock_levels WHERE part_id = ?', [
      partId,
    ]);
    return row ? Number(row.total) : 0;
  }

  insertMovement(movement: StockMovement): void {
    this.db
      .prepare(
        `INSERT INTO stock_movements (
           id, organization_id, part_id, location_id, type, quantity, reference_type, reference_id, created_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        movement.id,
        movement.organizationId,
        movement.partId,
        movement.locationId,
        movement.type,
        movement.quantity,
        movement.referenceType,
        movement.referenceId,
        movement.createdBy,
        iso(movement.createdAt),
      );
  }

  listLevels(organizationId: string): StockLevelView[] {
    return queryAll(
      this.db,
      `SELECT stock_levels.*, parts.sku, parts.name AS part_name, parts.reorder_point, stock_locations.name AS location_name
       FROM stock_levels
       JOIN parts ON parts.id = stock_levels.part_id
       JOIN stock_locations ON stock_locations.id = stock_levels.location_id
       WHERE stock_levels.organization_id = ?
       ORDER BY parts.sku, stock_locations.name`,
      [organizationId],
    ).map((row) => ({
      ...this.mapLevel(row),
      sku: readString(row, 'sku'),
      partName: readString(row, 'part_name'),
      locationName: readString(row, 'location_name'),
      reorderPoint: readNumber(row, 'reorder_point'),
    }));
  }

  insertUsage(usage: PartUsage): void {
    this.db
      .prepare(
        `INSERT INTO part_usages (
           id, organization_id, work_order_id, part_id, location_id, quantity, unit_price_cents, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        usage.id,
        usage.organizationId,
        usage.workOrderId,
        usage.partId,
        usage.locationId,
        usage.quantity,
        usage.unitPriceCents,
        iso(usage.createdAt),
      );
  }

  listUsages(organizationId: string, workOrderId: string): PartUsage[] {
    return queryAll(
      this.db,
      'SELECT * FROM part_usages WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at',
      [organizationId, workOrderId],
    ).map((row) => ({
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      workOrderId: readString(row, 'work_order_id'),
      partId: readString(row, 'part_id'),
      locationId: readString(row, 'location_id'),
      quantity: readNumber(row, 'quantity'),
      unitPriceCents: readNumber(row, 'unit_price_cents'),
      createdAt: readDate(row, 'created_at'),
    }));
  }

  insertReservation(reservation: StockReservation): void {
    this.db
      .prepare(
        `INSERT INTO stock_reservations (
           id, organization_id, part_id, location_id, work_order_id, quantity, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        reservation.id,
        reservation.organizationId,
        reservation.partId,
        reservation.locationId,
        reservation.workOrderId,
        reservation.quantity,
        reservation.status,
        iso(reservation.createdAt),
      );
  }

  findReservation(organizationId: string, id: string): StockReservation | undefined {
    const row = queryOne(this.db, 'SELECT * FROM stock_reservations WHERE organization_id = ? AND id = ?', [
      organizationId,
      id,
    ]);
    return row ? this.mapReservation(row) : undefined;
  }

  saveReservation(reservation: StockReservation): void {
    this.db
      .prepare('UPDATE stock_reservations SET status = ? WHERE id = ? AND organization_id = ?')
      .run(reservation.status, reservation.id, reservation.organizationId);
  }

  listReservations(organizationId: string, workOrderId?: string): StockReservation[] {
    if (workOrderId) {
      return queryAll(
        this.db,
        'SELECT * FROM stock_reservations WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at',
        [organizationId, workOrderId],
      ).map((row) => this.mapReservation(row));
    }
    return queryAll(
      this.db,
      'SELECT * FROM stock_reservations WHERE organization_id = ? ORDER BY created_at DESC',
      [organizationId],
    ).map((row) => this.mapReservation(row));
  }

  listActiveReservations(organizationId: string, workOrderId: string): StockReservation[] {
    return queryAll(
      this.db,
      `SELECT * FROM stock_reservations
       WHERE organization_id = ? AND work_order_id = ? AND status = 'active'
       ORDER BY created_at`,
      [organizationId, workOrderId],
    ).map((row) => this.mapReservation(row));
  }

  private mapPart(row: Record<string, unknown>): Part {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      sku: readString(row, 'sku'),
      name: readString(row, 'name'),
      unitCostCents: readNumber(row, 'unit_cost_cents'),
      unitPriceCents: readNumber(row, 'unit_price_cents'),
      reorderPoint: readNumber(row, 'reorder_point'),
      active: readBoolean(row, 'active'),
      createdAt: readDate(row, 'created_at'),
    };
  }

  private mapLocation(row: Record<string, unknown>): StockLocation {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      name: readString(row, 'name'),
      kind: readString(row, 'kind') as StockLocation['kind'],
      createdAt: readDate(row, 'created_at'),
    };
  }

  private mapLevel(row: Record<string, unknown>): StockLevel {
    return {
      organizationId: readString(row, 'organization_id'),
      partId: readString(row, 'part_id'),
      locationId: readString(row, 'location_id'),
      onHand: readNumber(row, 'on_hand'),
      reserved: readNumber(row, 'reserved'),
    };
  }

  private mapReservation(row: Record<string, unknown>): StockReservation {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      partId: readString(row, 'part_id'),
      locationId: readString(row, 'location_id'),
      workOrderId: readString(row, 'work_order_id'),
      quantity: readNumber(row, 'quantity'),
      status: readString(row, 'status') as StockReservation['status'],
      createdAt: readDate(row, 'created_at'),
    };
  }
}
