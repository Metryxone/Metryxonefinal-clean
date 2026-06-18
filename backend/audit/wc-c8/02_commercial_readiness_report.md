# WC-C8 · Deliverable 2 · Commercial Readiness Report

**Generated:** 2026-06-10T09:56:20.133Z

---

## Commercial Layer State

| Component | State | Evidence |
|---|---|---|
| Subscription packages | **13 seeded** (WC-C6B: ₹299–₹1499) | subscription_packages table |
| Student subscriptions | **0** active | student_subscriptions = 0 rows |
| B2C payments total | **6** | capadex_payments |
| B2C payments paid | **0** | status='paid' |
| B2C payments pending | **6** | status='pending' (includes demo orders) |
| Revenue collected | **₹0** | 0 paid transactions |
| Cross-SKU expansion | **ABSENT** | Identity bridge (email on users table) missing |
| Upsell triggers built | **1/3** | stage_ladder_progression only; at_risk/power_user not built |
| Refund route | **ABSENT** | No POST /api/capadex/payment/refund |

---

## Razorpay Integration Completeness

| Feature | Status | Notes |
|---|---|---|
| Order creation | ✅ COMPLETE | POST /api/capadex/payment/create-order |
| HMAC verification | ✅ COMPLETE | POST /api/capadex/payment/verify |
| Webhook handler | ✅ COMPLETE | POST /api/capadex/payment/webhook (payment.captured / order.paid) |
| Post-payment unlock | ✅ COMPLETE | startNextStageAfterPayment → /api/capadex/session/start |
| Admin dashboard | ✅ COMPLETE | GET /api/admin/capadex/payments |
| Demo mode fallback | ⚠️ PRESENT | Returns demo order when RAZORPAY_KEY_ID missing — verify keys are set in prod |
| Refund route | ❌ ABSENT | Not implemented |

---

## B2C Stage Ladder

| SKU | Label | Price | Status |
|---|---|---|---|
| CAP_INS | Insight | ₹499 | Live (Razorpay) |
| CAP_GRW | Growth | ₹999 | Live (Razorpay) |
| CAP_MAS | Mastery | ₹1999 | Live (Razorpay) |

⚠️ **STAGE_PRICES lockstep**: Prices defined independently in subscription-engine.ts, upsell-engine.ts,
and routes/capadex-payments.ts. All three must stay in lockstep.

---

## Commercial Readiness Verdict

- **Infrastructure readiness (structural):** HIGH — Razorpay, package catalog, subscription schema all exist.
- **Activation readiness:** ZERO — 0 paid conversions, 0 active subscriptions. Cold start only.
- **Missing for paid launch:** refund route + customer support path (pre-launch blocker).
- **Missing for package subscription:** identity bridge (cross-SKU) + self-serve checkout page.
- **Intelligence chain in production:** OFF (FF_* flags absent from prod deploy) — paid users would receive the same stripped-down experience as free users.

**Bottom line:** Payment infrastructure is ready. Commercial activation is zero. The single hardest pre-launch
requirement is a refund/dispute path — without it, paid consumer launch creates legal and support risk.
