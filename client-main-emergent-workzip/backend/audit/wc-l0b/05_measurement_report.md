# Deliverable 5 — Measurement
_Generated 2026-06-09T14:01:18.614Z_

The eight WC-L0B measures, each with its denominator made explicit and Coverage kept separate from
Confidence.

| # | Measure | Value | Denominator | Reading |
|---|---|---|---|---|
| 1 | Behaviour Coverage | **2/9 (22.2%)** | completed sessions | sessions with ≥1 dimension present |
| 2 | Behaviour Persistence Coverage | **9/9 (100.0%)** | completed sessions | sessions with a persisted behaviour row |
| 3 | Behaviour History Coverage | **2/3 (66.7%)** | emailed users | users with ≥1 behaviour-bearing session |
| 4 | Behaviour Trend Coverage | **0/2 (0.0%)** | trend-eligible users | eligible users with ≥1 behaviour trend |
| 5 | Trend Confidence | **0.00** | written trends | mean confidence (0 ⇒ no trend) |
| 6 | User Continuity | **2/3 (66.7%)** | emailed users | users with ≥2 completed sessions |
| 7 | Personalization Impact | **2/9 (22.2%)** | completed sessions | ceiling = sessions whose behaviour a personalizer could consume |
| 8 | Longitudinal Readiness Impact | **0/2 (0.0%)** | trend-eligible users | eligible users with a usable behaviour trend |

## Notes on honesty
- **Persistence coverage is 100%** because every completed session gets a row — but that row is mostly
  NULL dimensions, which is why **Behaviour Coverage (#1) is only 22.2%**. The two are deliberately
  separated; the row existing does not mean a behaviour signal exists.
- **Personalization Impact (#7)** is bounded by behaviour coverage: a personalizer can only consume a
  behaviour signal that exists. It is reported as the behaviour-bearing session share, not a modelled
  uplift (no uplift model exists — inventing one would be fabrication).
- Measures #4, #5, #8 are **0** because the underlying behaviour history has no two-point continuity —
  the honest consequence of the empty signal spine, not a defect in this layer.
