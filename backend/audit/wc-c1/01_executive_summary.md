# WC-C1 · Commercial Wave 2 Readiness Audit — Executive Summary
_Generated 2026-06-10T05:14:29.718Z. AUDIT ONLY · read-only · no schema/deploy · STOP FOR APPROVAL. All figures recomputed live from runtime state; emails sha256-masked._

## Method (two axes, never blended into one number)
- **Structural** = does the code/engine/route/table-definition exist? (real=5 / gated-real=4 / partial=3 / stub=2 / absent=1, normalized).
- **Activation** = is it live in the **deploy posture**? A count of binary enablers present (flag-ON by config default · real keys · live data · user-reachable consumer). The dev workflow forces `FF_COMMERCIAL_ACTIVATION=1` — a **footnote only**, not a deploy enabler.
- **Coverage** (asset/data exists) and **Confidence** (live/trustworthy) are reported separately throughout.

## The four required readiness percentages (each a pair, with denominator)
1. **Current Commercial Readiness** — Structural **80%** (24/30) · Activation **0%** (0/6) · _denominator: 6 WC-7C lifecycle capabilities_
2. **Revenue Readiness** — Structural **80%** (20/25) · Activation **0%** (0/5) · _denominator: 5 payment-pipeline cells_
3. **Subscription Readiness** — Structural **83.3%** (25/30) · Activation **0%** (0/5) · _denominator: 6 subscription-system cells_
4. **Product Monetization Readiness** — Structural **13.3%** (4/30) · Activation **0%** (0/3) · _denominator: 6 products × 5 wiring cells_

> **Headline:** the platform is **structurally mid-to-high but commercially un-activated**. Every commercial engine exists and is honest; **Activation is ~0% across all four metrics** because Razorpay keys are absent (DEMO mode), **₹0 has ever been captured**, the catalog/subscription tables are empty, and 6 of 7 commercial flags default OFF. This is a **cold-start / unexercised** posture, NOT a broken pipeline.

## Coverage vs Confidence (one line)
- **Coverage:** commercial *engines* are broadly present (Structural 80% lifecycle). **Confidence:** ~0 — no engine has run against real money or real catalog data.

## Missing components (severity-ranked)
- **[BLOCKER (paid launch)]** Real Razorpay keys (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) → _unlocks:_ Revenue Activation; verifies the payment pipeline end-to-end
- **[BLOCKER (monetization)]** Access-time entitlement enforcement guard (requireEntitlement consuming entitlement-engine) → _unlocks:_ Product Monetization access_enforcement cell; tier gating
- **[HIGH]** Seeded subscription_packages catalog (currently 0 rows) → _unlocks:_ Subscription + Renewal Activation; package purchases
- **[HIGH]** parent_subscriptions table (referenced in code, ABSENT in live DB) → _unlocks:_ Parent plan tier (basic/family/premium) enforcement
- **[HIGH]** Un-gate commercial flags + wire live user-facing consumers (6 of 7 default OFF) → _unlocks:_ Commercial Activation across entitlement/renewal/upsell/lifecycle/forecast/revenue
- **[MEDIUM]** Decision→package mapping (no detected outcome/journey → package today) → _unlocks:_ Upgrade-path automation; offer targeting
- **[MEDIUM]** Behavioural upsell triggers (at_risk / power_user — named, not built) → _unlocks:_ Upsell beyond stage-ladder progression
- **[MEDIUM]** Mentor booking substrate (mentor_bookings table absent; mentors=0) → _unlocks:_ Mentor product fulfillment + monetization
- **[MEDIUM (data, time-bound)]** Conversion telemetry volume (0 payment_completed events) → _unlocks:_ Revenue/conversion forecasting (needs ≥2 monthly points)

## Fastest path to **Paid Consumer Launch** (minimal critical path — B2C CAPADEX ladder, the only product with a real SKU)
1. **Add real Razorpay keys** (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) — flips DEMO→live; the order-create / signature-verify / webhook code already exists.
2. **Verify ONE real payment end-to-end** (order → capture → `status='paid'` → `payment_completed` event) — converts the pipeline from *gated-real/unverified* to *real*.
3. **Wire an access-time entitlement guard** that consumes `entitlement-engine.deriveEntitlement(email)` so a paid stage actually unlocks the deeper experience (today nothing enforces it).
4. **Un-gate `commercialActivation`** in the deploy posture + surface the activation/offer envelope in the live UI.
> Steps 1–4 require **no new engine and no new table** — they are key-config + one guard + flag enablement. That is the genuine shortest path; everything downstream (packages, renewal, upsell) is additive.

## Fastest path to **95% Commercial Readiness**
- **Structural → ~95%** needs the few *real(5)* upgrades that an audit cannot grant: un-gate each lifecycle flag **and** wire a live consumer for each (entitlement enforcement, renewal reminder job, upsell surface, lifecycle/forecast admin consumer). See `10_commercial_expansion_roadmap.md` for the per-cell checklist.
- **Activation → ~95% is NOT reachable by configuration alone** — it requires *real paid volume* (paid rows, captured ₹, ≥2 monthly points per series, seeded packages). That is earned by live commerce over time, not built. **Honest statement: Structural 95% is reachable with focused wiring; Activation 95% is a function of real revenue, not engineering.**

## Reconciliation with the same-day `commercial-wave-2` audit
Recomputed Commercial Structural = **24/30 (80%)**, Activation **0%** — consistent with the prior baseline (24/30 = 80% · 0%). This audit *recomputes* (does not copy) and extends to products, subscriptions, revenue, and monetization. Per-deliverable reconciliation tables are included in 07/08/09.

> _Reconciliation nuance: the 6 lifecycle **structural tiers** are re-asserted engineering judgments identical to wave-2, so structural consistency is partly **by construction**. The **resolver figures** (entitlement/renewal/upsell/lifecycle/forecast/revenue counts) are genuinely **recomputed** against the live DB this run — those are the numbers that would have caught any drift._
