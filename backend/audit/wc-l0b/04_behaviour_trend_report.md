# Deliverable 4 — Behaviour Trend Activation
_Generated 2026-06-09T14:01:18.614Z_

Reuses the WC-L1 trend math (`leastSquaresSlope` / `directionOf` / `STABLE_DEADBAND`) over the
persisted behaviour dimensions to classify each dimension's progression as **Improving / Stable /
Declining** per user. NO new trend math. A dimension needs ≥2 readable points for that user or it
gets **no trend row** (never fabricated); `learning_style` is categorical and is never trended.

## Trend rows written (`wc3_longitudinal_trends`, metric `behaviour_<dim>`)
- Behaviour-trend rows: **0**
- Users with ≥1 behaviour trend: **0/2 (0.0%)**
- Mean trend confidence: **0.00**

> **No behaviour-trend rows exist** — and this is the honest, correct result. Across the 2
> trend-eligible users, no single behaviour dimension has two readable (non-NULL) points, because the
> Behavior Graph projected a dimension for only 2/9 completed sessions overall.
> The activation is wired and ready: as soon as a returning user accrues ≥2 sessions that both carry
> the same dimension, a real trend row is produced automatically — nothing is fabricated to fill the
> table now.

## Trend feasibility per dimension (why coverage is what it is)
| Dimension | Eligible users with ≥2 readable points |
|---|---|
| motivation | 0/2 |
| confidence | 0/2 |
| risk | 0/2 |
| engagement | 0/2 |
| adaptability | 0/2 |

> Trend **coverage** (does a trend exist) and trend **confidence** (is it trustworthy — a 2-point
> line is low by design) are independent axes. Both are reported as-is; neither is inflated to the
> >70% target.
