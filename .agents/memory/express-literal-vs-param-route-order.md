---
name: Express literal vs :param route ordering
description: Why a /export.csv (or any literal sub-path) endpoint returns the :id handler's error, and the fix.
---

In Express, routes match in **registration order**, and `/:id` matches ANY single
path segment — including a literal like `export.csv`. So if `app.get('.../:id')`
is registered BEFORE `app.get('.../export.csv')`, a request to `/export.csv` hits
the `/:id` handler, fails its `Number.isFinite(parseInt(id))` guard, and returns
`{"error":"Invalid id"}` (or a 404/wrong row) instead of the intended response.

**Rule:** register every literal sub-path (`/export.csv`, `/stats`, `/facets`,
`/coverage`, etc.) BEFORE the catch-all `/:id` route in the same router.

**Why:** the symptom is misleading — the export "works" in code but the wrong
handler runs, so you chase the export logic instead of the route order.

**How to apply:** when adding any `/:id`-style route, scan the file for sibling
literal routes and make sure `:id` is registered last. Seen on
`capadex-clarity-questions.ts` (Export CSV → "Invalid id").
