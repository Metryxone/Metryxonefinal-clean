# Career Builder — Commercial Readiness

**Date:** 2026-06-18
**Honesty contract:** Structural (commerce code exists) vs Activation (real entitlements/sales in live DB) reported separately. seeded ≠ sold.

---

## Commercial substrate (Structural)

Two layers coexist:
- **Legacy B2C "ladder" (CAPADEX):** three paid stages — `CAP_INS` (₹499), `CAP_GRW` (₹999), `CAP_MAS` (₹1999) — via Razorpay (`capadex-payments.ts`).
- **Modern Commercial Spine (Phase 7):** `comm_*` suite (`comm_products`, `comm_plans`, `comm_entitlement_grants`); admin via `AdminPricingPage.tsx`; 7 feature classes (views/searches/reports/…).

**Enforcement (Structural — sound):**
- `entitlement-engine.ts` unions paid CAPADEX stages with active package grants.
- `require-entitlement.ts` middleware gates report types (`insight_report`, `growth_report`, `mastery_report`); **fail-closed** on DB error (good).
- Demo mode returns `DEMO_` order IDs when Razorpay keys absent.

**Structural score: ~70.**

---

## Activation reality (live DB)

- Career Builder itself is **not directly paywalled** — its tabs are largely open; monetization is on CAPADEX stages and report entitlements, not Career Builder feature gates.
- Live commercial data is **near zero**: no evidence of real package sales; heavy reliance on **manual super-admin grants** (`comm_entitlement_grants`) to bypass incomplete automated flows.
- Razorpay runs in **demo mode** absent live keys.
- No subscription population to renew/upsell against (consistent with prior commercial-wave audits: compose-only layer over an empty revenue substrate).

**Activation score: ~18.**

---

## Commercial gaps

1. **No clear Career Builder monetization unit.** Value is delivered free in-tab; paid entitlements sit on CAPADEX reports, so the Career Builder experience itself has no priced SKU.
2. **No live sales.** Revenue substrate empty; renewal/upsell un-measurable (0/0).
3. **Manual grants dominate** → not a scalable self-serve commercial flow.
4. **Pricing not validated** against willingness-to-pay for any segment (consumer/professional/institution).
5. **Employer/Enterprise pricing** depends on inert employer surfaces (`recruiter_interactions`=0) — cannot be exercised.

---

## Verdict

- **Structurally** the entitlement + payment machinery is real and fail-closed.
- **Commercially (Activation)** Career Builder has **no exercised revenue path of its own** and depends on a CAPADEX paywall + manual grants.
- **Commercial readiness: BETA.** A concierge institution deal can be transacted manually today; self-serve monetization of Career Builder is not ready. Do not claim commercial readiness as a number; report Structural ~70 / Activation ~18 separately.
