# WC-C3 · Deliverable 5 — Enforcement Roadmap
_Generated 2026-06-10T06:54:23.489Z. Ordered enabler checklist + honest effort sizing. AUDIT ONLY — nothing here is implemented._

## Shortest path to monetization enforcement — in order
| # | Enabler | Cells it unlocks | Axis | Size |
|---|---|---|---|---|
| U1 | **`requireEntitlement(feature)` middleware** consuming `deriveEntitlement(email)` → 403 | enforcement_middleware + report_endpoint_protection (one build, two cells) | Structural · entitlement | S |
| U2 | **Apply to the 13 paid-tier endpoints** + endpoint→feature lookup | report_endpoint_protection · fulfillment-provisioning | Structural · entitlement | S |
| U3 | **Un-gate `commercialEntitlement`** (default OFF) | makes the guard live in-env | Activation prerequisite | XS |
| U4 | **Real Razorpay keys** (KEY_ID/SECRET/WEBHOOK_SECRET) | exits demo mode | Activation prerequisite | S |
| U5 | **One real paid transaction** end-to-end | proves verify→paid→entitled→access | Activation (first datapoint) | earned, not built |

Result: Live-SKU metric (b) → **100%** structural; Product-Mon metric (a) → **20%**; Enforcement Readiness structural **48% → 84%** (gated-real cap while flag OFF).

## Effort sizing — countable units (snapshot-backed)
| Unit | Work | Axis | Size |
|---|---|---|---|
| U1 | Write ONE requireEntitlement(feature) middleware calling deriveEntitlement(pool,email) → 403 when feature absent | Structural (entitlement) | S |
| U2 | Apply the guard to the 13 paid-tier CAPADEX endpoints + a small endpoint→required-feature lookup | Structural (entitlement) | S |
| U3 | Un-gate commercialEntitlement (config default OFF) | Activation prerequisite | XS |
| U4 | Configure real Razorpay keys (KEY_ID/SECRET/WEBHOOK_SECRET) — exits demo mode | Activation prerequisite | S |
| U5 | Guard the 212 unguarded /api/admin/* endpoints (RBAC/security — SEPARATE track from entitlement) | Structural (RBAC/security) | M |
| U6 | Fix entitlement-engine.ts header doc/code drift (claims package coverage the code lacks) | Hygiene | XS |

### Estimate — judgment, not measurement
> The following day-band is engineering judgment over the countable units above, **not** a measured value, and deliberately does **not** appear in `_wc_c3_snapshot.json`. Assumes a developer familiar with this codebase, no new schema, no new product.
- **Entitlement keystone (U1–U3):** ~**0.5–1.5 engineering days** — one middleware, ~13 route applications, a small feature lookup, one flag flip.
- **Activation prerequisites (U4):** ~**0.25 day** of ops to add real keys (then U5 is earned over time, not estimable).
- **RBAC/security sweep (U5, separate track):** ~**1–3 days** scaling with the **212** unguarded admin endpoints — confirm each (in-handler checks), then apply `requireAuth, requireSuperAdmin`. This is security, **not** monetization.

## Separate, larger track (NOT the shortest path) — packages
Only if the institute/package SKU is a priority — none of this is unlocked by the keystone:
- Wire `deriveEntitlement` to also read `student_subscriptions → subscription_packages` (resolve child/student ↔ billing identity).
- Add a **feature map** to `subscription_packages` (today: no feature-string column).
- Choose a package **order path** and seed the catalog (currently 0 rows).

## Productization track (NOT entitlement) — only if you keep metric (a)
>90% on the WC-C1 6×5 metric requires building SKUs for LBI / Employability / Career Builder / Longitudinal and the Mentor stub. Product/business decision, out of enforcement scope.

## Hygiene (cheap, alongside U1)
- Fix the `entitlement-engine.ts` header comment (claims package coverage the code does not provide).
