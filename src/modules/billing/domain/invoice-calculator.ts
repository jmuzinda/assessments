import { addDays } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import { laborAmountCents, lineAmountCents, taxCents } from '../../../shared/kernel/money';
import type { InvoiceLine, InvoiceStatus } from './types';

export interface LaborCharge {
  minutes: number;
  hourlyRateCents: number;
  description: string;
}

export interface PartCharge {
  quantity: number;
  unitPriceCents: number;
  description: string;
}

export interface InvoiceTotals {
  lines: Array<Omit<InvoiceLine, 'id' | 'invoiceId'>>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export function buildInvoiceTotals(input: {
  labor: LaborCharge[];
  parts: PartCharge[];
  taxRateBps: number;
}): InvoiceTotals {
  const lines: InvoiceTotals['lines'] = [
    ...input.labor.map((line) => {
      const amountCents = laborAmountCents(line.minutes, line.hourlyRateCents);
      return {
        kind: 'labor' as const,
        description: line.description,
        quantity: line.minutes,
        unitPriceCents: line.hourlyRateCents,
        amountCents,
      };
    }),
    ...input.parts.map((line) => ({
      kind: 'part' as const,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      amountCents: lineAmountCents(line.quantity, line.unitPriceCents),
    })),
  ];
  if (lines.length === 0) {
    throw Errors.validation('A work order needs time or parts before it can be invoiced');
  }
  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const tax = taxCents(subtotalCents, input.taxRateBps);
  return {
    lines,
    subtotalCents,
    taxCents: tax,
    totalCents: subtotalCents + tax,
  };
}

export function invoiceDueAt(issuedAt: Date, dueDays: number): Date {
  return addDays(issuedAt, dueDays);
}

export function assertCanIssue(status: InvoiceStatus): void {
  if (status !== 'draft') {
    throw Errors.invalidState('Only draft invoices can be issued');
  }
}

export function assertCanVoid(status: InvoiceStatus, amountPaidCents: number): void {
  if (status !== 'draft' && status !== 'issued') {
    throw Errors.invalidState('Only draft or unpaid issued invoices can be voided');
  }
  if (amountPaidCents > 0) {
    throw Errors.invalidState('Invoices with payments cannot be voided');
  }
}

export function applyPayment(input: {
  status: InvoiceStatus;
  totalCents: number;
  amountPaidCents: number;
  amountCents: number;
}): { status: InvoiceStatus; amountPaidCents: number } {
  if (input.status !== 'issued' && input.status !== 'partial') {
    throw Errors.invalidState('Payments can only be recorded against issued invoices');
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw Errors.validation('Payment amount must be a positive integer of cents');
  }
  const balance = input.totalCents - input.amountPaidCents;
  if (input.amountCents > balance) {
    throw Errors.validation('Payment exceeds the outstanding balance', { balanceCents: balance });
  }
  const amountPaidCents = input.amountPaidCents + input.amountCents;
  return {
    amountPaidCents,
    status: amountPaidCents === input.totalCents ? 'paid' : 'partial',
  };
}
