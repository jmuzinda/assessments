# Helio console candidate tasks

The dispatch console in this folder is the baseline. Sign-in, the board, customers, stock receipts, and invoice payments already work.

Your work is the four screens below. They call the API tasks in the root [ASSESSMENT.md](../ASSESSMENT.md).

Keep money in integer cents. Hide a control when `can(role, permission)` is false. Show the API error message in the existing alert banner. Do not put the signing secret into `localStorage` or `sessionStorage`.

## 1. Suggest technicians

On a work order whose status is `scheduled`, a dispatcher (permission `work_orders:dispatch`) sees a button labeled `Suggest technicians`.

Clicking it calls `GET /api/v1/work-orders/:id/suggestions` and renders one row per technician: name, score, skill match, and open assignments. An empty list shows `No technicians are available for this window.`

Each row has a button `Use <name>`. That click selects the same technician in the dispatch dropdown. It does not dispatch by itself.

Technicians and viewers never see the button.

## 2. Transfer stock

On the inventory page, someone with `inventory:write` sees a form headed `Transfer stock`.

Fields: `From`, `To`, `Part`, `Quantity`. Submit calls:

`POST /api/v1/stock/transfers`

```json
{ "partId": "<id>", "fromLocationId": "<id>", "toLocationId": "<id>", "quantity": 4 }
```

After a success response, show the returned `referenceId` and reload the on-hand table. A `409` stays on the form as the API message. Viewers do not see the form.
