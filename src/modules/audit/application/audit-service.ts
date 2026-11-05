import type { AuditStore } from '../../../shared/application/ports';
import type { Principal } from '../../../shared/auth/principal';
import type { AuditEntry } from '../../../shared/kernel/domain-event';
import type { Page } from '../../../shared/kernel/pagination';

export class AuditService {
  constructor(private readonly audit: AuditStore) {}

  list(
    principal: Principal,
    filter: { limit: number; offset: number; action?: string; entityType?: string; entityId?: string },
  ): Page<AuditEntry> {
    const result = this.audit.list(principal.organizationId, filter);
    return { items: result.rows, total: result.total, limit: filter.limit, offset: filter.offset };
  }
}
