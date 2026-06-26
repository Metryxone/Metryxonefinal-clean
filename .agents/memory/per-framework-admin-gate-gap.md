---
name: Per-framework admin auth gate gap
description: The /api/admin gate misses /api/<framework>/admin/* prefixes; a structural mount gate now closes that class — inline guards are defense-in-depth.
---
The global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate only matches the literal `/api/admin/*` path. Admin endpoints living under per-framework prefixes — `/api/lbi/admin/*`, `/api/sdi/admin/*`, `/api/competency/admin/*` (and a few bare `/api/competency/...` admin reads), `/api/commercial/admin/*`, `/api/concerns/admin/*`, `/api/invoice/admin/*`, `/api/short-assessments/admin/*` — are NOT covered by it.

**Why the gap was dangerous:** sibling write routes usually carry guards, but a GET list/read on the same resource is easy to forget, leaking admin data without a login check. Relying SOLELY on per-route inline guards means any new sub-route that forgets the guard ships public.

**Structural fix (now in place):** a SECOND mount gate sits immediately after the `/api/admin` gate and BEFORE every framework route module (all registered ~line 13568+):
`app.use('/api', (req,res,next) => { if(!isFrameworkAdminPath(req.path)) return next(); requireAuth(req,res,()=>requireSuperAdmin(req,res,next)); })`.
The classifier `isFrameworkAdminPath()` (in `backend/lib/admin-path-gate.ts`) is the SINGLE shared source of truth for the prefix list, the non-`/admin` exact/prefix admin paths (`/competency/{cohorts,versions,engine-summary}`, `/commercial/razorpay/{plan,refund}`, `/competency/items/:id`), AND the intentionally-public exempt reads (`/sdi/{domains,subdomains,items,clusters}`, `/lbi/clusters`, `/commercial/razorpay/{subscribe,payment-link,verify,webhook}`). `req.path` under an `app.use('/api', …)` mount is mount-relative (e.g. `/lbi/admin/foo`). Inline guards on the individual routes are now defense-in-depth, not the sole protection.

**CRITICAL gotcha — case-insensitive routing:** Express route matching is case-INSENSITIVE by default ("case sensitive routing" is off), so `/api/LBI/admin/foo` reaches a route registered as `/api/lbi/admin/foo`. A path-classification gate MUST normalise case (lowercase the path) before matching, or a mixed-case URL evades the gate entirely. Lowercasing is the fail-safe direction — it can only gate MORE, never expose an admin path. Also strip a single trailing slash. (This was the one blocking defect caught in code review of the structural fix.)

**Behaviour change (acceptable / security-positive):** unauth requests to flag-OFF `commercial`/`invoice` admin endpoints now return 401 BEFORE the 503 flag-gate; the `/sdi/admin/domains-legacy` 301 redirect now requires auth for unauth callers.

**Regression tests:** two complementary tsx tests.
- `backend/tests/admin-auth-guard.test.ts` mounts the REAL framework route modules with reject-guards + a stub pool and asserts every enumerated admin route is 401/403 unauthenticated (proves inline guards exist). Gotchas: flag-gated surfaces (commercial/invoice) 503 BEFORE auth → set their `FF_*` envs ON; a new non-`/admin`-segment admin read must be added to `ADMIN_NON_PREFIXED`.
- `backend/tests/framework-admin-gate.test.ts` reconstructs the structural mount gate over throwaway GUARD-LESS canary routes (one per prefix/exact path) and asserts they're blocked anyway — proving the structural guarantee even when a route forgets its inline guard. Includes mixed-case canaries (`/api/LBI/admin/…`) to lock in the case-insensitivity fix.

**How to apply when adding a new framework admin route:** still add `requireAuth, requireSuperAdmin` inline (defense-in-depth), AND if it's a new prefix or a non-`/admin`-segment admin path, add it to the lists in `lib/admin-path-gate.ts` so the structural gate covers it. Confirm intentionally-public assessment-flow reads go in `FRAMEWORK_ADMIN_PUBLIC_EXEMPT`, not gated.
