# CAPADEX 3.0 · Program 3 · Phase 3.7 — Standardization Report (dimension 2 · standardization)

> Deliverable 03 · Generated 2026-07-01T14:57:50.706Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:7998539a81e1, written 2026-07-01T14:57:50.705Z).
> Scope: INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument.
> Honesty: the EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced statistics + benchmarks ABSTAIN below k_min=30 real members; AI narrative confidence stays honest-null while cold-start. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A raw score is standardized against a reference distribution — percentile rank, z-score, T-score (μ=50,σ=10), stanine (1–9), sten (1–10) and deviation score (μ=100,σ=15) — via the pure `computeStandardScores` mechanism reusing the `psychometric-standardization` functions + the additive `aint_standard_scores` overlay. The transforms are pure functions of the score + distribution and have NO adoption dependency.

**Standard-score types:** 6 SUPPORTED · 2 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Note |
|---|---|---|
| **Percentile rank** (`percentile`) | SUPPORTED | zToPercentile — proportion of the reference distribution below the score (normal CDF). |
| **z-score** (`z_score`) | SUPPORTED | zFromValue — standardized deviation from the reference mean in SD units. |
| **T-score (μ=50, σ=10)** (`t_score`) | SUPPORTED | zToT — linear rescale of z to the T metric. |
| **Stanine (1–9)** (`stanine`) | SUPPORTED | zToStanine + stanineBand — nine-point standard-nine band. |
| **Sten (1–10)** (`sten`) | SUPPORTED | zToSten — ten-point standard band. |
| **Deviation score (μ=100, σ=15)** (`deviation_score`) | SUPPORTED | zToDeviationScore — deviation-quotient metric. |
| **Normal curve equivalent (NCE)** (`nce`) | PARTIAL | Derivable from percentile but not yet surfaced as a first-class standard score — a display boundary, not a gap. |
| **Scaled score** (`scaled_score`) | PARTIAL | Linear scaled score requires a defined target scale per assessment — PARTIAL until scales are first-class. |

### Standardization (`standardization`) — SUPPORTED
_ONE canonical standardization layer (aint_standard_scores) transforming a raw score into percentile / z / T / stanine / sten / deviation standard scores by COMPOSING the pure psychometric-standardization functions (zFromValue/zToPercentile/zToT/zToStanine/zToSten/zToDeviationScore). Pure transforms — no adoption dependency. NCE & scaled scores stay PARTIAL (display / scale boundaries)._

- **Services**: services/psychometric-standardization.ts, services/assessment-intelligence-mechanisms.ts, services/assessment-intelligence-engine.ts
- **Routes**: routes/assessment-intelligence.ts
- **Frontend**: components/intelligence/InterpretationWorkbench.tsx
- **Tables**: scoring_runs, aint_standard_scores
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 0/2


_NCE and scaled score are PARTIAL: NCE is derivable from percentile but not yet surfaced first-class (a display boundary); scaled score needs a defined target scale per assessment (a first-class-scale boundary). Neither is an engineering gap._
