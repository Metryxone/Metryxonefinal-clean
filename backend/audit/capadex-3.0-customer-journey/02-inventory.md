# CAPADEX 3.0 · Phase 1.4 — Journey Inventory

> Deliverable 02 · Generated 2026-06-30T12:16:14.559Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:c5c4c1e82876, written 2026-06-30T12:16:14.555Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

Every canonical persona journey → the EXISTING implementations it REUSES (verified vs live FS+DB).

## Canonical spine (FROZEN, 8 steps)
1. **Registration** (`registration`) — undefined
2. **Entry / Assessment** (`entry_assessment`) — undefined
3. **AI Diagnose** (`ai_diagnose`) — undefined
4. **Recommend** (`recommend`) — undefined
5. **Learn / Act / Grow** (`learn_act_grow`) — undefined
6. **(Re-measure)** (`remeasure`) — undefined
7. **Reports** (`reports`) — undefined
8. **Mastery / Outcome** (`mastery_outcome`) — undefined

## Reusable templates (5)
- **T1** — Learner growth: undefined
- **T2** — Placement: undefined
- **T3** — Hiring funnel: undefined
- **T4** — Cohort intelligence: undefined
- **T5** — Support / influencer: undefined

## Per-persona journeys (12)

### Student → Career (`student_career`) — PARTIAL
_Strong front-half (entry→diagnose→recommend→grow); no systematic re-measure/exit surfaced per-journey. The re-measure MECHANISM exists (Phase 1.3 reuse) but per-journey adoption is pending (Coverage⟂Adoption). Front-end results surfaces occasionally lack a "next step" CTA (see GAP-J4)._

- **Persona**: Student (school/college) (P1, P2, P3) · **Template**: T1
- **Spine reached**: 6/8 (registration → entry_assessment → ai_diagnose → recommend → learn_act_grow → reports)
- **Services**: services/wc3/journey-projection.ts, services/wc7b/decision-orchestrator.ts, services/wc7b/growth-plan-bridge.ts, services/pil/runtime-guidance-engine.ts
- **Routes**: routes/capadex.ts, routes/wc7b-activation.ts, routes/student-career-builder.ts
- **Tables**: capadex_user_profiles, wc3_journey_state, wc3_journey_routes, wc3_stage_state
- **Frontend**: components/FreeAssessmentModal.tsx, components/StudentDashboard.tsx, pages/CareerBuilderPage.tsx
- **Verified**: svc 4/4 · rt 3/3 · fe 3/3 · tbl 4/4

### Fresher → Placement (`fresher_placement`) — SUPPORTED
_Launchpad + campus placement are live (career-launchpad + campus-placement). Realized placement-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage)._

- **Persona**: Fresher / final-year (job-seeker) (P4, P3) · **Template**: T2
- **Spine reached**: 6/8 (registration → entry_assessment → ai_diagnose → recommend → learn_act_grow → reports)
- **Services**: services/wc3/journey-projection.ts, services/wc7b/decision-orchestrator.ts
- **Routes**: routes/career-launchpad.ts, routes/career-discovery.ts, routes/talent-matching-engine.ts
- **Tables**: career_seeker_profiles, wc3_journey_state, job_postings
- **Frontend**: pages/career/CareerLaunchpadDashboard.tsx, pages/CareerDiscoveryPage.tsx, pages/CareerBuilderPage.tsx
- **Verified**: svc 2/2 · rt 3/3 · fe 3/3 · tbl 3/3

### Professional → Progression (`professional_progression`) — PARTIAL
_Progression is DERIVED, not criteria-gated end-to-end; evidence-gated progression supplies the readiness gate but per-journey exit/promotion criteria + realized-outcome adoption are pending (Coverage⟂Adoption)._

- **Persona**: Working professional (P5) · **Template**: T1
- **Spine reached**: 6/8 (registration → entry_assessment → ai_diagnose → recommend → learn_act_grow → reports)
- **Services**: services/wc3/journey-projection.ts, services/capadex/evidence-gate.ts, services/wc3/trend-intelligence.ts
- **Routes**: routes/capadex.ts, routes/career-progression.ts, routes/career-readiness.ts
- **Tables**: employability_scoring_runs, wc3_stage_progression, wc3_longitudinal_snapshots
- **Frontend**: pages/CareerBuilderPage.tsx
- **Verified**: svc 3/3 · rt 3/3 · fe 1/1 · tbl 3/3

### Employee → Competency / EI (`employee_competency`) — SUPPORTED
_Competency + EI diagnosis is well-supported; realized development-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage)._

- **Persona**: Enterprise employee (P5, P6) · **Template**: T1
- **Spine reached**: 5/8 (registration → entry_assessment → ai_diagnose → recommend → reports)
- **Services**: services/wc3/outcome-intelligence.ts, services/wc3/intervention-intelligence.ts, services/pil/runtime-guidance-engine.ts
- **Routes**: routes/capadex.ts, routes/career-competency-activation.ts
- **Tables**: employability_scoring_runs, wc3_outcome_state, wc3_outcome_models
- **Frontend**: pages/CareerBuilderPage.tsx
- **Verified**: svc 3/3 · rt 2/2 · fe 1/1 · tbl 3/3

### HR / Recruiter → Hire (`recruiter_hire`) — SUPPORTED
_9-stage hiring funnel is the most complete journey family. Realized hiring-outcome capture exists (employer-ecosystem outcome tracking); adoption is reported separately (Adoption⟂Coverage; k_min=30 for calibration)._

- **Persona**: HR / recruiter (P7) · **Template**: T3
- **Spine reached**: 6/8 (registration → entry_assessment → ai_diagnose → recommend → learn_act_grow → reports)
- **Services**: services/wc7b/decision-orchestrator.ts, services/validation-loop-intake.ts
- **Routes**: routes/employer-portal.ts, routes/employer-ecosystem.ts, routes/employer-hiring-intelligence.ts
- **Tables**: employer_jobs, job_postings, validation_loop_outcomes
- **Frontend**: pages/EmployerPortalPage.tsx
- **Verified**: svc 2/2 · rt 3/3 · fe 1/1 · tbl 3/3

### Employer Org → Talent (`employer_talent`) — SUPPORTED
_Employer onboarding → post → match is supported; the job-store split (posting→job_postings, assessment/interview→employer_jobs) is bridged. Realized outcome tail adoption-gated._

- **Persona**: Employer organisation (P8) · **Template**: T3
- **Spine reached**: 4/8 (registration → entry_assessment → recommend → reports)
- **Services**: services/wc7b/decision-orchestrator.ts
- **Routes**: routes/employer-dashboards.ts, routes/employer-ecosystem.ts, routes/employer-tig.ts
- **Tables**: employer_jobs, job_postings, wc3_outcome_state
- **Frontend**: pages/EmployerPortalPage.tsx
- **Verified**: svc 1/1 · rt 3/3 · fe 1/1 · tbl 3/3

### Institute Admin → Cohort (`institute_cohort`) — SUPPORTED
_Real k-anon aggregation (MX-302H) — scores masked below k_min, roster always shown. Realized cohort-outcome tail adoption-gated._

- **Persona**: Institution administrator (P9, aggregate) · **Template**: T4
- **Spine reached**: 4/8 (registration → ai_diagnose → recommend → reports)
- **Services**: services/wc3/trend-intelligence.ts
- **Routes**: routes/employer-dashboards.ts, routes/career-benchmark.ts
- **Tables**: employability_scoring_runs, wc3_longitudinal_snapshots
- **Frontend**: components/UnifiedInstituteDashboard.tsx
- **Verified**: svc 1/1 · rt 2/2 · fe 1/1 · tbl 2/2

### Parent → Support Child (`parent_support`) — PARTIAL
_Journey starts (view→consent) and the support-action substrate EXISTS (journeyTailCompletion: jt_parent_support_actions, fail-closed on child ownership), but the tail is thin and the public consent-approval surface lacks a clean redirect back into the dashboard journey (GAP-J2 / GAP-J5). Tail is gated by the journeyTailCompletion flag (Coverage⟂Adoption)._

- **Persona**: Parent / guardian (P1, P2) · **Template**: T5
- **Spine reached**: 3/8 (registration → reports → learn_act_grow)
- **Services**: services/journey-tail-engine.ts
- **Routes**: routes/journey-tail.ts
- **Tables**: jt_parent_support_actions, children
- **Frontend**: components/UnifiedParentDashboard.tsx, pages/ParentConsentApprovePage.tsx
- **Verified**: svc 1/1 · rt 1/1 · fe 2/2 · tbl 2/2

### Mentor / Coach → Mentee (`mentor_mentee`) — PARTIAL
_Match + engagement substrate EXISTS (journeyTailCompletion: jt_mentor_engagements, gated BOTH directions via mentor_bookings to avoid IDOR) but the engagement tail is thin. Tail is gated by the journeyTailCompletion flag (Coverage⟂Adoption)._

- **Persona**: Mentor / coach (P6) · **Template**: T5
- **Spine reached**: 3/8 (registration → learn_act_grow → reports)
- **Services**: services/journey-tail-engine.ts, services/wc7b/decision-orchestrator.ts
- **Routes**: routes/journey-tail.ts
- **Tables**: jt_mentor_engagements, mentor_profiles, mentor_bookings
- **Frontend**: pages/MentorDashboardPage.tsx
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 3/3

### Faculty → Students (`faculty_students`) — PARTIAL
_Faculty exists as a role-aware scope nested within the institute cohort journey (batch-confined, 403 role_not_authorised) but is not a first-class top-level journey surface (GAP-J2 family)._

- **Persona**: Faculty member (aggregate) · **Template**: T4
- **Spine reached**: 2/8 (registration → reports)
- **Services**: services/wc3/trend-intelligence.ts
- **Routes**: routes/employer-dashboards.ts
- **Tables**: employability_scoring_runs
- **Frontend**: components/UnifiedInstituteDashboard.tsx
- **Verified**: svc 1/1 · rt 1/1 · fe 1/1 · tbl 1/1

### Teacher / Counsellor (`teacher_counsellor`) — DEAD_END
_GAP-J1 — TRUE dead-end: survey collected, zero continuation. The jt_stakeholder_observations substrate exists (staff-only) but is not wired into a downstream journey. The frozen blueprint recommends converting this to a continuation using EXISTING substrate (NOT a rebuild) — deferred to a later program, classified honestly here._

- **Persona**: Teacher / counsellor (P6) · **Template**: — (dead-end / cross-cutting)
- **Spine reached**: 2/8 (registration → entry_assessment)
- **Services**: services/journey-tail-engine.ts
- **Routes**: routes/journey-tail.ts
- **Tables**: jt_stakeholder_observations
- **Frontend**: —
- **Verified**: svc 1/1 · rt 1/1 · fe 0/0 · tbl 1/1

### Any Persona → Realized Outcome (tail) (`outcome_tail`) — PARTIAL
_The frozen blueprint marked this MISSING everywhere. CURRENT honest state: Phase 1.3 CLOSED the close-the-loop MECHANISM via REUSE (no new engine) — captureProgressionOutcome() + getReassessmentSignal() write/derive realized outcomes into validation_loop_outcomes, gated by the longitudinalOutcomeCapture flag. So the mechanism is now CODE-COMPLETE (Coverage), moving this from MISSING → PARTIAL; what remains is per-journey ADOPTION (real re-administration/outcome volume, currently honest-low/0, reported SEPARATELY by composeOutcomeTailAdoption — Adoption⟂Coverage, null≠0). This phase does NOT build new outcome machinery._

- **Persona**: All personas (cross-cutting) (all) · **Template**: — (dead-end / cross-cutting)
- **Spine reached**: 2/8 (remeasure → mastery_outcome)
- **Services**: services/capadex/progression-outcome-capture.ts, services/validation-loop-intake.ts
- **Routes**: routes/capadex.ts, routes/capadex-enterprise.ts
- **Tables**: validation_loop_outcomes, wc3_longitudinal_snapshots
- **Frontend**: —
- **Verified**: svc 2/2 · rt 2/2 · fe 0/0 · tbl 2/2

## Duplicate entrances (decisions, not silent merges)
- **Career Builder (one canonical flow)** ← [Student exposure CTA (studentCareerBuilder), Career Launchpad, Career Discovery (careerDiscovery)] → `KEEP_ALL` — Multiple entrances to ONE flow — the pre-existing CTAs are current behaviour; removing entrances would break byte-identical-OFF. Not duplicate journeys.
- **Assessment entry (one canonical flow)** ← [FreeAssessmentModal (flagship), AdaptiveAssessmentRuntime (flag-gated standalone)] → `KEEP_ALL` — Different entry points to assessment; flagship consumer flow vs flag-gated adaptive runtime. Keep separate, keep both.
