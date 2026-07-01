# CAPADEX 3.0 · Program 3 · Phase 3.6 — Repository Change Summary & Alignment

> Deliverable 10 · Generated 2026-07-01T13:21:02.503Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9daf1995737b, written 2026-07-01T13:21:02.501Z).
> Scope: INSTRUMENT / QUESTION QUALITY ONLY — item analysis/reliability/validity/quality governance/blueprint validation/frontend/ux/APIs that measure how GOOD the assessment/question is; it NEVER scores or interprets a candidate and does NOT do norms/standardization/benchmarking/AI-interpretation/reports (= Phase 3.7+).
> Honesty: the EIGHT certification dimensions (item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Item-level statistics ABSTAIN below k_min=30 real responses. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

## New files (additive, flag-gated)
- `backend/config/assessment-science.ts` — canonical science registry (8 dimensions, catalogs, controls, mapping, decisions, gaps).
- `backend/services/assessment-science-mechanisms.ts` — pure `computeItemAnalysis` / `computeReliability` / `computeValidity` / `validateQuestionQuality` / `validateBlueprint` mechanisms + `asci_*` overlay ensure-schema/save + coverage helpers (DDL only on flag-gated write paths).
- `backend/services/assessment-science-engine.ts` — read-only composer/verifier (8 dimensions, catalogs, controls, mapping, repository-alignment, adoption, gaps, summary).
- `backend/routes/assessment-science.ts` — `/api/assessment-science/enabled` probe + super-admin `/api/admin/assessment-science/*` cert GETs + mechanism POSTs + overlay writes.
- `backend/scripts/capadex-3.6-assessment-science-scan.ts` + `capadex-3.6-generate-deliverables.ts` — SSoT scan + deliverable generator.
- `frontend/src/components/superadmin/AssessmentSciencePanel.tsx` + `frontend/src/components/science/PsychometricsWorkbench.tsx` — super-admin science console + interactive workbench.

## Wiring (byte-identical OFF)
- `config/feature-flags.ts`: `assessmentScience:false` + `isAssessmentScienceEnabled()` (env `FF_ASSESSMENT_SCIENCE`).
- `routes.ts`: import + `registerAssessmentScienceRoutes(...)`.
- `routes/capadex.ts`: public-config `assessment_science` (dual import-site — getter import + key).
- `SuperAdminDashboard.tsx`: lazy panel + `/enabled` probe + conditional-spread nav (hidden OFF).

## Repository alignment (Coverage-only, verified vs live FS+DB)
Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).

| Evidence kind | Present / Total |
|---|---|
| Services | 19/19 |
| Routes | 6/6 |
| Frontend | 10/10 |
| Tables | 6/13 (absent 7, unknown 0) |

_Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. asci_* overlay tables are absent while the flag has never run its write paths — that is expected + honest._
