# CAPADEX 3.0 · Program 3 · Phase 3.5 — Configuration Report (scoring configuration & versioning)

> Deliverable 06 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Scoring configuration binds a scoring model + versioned formula + weights + thresholds + rules. Every configuration is validated (`validateConfig`) and stored versioned in the additive `as_score_configs` overlay so re-scoring is reproducible.

**Scoring configuration controls:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Formula configuration** (`formula_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_formulas, as_score_configs |
| **Weight configuration** (`weight_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules, as_score_configs |
| **Threshold configuration** (`threshold_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_score_configs |
| **Rule configuration** (`rule_config`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules, as_score_configs |
| **Versioning** (`versioning`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_score_configs |

_Versioning is REQUIRED (positive integer) — a scoring configuration change is a new version, never an in-place mutation, so historical scores remain reproducible._
