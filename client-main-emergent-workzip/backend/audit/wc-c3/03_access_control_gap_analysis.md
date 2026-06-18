# WC-C3 · Deliverable 3 — Access Control Gap Analysis
_Generated 2026-06-10T06:54:23.489Z. Two distinct axes, never merged: (A) ENTITLEMENT enforcement (monetization), (B) RBAC/SECURITY._

## Axis A — Entitlement enforcement gap (monetization)
- **Root cause:** the entitlement resolver exists but **nothing consumes it**. There is **no `requireEntitlement` middleware** anywhere (0 found across 1941 routes).
- **Blast radius:** 13 paid-tier CAPADEX endpoints served on session-UUID possession (deliverable 2). No backend paywall.
- **Fix:** the single keystone guard (deliverable 1 / roadmap U1+U2). Closes `access_enforcement` + `fulfillment`-provisioning for the CAPADEX ladder. **Does not** cover packages (entitlement-disjoint).

## Axis B — RBAC / security gap (NOT entitlement — quarantined from the entitlement %)
> Surfaced honestly because "which endpoints are unprotected" is a success criterion. This is a **security** finding and is **not** part of the entitlement readiness score.

- **212 of 623** `/api/admin/*` routes have **no route-level RBAC guard** (no inline guard, no spread guard, not covered by a global `app.use` prefix). The other 411 carry a route-level RBAC guard (inline, spread, or global app.use), so these 212 are deviations from the app's own convention.
- **Confirmed-unguarded sample** (file/handler inspected this session — no inline guard, no spread, no in-body auth token):
  - `GET /api/admin/capadex/payments` — routes/capadex-payments.ts:316
  - `GET /api/admin/capadex/users` — routes/capadex-enterprise.ts:767
  - `GET /api/admin/capadex/users/:id/journey` — routes/capadex-enterprise.ts:814
  - `GET /api/admin/capadex/analytics` — routes/capadex-enterprise.ts:858
  - `GET /api/admin/ci/categories` — routes/concern-intelligence-admin.ts:13
  - `PATCH /api/admin/ci/categories/:key` — routes/concern-intelligence-admin.ts:26
  - `GET /api/admin/ci/questions` — routes/concern-intelligence-admin.ts:69
  - `GET /api/admin/spe/dashboard` — routes/spe-scoring-engine.ts:365
  - `GET /api/admin/spe/scores` — routes/spe-scoring-engine.ts:398
  - `GET /api/admin/spe/users/:userId` — routes/spe-scoring-engine.ts:424
- **Severity highlights:** `routes/capadex-payments.ts` exposes **payment PII** (email/participant_name/amounts/razorpay ids) at `GET /api/admin/capadex/payments`; `routes/concern-intelligence-admin.ts` exposes a **state-changing migration** endpoint. Both to unauthenticated callers.
- **Per-file count of unguarded admin routes:**
  - routes/capadex-enterprise.ts: 14
  - routes/paie-forecasting.ts: 13
  - routes/paie-governance.ts: 12
  - routes/roie-governance.ts: 12
  - routes/roie-risk.ts: 12
  - routes/roie-opportunity.ts: 8
  - routes/concern-intelligence-admin.ts: 7
  - routes/lde-governance.ts: 7
  - routes/paie-intelligence.ts: 7
  - routes/tenants.ts: 7
  - routes/capadex.ts: 6
  - routes/ethics-governance.ts: 6
  - routes/paie-opportunity.ts: 6
  - routes/bios-frontier.ts: 5
  - routes/bios-simulation.ts: 5
  - routes/csi.ts: 5
  - routes/lde-intelligence.ts: 5
  - routes/roie-semantic.ts: 5
  - routes/spe-governance.ts: 5
  - routes/bios-agents.ts: 4

> **Limitation:** middleware-level static analysis. Endpoints doing auth *inside* the handler would be under-counted; the confirmed sample was inspected to avoid a false claim. A dedicated security pass should confirm each before remediation.

## Why the two axes must not be merged
Axis A is *monetization* (does payment control access?). Axis B is *security* (does role control admin access?). Compositing them would let an RBAC sweep inflate the entitlement number, or vice-versa. The entitlement readiness figure (deliverable 1) excludes Axis B entirely.
