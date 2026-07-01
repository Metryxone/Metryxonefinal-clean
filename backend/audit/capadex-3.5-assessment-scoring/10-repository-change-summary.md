# CAPADEX 3.0 · Program 3 · Phase 3.5 — Repository Change Summary & Alignment

> Deliverable 10 · Generated 2026-07-01T10:56:39.879Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9660f5929319, written 2026-07-01T10:56:39.878Z).
> Scope: MEASUREMENT & SCORING ONLY — scoring models/response-processing/measurement-types/scoring-rules/scoring-configuration/validation/frontend/APIs that transform responses into measurable scores/indicators; NOT psychometrics/item-analysis/reliability/validity/norms/standardization/benchmarking/AI-interpretation/reports/analytics (= Phase 3.6+).
> Honesty: the SEVEN certification dimensions (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

## New files (additive, flag-gated)
- `backend/config/assessment-scoring.ts` — canonical scoring registry (7 dimensions, catalogs, controls, mapping, decisions, gaps).
- `backend/services/assessment-scoring-mechanisms.ts` — pure `computeScore` + `validate*` mechanisms + `as_*` overlay ensure-schema/upsert/save + coverage helpers (DDL only on flag-gated write paths).
- `backend/services/assessment-scoring-engine.ts` — read-only composer/verifier (7 dimensions, catalogs, controls, mapping, repository-alignment, adoption, gaps, summary).
- `backend/routes/assessment-scoring.ts` — `/api/assessment-scoring/enabled` probe + super-admin `/api/admin/assessment-scoring/*` cert GETs + mechanism POSTs + overlay writes.
- `backend/scripts/capadex-3.5-assessment-scoring-scan.ts` + `capadex-3.5-generate-deliverables.ts` — SSoT scan + deliverable generator.
- `frontend/src/components/superadmin/AssessmentScoringPanel.tsx` + `frontend/src/components/scoring/ScoringWorkbench.tsx` — super-admin scoring console + interactive workbench.

## Wiring (byte-identical OFF)
- `config/feature-flags.ts`: `assessmentScoring:false` + `isAssessmentScoringEnabled()` (env `FF_ASSESSMENT_SCORING`).
- `routes.ts`: import + `registerAssessmentScoringRoutes(...)`.
- `routes/capadex.ts`: public-config `assessment_scoring` (dual import-site — getter import + key).
- `SuperAdminDashboard.tsx`: lazy panel + `/enabled` probe + conditional-spread nav (hidden OFF).

## Repository alignment (Coverage-only, verified vs live FS+DB)
Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).

| Evidence kind | Present / Total |
|---|---|
| Services | 18/18 |
| Routes | 11/11 |
| Frontend | 15/15 |
| Tables | 2/11 (absent 9, unknown 0) |

_Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. as_* overlay tables are absent while the flag has never run its write paths — that is expected + honest._
