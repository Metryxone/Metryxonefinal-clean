# CAPADEX 3.0 · Phase 3.2A — Frontend Screens (the built wizard)

**Component:** `frontend/src/components/assessment/PersonaJourneyWizard.tsx`
**Mounted by:** `frontend/src/components/FreeAssessmentModal.tsx` (flag-gated, ahead of `IntroPhase`).

## Screen inventory

### Step 1 — Who
- 4 macro-track cards (School children · Students & learners · Working professionals · Parents/teachers/counsellors),
  each with a lucide icon, title and subtitle.
- Cross-track **search** input with a live typeahead dropdown (persona label / track title match).
- A "Not taking the assessment yourself?" block with 3 **B2B/admin exits**:
  Employer/Recruiter → `employer-login`, Institution/Placement cell → `login`, Platform administrator → `admin-login`.

### Step 2 — Refine
- Sub-persona chips for the chosen track (flag-gated expansions: exam split · enterprise · faculty appear
  exactly as they do in the legacy selector).
- Age-band chips constrained to the sub-persona's allowed bands (`AGE_BAND_LABEL`).

### Step 3 — Goal
- 6 goal options (single-select, required) + 4 timeline options (optional, toggle).

### Step 4 — Personalize
- 5 optional focus chips; explicitly skippable ("You can skip this").

### Step 5 — Your journey (deterministic AI router)
- Loading state (spinner) while `GET /api/persona-journey/route` resolves.
- Resolved: gradient "Recommended journey" hero (label + definition), lifecycle-stage spine chips,
  and info cards for Assessments / Recommendations / Dashboards / Reports.
- Honest status note rendered when `journey.statusNote` is present.
- Degraded/unmapped: amber "couldn't map a tailored journey — you can still begin" panel (never blocks the user).

## Chrome
- 5-segment progress stepper (ARIA `progressbar`, `aria-valuenow`).
- Footer: Back (hidden on step 1) + Continue (gated by `canNext`) / "Start my assessment" on the final step.
- Close (X) → `onOpenChange(false)`.

## Cross-cutting
- **Autosave/resume** via `localStorage` key `capadex_persona_journey_wizard_v1`; cleared on finish or B2B exit.
- **Keyboard/a11y**: focus moves to the step heading on step change; `aria-pressed` on all selectable chips/cards.
- **Responsive**: 1-column on mobile, 2/3-column grids on `sm+`.
- **Test hooks**: `data-testid="persona-journey-wizard"`, `data-testid="wizard-start-assessment"`.

## Validation
Validated via `esbuild` bundle-parse (full vite build is pathologically slow in this repo):
`PersonaJourneyWizard.tsx`, `IntroPhase.tsx`, `persona-taxonomy.ts`, and `FreeAssessmentModal.tsx` all parse clean.
