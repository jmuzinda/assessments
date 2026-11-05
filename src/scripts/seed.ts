import { createApp } from '../app/create-app';

async function main(): Promise<void> {
const app = await createApp({
  databasePath: './data/helio.db',
  logger: false,
  scryptCost: 16_384,
});

const health = await app.inject({ method: 'GET', url: '/health' });
if (health.statusCode !== 200) {
  throw new Error('Database is not ready');
}

const existing = await app.inject({
  method: 'POST',
  url: '/api/v1/auth/login',
  payload: { email: 'avery@northwind.test', password: 'Demo12345a' },
});
if (existing.statusCode === 200) {
  console.log('Demo data already exists. Delete data/helio.db to seed again.');
  console.log(`Owner token: ${existing.json().data.token}`);
  await app.close();
  process.exit(0);
}

const owner = await json(app, 'POST', '/api/v1/auth/register', {
  organizationName: 'Northwind Field Service',
  plan: 'professional',
  name: 'Avery Chen',
  email: 'avery@northwind.test',
  password: 'Demo12345a',
});
const token = owner.data.token as string;
const technician = await json(app, 'POST', '/api/v1/members', {
  name: 'Riley Shah',
  email: 'riley@northwind.test',
  password: 'Demo12345a',
  role: 'technician',
}, token);
const profile = await json(app, 'POST', '/api/v1/technicians', {
  userId: technician.data.user.id,
  skills: ['hvac', 'electrical'],
  hourlyRateCents: 9_500,
}, token);
const customer = await json(app, 'POST', '/api/v1/customers', { name: 'Harbor Clinic', email: 'ops@harbor.test' }, token);
const site = await json(app, 'POST', `/api/v1/customers/${customer.data.id}/sites`, {
  name: 'Main Campus',
  line1: '10 Harbor Way',
  city: 'Boston',
  region: 'MA',
  postalCode: '02110',
  country: 'US',
  timezone: 'America/New_York',
}, token);
const asset = await json(app, 'POST', `/api/v1/sites/${site.data.id}/assets`, {
  name: 'Rooftop HVAC',
  serialNumber: 'HVAC-100',
  category: 'hvac',
}, token);
const part = await json(app, 'POST', '/api/v1/parts', {
  sku: 'FILTER-20',
  name: 'Air filter',
  unitCostCents: 800,
  unitPriceCents: 2_500,
  reorderPoint: 2,
}, token);
const location = await json(app, 'POST', '/api/v1/locations', { name: 'Main warehouse', kind: 'warehouse' }, token);
await json(app, 'POST', '/api/v1/stock/receive', { partId: part.data.id, locationId: location.data.id, quantity: 20 }, token);
const workOrder = await json(app, 'POST', '/api/v1/work-orders', {
  customerId: customer.data.id,
  siteId: site.data.id,
  assetId: asset.data.id,
  title: 'No cool air on the third floor',
  description: 'Clinic reports the rooftop unit is running but not cooling.',
  priority: 'urgent',
}, token);

console.log('Seeded Northwind Field Service');
console.log(`Organization: ${owner.data.organization.slug}`);
console.log(`Owner: avery@northwind.test / Demo12345a`);
console.log(`Technician: riley@northwind.test / Demo12345a`);
console.log(`Work order: ${workOrder.data.number}`);
console.log(`Technician profile: ${profile.data.id}`);
console.log(`Token: ${token}`);

await app.close();
}

void main();

async function json(
  application: Awaited<ReturnType<typeof createApp>>,
  method: 'POST',
  url: string,
  payload: Record<string, unknown>,
  token?: string,
): Promise<{ data: Record<string, any> }> {
  const response = await application.inject({
    method,
    url,
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (response.statusCode >= 400) {
    throw new Error(`${method} ${url} failed ${response.statusCode} ${response.body}`);
  }
  return response.json();
}
