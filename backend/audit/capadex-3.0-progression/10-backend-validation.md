# CAPADEX 3.0 · Phase 1.5 — Backend Validation

> Deliverable 10 · Generated 2026-06-30T13:37:32.258Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8c4776b58a27, written 2026-06-30T13:37:32.255Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Per-path backend evidence (services + routes + tables) VERIFIED against the live filesystem + DB.

| Path | Status | Services | Routes | Tables | Absent tables (honest) |
|---|---|---|---|---|---|
| Student → Career Growth (`student_growth`) | PARTIAL | 4/4 | 2/2 | 4/4 | — |
| Fresher → Placement Readiness (`fresher_readiness`) | SUPPORTED | 3/3 | 3/3 | 3/3 | — |
| Professional → Role Progression (`professional_progression`) | PARTIAL | 4/4 | 3/3 | 4/4 | — |
| Employee → Competency / EI Development (`employee_competency`) | SUPPORTED | 3/3 | 2/2 | 3/3 | — |
| HR / Recruiter → Hiring Progression (`recruiter_pipeline`) | SUPPORTED | 2/2 | 3/3 | 3/3 | — |
| Institute Admin → Cohort Progression (`institute_cohort`) | SUPPORTED | 1/1 | 2/2 | 2/2 | — |
| Parent → Support Child Growth (`parent_support`) | PARTIAL | 2/2 | 1/1 | 2/2 | — |
| Mentor / Coach → Mentee Progression (`mentor_mentee`) | PARTIAL | 3/3 | 1/1 | 3/3 | — |
| Faculty → Batch Progression (`faculty_batch`) | PARTIAL | 1/1 | 1/1 | 1/1 | — |

**Rollup:** services **23/23**, routes **18/18**, tables **25/25** (absent 0, unknown 0). null (unknown) ≠ 0 (absent).
