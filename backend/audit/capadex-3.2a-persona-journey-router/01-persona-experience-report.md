# CAPADEX 3.0 · Phase 3.2A — Persona Experience Report

**Flag:** `personaJourneyRouter` / `FF_PERSONA_JOURNEY_ROUTER` — default **OFF** (byte-identical legacy incl. schema).
**Status:** BUILT · flag OFF · STOP-for-approval (no merge/deploy).

## 1. What changed for the assessment-taker

The generic single-page persona selector (`IntroPhase`) is replaced — **only when the flag is ON** — by a
progressive **5-step onboarding wizard** (`PersonaJourneyWizard`). When the flag is OFF, or once the wizard
is completed, the classic `IntroPhase` renders unchanged.

| Step | Name | Purpose | Maps to existing state |
|------|------|---------|------------------------|
| 1 | **Who** | Pick a macro track (school / learner / professional / proxy) or exit to a B2B/admin login | `trackId` → `isProxy` |
| 2 | **Refine** | Pick a granular sub-persona + age band (from the ONE shared taxonomy) | `primaryPersona`, `selectedPersona` (legacyKey), `ageBand` |
| 3 | **Goal** | Primary goal + optional timeline | `participantGoal`, `goalTimeline` |
| 4 | **Personalize** | Optional focus area (nothing required) | folded into `participantGoal` |
| 5 | **Your journey** | Deterministic journey resolution (assessments · lifecycle stages · dashboards · reports) | display-only |

On finish, the wizard writes the resolved selection into the **existing** modal state via the same setters
`IntroPhase` already uses, then reveals `IntroPhase` (already collapsed to the chosen persona). The downstream
analyze → clarify → questions → result flow is **completely untouched**.

## 2. Design principles honoured

- **Single taxonomy, no fork.** The wizard and `IntroPhase` both consume `frontend/src/lib/persona-taxonomy.ts`
  (`buildTrackGroups`). `IntroPhase` was refactored to import the shared module — its taxonomy data is now
  produced by the same function, so the legacy selector is byte-identical.
- **B2B/admin route out.** Employer, institution and platform-admin personas do NOT take the free assessment —
  Step 1 routes them to their EXISTING login/registration screens via `onNavigate` (no new auth surface).
- **No fabricated AI.** Step 5's "AI Journey Router" is a **deterministic** composition of the platform's
  existing registries (customer-journey + assessment-framework + lifecycle), served read-only by
  `GET /api/persona-journey/route`. Honest `PARTIAL` / adoption-gated status notes are surfaced verbatim; an
  unmapped persona shows an honest "couldn't map a tailored journey — you can still begin" message.

## 3. UX qualities

- Progressive disclosure with a 5-segment stepper (ARIA `progressbar`).
- Cross-track **search** typeahead on Step 1/2.
- **localStorage autosave/resume** (`capadex_persona_journey_wizard_v1`), cleared on finish or B2B exit.
- Keyboard focus moves to the step heading on each step change (a11y).
- Responsive grid (1-col mobile → 2/3-col desktop); WCAG-oriented contrast on brand palette.
- Age-band chips constrained to the sub-persona's allowed bands (falls back to the full canon if none).

## 4. Flag-OFF guarantee

`personaJourneyRouterEnabled` is read from `/api/capadex/public-config`. It defaults `false`; the wizard is
never mounted and the JSX falls straight through to `<IntroPhase {...allPhaseProps} />`. No schema, no route
work, no persona logic changes when OFF.
