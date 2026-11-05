import type { PlanLimits } from '../../../config/constants';
import type { SequenceStore, UnitOfWork } from '../../../shared/application/ports';
import { assertRole } from '../../../shared/auth/permissions';
import type { Principal } from '../../../shared/auth/principal';
import { addUtcMonths, startOfUtcMonth, type Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { IdGenerator } from '../../../shared/kernel/id';
import type { Page } from '../../../shared/kernel/pagination';
import { formatWorkOrderNumber } from '../../../shared/kernel/references';
import type { ActivityRecorder } from '../../activity/application/activity-recorder';
import type { CustomerStore } from '../../customers/application/ports';
import type { OrganizationStore } from '../../identity/application/ports';
import { applyConsume, applyRelease } from '../../inventory/domain/stock-math';
import type { InventoryStore } from '../../inventory/application/ports';
import type { PartUsage, StockLevel } from '../../inventory/domain/types';
import { assertWorkOrderCapacity } from '../../tenancy/domain/plan-policy';
import type { TechnicianStore } from '../../workforce/application/ports';
import type { TechnicianProfile } from '../../workforce/domain/types';
import { assertScheduleWindow } from '../domain/schedule-policy';
import { slaDueAt } from '../domain/sla';
import { assertTransition } from '../domain/state-machine';
import type { Priority, TimeEntry, WorkOrder, WorkOrderNote, WorkOrderStatus } from '../domain/types';
import type { WorkOrderStore } from './ports';

export interface WorkOrderDetail extends WorkOrder {
  notes: WorkOrderNote[];
  timeEntries: TimeEntry[];
  partUsages: PartUsage[];
}

export class WorkOrderService {
  constructor(
    private readonly workOrders: WorkOrderStore,
    private readonly customers: CustomerStore,
    private readonly technicians: TechnicianStore,
    private readonly inventory: InventoryStore,
    private readonly organizations: OrganizationStore,
    private readonly sequences: SequenceStore,
    private readonly activity: ActivityRecorder,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly planLimits: PlanLimits,
  ) {}

  create(
    principal: Principal,
    input: {
      customerId: string;
      siteId: string;
      assetId?: string | null;
      title: string;
      description: string;
      priority: Priority;
    },
  ): WorkOrder {
    return this.unitOfWork.run(() => {
      const organization = this.organizations.findById(principal.organizationId);
      if (!organization) {
        throw Errors.notFound('Organization');
      }
      const monthStart = startOfUtcMonth(this.clock.now());
      const created = this.workOrders.countCreatedBetween(
        organization.id,
        monthStart,
        addUtcMonths(monthStart, 1),
      );
      assertWorkOrderCapacity(organization.plan, created, this.planLimits[organization.plan]);
      const customer = this.customers.findCustomer(principal.organizationId, input.customerId);
      if (!customer) {
        throw Errors.notFound('Customer');
      }
      if (customer.status !== 'active') {
        throw Errors.invalidState('Cannot open a work order for an inactive customer');
      }
      const site = this.customers.findSite(principal.organizationId, input.siteId);
      if (!site || site.customerId !== customer.id) {
        throw Errors.validation('Site does not belong to the customer');
      }
      if (input.assetId) {
        const asset = this.customers.findAsset(principal.organizationId, input.assetId);
        if (!asset || asset.siteId !== site.id) {
          throw Errors.validation('Asset does not belong to the site');
        }
        if (asset.status === 'retired') {
          throw Errors.invalidState('Cannot open a work order for a retired asset');
        }
      }
      const now = this.clock.now();
      const workOrder: WorkOrder = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        number: this.sequences.next(principal.organizationId, 'work_order'),
        customerId: customer.id,
        siteId: site.id,
        assetId: input.assetId ?? null,
        title: input.title.trim(),
        description: input.description.trim(),
        priority: input.priority,
        status: 'draft',
        slaDueAt: slaDueAt(input.priority, now),
        scheduledStart: null,
        scheduledEnd: null,
        technicianId: null,
        createdBy: principal.userId,
        version: 1,
        cancelReason: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.workOrders.insert(workOrder);
      this.record(principal, 'work_order.created', workOrder, { priority: workOrder.priority });
      return workOrder;
    });
  }

  get(principal: Principal, id: string): WorkOrderDetail {
    const workOrder = this.visible(principal, id);
    return {
      ...workOrder,
      notes: this.workOrders.listNotes(principal.organizationId, id),
      timeEntries: this.workOrders.listTimeEntries(principal.organizationId, id),
      partUsages: this.inventory.listUsages(principal.organizationId, id),
    };
  }

  list(
    principal: Principal,
    filter: {
      limit: number;
      offset: number;
      status?: WorkOrderStatus;
      priority?: Priority;
      customerId?: string;
      technicianId?: string;
      query?: string;
    },
  ): Page<WorkOrder> {
    const scoped = { ...filter };
    if (principal.role === 'technician') {
      const profile = this.technicians.findByUser(principal.organizationId, principal.userId);
      if (!profile) {
        return { items: [], total: 0, limit: filter.limit, offset: filter.offset };
      }
      scoped.technicianId = profile.id;
    }
    const result = this.workOrders.list(principal.organizationId, scoped);
    return { items: result.rows, total: result.total, limit: filter.limit, offset: filter.offset };
  }

  schedule(principal: Principal, id: string, input: { expectedVersion: number; start: Date; end: Date }): WorkOrder {
    assertScheduleWindow(input.start, input.end);
    return this.unitOfWork.run(() => {
      const current = this.editable(principal, id, input.expectedVersion, 'work_orders:dispatch');
      const next = this.transition(current, 'scheduled', {
        scheduledStart: input.start,
        scheduledEnd: input.end,
      });
      this.record(principal, 'work_order.scheduled', next, {
        scheduledStart: input.start.toISOString(),
        scheduledEnd: input.end.toISOString(),
      });
      return next;
    });
  }

  dispatch(principal: Principal, id: string, input: { expectedVersion: number; technicianId: string }): WorkOrder {
    return this.unitOfWork.run(() => {
      const current = this.editable(principal, id, input.expectedVersion, 'work_orders:dispatch');
      if (!current.scheduledStart || !current.scheduledEnd) {
        throw Errors.invalidState('Work order must be scheduled before dispatch');
      }
      const technician = this.technicians.findById(principal.organizationId, input.technicianId);
      if (!technician || !technician.active) {
        throw Errors.validation('Dispatch requires an active technician');
      }
      const overlap = this.workOrders.hasTechnicianOverlap({
        organizationId: principal.organizationId,
        technicianId: technician.id,
        start: current.scheduledStart,
        end: current.scheduledEnd,
        excludingWorkOrderId: current.id,
      });
      if (overlap) {
        throw Errors.conflict('Technician already has an overlapping assignment');
      }
      const next = this.transition(current, 'dispatched', { technicianId: technician.id });
      this.record(principal, 'work_order.dispatched', next, {
        technicianId: technician.id,
        technicianUserId: technician.userId,
        title: next.title,
      });
      return next;
    });
  }

  start(principal: Principal, id: string, expectedVersion: number): WorkOrder {
    return this.transitionAssigned(principal, id, expectedVersion, 'in_progress', 'work_order.started');
  }

  hold(principal: Principal, id: string, input: { expectedVersion: number; reason: string }): WorkOrder {
    return this.unitOfWork.run(() => {
      const current = this.forExecution(principal, id, input.expectedVersion);
      const next = this.transition(current, 'on_hold', {});
      this.addSystemNote(principal, next.id, `On hold: ${input.reason.trim()}`);
      this.record(principal, 'work_order.held', next, { reason: input.reason.trim() });
      return next;
    });
  }

  resume(principal: Principal, id: string, expectedVersion: number): WorkOrder {
    return this.transitionAssigned(principal, id, expectedVersion, 'in_progress', 'work_order.resumed');
  }

  complete(principal: Principal, id: string, expectedVersion: number): WorkOrder {
    return this.unitOfWork.run(() => {
      const current = this.forExecution(principal, id, expectedVersion);
      const next = this.transition(current, 'completed', { completedAt: this.clock.now() });
      this.record(principal, 'work_order.completed', next, { title: next.title });
      return next;
    });
  }

  cancel(principal: Principal, id: string, input: { expectedVersion: number; reason: string }): WorkOrder {
    return this.unitOfWork.run(() => {
      const current = this.editable(principal, id, input.expectedVersion, 'work_orders:dispatch');
      for (const reservation of this.inventory.listActiveReservations(principal.organizationId, current.id)) {
        const level = this.level(principal.organizationId, reservation.partId, reservation.locationId);
        this.inventory.saveLevel(applyRelease(level, reservation.quantity));
        this.inventory.saveReservation({ ...reservation, status: 'released' });
        this.inventory.insertMovement({
          id: this.ids.next(),
          organizationId: principal.organizationId,
          partId: reservation.partId,
          locationId: reservation.locationId,
          type: 'release',
          quantity: reservation.quantity,
          referenceType: 'work_order',
          referenceId: current.id,
          createdBy: principal.userId,
          createdAt: this.clock.now(),
        });
      }
      const next = this.transition(current, 'cancelled', { cancelReason: input.reason.trim() });
      this.record(principal, 'work_order.cancelled', next, { reason: input.reason.trim() });
      return next;
    });
  }

  addNote(principal: Principal, id: string, body: string): WorkOrderNote {
    return this.unitOfWork.run(() => {
      const workOrder = this.visible(principal, id);
      if (principal.role === 'technician') {
        this.assertAssigned(principal, workOrder);
      } else {
        assertRole(principal.role, 'work_orders:write');
      }
      const note = this.addSystemNote(principal, workOrder.id, body.trim());
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'work_order.note_added',
        entityType: 'work_order',
        entityId: workOrder.id,
      });
      return note;
    });
  }

  addTimeEntry(
    principal: Principal,
    id: string,
    input: { startedAt: Date; endedAt: Date; notes: string },
  ): TimeEntry {
    const minutes = Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60_000);
    if (minutes <= 0 || minutes > 12 * 60) {
      throw Errors.validation('Time entries must be between 1 minute and 12 hours');
    }
    return this.unitOfWork.run(() => {
      const workOrder = this.forExecution(principal, id);
      if (workOrder.status !== 'in_progress' && workOrder.status !== 'on_hold') {
        throw Errors.invalidState('Time can only be logged while the work order is in progress or on hold');
      }
      const technician = this.requireAssignedTechnician(workOrder);
      const entry: TimeEntry = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        workOrderId: workOrder.id,
        technicianId: technician.id,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        minutes,
        hourlyRateCents: technician.hourlyRateCents,
        notes: input.notes.trim(),
        createdAt: this.clock.now(),
      };
      this.workOrders.insertTimeEntry(entry);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'work_order.time_logged',
        entityType: 'work_order',
        entityId: workOrder.id,
        metadata: { minutes, hourlyRateCents: technician.hourlyRateCents },
      });
      return entry;
    });
  }

  consumePart(
    principal: Principal,
    id: string,
    input: { partId: string; locationId: string; quantity: number },
  ): PartUsage {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw Errors.validation('quantity must be a positive integer');
    }
    return this.unitOfWork.run(() => {
      const workOrder = this.forExecution(principal, id);
      if (workOrder.status !== 'in_progress') {
        throw Errors.invalidState('Parts can only be consumed while the work order is in progress');
      }
      const part = this.inventory.findPart(principal.organizationId, input.partId);
      if (!part || !part.active) {
        throw Errors.notFound('Part');
      }
      const location = this.inventory.findLocation(principal.organizationId, input.locationId);
      if (!location) {
        throw Errors.notFound('Stock location');
      }
      const level = this.level(principal.organizationId, part.id, location.id);
      let next: StockLevel;
      try {
        next = applyConsume(level, input.quantity);
      } catch (error) {
        if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'INSUFFICIENT_STOCK') {
          throw Errors.insufficientStock(part.sku, level.onHand - level.reserved, input.quantity);
        }
        throw error;
      }
      this.inventory.saveLevel(next);
      this.inventory.insertMovement({
        id: this.ids.next(),
        organizationId: principal.organizationId,
        partId: part.id,
        locationId: location.id,
        type: 'consume',
        quantity: input.quantity,
        referenceType: 'work_order',
        referenceId: workOrder.id,
        createdBy: principal.userId,
        createdAt: this.clock.now(),
      });
      const usage: PartUsage = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        workOrderId: workOrder.id,
        partId: part.id,
        locationId: location.id,
        quantity: input.quantity,
        unitPriceCents: part.unitPriceCents,
        createdAt: this.clock.now(),
      };
      this.inventory.insertUsage(usage);
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
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'work_order.part_consumed',
        entityType: 'work_order',
        entityId: workOrder.id,
        metadata: { sku: part.sku, quantity: input.quantity },
      });
      return usage;
    });
  }

  private transitionAssigned(
    principal: Principal,
    id: string,
    expectedVersion: number,
    status: WorkOrderStatus,
    action: string,
  ): WorkOrder {
    return this.unitOfWork.run(() => {
      const current = this.forExecution(principal, id, expectedVersion);
      const next = this.transition(current, status, {});
      this.record(principal, action, next, { title: next.title });
      return next;
    });
  }

  private forExecution(principal: Principal, id: string, expectedVersion?: number): WorkOrder {
    const workOrder = this.visible(principal, id);
    if (expectedVersion !== undefined) {
      this.assertVersion(workOrder, expectedVersion);
    }
    assertRole(principal.role, 'work_orders:execute');
    if (principal.role === 'technician') {
      this.assertAssigned(principal, workOrder);
    }
    return workOrder;
  }

  private editable(
    principal: Principal,
    id: string,
    expectedVersion: number,
    permission: 'work_orders:dispatch',
  ): WorkOrder {
    assertRole(principal.role, permission);
    const workOrder = this.workOrders.findById(principal.organizationId, id);
    if (!workOrder) {
      throw Errors.notFound('Work order');
    }
    this.assertVersion(workOrder, expectedVersion);
    return workOrder;
  }

  private visible(principal: Principal, id: string): WorkOrder {
    assertRole(principal.role, 'work_orders:read');
    const workOrder = this.workOrders.findById(principal.organizationId, id);
    if (!workOrder) {
      throw Errors.notFound('Work order');
    }
    if (principal.role === 'technician') {
      this.assertAssigned(principal, workOrder);
    }
    return workOrder;
  }

  private assertAssigned(principal: Principal, workOrder: WorkOrder): void {
    const profile = this.technicians.findByUser(principal.organizationId, principal.userId);
    if (!profile || profile.id !== workOrder.technicianId) {
      throw Errors.forbidden('Technicians can only access work orders assigned to them');
    }
  }

  private assertVersion(workOrder: WorkOrder, expectedVersion: number): void {
    if (workOrder.version !== expectedVersion) {
      throw Errors.conflict('Work order was updated by someone else', { version: workOrder.version });
    }
  }

  private requireAssignedTechnician(workOrder: WorkOrder): TechnicianProfile {
    if (!workOrder.technicianId) {
      throw Errors.invalidState('Work order has no assigned technician');
    }
    const technician = this.technicians.findById(workOrder.organizationId, workOrder.technicianId);
    if (!technician) {
      throw Errors.notFound('Technician');
    }
    return technician;
  }

  private transition(current: WorkOrder, status: WorkOrderStatus, patch: Partial<WorkOrder>): WorkOrder {
    assertTransition(current.status, status);
    const next: WorkOrder = {
      ...current,
      ...patch,
      status,
      version: current.version + 1,
      updatedAt: this.clock.now(),
    };
    this.workOrders.update(next);
    return next;
  }

  private addSystemNote(principal: Principal, workOrderId: string, body: string): WorkOrderNote {
    const note: WorkOrderNote = {
      id: this.ids.next(),
      organizationId: principal.organizationId,
      workOrderId,
      authorId: principal.userId,
      body,
      createdAt: this.clock.now(),
    };
    this.workOrders.insertNote(note);
    return note;
  }

  private level(organizationId: string, partId: string, locationId: string): StockLevel {
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

  private record(principal: Principal, action: string, workOrder: WorkOrder, payload: Record<string, unknown>): void {
    this.activity.record({
      organizationId: principal.organizationId,
      actorId: principal.userId,
      action,
      entityType: 'work_order',
      entityId: workOrder.id,
      eventType: action,
      payload: {
        workOrderId: workOrder.id,
        number: formatWorkOrderNumber(workOrder.number),
        ...payload,
      },
    });
  }
}
