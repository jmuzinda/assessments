import type { SequenceStore, UnitOfWork } from '../../../shared/application/ports';
import type { Principal } from '../../../shared/auth/principal';
import type { Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { IdGenerator } from '../../../shared/kernel/id';
import type { Page } from '../../../shared/kernel/pagination';
import { formatInvoiceNumber } from '../../../shared/kernel/references';
import type { ActivityRecorder } from '../../activity/application/activity-recorder';
import type { InventoryStore } from '../../inventory/application/ports';
import type { WorkOrderStore } from '../../work-orders/application/ports';
import { applyPayment, assertCanIssue, assertCanVoid, buildInvoiceTotals, invoiceDueAt } from '../domain/invoice-calculator';
import type { Invoice, InvoiceDetail, InvoiceStatus, Payment, PaymentMethod } from '../domain/types';
import type { BillingStore } from './ports';

export class BillingService {
  constructor(
    private readonly billing: BillingStore,
    private readonly workOrders: WorkOrderStore,
    private readonly inventory: InventoryStore,
    private readonly sequences: SequenceStore,
    private readonly activity: ActivityRecorder,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly config: { taxRateBps: number; invoiceDueDays: number },
  ) {}

  draftFromWorkOrder(principal: Principal, workOrderId: string): InvoiceDetail {
    return this.unitOfWork.run(() => {
      const workOrder = this.workOrders.findById(principal.organizationId, workOrderId);
      if (!workOrder) {
        throw Errors.notFound('Work order');
      }
      if (workOrder.status !== 'completed') {
        throw Errors.invalidState('Only completed work orders can be invoiced');
      }
      if (this.billing.findActiveByWorkOrder(principal.organizationId, workOrder.id)) {
        throw Errors.conflict('This work order already has an open invoice');
      }
      const timeEntries = this.workOrders.listTimeEntries(principal.organizationId, workOrder.id);
      const usages = this.inventory.listUsages(principal.organizationId, workOrder.id);
      const totals = buildInvoiceTotals({
        taxRateBps: this.config.taxRateBps,
        labor: timeEntries.map((entry) => ({
          minutes: entry.minutes,
          hourlyRateCents: entry.hourlyRateCents,
          description: `Labor ${entry.minutes} min`,
        })),
        parts: usages.map((usage) => {
          const part = this.inventory.findPart(principal.organizationId, usage.partId);
          return {
            quantity: usage.quantity,
            unitPriceCents: usage.unitPriceCents,
            description: part ? `${part.sku} ${part.name}` : usage.partId,
          };
        }),
      });
      const now = this.clock.now();
      const invoice: Invoice = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        customerId: workOrder.customerId,
        workOrderId: workOrder.id,
        number: this.sequences.next(principal.organizationId, 'invoice'),
        status: 'draft',
        currency: 'USD',
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        amountPaidCents: 0,
        taxRateBps: this.config.taxRateBps,
        issuedAt: null,
        dueAt: null,
        createdAt: now,
      };
      const lines = totals.lines.map((line) => ({ ...line, id: this.ids.next(), invoiceId: invoice.id }));
      this.billing.insertInvoice(invoice, lines);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'invoice.created',
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: 'invoice.created',
        payload: { invoiceId: invoice.id, number: formatInvoiceNumber(invoice.number), workOrderId: workOrder.id },
      });
      return { ...invoice, lines, payments: [] };
    });
  }

  get(principal: Principal, id: string): InvoiceDetail {
    const invoice = this.billing.detail(principal.organizationId, id);
    if (!invoice) {
      throw Errors.notFound('Invoice');
    }
    return invoice;
  }

  list(
    principal: Principal,
    filter: { limit: number; offset: number; status?: InvoiceStatus; customerId?: string },
  ): Page<Invoice> {
    const result = this.billing.listInvoices(principal.organizationId, filter);
    return { items: result.rows, total: result.total, limit: filter.limit, offset: filter.offset };
  }

  issue(principal: Principal, id: string): InvoiceDetail {
    return this.unitOfWork.run(() => {
      const invoice = this.require(principal.organizationId, id);
      assertCanIssue(invoice.status);
      const issuedAt = this.clock.now();
      const updated: Invoice = {
        ...invoice,
        status: 'issued',
        issuedAt,
        dueAt: invoiceDueAt(issuedAt, this.config.invoiceDueDays),
      };
      this.billing.updateInvoice(updated);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'invoice.issued',
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: 'invoice.issued',
        payload: {
          invoiceId: invoice.id,
          number: formatInvoiceNumber(invoice.number),
          totalCents: String(invoice.totalCents),
        },
      });
      return { ...updated, lines: this.billing.listLines(invoice.id), payments: [] };
    });
  }

  pay(principal: Principal, id: string, input: { amountCents: number; method: PaymentMethod; reference: string }): InvoiceDetail {
    return this.unitOfWork.run(() => {
      const invoice = this.require(principal.organizationId, id);
      const applied = applyPayment({
        status: invoice.status,
        totalCents: invoice.totalCents,
        amountPaidCents: invoice.amountPaidCents,
        amountCents: input.amountCents,
      });
      const payment: Payment = {
        id: this.ids.next(),
        organizationId: principal.organizationId,
        invoiceId: invoice.id,
        amountCents: input.amountCents,
        method: input.method,
        reference: input.reference.trim(),
        receivedAt: this.clock.now(),
      };
      this.billing.insertPayment(payment);
      const updated: Invoice = { ...invoice, status: applied.status, amountPaidCents: applied.amountPaidCents };
      this.billing.updateInvoice(updated);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: applied.status === 'paid' ? 'invoice.paid' : 'invoice.payment_recorded',
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: applied.status === 'paid' ? 'invoice.paid' : undefined,
        payload: {
          invoiceId: invoice.id,
          number: formatInvoiceNumber(invoice.number),
          amountCents: input.amountCents,
        },
      });
      return this.billing.detail(principal.organizationId, invoice.id) as InvoiceDetail;
    });
  }

  voidInvoice(principal: Principal, id: string): InvoiceDetail {
    return this.unitOfWork.run(() => {
      const invoice = this.require(principal.organizationId, id);
      assertCanVoid(invoice.status, invoice.amountPaidCents);
      const updated: Invoice = { ...invoice, status: 'void' };
      this.billing.updateInvoice(updated);
      this.activity.record({
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: 'invoice.voided',
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: 'invoice.voided',
        payload: { invoiceId: invoice.id, number: formatInvoiceNumber(invoice.number) },
      });
      return { ...updated, lines: this.billing.listLines(invoice.id), payments: this.billing.listPayments(invoice.id) };
    });
  }

  private require(organizationId: string, id: string): Invoice {
    const invoice = this.billing.findInvoice(organizationId, id);
    if (!invoice) {
      throw Errors.notFound('Invoice');
    }
    return invoice;
  }
}
