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
