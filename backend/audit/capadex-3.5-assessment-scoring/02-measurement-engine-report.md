# CAPADEX 3.0 · Program 3 · Phase 3.5 — Measurement Engine Report (dimension 1 · measurement_engine)

> Deliverable 02 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The measurement engine COMPOSES the existing scoring services to measure responses across 9 measurement types — no duplicate engine. Each type REUSES a verified existing scoring service + the additive `as_measurements` overlay.

**Measurement types:** 5 SUPPORTED · 4 PARTIAL · 0 DEAD_END · 0 MISSING (9 total).

| Capability | Status | Evidence present | Anchors |
|---|---|---|---|
| **Competency measurement** (`competency`) | SUPPORTED | true | services/competency-scoring.ts, services/competency-ei-scoring-shared.ts, as_measurements |
| **Behaviour measurement** (`behaviour`) | SUPPORTED | true | services/behavioral-dimension-signals.ts, services/assessment-scoring-mechanisms.ts, as_measurements |
| **Skill measurement** (`skill`) | SUPPORTED | true | services/competency-skill-intelligence.ts, as_measurements |
| **Learning measurement** (`learning`) | PARTIAL | true | services/assessment-scoring-mechanisms.ts, as_measurements |
| **Cognitive measurement** (`cognitive`) | PARTIAL | true | services/caf/scoring-engine.ts, as_measurements |
| **Aptitude measurement** (`aptitude`) | SUPPORTED | true | services/caf/scoring-engine.ts, as_measurements |
| **Personality measurement** (`personality`) | PARTIAL | true | services/assessment-scoring-mechanisms.ts, as_measurements |
| **Employability measurement** (`employability`) | SUPPORTED | true | services/employability-scoring-engine.ts, services/mei-scoring-engine.ts, as_measurements |
| **Leadership measurement** (`leadership`) | PARTIAL | true | services/competency-scoring.ts, as_measurements |

_Standardized learning / cognitive / personality / leadership measurement (norms, standardization) is Phase 3.6 — the PARTIAL rows measure the raw indicator today; standardized measurement DEPENDS ON the scores this engine produces. That is a scope boundary, not a gap._
