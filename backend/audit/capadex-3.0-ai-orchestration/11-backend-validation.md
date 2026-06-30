# CAPADEX 3.0 · Phase 1.7 — Backend Validation

> Deliverable 11 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Per-path backend evidence (services + routes + tables) VERIFIED against the live filesystem + DB.

| Path | Status | Services | Routes | Tables | Absent tables (honest) |
|---|---|---|---|---|---|
| Student → Growth AI loop (`student_growth`) | SUPPORTED | 4/4 | 1/1 | 4/4 | — |
| Fresher → Placement-Readiness AI loop (`fresher_readiness`) | SUPPORTED | 3/3 | 2/2 | 3/3 | — |
| Professional → Role-Progression AI loop (`professional_progression`) | PARTIAL | 3/3 | 2/2 | 3/3 | — |
| Employee → Competency / EI AI loop (`employee_competency`) | SUPPORTED | 3/3 | 1/1 | 3/3 | — |
| HR / Recruiter → Hiring AI loop (`recruiter_pipeline`) | SUPPORTED | 2/2 | 1/1 | 2/2 | — |
| Institute Admin → Cohort AI loop (`institute_cohort`) | SUPPORTED | 2/2 | 1/1 | 2/2 | — |
| Mentor / Coach → Mentee AI loop (`mentor_mentee`) | PARTIAL | 2/2 | 1/1 | 1/1 | — |
| Parent → Support-Child AI loop (`parent_support`) | PARTIAL | 1/1 | 1/1 | 1/1 | — |
| Institution → Aggregate Intelligence report (`institution_aggregate`) | PARTIAL | 2/2 | 1/1 | 2/2 | — |

**Rollup:** services **22/22**, routes **11/11**, tables **21/21** (absent 0, unknown 0). null (unknown) ≠ 0 (absent).

**Effectiveness substrate (measured):** recommendations 0 rows / — subjects · interventions 0 rows / 0 subjects · realized outcomes 0. Effectiveness rate ABSTAINED (null) by design.
