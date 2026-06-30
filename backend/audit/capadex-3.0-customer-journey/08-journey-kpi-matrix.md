# CAPADEX 3.0 · Phase 1.4 — Journey ↔ KPI Matrix & Close-the-loop Adoption

> Deliverable 08 · Generated 2026-06-30T12:16:14.559Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:c5c4c1e82876, written 2026-06-30T12:16:14.555Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

| Journey | Status | KPIs | Entry criteria | Completion criteria |
|---|---|---|---|---|
| Student → Career (`student_career`) | PARTIAL | Assessment completion; recommendation engagement; re-measure rate. | New student session via FreeAssessmentModal or Career Builder entry. | Diagnosis + recommendations delivered; growth actions surfaced. |
| Fresher → Placement (`fresher_placement`) | SUPPORTED | Launchpad completion; application rate; placement rate. | Fresher enters Career Launchpad / campus placement flow. | Readiness built + applications routed; placement loop reachable. |
| Professional → Progression (`professional_progression`) | PARTIAL | Re-run rate; positive-movement rate; progression cadence. | Professional begins competency/progression assessment. | Progression diagnosis + growth plan delivered. |
| Employee → Competency / EI (`employee_competency`) | SUPPORTED | Baseline coverage; competency movement; EI delta. | Employee enrolled in competency / EI assessment. | Baseline + diagnosis + development recommendations delivered. |
| HR / Recruiter → Hire (`recruiter_hire`) | SUPPORTED | Funnel conversion; time-to-decision; match quality. | Recruiter posts a job / opens a candidate funnel. | Candidate assessed → matched → decision recorded. |
| Employer Org → Talent (`employer_talent`) | SUPPORTED | Pipeline size; fill rate; match quality. | Employer org onboards + posts roles. | Roles posted → candidates matched (job-store split bridged). |
| Institute Admin → Cohort (`institute_cohort`) | SUPPORTED | Cohort coverage; cohort movement; placement rate. | Institute admin opens cohort analytics. | Aggregated (k≥k_min) → action surfaced. |
| Parent → Support Child (`parent_support`) | PARTIAL | Consent rate; support-action adoption. | Parent consents + views child progress. | Support-action loop available (jt_parent_support_actions). |
| Mentor / Coach → Mentee (`mentor_mentee`) | PARTIAL | Match rate; engagement cadence; mentee movement. | Mentor matched to mentee (mentor_profiles / mentor_bookings). | Engagement loop available (jt_mentor_engagements). |
| Faculty → Students (`faculty_students`) | PARTIAL | Batch coverage; batch movement. | Faculty (institute_staff) opens batch view. | Batch-confined aggregation surfaced. |
| Teacher / Counsellor (`teacher_counsellor`) | DEAD_END | Survey capture only. | Teacher/counsellor completes a survey. | Survey stored — no downstream step exists. |
| Any Persona → Realized Outcome (tail) (`outcome_tail`) | PARTIAL | Outcome-capture rate; re-administration rate. | A subject reaches a re-measure / exit boundary. | A realized-outcome row is captured (validation_loop_outcomes). |

## Close-the-loop ADOPTION (Adoption⟂Coverage — never composited)
The universal outcome tail (Progress / Exit / Continuous) is instrumented via REUSE of the existing progression-outcome-capture hook (no new engine/table). This measures how much that loop is **exercised** — a SEPARATE axis from whether the mechanism exists. `—` = unreadable (null≠0); a numeric `0` is a measured-empty.

| Adoption signal | Subjects |
|---|---|
| Progress (stage_completion captured, non-demo) | 0 |
| Exit (reached_mastery captured, non-demo) | 0 |
| Continuous (re-administered, >1 longitudinal datapoint) | 0 |
| Realized outcomes (total non-demo rows) | 0 |

_Freshness window: 180 days. Capture is gated by the `longitudinalOutcomeCapture` flag, so adoption accrues only as real subjects re-administer — current values are honest, not fabricated._

## Persona ⟂ Outcome linkage (read-time join, k-anon suppressed)
Realized outcomes are attributed per persona via a READ-TIME join (zero DDL, no persona column added). `linkage_present:true` (false = join unreadable, NOT zero outcomes). Per-persona counts below k_min=30 are suppressed for anonymity.

_No persona-linked outcomes measured yet (honest empty — the persona substrate and realized-outcome volume have not yet intersected). Coverage⟂Outcome⟂Confidence never composited._
