# CAPADEX 3.0 · Program 3 · Phase 3.5 — Rule Engine Report (dimension 4 · rule_engine)

> Deliverable 05 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Scoring rules (8) — positive/negative weighting, partial credit, bonus/penalty (negative marking), mandatory-question, section & assessment rules. REUSES the pure `computeScore` + `validateRule` mechanisms over the additive `as_rules` overlay.

**Scoring rules:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Positive weight** (`positive_weight`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Negative weight** (`negative_weight`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Partial credit** (`partial_credit`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Bonus marks** (`bonus_marks`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Penalty marks** (`penalty_marks`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Mandatory question rules** (`mandatory_question`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Section rules** (`section_rules`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
| **Assessment rules** (`assessment_rules`) | SUPPORTED | true | services/assessment-scoring-mechanisms.ts, as_rules |
