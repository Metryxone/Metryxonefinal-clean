# CAPADEX Persona Model — single source of truth

> Canonical reference for the CAPADEX persona model. Detail on each layer lives here;
> `replit.md` only carries a pointer. Honesty culture applies: Coverage ⟂ Confidence,
> `null ≠ 0`, nothing fabricated.

## The persona landscape is MULTI-AXIS by design (not a flat enum)

Governing rule: **`Persona (market axis) ≠ Role (auth axis)`**. The platform implements
several distinct, legitimate persona layers — conflating them as "duplicates" would be a
false finding.

| # | Layer (axis) | Where | Distinct values | Purpose |
|---|---|---|---|---|
| L1 | **Canonical market personas** (blueprint) | `audit/capadex-3.0-product-blueprint-final/07_PERSONA_BLUEPRINT.md` | 9 first-class P1–P9 (+7 partial, +3 missing-dedicated) | Product blueprint SSoT |
| L2 | **Runtime assessment persona** (`PersonaKey`) | `frontend/src/lib/behavioural-insights.ts` | 6: `student`, `teacher`, `campus`, `jobseeker`, `parent`, `professional` | Drives question bank, locked domains, report narrative |
| L3 | **UI selection (macro-track → sub-persona)** | `frontend/src/components/assessment/phases/IntroPhase.tsx` | macro-tracks (`school`, `learner`, `professional`, `proxy`) → sub-personas, each carrying a `legacyKey ∈ L2` + `ageBands` | User-facing onboarding selection |
| L4 | **Cohort normalization track** | `backend/services/cohort-gating.ts` | tracks (`learner`, `professional`, `proxy`); `SUB_PERSONA_TO_TRACK` | k-anon cohorting `(AgeBand × Track)` |
| L5 | **PIL stakeholder lens** | `backend/services/pil/runtime-guidance-engine.ts` | `student`, `parent`, `teacher`, `counselor`, `professional` | Report-guidance voice/framing |
| L6 | **Auth role / account type** | `backend/shared/schema.ts` + `users` | `role`, `account_type`; `staff_roles` | RBAC / permissions (orthogonal axis) |
| L7 | **Simulation personas** (non-user-facing) | `backend/services/simulation/persona-library.ts` | test fixtures | Pipeline validation only |
| L8 | **DB persona columns** | `capadex_concerns_master.primary_persona`, `adaptive_question_bank.persona`, `insight_templates.persona`, `capadex_runtime_contexts.{actor,target}_persona` | persisted persona on content/runtime rows |

**Canonical anchor for "ONE persona model":** L1 (P1–P9) is the market SSoT; the runtime
behavioural-assessment persona model is **L2 (6 `PersonaKey`s)**. L3/L4/L5/L8 are
projections/normalizations of L2; L6 is the orthogonal auth axis; L7 is test-only. The
honest statement of "ONE canonical persona model" is therefore **two anchored axes
(L1 market ⟂ L6 auth), with L2 as the single runtime assessment-persona enum that all
user-facing CAPADEX content keys on.**

## Phase 1.2 alignment implementation (flag `personaModelAlignment`)

All alignments below ship behind ONE file-registry flag `personaModelAlignment`
(`FF_PERSONA_MODEL_ALIGNMENT`, default **OFF**). **Flag-OFF is byte-identical to legacy,
including schema.** No-V2, No-Breaking-Changes, Enhancement-Only, Reuse-Before-Build.
The `Future / DO-NOT-CLAIM` verticals (govt / healthcare / clinical, G-F1–G-F6) are
explicitly **excluded** — not implemented, not claimed.

| Alignment | What it does (flag ON) | OFF behaviour |
|---|---|---|
| **A** (docs) | This doc + replit.md pointer | n/a |
| **D / G-H1 / G-H3 / G-M1** | `SUB_PERSONA_QUESTION_BANKS` + `resolveQuestionBank(subId, legacyKey, on)` in `behavioural-insights.ts` — sub-persona-tailored banks (JEE/NEET/CUET/UPSC aspirant, career_transition, career_explorer/fresher, academic_counsellor, placement_career_cell) with **provenance labels for borrowed banks** | resolver returns `QUESTION_BANKS[legacyKey]` (byte-identical) |
| **G-H2 / G-L2** | IntroPhase expands `competitive_aspirant` → JEE/NEET/CUET/UPSC sub-personas (all `legacyKey:'student'`); label-drift fixes | single competitive-aspirant entry; `TRACK_GROUPS` identical |
| **G-M2** | `cohort-gating.ts` adds `career_transition_professional`→`professional` via flag-gated `ALIGNMENT_SUB_PERSONA_TO_TRACK` + `personasForTrack()` | base map only — cohort counts unchanged |
| **G-M4 / D** | `runtime-guidance-engine.ts` adds campus / jobseeker reader lenses + counsellor `stakeholder_provenance` (returns `null` unless flag ON) | borrowed lens, `stakeholder_provenance` key absent |
| **G-L1** | `CapadexRegisterPhase.tsx` canonical sub-persona label map (display-only) | legacy labels |
| **G-M3** (data) | `adaptive_question_bank` seeded with campus/jobseeker/teacher rows as **draft** (`backend/scripts/seed-adaptive-question-bank-personas.ts`, idempotent). Serving requires human promotion to `approved` and is gated by the **adaptive questioning activation flags**, NOT `personaModelAlignment`. | runtime serves only `approved` rows → byte-identical |

### Honesty notes
- **G-M3 draft-only + flag/seed schema separation:** seeded rows are `status='draft'`.
  The runtime consumer (`pickQuestionsFromDB`) serves ONLY `approved` rows, so seeding is
  byte-identical at runtime — questions reach live assessments only after a human promotes
  them via the admin CMS. Human approval remains the only coverage-changing op.
  The **flag `personaModelAlignment` touches zero schema** (byte-identical OFF incl.
  schema). The seed is a **separate, manually-run dev op NOT gated by that flag**: it
  creates the pre-existing `adaptive_question_bank` table only IF ABSENT (no prior
  migration owned it; `CREATE TABLE` mirrors the admin CRUD contract incl. the
  `status` CHECK) and never ALTERs an existing table. Flag schema-parity and the seed's
  schema side-effect are distinct axes.
- **Borrowed content is disclosed, never fabricated:** sub-persona banks and PIL lenses
  that reuse a parent's content carry an explicit provenance label/field rather than
  inventing new content.
- **Cardinality gap L1↔L2 is expected:** P6 Employee / P7 HR / P8 Employer / P9 Institute
  are L6 auth-role products (Employer Portal, competency/EI dashboards, Institute
  dashboards), not assessment-persona keys — correct under `Persona ≠ Role`.

## Source deliverables
`backend/audit/capadex-3.0-persona-implementation/01..10_*.md` (audit + gap classification);
implementation reports under `backend/audit/capadex-3.0-persona-implementation/impl/`.
