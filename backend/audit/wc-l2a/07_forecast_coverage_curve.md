# WC-L2A Deliverable 7 — Forecast Coverage Curve
_Generated 2026-06-09T16:18:56.166Z_

`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.

Real, measured curve — **not estimated**. Depths with no owners are reported as **no data** (never interpolated).

| Session count | Owners | Owners with ≥1 forecast | Forecast coverage |
|---|---|---|---|
| 1 | 1 | 0 | 0.0% |
| 2 | 2 | 2 | 100.0% |
| 3 | 0 | 0 | no data |
| 4 | 0 | 0 | no data |
| 5+ | 0 | 0 | no data |

**Reading the curve:** the only inflection the platform has actually observed is **1 → 2 sessions**, where
coverage jumps from **0%** (no trend possible) to **100.0%** (Stage/Journey/Decision become forecastable). Depths 3, 4 and 5+
carry **no platform data**, so the curve beyond depth 2 is honestly unknown — the WC-L1/L2 confidence formula
*predicts* the confidence band by depth (0.33 → 0.67 → 1.0), but coverage at those depths must be **measured, not assumed**.
