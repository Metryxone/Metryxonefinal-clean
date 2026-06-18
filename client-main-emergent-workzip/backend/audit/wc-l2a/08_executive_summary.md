# WC-L2A — Forecast Coverage Expansion Audit: Executive Summary
_Generated 2026-06-09T16:18:56.166Z_

`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.
✅ Cross-check: WC-L2 `computeUserForecasts` agrees with the raw-trend measurement on every shared layer (forecastable + confidence).

## Question → grounded answer
| Question | Answer (measured) |
|---|---|
| Current forecast coverage (owners with ≥1 forecast) | **2/3** (66.7%) |
| Forecast-eligible owners (≥2 sessions) | **2/3** (66.7%) |
| Max coverage with **existing** data | Stage/Journey/Decision **100% of eligible**; Outcome & Behaviour-risk **0%** (capture-blocked); confidence **floor 0.33** for all |
| Sessions for **50%** coverage | already met (66.7%) |
| Sessions for **75%** coverage | the 1-session owner needs **+1** session (→ all 3 owners eligible) |
| Sessions for **90%** coverage | same as 75% at this n (+1 for the lone under-depth owner); + identity attribution if anon are real users |
| Highest-leverage intervention | **more completed sessions per identified owner** (raises coverage *and* confidence) |
| True readiness ceiling | engine correct; **every forecast capped at LOW confidence (0.33)** by 2-session max depth; Outcome/Behaviour-risk capped at 0% by state capture |

> Scope note: **Decision** is audited from its WC-11 trend evidence using the same projection logic; it is **not
> currently exposed** in the WC-L2 runtime API (`computeUserForecasts` surfaces Stage/Outcome/Journey/Risk only).

## The honest ceiling
- **Coverage** is data-bound, not code-bound: the WC-L2 engine is correct and the upstream trends are real.
  Stage/Journey/Decision already forecast for **100%** of eligible owners; Outcome and Behaviour(risk) are 0%
  purely because that state is not persisted on enough sessions (outcome 1/5, risk dim 2/5).
- **Confidence** has a hard ceiling: with a 2-session maximum depth, **no forecast can exceed low confidence**.
  Reaching moderate needs depth 3; high needs depth 4. No platform data exists at those depths yet.
- **Anonymous sessions (4)** are structurally unforecastable and depress true coverage if they represent real users.

## Bottom line
WC-L2 is a sound, reversible foundation. The shortest honest path to higher coverage is **longitudinal depth
+ per-session state capture**, in that order — never the manufacture of a forecast where the trend evidence is
absent. A near-zero-cost layer win exists for **Behaviour** (forecast the denser `confidence`/`engagement` dim
instead of the sparse `risk` dim), but it does not change the depth-bound confidence ceiling.
