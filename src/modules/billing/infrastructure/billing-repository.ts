import type { SQLInputValue } from 'node:sqlite';
import type { Db } from '../../../infrastructure/db/connection';
import {
  iso,
  queryAll,
  queryOne,
  readDate,
  readNullableDate,
  readNumber,
  readString,
} from '../../../infrastructure/db/rows';
import type { BillingStore, InvoiceListFilter } from '../application/ports';
import type { Invoice, InvoiceDetail, InvoiceLine, InvoiceStatus, Payment, PaymentMethod } from '../domain/types';

export class BillingRepository implements BillingStore {
  constructor(private readonly db: Db) {}

  insertInvoice(invoice: Invoice, lines: InvoiceLine[]): void {
    this.db
      .prepare(
        `INSERT INTO invoices (
           id, organization_id, customer_id, work_order_id, number, status, currency,
           subtotal_cents, tax_cents, total_cents, amount_paid_cents, tax_rate_bps,
           issued_at, due_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        invoice.id,
        invoice.organizationId,
        invoice.customerId,
        invoice.workOrderId,
        invoice.number,
        invoice.status,
        invoice.currency,
        invoice.subtotalCents,
        invoice.taxCents,
        invoice.totalCents,
        invoice.amountPaidCents,
        invoice.taxRateBps,
        invoice.issuedAt ? iso(invoice.issuedAt) : null,
        invoice.dueAt ? iso(invoice.dueAt) : null,
        iso(invoice.createdAt),
      );
    const insertLine = this.db.prepare(
      `INSERT INTO invoice_lines (id, invoice_id, kind, description, quantity, unit_price_cents, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of lines) {
      insertLine.run(line.id, line.invoiceId, line.kind, line.description, line.quantity, line.unitPriceCents, line.amountCents);
    }
  }

  updateInvoice(invoice: Invoice): void {
    this.db
      .prepare(
        `UPDATE invoices
         SET status = ?, amount_paid_cents = ?, issued_at = ?, due_at = ?
         WHERE id = ? AND organization_id = ?`,
      )
      .run(
        invoice.status,
        invoice.amountPaidCents,
        invoice.issuedAt ? iso(invoice.issuedAt) : null,
        invoice.dueAt ? iso(invoice.dueAt) : null,
        invoice.id,
        invoice.organizationId,
      );
  }

  findInvoice(organizationId: string, id: string): Invoice | undefined {
    const row = queryOne(this.db, 'SELECT * FROM invoices WHERE organization_id = ? AND id = ?', [organizationId, id]);
    return row ? this.mapInvoice(row) : undefined;
  }

  findActiveByWorkOrder(organizationId: string, workOrderId: string): Invoice | undefined {
    const row = queryOne(
      this.db,
      `SELECT * FROM invoices
       WHERE organization_id = ? AND work_order_id = ? AND status != 'void'`,
      [organizationId, workOrderId],
    );
    return row ? this.mapInvoice(row) : undefined;
  }

  listInvoices(organizationId: string, filter: InvoiceListFilter): { rows: Invoice[]; total: number } {
    const where = ['organization_id = ?'];
    const params: SQLInputValue[] = [organizationId];
    if (filter.status) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.customerId) {
      where.push('customer_id = ?');
      params.push(filter.customerId);
    }
    const clause = where.join(' AND ');
    const totalRow = queryOne(this.db, `SELECT COUNT(*) AS count FROM invoices WHERE ${clause}`, params);
    const rows = queryAll(
      this.db,
      `SELECT * FROM invoices WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset],
    ).map((row) => this.mapInvoice(row));
    return { rows, total: totalRow ? Number(totalRow.count) : 0 };
  }

  listLines(invoiceId: string): InvoiceLine[] {
    return queryAll(this.db, 'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY rowid', [invoiceId]).map((row) =>
      this.mapLine(row),
    );
  }

  insertPayment(payment: Payment): void {
    this.db
      .prepare(
        `INSERT INTO payments (id, organization_id, invoice_id, amount_cents, method, reference, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        payment.id,
        payment.organizationId,
        payment.invoiceId,
        payment.amountCents,
        payment.method,
        payment.reference,
        iso(payment.receivedAt),
      );
  }

  listPayments(invoiceId: string): Payment[] {
    return queryAll(this.db, 'SELECT * FROM payments WHERE invoice_id = ? ORDER BY received_at', [invoiceId]).map(
      (row) => this.mapPayment(row),
    );
  }

  detail(organizationId: string, id: string): InvoiceDetail | undefined {
    const invoice = this.findInvoice(organizationId, id);
    if (!invoice) {
      return undefined;
    }
    return {
      ...invoice,
      lines: this.listLines(invoice.id),
      payments: this.listPayments(invoice.id),
    };
  }

  private mapInvoice(row: Record<string, unknown>): Invoice {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      customerId: readString(row, 'customer_id'),
      workOrderId: readString(row, 'work_order_id'),
      number: readNumber(row, 'number'),
      status: readString(row, 'status') as InvoiceStatus,
      currency: 'USD',
      subtotalCents: readNumber(row, 'subtotal_cents'),
      taxCents: readNumber(row, 'tax_cents'),
      totalCents: readNumber(row, 'total_cents'),
      amountPaidCents: readNumber(row, 'amount_paid_cents'),
      taxRateBps: readNumber(row, 'tax_rate_bps'),
      issuedAt: readNullableDate(row, 'issued_at'),
      dueAt: readNullableDate(row, 'due_at'),
      createdAt: readDate(row, 'created_at'),
    };
  }

  private mapLine(row: Record<string, unknown>): InvoiceLine {
    return {
      id: readString(row, 'id'),
      invoiceId: readString(row, 'invoice_id'),
      kind: readString(row, 'kind') as InvoiceLine['kind'],
      description: readString(row, 'description'),
      quantity: readNumber(row, 'quantity'),
      unitPriceCents: readNumber(row, 'unit_price_cents'),
      amountCents: readNumber(row, 'amount_cents'),
    };
  }

  private mapPayment(row: Record<string, unknown>): Payment {
    return {
      id: readString(row, 'id'),
      organizationId: readString(row, 'organization_id'),
      invoiceId: readString(row, 'invoice_id'),
      amountCents: readNumber(row, 'amount_cents'),
      method: readString(row, 'method') as PaymentMethod,
      reference: readString(row, 'reference'),
      receivedAt: readDate(row, 'received_at'),
    };
  }
}
