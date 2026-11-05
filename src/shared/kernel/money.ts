import { Errors } from './errors';

export function assertPositiveInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw Errors.validation(`${field} must be a positive integer`);
  }
}

export function assertNonNegativeInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw Errors.validation(`${field} must be a non-negative integer`);
  }
}

export function lineAmountCents(quantity: number, unitPriceCents: number): number {
  assertPositiveInt(quantity, 'quantity');
  assertNonNegativeInt(unitPriceCents, 'unitPriceCents');
  return quantity * unitPriceCents;
}

export function taxCents(subtotalCents: number, taxRateBps: number): number {
  assertNonNegativeInt(subtotalCents, 'subtotalCents');
  assertNonNegativeInt(taxRateBps, 'taxRateBps');
  return Math.round((subtotalCents * taxRateBps) / 10_000);
}

export function laborAmountCents(minutes: number, hourlyRateCents: number): number {
  assertPositiveInt(minutes, 'minutes');
  assertNonNegativeInt(hourlyRateCents, 'hourlyRateCents');
  return Math.round((minutes * hourlyRateCents) / 60);
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, '0')}`;
}
