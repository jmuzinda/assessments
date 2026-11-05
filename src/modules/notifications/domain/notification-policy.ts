import type { DomainEvent } from '../../../shared/kernel/domain-event';

export interface Notification {
  id: string;
  organizationId: string;
  recipientUserId: string | null;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationDraft {
  id: string;
  organizationId: string;
  recipientUserId: string | null;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

export function notificationFromEvent(event: DomainEvent): NotificationDraft | null {
  const payload = event.payload;
  const text = (key: string): string => (typeof payload[key] === 'string' ? (payload[key] as string) : '');
  switch (event.type) {
    case 'work_order.dispatched':
      return {
        id: event.id,
        organizationId: event.organizationId,
        recipientUserId: text('technicianUserId') || null,
        type: event.type,
        title: `Dispatched ${text('number')}`,
        body: text('title'),
        entityType: 'work_order',
        entityId: text('workOrderId') || null,
        createdAt: event.createdAt,
      };
    case 'work_order.completed':
      return {
        id: event.id,
        organizationId: event.organizationId,
        recipientUserId: null,
        type: event.type,
        title: `Completed ${text('number')}`,
        body: text('title'),
        entityType: 'work_order',
        entityId: text('workOrderId') || null,
        createdAt: event.createdAt,
      };
    case 'inventory.low_stock':
      return {
        id: event.id,
        organizationId: event.organizationId,
        recipientUserId: null,
        type: event.type,
        title: `Low stock ${text('sku')}`,
        body: `${text('name')} is at or below its reorder point`,
        entityType: 'part',
        entityId: text('partId') || null,
        createdAt: event.createdAt,
      };
    case 'invoice.issued':
      return {
        id: event.id,
        organizationId: event.organizationId,
        recipientUserId: null,
        type: event.type,
        title: `Invoice ${text('number')} issued`,
        body: `Total ${text('totalCents')} cents`,
        entityType: 'invoice',
        entityId: text('invoiceId') || null,
        createdAt: event.createdAt,
      };
    case 'invoice.paid':
      return {
        id: event.id,
        organizationId: event.organizationId,
        recipientUserId: null,
        type: event.type,
        title: `Invoice ${text('number')} paid`,
        body: 'The invoice has been paid in full',
        entityType: 'invoice',
        entityId: text('invoiceId') || null,
        createdAt: event.createdAt,
      };
    default:
      return null;
  }
}
