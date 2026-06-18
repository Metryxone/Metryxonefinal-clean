# Competency Assessment — Commercial Readiness

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Questions:** Would customers pay? Would customers renew?
**Verdict:** **Gated-Real, Pre-Revenue.** The commercial spine is built and audited as structurally near-complete, but **zero real transactions** exist and enforcement flags are OFF. Willingness-to-pay and renewal are **unproven by construction.**

---

## 1. What exists (Structural)

| Capability | Status | Evidence |
|---|---|---|
| Subscription packages | Built | `subscription_packages` table; tiers defined |
| Pricing tiers | Defined | entitlement tiers (Curiosity/Insight/Growth/Mastery); B2C stage prices |
| Payments | Integrated | Razorpay (`capadex_payments`), webhook/verify, idempotency |
| Entitlement engine | Built | `requireEntitlement`, `deriveEntitlement` |
| Assessment credits / usage | Structural | metering primitives |
| Invoicing/GST | Built (flagged) | invoice-GST engine |

## 2. What is NOT happening (Activation)

| Metric | Live value | Reading |
|---|---|---|
| Real payments captured | **₹0** | `capadex_payments` ≈ demo/pending, 0 paid |
| Entitlement enforcement | **OFF** | `commercialEntitlementEnforcement` flag false by default → no live paywall |
| Subscriptions sold | **0** | no renewal population can exist |
| `subscription_packages` rows (live) | **0** | sellable catalog empty live |
| Razorpay mode | **Demo** | no live transaction confirmation |

## 3. Package-by-package readiness

| Package | Structural | Sellable today? | Note |
|---|---|---|---|
| Student | ✔ | Pilot-only | price untested; value real but cold-start |
| Professional | ✔ | No | needs activated ontology/EI/benchmarks |
| Institution | ✔ | **Concierge pilot** | best near-term revenue path (B2B2C) |
| Employer | ✔ | **Gated pilot** | talent-intel value; no hiring-prediction selling |
| Enterprise | ○ | No | needs compliance/validity/scale |

## 4. Pricing & packaging honesty

- Prices are **defined but never market-tested**; no conversion, ARPU, or churn data.
- No proven value-metric (per-assessment? per-seat? per-cohort?) validated with a paying customer.
- Renewal is **not measurable** — there is no renewable population (0 subscriptions). (Consistent with prior `wc-c5-renewal-readiness` finding: establish a renewable population first.)

## 5. "Would customers pay / renew?"

- **Pay:** plausible for **institutions** (concierge B2B2C) and **gated employer** talent intelligence, where the explainable, behaviourally-grounded output is differentiated. Unproven for standalone student/professional self-serve.
- **Renew:** unprovable today; renewal depends on **demonstrated outcomes** (placements, EI lift) which require the validity flywheel to spin first.

## 6. Commercial Verdict

> **Beta/Not-Ready commercially.** The machinery to charge exists; the proof that anyone *will* pay or renew does not. **First commercial motion: 1–2 paid institution pilots + 1 gated employer pilot**, instrumented to produce the outcome and willingness-to-pay evidence that unlocks broader monetisation. Do not enable self-serve paywalls or publish pricing as "launched" until at least one cohort has transacted and renewed.
