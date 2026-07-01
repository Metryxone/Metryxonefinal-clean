# CAPADEX 3.0 · Phase 3.2A — Journey Routing Report

**Resolver:** `backend/routes/persona-journey.ts` — public, GET-only, PURE, read-only, never-throws.
**Flag-gated:** `personaJourneyRouter` (OFF → 503-before-work).

## 1. Endpoints

| Method | Path | Behaviour |
|--------|------|-----------|
| GET | `/api/persona-journey/enabled` | Flag probe. 503 when OFF; `{ok:true,enabled:true}` when ON. |
| GET | `/api/persona-journey/route?legacyKey=&persona=&ageBand=&goal=&timeline=` | Deterministic journey resolution. |

The resolver reads **no tables and no user data** — it composes three static canonical registries:
`config/customer-journey.ts` (`CUSTOMER_JOURNEY_MODEL`), `config/assessment-framework.ts`
(`ASSESSMENT_FRAMEWORK`), and `lib/lifecycle.ts` (`LIFECYCLE_STAGES`). Zero DDL; nothing to gate at the DB layer.

## 2. Routing table (deterministic)

Sub-persona id is matched first, then `legacyKey` as fallback. Values are `CanonicalJourney.key`.

| Persona input | → Journey key |
|---------------|---------------|
| `campus_student`, `skill_development_learner`, legacy `student`/`campus` | `student_career` |
| `career_explorer`, legacy `jobseeker` | `fresher_placement` |
| `early_career_professional`, `mid_career_professional`, `people_manager`, `senior_leadership`, `learning_development`, `career_transition_professional`, legacy `professional` | `professional_progression` |
| `parent`, legacy `parent` | `parent_support` |
| `teacher_educator`, `higher_ed_faculty`, `academic_counsellor`, `placement_career_cell`, legacy `teacher` | `faculty_students` |
| unmapped (e.g. B2B/admin token) | **resolved:false** (honest, never fabricated) |

## 3. Response shape (resolved)

```
{ ok, resolved:true, input, journey:{key,label,persona,template,definition,status,statusNote},
  lifecycle:{entryStage,stages[],fullSpine}, assessments[{key,label,status,definition}],
  dashboards, reports, recommendations, aiInterpretation, learningJourney, outcomes, kpis, deterministic:true }
```

## 4. Honesty verification (flag ON, in-process)

`scripts/task350-persona-journey-verify.ts` exercises the resolver over a minimal Express app:

```
[200] /enabled                                            enabled=true
[200] student/campus_student   → student_career           stages=[Curiosity→Insight→Growth] assessments=4 status=PARTIAL
[200] jobseeker/career_explorer→ fresher_placement        stages=[Curiosity→Insight→Growth] assessments=4 status=SUPPORTED
[200] professional/people_manager → professional_progression stages=[Insight→Growth→Mastery] assessments=4 status=PARTIAL
[200] parent/parent            → parent_support           stages=[Insight→Growth] assessments=2 status=PARTIAL
[200] teacher/higher_ed_faculty→ faculty_students         stages=[Insight] assessments=2 status=PARTIAL
[200] unknown_admin            → resolved=false reason=no_assessment_journey
```

Status notes (`PARTIAL` / adoption-gated) are surfaced verbatim from the canonical registry — Coverage ⟂
Confidence ⟂ Adoption are never composited, and no journey is invented for an unmapped persona.
