# Commercial Wave 2 · Deliverable 5 — Commercial Readiness Report
_Generated 2026-06-10T03:28:35.624Z. TWO independent axes — NEVER composited into one number._

## Headline
**Structural 80% (24/30) · Data/Activation 0%**

- **Axis A — Structural readiness** rose from **14/30 (46.7%)** → **24/30 (80%)**.
- **Axis B — Data/Activation readiness** = **0%** (0/5 data enablers present).
- **95% is NOT honestly reachable this wave.** "after" is capped at *gated-real* (4/5) for every capability because each ships behind a **default-OFF** flag with **no live user-facing consumer and no real data**. Reaching *real* (5/5) requires un-gating + wiring a consumer + actual paid volume — none of which this additive wave does.

## Honest reconciliation of the brief
The brief's **"72-75% → ≥95%"** is **not supported by the live data**: `capadex_payments` has **0 paid rows**, `subscription_packages` and `student_subscriptions` are **empty**, and launch-readiness scored Commercial **12-18/100**. The "72-75%" reads as a structural estimate, not a measured figure. We report measured Structural and Data axes separately rather than restating the estimate.

## Axis A — Structural readiness (before → after)
| Capability | Before | After | After justification |
|---|---|---|---|
| entitlement | partial (3/5) | gated-real (4/5) | entitlement-engine maps owned stages → entitled features + a coverage overview; fail-CLOSED on a ledger read error; gated behind commercialEntitlement (default OFF), exposed via admin route only. |
| renewal | stub (2/5) | gated-real (4/5) | renewal-engine builds the validity-window due_soon/in_grace pipeline over student_subscriptions; B2C ladder explicitly renewal_not_applicable_b2c; gated behind commercialRenewal (default OFF). |
| upsell | partial (3/5) | gated-real (4/5) | upsell-engine composes the existing subscription-engine signal (prior-paid gate) + D6 high-confidence gate + stub guard, plus a system-wide overview; gated behind commercialUpsell (default OFF). No new behavioural triggers invented. |
| lifecycle | absent (1/5) | gated-real (4/5) | subscription-lifecycle projects pending/fulfilled/abandoned (ladder) + active/expiring_soon/expired/cancelled (packages), fully recomputed from status+expiry (no persistence); gated behind commercialLifecycleState (default OFF). |
| forecast_inputs | absent (1/5) | gated-real (4/5) | commercial-forecast-inputs emits the WC-L2 ≥2-point forecast contract + measured per-series point availability; never fabricates a series; gated behind commercialForecastInputs (default OFF). |
| revenue_intel | gated-real (4/5) | gated-real (4/5) | unchanged by Commercial Wave 2 (Wave-0 capability) — still gated-real. |

## Axis B — Data / Activation readiness
| Enabler | Present |
|---|---|
| Paid payment rows > 0 | false (0) |
| Distinct paid emails > 0 | false (0) |
| Active packages > 0 | false (0) |
| Live subscriptions > 0 | false (0) |
| Forecastable series ≥ 1 | false (0/4) |

## Per-capability dual readiness (the 5 success metrics)
| Metric | Structural | Data | Data note |
|---|---|---|---|
| Entitlement Coverage | gated-real (4/5) | n/a % of paying identities resolvable to ≥1 entitlement | n/a — 0 paying identities. The resolver is deterministic (fail-closed), so coverage would be 100% of paid users once any paid row exists. |
| Renewal Readiness | gated-real (4/5) | 0 renewable active package subscriptions | renewable_active=0, due_soon=0, in_grace=0. B2C ladder: renewal_not_applicable_b2c. |
| Upsell Readiness | gated-real (4/5) | 0 upsell-eligible identities (require a prior paid stage) | eligible=0, full_ladder_owners=0. 0 paid → 0 eligible (upsell requires a prior purchase). |
| Revenue Lifecycle Readiness | gated-real (4/5) | 0 fulfilled ladder purchases + live package subscriptions | ladder: pending=6, fulfilled=0, abandoned=0; packages: active=0. |
| Commercial Forecast Readiness | gated-real (4/5) | 0 % of commercial series with ≥2 comparable points | 0/4 series forecastable. paid_revenue=0pt, paid_count=0pt, new_subscriptions=0pt, upcoming_expiries=0pt. |

## Binding constraint
The single binding constraint across every metric is the **empty commercial substrate** (no paid transactions, no packages, no subscriptions). Every structural capability is built and gated; none can show data readiness until real commercial activity exists. This is a true ceiling, honestly reported — not a wiring or modelling gap.

## Appendix — grounding traceability (per cell)
- **entitlement** · before=partial (3/5) — subscription-engine.loadOwnedStages read owned (paid) stages, but no ownership→features mapping or coverage surface existed.
  - after=gated-real (4/5) — entitlement-engine maps owned stages → entitled features + a coverage overview; fail-CLOSED on a ledger read error; gated behind commercialEntitlement (default OFF), exposed via admin route only.
- **renewal** · before=stub (2/5) — subscription-engine returned renewal_not_applicable_b2c for the all-owned path; renewal was acknowledged but no package renewal pipeline existed.
  - after=gated-real (4/5) — renewal-engine builds the validity-window due_soon/in_grace pipeline over student_subscriptions; B2C ladder explicitly renewal_not_applicable_b2c; gated behind commercialRenewal (default OFF).
- **upsell** · before=partial (3/5) — an upsell {ready,trigger,reason} sub-field existed only embedded inside the gated activation envelope; no composed upsell capability or population overview.
  - after=gated-real (4/5) — upsell-engine composes the existing subscription-engine signal (prior-paid gate) + D6 high-confidence gate + stub guard, plus a system-wide overview; gated behind commercialUpsell (default OFF). No new behavioural triggers invented.
- **lifecycle** · before=absent (1/5) — no lifecycle-state projection existed for either commercial surface.
  - after=gated-real (4/5) — subscription-lifecycle projects pending/fulfilled/abandoned (ladder) + active/expiring_soon/expired/cancelled (packages), fully recomputed from status+expiry (no persistence); gated behind commercialLifecycleState (default OFF).
- **forecast_inputs** · before=absent (1/5) — WC-L2 forecast existed for behaviour/growth trends, but no commercial forecast input contract existed.
  - after=gated-real (4/5) — commercial-forecast-inputs emits the WC-L2 ≥2-point forecast contract + measured per-series point availability; never fabricates a series; gated behind commercialForecastInputs (default OFF).
- **revenue_intel** · before=gated-real (4/5) — WC-7C Wave-0 revenue-intelligence admin surface, gated behind revenueIntelligence (default OFF).
  - after=gated-real (4/5) — unchanged by Commercial Wave 2 (Wave-0 capability) — still gated-real.
