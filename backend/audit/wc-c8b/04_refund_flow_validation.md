# WC-C8B · Deliverable 4 — Refund Flow Validation

**Date**: 2026-06-10T10:57:52.282Z  
**Scope**: `POST /api/capadex/payment/refund` correctness + Razorpay sandbox testability.

## Static / live-probe evidence (passes regardless of Razorpay config)

| Check | Evidence | Result |
|---|---|---|
| Route exists | `POST /api/capadex/payment/refund` → HTTP 401 | ✅ PASS |
| Auth-gated | unauthenticated → 401 | ✅ PASS |
| Admin payments listing auth-gated | `GET /api/admin/capadex/payments` → HTTP 401 | ✅ PASS |
| DEMO_ rejection logic | source: rejects when `razorpay_payment_id` starts `DEMO_` | ✅ PASS (static assertion — code verified 2026-06-10, not re-derived at runtime) |
| Status guard | source: only `status='paid'` is refundable | ✅ PASS (static assertion — code verified 2026-06-10, not re-derived at runtime) |
| Audit logging | source: writes `capadex_audit_events` (`payment_refunded` / `payment_refunded_local`) | ✅ PASS (static assertion — code verified 2026-06-10, not re-derived at runtime) |

## Razorpay sandbox smoke-test

| Check | Evidence | Result |
|---|---|---|
| Razorpay keys configured | RAZORPAY_KEY_ID/SECRET **absent** | ❌ FAIL |
| Webhook secret configured | RAZORPAY_WEBHOOK_SECRET **absent** | ❌ FAIL |
| Real (non-DEMO) paid charges in DB | 0 | informational (0 — DEMO mode) |
| End-to-end sandbox refund executed | **not runnable — no keys** | ⏸️ NOT TESTABLE |

## Honest finding

The refund route is **implemented, auth-gated, and logically correct** (DEMO rejection, status
guard, audit trail). But Razorpay is **not configured at all** — `getRazorpay()` returns null, so
the platform runs in **DEMO payment mode**. Consequences:

- No real charge can be created, so no real charge can be refunded.
- The live Razorpay refund API path (`/v1/payments/:id/refund`) is **structurally untestable** until `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set.
- In DEMO mode the refund route degrades to a **local-only** status flip — useful for staging, but it does **not** exercise the money path.

## Owner action to close (Paid Pilot only)

1. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys for sandbox), `RAZORPAY_WEBHOOK_SECRET`.
2. Create-order → pay (test card) → verify → **refund** against the Razorpay sandbox; confirm `refund_id` returned and `status='refunded'` + audit row written.
3. Repeat once with live keys before taking real money.

**Verdict**: route READY; sandbox smoke-test ⏸️ NOT TESTABLE (blocked on Razorpay config).
