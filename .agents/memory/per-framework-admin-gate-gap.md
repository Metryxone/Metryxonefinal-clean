---
name: Per-framework admin auth gate gap
description: The global /api/admin gate does NOT cover /api/<framework>/admin/* prefixes; each such route must carry its own guards.
---
The global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate only matches the literal `/api/admin/*` path. Admin endpoints living under per-framework prefixes — `/api/lbi/admin/*`, `/api/sdi/admin/*`, `/api/competency/admin/*` (and bare `/api/competency/...` admin reads), `/api/commercial/admin/*`, `/api/concerns/admin/*`, `/api/invoice/admin/*`, `/api/short-assessments/admin/*` — are NOT covered and must each declare `requireAuth, requireSuperAdmin` inline (or via a spread array like `...admin`).

**Why:** sibling write routes (POST/PATCH/DELETE) usually have the guards but a GET list/read on the same resource is easy to forget, leaking admin data without a login check (e.g. engine-summary endpoints; `/api/competency/cohorts` GET).

**How to apply:** when adding any route under a `/api/<framework>/admin` (or an admin-only read like `/api/competency/cohorts`), add `requireAuth, requireSuperAdmin`. Audit sweep:
`rg "app\.(get|post|patch|put|delete)\('/api/[a-z0-9-]+/admin" backend/routes/ -n | rg -v "requireAuth|\.\.\.admin"`
Beware intentionally-public framework reads used in the assessment flow (`/api/sdi/domains|subdomains|items`, `/api/lbi/clusters`, `/api/sdi/clusters`) — those stay unguarded by design; confirm via frontend usage (admin page vs assessment flow) before adding guards.
