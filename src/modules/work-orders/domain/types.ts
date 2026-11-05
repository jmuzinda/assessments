export const WORK_ORDER_STATUSES = [
  'draft',
  'scheduled',
  'dispatched',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkOrder {
  id: string;
  organizationId: string;
  number: number;
  customerId: string;
  siteId: string;
  assetId: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: WorkOrderStatus;
  slaDueAt: Date;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  technicianId: string | null;
  createdBy: string;
  version: number;
  cancelReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkOrderNote {
  id: string;
  organizationId: string;
  workOrderId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export interface TimeEntry {
  id: string;
  organizationId: string;
  workOrderId: string;
  technicianId: string;
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  hourlyRateCents: number;
  notes: string;
  createdAt: Date;
}

export interface WorkOrderListFilter {
  limit: number;
  offset: number;
  status?: WorkOrderStatus;
  priority?: Priority;
  customerId?: string;
  technicianId?: string;
  query?: string;
}
