# CAPADEX 3.0 · Phase 1.4 — Backend Validation

> Deliverable 10 · Generated 2026-06-30T12:16:14.559Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:c5c4c1e82876, written 2026-06-30T12:16:14.555Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Per-journey backend evidence (services + routes + tables) VERIFIED against the live filesystem + DB.

| Journey | Status | Services | Routes | Tables | Absent tables (honest) |
|---|---|---|---|---|---|
| Student → Career (`student_career`) | PARTIAL | 4/4 | 3/3 | 4/4 | — |
| Fresher → Placement (`fresher_placement`) | SUPPORTED | 2/2 | 3/3 | 3/3 | — |
| Professional → Progression (`professional_progression`) | PARTIAL | 3/3 | 3/3 | 3/3 | — |
| Employee → Competency / EI (`employee_competency`) | SUPPORTED | 3/3 | 2/2 | 3/3 | — |
| HR / Recruiter → Hire (`recruiter_hire`) | SUPPORTED | 2/2 | 3/3 | 3/3 | — |
| Employer Org → Talent (`employer_talent`) | SUPPORTED | 1/1 | 3/3 | 3/3 | — |
| Institute Admin → Cohort (`institute_cohort`) | SUPPORTED | 1/1 | 2/2 | 2/2 | — |
| Parent → Support Child (`parent_support`) | PARTIAL | 1/1 | 1/1 | 2/2 | — |
| Mentor / Coach → Mentee (`mentor_mentee`) | PARTIAL | 2/2 | 1/1 | 3/3 | — |
| Faculty → Students (`faculty_students`) | PARTIAL | 1/1 | 1/1 | 1/1 | — |
| Teacher / Counsellor (`teacher_counsellor`) | DEAD_END | 1/1 | 1/1 | 1/1 | — |
| Any Persona → Realized Outcome (tail) (`outcome_tail`) | PARTIAL | 2/2 | 2/2 | 2/2 | — |

**Rollup:** services **23/23**, routes **25/25**, tables **30/30** (absent 0, unknown 0). null (unknown) ≠ 0 (absent).
