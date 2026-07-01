# CAPADEX 3.0 · Program 3 · Phase 3.8 — Standard Score Engine Report (dimension 1 · standardization)

> Deliverable 02 · Generated 2026-07-01T17:13:35.500Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:470cd868e0df, written 2026-07-01T17:13:35.497Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A raw score is standardized against a reference distribution — percentile rank, z-score, T-score (μ=50,σ=10), standard score (μ=100,σ=15), stanine (1–9), sten (1–10) and composite / domain / competency / behaviour / skill / overall standardized scores — via the pure `computeStandardScoreSet` mechanism reusing the `psychometric-standardization` functions + the additive `astd_standard_scores` overlay. The transforms are pure functions of the score + distribution; norm-referenced standardization ABSTAINS below k_min=30 real members (returns `abstained=true`, scores null) — never fabricated.

**Standard-score types:** 12 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (12 total).

| Capability | Status | Note |
|---|---|---|
| **Percentile rank** (`percentile`) | SUPPORTED | zToPercentile — proportion of the reference distribution below the score (normal CDF). |
| **z-score** (`z_score`) | SUPPORTED | zFromValue — standardized deviation from the reference mean in SD units. |
| **T-score (μ=50, σ=10)** (`t_score`) | SUPPORTED | zToT — linear rescale of z to the T metric. |
| **Standard score (μ=100, σ=15)** (`standard_score`) | SUPPORTED | zToDeviationScore — deviation-quotient / standard-score metric. |
| **Stanine (1–9)** (`stanine`) | SUPPORTED | zToStanine + stanineBand — nine-point standard-nine band. |
| **Sten (1–10)** (`sten`) | SUPPORTED | zToSten — ten-point standard band. |
| **Composite score** (`composite`) | SUPPORTED | Weighted composite of dimension standard scores via a structured AST formula (evaluateFormula). |
| **Domain score** (`domain`) | SUPPORTED | Per-domain standardized score composed from the standardized dimension set. |
| **Competency score** (`competency`) | SUPPORTED | Per-competency standardized score composed from the standardized dimension set. |
| **Behaviour score** (`behaviour`) | SUPPORTED | Per-behaviour standardized score composed from the standardized dimension set. |
| **Skill score** (`skill`) | SUPPORTED | Per-skill standardized score composed from the standardized dimension set. |
| **Overall standardized score** (`overall`) | SUPPORTED | Overall standardized score composed via the configured composite formula. |

### Standard Score Engine (`standardization`) — SUPPORTED
_ONE canonical standardization layer (astd_standard_scores) transforming a raw score into percentile / z / T / standard / stanine / sten standard scores + composite / domain / competency / behaviour / skill / overall scores by COMPOSING the pure psychometric-standardization functions (zFromValue/zToPercentile/zToT/zToStanine/zToSten/zToDeviationScore) and structured-AST composites. Pure transforms — no adoption dependency. Norm-referenced standardization ABSTAINS below k_min real members._

- **Services**: services/psychometric-standardization.ts, services/score-standardization-mechanisms.ts, services/score-standardization-engine.ts
- **Routes**: routes/score-standardization.ts
- **Frontend**: components/standardization/StandardizationWorkbench.tsx
- **Tables**: scoring_runs, astd_standard_scores
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 0/2

