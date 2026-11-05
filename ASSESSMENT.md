# Helio API candidate tasks

Frontend tasks are separate. See [client/ASSESSMENT.md](client/ASSESSMENT.md).

The API in this repository is the baseline. Read `README.md` before changing anything.

Your work is the four tasks below. Each one needs a domain rule, a persistence change where the schema is not enough, an HTTP route that follows the existing auth and idempotency style, and an audit entry. Keep tenant data inside `principal.organizationId`. Money stays in integer cents. Do not import Fastify or `node:sqlite` from `domain` or `application` code.

Writes go through `command()` in `src/http/routes/command.ts`, which wraps the unit of work and the idempotency key. New migrations are added in `src/infrastructure/db/migrate.ts` after `002_audit_index`. SQLite will not change a `CHECK` constraint in place; rebuild the table and copy the rows when you need a new allowed value.

## 1. Transfer stock between locations

`POST /api/v1/stock/transfers`

Permission: `inventory:write`.

```json
{ "partId": "<uuid>", "fromLocationId": "<uuid>", "toLocationId": "<uuid>", "quantity": 4 }
```

Rules:

- `quantity` is a positive integer.
- Source and destination are different locations in the same organization. A missing part or location is `404`. An inactive part is `404`.
- Only available stock can move: `quantity <= onHand - reserved` at the source. Otherwise `409` `INSUFFICIENT_STOCK`, including the part SKU.
- Source `onHand` decreases by `quantity`. Destination `onHand` increases by `quantity`. `reserved` does not change on either side. Create the destination level if it does not exist yet.
- Record two `transfer` movements that share one `referenceId` and `referenceType` `stock_transfer`. The source quantity is negative. The destination quantity is positive.
- The movement `CHECK` currently allows only `receive`, `adjust`, `reserve`, `release`, and `consume`. Extend it in a new migration.
- Put the quantity check in `applyTransfer` in `src/modules/inventory/domain/stock-math.ts`.
- Write one audit row, action `inventory.transferred`.
- Honor `Idempotency-Key` the same way customer creation does.

## 2. Suggest technicians for a scheduled job

`GET /api/v1/work-orders/:id/suggestions`

Permission: `work_orders:dispatch`. A technician or a viewer receives `403`. An unknown work order is `404`.

The work order must already have `scheduledStart` and `scheduledEnd`. A draft without a window is `409` `INVALID_STATE`.

```json
{
  "data": [
    {
      "technicianId": "<uuid>",
      "userId": "<uuid>",
      "name": "Riley Shah",
      "email": "riley@helio.test",
      "skills": ["HVAC"],
      "hourlyRateCents": 10000,
      "skillMatch": 1,
      "openAssignments": 0,
      "score": 100
    }
  ]
}
```

Include only active technicians with no assignment that overlaps the work order window. Overlap uses the same window rule as dispatch: statuses `scheduled`, `dispatched`, and `in_progress`.

- `skillMatch` is how many of the technician skills equal the asset category, compared case-insensitively. No asset, or no category match, means `0`.
- `openAssignments` is how many work orders in `scheduled`, `dispatched`, or `in_progress` are already assigned to that technician. The work order being suggested does not count unless that technician is already assigned to it.
- `score = skillMatch * 100 - openAssignments`.
- Sort by `score` descending, then `hourlyRateCents` ascending, then `name` ascending.
- Return an empty list when nobody qualifies. Do not answer `404` for that case.

## 3. Refund a payment

`POST /api/v1/invoices/:id/refunds`

Permission: `billing:write`.

```json
{ "amountCents": 1000, "reference": "rf-1" }
```

Payments stay append-only. Store refunds in a new `refunds` table (`id`, `organization_id`, `invoice_id`, `amount_cents`, `reference`, `refunded_at`). `GET /api/v1/invoices/:id` includes a `refunds` array with those fields and `refundedAt` as an ISO timestamp.

Rules, implemented next to `applyPayment` in `src/modules/billing/domain/invoice-calculator.ts`:

- The invoice status must be `paid` or `partial`. Anything else is `409` `INVALID_STATE`.
- `amountCents` is a positive integer and cannot exceed `amountPaidCents`. A larger refund is `422`, with `details.refundableCents`.
- Subtract the refund from `amountPaidCents`.
- A remaining balance (`amountPaidCents < totalCents` and `amountPaidCents > 0`) sets status to `partial`.
- Refunding the rest (`amountPaidCents` becomes `0`) sets status back to `issued`.
- `reference` is required, trimmed, and at most 80 characters.
- Audit action `invoice.refunded`.
- Void stays forbidden once any payment or refund exists, even after the net paid amount returns to `0`. That is `409` `INVALID_STATE`. A draft invoice with no payments can still be voided.

## 4. Signed webhooks from the outbox

Owners and admins (`members:write`) manage subscriptions.

`POST /api/v1/webhooks`

```json
{ "url": "https://example.test/hooks", "events": ["customer.created"], "secret": "a-secret-of-at-least-16" }
```

- `url` must be an `http` or `https` URL.
- `events` is a non-empty list of outbox event names. No wildcard.
- `secret` is 16 to 128 characters. Return it on create only. `GET /api/v1/webhooks` returns `id`, `url`, `events`, and `createdAt`, never `secret`.
- `DELETE /api/v1/webhooks/:id` removes it. Another organization still receives `404`.
- A viewer receives `403` on create.

When `OutboxDispatcher.publishPending` handles an event, deliver it to each subscription whose `events` contain that type. `IdempotencyService` must wait until those delivery attempts finish before it returns, so a caller observes the result before the HTTP response completes.

POST the JSON body below with `Content-Type: application/json`:

```json
{
  "id": "<outbox event id>",
  "type": "customer.created",
  "organizationId": "<uuid>",
  "createdAt": "<iso timestamp>",
  "payload": {}
}
```

Headers:

- `X-Helio-Timestamp`: unix time in seconds
- `X-Helio-Signature`: hex HMAC-SHA256 of `${timestamp}.${rawBody}` using the subscription secret

`rawBody` is the exact string you send. Record each attempt in `webhook_deliveries` with `subscription_id`, `event_id`, `attempt`, `status` (`pending`, `succeeded`, or `failed`), and `created_at`.

- HTTP 2xx marks that delivery `succeeded` and does not retry it.
- A non-2xx response or a thrown request increments the attempt and leaves the delivery `pending`.
- The fifth failure marks it `failed` and stops retrying.
- A subscription that does not list the event type gets no delivery.
- In-app notifications keep working for the event types that already create them.

`GET /api/v1/webhooks/:id/deliveries` returns that subscription's deliveries for the caller's organization, newest first.
