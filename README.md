# Helio

Helio is a multi-tenant field-service operations API. An organization registers, invites dispatchers, technicians, and billing staff, then runs work from the first customer call through scheduling, dispatch, parts, invoicing, and payment.

The project is a modular monolith. Domain rules do not import the database or the HTTP framework. SQLite is only an adapter, so the same services can sit on another database without rewriting the business rules.

API tasks are in [ASSESSMENT.md](ASSESSMENT.md). Console tasks are in [client/ASSESSMENT.md](client/ASSESSMENT.md).

## What it covers

- Organizations, memberships, and role-based access
- Customers, sites, and assets
- Technician profiles, skills, and hourly rates
- Work orders with an explicit state machine, SLA deadlines, and optimistic version checks
- Schedule windows and technician overlap detection
- Inventory: receipts, adjustments, reservations, consumption, and reorder signals
- Invoices priced in integer cents, with tax, partial payment, and void rules
- Idempotency keys for retried writes
- Audit log and a transactional outbox that publishes in-app notifications
- Operations, revenue, and low-stock reports
- Plan quotas for seats and monthly work orders

## Stack

Node.js 24, TypeScript run with tsx, Fastify, Zod, and the built-in `node:sqlite` driver. The console in `client` is a Vite and React application. Passwords are hashed with scrypt. Access tokens are HMAC-signed and checked against the current membership on every request, so a role change takes effect without waiting for the token to expire.

## Install

To avoid AI using, only need to install node modules for frontend: You need to read this careful.
```bash
cd client/
npm install
```

## Run

```bash
npm start
```

The API listens on port 3000. Copy `.env.example` to `.env` and set `JWT_SECRET` before using a production process. Sign in with the seed account, or register a new organization from the console.

```bash
npm run seed
```

The seed loads a demo company into `data/helio.db`. Sign in as `avery@northwind.test` / `Demo12345a`.

## Request shape

Authenticated routes expect `Authorization: Bearer <token>`.

Writes accept an `Idempotency-Key` header (8 to 128 characters). The same key and payload replay the original response. The same key with a different payload returns `409`.

Money fields are integer cents. Work order numbers look like `WO-1001` and invoices like `INV-1001`.

```bash
curl -s http://localhost:3000/health
```

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"organizationName":"Northwind","plan":"professional","name":"Avery Chen","email":"avery@northwind.test","password":"Demo12345a"}'
```

## Work order lifecycle

`draft → scheduled → dispatched → in_progress → completed`

`in_progress` can move to `on_hold` and back. Open jobs can be cancelled until work has started, and a cancelled job releases active stock reservations. `completed` and `cancelled` are terminal.

Dispatch rejects an inactive technician and any window that overlaps another active assignment. Technicians can only see and update jobs assigned to them.

## Roles

| Role | Can do |
| --- | --- |
| owner, admin | Everything, including the audit log |
| dispatcher | Customers, scheduling, dispatch, and execution |
| technician | Assigned jobs, time entries, and parts |
| billing | Invoices and payments |
| viewer | Read-only |

## Layout

```text
src/modules/*/domain          pure rules and state machines
src/modules/*/application     use cases and repository ports
src/modules/*/infrastructure  SQLite adapters
src/http                      routes, auth, validation, presenters

## Assessment Instructions
Application was developed and tested on Node24

## How to run the application 
Branch used: main

After cloning the project and ensuring that active branch is main cd into the assessment directory
Run the following commands
npm install
npm install --prefix client

Then run the API and the console in two terminals
npx tsx src/main.tx
npm run dev --prefix client

src/infrastructure            transactions, idempotency, migrations
```

A write enters one transaction. Nested service calls join that transaction. The outbox row is committed with the business change, then a dispatcher turns selected events into notifications. The process also polls the outbox so a crash after commit can still publish.
