# CAPADEX 3.0 · Phase 1.6 — Backend Validation

> Deliverable 11 · Generated 2026-06-30T14:35:35.480Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8d7228dfcd7b, written 2026-06-30T14:35:35.479Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Per-path backend evidence (services + routes + tables) VERIFIED against the live filesystem + DB.

| Path | Status | Services | Routes | Tables | Absent tables (honest) |
|---|---|---|---|---|---|
| Student → Career Growth (`student_growth`) | PARTIAL | 4/4 | 2/2 | 4/4 | — |
| Fresher → Placement Readiness (`fresher_readiness`) | SUPPORTED | 3/3 | 3/3 | 3/3 | — |
| Professional → Role Progression (`professional_progression`) | PARTIAL | 4/4 | 3/3 | 4/4 | — |
| Employee → Competency / EI Development (`employee_competency`) | SUPPORTED | 3/3 | 2/2 | 3/3 | — |
| HR / Recruiter → Hiring Outcome (`recruiter_pipeline`) | SUPPORTED | 3/3 | 3/3 | 3/3 | — |
| Institute Admin → Cohort Outcome (`institute_cohort`) | SUPPORTED | 2/2 | 2/2 | 3/3 | — |
| Parent → Support Child Outcome (`parent_support`) | PARTIAL | 2/2 | 1/1 | 2/2 | — |
| Mentor / Coach → Mentee Outcome (`mentor_mentee`) | PARTIAL | 3/3 | 1/1 | 3/3 | — |
| Faculty → Batch Outcome (`faculty_batch`) | PARTIAL | 2/2 | 1/1 | 2/2 | — |

**Rollup:** services **26/26**, routes **18/18**, tables **27/27** (absent 0, unknown 0). null (unknown) ≠ 0 (absent).

**Effectiveness substrate (measured):** recommendations 0 rows / — subjects · interventions 0 rows / 0 subjects · realized outcomes 0. Effectiveness rate ABSTAINED (null) by design.
