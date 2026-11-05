export const migration001 = `
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL
);

CREATE TABLE memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'dispatcher', 'technician', 'billing', 'viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE sequences (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (organization_id, name)
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE technician_profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  skills_json TEXT NOT NULL,
  hourly_rate_cents INTEGER NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  number INTEGER NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  asset_id TEXT REFERENCES assets(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  sla_due_at TEXT NOT NULL,
  scheduled_start TEXT,
  scheduled_end TEXT,
  technician_id TEXT REFERENCES technician_profiles(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL,
  cancel_reason TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, number)
);

CREATE TABLE work_order_notes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  technician_id TEXT NOT NULL REFERENCES technician_profiles(id),
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  hourly_rate_cents INTEGER NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE parts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  reorder_point INTEGER NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, sku)
);

CREATE TABLE stock_locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('warehouse', 'van')),
  created_at TEXT NOT NULL
);

CREATE TABLE stock_levels (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  on_hand INTEGER NOT NULL,
  reserved INTEGER NOT NULL,
  PRIMARY KEY (part_id, location_id)
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  type TEXT NOT NULL CHECK (type IN ('receive', 'adjust', 'reserve', 'release', 'consume')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE part_usages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE stock_reservations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'released', 'consumed')),
  created_at TEXT NOT NULL
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'void')),
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  tax_rate_bps INTEGER NOT NULL,
  issued_at TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, number)
);

CREATE UNIQUE INDEX idx_one_open_invoice_per_work_order
  ON invoices (organization_id, work_order_id)
  WHERE status != 'void';

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  kind TEXT NOT NULL CHECK (kind IN ('labor', 'part')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('card', 'ach', 'cash', 'check')),
  reference TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE audit_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  recipient_user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_keys (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id, idempotency_key)
);

CREATE INDEX idx_customers_org ON customers (organization_id, name);
CREATE INDEX idx_work_orders_org_status ON work_orders (organization_id, status, created_at);
CREATE INDEX idx_work_orders_technician ON work_orders (organization_id, technician_id, status);
CREATE INDEX idx_outbox_unpublished ON outbox_events (published_at, created_at);
CREATE INDEX idx_notifications_org ON notifications (organization_id, created_at);
`;
