export interface Part {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  unitCostCents: number;
  unitPriceCents: number;
  reorderPoint: number;
  active: boolean;
  createdAt: Date;
}

export interface StockLocation {
  id: string;
  organizationId: string;
  name: string;
  kind: 'warehouse' | 'van';
  createdAt: Date;
}

export interface StockLevel {
  organizationId: string;
  partId: string;
  locationId: string;
  onHand: number;
  reserved: number;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  partId: string;
  locationId: string;
  type: 'receive' | 'adjust' | 'reserve' | 'release' | 'consume';
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface PartUsage {
  id: string;
  organizationId: string;
  workOrderId: string;
  partId: string;
  locationId: string;
  quantity: number;
  unitPriceCents: number;
  createdAt: Date;
}

export interface StockReservation {
  id: string;
  organizationId: string;
  partId: string;
  locationId: string;
  workOrderId: string;
  quantity: number;
  status: 'active' | 'released' | 'consumed';
  createdAt: Date;
}

export interface StockLevelView extends StockLevel {
  sku: string;
  partName: string;
  locationName: string;
  reorderPoint: number;
}
