# Deliverable 6 — Consumption Summary

Generated: 2026-06-08T15:51:32.846Z · 9 completed sessions (of 27 total)

## Two independent roll-ups (NEVER merged)
- **Mean Consumption Rate across the 7 levered metrics: 74.6%**
- **Mean Activation Readiness across the 7 levered metrics: 17.5%**

## Success-criteria assessment (honest)
The WC-P2 target was Personalization / Runtime Consumption / Platform Readiness > 90%. Measured
against REAL data, the two metrics diverge — and that divergence is the truth, not a shortfall to hide:

| Lever / slot | Consumption | Meets >90%? | Readiness | Meets >90%? |
|---|---|---|---|---|
| A · Product | 100.0% | ✅ ≥90% | 0.0% | below 90% (honest data limit) |
| A · Growth | 100.0% | ✅ ≥90% | 0.0% | below 90% (honest data limit) |
| A · Mentor | 100.0% | ✅ ≥90% | 100.0% | ✅ ≥90% |
| A · Commercial | 100.0% | ✅ ≥90% | 0.0% | below 90% (honest data limit) |
| B · Report | 22.2% | below 90% (honest data limit) | 22.2% | below 90% (honest data limit) |
| C · Rec | 100.0% | ✅ ≥90% | 0.0% | below 90% (honest data limit) |
| D · Trend | 0.0% | below 90% (honest data limit) | 0.0% | below 90% (honest data limit) |

- **Decision-driven activation:** 9/9 (100.0%).

## Honest residuals (why some metrics are below 90%)
1. **Report personalization** — completed sessions are anonymous (no persona on record); only 2
   carry a behaviour graph. Consumption/Readiness rise with identified users + populated graphs; no
   persona/profile is fabricated.
2. **Longitudinal** — there is **no repeat-session snapshot history** yet, so no trend can form. Single
   assessments honestly get "no trend yet" — never a fabricated trajectory.
3. **Activation slots (Growth/Commercial)** — ready only when a real outcome resolved and confidence is
   sufficient; cold-start low-confidence sessions are consumed but correctly NOT ready (never auto-fired).

## Verification
- Flag OFF → every added field is omitted (byte-identical legacy payload).
- Both metrics are computed by invoking the runtime read-only builders over real sessions; Consumption
  and Readiness are reported independently and never merged.
