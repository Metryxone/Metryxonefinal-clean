# Persona Model EXPANSION — Implementation Report (deliverable-10 gaps G-F1..G-F6)

**Flag:** `personaModelExpansion` (`FF_PERSONA_MODEL_EXPANSION`, default **OFF**).
**Mode:** Enhancement-Only · Reuse-Before-Build · No-V2 · No-Breaking-Changes ·
byte-identical-OFF **incl. schema** (zero DDL anywhere) · reversible.
**Honesty:** Coverage ⟂ Outcomes ⟂ Confidence (never composited) · null ≠ 0 · never fabricate.

## Reuse finding (HONEST — not rebuilt)
- **G-F3** (Teacher / Counsellor journey tail) and **G-F4** (Parent & Mentor journey
  tail) **ALREADY EXIST** behind the separate `journeyTailCompletion` flag
  (`routes/journey-tail.ts`, `ParentSupportActions`, `MentorEngagementStep`,
  `TeacherCounsellorSurvey`). **Verified + documented, NOT rebuilt.**
- **G-F5** realized-outcome engine **ALREADY EXISTS** via MX-102X
  (`outcome-intelligence-engine.ts`, 6 outcome types, `OI_K_MIN=30`, honest-null). The
  expansion adds a **thin read-only per-persona breakdown that composes it** — no new
  outcome engine.

## Changes

### Backend
- `config/feature-flags.ts` — `personaModelExpansion: false` + `isPersonaModelExpansionEnabled()`.
- `routes/capadex.ts` — public-config now emits `persona_model_expansion`.
- `services/cohort-gating.ts` — `EXPANSION_SUB_PERSONA_TO_TRACK` folded into the private
  `personasForTrack()` only when the flag is ON (alignment + base maps untouched when OFF).
- `pil/runtime-guidance-engine.ts` — `mapStakeholder` + `classifyReaderLens` recognise
  **new tokens only** (faculty→teacher, leadership / learning→professional); unknown
  tokens still fall through to the legacy mapping (byte-identical OFF).
- `services/persona-expansion-engine.ts` (**new**) — read-only composer:
  - `composePersonaOutcomes(pool)` — **G-F5**. Per-persona assessment-coverage from
    `capadex_user_profiles.persona` (REAL; null when unreadable, null ≠ 0) on a SEPARATE
    axis from realized outcomes. Realized outcomes are honest-**null**
    (`linkage_present:false`, `confidence.abstained:true`) because the realized-outcome
    substrate has no persona dimension yet — empty-until-real-data, never fabricated.
    Composes MX-102X `composeOverview` for the platform rollup. k_min = 30 (inherited).
  - `composeVerticalScaffolds()` — **G-F6**. Static NON-CLINICAL scaffold registry
    (government / healthcare / clinical_psychology), each `validated:false` /
    `clinical_use:false` / `assessment_persona:false` / `question_bank:false` with five
    "not validated / not for clinical or diagnostic use" disclaimers. No DB read.
- `routes/persona-expansion.ts` (**new**) — flag-gated (503 before any work / auth / DDL):
  - `GET /api/persona-expansion/enabled` — probe (503 OFF, `{enabled:true}` ON).
  - `GET /api/persona-expansion/outcomes` — `requireAuth` + `requireSuperAdmin`; never-throws.
  - `GET /api/persona-expansion/verticals` — `requireAuth` + `requireSuperAdmin`; never-throws.
- `routes.ts` — import + `registerPersonaExpansionRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`.

### Frontend (G-F1 / G-F2)
- `lib/behavioural-insights.ts` — `SUB_PERSONA_QUESTION_BANKS` adds `people_manager`,
  `senior_leadership`, `learning_development` (legacyKey `professional`, first-person "I…")
  and `higher_ed_faculty` (legacyKey `teacher`, proxy "My students…"); all reuse existing
  domains. `resolveQuestionBank` returns the legacy bank when the flag is OFF.
- `components/assessment/types.ts` — `PhaseProps.personaModelExpansion?: boolean`.
- `components/assessment/phases/IntroPhase.tsx` — flag-gated conditional spreads add the
  three enterprise sub-personas to the `professional` track and `higher_ed_faculty` to the
  `proxy` track. OFF → arrays byte-identical to legacy.
- `components/FreeAssessmentModal.tsx` — reads `persona_model_expansion` from public-config
  into state, threads the prop, and `resolveQuestionBank` receives `(alignment || expansion)`.

## Verification
- **OFF (live workflow):** `public-config.persona_model_expansion=false`; all three routes
  return **503** (not 404 → route IS registered and the flag gate fires); frontend edits
  esbuild-parse clean.
- **ON (in-process, `FF_PERSONA_MODEL_EXPANSION=1`):** engine returns 14 persona rows incl.
  the 4 expansion personas; every row honest-null (`realized_outcomes:null`,
  `linkage_present:false`, abstained at k_min=30); assessment-coverage real (0 today, not
  null — table readable). Verticals: government / healthcare / clinical_psychology, each
  `validated:false`, `clinical_use:false`, 5 disclaimers.

## STOP
Additive phase complete — **STOP for approval, no deploy** (per user preference).
