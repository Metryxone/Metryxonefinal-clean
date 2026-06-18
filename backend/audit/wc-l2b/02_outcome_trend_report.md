# WC-L2B Deliverable 2 — Outcome Trend Report
_Generated 2026-06-09T16:34:00.059Z_

Flags at run: `FF_FORECAST_INTELLIGENCE`=ON, `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON.

An **outcome trend** needs ≥2 OWNED completed sessions for the SAME user that each carry an outcome
state (so the outcome lever has ≥2 readable points). Recomputed via the existing WC-L1
`persistUserTrends` (no new trend engine). Trend recomputes run: **2** eligible owner(s).

| Metric | Before | After |
|---|---|---|
| Eligible owners (≥2 completed sessions) | 2 | 2 |
| Eligible owners WITH an outcome trend | 0 | 0 |
| Outcome trend coverage (of eligible) | 0.0% | 0.0% |

## Per eligible owner (outcome lever)
| Owner | Completed sessions | Outcome-bearing sessions | Outcome trend points | Has outcome trend |
|---|---|---|---|---|
| user_65454b2b8b | 2 | 0 | 0 | no |
| user_4b262cc8a5 | 2 | 1 | 0 | no |

**Honest finding:** an outcome trend requires **≥2** outcome-bearing sessions for one owner. Only **1**
owned session(s) carry outcome state in total, so no owner reaches two points — outcome trend coverage
stays **0.0%**. (Anonymous outcome rows cannot form a user series.)
