# CAPADEX 3.0 · Program 3 · Phase 3.7 — API Report (dimension 8 · apis)

> Deliverable 09 · Generated 2026-07-01T14:57:50.706Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:7998539a81e1, written 2026-07-01T14:57:50.705Z).
> Scope: INTERPRETATION & REPORTING ONLY — norm-referencing/standardization/benchmarking/AI-interpretation/report intelligence/candidate performance/frontend/APIs that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING; it NEVER re-scores or re-validates the instrument.
> Honesty: the EIGHT certification dimensions (norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced statistics + benchmarks ABSTAIN below k_min=30 real members; AI narrative confidence stays honest-null while cold-start. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified intelligence API surface at `/api/admin/assessment-intelligence/*` (super-admin cert GETs) + `/api/assessment-intelligence/enabled` (flag probe) + the mechanism POST paths (compute/{norm-reference,standard-scores,benchmark,interpretation,report,performance}) and the overlay write paths (norm-table/standard-score/benchmark/interpretation/report/performance save + list GETs).

## Mapping model (9 scored-result→interpretation-artefact steps)
Each step → the artifact it produces + the EXISTING engine/table it REUSES (reuse-before-build).

**Mapping status:** 8 SUPPORTED · 1 PARTIAL · 0 DEAD_END · 0 MISSING.

| Step | Target | Source (reused) | Status | Note |
|---|---|---|---|---|
| **Scored result** (`scored_result`) | Assessment Scoring (3.5) | `services/assessment-scoring-mechanisms.ts` | SUPPORTED | Interpretation consumes the measurable scores produced by the 3.5 scoring engine (score→intelligence handoff). |
| **Science handoff** (`science_handoff`) | Assessment Science (3.6) | `config/assessment-science.ts` | SUPPORTED | Interpretation consumes reliability/validity/norm handoff from 3.6 — norm-referencing rides the science seam. |
| **Norm reference** (`norm_reference`) | Norm Referencing (this phase) | `aint_norm_tables` | SUPPORTED | Every raw score maps to a norm reference (cohort/role/stage/self) in aint_norm_tables — ABSTAINS below k_min. |
| **Standard score** (`standard_score`) | Standardization (this phase) | `services/psychometric-standardization.ts` | SUPPORTED | Every raw score maps to percentile/z/T/stanine/sten/deviation standard scores in aint_standard_scores. |
| **Benchmark** (`benchmark`) | Benchmarking (this phase) | `aint_benchmarks` | SUPPORTED | Every standardized score maps to peer/role/stage/temporal benchmarks in aint_benchmarks — ABSTAINS below k_min. |
| **AI narrative** (`ai_narrative`) | AI Interpretation (this phase) | `services/intelligence-narrative-engine.ts` | SUPPORTED | Every interpreted score maps to a narrative (strengths/development/reasoning/recommendations) in aint_interpretations. |
| **Report** (`report`) | Report Intelligence (this phase) | `services/dynamic-report.ts` | SUPPORTED | Every interpretation maps to a structured, section-aware report in aint_reports. |
| **Performance analytics** (`performance_analytics`) | Candidate Performance (this phase) | `aint_performance` | SUPPORTED | Every candidate maps to overall standing / dimension profile / percentile / growth-trajectory analytics in aint_performance. |
| **Outcome & KPI handoff** (`outcome_handoff`) | Outcome & KPI (1.6) / Program cert | `config/outcome-kpi-model.ts` | PARTIAL | Interpretation ends at meaning (norms/standard-scores/benchmarks/narrative/report/performance); realized outcomes & KPI roll-up are the downstream Outcome/KPI scope (out of this engine). |

### Intelligence APIs (`apis`) — SUPPORTED
_norm / standardization / benchmark / narrative / report / performance / repository endpoints under /api/admin/assessment-intelligence, composing the existing interpretation services. Read certifications are GET (to_regclass/fs probes); pure interpretation computes are pure POSTs; overlay writes are flag-gated POSTs._

- **Services**: services/assessment-intelligence-engine.ts, services/assessment-intelligence-mechanisms.ts
- **Routes**: routes/assessment-intelligence.ts
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 0/0

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs (`compute/*`) are **PURE** (no DB) unless `persist=true`; the overlay save routes are the **ONLY** DDL sites, gated by `assessmentIntelligence` + super-admin.
- Norm-referenced statistics + benchmarks ABSTAIN below k_min=30 real members; AI narrative confidence stays honest-null while cold-start — never fabricated.
- Flag OFF → `/enabled` 503, `/api/admin/assessment-intelligence/*` 401, public-config `assessment_intelligence:false`; interpretation flow + schema byte-identical.
