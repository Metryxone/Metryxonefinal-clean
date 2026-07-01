---
name: Persona Journey Router (CAPADEX 3.0 3.2A)
description: Flag-gated frontend 5-step onboarding wizard + read-only journey resolver; single-taxonomy-no-fork discipline and byte-identical-OFF traps.
---

# Persona Journey Router (CAPADEX 3.0 Phase 3.2A)

Flag `personaJourneyRouter` / `FF_PERSONA_JOURNEY_ROUTER`, default OFF, byte-identical incl. schema.
FRONTEND-led: replaces the generic single-page persona selector (`IntroPhase`) with a progressive
5-step onboarding wizard (Who → Refine → Goal → Personalize → AI Journey Router) ONLY when ON.

## The single-taxonomy-no-fork rule (the core discipline)
- The wizard and the legacy `IntroPhase` MUST consume ONE persona taxonomy:
  `frontend/src/lib/persona-taxonomy.ts` (`buildTrackGroups({alignment,expansion})`).
- The taxonomy was **extracted verbatim** out of `IntroPhase` (which previously held it inline), then
  `IntroPhase` refactored to import it. **Why:** two copies of the persona list = two sources of truth =
  guaranteed drift + a forked persona model, which the phase forbids.
- **How to apply:** the flag-gated spreads (alignment aspirant JEE/NEET/CUET/UPSC split; expansion
  enterprise people_manager/senior_leadership/learning_development + higher_ed_faculty) live INSIDE
  `buildTrackGroups` behind its `alignment`/`expansion` params — driven by `personaModelAlignment` /
  `personaModelExpansion` props. Byte-identical OFF means `buildTrackGroups(false,false)` == the old inline data.

## Byte-identical-OFF gate (frontend)
- `FreeAssessmentModal` reads `persona_journey_router` from `/api/capadex/public-config` into
  `personaJourneyRouterEnabled` (defaults false). Intro branch mounts the wizard ONLY when
  `phase==='intro' && personaJourneyRouterEnabled && !journeyWizardDone`; otherwise renders the unchanged
  `<IntroPhase>`. On wizard finish it writes the SAME modal setters IntroPhase uses
  (`setPrimaryPersona`/`setSelectedPersona`(legacyKey)/`setIsProxy`/`setAgeBand`/`setParticipantGoal`/
  `setGoalTimeline`) then `setJourneyWizardDone(true)` → IntroPhase (already collapsed to the choice).

## Backend resolver
- `backend/routes/persona-journey.ts` — public, GET-only, PURE, never-throws, ZERO DDL / no DB reads.
  Composes static registries only: `config/customer-journey.ts` + `config/assessment-framework.ts` +
  `lib/lifecycle.ts`. `/enabled` (503 OFF) + `/route` (deterministic).
- Routing: sub-persona id first, then legacyKey fallback (student/campus→student_career,
  jobseeker→fresher_placement, professional→professional_progression, parent→parent_support,
  teacher→faculty_students). Unmapped → `resolved:false` / `no_assessment_journey` — **never fabricated**.
- B2B/admin personas route OUT in wizard Step 1 to EXISTING screens (employer-login/login/admin-login),
  never into the assessment.
- **Honesty parity trap:** Step 5 must render `route.journey.statusNote` VERBATIM (not a generic hardcoded
  "some steps still expanding" note) — a generic note silently misreports the canonical registry's real
  PARTIAL/adoption status. Coverage⟂Confidence⟂Adoption never composited.

## Verification pattern
- ON path verified in-process (`scripts/task350-persona-journey-verify.ts`) over a minimal Express with
  `process.env.FF_PERSONA_JOURNEY_ROUTER='1'` set BEFORE import — does NOT touch the shared workflow env,
  so the live flag stays OFF. Frontend validated via `esbuild` bundle-parse (vite build is pathologically
  slow here), never pkill.
