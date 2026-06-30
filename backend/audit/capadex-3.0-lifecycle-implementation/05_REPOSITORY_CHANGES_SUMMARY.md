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

---

## 6. Re-verification on the current tree (post Task #304)

Phase 1.1 landed before the Program 2 evidence-gated-progression work (Task #304), which subsequently edited
several of the **same** files (`frontend/src/lib/behavioural-insights.ts`,
`frontend/src/components/assessment/phases/StageJourneyPanel.tsx`, `backend/routes/capadex.ts`). The canon was
re-checked against the current tree to confirm no drift was introduced:

| Check (current tree) | Result |
|---|---|
| `backend/lib/lifecycle.ts` present + imported by all consolidated call-sites | ✅ intact |
| Frontend canon `CAPADEX_STAGES` / `STAGE_CODE_TO_LABEL` / `stageLabel()` present | ✅ intact (canon doc-comment preserved) |
| Inline `CAP_*→'label'` maps outside the two canons (grep) | ✅ **0 found** |
| `CANONICAL_STAGE_ORDER` / `CANONICAL_STAGE_WEIGHT` (old competing name) | ✅ **0 residual** |
| `WC3_PROGRESSION_ORDER` / `WC3_PROGRESSION_WEIGHT` (the projection) present in the 4 WC3 services | ✅ intact |
| `StageJourneyPanel.tsx` sources stage labels from the canon (`CAPADEX_STAGES`, `stage.label`/`stage.code`) | ✅ — its literal stage strings (benefits/ladder copy) are package content, not a label-map (report 07 §1.4) |
| Launch gates on the current tree (Phase 1.1 + #304) | ✅ `npx vite build` PASS; isolation, privacy-e2e, voice + live-avatar degradation, journey-tail all PASS; Backend API boots clean |

**No functional code change was required in this re-verification pass** — the prior Phase 1.1 implementation is
present, correct, and undisturbed by #304. The only edits in this pass are these evidence stamps (report 01 +
this §6). **STOP for human approval — no deploy.**
