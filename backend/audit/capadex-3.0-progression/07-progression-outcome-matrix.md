# CAPADEX 3.0 · Phase 1.5 — Progression ↔ Intervention / Outcome Matrix

> Deliverable 07 · Generated 2026-06-30T13:37:32.258Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8c4776b58a27, written 2026-06-30T13:37:32.255Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Intervention + learning path + realized-outcome definition per growth path. The continuous-growth ADOPTION is reported as a SEPARATE axis (deliverable 08), never composited with Coverage.

| Path | Status | Intervention | Learning | Outcomes |
|---|---|---|---|---|
| Student → Career Growth (`student_growth`) | PARTIAL | Concern-targeted interventions (intervention-intelligence → capadex_interventions). | Guided learning plan (learning-path-engine) surfaced in Career Builder. | Career direction chosen / measurable growth progressed; realized-outcome tail adoption-gated. |
| Fresher → Placement Readiness (`fresher_readiness`) | SUPPORTED | Readiness-gap interventions + curated practice (recommendation catalog). | Launchpad learning plan toward role readiness (learning-path-engine). | Application submitted / placed (placement outcome → validation_loop_outcomes). |
| Professional → Role Progression (`professional_progression`) | PARTIAL | Competency-gap interventions + reinforcement nudges. | Progression learning plan toward the next role band. | Role progression / promotion; adoption-gated realized-outcome tail. |
| Employee → Competency / EI Development (`employee_competency`) | SUPPORTED | EI / competency interventions (intervention-intelligence). | Competency development plan against the genome. | Competency uplift; EI development; adoption-gated outcome tail. |
| HR / Recruiter → Hiring Progression (`recruiter_pipeline`) | SUPPORTED | Funnel-stage prompts (assessment → interview → decision) — recruiter-facing. | N/A for recruiter (the candidate is the learner) — reuse only. | Hire decision / hired (hiring outcome → validation_loop_outcomes). |
| Institute Admin → Cohort Progression (`institute_cohort`) | SUPPORTED | Cohort-level intervention prompts (k≥k_min). | Cohort learning-gap roll-up (aggregate, not per-individual). | Cohort-level intervention / placement outcome (aggregate). |
| Parent → Support Child Growth (`parent_support`) | PARTIAL | Parent support actions reinforcing the child growth loop (jt_parent_support_actions). | N/A for parent (the child is the learner) — reuse only. | Support actions logged → child growth loop continuation (captureJourneyTailMilestone). |
| Mentor / Coach → Mentee Progression (`mentor_mentee`) | PARTIAL | Mentor engagement milestones reinforcing the mentee loop (jt_mentor_engagements). | Mentee guidance plan (mentor-facing). | Mentee engagement logged → guidance loop continuation (captureJourneyTailMilestone). |
| Faculty → Batch Progression (`faculty_batch`) | PARTIAL | Batch-level intervention prompts (k≥k_min, batch-confined). | Batch learning-gap roll-up (aggregate). | Batch-level intervention (aggregate). |
