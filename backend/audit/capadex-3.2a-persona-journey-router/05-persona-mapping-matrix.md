# CAPADEX 3.0 · Phase 3.2A — Persona Mapping Matrix

The ONE shared taxonomy (`frontend/src/lib/persona-taxonomy.ts` · `buildTrackGroups`) → `legacyKey` (PersonaKey)
→ canonical journey (`backend/routes/persona-journey.ts`). Flag-gated expansions are marked.

## Assessment-taker personas

| Macro track | Sub-persona id | legacyKey | Age bands | Flag-gated | → Journey |
|-------------|----------------|-----------|-----------|-----------|-----------|
| school | `school_primary` | student | 6-14 | — | student_career |
| school | `school_middle` | student | 6-14 | — | student_career |
| school | `school_high` | student | 14-17 | — | student_career |
| learner | `campus_student` | campus | 17-24 | — | student_career |
| learner | `competitive_aspirant` | student | 14-17,17-24 | alignment **OFF** | student_career |
| learner | `jee_aspirant` | student | 14-17,17-24 | alignment **ON** | student_career |
| learner | `neet_aspirant` | student | 14-17,17-24 | alignment **ON** | student_career |
| learner | `cuet_aspirant` | student | 14-17,17-24 | alignment **ON** | student_career |
| learner | `upsc_aspirant` | student | 17-24,24-45 | alignment **ON** | student_career |
| learner | `career_explorer` | jobseeker | 17-24,24-45 | — | fresher_placement |
| learner | `skill_development_learner` | student | 14-17,17-24,24-45 | — | student_career |
| professional | `early_career_professional` | professional | 17-24,24-45 | — | professional_progression |
| professional | `mid_career_professional` | professional | 24-45 | — | professional_progression |
| professional | `people_manager` | professional | 24-45,45+ | expansion **ON** | professional_progression |
| professional | `senior_leadership` | professional | 24-45,45+ | expansion **ON** | professional_progression |
| professional | `learning_development` | professional | 24-45,45+ | expansion **ON** | professional_progression |
| professional | `career_transition_professional` | jobseeker | 24-45,45+ | — | professional_progression |
| proxy | `parent` | parent | 6-14,14-17 | — | parent_support |
| proxy | `teacher_educator` | teacher | 6-14,14-17,17-24 | — | faculty_students |
| proxy | `higher_ed_faculty` | teacher | 17-24,24-45 | expansion **ON** | faculty_students |
| proxy | `academic_counsellor` | teacher | 14-17,17-24 | — | faculty_students |
| proxy | `placement_career_cell` | teacher | 17-24 | — | faculty_students |

> `school_*` sub-personas have no explicit sub-persona routing entry, so they resolve via the `legacyKey`
> fallback (`student` → `student_career`). All journey keys resolve against `CUSTOMER_JOURNEY_MODEL`.

## B2B / admin personas (route OUT — do NOT take the free assessment)

| Persona | Destination screen |
|---------|--------------------|
| Employer / Recruiter | `employer-login` |
| Institution / Placement cell | `login` |
| Platform administrator | `admin-login` |

## legacyKey → journey fallback

| legacyKey | Journey |
|-----------|---------|
| student, campus | student_career |
| jobseeker | fresher_placement |
| professional | professional_progression |
| parent | parent_support |
| teacher | faculty_students |

Unmapped input → **resolved:false** (`no_assessment_journey`) — never fabricated.
