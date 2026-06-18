# WC-L2A Deliverable 6 — Forecast Bottleneck Matrix
_Generated 2026-06-09T16:18:56.166Z_

`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.

## Per-layer
| Layer | Current coverage (eligible) | Ceiling with current data | Primary blocker |
|---|---|---|---|
| Stage | 100.0% (2/2) | 100% of eligible at conf floor 0.33 | session depth (confidence floor) |
| Outcome | 0.0% (0/2) | Outcome-state capture (1/5) | outcome state not persisted per session |
| Journey | 100.0% (2/2) | 100% of eligible at conf floor 0.33 | session depth (confidence floor) |
| Decision | 100.0% (2/2) | 100% of eligible at conf floor 0.33 | session depth (confidence floor) |
| Behaviour (risk dim) | 0.0% (0/2) | Risk-dim capture (2/5) | risk dim sparsest behaviour signal |

## Forecast-loss decomposition (every non-forecastable owner × layer cell)
Total cells = 3 owners × 5 layers = **15**. Forecastable now = **6**. Lost = **9**.

| Loss driver | Cells lost | Share of loss |
|---|---|---|
| Session depth (<2 sessions) | 5 | 55.6% |
| Outcome history (state capture) | 2 | 22.2% |
| Behaviour-risk history (dim capture) | 2 | 22.2% |
| Stage history | 0 | 0.0% |
| Journey history | 0 | 0.0% |
| Decision history | 0 | 0.0% |

Anonymous completed sessions (**4**) sit *outside* this owner×layer grid: with no identity they
contribute 0 forecastable owners — a separate, structural loss that identity attribution would recover.

## Single highest-leverage intervention
**Increase completed-session depth per identified owner (and attribute anonymous sessions to identities).**
It is the only lever that raises **both** coverage and confidence: it gates **5 of 9** lost cells, and it is the
*only* way to lift confidence off the 0.33 floor. The capture fixes (Outcome, Behaviour-risk) are the
second tier — they widen *which layers* are forecastable but cannot raise confidence.

_Layer-specific aside:_ the cheapest single win for the **Behaviour** layer is to forecast a denser behaviour
dim (`confidence`/`engagement`, already trend-eligible) rather than the sparse `risk` dim — no new data required.
