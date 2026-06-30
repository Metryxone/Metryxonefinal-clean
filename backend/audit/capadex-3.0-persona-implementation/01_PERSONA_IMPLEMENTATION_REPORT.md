# 01 · Persona Implementation Report

**Program 1 · Phase 1.2 — Persona Model Implementation (CAPADEX 3.0).**
Mode: Repository-First · Enhancement-Only · Reuse-Before-Build · No-V2 · No-Breaking-Changes · **STOP for approval.**
Honesty culture: Coverage ⟂ Confidence reported on separate axes · `null ≠ 0` · nothing fabricated · every claim cites repo evidence.

> **Scope note (honest):** This pass is an **implementation-readiness audit + alignment proposal**. It produces the
> 10 required deliverables and classifies all gaps. It makes **zero code, schema, feature-flag, or documentation
> changes** (see `09_REPOSITORY_CHANGES_SUMMARY.md`) — every proposed alignment is queued for human approval, per the
> phase's mandatory STOP and the project's "audits & additive phases STOP for approval" rule.

---

## A. The persona landscape is MULTI-AXIS by design (not a single flat enum)

The blueprint's own governing rule is **`Persona (market axis) ≠ Role (auth axis)`**
(`backend/audit/capadex-3.0-product-blueprint-final/07_PERSONA_BLUEPRINT.md:6`). The repository correctly implements
several **distinct, legitimate** persona layers. Conflating them as "duplicates" would be a false finding. The
measured layers:

| # | Layer (axis) | Where | Distinct values (measured) | Purpose |
|---|---|---|---|---|
| L1 | **Canonical market personas** (blueprint) | `backend/audit/capadex-3.0-product-blueprint-final/07_PERSONA_BLUEPRINT.md:13-112` | **9 first-class** P1–P9 + **7 partial** + **3 missing-dedicated** | Product blueprint SSoT |
| L2 | **Runtime assessment persona** (`PersonaKey`) | `frontend/src/lib/behavioural-insights.ts:127` | **6**: `student`, `teacher`, `campus`, `jobseeker`, `parent`, `professional` | Drives question bank, locked domains, report narrative |
| L3 | **UI selection (macro-track → sub-persona)** | `frontend/src/components/assessment/phases/IntroPhase.tsx:125-172` | **4 macro-tracks** (`school`, `learner`, `professional`, `proxy`) → **14 sub-personas**, each carrying a `legacyKey ∈ L2` + `ageBands` | User-facing onboarding selection |
| L4 | **Cohort normalization track** | `backend/services/cohort-gating.ts:35-46` | **3 tracks** (`learner`, `professional`, `proxy`); `SUB_PERSONA_TO_TRACK` = **16 entries** | k-anon statistical cohorting `(AgeBand × Track)` |
| L5 | **PIL stakeholder lens** | `backend/services/pil/runtime-guidance-engine.ts` | **5**: `student`, `parent`, `teacher`, `counselor`, `professional` | Report-guidance voice/framing |
| L6 | **Auth role / account type** | `backend/shared/schema.ts:23` (+ `users`) | `role` (default `parent`), `account_type` (default `job_seeker`); types `job_seeker`/`employer`/`institute`/`parent`/`mentor`; `staff_roles` `faculty`/`recruiter` | RBAC / permissions |
| L7 | **Simulation personas (non-user-facing)** | `backend/services/simulation/persona-library.ts` | **10** test fixtures | Pipeline validation only |
| L8 | **DB persona columns** | see `02` | `capadex_concerns_master.primary_persona` {student,parent,professional,teacher}; `adaptive_question_bank.persona` {student,parent,professional}; `insight_templates.persona` {student,parent,teacher,counsellor}; `capadex_runtime_contexts.{actor,target}_persona` | Persisted persona on content/runtime rows |

**Canonical anchor for "ONE persona model":** the blueprint **L1 (P1–P9)** is the market SSoT; the **runtime
behavioural-assessment persona model is L2 (6 `PersonaKey`s)**. L3/L4/L5/L8 are *projections/normalizations* of L2;
L6 is the orthogonal auth axis; L7 is test-only. The honest statement of "ONE canonical persona model" is therefore
**two anchored axes (L1 market ⟂ L6 auth), with L2 as the single runtime assessment-persona enum that all
user-facing CAPADEX content keys on.**

---

## B. What aligns cleanly (Repository == Blueprint)

- **L2 → L3 mapping is total and well-formed:** every one of the 14 sub-personas resolves to exactly one of the 6
  `PersonaKey`s via `legacyKey` (`IntroPhase.tsx:137-168`). No sub-persona is unmapped.
- **Two-axis honesty is already coded:** `Persona ≠ Role` is honored — assessment personas (L2) never gate
  permissions; RBAC uses L6 (`requireSuperAdmin`/`requireEmployer`). Matches blueprint rule.
- **Mentor ≡ Coach consolidation is real** (blueprint FROZEN consolidation #1; one substrate).
- **k-anon cohorting is persona-correct:** `(AgeBand × PersonaTrack)` with n<30 masking (`cohort-gating.ts`).
- **First-class personas P1–P9 each have blueprint depth** (goals/pain/journey/lifecycle/assessment/AI/reports/KPIs)
  — verified in `07_PERSONA_BLUEPRINT.md:13-112`.

## C. What does NOT fully align (honest findings — detail in `10`)

1. **Cardinality gap L1↔L2:** blueprint has **9** first-class market personas; runtime assessment has **6** keys.
   P6 Employee / P7 HR / P8 Employer / P9 Institute are **not** assessment-persona keys — they are **L6 auth-role
   products** (Employer Portal, competency/EI dashboards, Institute dashboards). This is *expected* under
   Persona≠Role, but the "ONE model" claim must state it explicitly (it does, in §A).
2. **Exam-aspirant content collapse:** `competitive_aspirant` (label "JEE / NEET / UPSC aspirant") → `legacyKey:
   'student'` (`IntroPhase.tsx:147`) → the **generic `student` question bank** (`behavioural-insights.ts:247`).
   The spec's distinct **JEE / NEET / CUET / Competitive-Exam** personas therefore share one non-exam-tailored bank;
   **CUET has no UI label** at all.
3. **Career-transition collapse:** `career_transition_professional` and `career_explorer` → `legacyKey: 'jobseeker'`
   (`IntroPhase.tsx:148,158`) → one `jobseeker` bank. Spec's Fresher / Job-Aspirant / Career-Transition collapse to one bank.
4. **Counselor collapse:** `academic_counsellor` & `placement_career_cell` → `legacyKey: 'teacher'`
   (`IntroPhase.tsx:167,168`). Spec's "Counselor" has no dedicated bank/lens distinct from teacher.
5. **Cohort-key drift:** `SUB_PERSONA_TO_TRACK` (`cohort-gating.ts:38-46`, 16 entries) contains keys **not present** in the
   IntroPhase selection set (`early_career_learner`, `professional_employee`, `student` as a sub-key) and the
   IntroPhase id `career_transition_professional` is **absent** from the cohort map — harmless (falls back to
   `'professional'`) but it is drift between L3 selection ids and L4 cohort ids.
6. **DB persona value sets are narrower than L2:** `adaptive_question_bank.persona` ∈ {student,parent,professional}
   — **missing** `campus`/`jobseeker`/`teacher`; those personas fall back to the static `behavioural-insights.ts`
   bank (honest, not broken, but DB-adaptive content does not cover all 6 keys).
7. **Legacy display-label sprawl:** `CapadexRegisterPhase.tsx:122-124` maps three variants `job_seeker` /
   `jobseeker` / `individual` for one concept (display-label only; no routing impact).

## D. Verdict

- **Repository ≈ Blueprint** on the **structural** axis: the canonical L1 market model and the L2 runtime enum exist,
  are total, and honor Persona≠Role. **No orphan persona, no broken/crashing reference, no duplicate *product*** was found.
- The divergences are **content-depth and granularity** gaps (exam/career-transition/counselor collapse) plus
  **minor drift/legacy** cosmetics — all classified in `10_REMAINING_PERSONA_GAPS.md`.
- **Confidence:** structural alignment HIGH (direct code citations). Content-coverage completeness vs the spec's
  full persona list is **PARTIAL** and honestly enumerated — never inflated to "100%".
