# Subscription Management — Operational Report

**Date:** 2026-06-21 · **Environment:** development · **Status:** ✅ Operational

> Coverage (path exists & exercised) and Confidence (real volume) reported separately. Dev DB carries no real subscribers; the lifecycle is proven via seeded ephemeral rows that self-clean.

## Purpose
Manages the full recurring-subscription lifecycle for the commercial spine: creation, activation, payment-failure handling, grace windows, expiry, renewal — with an append-only event ledger and exactly-once transition guarantees.

## Architecture
- **Flag:** `commercialSubscriptions` (default OFF → `/api/commercial/admin/subscriptions/*` 503, byte-identical legacy).
- **Recurring integration:** `commercialRazorpayRecurring` (hardened Razorpay TEST).
- **Substrate:** `comm_subscriptions` (instances across five segments) + append-only lifecycle event ledger; B2C validity-window model in `student_subscriptions`.
- **Canonical event set:** `activated, cancelled, created, downgraded, expired, payment_failed, renewed, trial_started, upgraded`.

## Evidence (`smoke-subscription-lifecycle.ts` — SMOKE PASSED)
- State machine: `active → past_due` on payment failure; `payment_failed` event records the lapse with `grace_until` + `grace_days(7)` in metadata.
- Grace logic: `in_grace` TRUE inside the window; `grace_elapsed` TRUE after; a grace sweep **inside** the window does **not** expire the sub; a sweep **after** the window transitions `past_due → expired` and appends an `expired` event.
- **Idempotency:** `markPastDue` idempotent (no duplicate event when already past_due); grace sweep idempotent (an expired sub is not re-expired); duplicate `Idempotency-Key` replays exactly-once (renew applied **once** despite two calls).
- Ledger invariants: event ledger grew `0 → 15`; **all event_types in the canonical set**; **no subscription has `period_end < period_start`**.
- Self-clean: no `@example.com` / SMOKE rows remained.

## Coverage vs Confidence
| Axis | Result | Basis |
|------|--------|-------|
| Structural / Coverage | ✅ Operational | Full lifecycle FSM + grace + exactly-once + ledger invariants proven |
| Activation / Confidence | ⚠️ Low in dev | No real recurring subscribers; lifecycle proven via seeded rows |

## Honest gaps
- Recurring Razorpay path is on **TEST** credentials; production recurring billing requires live keys.
- Real renewal/churn metrics need a real subscriber population (see Revenue Intelligence + Customer Success reports).

## Verdict
**Subscription management operational ✓** — lifecycle, grace handling, exactly-once transitions, and ledger integrity all verified.
