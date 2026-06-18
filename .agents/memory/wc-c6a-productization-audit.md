---
name: WC-C6A Subscription Productization audit
description: Methodology + honest findings for auditing whether a subscription PRODUCT architecture can recur — name-collision guard, seed-as-stub, cross-audit tier consistency, empty-catalog framing.
---

# WC-C6A — Subscription Productization audit (AUDIT ONLY · read-only · recompute from runtime)

Question answered: does CAPADEX have a commercially viable subscription PRODUCT architecture capable of recurring revenue? Four axes scored SEPARATELY (Structural / Activation / Coverage / Confidence), never combined.

## Durable methodology rules
- **Name-collision guard.** When your audit metric name already exists in a prior audit (WC-C1 owns "Subscription Readiness" = a 6-cell Success-Metric-3), recompute the PRIOR metric on ITS OWN denominator and show it side-by-side; name yours distinctly ("Subscription Model Readiness (WC-C6A)") as an explicit SUBSET of your larger checklist (same capability IDs + tiers, carry a membership map).
  **Why:** silently reusing a name on a new denominator looks like a regression/improvement that never happened; reviewers FAIL silent name reuse.
- **Seed-as-stub.** A seed that inserts catalog rows with NO price / NO validity_days / NO question_count (schema nullable, no default) produces an UNPRICED + null-expiry catalog even if run → not sellable, not renewable (renewal needs `expiry_date NOT NULL`; null validity → null expiry → 0 renewable). Tier it `stub(2)`; every remediation path must say FIX the seed first. "Just run the seed" is NEVER a sufficient fix.
- **Cross-audit tier consistency.** An unexercised real-keys payment path (Razorpay keys absent → only the DEMO fallback ever ran) is `gated_real(4)`, NEVER `real(5)` — must match WC-C1 `order_creation` gated-real. Distinguish from SKU *presentation*, which IS exercised (pending order rows prove the route serves priced SKUs) → `real(5)`.
  **Why:** contradicting a prior audit's tier on the same capability is an honesty failure (architect FAILed exactly this on first pass: b2c_order_payment_flow real→gated_real, Productization 63%→62%).
- **Empty catalog framing.** Report a measured COUNT ("0 products defined"), never "0%" (0% of what target = fabrication). Derived population fractions are `0/0 → not_measurable` (null). Catalog Readiness = COUNTS + per-axis verdicts, NOT a blended third %.
- **90% Commercial Activation is EARNED, not engineered.** Activation% only climbs with real revenue (real keys + paid rows + live renewable population + ≥2 monthly forecast points). Only Structural is reachable by wiring. DESCRIBE the path, never execute it in an audit.
- **Demo payments ≠ demand.** Pending rows under an unconfigured Razorpay are demo/mock (WC-C1 payments_demo=6); never count them as demand.

## Honest finding (this run, deploy posture, no FF_* overrides, degraded=false)
CAPADEX has ONE real live product family — the **B2C stage ladder** (CAP_INS ₹499 / GRW ₹999 / MAS ₹1999) — which is **one-time by design** (`renewal_not_applicable_b2c`). The only renewal-CAPABLE model (validity-window `subscription_packages`) has **0 products** (schema + admin CRUD real; catalog empty; seed is a stub). Package→entitlement mapping is ABSENT (WC-C2). No renewal reminder / recurring / repurchase loop. **Recurring revenue today = NONE.**
- Productization Readiness = **62% Structural / 10% Activation** (2/20 fire: ladder SKU presentation + B2C pricing).
- Subscription Model Readiness (WC-C6A subset, 11 caps) = **45.5% / 0%**; WC-C1 SM3 recomputed = **83.3% / 0%** (differs because SM3 credits ladder+persistence+admin CRUD; the subset isolates the renewable-product machinery, mostly absent).
- Highest-leverage first move: define a SELLABLE + renewable package catalog (fix seed → populate) — every downstream subscription/renewal/recurring metric is zero-denominated by the empty, unpriced catalog.
