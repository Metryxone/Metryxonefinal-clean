# WC-L2 Deliverable 1 — Forecast Readiness Report
_Generated 2026-06-09T15:43:51.350Z_

`FF_FORECAST_INTELLIGENCE` is **ON** for this run — forecasts reflect the real capability.

## What "ready" means
A forecast is a **one-step linear extrapolation of an EXISTING trend** — `projected = clamp(last + slope_per_session)`
at the trend's own confidence. It is NOT a new model: the formula already ships in
`computeLongitudinalConsumption`, and the trends come from the existing `computeUserTrends`
(stage/outcome/journey/decision) and `computeUserBehaviourTrends` (risk/…). So readiness is entirely a
question of whether the **upstream trends exist**, which in turn needs ≥2 comparable sessions per user.

## Engine readiness (code)
| Component | State |
|---|---|
| Forecast flag `forecastIntelligence` | registered, default OFF |
| Forecast engine `services/wc3/forecast-intelligence.ts` | present, pure, read-only, never-throws |
| Upstream lever trends `computeUserTrends` | present (pure read) |
| Upstream behaviour trends `computeUserBehaviourTrends` | present (pure read) |
| Extrapolation formula | reuses existing `last + slope` (clamped) |
| New tables / writes / DDL | **none** (read-only foundation) |

→ The engine is **wired and correct**. Readiness is therefore **data-bound**, not code-bound.

## Data readiness (population)
| Metric | Value |
|---|---|
| Owners with ≥1 completed session | 3 |
| Trend-eligible owners (≥2 completed sessions) | 2 |
| Owners with ≥1 real forecast | 2 |
| Anonymous completed sessions (never forecastable) | 4 |

**Honest finding:** the forecast foundation is ready in code, but the longitudinal depth needed to
populate it barely exists — only 2 owner(s) have the ≥2 sessions a trend requires.
