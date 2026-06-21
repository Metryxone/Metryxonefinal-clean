# Payment Management — Operational Report

**Date:** 2026-06-21 · **Environment:** development · **Status:** ✅ Operational

> Coverage vs Confidence reported separately. Payments run on Razorpay **TEST** integration in dev; no live settlement volume exists.

## Purpose
Handles payment capture, verification, refunds, credit notes / invoices, and a store-credit ledger — with security invariants that fail **closed**.

## Architecture
- **Flags:** `commercialRazorpayRecurring` (recurring), `invoiceGstEngine` (GST-compliant invoices / credit notes).
- **Substrate:** `capadex_payments` (paid ledger), `comm_refund*`, store-credit ledger tables.
- **Security invariants (from engineering memory, enforced in code):**
  - Payment verify requires **local ↔ gateway linkage** (IDOR protection).
  - Webhook fails **closed** when a secret is configured.
  - Idempotency null-replay → **409**, never 500.

## Evidence (`smoke-payment-engine.ts` — ALL PASS)
- **Refunds:** created; amount equals the recorded payment (₹49,900); carried `razorpay_payment_id`; status `processed`; subscription status unchanged (`active`); **no** spurious `refunded` lifecycle event; explicit amount override honoured (₹10,000).
- **Invoice / Credit Note:** accepts a `comm_refund` source (no source-type rejection) and **abstains only on GST determinability** — i.e. it refuses to fabricate a non-compliant document when the seller state code / buyer GSTIN is missing (honest, pre-existing guard).
- **Store credit:** issue ₹20,000 → balance ₹25,000 after a second issue; derived balance matches; apply ₹15,000 → ₹10,000; **overdraw fails closed (400)** with balance unchanged; ledger holds exactly 3 entries (2 credit + 1 debit).

## Coverage vs Confidence
| Axis | Result | Basis |
|------|--------|-------|
| Structural / Coverage | ✅ Operational | Refund, invoice-abstention, credit ledger, fail-closed overdraw all proven |
| Activation / Confidence | ⚠️ TEST keys only | No live Razorpay settlement; GST invoices abstain until seller state code configured |

## Honest gaps
- GST invoices/credit notes **cannot be issued in dev** until the seller state code is configured (engine correctly abstains rather than fabricate). This is a **production configuration** item, not a code defect.
- Razorpay is on TEST credentials; live capture/settlement needs production keys + webhook secret.

## Verdict
**Payment management operational ✓** — refunds, credit ledger, and compliance-abstention behave correctly and fail closed. Production go-live requires live keys + seller GST configuration.
