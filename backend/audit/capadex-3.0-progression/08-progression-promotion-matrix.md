# CAPADEX 3.0 · Phase 1.5 — Progression ↔ Promotion / KPI Matrix & Growth-loop Adoption

> Deliverable 08 · Generated 2026-06-30T13:37:32.258Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8c4776b58a27, written 2026-06-30T13:37:32.255Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

| Path | Status | Promotion rule | Reassessment rule | Success criteria |
|---|---|---|---|---|
| Student → Career Growth (`student_growth`) | PARTIAL | Curiosity→Insight→Growth via baseline+diagnosis then growth-plan action (INV1). | Interval reassessment signal (getReassessmentSignal) once a baseline accrues; adoption-gated. | Assessment completion; recommendation engagement; positive re-measure movement. |
| Fresher → Placement Readiness (`fresher_readiness`) | SUPPORTED | Curiosity→Insight→Growth as readiness band rises (evidence-gate); placement = realized outcome. | Readiness re-measure as launchpad checklist advances; adoption-gated. | Launchpad completion; readiness uplift; application + placement rate. |
| Professional → Role Progression (`professional_progression`) | PARTIAL | Growth→Mastery on validated sustained improvement (readiness-DERIVED — GAP-P1). | Interval reassessment (longitudinal-automation cadence) → improvement validation vs baseline. | Re-run rate; positive-movement rate; progression cadence. |
| Employee → Competency / EI Development (`employee_competency`) | SUPPORTED | Insight→Growth as competency/EI band rises (evidence-gate readiness). | EI re-measure (ei_profile_snapshots) as development progresses; adoption-gated. | Baseline coverage; competency movement; EI delta. |
| HR / Recruiter → Hiring Progression (`recruiter_pipeline`) | SUPPORTED | Funnel-stage advancement; realized hiring-outcome capture (employer-ecosystem). | Candidate re-assessment across funnel stages; calibration accrues at k_min=30. | Funnel conversion; time-to-decision; match quality; calibration (k≥30). |
| Institute Admin → Cohort Progression (`institute_cohort`) | SUPPORTED | Cohort movement across bands (aggregate trend); no individual promotion gate. | Cohort re-measure across terms (longitudinal aggregate); adoption-gated. | Cohort coverage; cohort movement; placement rate. |
| Parent → Support Child Growth (`parent_support`) | PARTIAL | No parent promotion; reinforces the child progression (INV1 reinforcement link). | Child re-measure surfaced to the parent; support action fires a journey-tail milestone. | Consent rate; support-action adoption; child positive movement. |
| Mentor / Coach → Mentee Progression (`mentor_mentee`) | PARTIAL | No mentor promotion; advances the mentee progression (INV1/INV2 links). | Mentee re-measure across engagements; milestone fires into the outcome tail. | Match rate; engagement cadence; mentee movement. |
| Faculty → Batch Progression (`faculty_batch`) | PARTIAL | Batch movement across bands (aggregate); no individual promotion gate. | Batch re-measure across terms (aggregate); adoption-gated. | Batch coverage; batch movement. |

## Continuous-growth ADOPTION (Adoption⟂Coverage — never composited)
The continuous-growth loop (Progress / Mastery / Continuous re-administration) is instrumented via REUSE of the existing progression-outcome-capture hook (no new engine/table). This measures how much that loop is **exercised** — a SEPARATE axis from whether the mechanism exists. `—` = unreadable (null≠0); a numeric `0` is a measured-empty.

| Adoption signal | Subjects |
|---|---|
| Progress (stage_completion captured, non-demo) | 0 |
| Mastery (reached_mastery captured, non-demo) | 0 |
| Continuous (re-administered, >1 longitudinal datapoint) | 0 |
| Improvement trend substrate (longitudinal trend recorded) | — |
| Realized outcomes (total non-demo rows) | 0 |

_Freshness window: 180 days. Capture is gated by the `longitudinalOutcomeCapture` flag, so adoption accrues only as real subjects progress / re-administer — current values are honest, not fabricated._

## Persona ⟂ Progression linkage (read-time join, k-anon suppressed)
Realized progression outcomes are attributed per persona via a READ-TIME join (zero DDL, no persona column added). `linkage_present:true` (false = join unreadable, NOT zero outcomes). Per-persona counts below k_min=30 are suppressed for anonymity.

_No persona-linked outcomes measured yet (honest empty — the persona substrate and realized-outcome volume have not yet intersected). Coverage⟂Outcome⟂Confidence never composited._
