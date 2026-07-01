# CAPADEX 3.0 · Program 3 · Phase 3.5 — API Report (dimension 6 · apis)

> Deliverable 08 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified scoring API surface at `/api/admin/assessment-scoring/*` (super-admin cert GETs) + `/api/assessment-scoring/enabled` (flag probe) + the mechanism POST paths (compute/score · validate/{formula,rule,config,responses}) and the overlay write paths (configs/formulas/rules upsert · scores/save · measurements/save).

## Mapping model (10 response→measurable-score steps)
Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).

**Mapping status:** 9 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING.

| Step | Target | Source (reused) | Status | Source present |
|---|---|---|---|---|
| **Authored assessment** (`authored_assessment`) | Assessment Builder (3.3) | `config/assessment-builder.ts` | SUPPORTED | true |
| **Delivered response** (`delivered_response`) | Assessment Delivery (3.4) | `services/assessment-delivery-mechanisms.ts` | SUPPORTED | true |
| **Scoring model** (`scoring_model`) | Scoring Engine (this phase) | `services/assessment-scoring-mechanisms.ts` | SUPPORTED | true |
| **Formula** (`formula`) | Formula Engine (this phase) | `as_formulas` | SUPPORTED | false |
| **Competency** (`competency`) | Competency scoring | `services/competency-scoring.ts` | SUPPORTED | true |
| **Behaviour** (`behaviour`) | Behavioural signals | `services/behavioral-dimension-signals.ts` | SUPPORTED | true |
| **Skill** (`skill`) | Skill intelligence | `services/competency-skill-intelligence.ts` | SUPPORTED | true |
| **Dimension** (`dimension`) | Dimension scoring | `services/dimension-scoring-engine.ts` | SUPPORTED | true |
| **Product blueprint** (`product_blueprint`) | Product blueprint | `config/assessment-scoring.ts` | SUPPORTED | true |
| **Psychometric handoff** (`psychometric_handoff`) | Psychometric & Item Analysis (3.6) | `config/assessment-scoring.ts` | PARTIAL | true |

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs (`compute/score`, `validate/*`) are **PURE** (no DB) unless `persist=true`; the overlay upsert/save routes are the **ONLY** DDL sites, gated by `assessmentScoring` + super-admin.
- Flag OFF → `/enabled` 503, `/api/admin/assessment-scoring/*` 401, public-config `assessment_scoring:false`; scoring flow + schema byte-identical.
