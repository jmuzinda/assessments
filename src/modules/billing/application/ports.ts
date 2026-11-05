import type { Invoice, InvoiceDetail, InvoiceLine, Payment } from '../domain/types';

export interface InvoiceListFilter {
  limit: number;
  offset: number;
  status?: Invoice['status'];
  customerId?: string;
}

export interface BillingStore {
  insertInvoice(invoice: Invoice, lines: InvoiceLine[]): void;
  updateInvoice(invoice: Invoice): void;
  findInvoice(organizationId: string, id: string): Invoice | undefined;
  findActiveByWorkOrder(organizationId: string, workOrderId: string): Invoice | undefined;
  listInvoices(organizationId: string, filter: InvoiceListFilter): { rows: Invoice[]; total: number };
  listLines(invoiceId: string): InvoiceLine[];
  insertPayment(payment: Payment): void;
  listPayments(invoiceId: string): Payment[];
  detail(organizationId: string, id: string): InvoiceDetail | undefined;
}
