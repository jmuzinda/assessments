import type { AuditStore, OutboxStore } from '../../../shared/application/ports';
import type { Clock } from '../../../shared/kernel/clock';
import type { IdGenerator } from '../../../shared/kernel/id';

export class ActivityRecorder {
  constructor(
    private readonly audit: AuditStore,
    private readonly outbox: OutboxStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  record(input: {
    organizationId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    eventType?: string;
    payload?: Record<string, unknown>;
  }): void {
    const at = this.clock.now();
    this.audit.append({
      id: this.ids.next(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
      createdAt: at,
    });
    if (input.eventType) {
      this.outbox.append({
        id: this.ids.next(),
        organizationId: input.organizationId,
        type: input.eventType,
        payload: input.payload ?? input.metadata ?? {},
        createdAt: at,
        publishedAt: null,
      });
    }
  }
}
