# MX-75X — Section 14: Enterprise Validation Analytics

> **Status:** ACTIVATED (composes existing engine). **Evidence:** PENDING.
> **Honesty contract:** every analytic is a read-only projection of the validation-loop engine and
> its connected feeders. Zero realized outcomes → zero analytics, reported as such — never inflated.

## Purpose
Enterprise/operator analytics over the closed loop: a single, honest roll-up of **how much validation
evidence exists across the whole platform** and **where it is concentrated**. It is the cross-persona
aggregate behind the Super Admin surface (Section 11).

## Composition (no recompute, no new engine)
All figures derive from already-built assets:
- `validation_loop_outcomes` intake (`by_type`) — the realized-outcome substrate.
- `buildCalibrationModel` partitions (`realized` / `connected` / `platform_realized` /
  `demo_illustrative`) — Brier / ECE / band tables per partition.
- Connected feeders: `hiring_outcomes`, `interview_outcomes`, `career_outcomes`,
  `employer_candidates.predicted_prob_at_decision`.

## Analytic groups (honest definitions)
| Group | Definition | Null/empty behaviour |
|---|---|---|
| **Outcome volume** | count of realized non-demo outcomes by type | 0 shown as 0 (not hidden) |
| **Coverage** | which feeders have connected outcomes (presence, not quality) | absent feeder = "no data", never 0%-as-good |
| **Calibration confidence** | per-partition status + Brier/ECE | null until partition ≥ k_min |
| **Demo isolation** | demo/illustrative counts shown separately | excluded from every confidence metric & the cert |
| **Evidence verdict** | `evidence_backed`, `realized_outcomes`, `remaining_to_calibrated` | false / 0 / 30 in cold-start |

## Honesty invariants
1. **Demo never counts.** Demo/illustrative outcomes are excluded from volume-toward-cert, coverage,
   and all calibration confidence figures.
2. **Coverage ≠ Confidence.** Feeder-presence is reported independently of calibration status. A
   connected feeder with 0 realized outcomes is *covered but not confident*.
3. **No fabricated rates.** Observed/calibrated rates only appear for bands with real sample size;
   borrowed-prior bands are flagged and do not promote confidence.
4. **Aggregate-only / k-anonymity.** Cross-cohort figures respect k_min = 30; nothing per-individual
   is exposed at the enterprise tier.

## Current honest state (dev / pre-deploy)
- Realized non-demo outcomes: **0** across all types.
- Calibration: all partitions `cold_start`; Brier/ECE **null**.
- Evidence verdict: **not evidence-backed**; `remaining_to_calibrated = 30`.
- Conclusion: the analytics layer is **live and correct**, and it correctly reports an **empty
  evidence base** — exactly the honest dormant state expected before real outcomes accrue.
