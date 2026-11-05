import type { Priority } from './types';

const SLA_HOURS: Record<Priority, number> = {
  urgent: 4,
  high: 24,
  normal: 72,
  low: 168,
};

export function slaDueAt(priority: Priority, createdAt: Date): Date {
  return new Date(createdAt.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000);
}

export function slaHours(priority: Priority): number {
  return SLA_HOURS[priority];
}

export function isOverdue(slaDueAtValue: Date, status: string, now: Date): boolean {
  if (status === 'completed' || status === 'cancelled') {
    return false;
  }
  return slaDueAtValue.getTime() < now.getTime();
}
