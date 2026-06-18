# WC-C8A: Refund Route + Payments Auth Check

**Date**: 2026-06-10T13:58:16.463Z  
**Gate**: G15 — Refund Capability (Paid Pilot)  

| Check | HTTP Status | Result |
|---|---|---|
| POST /api/capadex/payment/refund (unauthenticated) | 401 | ✅ Route exists, correctly auth-gated |
| GET /api/admin/capadex/payments (unauthenticated) | 401 | ✅ Correctly auth-gated (was OPEN) |

## Refund Route Implementation

- `POST /api/capadex/payment/refund` added to `backend/routes/capadex-payments.ts`
- Guards: `requireAuthLocal` + `requireSuperAdminLocal` (local helpers defined in same file)
- Flow: lookup paid row → reject DEMO_ orders → call Razorpay refund API → update status → write `capadex_audit_events`
- Razorpay not configured: degrades gracefully — marks refunded locally, does NOT crash

## Admin Payments Auth

- `GET /api/admin/capadex/payments` now guarded by `requireAuthLocal + requireSuperAdminLocal`
- Before: **OPEN — leaked participant names, emails, amount_paise** (PII exposure)
- After: 401/403 for unauthenticated/non-admin callers

## G15 Before vs After

| Metric | Before (WC-C8) | After (WC-C8A) |
|---|---|---|
| Refund route | ❌ MISSING | ✅ Implemented |
| Admin payments auth | ❌ OPEN (PII) | ✅ Auth-gated |
