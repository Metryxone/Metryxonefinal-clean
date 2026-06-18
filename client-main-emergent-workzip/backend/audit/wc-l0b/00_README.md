# WC-L0B — Behaviour Signal Expansion & Longitudinal Behaviour Intelligence (MEASURED)
_Generated 2026-06-09T14:01:18.614Z_

PERSISTS and TRENDS the behaviour outputs that EXISTING intelligence already produces — **no new
engine, construct, dimension, ontology, scoring model, or AI model**. The behaviour dimensions are
the ones the WC-L0 User Intelligence Foundation already PROJECTS from the Unified Behavior Graph into
`wcl0_user_intelligence` (`motivation`, `confidence`, `risk`, `engagement`, `adaptability`
+ the categorical `learning_style`). The trend layer REUSES the WC-L1 trend math
(`leastSquaresSlope` / `directionOf` / `STABLE_DEADBAND`) and the existing
`wc3_longitudinal_trends` table (metric `behaviour_<dim>`).

Two INDEPENDENT axes, reported separately and never merged:
- **Coverage** — does the behaviour state exist (per session / dimension / user / concern / age band)?
- **Confidence** — is that state sufficient + trustworthy enough to support a per-user *trend*
  (≥2 readable points for the SAME dimension and user)?

## Population
- Completed sessions: **9** (anonymous / no-email: **4**)
- Emailed users (≥1 completed session): **3**
- **Trend-eligible users** (≥2 completed sessions): **2**

## Headline (two axes — not merged)
| Axis | Value | Note |
|---|---|---|
| Persistence coverage (rows) | **9/9 (100.0%)** | every completed session carries a behaviour row |
| Behaviour-dimension coverage | **2/9 (22.2%)** | sessions where ≥1 dimension is actually present (not NULL) |
| Behaviour-trend coverage | **0/2 (0.0%)** | eligible users with ≥1 per-dimension trend |
| Mean trend confidence | **0.00** | 0 when no trend exists (honest) |

> The behaviour **signal spine is near-empty** (the Behavior Graph speaks to a dimension for only
> 2/9 completed sessions), so although row-persistence is 100%, the **dimension
> coverage, history depth, and trend coverage are honestly low**. The >80% / >70% / >85% targets are
> **NOT met** — this is a genuine upstream source-data ceiling, surfaced, never inflated. See
> `06_readiness_report.md`.

## Reports
1. `01_behaviour_coverage_report.md` — coverage per session / user / concern / age band / product
2. `02_behaviour_dimension_report.md` — per-dimension presence + requested-vs-existing taxonomy
3. `03_behaviour_history_report.md` — per-user longitudinal behaviour series + history depth
4. `04_behaviour_trend_report.md` — Improving / Stable / Declining per dimension (+ honest ceiling)
5. `05_measurement_report.md` — the 8 measures
6. `06_readiness_report.md` — readiness vs targets, true ceilings, forward guarantee
