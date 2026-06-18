# WC-C5 · Deliverable 2 — Subscription Lifecycle Report
_Generated 2026-06-10T07:53:25.872Z. Recomputed via subscription-lifecycle.ts (read-only)._

## Two commercial surfaces
| Surface | Table | Renewal semantics |
|---|---|---|
| B2C stage ladder | `capadex_payments` | **renewal_not_applicable_b2c** — one-time progressive unlocks; a paid rung is permanently fulfilled |
| Package subscriptions | `student_subscriptions` | **renewable** — validity-window (`expiry_date`); the ONLY model with a renewal concept |

## B2C ladder state (live, recomputed)
- Total rows: **6** — pending=6, fulfilled(paid)=0, abandoned(failed)=0.

## Package subscription state (live, recomputed)
- Total rows: **0** — active=0, expiring_soon=0, expired=0, cancelled=0 (window=14d).

## Lifecycle capability
- **EXISTS & deterministic** (real, 5/5): `classifySubscriptionState` / `classifyLadderState` recompute states from `status`+`expiry_date` with no persistence.
- **Empty substrate**: 0 package subscriptions → the renewable lifecycle has **no rows to transition**. The classifier is correct; it simply has nothing to classify.
