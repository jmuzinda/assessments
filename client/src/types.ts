export type Role = 'owner' | 'admin' | 'dispatcher' | 'technician' | 'billing' | 'viewer';

export interface Principal {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
  name: string;
}

export interface Page<T> {
  data: T[];
  page: { limit: number; offset: number; total: number };
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
}

export interface Site {
  id: string;
  customerId: string;
  name: string;
  timezone: string;
  address: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
}

export interface WorkOrder {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  version: number;
  customerId: string;
  siteId: string;
  assetId: string | null;
  technicianId: string | null;
  slaDueAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  notes: Note[];
  timeEntries: TimeEntry[];
  partUsages: PartUsage[];
}

export interface Note {
  id: string;
  body: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  minutes: number;
  notes: string;
  startedAt: string;
  endedAt: string;
}

export interface PartUsage {
  id: string;
  quantity: number;
  partId: string;
  unitPriceCents: number;
}

export interface Technician {
  id: string;
  userId: string;
  name: string;
  email: string;
  skills: string[];
  hourlyRateCents: number;
  active: boolean;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  unitCostCents: number;
  reorderPoint: number;
  active: boolean;
}

export interface StockLocation {
  id: string;
  name: string;
  kind: string;
}

export interface StockLevel {
  partId: string;
  locationId: string;
  sku: string;
  partName: string;
  locationName: string;
  onHand: number;
  reserved: number;
}

export interface Invoice {
  id: string;
  number: string;
  status: string;
  customerId: string;
  workOrderId: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  dueAt: string | null;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface InvoiceLine {
  id: string;
  kind: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

export interface Payment {
  id: string;
  amountCents: number;
  method: string;
  reference: string;
}

export interface OperationsReport {
  countsByStatus: Record<string, number>;
  openOverdue: number;
  completedInWindow: number;
}
