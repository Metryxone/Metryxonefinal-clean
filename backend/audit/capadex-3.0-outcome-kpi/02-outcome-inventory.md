# CAPADEX 3.0 · Phase 1.6 — Outcome Inventory

> Deliverable 02 · Generated 2026-06-30T14:10:24.976Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:93309b17121a, written 2026-06-30T14:10:24.975Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 11 canonical outcome-tracking types → the EXISTING substrate each REUSES (verified vs live FS+DB). `status` is a Coverage axis (does the substrate exist); ADOPTION (real non-demo volume) is SEPARATE (deliverable 08).

## Canonical outcome spine (FROZEN, 12 steps)
1. **Assessment** (`assessment`) — A scored behavioural / competency assessment establishes the working signal.  _(reuses: capadex_sessions + scoring (routes/capadex.ts))_
2. **Evidence Collection** (`evidence_collection`) — Evidence accrues into the longitudinal record (one datapoint per cycle).  _(reuses: services/wc3/longitudinal-foundation.ts → wc3_longitudinal_snapshots)_
3. **AI Interpretation** (`ai_interpretation`) — AI interprets signals/competencies into an explainable diagnosis.  _(reuses: services/pil/runtime-guidance-engine.ts + behavioural-signal)_
4. **Recommendation** (`recommendation`) — Next-best-action / growth recommendations are generated.  _(reuses: services/recommendation-intelligence-engine.ts + development_recommendations)_
5. **Intervention** (`intervention`) — A targeted intervention is delivered for the diagnosed gap.  _(reuses: services/intervention-intelligence.ts → capadex_interventions)_
6. **Learning** (`learning`) — A personalised learning / development plan is composed and surfaced.  _(reuses: services/learning-path-engine.ts)_
7. **Practice** (`practice`) — Practice / activities are surfaced for the learner to act on.  _(reuses: recommendation + intervention catalogs (services/pil/recommendation-catalog.ts))_
8. **Reassessment** (`reassessment`) — Interval / exit re-administration of the existing assessment (close-the-loop).  _(reuses: services/capadex/progression-outcome-capture.ts (getReassessmentSignal))_
9. **Improvement** (`improvement`) — Improvement is validated against the prior datapoint(s) as a longitudinal trend.  _(reuses: services/longitudinal-memory.ts + career_readiness_history)_
10. **Measured Outcome** (`measured_outcome`) — A realized, MEASURABLE outcome is captured into the canonical outcome ledger.  _(reuses: services/outcome-intelligence-engine.ts → validation_loop_outcomes)_
11. **KPI Update** (`kpi_update`) — The measured outcome rolls up into the individual / persona / lifecycle / business KPIs.  _(reuses: services/enterprise-analytics-schema.ts (anl_kpi_daily/anl_cohort_analysis) + services/benchmark-engine.ts)_
12. **Continuous Optimization** (`continuous_optimization`) — The loop re-enters: KPIs inform the next cycle from the new baseline.  _(reuses: services/wc7b/longitudinal-automation.ts (reassessment cadence) — adoption-gated)_

## Outcome-tracking types (11)

| Outcome type | Category | Status | Services | Tables | Absent (honest) |
|---|---|---|---|---|---|
| Assessment Completion (`assessment_completion`) | engagement | SUPPORTED | 1/1 | 1/1 | — |
| Diagnosis Delivered (`diagnosis_delivered`) | engagement | SUPPORTED | 1/1 | 1/1 | — |
| Recommendation Engagement (`recommendation_engagement`) | engagement | SUPPORTED | 1/1 | 1/1 | — |
| Intervention Uptake (`intervention_uptake`) | engagement | PARTIAL | 1/1 | 2/2 | — |
| Learning Progress (`learning_progress`) | progress | SUPPORTED | 1/1 | 1/1 | — |
| Competency / EI Improvement (`competency_improvement`) | improvement | SUPPORTED | 1/1 | 1/2 | scoring_runs |
| Readiness Uplift (`readiness_uplift`) | improvement | SUPPORTED | 1/1 | 1/1 | — |
| Reassessment Completed (`reassessment_completed`) | continuity | PARTIAL | 1/1 | 1/1 | — |
| Stage Promotion (`stage_promotion`) | lifecycle | PARTIAL | 1/1 | 2/2 | — |
| Realized Outcome (`realized_outcome`) | realized | SUPPORTED | 2/2 | 1/1 | — |
| Mastery Achievement (`mastery_achievement`) | realized | PARTIAL | 1/1 | 1/1 | — |

## Definitions & honesty notes
- **Assessment Completion** (`assessment_completion`, SUPPORTED) — A subject completes a scored assessment (the entry datapoint of every outcome chain).
- **Diagnosis Delivered** (`diagnosis_delivered`, SUPPORTED) — An explainable AI diagnosis is surfaced from the scored signal/competency profile.
- **Recommendation Engagement** (`recommendation_engagement`, SUPPORTED) — A growth recommendation is generated and surfaced for the diagnosed gap.
- **Intervention Uptake** (`intervention_uptake`, PARTIAL) — A targeted intervention is delivered (uptake inferred from intervention substrate).  _Intervention delivery substrate exists; explicit per-subject uptake telemetry is recommendation/intervention-inferred (no separate completion log) — Coverage⟂Adoption._
- **Learning Progress** (`learning_progress`, SUPPORTED) — Movement on the longitudinal record after a learning/practice cycle.
- **Competency / EI Improvement** (`competency_improvement`, SUPPORTED) — A measured uplift in a competency / EI dimension vs the baseline.
- **Readiness Uplift** (`readiness_uplift`, SUPPORTED) — A measured rise in the readiness band over the readiness history.
- **Reassessment Completed** (`reassessment_completed`, PARTIAL) — A subject re-administers the assessment (>1 longitudinal datapoint — close-the-loop).  _Reassessment signal MECHANISM present (getReassessmentSignal); real re-administration volume is ADOPTION-pending (Coverage⟂Adoption, null≠0)._
- **Stage Promotion** (`stage_promotion`, PARTIAL) — The subject advances a lifecycle stage (Curiosity→Insight→Growth→Mastery).  _Promotion is readiness-DERIVED (evidence-gate band) recorded in wc3_stage_progression, not a uniformly enforced gate — Coverage present, ADOPTION usage-driven._
- **Realized Outcome** (`realized_outcome`, SUPPORTED) — A realized career/hiring/development outcome (placement, role progression, hire, direction chosen).  _Canonical ledger present (validation_loop_outcomes via MX-102X + Phase 1.3 capture); realized-outcome volume is the universal adoption-gated tail._
- **Mastery Achievement** (`mastery_achievement`, PARTIAL) — A reached-mastery milestone is captured (terminal coded-ladder outcome + loop re-entry).  _reached_mastery capture MECHANISM present (progression-outcome-capture); realized mastery volume is honest-low/0 (Adoption⟂Coverage, null≠0)._
