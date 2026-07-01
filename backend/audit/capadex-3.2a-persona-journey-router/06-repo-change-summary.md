# CAPADEX 3.0 · Phase 3.2A — Repository Change Summary

**Flag:** `personaJourneyRouter` / `FF_PERSONA_JOURNEY_ROUTER` — default **OFF**, byte-identical incl. schema.
Strictly additive · reuse-before-build · read-only resolver · no fork of persona logic · zero DDL.

## Backend

| File | Change |
|------|--------|
| `backend/config/feature-flags.ts` | Added `personaJourneyRouter: false` + getter `isPersonaJourneyRouterEnabled()`. |
| `backend/routes/persona-journey.ts` | **NEW** — public, GET-only, PURE resolver over customer-journey + assessment-framework + lifecycle registries. `/enabled` (503 OFF) + `/route` (deterministic, never fabricates, honest `resolved:false`). Never-throws. |
| `backend/routes.ts` | Registered import + `registerPersonaJourneyRoutes(app)` call. |
| `backend/routes/capadex.ts` | `/public-config` now exposes `persona_journey_router` via imported `isPersonaJourneyRouterEnabled()`. |
| `backend/scripts/task350-persona-journey-verify.ts` | **NEW** — in-process ON-path verification harness (does not touch the shared workflow env). |

## Frontend

| File | Change |
|------|--------|
| `frontend/src/lib/persona-taxonomy.ts` | **NEW** — the ONE shared persona taxonomy: `AGE_BANDS`/`AgeBand`/`AGE_BAND_LABEL`/`SubPersona`/`MacroTrackData`/`buildTrackGroups`/`normaliseDash`/`isCanonicalAgeBand`. Extracted verbatim from `IntroPhase` (byte-identical data). |
| `frontend/src/components/assessment/phases/IntroPhase.tsx` | Refactored to import + consume the shared taxonomy (removed the in-file duplicate taxonomy block; builds groups via `buildTrackGroups` with a local `TRACK_ICON` map). No behavioural change — OFF byte-identical. |
| `frontend/src/components/assessment/PersonaJourneyWizard.tsx` | **NEW** — the flag-gated 5-step onboarding wizard. |
| `frontend/src/components/FreeAssessmentModal.tsx` | Read `persona_journey_router` from public-config into `personaJourneyRouterEnabled`; added `journeyWizardDone`; intro branch renders the wizard when ON & not done, else the unchanged `IntroPhase`. |

## Deliverables

`backend/audit/capadex-3.2a-persona-journey-router/`:
1. `01-persona-experience-report.md`
2. `02-journey-routing-report.md`
3. `03-frontend-screens.md`
4. `04-ux-validation-report.md`
5. `05-persona-mapping-matrix.md`
6. `06-repo-change-summary.md` (this file)

## Verification

- **OFF smoke:** `/enabled` = 503, `/route` = 503, public-config `persona_journey_router` = false. ✓
- **ON path:** all resolver cases return correct/honest JSON (SUPPORTED/PARTIAL statuses; unmapped → `resolved:false`). ✓
- **Frontend parse:** all four files pass `esbuild` bundle-parse. ✓

## STOP

Flag remains **OFF**. No merge, no deploy — awaiting human approval per project convention.
