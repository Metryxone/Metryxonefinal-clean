# CAPADEX 3.0 · Program 3 · Phase 3.5 — Scoring Model Report (dimension 2 · scoring_engine)

> Deliverable 03 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The scoring engine computes 13 scoring models over the unified `computeScore` mechanism + composed services, with 5 response-processing modes preparing raw responses before scoring.

## Scoring models (13)
**Scoring models:** 13 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (13 total).

| Capability | Status | Note |
|---|---|---|
| **Raw score** (`raw_score`) | SUPPORTED | Sum of item scores (computeScore raw model). |
| **Weighted score** (`weighted_score`) | SUPPORTED | Σ(item × weight) (computeScore weighted model + as_rules positive/negative weight). |
| **Reverse scoring** (`reverse_scoring`) | SUPPORTED | Polarity-inverted items (max+min−value) (computeScore reverse model). |
| **Composite score** (`composite_score`) | SUPPORTED | Weighted composite of sub-scores (computeScore composite model). |
| **Percentage** (`percentage`) | SUPPORTED | obtained/maximum × 100 (computeScore percentage model). |
| **Domain score** (`domain_score`) | SUPPORTED | Per-domain aggregate (dimension-scoring-engine + composite aggregation). |
| **Sub-domain score** (`sub_domain_score`) | SUPPORTED | Per-sub-domain aggregate (dimension-scoring-engine nested groups). |
| **Competency score** (`competency_score`) | SUPPORTED | Per-competency aggregate (competency-scoring + competency-ei-scoring-shared). |
| **Behaviour score** (`behaviour_score`) | SUPPORTED | Behavioural indicator aggregate (behavioral-dimension-signals + CAPADEX runtime). |
| **Skill score** (`skill_score`) | SUPPORTED | Per-skill aggregate (competency-skill-intelligence). |
| **Trait score** (`trait_score`) | SUPPORTED | Trait indicator aggregate (behavioural-insights trait mapping). Standardized trait norms are Phase 3.6. |
| **Dimension score** (`dimension_score`) | SUPPORTED | Per-dimension aggregate (dimension-scoring-engine + competency-ei-dimensions). |
| **Overall assessment score** (`overall_score`) | SUPPORTED | Top-level composite of all model outputs (computeScore composite over domains). |

## Response-processing modes (5)
**Response-processing modes:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Note |
|---|---|---|
| **Validate responses** (`validate_responses`) | SUPPORTED | Type/range/option validation before scoring (validateResponses mechanism). |
| **Missing response handling** (`missing_response`) | SUPPORTED | Missing answers scored per policy (skip/zero/impute-neutral) (validateResponses + computeScore policy). |
| **Null response handling** (`null_response`) | SUPPORTED | Null/blank distinguished from 0 — null never coerced to a fabricated 0. |
| **Optional question handling** (`optional_question`) | SUPPORTED | Optional items excluded from the denominator per rule. |
| **Incomplete assessment rules** (`incomplete_assessment`) | SUPPORTED | Incomplete submissions scored partial / withheld per as_rules assessment rule. |

_Missing/null responses are scored per explicit policy (skip / zero / impute-neutral); null is NEVER coerced to a fabricated 0. Optional items are excluded from the denominator._
