# WC-L2 Deliverable 3 — Forecast Confidence Report
_Generated 2026-06-09T15:43:51.350Z_

`FF_FORECAST_INTELLIGENCE` is **ON** for this run — forecasts reflect the real capability.

## How confidence is set (no new model)
A forecast's confidence is **exactly the underlying trend's confidence** — no new uncertainty number is
invented. Trend confidence scales with the number of comparable sessions: a 2-point line is the minimum
and sits at the floor (~0.33), reaching 1.0 only at 4 comparable sessions. The qualitative band is a
label over that existing value, aligned to the point scale so the 2-point FLOOR is honestly **low**:
low (<0.5, i.e. the 2-session floor 0.33) · moderate (0.5–0.83, ~3 sessions) · high (≥0.84, the full
4-session trend). The floor is never dressed up as "moderate".

## Confidence distribution (real forecasts only)
| Metric | Value |
|---|---|
| Real forecasts produced | 4 |
| Average forecast confidence | 0.33 |
| Range | 0.33 – 0.33 |

## Per-kind confidence
| Forecast | real forecasts | avg confidence | band |
|---|---|---|---|
| risk | 0 | — | — |
| growth | 2 | 0.33 | low |
| outcome | 0 | — | — |
| journey | 2 | 0.33 | low |

**Honest finding:** every real forecast currently sits at the **confidence floor** because every
trend-eligible owner has the minimum 2 sessions. These forecasts are directionally valid but must be
surfaced as **low-confidence** — a 2-point line cannot distinguish a real trajectory from noise.
