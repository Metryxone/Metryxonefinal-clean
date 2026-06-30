# 05 · Repository Changes Summary

Exact, file-by-file change set for Phase 1.1, plus the verification evidence.

---

## 1. New file

| File | Purpose |
|---|---|
| `backend/lib/lifecycle.ts` | **Backend canon.** Pure constants + helpers (no DB/IO/side effects): `LIFECYCLE_STAGES`, `LIFECYCLE_STAGE_CODES`, `STAGE_CODE_TO_LABEL`, `INSIGHT_DISPLAY_ALIAS='Clarity'`, `UNCODED_PRE_STAGE='Awareness'`, `stageLabel()`, `stageOrder()`, `isLifecycleStageCode()`. |

## 2. Backend modified (consolidated to the canon)

| File | Change |
|---|---|
| `services/wc3/stage-intelligence.ts` | Imports the canon; `CANONICAL_STAGE_ORDER`→`WC3_PROGRESSION_ORDER`, `CANONICAL_STAGE_WEIGHT`→`WC3_PROGRESSION_WEIGHT`; labels sourced from canon (`CAP_INS`→`INSIGHT_DISPLAY_ALIAS`); reframed as a WC3 *projection*, not a competing canon. Numeric values byte-identical. |
| `services/wc3/question-stage-intelligence.ts` | Updated import to `WC3_PROGRESSION_ORDER`. |
| `services/wc3/outcome-intelligence.ts` | Updated import to `WC3_PROGRESSION_ORDER`. |
| `services/wc3/journey-intelligence.ts` | Updated import to `WC3_PROGRESSION_ORDER`. |
| `services/wc7c/subscription-engine.ts` | Inline stage-label map → `STAGE_CODE_TO_LABEL` (import added). |
| `services/omega-report-builder.ts` | Inline stage-label map → `STAGE_CODE_TO_LABEL` (import added). |
| `services/entitlement-bridge.ts` | Inline stage-label map → `STAGE_CODE_TO_LABEL` (import added). |
| `services/adaptive-assessment.ts` | Inline stage-label map → `STAGE_CODE_TO_LABEL` (import added). |
| `routes/adaptive-assessment.ts` | Inline stage-label map → `STAGE_CODE_TO_LABEL` (import added). |
| `lib/scoring-utils.ts` | Inline stage-label map → `STAGE_CODE_TO_LABEL` (import added). |
| `routes/capadex-enterprise.ts` | Inline label map → `STAGE_CODE_TO_LABEL`; `validStages` → `LIFECYCLE_STAGE_CODES` (import added). |
| `routes.ts` | Inline label map → `STAGE_CODE_TO_LABEL`; `VALID_STAGES` → `LIFECYCLE_STAGE_CODES` (import added). |

## 3. Frontend modified (consolidated to the canon)

| File | Change |
|---|---|
| `src/lib/behavioural-insights.ts` | **Frontend canon.** Added canon doc-comment + `STAGE_CODE_TO_LABEL` + `stageLabel()` helper alongside existing `CAPADEX_STAGES`. |
| `src/pages/SDIAdminPage.tsx` | Routed to canon `STAGE_CODE_TO_LABEL` (import added). |
| `src/components/assessment/phases/CapadexReportPhase.tsx` | Routed to canon `STAGE_CODE_TO_LABEL` (added to existing canon import). |
| `src/components/assessment/phases/CapadexResultPhase.tsx` | Routed to canon `stageLabel` (imported `as canonicalStageLabel` to avoid local shadowing). |
| `src/components/assessment/phases/CapadexRegisterPhase.tsx` | Routed to canon `stageLabel as canonicalStageLabel` (import added). |
| `src/components/assessment/phases/CapadexPreviewPhase.tsx` | Routed to canon `stageLabel as canonicalStageLabel` (import added). |

## 4. NOT changed (intentional — detail in report 07)

- Stored DB strings `'Clarity'` / `'Awareness'` (load-bearing; canon documents, does not migrate).
- `frontend/server/src/routes/short-assessments.ts` (dormant 2nd JWT app, no workflow runs it).
- `update_capadex_tags.mjs` (one-off reverse-map script).
- `CapadexPackageSelectionPhase.tsx` (package-content arrays, not stage-label defs).
- WC3 stored strings and `wc3-schema.ts` seed comments.

> Note: `.replit` shows a diff (one runtime port mapping removed) — this is auto-managed by the workspace and is
> unrelated to this phase's code changes.

---

## 5. Verification evidence

| Check | Result |
|---|---|
| `Backend API` restart | ✅ `Server listening on 8080`; 11 flags loaded; all route groups registered; **zero errors** |
| Frontend `build` workflow | ✅ `✓ built in 44.68s`; 4845 modules transformed |
| Cross-org isolation suite | ✅ ALL PASS (task224 / task226 / task223) |
| Privacy E2E suite | ✅ ALL PASS (4 harnesses: profile / studio / behavioural-memory / launchpad tracker) |
| Voice-screening degradation | ✅ 6 passed / 1 skipped (provider keys absent) |
| Live-avatar degradation | ✅ 5 passed / 1 skipped (provider keys absent) |
| mockup-sandbox preview server | ⚠️ FAILED — **pre-existing & unrelated** (`ERR_MODULE_NOT_FOUND: fast-glob`), not touched by this phase |
| Residual `CANONICAL_STAGE_*` refs | ✅ none remain (grep clean; only a descriptive comment) |

Backend runs on `tsx` in dev and prod (no separate typecheck gate); the production build gate is the frontend
Vite build, which passed.
