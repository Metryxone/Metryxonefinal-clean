# WC-L2A Deliverable 2 — Forecast Confidence Report
_Generated 2026-06-09T16:18:56.166Z_

`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.

## How confidence is defined (no new model)
A forecast's confidence **is** its underlying trend's confidence (WC-L2 sets `forecast_confidence = trend.confidence`).
Trend confidence scales with comparable session count: **2 pts → 0.33 (floor), 3 → 0.67, 4+ → 1.0**. Bands:
low (<0.5) · moderate (0.5–0.83) · high (≥0.84).

## Distribution (real forecasts only)
| Metric | Value |
|---|---|
| Real forecasts produced | 6 |
| Mean confidence | 0.33 |
| Median confidence | 0.33 |
| Range | 0.33 – 0.33 |
| Low / Moderate / High | 6 / 0 / 0 |

## Per-layer confidence
| Layer | real forecasts | mean confidence | band |
|---|---|---|---|
| Stage | 2 | 0.33 | low |
| Outcome | 0 | — | — |
| Journey | 2 | 0.33 | low |
| Decision | 2 | 0.33 | low |
| Behaviour (risk dim) | 0 | — | — |

## Confidence ceiling imposed by current data depth
The deepest owner has **2 completed sessions**, so every trend sits at the **2-point floor (0.33 / low)**.
**With the current data, no forecast can exceed low confidence** — moderate needs 3 comparable sessions and
high needs 4. This ceiling is a pure **data-depth** limit and cannot be lifted by any code change.

| Comparable sessions | Trend confidence | Band | Present in platform data? |
|---|---|---|---|
| 2 | 0.33 | low | yes (all eligible owners) |
| 3 | 0.67 | moderate | **no data** |
| 4+ | 1.0 | high | **no data** |
