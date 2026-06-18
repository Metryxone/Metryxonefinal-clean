# WC-C2 · Deliverable 5 — Entitlement Roadmap
_Generated 2026-06-10T05:36:05.041Z. Ordered enabler checklist keyed to axis cells. AUDIT ONLY — nothing here is implemented._

> Honest framing: **Structural** cells are reachable by focused wiring. **Activation** is NOT reachable by configuration — it is a function of real revenue (keys + paid volume) earned over time.

## Shortest path (entitlement keystone) — in order
| # | Enabler | Cells it unlocks | Axis | One build? |
|---|---|---|---|---|
| 1 | **`requireEntitlement` guard** consuming `deriveEntitlement(email)`, applied to the report/stage endpoints | CAPADEX `access_enforcement` **+** `fulfillment`-provisioning (ONE build, TWO cells) | Structural · Product-Mon (a) 4/30→6/30 · Live-SKU (b) 60%→100% | Yes |
| 2 | **Un-gate `commercialEntitlement`** (config default OFF) | makes the engine live in the running env | Structural→Activation prerequisite | Yes (flag) |
| 3 | **Real Razorpay keys** (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) | exits demo mode | Activation prerequisite | Yes (secrets) |
| 4 | **One real paid transaction** end-to-end | proves verify→paid→entitled→access | Activation (first datapoint) | Earned, not built |

## Separate, larger track (NOT the shortest path) — packages
Only pursue if the institute/package SKU is a priority. Each item is real work, none unlocked by the keystone:
- Wire `deriveEntitlement` to ALSO read `student_subscriptions → subscription_packages`, resolving child/student ↔ billing identity.
- Add a **feature map** to `subscription_packages` (today: no feature-string column).
- Decide a package **order path** (self-serve checkout vs admin-grant) and seed the catalog (currently 0 rows).

## Productization track (NOT entitlement work) — only if you keep metric (a)
Reaching >90% on the WC-C1 6×5 metric requires building SKUs for LBI / Employability / Career Builder / Longitudinal and the Mentor stub. This is a product/business decision, explicitly out of entitlement scope.

## Fix-in-place (cheap, do alongside #1)
- Correct the `entitlement-engine.ts` header comment so it stops claiming package coverage the code doesn't provide (doc/code drift — deliverable 1).
