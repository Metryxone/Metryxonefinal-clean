# CAPADEX 3.0 · Program 3 · Phase 3.8 — Repository Change Summary & Alignment (dimension 10 · documentation)

> Deliverable 12 · Generated 2026-07-01T15:58:21.450Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:71e5cbf5bb8c, written 2026-07-01T15:58:21.449Z).
> Scope: STANDARDIZATION & INTERPRETATION ONLY — standard scores/structured-AST formula engine/interpretation rules/governance/super admin/frontend/ux/APIs/testing/documentation that turn a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into standard scores, performance bands and interpretation-rule verdicts; it NEVER re-scores or re-validates the instrument. Benchmark / AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the TEN certification dimensions (standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Norm-referenced standardization ABSTAINS below k_min=30 real members. Formulas are a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

## New files (additive, flag-gated)
- `backend/config/score-standardization.ts` — canonical standardization registry (10 dimensions, catalogs, controls, traceability, decisions, gaps).
- `backend/services/score-standardization-mechanisms.ts` — pure `computeStandardScoreSet` / `evaluateFormula` / `validateFormula` / `classifyBand` / `evaluateInterpretationRule` / validation mechanisms + `astd_*` overlay ensure-schema/save + coverage helpers (DDL only on flag-gated write paths).
- `backend/services/score-standardization-engine.ts` — read-only composer/verifier (10 dimensions, catalogs, controls, traceability, repository-alignment, adoption, gaps, summary).
- `backend/routes/score-standardization.ts` — `/api/score-standardization/enabled` probe + super-admin `/api/admin/score-standardization/*` cert GETs + mechanism POSTs + overlay writes + governance transition.
- `backend/scripts/capadex-3.8-score-standardization-scan.ts` + `capadex-3.8-generate-deliverables.ts` — SSoT scan + deliverable generator.
- `frontend/src/components/superadmin/ScoreStandardizationPanel.tsx` + `frontend/src/components/standardization/StandardizationWorkbench.tsx` — super-admin standardization console + interactive workbench.

## Wiring (byte-identical OFF)
- `config/feature-flags.ts`: `scoreStandardization:false` + `isScoreStandardizationEnabled()` (env `FF_SCORE_STANDARDIZATION`).
- `routes.ts`: import + `registerScoreStandardizationRoutes(...)`.
- `routes/capadex.ts`: public-config `score_standardization` (dual import-site — getter import + key).
- `SuperAdminDashboard.tsx`: lazy panel + `/enabled` probe + conditional-spread nav (hidden OFF).

### Documentation (`documentation`) — SUPPORTED
_A documentation set (docs/SCORE_STANDARDIZATION.md — architecture / formula framework / interpretation framework / API reference / admin guide / release notes) + the auto-generated deliverable pack (15 reports). User guide stays PARTIAL (admin guide shipped; end-user guide is a follow-on)._

- **Services**: —
- **Routes**: —
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 0/0 · rt 0/0 · fe 0/0 · tbl 0/0

## Repository alignment (Coverage-only, verified vs live FS+DB)
Every dimension evidence claim verified INDEPENDENTLY against the live filesystem + DB. null (unknown) ≠ 0 (absent).

| Evidence kind | Present / Total |
|---|---|
| Services | 11/11 |
| Routes | 6/6 |
| Frontend | 8/8 |
| Tables | 0/9 (absent 9, unknown 0) |

_Every dimension evidence claim is verified INDEPENDENTLY against the live FS (services/routes/frontend) and DB (to_regclass). null (unknown) ≠ 0 (absent). Coverage-only — kept SEPARATE from Confidence/Adoption. astd_* overlay tables are absent while the flag has never run its write paths — that is expected + honest._
