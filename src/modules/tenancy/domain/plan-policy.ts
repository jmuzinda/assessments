import type { PlanName } from '../../../config/constants';
import { Errors } from '../../../shared/kernel/errors';

export function assertMemberCapacity(plan: PlanName, currentMembers: number, limits: { members: number }): void {
  if (currentMembers >= limits.members) {
    throw Errors.conflict(`The ${plan} plan allows ${limits.members} members`);
  }
}

export function assertWorkOrderCapacity(
  plan: PlanName,
  createdThisMonth: number,
  limits: { monthlyWorkOrders: number },
): void {
  if (createdThisMonth >= limits.monthlyWorkOrders) {
    throw Errors.conflict(`The ${plan} plan allows ${limits.monthlyWorkOrders} work orders per month`);
  }
}
