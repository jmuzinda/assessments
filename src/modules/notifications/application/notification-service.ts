import type { Principal } from '../../../shared/auth/principal';
import type { Clock } from '../../../shared/kernel/clock';
import { Errors } from '../../../shared/kernel/errors';
import type { Page } from '../../../shared/kernel/pagination';
import type { Notification } from '../domain/notification-policy';
import type { NotificationStore } from './ports';

export class NotificationService {
  constructor(
    private readonly notifications: NotificationStore,
    private readonly clock: Clock,
  ) {}

  list(principal: Principal, filter: { limit: number; offset: number; unreadOnly?: boolean }): Page<Notification> {
    const result = this.notifications.list(principal.organizationId, {
      ...filter,
      recipientUserId: principal.role === 'technician' ? principal.userId : undefined,
    });
    return { items: result.rows, total: result.total, limit: filter.limit, offset: filter.offset };
  }

  markRead(principal: Principal, id: string): Notification {
    const existing = this.notifications.find(principal.organizationId, id);
    if (!existing) {
      throw Errors.notFound('Notification');
    }
    if (principal.role === 'technician' && existing.recipientUserId !== principal.userId) {
      throw Errors.forbidden('Technicians can only update their own notifications');
    }
    if (!existing.readAt) {
      this.notifications.markRead(principal.organizationId, id, this.clock.now());
    }
    return this.notifications.find(principal.organizationId, id) ?? existing;
  }
}
