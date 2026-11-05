export interface DomainEvent {
  id: string;
  organizationId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface AuditEntry {
  id: string;
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditFilter {
  limit: number;
  offset: number;
  action?: string;
  entityType?: string;
  entityId?: string;
}
