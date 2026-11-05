import type { PlanLimits } from '../config/constants';
import {
  AUTH_RATE_LIMIT,
  AUTH_RATE_WINDOW_MS,
  DEFAULT_TAX_RATE_BPS,
  INVOICE_DUE_DAYS,
  SCRYPT_COST,
  TOKEN_TTL_SECONDS,
  defaultPlanLimits,
} from '../config/constants';
import type { Db } from '../infrastructure/db/connection';
import { SqliteSequenceStore } from '../infrastructure/db/sequence-store';
import { SqliteUnitOfWork } from '../infrastructure/db/unit-of-work';
import { IdempotencyRepository } from '../infrastructure/idempotency/idempotency-repository';
import { IdempotencyService } from '../infrastructure/idempotency/idempotency-service';
import { createFixedWindowLimiter } from '../infrastructure/rate-limit/fixed-window';
import { ActivityRecorder } from '../modules/activity/application/activity-recorder';
import { AuditService } from '../modules/audit/application/audit-service';
import { AuditRepository } from '../modules/audit/infrastructure/audit-repository';
import { BillingService } from '../modules/billing/application/billing-service';
import { BillingRepository } from '../modules/billing/infrastructure/billing-repository';
import { CustomerService } from '../modules/customers/application/customer-service';
import { CustomerRepository } from '../modules/customers/infrastructure/customer-repository';
import { IdentityService } from '../modules/identity/application/identity-service';
import { IdentityRepository } from '../modules/identity/infrastructure/identity-repository';
import { asMembershipStore, asOrganizationStore, asUserStore } from '../modules/identity/infrastructure/identity-stores';
import { InventoryService } from '../modules/inventory/application/inventory-service';
import { InventoryRepository } from '../modules/inventory/infrastructure/inventory-repository';
import { NotificationService } from '../modules/notifications/application/notification-service';
import { OutboxDispatcher } from '../modules/notifications/infrastructure/dispatcher';
import { NotificationRepository } from '../modules/notifications/infrastructure/notification-repository';
import { OutboxRepository } from '../modules/notifications/infrastructure/outbox-repository';
import { ReportingService } from '../modules/reporting/application/reporting-service';
import { ReportingRepository } from '../modules/reporting/infrastructure/reporting-repository';
import { WorkforceService } from '../modules/workforce/application/workforce-service';
import { WorkforceRepository } from '../modules/workforce/infrastructure/workforce-repository';
import { WorkOrderService } from '../modules/work-orders/application/work-order-service';
import { WorkOrderRepository } from '../modules/work-orders/infrastructure/work-order-repository';
import type { Clock } from '../shared/kernel/clock';
import { uuidIds } from '../shared/kernel/id';

export interface AppConfig {
  jwtSecret: string;
  tokenTtlSeconds: number;
  scryptCost: number;
  taxRateBps: number;
  invoiceDueDays: number;
  planLimits: PlanLimits;
  authRateLimit: number;
  authRateWindowMs: number;
}

export const defaultAppConfig: AppConfig = {
  jwtSecret: 'dev-only-change-me',
  tokenTtlSeconds: TOKEN_TTL_SECONDS,
  scryptCost: SCRYPT_COST,
  taxRateBps: DEFAULT_TAX_RATE_BPS,
  invoiceDueDays: INVOICE_DUE_DAYS,
  planLimits: defaultPlanLimits,
  authRateLimit: AUTH_RATE_LIMIT,
  authRateWindowMs: AUTH_RATE_WINDOW_MS,
};

export interface Container {
  config: AppConfig;
  clock: Clock;
  db: Db;
  identity: IdentityService;
  customers: CustomerService;
  workforce: WorkforceService;
  workOrders: WorkOrderService;
  inventory: InventoryService;
  billing: BillingService;
  reporting: ReportingService;
  audit: AuditService;
  notifications: NotificationService;
  idempotency: IdempotencyService;
  outbox: OutboxDispatcher;
  ping(): void;
}

export function createContainer(db: Db, clock: Clock, config: AppConfig): Container {
  const unitOfWork = new SqliteUnitOfWork(db);
  const identityRepository = new IdentityRepository(db);
  const organizations = asOrganizationStore(identityRepository);
  const users = asUserStore(identityRepository);
  const memberships = asMembershipStore(identityRepository);
  const auditRepository = new AuditRepository(db);
  const outboxRepository = new OutboxRepository(db);
  const activity = new ActivityRecorder(auditRepository, outboxRepository, uuidIds, clock);
  const notificationRepository = new NotificationRepository(db);
  const outbox = new OutboxDispatcher(outboxRepository, notificationRepository, clock);
  const sequences = new SqliteSequenceStore(db);
  const customerRepository = new CustomerRepository(db);
  const workforceRepository = new WorkforceRepository(db);
  const workOrderRepository = new WorkOrderRepository(db);
  const inventoryRepository = new InventoryRepository(db);
  const billingRepository = new BillingRepository(db);
  const reportingRepository = new ReportingRepository(db);

  return {
    config,
    clock,
    db,
    identity: new IdentityService(
      organizations,
      users,
      memberships,
      activity,
      unitOfWork,
      uuidIds,
      clock,
      config,
      createFixedWindowLimiter(config.authRateLimit, config.authRateWindowMs),
    ),
    customers: new CustomerService(customerRepository, activity, unitOfWork, uuidIds, clock),
    workforce: new WorkforceService(workforceRepository, memberships, activity, unitOfWork, uuidIds, clock),
    inventory: new InventoryService(inventoryRepository, workOrderRepository, activity, unitOfWork, uuidIds, clock),
    workOrders: new WorkOrderService(
      workOrderRepository,
      customerRepository,
      workforceRepository,
      inventoryRepository,
      organizations,
      sequences,
      activity,
      unitOfWork,
      uuidIds,
      clock,
      config.planLimits,
    ),
    billing: new BillingService(
      billingRepository,
      workOrderRepository,
      inventoryRepository,
      sequences,
      activity,
      unitOfWork,
      uuidIds,
      clock,
      config,
    ),
    reporting: new ReportingService(reportingRepository, clock),
    audit: new AuditService(auditRepository),
    notifications: new NotificationService(notificationRepository, clock),
    idempotency: new IdempotencyService(new IdempotencyRepository(db), unitOfWork, outbox, clock),
    outbox,
    ping(): void {
      db.prepare('SELECT 1 AS ok').get();
    },
  };
}
