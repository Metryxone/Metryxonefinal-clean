# WC-L2B Deliverable 3 — Outcome Forecast Report
_Generated 2026-06-09T16:34:00.059Z_

Flags at run: `FF_FORECAST_INTELLIGENCE`=ON, `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON.

The **Outcome Forecast** is the WC-L2 one-step extrapolation of the outcome trend; it exists only when
the outcome trend exists. Measured via `computeUserForecasts` (flag-gated).

| Metric | Before | After |
|---|---|---|
| Eligible owners | 2 | 2 |
| Eligible owners with an Outcome Forecast | 0 | 0 |
| Outcome forecast coverage (of eligible) | 0.0% | 0.0% |

## Per eligible owner
| Owner | Completed sessions | Outcome forecastable | Forecast confidence | Band |
|---|---|---|---|---|
| user_65454b2b8b | 2 | no | — | — |
| user_4b262cc8a5 | 2 | no | — | — |

**Honest finding:** outcome forecast coverage is downstream of outcome trend coverage. With no outcome
trend reachable, it remains **0.0%** — unchanged by the backfill.
