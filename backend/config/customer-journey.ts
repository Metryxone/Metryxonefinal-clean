/**
 * CAPADEX 3.0 — Program 1 · Phase 1.4 Customer Journey Completion & Experience Orchestration
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE ONE canonical Customer Journey Model (single source of truth).
 *
 * This module is PURE DATA. It introduces NO new journey/orchestration engine, NO V2, NO
 * duplicate flow and NO schema. It promotes the Program-0 FROZEN journey blueprint
 * (`backend/audit/capadex-3.0-product-blueprint-final/09_CUSTOMER_JOURNEY_BLUEPRINT.md`) to a
 * runtime-readable registry that maps EVERY persona journey to the eight platform axes and
 * REFERENCES the EXISTING implementations by file/table only (reuse-before-build).
 *
 * The journey spine, the five reusable templates and the per-persona register are FROZEN — this
 * phase does NOT re-decide them. Where a LATER phase changed the repo state since the blueprint
 * was frozen (Phase 1.3 instrumented the universal close-the-loop OUTCOME tail via REUSE of the
 * progression-outcome-capture hook), the registry reports the CURRENT honest state and explains
 * the delta — it never silently rewrites the frozen verdict.
 *
 * Honesty contract: `status` is a Coverage axis (does an implementation exist?), kept SEPARATE
 * from any Confidence/Outcome/Adoption axis. Evidence paths are CLAIMS verified independently by
 * `scripts/capadex-1.4-customer-journey-scan.ts` against the live filesystem + DB — the scan, not
 * this file, is the SSoT for "present/absent" numbers. null ≠ 0; never fabricate.
 */

/** Journey coverage status (mirrors the FROZEN blueprint register vocabulary). */
export type JourneyStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';

/** Canonical lifecycle stage codes (lib/lifecycle.ts). */
export type LifecycleStageCode = 'CAP_CUR' | 'CAP_INS' | 'CAP_GRW' | 'CAP_MAS';

/** Reusable journey template keys (FROZEN — new personas adopt one, never invent a flow). */
export type JourneyTemplateKey = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/** Canonical journey spine step keys (FROZEN 8-step spine). */
export type SpineStepKey =
  | 'registration'
  | 'entry_assessment'
  | 'ai_diagnose'
  | 'recommend'
  | 'learn_act_grow'
  | 'remeasure'
  | 'reports'
  | 'mastery_outcome';

/** Repo evidence — existing implementations REUSED by each journey (no rebuild). */
export interface JourneyEvidence {
  /** backend/services/*.ts engines that drive this journey (reused). */
  services: string[];
  /** backend/routes/*.ts (or routes.ts surfaces) that expose it. */
  routes: string[];
  /** database tables/objects that persist it. */
  tables: string[];
  /** frontend/src surfaces that render it. */
  frontend: string[];
}

/**
 * THE CANONICAL JOURNEY SPINE (FROZEN — 8 steps).
 * Every journey instantiates this spine and differs only by persona surface and which steps are
 * reachable. Source: 09_CUSTOMER_JOURNEY_BLUEPRINT.md "Canonical journey spine".
 */
export interface CanonicalSpineStep {
  key: SpineStepKey;
  order: number;
  label: string;
  definition: string;
}

export const CANONICAL_SPINE: CanonicalSpineStep[] = [
  { key: 'registration', order: 1, label: 'Registration', definition: 'Acquisition + identity/persona capture (or anonymous first-touch).' },
  { key: 'entry_assessment', order: 2, label: 'Entry / Assessment', definition: 'First-touch placement + the scored assessment(s) that establish a baseline.' },
  { key: 'ai_diagnose', order: 3, label: 'AI Diagnose', definition: 'AI interpretation of signals/competencies into an explainable diagnosis.' },
  { key: 'recommend', order: 4, label: 'Recommend', definition: 'Next-best-action / growth-plan / match recommendations.' },
  { key: 'learn_act_grow', order: 5, label: 'Learn / Act / Grow', definition: 'Learning, practice, intervention, application, or hiring action.' },
  { key: 'remeasure', order: 6, label: '(Re-measure)', definition: 'Interval/exit re-administration of existing assessments (close-the-loop).' },
  { key: 'reports', order: 7, label: 'Reports', definition: 'Report / passport / dashboard surface for the subject + stakeholders.' },
  { key: 'mastery_outcome', order: 8, label: 'Mastery / Outcome', definition: 'Realized-outcome capture (placed / hired / progressed / mastered).' },
];

/**
 * THE FIVE REUSABLE TEMPLATES (FROZEN).
 * Templates are reusable — new personas adopt an existing template rather than inventing a flow.
 */
export interface JourneyTemplate {
  key: JourneyTemplateKey;
  label: string;
  spine: string;
  personas: string;
  note: string;
}

export const JOURNEY_TEMPLATES: JourneyTemplate[] = [
  { key: 'T1', label: 'Learner growth', spine: 'Entry→Diagnose→Recommend→Grow→(Re-measure)→Outcome', personas: 'P1–P3, P5, P6', note: 'Individual-learner growth loop; front-half mature, back-half adoption-gated.' },
  { key: 'T2', label: 'Placement', spine: 'Entry→Diagnose→Recommend→Apply→Outcome(placed)', personas: 'P4 (fresher), P3 (campus)', note: 'Launchpad + campus placement live.' },
  { key: 'T3', label: 'Hiring funnel', spine: 'Post→Assess→Interview→Match→Decide→Outcome(hire)', personas: 'P7, P8', note: '9-stage employer hiring funnel (job-store split bridged).' },
  { key: 'T4', label: 'Cohort intelligence', spine: 'Aggregate→k-anon→Act→Outcome(cohort)', personas: 'P9 (institute), faculty', note: 'Real k-anon aggregation (MX-302H).' },
  { key: 'T5', label: 'Support / influencer', spine: 'View→Consent→Support→(loop)', personas: 'Parent, Mentor/Coach', note: 'Support-action / engagement tail (journey-tail engine).' },
];

export interface CanonicalJourney {
  key: string;
  label: string;
  /** Human persona label. */
  persona: string;
  /** Persona codes P1–P9 (see PERSONA_BLUEPRINT). 'aggregate' = institute roll-up; 'all' = cross-cutting. */
  personas: string[];
  /** Reusable template adopted, or null for a dead-end / cross-cutting tail. */
  template: JourneyTemplateKey | null;
  definition: string;
  /** Which canonical spine steps this journey actually reaches today. */
  spineReached: SpineStepKey[];
  /** Lifecycle stages the journey traverses (CAP_*). */
  lifecycleStages: LifecycleStageCode[];
  /** Canonical assessment-framework keys (Phase 1.3) this journey consumes. */
  assessments: string[];
  /** AI axis — how AI interprets this journey's signals. */
  aiInterpretation: string;
  /** Recommendation rules surfaced in this journey. */
  recommendationRules: string;
  /** Reports axis. */
  reports: string;
  /** Dashboards axis. */
  dashboards: string;
  /** Outcomes axis — realized-outcome definition for this journey. */
  outcomes: string;
  /** KPIs axis. */
  kpis: string;
  entryCriteria: string;
  completionCriteria: string;
  dependencies: string[];
  status: JourneyStatus;
  /** Honest note on WHY a status is PARTIAL/DEAD_END/MISSING (Coverage⟂Confidence⟂Outcome⟂Adoption). */
  statusNote?: string;
  evidence: JourneyEvidence;
}

/**
 * THE CANONICAL CUSTOMER JOURNEY MODEL (per persona).
 * Ordered employer/institution → individual learner → support → cross-cutting tail.
 * Statuses mirror the FROZEN 09 register; the cross-cutting outcome tail reflects the
 * CURRENT repo state after Phase 1.3 closed the mechanism via reuse (explained inline).
 */
export const CUSTOMER_JOURNEY_MODEL: CanonicalJourney[] = [
  {
    key: 'student_career',
    label: 'Student → Career',
    persona: 'Student (school/college)',
    personas: ['P1', 'P2', 'P3'],
    template: 'T1',
    definition: 'A student traverses entry assessment → AI diagnosis → recommendations → guided growth toward a career direction.',
    spineReached: ['registration', 'entry_assessment', 'ai_diagnose', 'recommend', 'learn_act_grow', 'reports'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'behaviour', 'competency'],
    aiInterpretation: 'Behavioural signal → concern routing + competency diagnosis (behavioral-signal + PIL runtime guidance).',
    recommendationRules: 'Career-builder recommendations + growth-plan bridge (decision orchestrator).',
    reports: 'CAPADEX report (CapadexReportPhase); career builder surfaces.',
    dashboards: 'Student dashboard; Career Builder.',
    outcomes: 'Career direction chosen / growth progressed; realized-outcome tail adoption-gated.',
    kpis: 'Assessment completion; recommendation engagement; re-measure rate.',
    entryCriteria: 'New student session via FreeAssessmentModal or Career Builder entry.',
    completionCriteria: 'Diagnosis + recommendations delivered; growth actions surfaced.',
    dependencies: ['entry', 'baseline', 'persona model'],
    status: 'PARTIAL',
    statusNote: 'Strong front-half (entry→diagnose→recommend→grow). GAP-J4 ENGINEERING-CLOSED: results/analysis surfaces (ResultsSummary, GapAnalysisPage, RoleTransitionPage) now carry gated next-step CTAs into Career Builder (customerJourneyCompletion → byte-identical OFF). The re-measure MECHANISM exists (Phase 1.3 reuse); per-journey re-administration is ADOPTION-pending (reported separately — Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/wc3/journey-projection.ts', 'services/wc7b/decision-orchestrator.ts', 'services/wc7b/growth-plan-bridge.ts', 'services/pil/runtime-guidance-engine.ts'],
      routes: ['routes/capadex.ts', 'routes/wc7b-activation.ts', 'routes/student-career-builder.ts'],
      tables: ['capadex_user_profiles', 'wc3_journey_state', 'wc3_journey_routes', 'wc3_stage_state'],
      frontend: ['components/FreeAssessmentModal.tsx', 'components/StudentDashboard.tsx', 'pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'fresher_placement',
    label: 'Fresher → Placement',
    persona: 'Fresher / final-year (job-seeker)',
    personas: ['P4', 'P3'],
    template: 'T2',
    definition: 'A fresher/final-year student traverses entry → diagnosis → recommendations → application toward a placement.',
    spineReached: ['registration', 'entry_assessment', 'ai_diagnose', 'recommend', 'learn_act_grow', 'reports'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'performance'],
    aiInterpretation: 'Competency + readiness diagnosis; role-DNA crosswalk for fit.',
    recommendationRules: 'Launchpad next-steps + campus placement matching.',
    reports: 'Career passport; launchpad readiness; placement surfaces.',
    dashboards: 'Career Launchpad dashboard; campus placement explorer.',
    outcomes: 'Application submitted / placed (placement outcome).',
    kpis: 'Launchpad completion; application rate; placement rate.',
    entryCriteria: 'Fresher enters Career Launchpad / campus placement flow.',
    completionCriteria: 'Readiness built + applications routed; placement loop reachable.',
    dependencies: ['competency', 'role-DNA crosswalk', 'talent matching'],
    status: 'SUPPORTED',
    statusNote: 'Launchpad + campus placement are live (career-launchpad + campus-placement). Realized placement-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage).',
    evidence: {
      services: ['services/wc3/journey-projection.ts', 'services/wc7b/decision-orchestrator.ts'],
      routes: ['routes/career-launchpad.ts', 'routes/career-discovery.ts', 'routes/talent-matching-engine.ts'],
      tables: ['career_seeker_profiles', 'wc3_journey_state', 'job_postings'],
      frontend: ['pages/career/CareerLaunchpadDashboard.tsx', 'pages/CareerDiscoveryPage.tsx', 'pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'professional_progression',
    label: 'Professional → Progression',
    persona: 'Working professional',
    personas: ['P5'],
    template: 'T1',
    definition: 'A working professional traverses entry → diagnosis → recommendations → growth toward role progression.',
    spineReached: ['registration', 'entry_assessment', 'ai_diagnose', 'recommend', 'learn_act_grow', 'reports'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['baseline', 'competency', 'performance', 'progress'],
    aiInterpretation: 'Competency + progression diagnosis; trend intelligence.',
    recommendationRules: 'Progression-aware growth plan (derived, not criteria-gated).',
    reports: 'Progression / competency report; career passport.',
    dashboards: 'Career Builder; competency intelligence.',
    outcomes: 'Role progression / promotion; adoption-gated outcome tail.',
    kpis: 'Re-run rate; positive-movement rate; progression cadence.',
    entryCriteria: 'Professional begins competency/progression assessment.',
    completionCriteria: 'Progression diagnosis + growth plan delivered.',
    dependencies: ['competency', 'progress', 'evidence-gated progression'],
    status: 'PARTIAL',
    statusNote: 'Progression is DERIVED, not criteria-gated end-to-end; evidence-gated progression supplies the readiness gate but per-journey exit/promotion criteria + realized-outcome adoption are pending (Coverage⟂Adoption).',
    evidence: {
      services: ['services/wc3/journey-projection.ts', 'services/capadex/evidence-gate.ts', 'services/wc3/trend-intelligence.ts'],
      routes: ['routes/capadex.ts', 'routes/career-progression.ts', 'routes/career-readiness.ts'],
      tables: ['employability_scoring_runs', 'wc3_stage_progression', 'wc3_longitudinal_snapshots'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'employee_competency',
    label: 'Employee → Competency / EI',
    persona: 'Enterprise employee',
    personas: ['P5', 'P6'],
    template: 'T1',
    definition: 'An enterprise employee traverses entry → baseline → diagnosis → recommendations for competency / EI development.',
    spineReached: ['registration', 'entry_assessment', 'ai_diagnose', 'recommend', 'reports'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'behaviour'],
    aiInterpretation: 'Competency genome + EI dimension diagnosis.',
    recommendationRules: 'Competency-gap → development recommendation.',
    reports: 'Competency / EI report; competency intelligence dashboard.',
    dashboards: 'Competency intelligence; EI health.',
    outcomes: 'Competency uplift; EI development; adoption-gated outcome tail.',
    kpis: 'Baseline coverage; competency movement; EI delta.',
    entryCriteria: 'Employee enrolled in competency / EI assessment.',
    completionCriteria: 'Baseline + diagnosis + development recommendations delivered.',
    dependencies: ['competency', 'baseline'],
    status: 'SUPPORTED',
    statusNote: 'Competency + EI diagnosis is well-supported; realized development-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage).',
    evidence: {
      services: ['services/wc3/outcome-intelligence.ts', 'services/wc3/intervention-intelligence.ts', 'services/pil/runtime-guidance-engine.ts'],
      routes: ['routes/capadex.ts', 'routes/career-competency-activation.ts'],
      tables: ['employability_scoring_runs', 'wc3_outcome_state', 'wc3_outcome_models'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'recruiter_hire',
    label: 'HR / Recruiter → Hire',
    persona: 'HR / recruiter',
    personas: ['P7'],
    template: 'T3',
    definition: 'A recruiter traverses post → assess → interview → match → decide toward a hiring decision.',
    spineReached: ['registration', 'entry_assessment', 'ai_diagnose', 'recommend', 'learn_act_grow', 'reports'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'performance', 'behaviour'],
    aiInterpretation: 'Candidate-match + interview intelligence (calibration k-gated).',
    recommendationRules: 'Talent-match ranking → interview → hire decision support.',
    reports: 'Candidate fitment report; hiring intelligence.',
    dashboards: 'Employer portal; hiring funnel; governance console.',
    outcomes: 'Hire decision / hired (hiring outcome).',
    kpis: 'Funnel conversion; time-to-decision; match quality.',
    entryCriteria: 'Recruiter posts a job / opens a candidate funnel.',
    completionCriteria: 'Candidate assessed → matched → decision recorded.',
    dependencies: ['talent matching', 'interview intelligence'],
    status: 'SUPPORTED',
    statusNote: '9-stage hiring funnel is the most complete journey family. Realized hiring-outcome capture exists (employer-ecosystem outcome tracking); adoption is reported separately (Adoption⟂Coverage; k_min=30 for calibration).',
    evidence: {
      services: ['services/wc7b/decision-orchestrator.ts', 'services/validation-loop-intake.ts'],
      routes: ['routes/employer-portal.ts', 'routes/employer-ecosystem.ts', 'routes/employer-hiring-intelligence.ts'],
      tables: ['employer_jobs', 'job_postings', 'validation_loop_outcomes'],
      frontend: ['pages/EmployerPortalPage.tsx'],
    },
  },
  {
    key: 'employer_talent',
    label: 'Employer Org → Talent',
    persona: 'Employer organisation',
    personas: ['P8'],
    template: 'T3',
    definition: 'An employer organisation traverses onboard → post → match to build a talent pipeline.',
    spineReached: ['registration', 'entry_assessment', 'recommend', 'reports'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['competency', 'performance'],
    aiInterpretation: 'Talent intelligence graph; role-DNA matching.',
    recommendationRules: 'Talent-pool match + workforce planning.',
    reports: 'Workforce OS; talent dashboards.',
    dashboards: 'Employer portal; Workforce OS; governance console.',
    outcomes: 'Talent pipeline built / roles filled (talent outcome).',
    kpis: 'Pipeline size; fill rate; match quality.',
    entryCriteria: 'Employer org onboards + posts roles.',
    completionCriteria: 'Roles posted → candidates matched (job-store split bridged).',
    dependencies: ['talent matching', 'employer onboarding'],
    status: 'SUPPORTED',
    statusNote: 'Employer onboarding → post → match is supported; the job-store split (posting→job_postings, assessment/interview→employer_jobs) is bridged. Realized outcome tail adoption-gated.',
    evidence: {
      services: ['services/wc7b/decision-orchestrator.ts'],
      routes: ['routes/employer-dashboards.ts', 'routes/employer-ecosystem.ts', 'routes/employer-tig.ts'],
      tables: ['employer_jobs', 'job_postings', 'wc3_outcome_state'],
      frontend: ['pages/EmployerPortalPage.tsx'],
    },
  },
  {
    key: 'institute_cohort',
    label: 'Institute Admin → Cohort',
    persona: 'Institution administrator',
    personas: ['P9', 'aggregate'],
    template: 'T4',
    definition: 'An institute admin traverses aggregate → k-anon → act on cohort intelligence.',
    spineReached: ['registration', 'ai_diagnose', 'recommend', 'reports'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['competency', 'behaviour', 'progress'],
    aiInterpretation: 'k-anon cohort aggregation (MX-302H institutional intelligence).',
    recommendationRules: 'Cohort-level act recommendations (k-gated).',
    reports: 'Cohort analytics; placement reports (k-anon).',
    dashboards: 'Unified institute dashboard; cohort analytics.',
    outcomes: 'Cohort-level intervention / placement outcome.',
    kpis: 'Cohort coverage; cohort movement; placement rate.',
    entryCriteria: 'Institute admin opens cohort analytics.',
    completionCriteria: 'Aggregated (k≥k_min) → action surfaced.',
    dependencies: ['institutional intelligence', 'k-anonymity'],
    status: 'SUPPORTED',
    statusNote: 'Real k-anon aggregation (MX-302H) — scores masked below k_min, roster always shown. Realized cohort-outcome tail adoption-gated.',
    evidence: {
      services: ['services/wc3/trend-intelligence.ts'],
      routes: ['routes/employer-dashboards.ts', 'routes/career-benchmark.ts'],
      tables: ['employability_scoring_runs', 'wc3_longitudinal_snapshots'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    },
  },
  {
    key: 'parent_support',
    label: 'Parent → Support Child',
    persona: 'Parent / guardian',
    personas: ['P1', 'P2'],
    template: 'T5',
    definition: 'A parent traverses view → consent → support actions for their child.',
    spineReached: ['registration', 'reports', 'learn_act_grow'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['behaviour', 'competency'],
    aiInterpretation: 'Child progress framing via consent-scoped view.',
    recommendationRules: 'Support-action recommendations (journey-tail engine).',
    reports: 'Child progress view (consent-gated).',
    dashboards: 'Unified parent dashboard; ParentLbiScreen.',
    outcomes: 'Support actions logged; loop continuation.',
    kpis: 'Consent rate; support-action adoption.',
    entryCriteria: 'Parent consents + views child progress.',
    completionCriteria: 'Support-action loop available (jt_parent_support_actions).',
    dependencies: ['journey tail completion', 'consent'],
    status: 'PARTIAL',
    statusNote: 'Journey starts (view→consent) and the support-action substrate EXISTS (journeyTailCompletion: jt_parent_support_actions, fail-closed on child ownership). GAP-J5 ENGINEERING-CLOSED: ParentConsentApprovePage now redirects into the unified-parent-dashboard journey after approval (gated CTA + post-action redirect, customerJourneyCompletion → byte-identical OFF). GAP-J2/J3 ENGINEERING-CLOSED via REUSE: a completed support action fires a journey-tail milestone into the universal outcome tail (captureJourneyTailMilestone, longitudinalOutcomeCapture-gated). Residual is ADOPTION (real support-action volume, usage-driven — Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/journey-tail-engine.ts'],
      routes: ['routes/journey-tail.ts'],
      tables: ['jt_parent_support_actions', 'children'],
      frontend: ['components/UnifiedParentDashboard.tsx', 'pages/ParentConsentApprovePage.tsx'],
    },
  },
  {
    key: 'mentor_mentee',
    label: 'Mentor / Coach → Mentee',
    persona: 'Mentor / coach',
    personas: ['P6'],
    template: 'T5',
    definition: 'A mentor traverses match → engage → guide a mentee.',
    spineReached: ['registration', 'learn_act_grow', 'reports'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'progress'],
    aiInterpretation: 'Mentee progress framing; decision-mentor bridge.',
    recommendationRules: 'Engagement / guidance recommendations (journey-tail engine).',
    reports: 'Mentee progress; mentor engagement log.',
    dashboards: 'Mentor dashboard.',
    outcomes: 'Mentee engagement logged; guidance loop.',
    kpis: 'Match rate; engagement cadence; mentee movement.',
    entryCriteria: 'Mentor matched to mentee (mentor_profiles / mentor_bookings).',
    completionCriteria: 'Engagement loop available (jt_mentor_engagements).',
    dependencies: ['journey tail completion', 'mentor bookings'],
    status: 'PARTIAL',
    statusNote: 'Match + engagement substrate EXISTS (journeyTailCompletion: jt_mentor_engagements, gated BOTH directions via mentor_bookings to avoid IDOR). GAP-J2/J3 ENGINEERING-CLOSED via REUSE: a mentor engagement milestone now fires into the universal outcome tail (captureJourneyTailMilestone, longitudinalOutcomeCapture-gated). Residual is ADOPTION (real engagement volume, usage-driven — Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/journey-tail-engine.ts', 'services/wc7b/decision-orchestrator.ts'],
      routes: ['routes/journey-tail.ts'],
      tables: ['jt_mentor_engagements', 'mentor_profiles', 'mentor_bookings'],
      frontend: ['pages/MentorDashboardPage.tsx'],
    },
  },
  {
    key: 'faculty_students',
    label: 'Faculty → Students',
    persona: 'Faculty member',
    personas: ['aggregate'],
    template: 'T4',
    definition: 'A faculty member views a batch-confined nested cohort journey under the institute.',
    spineReached: ['registration', 'reports'],
    lifecycleStages: ['CAP_INS'],
    assessments: ['competency', 'behaviour'],
    aiInterpretation: 'Batch-confined cohort aggregation (nested in institute).',
    recommendationRules: 'Faculty-scoped act recommendations (k-gated).',
    reports: 'Batch analytics (role-scoped, faculty batch-confined).',
    dashboards: 'Institute dashboard (faculty-scoped view).',
    outcomes: 'Batch-level intervention.',
    kpis: 'Batch coverage; batch movement.',
    entryCriteria: 'Faculty (institute_staff) opens batch view.',
    completionCriteria: 'Batch-confined aggregation surfaced.',
    dependencies: ['institutional intelligence', 'institute admin → cohort'],
    status: 'PARTIAL',
    statusNote: 'GAP-J2 ENGINEERING-CLOSED: faculty is now a first-class batch-scoped surface — the institutional-intelligence heatmap/gaps endpoints grant faculty role batch-confined access (server-driven: 200 ON / 403 OFF, role-aware, never admin-only), and the frontend faculty tab auto-shows/hides byte-identically off the server response. Scope stays batch-confined (403 role_not_authorised outside scope). Residual is ADOPTION (Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/wc3/trend-intelligence.ts'],
      routes: ['routes/employer-dashboards.ts'],
      tables: ['employability_scoring_runs'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    },
  },
  {
    key: 'teacher_counsellor',
    label: 'Teacher / Counsellor',
    persona: 'Teacher / counsellor',
    personas: ['P6'],
    template: null,
    definition: 'Teacher/counsellor survey is collected but has no downstream journey — a true dead-end.',
    spineReached: ['registration', 'entry_assessment', 'learn_act_grow', 'mastery_outcome'],
    lifecycleStages: ['CAP_CUR'],
    assessments: ['entry'],
    aiInterpretation: 'Observation summary surfaced to the counsellor in the follow-up queue.',
    recommendationRules: 'Follow-up continuation — resolve / act on the submitted observation.',
    reports: 'Counsellor follow-up queue (ObservationFollowUpQueue).',
    dashboards: 'Counsellor follow-up continuation nested in the institute dashboard (gated).',
    outcomes: 'Resolution fires a journey-tail milestone into the universal outcome tail (reuse; adoption-gated).',
    kpis: 'Survey capture + follow-up resolution volume (usage-driven).',
    entryCriteria: 'Teacher/counsellor completes a survey / submits an observation.',
    completionCriteria: 'Observation resolved via follow-up continuation; milestone captured (flag-ON, adoption-gated).',
    dependencies: ['stakeholder observations (substrate)', 'progression-outcome-capture (reuse)'],
    status: 'PARTIAL',
    statusNote: 'GAP-J1 ENGINEERING-CLOSED via REUSE: the teacher/counsellor survey is no longer a dead-end. Submitted observations now surface in a follow-up continuation (frontend ObservationFollowUpQueue → GET /api/journey-tail/counsellor/follow-up-queue + PATCH /observations/:id/follow-up resolution), and resolving an observation fires a journey-tail milestone into the universal outcome tail (captureJourneyTailMilestone, reuse of the Phase-1.3 progression-capture hook, gated by longitudinalOutcomeCapture). All gated by customerJourneyCompletion → byte-identical OFF. Residual is ADOPTION (real resolution volume, usage-driven, reported SEPARATELY — Adoption⟂Coverage, null≠0), not an engineering gap.',
    evidence: {
      services: ['services/journey-tail-engine.ts', 'services/capadex/progression-outcome-capture.ts'],
      routes: ['routes/journey-tail.ts'],
      tables: ['jt_stakeholder_observations'],
      frontend: ['components/journey-tail/ObservationFollowUpQueue.tsx'],
    },
  },
  {
    key: 'outcome_tail',
    label: 'Any Persona → Realized Outcome (tail)',
    persona: 'All personas (cross-cutting)',
    personas: ['all'],
    template: null,
    definition: 'The universal close-the-loop tail: every journey should end in a measured realized outcome.',
    spineReached: ['remeasure', 'mastery_outcome'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    assessments: ['progress', 'exit', 'continuous'],
    aiInterpretation: 'Reuses existing longitudinal / progression interpretation.',
    recommendationRules: 'Re-measure → advance / remediate (reused readiness gate).',
    reports: 'Progression / outcome report (reuse).',
    dashboards: 'Progression / outcome views (reuse).',
    outcomes: 'Realized outcome captured (placed / hired / progressed / mastered).',
    kpis: 'Outcome-capture rate; re-administration rate.',
    entryCriteria: 'A subject reaches a re-measure / exit boundary.',
    completionCriteria: 'A realized-outcome row is captured (validation_loop_outcomes).',
    dependencies: ['progress', 'exit', 'continuous', 'longitudinalOutcomeCapture'],
    status: 'PARTIAL',
    statusNote: 'The frozen blueprint marked this MISSING everywhere. CURRENT honest state: Phase 1.3 CLOSED the close-the-loop MECHANISM via REUSE (no new engine) — captureProgressionOutcome() + getReassessmentSignal() write/derive realized outcomes into validation_loop_outcomes, gated by the longitudinalOutcomeCapture flag. GAP-J3 ENGINEERING-CLOSED: Phase 1.4 now WIRES that mechanism per-journey via REUSE (captureJourneyTailMilestone) at the journey-tail resolution points — observation resolved, mentor engagement milestone, parent support action done — so the tail is connected end-to-end (still zero new engine/table/DDL). What remains is ADOPTION (real re-administration/outcome volume, currently honest-low/0, reported SEPARATELY by composeOutcomeTailAdoption — Adoption⟂Coverage, null≠0). This phase does NOT build new outcome machinery.',
    evidence: {
      services: ['services/capadex/progression-outcome-capture.ts', 'services/validation-loop-intake.ts'],
      routes: ['routes/capadex.ts', 'routes/capadex-enterprise.ts'],
      tables: ['validation_loop_outcomes', 'wc3_longitudinal_snapshots'],
      frontend: [],
    },
  },
];

/** The eight platform axes every journey must map to (acceptance criteria). */
export const JOURNEY_AXES = [
  'persona', 'lifecycle', 'assessment', 'ai', 'reports', 'dashboards', 'outcomes', 'kpis',
] as const;
export type JourneyAxis = typeof JOURNEY_AXES[number];

/**
 * DUPLICATE ENTRANCES (resolved — DECISIONS, not bugs to silently remove).
 * Career-Builder entry is reachable from multiple surfaces. These are multiple entrances to ONE
 * flow, NOT duplicate flows — KEEP ALL entrances (removing them would break byte-identical behaviour).
 */
export const DUPLICATE_ENTRANCES: { flow: string; entrances: string[]; decision: 'KEEP_ALL'; rationale: string }[] = [
  {
    flow: 'Career Builder (one canonical flow)',
    entrances: ['Student exposure CTA (studentCareerBuilder)', 'Career Launchpad', 'Career Discovery (careerDiscovery)'],
    decision: 'KEEP_ALL',
    rationale: 'Multiple entrances to ONE flow — the pre-existing CTAs are current behaviour; removing entrances would break byte-identical-OFF. Not duplicate journeys.',
  },
  {
    flow: 'Assessment entry (one canonical flow)',
    entrances: ['FreeAssessmentModal (flagship)', 'AdaptiveAssessmentRuntime (flag-gated standalone)'],
    decision: 'KEEP_ALL',
    rationale: 'Different entry points to assessment; flagship consumer flow vs flag-gated adaptive runtime. Keep separate, keep both.',
  },
];
