# WC-C6A · Deliverable 8 — Recurring Revenue Report
_Generated 2026-06-10T08:50:05.250Z. Recomputed via commercial-forecast-inputs.ts (read-only)._

## Recurring revenue today: **NONE**
| Precondition for recurring revenue | State |
|---|---|
| A renewable product exists (priced + validity) | ✗ 0 priced/validity package products |
| A renewable population exists (active subscriptions) | ✗ 0 package subscriptions |
| A renewal candidate can be identified | engine real, but 0 renewable population |
| A reminder → repurchase / recurring loop acts on it | ✗ absent |
| The earning product can recur | ✗ B2C ladder is one-time by design |
| Forecastable revenue series (≥2 monthly points) | 0% (0/4) |

## Why
The model that **earns** (B2C ladder) cannot recur by design; the model that **can recur** (validity-window packages) has no priced products and no sales. There is no recurring billing or repurchase loop. The 6 pending B2C payments are **demo/mock** (WC-C1 payments_demo=6; Razorpay unconfigured) — adjacent one-time revenue at best, never recurring.

## Earliest recurring-rupee chain (DESCRIBED, not executed)
- 1. FIX the package seed to emit price + validity_days + question_count (current seed yields unpriced/null-expiry rows → unsellable + unrenewable). Seeding alone is NOT sufficient.
- 2. Populate the package catalog with priced, validity-bearing products (turns package_catalog_population absent→real).
- 3. Wire a self-serve package checkout (buyer Razorpay order → student_subscription grant with finite expiry).
- 4. Add a package→entitlement/feature mapping (packages are entitlement-disjoint today) and turn ON commercialEntitlementEnforcement.
- 5. Wire a renewal reminder → repurchase/recurring loop on the renewal-engine output.
- 6. Configure real Razorpay keys for capture (currently demo).

> Even with all 6 wired, Activation% only climbs as real catalog rows are SOLD, RENEWED, and RECUR over time. The 6 pending B2C payments are demo/mock (WC-C1 payments_demo=6), NOT demand.
