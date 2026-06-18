# WC-L2A Deliverable 1 — Forecast Coverage Report
_Generated 2026-06-09T16:18:56.166Z_

`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.
✅ Cross-check: WC-L2 `computeUserForecasts` agrees with the raw-trend measurement on every shared layer (forecastable + confidence).

A layer is **forecastable** for an owner when its underlying WC-L1/WC-L0B trend exists (≥2 readable points).
Coverage is counted over the **2 trend-eligible owner(s)** (≥2 completed sessions); owners with
<2 sessions are structurally unforecastable for every layer and are reported in the User Depth Report.

## Coverage by layer (denominator = 2 eligible owner(s))
| Layer | eligible | forecastable | coverage | confidence | primary blocker |
|---|---|---|---|---|---|
| Stage | 2 | 2 | 100.0% | 0.33 (low) | none (state fully populated) |
| Outcome | 2 | 0 | 0.0% | — | outcome state captured on 1/5 sessions |
| Journey | 2 | 2 | 100.0% | 0.33 (low) | none (state fully populated) |
| Decision | 2 | 2 | 100.0% | 0.33 (low) | none (state fully populated) |
| Behaviour (risk dim) | 2 | 0 | 0.0% | — | risk dim non-null on 2/5 sessions |

## Headline
- Identified owners (≥1 completed session): **3**; trend-eligible (≥2): **2** (66.7%).
- Owners with **≥1** forecastable layer: **2 / 3** (66.7%).
- **Stage / Journey / Decision** are forecastable for **100% of eligible owners** — their state is captured on
  every owned session (5/5, 5/5, 5/5).
- **Outcome** and **Behaviour (risk)** are at **0%** — not a depth problem for these owners but an upstream
  **state-capture** gap (outcome 1/5, risk dim 2/5 sessions).
- Anonymous completed sessions (**4**) have no stable owner identity → never forecastable (structural, not a defect).

> Note on Decision: WC-L2's runtime API surface (`computeUserForecasts`) exposes Stage/Outcome/Journey/Risk only.
> The **Decision** trend already exists (WC-11) and uses the *same projection logic*, but is **not currently exposed
> in the WC-L2 runtime API** — it is audited here from its WC-11 trend evidence as a zero-new-model layer.
