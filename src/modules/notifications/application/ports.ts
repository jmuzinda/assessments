import type { Notification, NotificationDraft } from '../domain/notification-policy';

export interface NotificationListFilter {
  limit: number;
  offset: number;
  unreadOnly?: boolean;
  recipientUserId?: string;
}

export interface NotificationStore {
  insert(notification: NotificationDraft): void;
  list(organizationId: string, filter: NotificationListFilter): { rows: Notification[]; total: number };
  find(organizationId: string, id: string): Notification | undefined;
  markRead(organizationId: string, id: string, readAt: Date): void;
}
