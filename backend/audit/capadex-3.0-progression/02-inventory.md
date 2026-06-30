# CAPADEX 3.0 · Phase 1.5 — Progression Inventory

> Deliverable 02 · Generated 2026-06-30T13:37:32.258Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:8c4776b58a27, written 2026-06-30T13:37:32.255Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Every canonical persona growth path → the EXISTING implementations it REUSES (verified vs live FS+DB).

## Canonical growth spine (FROZEN, 15 steps)
1. **Assessment** (`assessment`) — undefined  _(reuses: capadex_sessions + scoring (routes/capadex.ts))_
2. **Evidence Collection** (`evidence_collection`) — undefined  _(reuses: services/wc3/longitudinal-foundation.ts → wc3_longitudinal_snapshots)_
3. **AI Interpretation** (`ai_interpretation`) — undefined  _(reuses: services/pil/runtime-guidance-engine.ts + behavioural-signal)_
4. **Recommendation Generation** (`recommendation`) — undefined  _(reuses: services/recommendation-intelligence-engine.ts + career/lbi/mei recommendation engines)_
5. **Learning Plan** (`learning_plan`) — undefined  _(reuses: services/learning-path-engine.ts)_
6. **Practice Activity** (`practice_activity`) — undefined  _(reuses: recommendation + intervention catalogs (services/pil/recommendation-catalog.ts))_
7. **Behaviour Reinforcement** (`behaviour_reinforcement`) — undefined  _(reuses: services/intervention-intelligence.ts (reinforcement-class interventions))_
8. **Competency Development** (`competency_development`) — undefined  _(reuses: services/mei-scoring-engine.ts + development_recommendations)_
9. **Personalized Intervention** (`personalized_intervention`) — undefined  _(reuses: services/intervention-intelligence.ts → capadex_interventions / lbi_intervention_library)_
10. **Progress Measurement** (`progress_measurement`) — undefined  _(reuses: services/longitudinal-memory.ts + longitudinal_patterns)_
11. **Reassessment** (`reassessment`) — undefined  _(reuses: services/capadex/progression-outcome-capture.ts (getReassessmentSignal) + wc7b/longitudinal-automation.ts)_
12. **Improvement Validation** (`improvement_validation`) — undefined  _(reuses: services/longitudinal-memory.ts (trend) + career_readiness_history)_
13. **Outcome Achievement** (`outcome_achievement`) — undefined  _(reuses: services/outcome-intelligence-engine.ts → validation_loop_outcomes)_
14. **Promotion** (`promotion`) — undefined  _(reuses: lib/lifecycle.ts + services/capadex/evidence-gate.ts → wc3_stage_progression)_
15. **Continuous Development** (`continuous_development`) — undefined  _(reuses: services/wc7b/longitudinal-automation.ts (reassessment cadence) — adoption-gated)_

## Loop-closure invariants (4)
- **INV1-RECOMMEND-TO-ACTION** — Recommendation → Learning / Practice / Intervention (the growth action is generated): `recommendation` → `personalized_intervention` via Recommendation engines feed the learning-path + intervention catalogs, so every diagnosis yields a concrete next action. COMPOSED by reference, never invoked.
- **INV2-INTERVENTION-TO-REASSESS** — Intervention → Reassessment (the action is followed by a re-measurement): `personalized_intervention` → `reassessment` via After an intervention, the reassessment signal (getReassessmentSignal) surfaces interval/exit re-administration eligibility from the accrued longitudinal record. MECHANISM present (Phase 1.3 reuse); gated by longitudinalOutcomeCapture.
- **INV3-REASSESS-TO-IMPROVEMENT** — Reassessment → Improvement validation (the re-measurement is compared to the baseline): `reassessment` → `improvement_validation` via A second datapoint lets the longitudinal trend validate improvement vs the prior baseline. MECHANISM present; effectiveness/accuracy stays abstained (no decision-time prediction recorded) until real volume accrues — honest-null, never fabricated.
- **INV4-IMPROVEMENT-TO-PROMOTION** — Improvement → Promotion / Outcome (validated growth advances the lifecycle stage): `improvement_validation` → `promotion` via Validated readiness drives stage promotion (evidence-gate readiness band) and a realized-outcome capture into the canonical ledger. MECHANISM present (evidence-gate + progression-outcome-capture); promotion is readiness-DERIVED, not a uniformly enforced per-persona gate (see GAP-P1).

## Lifecycle promotion rules (4)
- **CAP_CUR Curiosity** (SUPPORTED) — Curiosity→Insight when a baseline + diagnosis exist (readiness band derived by evidence-gate; promotion recorded in wc3_stage_progression).
- **CAP_INS Insight** (SUPPORTED) — Insight→Growth when a growth plan is generated and the subject begins acting (recommendation→action link, INV1).
- **CAP_GRW Growth** (PARTIAL) — Growth→Mastery when reassessment validates sustained improvement (readiness band high) — readiness-DERIVED (GAP-P1: not a uniformly enforced per-persona gate).
- **CAP_MAS Mastery** (PARTIAL) — Mastery is terminal in the coded ladder; the loop re-enters via continuous-development (reassessment cadence) — adoption-gated.

## Per-persona growth paths (9)

### Student → Career Growth (`student_growth`) — PARTIAL
_Strong front-half (assessment→diagnose→recommend→learn→intervene). Progress measurement MECHANISM present; per-journey reassessment/improvement is ADOPTION-pending (Coverage⟂Adoption, null≠0)._

- **Persona**: Student (school/college) (P1, P2, P3)
- **Spine reached**: 8/15 (assessment → evidence_collection → ai_interpretation → recommendation → learning_plan → practice_activity → personalized_intervention → progress_measurement)
- **Services**: services/pil/runtime-guidance-engine.ts, services/recommendation-intelligence-engine.ts, services/learning-path-engine.ts, services/intervention-intelligence.ts
- **Routes**: routes/capadex.ts, routes/student-career-builder.ts
- **Tables**: capadex_user_profiles, wc3_stage_state, capadex_interventions, wc3_longitudinal_snapshots
- **Frontend**: components/FreeAssessmentModal.tsx, components/StudentDashboard.tsx, pages/CareerBuilderPage.tsx
- **Verified**: svc 4/4 · rt 2/2 · fe 3/3 · tbl 4/4

### Fresher → Placement Readiness (`fresher_readiness`) — SUPPORTED
_Launchpad + campus placement readiness loop is live; realized placement-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage)._

- **Persona**: Fresher / final-year (job-seeker) (P4, P3)
- **Spine reached**: 8/15 (assessment → evidence_collection → ai_interpretation → recommendation → learning_plan → competency_development → progress_measurement → outcome_achievement)
- **Services**: services/career-recommendation-engine.ts, services/career-recommendation-aggregator.ts, services/learning-path-engine.ts
- **Routes**: routes/career-launchpad.ts, routes/career-readiness.ts, routes/talent-matching-engine.ts
- **Tables**: career_seeker_profiles, career_readiness_history, job_postings
- **Frontend**: pages/career/CareerLaunchpadDashboard.tsx, pages/CareerBuilderPage.tsx
- **Verified**: svc 3/3 · rt 3/3 · fe 2/2 · tbl 3/3

### Professional → Role Progression (`professional_progression`) — PARTIAL
_Reaches the FULL loop incl. reassessment→improvement→promotion as a MECHANISM, but promotion is DERIVED (not a uniformly enforced per-persona gate, GAP-P1) and validation is ADOPTION-pending (Coverage⟂Adoption⟂Confidence)._

- **Persona**: Working professional (P5)
- **Spine reached**: 10/15 (assessment → evidence_collection → ai_interpretation → recommendation → learning_plan → competency_development → progress_measurement → reassessment → improvement_validation → promotion)
- **Services**: services/recommendation-intelligence-engine.ts, services/capadex/evidence-gate.ts, services/longitudinal-memory.ts, services/wc7b/longitudinal-automation.ts
- **Routes**: routes/capadex.ts, routes/career-progression.ts, routes/career-readiness.ts
- **Tables**: wc3_stage_progression, wc3_longitudinal_snapshots, longitudinal_patterns, career_readiness_history
- **Frontend**: pages/CareerBuilderPage.tsx
- **Verified**: svc 4/4 · rt 3/3 · fe 1/1 · tbl 4/4

### Employee → Competency / EI Development (`employee_competency`) — SUPPORTED
_Competency + EI development diagnosis is well-supported (mei + intervention engines); realized development-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage)._

- **Persona**: Enterprise employee (P5, P6)
- **Spine reached**: 7/15 (assessment → evidence_collection → ai_interpretation → recommendation → competency_development → personalized_intervention → progress_measurement)
- **Services**: services/mei-scoring-engine.ts, services/mei-recommendation-engine.ts, services/intervention-intelligence.ts
- **Routes**: routes/capadex.ts, routes/career-competency-activation.ts
- **Tables**: ei_profile_snapshots, development_recommendations, wc3_longitudinal_snapshots
- **Frontend**: pages/CareerBuilderPage.tsx
- **Verified**: svc 3/3 · rt 2/2 · fe 1/1 · tbl 3/3

### HR / Recruiter → Hiring Progression (`recruiter_pipeline`) — SUPPORTED
_The 9-stage hiring funnel is the most complete progression family. Realized hiring-outcome capture exists; adoption + calibration reported separately (Adoption⟂Coverage; Brier/ECE abstain <k_min=30)._

- **Persona**: HR / recruiter (P7)
- **Spine reached**: 5/15 (assessment → ai_interpretation → recommendation → progress_measurement → outcome_achievement)
- **Services**: services/wc7b/decision-orchestrator.ts, services/validation-loop-intake.ts
- **Routes**: routes/employer-portal.ts, routes/employer-ecosystem.ts, routes/employer-hiring-intelligence.ts
- **Tables**: employer_jobs, job_postings, validation_loop_outcomes
- **Frontend**: pages/EmployerPortalPage.tsx
- **Verified**: svc 2/2 · rt 3/3 · fe 1/1 · tbl 3/3

### Institute Admin → Cohort Progression (`institute_cohort`) — SUPPORTED
_Real k-anon aggregation (MX-302H) — scores masked below k_min, roster always shown. Realized cohort-outcome tail adoption-gated._

- **Persona**: Institution administrator (P9, aggregate)
- **Spine reached**: 3/15 (ai_interpretation → recommendation → progress_measurement)
- **Services**: services/longitudinal-memory.ts
- **Routes**: routes/employer-dashboards.ts, routes/career-benchmark.ts
- **Tables**: wc3_longitudinal_snapshots, longitudinal_patterns
- **Frontend**: components/UnifiedInstituteDashboard.tsx
- **Verified**: svc 1/1 · rt 2/2 · fe 1/1 · tbl 2/2

### Parent → Support Child Growth (`parent_support`) — PARTIAL
_Support-action substrate EXISTS (journeyTailCompletion: jt_parent_support_actions, fail-closed on child ownership) and a completed action fires a journey-tail milestone into the universal outcome tail (longitudinalOutcomeCapture-gated). Residual is ADOPTION (real support-action volume — Coverage⟂Adoption, null≠0)._

- **Persona**: Parent / guardian (P1, P2)
- **Spine reached**: 2/15 (progress_measurement → behaviour_reinforcement)
- **Services**: services/journey-tail-engine.ts, services/capadex/progression-outcome-capture.ts
- **Routes**: routes/journey-tail.ts
- **Tables**: jt_parent_support_actions, validation_loop_outcomes
- **Frontend**: components/UnifiedParentDashboard.tsx
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 2/2

### Mentor / Coach → Mentee Progression (`mentor_mentee`) — PARTIAL
_Engagement substrate EXISTS (journeyTailCompletion: jt_mentor_engagements, gated BOTH directions via mentor_bookings to avoid IDOR) and a milestone fires into the universal outcome tail (longitudinalOutcomeCapture-gated). Residual is ADOPTION (real engagement volume — Coverage⟂Adoption, null≠0)._

- **Persona**: Mentor / coach (P6)
- **Spine reached**: 4/15 (recommendation → personalized_intervention → progress_measurement → behaviour_reinforcement)
- **Services**: services/journey-tail-engine.ts, services/capadex/progression-outcome-capture.ts, services/wc7b/decision-orchestrator.ts
- **Routes**: routes/journey-tail.ts
- **Tables**: jt_mentor_engagements, mentor_profiles, validation_loop_outcomes
- **Frontend**: pages/MentorDashboardPage.tsx
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 3/3

### Faculty → Batch Progression (`faculty_batch`) — PARTIAL
_Faculty batch-confined progress view EXISTS (institutional-intelligence, role-scoped batch-confined access; MX-302H). Aggregate-only — no per-individual progression. Adoption-gated cohort volume (Coverage⟂Adoption)._

- **Persona**: Faculty member (aggregate)
- **Spine reached**: 1/15 (progress_measurement)
- **Services**: services/longitudinal-memory.ts
- **Routes**: routes/employer-dashboards.ts
- **Tables**: wc3_longitudinal_snapshots
- **Frontend**: components/UnifiedInstituteDashboard.tsx
- **Verified**: svc 1/1 · rt 1/1 · fe 1/1 · tbl 1/1

## Progression decisions (not silent merges)
- **Single progression engine (no V2)** → `COMPOSE_EXISTING` — The continuous-growth loop is realised by EXISTING engines (progression-outcome-capture, evidence-gate, recommendation/learning/intervention/longitudinal). This phase adds ONE read-only composer/registry, never a parallel progression engine.
- **Promotion gate** → `READINESS_DERIVED` — Promotion is derived from evidence-gate readiness bands recorded in wc3_stage_progression, NOT a new hard gate. A uniformly enforced per-persona promotion gate is GAP-P1 (Medium) — additive/optional, never fabricated as done.
- **Reassessment cadence** → `ON_READ_SIGNAL` — getReassessmentSignal derives eligibility on read (no scheduler). Automated cadence (wc7b/longitudinal-automation) is adoption-gated. Continuous growth is a MECHANISM (Coverage) whose ADOPTION is usage-driven (null≠0).
