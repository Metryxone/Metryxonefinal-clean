---
name: WC-C1 commercial readiness audit
description: Dual-axis (Structural vs Activation) commercial-readiness measurement discipline for the WC-7C commerce stack — how to score without inflating.
---

# WC-C1 Commercial Readiness audit — durable rules

Measuring "is this platform monetizable?" over the WC-7C commerce engines
(subscription / offer / entitlement / renewal / upsell / commercial-forecast-inputs /
revenue-intelligence) plus the CAPADEX payment ladder.

## Dual-axis is non-negotiable
- **Structural** = code/engine/route/table-def EXISTS (build maturity).
- **Activation** = flag-ON in the *running* env + live data + user-reachable + (payments) real keys + real paid volume.
- NEVER composite the two into one number. Each success metric is a `(Structural%, Activation%)` PAIR with a stated denominator.
- **Why:** the stack scores ~80% Structural but **0% Activation** — the engines are built but dormant/unsold. A blended number would hide exactly the gap the audit exists to find.
- **How to apply:** Activation 95% is a function of *real revenue earned over time* (paid rows, captured ₹, ≥2 monthly points/series, seeded packages, real keys, un-gated flags, wired consumers) — an audit/engineering pass CANNOT grant it. Say so explicitly. Structural 95% IS reachable by focused wiring.

## Scoring honesty traps
- **Cap unexercised integrations at gated-real(4), never real(5).** Razorpay code is complete but keys are absent and the real-keys path never ran e2e → "unverified, not broken". Scoring it real(5) would fabricate proven capability.
- **A binary structural cell needs a literal mechanism, not a "conceptual" link.** Product-monetization is scored per-product over 5 wiring cells (priced_sku · order_path · pay_to_entitlement · access_enforcement · fulfillment). `pay_to_entitlement` is true ONLY if the entitlement map names a literal feature string for that product: `STAGE_FEATURES` (entitlement-engine.ts) = CAP_INS→insight_report, CAP_GRW→growth_report/growth_plan, CAP_MAS→mastery_report/**mentor_access**. So Mentor's cell is TRUE (mentor_access is literal) even though the product is a stub; **Career Builder's is FALSE** — its link lives in the decision-orchestrator journey route, NOT the entitlement map. "Conceptually named" cannot award a binary cell.
- **Only the CAPADEX stage ladder is a real SKU** (STAGE_PRICES / LADDER in routes/capadex-payments.ts, mirrored in subscription-engine.ts — keep lockstep). It still lacks access_enforcement (no `requireEntitlement` guard consumes deriveEntitlement anywhere). Every other "product" is engine-real but monetization-unwired.
- **Never silent-upgrade a stub.** mentor_bookings + parent_subscriptions tables are ABSENT (parent_subscriptions exists in Drizzle schema/migrate code but not in DB); mentor_profiles=0; subscription_packages=0; student_subscriptions=0. Report as missing/stub, not partial-credit.

## Flag posture measurement
- Reading the `FEATURE_FLAGS` object directly captures **config DEFAULTS = deploy posture** (all 7 commercial flags default false). Env vars only take effect via `isFlagEnabled()`. The dev workflow forces `FF_COMMERCIAL_ACTIVATION=1` (commercialActivation only) — treat that as a **footnote**, never average it into the deploy-posture score.

## Same-day reconciliation
- When a prior same-day audit exists (commercial-wave-2), **recompute** (import the live resolvers + query live DB), don't copy its markdown.
- Be explicit that re-asserted **structural tiers** are consistent *partly by construction* (they're the same engineering judgments), whereas the **resolver figures** (entitlement/renewal/upsell/lifecycle/forecast/revenue counts) are genuinely recomputed — those are the numbers that would catch drift.

## Keep behavioural substrate OUT of commercial forecast
- wcl5_memory (~94 rows) / wcl0 / wcl4 are behavioural intelligence, NOT commercial signal. Exclude them from commercial-forecast-readiness explicitly; they must contribute to no commercial percentage.

## Mechanics
- Generator is a single deterministic script (`backend/scripts/wc-c1/wc-c1-measure.ts`) — re-run emits all 10 deliverables + `_wc_c1_snapshot.json` idempotently; never hand-edit the artifacts.
- Mask payment emails to `user_<sha256hex[:10]>` before writeFileSync (audit-artifact PII rule).
