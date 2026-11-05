export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'void';
export type InvoiceLineKind = 'labor' | 'part';
export type PaymentMethod = 'card' | 'ach' | 'cash' | 'check';

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  customerId: string;
  workOrderId: string;
  number: number;
  status: InvoiceStatus;
  currency: 'USD';
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  taxRateBps: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
}

export interface Payment {
  id: string;
  organizationId: string;
  invoiceId: string;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  receivedAt: Date;
}

export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  payments: Payment[];
}
