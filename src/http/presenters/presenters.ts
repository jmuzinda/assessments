import type { Membership } from '../../modules/identity/domain/types';
import type { PublicUser } from '../../modules/identity/domain/types';
import type { Asset, Customer, Site } from '../../modules/customers/domain/types';
import type { TechnicianProfile, TechnicianView } from '../../modules/workforce/domain/types';
import type { TimeEntry, WorkOrder, WorkOrderNote } from '../../modules/work-orders/domain/types';
import type { WorkOrderDetail } from '../../modules/work-orders/application/work-order-service';
import type { Part, PartUsage, StockLevel, StockLevelView, StockLocation, StockReservation } from '../../modules/inventory/domain/types';
import type { Invoice, InvoiceDetail, InvoiceLine, Payment } from '../../modules/billing/domain/types';
import type { Notification } from '../../modules/notifications/domain/notification-policy';
import type { AuditEntry } from '../../shared/kernel/domain-event';
import type { Page } from '../../shared/kernel/pagination';
import { formatInvoiceNumber, formatWorkOrderNumber } from '../../shared/kernel/references';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function presentUser(user: PublicUser) {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

export function presentMembership(membership: Membership) {
  return { ...membership, createdAt: membership.createdAt.toISOString() };
}

export function presentCustomer(customer: Customer) {
  return { ...customer, createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString() };
}

export function presentSite(site: Site) {
  return { ...site, createdAt: site.createdAt.toISOString() };
}

export function presentAsset(asset: Asset) {
  return { ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString() };
}

export function presentTechnician(profile: TechnicianProfile | TechnicianView) {
  return { ...profile, createdAt: profile.createdAt.toISOString() };
}

export function presentWorkOrder(workOrder: WorkOrder) {
  return {
    ...workOrder,
    number: formatWorkOrderNumber(workOrder.number),
    sequence: workOrder.number,
    slaDueAt: workOrder.slaDueAt.toISOString(),
    scheduledStart: iso(workOrder.scheduledStart),
    scheduledEnd: iso(workOrder.scheduledEnd),
    completedAt: iso(workOrder.completedAt),
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString(),
  };
}

export function presentNote(note: WorkOrderNote) {
  return { ...note, createdAt: note.createdAt.toISOString() };
}

export function presentTimeEntry(entry: TimeEntry) {
  return {
    ...entry,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt.toISOString(),
    createdAt: entry.createdAt.toISOString(),
  };
}

export function presentUsage(usage: PartUsage) {
  return { ...usage, createdAt: usage.createdAt.toISOString() };
}

export function presentWorkOrderDetail(detail: WorkOrderDetail) {
  return {
    ...presentWorkOrder(detail),
    notes: detail.notes.map(presentNote),
    timeEntries: detail.timeEntries.map(presentTimeEntry),
    partUsages: detail.partUsages.map(presentUsage),
  };
}

export function presentPart(part: Part) {
  return { ...part, createdAt: part.createdAt.toISOString() };
}

export function presentLocation(location: StockLocation) {
  return { ...location, createdAt: location.createdAt.toISOString() };
}

export function presentLevel(level: StockLevel | StockLevelView) {
  return level;
}

export function presentReservation(reservation: StockReservation) {
  return { ...reservation, createdAt: reservation.createdAt.toISOString() };
}

export function presentInvoice(invoice: Invoice) {
  return {
    ...invoice,
    number: formatInvoiceNumber(invoice.number),
    sequence: invoice.number,
    issuedAt: iso(invoice.issuedAt),
    dueAt: iso(invoice.dueAt),
    createdAt: invoice.createdAt.toISOString(),
  };
}

export function presentLine(line: InvoiceLine) {
  return line;
}

export function presentPayment(payment: Payment) {
  return { ...payment, receivedAt: payment.receivedAt.toISOString() };
}

export function presentInvoiceDetail(invoice: InvoiceDetail) {
  return {
    ...presentInvoice(invoice),
    lines: invoice.lines.map(presentLine),
    payments: invoice.payments.map(presentPayment),
  };
}

export function presentNotification(notification: Notification) {
  return {
    ...notification,
    readAt: iso(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  };
}

export function presentAudit(entry: AuditEntry) {
  return { ...entry, createdAt: entry.createdAt.toISOString() };
}

export function presentPage<T, U>(page: Page<T>, map: (item: T) => U) {
  return {
    data: page.items.map(map),
    page: { limit: page.limit, offset: page.offset, total: page.total },
  };
}
