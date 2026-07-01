# CAPADEX 3.0 · Phase 3.2A — UX Validation Report

## 1. Flag-OFF byte-identical (primary guarantee)

| Check | Result |
|-------|--------|
| `GET /api/persona-journey/enabled` (flag OFF) | **503** ✓ |
| `GET /api/persona-journey/route?...` (flag OFF) | **503** ✓ |
| `/api/capadex/public-config` → `persona_journey_router` | **false** ✓ |
| Modal intro branch when OFF | falls through to `<IntroPhase {...allPhaseProps} />` (unchanged) ✓ |
| Persona taxonomy data | `IntroPhase` now builds groups via the shared `buildTrackGroups` — same inputs → same data ✓ |

## 2. Flag-ON functional (in-process resolver)

`scripts/task350-persona-journey-verify.ts` — all seven cases return HTTP 200 with correct, honest data
(see Journey Routing Report §4): every assessment-taker persona resolves to its canonical journey with real
lifecycle stages / assessment counts / status; the unmapped/admin token honestly returns `resolved:false`.

## 3. Frontend parse

`esbuild` bundle-parse (no type errors, no unresolved imports):
- `frontend/src/lib/persona-taxonomy.ts` ✓
- `frontend/src/components/assessment/phases/IntroPhase.tsx` ✓
- `frontend/src/components/assessment/PersonaJourneyWizard.tsx` ✓
- `frontend/src/components/FreeAssessmentModal.tsx` ✓

## 4. Accessibility

- Stepper exposes `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`.
- All selectable cards/chips carry `aria-pressed`.
- Focus is programmatically moved to the step heading (`tabIndex=-1`) on each step change.
- Close button has `aria-label="Close"`; search input has `aria-label`.

## 5. Resilience

- Resolver **never throws** — unexpected errors degrade to a 200 honest-degraded JSON.
- Wizard tolerates a failed/blocked `fetch` (amber degraded panel; user can still start the assessment).
- `localStorage` reads/writes are wrapped in try/catch (private-mode / quota safe).

## 6. Residual / out of scope (honest)

- Full end-to-end Playwright run and pixel/contrast audit are **not** executed here (flag OFF, no merge).
  The wizard is validated structurally (parse + resolver correctness + a11y attributes); a live UI pass is
  recommended at enablement time.
- No new analytics/telemetry events were added (out of scope for 3.2A).
