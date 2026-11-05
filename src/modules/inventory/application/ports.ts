import type {
  Part,
  PartUsage,
  StockLevel,
  StockLevelView,
  StockLocation,
  StockMovement,
  StockReservation,
} from '../domain/types';

export interface InventoryStore {
  insertPart(part: Part): void;
  findPart(organizationId: string, id: string): Part | undefined;
  findPartBySku(organizationId: string, sku: string): Part | undefined;
  listParts(organizationId: string): Part[];
  insertLocation(location: StockLocation): void;
  findLocation(organizationId: string, id: string): StockLocation | undefined;
  listLocations(organizationId: string): StockLocation[];
  getLevel(partId: string, locationId: string): StockLevel | undefined;
  saveLevel(level: StockLevel): void;
  totalOnHand(partId: string): number;
  insertMovement(movement: StockMovement): void;
  listLevels(organizationId: string): StockLevelView[];
  insertUsage(usage: PartUsage): void;
  listUsages(organizationId: string, workOrderId: string): PartUsage[];
  insertReservation(reservation: StockReservation): void;
  findReservation(organizationId: string, id: string): StockReservation | undefined;
  saveReservation(reservation: StockReservation): void;
  listReservations(organizationId: string, workOrderId?: string): StockReservation[];
  listActiveReservations(organizationId: string, workOrderId: string): StockReservation[];
}
