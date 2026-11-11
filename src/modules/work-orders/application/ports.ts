import type { TimeEntry, WorkOrder, WorkOrderListFilter, WorkOrderNote } from '../domain/types';

export interface WorkOrderStore {
  insert(workOrder: WorkOrder): void;
  update(workOrder: WorkOrder): void;
  findById(organizationId: string, id: string): WorkOrder | undefined;
  list(organizationId: string, filter: WorkOrderListFilter): { rows: WorkOrder[]; total: number };
  countCreatedBetween(organizationId: string, from: Date, to: Date): number;
  hasTechnicianOverlap(input: {
    organizationId: string;
    technicianId: string;
    start: Date;
    end: Date;
    excludingWorkOrderId?: string;
  }): boolean;
  countOpenAssignments(organizationId: string, technicianId: string): number;
  insertNote(note: WorkOrderNote): void;
  listNotes(organizationId: string, workOrderId: string): WorkOrderNote[];
  insertTimeEntry(entry: TimeEntry): void;
  listTimeEntries(organizationId: string, workOrderId: string): TimeEntry[];
}
