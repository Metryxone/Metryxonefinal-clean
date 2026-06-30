# CAPADEX 3.0 · Phase 1.6 — Persona ↔ Outcome Matrix & Outcome-loop Adoption

> Deliverable 08 · Generated 2026-06-30T14:35:35.480Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8d7228dfcd7b, written 2026-06-30T14:35:35.479Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Per-persona outcome paths joined with measured coverage. The outcome-loop ADOPTION is a SEPARATE axis, never composited with Coverage.

| Path | Persona | Status | Spine | Axes | Outcome types | KPI families |
|---|---|---|---|---|---|---|
| Student → Career Growth (`student_growth`) | Student (school/college) | PARTIAL | 7/12 | 8/8 | 5 | 5 |
| Fresher → Placement Readiness (`fresher_readiness`) | Fresher / final-year (job-seeker) | SUPPORTED | 9/12 | 8/8 | 4 | 5 |
| Professional → Role Progression (`professional_progression`) | Working professional | PARTIAL | 10/12 | 8/8 | 5 | 4 |
| Employee → Competency / EI Development (`employee_competency`) | Enterprise employee | SUPPORTED | 7/12 | 8/8 | 5 | 4 |
| HR / Recruiter → Hiring Outcome (`recruiter_pipeline`) | HR / recruiter | SUPPORTED | 5/12 | 8/8 | 3 | 4 |
| Institute Admin → Cohort Outcome (`institute_cohort`) | Institution administrator | SUPPORTED | 4/12 | 8/8 | 2 | 4 |
| Parent → Support Child Outcome (`parent_support`) | Parent / guardian | PARTIAL | 3/12 | 8/8 | 2 | 2 |
| Mentor / Coach → Mentee Outcome (`mentor_mentee`) | Mentor / coach | PARTIAL | 4/12 | 8/8 | 3 | 2 |
| Faculty → Batch Outcome (`faculty_batch`) | Faculty member | PARTIAL | 2/12 | 8/8 | 1 | 2 |

## Outcome-loop ADOPTION (Adoption⟂Coverage — never composited)
The assessment→outcome→KPI loop is instrumented via REUSE of the existing outcome-intelligence + progression-outcome-capture machinery (no new engine/table). This measures how much that loop is **exercised** — a SEPARATE axis from whether the mechanism exists. `—` = unreadable (null≠0); a numeric `0` is a measured-empty.

| Adoption signal | Subjects/rows |
|---|---|
| Realized outcomes (total non-demo rows) | 0 |
| Distinct subjects with ≥1 realized outcome | 0 |
| Progress (stage_completion captured, non-demo) | 0 |
| Mastery (reached_mastery captured, non-demo) | 0 |
| Continuous (re-administered, >1 longitudinal datapoint) | 0 |
| Platform KPI substrate rows (anl_kpi_daily) | 10 |

_Freshness window: 180 days. Outcome capture is gated by the `longitudinalOutcomeCapture` flag and KPI population by the enterprise-analytics engine, so adoption accrues only as real subjects progress / re-administer — current values are honest, not fabricated._

## Persona ⟂ Outcome linkage (read-time join, k-anon suppressed)
Realized outcomes are attributed per persona via a READ-TIME join (zero DDL, no persona column added). `linkage_present:true` (false = join unreadable, NOT zero outcomes). Per-persona counts below k_min=30 are suppressed for anonymity.

_No persona-linked outcomes measured yet (honest empty — the persona substrate and realized-outcome volume have not yet intersected). Coverage⟂Outcome⟂Confidence never composited._
