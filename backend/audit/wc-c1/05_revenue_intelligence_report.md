# WC-C1 · Deliverable 5 — Revenue Intelligence Report
_Generated 2026-06-10T05:14:29.718Z. Offer · commercial-recs · pricing · package intelligence + Revenue Readiness._

## **Revenue Readiness** — Structural **80%** (20/25) · Activation **0%** (0/5) · _denominator: 5 payment-pipeline cells_

### Three separated facts (do not conflate)
1. **Pipeline Structural = gated-real (capped at 4/5).** order-create / HMAC verify / webhook handlers are real code — but the **real-keys path has NEVER executed end-to-end**, so it cannot score *real(5)*. **Unverified, not broken.**
2. **Activation = 0%.** Razorpay keys absent (DEMO), **₹0 captured**, 0 paid rows, **0 `payment_completed` events**. The 6 demo rows prove the *demo fallback* works — not the live pipeline.
3. **The rich behavioural substrate does NOT count as revenue readiness.** `wcl5_memory=94`, `wcl0_user_intelligence=9` are behavioural, not commercial; they must not leak into a revenue figure.

## Pipeline cells (structural)
| Cell | Tier | Note |
|---|---|---|
| order_creation | gated-real (4/5) | razorpay.orders.create wired (amount in paise); real-keys path UNEXERCISED (keys absent) → demo fallback only. Unverified, not broken. |
| signature_verification | gated-real (4/5) | HMAC-SHA256 verifySignature implemented; never executed against a real captured payment. |
| webhook_handling | gated-real (4/5) | payment.captured / order.paid handlers exist; RAZORPAY_WEBHOOK_SECRET absent → webhook path unverified. |
| revenue_intelligence | gated-real (4/5) | revenue-intelligence measures the real ledger (not estimates); gated revenueIntelligence (default OFF); ledger has ₹0 captured. |
| conversion_telemetry | gated-real (4/5) | capadex_audit_events logs payment_completed on capture; 0 such events recorded to date. |

## Activation enablers
| Enabler | Present | Detail |
|---|---|---|
| Razorpay keys configured | ❌ | RAZORPAY_KEY_ID/SECRET absent (DEMO mode) |
| webhook secret configured | ❌ | absent |
| captured revenue > ₹0 | ❌ | ₹0 captured |
| paid transactions > 0 | ❌ | 0/6 rows paid |
| conversion events > 0 | ❌ | 0 events |

## Revenue intelligence engine — live measurement (recomputed; REAL rows, not estimates)
| Metric | Value |
|---|---|
| Total / paid / pending / failed | 6 / 0 / 6 / 0 |
| Captured revenue | ₹0 |
| Session attribution coverage | 0% (0/0) |
| payment_completed events | 0 |
| Funnel | sessions=27, paid=0, ₹0 |

## Offer / pricing / package intelligence (existing assets)
- **Offer intelligence** (`offer-engine.ts`) — composes a per-session offer (subscription/report/product/growth_plan/mentor) with `offer_fit` (**directional, not a conversion probability**) + a **stub guard** that refuses to sell into unready products.
- **Pricing** — hardcoded ladder STAGE_PRICES (CAP_INS 499 / CAP_GRW 999 / CAP_MAS 1999), mirrored in subscription-engine.ts (kept in lockstep).
- **Commercial recommendations** — next unowned ladder rung (Insight→Growth→Mastery), behind the D6 high-confidence gate (≥0.7 + low ambiguity), else `show_options`.

## Honest statement
Revenue readiness is **structurally high but unproven** and **activation ≈ 0**. The fix is configuration + one real transaction, not engineering. ₹0 is a **cold start**, not a defect.
