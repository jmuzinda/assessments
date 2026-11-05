import { z } from 'zod';

const uuid = z.string().uuid();
const instant = z.string().datetime();

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(80),
  plan: z.enum(['starter', 'professional', 'enterprise']),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  organizationSlug: z.string().trim().min(2).max(64).optional(),
});

export const memberSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(10).max(128),
  role: z.enum(['admin', 'dispatcher', 'technician', 'billing', 'viewer']),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export const customerPatchSchema = customerSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional(),
});

export const siteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(2),
  timezone: z.string().trim().min(1).max(64),
});

export const assetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  serialNumber: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
});

export const assetStatusSchema = z.object({
  status: z.enum(['active', 'maintenance', 'retired']),
});

export const technicianSchema = z.object({
  userId: uuid,
  skills: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  hourlyRateCents: z.number().int().nonnegative(),
});

export const workOrderSchema = z.object({
  customerId: uuid,
  siteId: uuid,
  assetId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

export const scheduleSchema = z.object({
  expectedVersion: z.number().int().positive(),
  scheduledStart: instant,
  scheduledEnd: instant,
});

export const dispatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  technicianId: uuid,
});

export const versionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const reasonSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const timeEntrySchema = z.object({
  startedAt: instant,
  endedAt: instant,
  notes: z.string().trim().max(1000).default(''),
});

export const consumeSchema = z.object({
  partId: uuid,
  locationId: uuid,
  quantity: z.number().int().positive(),
});

export const partSchema = z.object({
  sku: z.string().trim().min(2).max(32),
  name: z.string().trim().min(1).max(120),
  unitCostCents: z.number().int().nonnegative(),
  unitPriceCents: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['warehouse', 'van']),
});

export const receiveSchema = z.object({
  partId: uuid,
  locationId: uuid,
  quantity: z.number().int().positive(),
});

export const adjustSchema = z.object({
  partId: uuid,
  locationId: uuid,
  delta: z.number().int().refine((value) => value !== 0, 'delta must be non-zero'),
});

export const reserveSchema = z.object({
  partId: uuid,
  locationId: uuid,
  workOrderId: uuid,
  quantity: z.number().int().positive(),
});

export const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(['card', 'ach', 'cash', 'check']),
  reference: z.string().trim().min(1).max(80),
});

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});

export const customerQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const workOrderQuerySchema = pageQuerySchema.extend({
  status: z.enum(['draft', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  customerId: uuid.optional(),
  technicianId: uuid.optional(),
  q: z.string().trim().max(120).optional(),
});

export const invoiceQuerySchema = pageQuerySchema.extend({
  status: z.enum(['draft', 'issued', 'partial', 'paid', 'void']).optional(),
  customerId: uuid.optional(),
});

export const auditQuerySchema = pageQuerySchema.extend({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: uuid.optional(),
});

export const notificationQuerySchema = pageQuerySchema.extend({
  unreadOnly: z.enum(['true', 'false']).optional(),
});

export const reportWindowSchema = z.object({
  from: instant,
  to: instant,
});

export const reservationQuerySchema = z.object({
  workOrderId: uuid.optional(),
});

export const idParams = z.object({ id: uuid });
