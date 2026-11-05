export type PlanName = 'starter' | 'professional' | 'enterprise';

export interface PlanQuota {
  members: number;
  monthlyWorkOrders: number;
}

export type PlanLimits = Record<PlanName, PlanQuota>;

export const defaultPlanLimits: PlanLimits = {
  starter: { members: 5, monthlyWorkOrders: 50 },
  professional: { members: 25, monthlyWorkOrders: 500 },
  enterprise: { members: 1000, monthlyWorkOrders: 100_000 },
};

export const DEFAULT_TAX_RATE_BPS = 800;
export const INVOICE_DUE_DAYS = 14;
export const TOKEN_TTL_SECONDS = 60 * 60 * 12;
export const MAX_SCHEDULE_HOURS = 12;
export const AUTH_RATE_LIMIT = 10;
export const AUTH_RATE_WINDOW_MS = 60_000;
export const SCRYPT_COST = 16_384;
