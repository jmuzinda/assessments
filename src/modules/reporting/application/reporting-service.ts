import type { Principal } from '../../../shared/auth/principal';
import type { Clock } from '../../../shared/kernel/clock';
import type { LowStockRow, ReportingStore } from './ports';

export class ReportingService {
  constructor(
    private readonly reporting: ReportingStore,
    private readonly clock: Clock,
  ) {}

  operations(principal: Principal, from: Date, to: Date) {
    const raw = this.reporting.operations(principal.organizationId, from, to, this.clock.now());
    const countsByStatus: Record<string, number> = {
      draft: 0,
      scheduled: 0,
      dispatched: 0,
      in_progress: 0,
      on_hold: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const row of raw.counts) {
      countsByStatus[row.status] = row.count;
    }
    return {
      generatedAt: this.clock.now(),
      window: { from, to },
      countsByStatus,
      openOverdue: raw.openOverdue,
      completedInWindow: raw.completedInWindow,
      averageCycleTimeMinutes: raw.averageCycleMinutes,
      completedLateInWindow: raw.completedLate,
    };
  }

  revenue(principal: Principal) {
    return { generatedAt: this.clock.now(), ...this.reporting.revenue(principal.organizationId) };
  }

  lowStock(principal: Principal): LowStockRow[] {
    return this.reporting.lowStock(principal.organizationId);
  }
}
