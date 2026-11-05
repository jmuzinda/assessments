import type { UnitOfWork } from '../../../shared/application/ports';
import type { Principal } from '../../../shared/auth/principal';
import type { Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { IdGenerator } from '../../../shared/kernel/id';
import { assertNonNegativeInt, assertPositiveInt } from '../../../shared/kernel/money';
import type { ActivityRecorder } from '../../activity/application/activity-recorder';
import type { WorkOrderStore } from '../../work-orders/application/ports';
import { AppError } from '../../../shared/kernel/errors';
import { applyAdjust, applyReceive, applyRelease, applyReserve } from '../domain/stock-math';
import type { Part, StockLevel, StockLevelView, StockLocation, StockReservation } from '../domain/types';
import type { InventoryStore } from './ports';

export class InventoryService {
  constructor(
    private readonly inventory: InventoryStore,
    private readonly workOrders: WorkOrderStore,
    private readonly activity: ActivityRecorder,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  createPart(
    principal: Principal,
    input: { sku: string; name: string; unitCostCents: number; unitPriceCents: number; reorderPoint: number },
  ): Part {
    assertNonNegativeInt(input.unitCostCents, 'unitCostCents');
    assertNonNegativeInt(input.unitPriceCents, 'unitPriceCents');
    assertNonNegativeInt(input.reorderPoint, 'reorderPoint');
    const sku = input.sku.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,32}$/.test(sku)) {
      throw Errors.validation('SKU must be 2-32 characters of letters, numbers, or hyphens');
    }
    return this.unitOfWork.run(() => {
      if (this.inventory.findPartBySku(principal.organizationId, sku)) {
        throw Errors.conflict(`SKU ${sku} already exists`);
      }
      const part: Part = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        sku,
        name: input.name.trim(),
        unitCostCents: input.unitCostCents,
        unitPriceCents: input.unitPriceCents,
        reorderPoint: input.reorderPoint,
        active: true,
        createdAt: this.clock.now(),
      };
      this.inventory.insertPart(part);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'part.created',
        entityType: 'part',
        entityId: part.id,
        metadata: { sku },
      });
      return part;
    });
  }

  listParts(principal: Principal): Part[] {
    return this.inventory.listParts(principal.organizationId);
  }

  createLocation(principal: Principal, input: { name: string; kind: 'warehouse' | 'van' }): StockLocation {
    return this.unitOfWork.run(() => {
      const location: StockLocation = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        name: input.name.trim(),
        kind: input.kind,
        createdAt: this.clock.now(),
      };
      this.inventory.insertLocation(location);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'location.created',
        entityType: 'stock_location',
        entityId: location.id,
        metadata: { kind: location.kind },
      });
      return location;
    });
  }

  listLocations(principal: Principal): StockLocation[] {
    return this.inventory.listLocations(principal.organizationId);
  }

  listLevels(principal: Principal): StockLevelView[] {
    return this.inventory.listLevels(principal.organizationId);
  }

  receive(principal: Principal, input: { partId: string; locationId: string; quantity: number }): StockLevel {
    assertPositiveInt(input.quantity, 'quantity');
    return this.unitOfWork.run(() => {
      const part = this.requirePart(principal.organizationId, input.partId);
      this.requireLocation(principal.organizationId, input.locationId);
      const current = this.levelOrZero(principal.organizationId, part.id, input.locationId);
      const next = applyReceive(current, input.quantity);
      this.inventory.saveLevel(next);
      this.movement(principal, part.id, input.locationId, 'receive', input.quantity, null, null);
      this.recordLowStock(principal, part);
      return next;
    });
  }

  adjust(principal: Principal, input: { partId: string; locationId: string; delta: number }): StockLevel {
    return this.unitOfWork.run(() => {
      const part = this.requirePart(principal.organizationId, input.partId);
      this.requireLocation(principal.organizationId, input.locationId);
      const current = this.levelOrZero(principal.organizationId, part.id, input.locationId);
      const next = applyAdjust(current, input.delta);
      this.inventory.saveLevel(next);
      this.movement(principal, part.id, input.locationId, 'adjust', input.delta, null, null);
      this.recordLowStock(principal, part);
      return next;
    });
  }

  reserve(
    principal: Principal,
    input: { partId: string; locationId: string; workOrderId: string; quantity: number },
  ): StockReservation {
    assertPositiveInt(input.quantity, 'quantity');
    return this.unitOfWork.run(() => {
      const workOrder = this.workOrders.findById(principal.organizationId, input.workOrderId);
      if (!workOrder) {
        throw Errors.notFound('Work order');
      }
      if (workOrder.status === 'cancelled' || workOrder.status === 'completed') {
        throw Errors.invalidState('Stock cannot be reserved for a closed work order');
      }
      const part = this.requirePart(principal.organizationId, input.partId);
      this.requireLocation(principal.organizationId, input.locationId);
      const current = this.levelOrZero(principal.organizationId, part.id, input.locationId);
      let next;
      try {
        next = applyReserve(current, input.quantity);
      } catch (error) {
        if (error instanceof AppError && error.code === 'INSUFFICIENT_STOCK') {
          throw Errors.insufficientStock(part.sku, current.onHand - current.reserved, input.quantity);
        }
        throw error;
      }
      this.inventory.saveLevel(next);
      const reservation: StockReservation = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        partId: part.id,
        locationId: input.locationId,
        workOrderId: input.workOrderId,
        quantity: input.quantity,
        status: 'active',
        createdAt: this.clock.now(),
      };
      this.inventory.insertReservation(reservation);
      this.movement(principal, part.id, input.locationId, 'reserve', input.quantity, 'work_order', input.workOrderId);
      return reservation;
    });
  }

  release(principal: Principal, reservationId: string): StockReservation {
    return this.unitOfWork.run(() => this.releaseReservation(principal, reservationId));
  }

  listReservations(principal: Principal, workOrderId?: string): StockReservation[] {
    return this.inventory.listReservations(principal.organizationId, workOrderId);
  }

  releaseReservation(principal: Principal, reservationId: string): StockReservation {
    const reservation = this.inventory.findReservation(principal.organizationId, reservationId);
    if (!reservation) {
      throw Errors.notFound('Reservation');
    }
    if (reservation.status !== 'active') {
      throw Errors.invalidState('Only active reservations can be released');
    }
    const current = this.levelOrZero(principal.organizationId, reservation.partId, reservation.locationId);
    const next = applyRelease(current, reservation.quantity);
    this.inventory.saveLevel(next);
    const updated = { ...reservation, status: 'released' as const };
    this.inventory.saveReservation(updated);
    this.movement(
      principal,
      reservation.partId,
      reservation.locationId,
      'release',
      reservation.quantity,
      'work_order',
      reservation.workOrderId,
    );
    return updated;
  }

  private requirePart(organizationId: string, id: string): Part {
    const part = this.inventory.findPart(organizationId, id);
    if (!part || !part.active) {
      throw Errors.notFound('Part');
    }
    return part;
  }

  private requireLocation(organizationId: string, id: string): StockLocation {
    const location = this.inventory.findLocation(organizationId, id);
    if (!location) {
      throw Errors.notFound('Stock location');
    }
    return location;
  }

  private levelOrZero(organizationId: string, partId: string, locationId: string): StockLevel {
    return (
      this.inventory.getLevel(partId, locationId) ?? {
        organizationId,
        partId,
        locationId,
        onHand: 0,
        reserved: 0,
      }
    );
  }

  private movement(
    principal: Principal,
    partId: string,
    locationId: string,
    type: 'receive' | 'adjust' | 'reserve' | 'release' | 'consume',
    quantity: number,
    referenceType: string | null,
    referenceId: string | null,
  ): void {
    this.inventory.insertMovement({
      id: this.ids.next(),
      organizationId: principal.organizationId,
      partId,
      locationId,
      type,
      quantity,
      referenceType,
      referenceId,
      createdBy: principal.userId,
      createdAt: this.clock.now(),
    });
  }

  private recordLowStock(principal: Principal, part: Part): void {
    const onHand = this.inventory.totalOnHand(part.id);
    if (onHand <= part.reorderPoint) {
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'inventory.low_stock',
        entityType: 'part',
        entityId: part.id,
        eventType: 'inventory.low_stock',
        payload: { partId: part.id, sku: part.sku, name: part.name, onHand },
      });
    }
  }
}
