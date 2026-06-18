# WC-C3 · Deliverable 1 — Entitlement Enforcement Report
_Generated 2026-06-10T06:54:23.489Z. Read-only recompute over the live route surface + entitlement engine._

## What enforces paid-tier access today: NOTHING
- The resolver **`deriveEntitlement(pool, email)`** is **REAL and fail-closed** (live recompute: paying=0, entitled=0, coverage=n/a (no payers), degraded=false). It maps owned paid stages → features via `STAGE_FEATURES` and returns the union.
- **No caller consumes it at access time.** Across **143 route files / 1941 enumerated routes**, the number of `requireEntitlement`/`requirePlan`/`requireMembership` tier guards is **0**. Access is governed solely by RBAC (`requireAuth`/`requireAdmin`/`requireSuperAdmin`), which **never** consults entitlement.
- The **13 paid-tier CAPADEX endpoints** are served on **session-UUID possession** + the `isRuntimeIntelligenceActivationEnabled()` flag (15 uses in capadex.ts). The UUID is a **bearer token**: anyone holding it fetches the deeper report regardless of payment. The only thing stopping non-payers is the frontend choosing not to call.

## Stage → feature map (lockstep verified by source-introspection)
| Constant | Source | Keys |
|---|---|---|
| STAGE_PRICES | routes/capadex-payments.ts | CAP_INS · CAP_GRW · CAP_MAS |
| STAGE_FEATURES | services/wc7c/entitlement-engine.ts | CAP_INS · CAP_GRW · CAP_MAS |
| LADDER | entitlement / subscription | CAP_INS → CAP_GRW → CAP_MAS |

Stage-keys consistent: **YES ✅** · Ladder consistent: **YES ✅**.

## Entitlement Enforcement Readiness (dual-axis — never composited)
**Structural 48% (12/25) · Activation 0% (0/5)**

| Dimension | Structural tier | After keystone (projection) | Note |
|---|---|---|---|
| entitlement_resolver | real (5/5) | real (5/5) | deriveEntitlement(pool,email) + buildEntitlementOverview: read-only, FAIL-CLOSED on ledger error, unions owned paid stages → features. EXISTS and correct — but NO caller consumes it at access time (live recompute: paying=0, entitled=0). |
| enforcement_middleware | absent (1/5) | gated-real (4/5) | requireEntitlement/requirePlan/requireMembership tier guard: NONE in the entire live route surface. Only RBAC (requireAuth/requireAdmin/requireSuperAdmin) exists, which never consults entitlement. DEPENDENT with report_endpoint_protection — one build flips both. THIS IS THE KEYSTONE. |
| report_endpoint_protection | absent (1/5) | gated-real (4/5) | 13 paid-tier CAPADEX report/intelligence endpoints carry NO entitlement check (and no RBAC) — gated only by session-UUID possession + isRuntimeIntelligenceActivationEnabled() flag (15 flag uses in capadex.ts). UUIDs act as bearer tokens. Dependent on enforcement_middleware. |
| fulfillment_access_provisioning | partial (3/5) | gated-real (4/5) | SPLIT — notification fulfillment is REAL (confirmation email + WhatsApp + capadex_audit_events payment_completed) | access-provisioning is MISSING (paid status flip unlocks nothing). The keystone guard provisions access as a side-effect (the paid stage finally serves). |
| activation_path_wiring | stub (2/5) | gated-real (4/5) | Path to turn enforcement ON exists but is inert: commercialEntitlement flag default=false, no consumer wired, Razorpay unconfigured (demo mode), 0 paid rows. Flag + keys + a real txn complete it. |

> `enforcement_middleware` and `report_endpoint_protection` are **dependent** (no middleware ⇒ no endpoint protection): **one build flips both**. The post-keystone projection caps flag-gated cells at **gated-real(4)** while `commercialEntitlement` defaults OFF — structural only, **never activation**.

Activation enablers (deploy posture):
- [ ] commercialEntitlement flag ON (config default) — default=false
- [ ] requireEntitlement consumer wired to paid endpoints — no tier guard anywhere
- [ ] live paid payment rows (entitlement data) — 0 paid / 6 total
- [ ] real Razorpay keys (non-demo) — configured=false
- [ ] one real paid txn proves verify→entitled→access — 0 distinct paid identities

## The keystone (one build, two cells)
A single `requireEntitlement(feature)` middleware that calls `deriveEntitlement(pool, email)` and 403s when the required feature is absent, applied to the paid-tier endpoints. For ladder stages this flips **access_enforcement** AND **access-provisioning** at once. It does **not** cover packages (entitlement-disjoint).
