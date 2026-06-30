# CAPADEX 3.0 · Phase 1.7 — Persona ↔ AI Matrix & Persona Linkage

> Deliverable 08 · Generated 2026-06-30T15:05:09.697Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:88fda7ccb736, written 2026-06-30T15:05:09.695Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Per-persona AI paths joined with measured coverage. Each path maps the AI flow for one persona across the 8 axes (persona/lifecycle/assessment/ai_analysis/explainability/recommendation/report/kpi).

| Path | Persona | Status | Spine | Axes | KPI families |
|---|---|---|---|---|---|
| Student → Growth AI loop (`student_growth`) | School / college student | SUPPORTED | 10/12 | 8/8 | individual, learning, journey |
| Fresher → Placement-Readiness AI loop (`fresher_readiness`) | Fresher / final-year (job-seeker) | SUPPORTED | 11/12 | 8/8 | individual, assessment, business, journey |
| Professional → Role-Progression AI loop (`professional_progression`) | Working professional | PARTIAL | 11/12 | 8/8 | individual, lifecycle, business |
| Employee → Competency / EI AI loop (`employee_competency`) | Enterprise employee | SUPPORTED | 9/12 | 8/8 | individual, learning, ai, organizational |
| HR / Recruiter → Hiring AI loop (`recruiter_pipeline`) | HR / recruiter | SUPPORTED | 7/12 | 8/8 | business, journey, ai |
| Institute Admin → Cohort AI loop (`institute_cohort`) | Institution administrator | SUPPORTED | 5/12 | 8/8 | organizational, lifecycle, business |
| Mentor / Coach → Mentee AI loop (`mentor_mentee`) | Mentor / coach | PARTIAL | 4/12 | 8/8 | journey, individual |
| Parent → Support-Child AI loop (`parent_support`) | Parent / guardian | PARTIAL | 3/12 | 8/8 | journey, individual |
| Institution → Aggregate Intelligence report (`institution_aggregate`) | Institution (aggregate) | PARTIAL | 3/12 | 8/8 | organizational, lifecycle |

## Persona ⟂ AI-outcome linkage (read-time join, k-anon suppressed)
Realized AI-driven outcomes are attributed per persona via a READ-TIME join (zero DDL, no persona column added). `linkage_present:true` (false = join unreadable, NOT zero outcomes). Per-persona counts below k_min=30 are suppressed for anonymity.

_No persona-linked outcomes measured yet (honest empty — the persona substrate and realized-outcome volume have not yet intersected). Coverage⟂Outcome⟂Confidence never composited._
