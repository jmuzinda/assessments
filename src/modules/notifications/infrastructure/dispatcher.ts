import type { Clock } from '../../../shared/kernel/clock';
import type { NotificationStore } from '../application/ports';
import { notificationFromEvent } from '../domain/notification-policy';
import type { OutboxRepository } from './outbox-repository';

export class OutboxDispatcher {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly notifications: NotificationStore,
    private readonly clock: Clock,
  ) {}

  publishPending(limit = 100): number {
    const events = this.outbox.unpublished(limit);
    for (const event of events) {
      const notification = notificationFromEvent(event);
      if (notification) {
        this.notifications.insert(notification);
      }
      this.outbox.markPublished(event.id, this.clock.now());
    }
    return events.length;
  }
}
