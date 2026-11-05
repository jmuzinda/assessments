export interface StatusCount {
  status: string;
  count: number;
}

export interface OperationsRaw {
  counts: StatusCount[];
  openOverdue: number;
  completedInWindow: number;
  averageCycleMinutes: number | null;
  completedLate: number;
}

export interface RevenueRaw {
  issuedCount: number;
  paidCount: number;
  voidCount: number;
  invoicedCents: number;
  collectedCents: number;
  outstandingCents: number;
  taxCents: number;
  topCustomers: Array<{ customerId: string; name: string; invoicedCents: number; collectedCents: number }>;
}

export interface LowStockRow {
  partId: string;
  sku: string;
  name: string;
  reorderPoint: number;
  onHand: number;
  reserved: number;
}

export interface ReportingStore {
  operations(organizationId: string, from: Date, to: Date, now: Date): OperationsRaw;
  revenue(organizationId: string): RevenueRaw;
  lowStock(organizationId: string): LowStockRow[];
}
