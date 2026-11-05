import { Errors } from '../../../shared/kernel/errors';
import type { WorkOrderStatus } from './types';

const TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['dispatched', 'cancelled'],
  dispatched: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
  if (!canTransition(from, to)) {
    throw Errors.invalidState(`Cannot transition work order from ${from} to ${to}`);
  }
}

export function nextStatuses(from: WorkOrderStatus): readonly WorkOrderStatus[] {
  return TRANSITIONS[from];
}
