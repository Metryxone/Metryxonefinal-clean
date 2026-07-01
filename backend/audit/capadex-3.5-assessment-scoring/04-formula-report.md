# CAPADEX 3.0 · Program 3 · Phase 3.5 — Formula Report (dimension 3 · formula_engine)

> Deliverable 04 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The formula framework is a **STRUCTURED object** (kind + terms), NEVER a code string — this guarantees there is **no eval / new Function surface**. Formulas + weights + thresholds are versioned in the additive `as_formulas` / `as_score_configs` overlay and validated by the pure `validateFormula` mechanism before use.

## Scoring configuration controls (5)
**Scoring configuration:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Formula configuration** (`formula_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_formulas, as_score_configs |
| **Weight configuration** (`weight_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules, as_score_configs |
| **Threshold configuration** (`threshold_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_score_configs |
| **Rule configuration** (`rule_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules, as_score_configs |
| **Versioning** (`versioning`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_score_configs |

## Safety contract
- A formula is a structured `{ kind, op?, terms[] }` object; string `expression` fields are **rejected**.
- `kind` ∈ weighted_sum|composite|percentage|reverse; `op` ∈ sum|weighted_sum|mean|min|max|composite|percentage|reverse.
- Each term `var` must be a simple identifier; weights must be numeric. **No eval, no new Function, no DB at compute time.**
