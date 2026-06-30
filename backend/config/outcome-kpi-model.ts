/**
 * CAPADEX 3.0 — Program 1 · Phase 1.6 Outcome Framework / KPI Engine
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE ONE canonical Outcome & KPI Model (single source of truth).
 *
 * This module is PURE DATA. It introduces NO new outcome engine, NO new KPI engine, NO V2, NO
 * duplicate measurement logic and NO schema. It promotes the Program-0 FROZEN blueprint
 * (`backend/audit/capadex-3.0-product-blueprint-final/13_OUTCOME_*`, `14_KPI_*`) to a
 * runtime-readable registry that describes EXACTLY how a customer journey turns into a
 * MEASURABLE OUTCOME and a KPI — and REFERENCES the EXISTING implementations by file/table only
 * (reuse-before-build).
 *
 * The outcome spine, the 11 outcome-tracking types, the 10 KPI families, the per-lifecycle-stage
 * outcomes and the per-persona success metrics are FROZEN — this phase does NOT invent new
 * measurement machinery. The runtime already exists by REUSE: realized outcomes are captured into
 * `validation_loop_outcomes` (MX-102X outcome-intelligence-engine + Phase 1.3
 * progression-outcome-capture); KPIs are computed by the existing enterprise-analytics + benchmark
 * + mei/employability scoring engines. This registry COMPOSES those into ONE explainable model.
 *
 * Honesty contract: `status` is a Coverage axis (does an implementation exist?), kept SEPARATE
 * from any Confidence/Outcome/Adoption axis. Evidence paths are CLAIMS verified independently by
 * `scripts/capadex-1.6-outcome-kpi-scan.ts` against the live filesystem + DB — the scan, not this
 * file, is the SSoT for "present/absent" numbers. null ≠ 0; never fabricate. Calibrated
 * effectiveness/accuracy is deliberately ABSTAINED until real non-demo volume + a decision-time
 * prediction substrate exist (Confidence axis) — it is never fabricated.
 */

/** Outcome/KPI coverage status (mirrors the FROZEN blueprint register vocabulary). */
export type OutcomeKpiStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';

/** Canonical lifecycle stage codes (lib/lifecycle.ts). */
export type LifecycleStageCode = 'CAP_CUR' | 'CAP_INS' | 'CAP_GRW' | 'CAP_MAS';

/** Canonical outcome spine step keys (FROZEN 12-step assessment→outcome→KPI loop). */
export type SpineStepKey =
  | 'assessment'
  | 'evidence_collection'
  | 'ai_interpretation'
  | 'recommendation'
  | 'intervention'
  | 'learning'
  | 'practice'
  | 'reassessment'
  | 'improvement'
  | 'measured_outcome'
  | 'kpi_update'
  | 'continuous_optimization';

/** The eight outcome/KPI axes (used by the per-persona matrices in the deliverables). */
export const OUTCOME_KPI_AXES = [
  'persona',
  'lifecycle',
  'assessment',
  'ai',
  'recommendation',
  'intervention',
  'outcome',
  'kpi',
] as const;
export type OutcomeKpiAxis = typeof OUTCOME_KPI_AXES[number];

/** Repo evidence — existing implementations REUSED by each model entry (no rebuild). */
export interface OutcomeEvidence {
  /** backend/services/*.ts engines that drive this entry (reused). */
  services: string[];
  /** backend/routes/*.ts (or routes.ts surfaces) that expose it. */
  routes: string[];
  /** database tables/objects that persist it. */
  tables: string[];
  /** frontend/src surfaces that render it. */
  frontend: string[];
}

/**
 * THE CANONICAL OUTCOME SPINE (FROZEN — 12 steps).
 * The ONE assessment → MEASURABLE OUTCOME → KPI loop every persona instantiates. It runs
 * Assessment → Evidence → AI interpretation → Recommendation → Intervention → Learning →
 * Practice → Reassessment → Improvement → Measured Outcome → KPI Update → Continuous
 * Optimization (re-entry). Source: blueprint 13/14. This is the MEASURED canonical loop — it is
 * NOT padded to a round number.
 */
export interface CanonicalSpineStep {
  key: SpineStepKey;
  order: number;
  label: string;
  definition: string;
  /** The EXISTING implementation this step REUSES (verified by the scan). */
  reuses: string;
}

export const OUTCOME_SPINE: CanonicalSpineStep[] = [
  { key: 'assessment', order: 1, label: 'Assessment', definition: 'A scored behavioural / competency assessment establishes the working signal.', reuses: 'capadex_sessions + scoring (routes/capadex.ts)' },
  { key: 'evidence_collection', order: 2, label: 'Evidence Collection', definition: 'Evidence accrues into the longitudinal record (one datapoint per cycle).', reuses: 'services/wc3/longitudinal-foundation.ts → wc3_longitudinal_snapshots' },
  { key: 'ai_interpretation', order: 3, label: 'AI Interpretation', definition: 'AI interprets signals/competencies into an explainable diagnosis.', reuses: 'services/pil/runtime-guidance-engine.ts + behavioural-signal' },
  { key: 'recommendation', order: 4, label: 'Recommendation', definition: 'Next-best-action / growth recommendations are generated.', reuses: 'services/recommendation-intelligence-engine.ts + development_recommendations' },
  { key: 'intervention', order: 5, label: 'Intervention', definition: 'A targeted intervention is delivered for the diagnosed gap.', reuses: 'services/intervention-intelligence.ts → capadex_interventions' },
  { key: 'learning', order: 6, label: 'Learning', definition: 'A personalised learning / development plan is composed and surfaced.', reuses: 'services/learning-path-engine.ts' },
  { key: 'practice', order: 7, label: 'Practice', definition: 'Practice / activities are surfaced for the learner to act on.', reuses: 'recommendation + intervention catalogs (services/pil/recommendation-catalog.ts)' },
  { key: 'reassessment', order: 8, label: 'Reassessment', definition: 'Interval / exit re-administration of the existing assessment (close-the-loop).', reuses: 'services/capadex/progression-outcome-capture.ts (getReassessmentSignal)' },
  { key: 'improvement', order: 9, label: 'Improvement', definition: 'Improvement is validated against the prior datapoint(s) as a longitudinal trend.', reuses: 'services/longitudinal-memory.ts + career_readiness_history' },
  { key: 'measured_outcome', order: 10, label: 'Measured Outcome', definition: 'A realized, MEASURABLE outcome is captured into the canonical outcome ledger.', reuses: 'services/outcome-intelligence-engine.ts → validation_loop_outcomes' },
  { key: 'kpi_update', order: 11, label: 'KPI Update', definition: 'The measured outcome rolls up into the individual / persona / lifecycle / business KPIs.', reuses: 'services/enterprise-analytics-schema.ts (anl_kpi_daily/anl_cohort_analysis) + services/benchmark-engine.ts' },
  { key: 'continuous_optimization', order: 12, label: 'Continuous Optimization', definition: 'The loop re-enters: KPIs inform the next cycle from the new baseline.', reuses: 'services/wc7b/longitudinal-automation.ts (reassessment cadence) — adoption-gated' },
];

/**
 * THE 11 OUTCOME-TRACKING TYPES (FROZEN).
 * What the platform can MEASURE as an outcome, from first engagement through realized mastery.
 * Each is a Coverage statement (does the substrate exist) — its ADOPTION (real non-demo volume)
 * is reported SEPARATELY by the composer and NEVER composited here. Each REFERENCES an EXISTING
 * table (reuse-before-build).
 */
export type OutcomeCategory = 'engagement' | 'progress' | 'improvement' | 'continuity' | 'lifecycle' | 'realized';

export interface OutcomeType {
  id: string;
  label: string;
  category: OutcomeCategory;
  definition: string;
  status: OutcomeKpiStatus;
  statusNote?: string;
  evidence: { services: string[]; tables: string[] };
}

export const OUTCOME_TYPES: OutcomeType[] = [
  { id: 'assessment_completion', label: 'Assessment Completion', category: 'engagement', definition: 'A subject completes a scored assessment (the entry datapoint of every outcome chain).', status: 'SUPPORTED', evidence: { services: ['routes/capadex.ts'], tables: ['capadex_sessions'] } },
  { id: 'diagnosis_delivered', label: 'Diagnosis Delivered', category: 'engagement', definition: 'An explainable AI diagnosis is surfaced from the scored signal/competency profile.', status: 'SUPPORTED', evidence: { services: ['services/pil/runtime-guidance-engine.ts'], tables: ['capadex_user_profiles'] } },
  { id: 'recommendation_engagement', label: 'Recommendation Engagement', category: 'engagement', definition: 'A growth recommendation is generated and surfaced for the diagnosed gap.', status: 'SUPPORTED', evidence: { services: ['services/recommendation-intelligence-engine.ts'], tables: ['development_recommendations'] } },
  { id: 'intervention_uptake', label: 'Intervention Uptake', category: 'engagement', definition: 'A targeted intervention is delivered (uptake inferred from intervention substrate).', status: 'PARTIAL', statusNote: 'Intervention delivery substrate exists; explicit per-subject uptake telemetry is recommendation/intervention-inferred (no separate completion log) — Coverage⟂Adoption.', evidence: { services: ['services/intervention-intelligence.ts'], tables: ['capadex_interventions', 'lbi_intervention_library'] } },
  { id: 'learning_progress', label: 'Learning Progress', category: 'progress', definition: 'Movement on the longitudinal record after a learning/practice cycle.', status: 'SUPPORTED', evidence: { services: ['services/wc3/longitudinal-foundation.ts'], tables: ['wc3_longitudinal_snapshots'] } },
  { id: 'competency_improvement', label: 'Competency / EI Improvement', category: 'improvement', definition: 'A measured uplift in a competency / EI dimension vs the baseline.', status: 'SUPPORTED', evidence: { services: ['services/mei-scoring-engine.ts'], tables: ['ei_profile_snapshots', 'scoring_runs'] } },
  { id: 'readiness_uplift', label: 'Readiness Uplift', category: 'improvement', definition: 'A measured rise in the readiness band over the readiness history.', status: 'SUPPORTED', evidence: { services: ['services/employability-scoring-engine.ts'], tables: ['career_readiness_history'] } },
  { id: 'reassessment_completed', label: 'Reassessment Completed', category: 'continuity', definition: 'A subject re-administers the assessment (>1 longitudinal datapoint — close-the-loop).', status: 'PARTIAL', statusNote: 'Reassessment signal MECHANISM present (getReassessmentSignal); real re-administration volume is ADOPTION-pending (Coverage⟂Adoption, null≠0).', evidence: { services: ['services/capadex/progression-outcome-capture.ts'], tables: ['wc3_longitudinal_snapshots'] } },
  { id: 'stage_promotion', label: 'Stage Promotion', category: 'lifecycle', definition: 'The subject advances a lifecycle stage (Curiosity→Insight→Growth→Mastery).', status: 'PARTIAL', statusNote: 'Promotion is readiness-DERIVED (evidence-gate band) recorded in wc3_stage_progression, not a uniformly enforced gate — Coverage present, ADOPTION usage-driven.', evidence: { services: ['services/capadex/evidence-gate.ts'], tables: ['wc3_stage_progression', 'wc3_stage_state'] } },
  { id: 'realized_outcome', label: 'Realized Outcome', category: 'realized', definition: 'A realized career/hiring/development outcome (placement, role progression, hire, direction chosen).', status: 'SUPPORTED', statusNote: 'Canonical ledger present (validation_loop_outcomes via MX-102X + Phase 1.3 capture); realized-outcome volume is the universal adoption-gated tail.', evidence: { services: ['services/outcome-intelligence-engine.ts', 'services/capadex/progression-outcome-capture.ts'], tables: ['validation_loop_outcomes'] } },
  { id: 'mastery_achievement', label: 'Mastery Achievement', category: 'realized', definition: 'A reached-mastery milestone is captured (terminal coded-ladder outcome + loop re-entry).', status: 'PARTIAL', statusNote: 'reached_mastery capture MECHANISM present (progression-outcome-capture); realized mastery volume is honest-low/0 (Adoption⟂Coverage, null≠0).', evidence: { services: ['services/capadex/progression-outcome-capture.ts'], tables: ['validation_loop_outcomes'] } },
];

/**
 * THE 10 KPI FAMILIES (FROZEN).
 * Every measured outcome rolls up into one or more KPI families. KPIs are COMPUTED by the
 * EXISTING enterprise-analytics + benchmark + mei/employability engines — this phase builds NO
 * new KPI engine. `status` is Coverage (does the KPI substrate + a computing engine exist).
 * Some families (business revenue, AI acceptance) are honest-NULL where no single KPI ledger
 * wires them yet — never fabricated.
 */
export interface KpiFamily {
  key: string;
  label: string;
  definition: string;
  /** Representative KPIs in this family (illustrative, not exhaustive). */
  exampleKpis: string[];
  status: OutcomeKpiStatus;
  statusNote?: string;
  evidence: { services: string[]; tables: string[] };
}

export const KPI_FAMILIES: KpiFamily[] = [
  { key: 'individual', label: 'Individual KPIs', definition: 'Per-subject growth measures (readiness score, improvement delta, completion).', exampleKpis: ['Assessment completion', 'Readiness band', 'Improvement delta vs baseline'], status: 'SUPPORTED', evidence: { services: ['services/employability-scoring-engine.ts', 'services/longitudinal-memory.ts'], tables: ['career_readiness_history', 'scoring_runs'] } },
  { key: 'persona', label: 'Persona KPIs', definition: 'Per-persona success metrics rolled up across subjects of a persona.', exampleKpis: ['Per-persona completion rate', 'Per-persona realized-outcome rate'], status: 'PARTIAL', statusNote: 'Persona roll-up via READ-TIME join (capadex_user_profiles.persona ⟂ validation_loop_outcomes); k-anon suppressed; no persona dimension added to the ledger — Coverage present, volume adoption-gated.', evidence: { services: ['services/outcome-intelligence-engine.ts'], tables: ['capadex_user_profiles', 'validation_loop_outcomes'] } },
  { key: 'lifecycle', label: 'Lifecycle KPIs', definition: 'Stage distribution + promotion / progression rates across the coded ladder.', exampleKpis: ['Stage distribution', 'Promotion rate', 'Time-in-stage'], status: 'SUPPORTED', evidence: { services: ['services/capadex/evidence-gate.ts'], tables: ['wc3_stage_state', 'wc3_stage_progression'] } },
  { key: 'assessment', label: 'Assessment KPIs', definition: 'Assessment throughput, coverage and reassessment rate.', exampleKpis: ['Completion rate', 'Assessment coverage', 'Reassessment rate'], status: 'SUPPORTED', evidence: { services: ['routes/capadex.ts'], tables: ['capadex_sessions'] } },
  { key: 'journey', label: 'Journey KPIs', definition: 'Funnel conversion / drop-off / outcome-tail completion across the journey.', exampleKpis: ['Funnel conversion', 'Journey drop-off', 'Outcome-tail completion'], status: 'PARTIAL', statusNote: 'Journey substrate present (validation_loop_outcomes + journey-tail); conversion KPIs are adoption-gated (real volume) — Coverage⟂Adoption.', evidence: { services: ['services/outcome-intelligence-engine.ts'], tables: ['validation_loop_outcomes'] } },
  { key: 'ai', label: 'AI KPIs', definition: 'Diagnosis coverage + recommendation acceptance / effectiveness.', exampleKpis: ['Diagnosis coverage', 'Recommendation acceptance (honest-null)', 'AI effectiveness (abstained)'], status: 'PARTIAL', statusNote: 'Diagnosis/recommendation substrate present; acceptance/effectiveness is ABSTAINED — no decision-time prediction recorded (Confidence axis, honest-null), never fabricated.', evidence: { services: ['services/recommendation-intelligence-engine.ts'], tables: ['development_recommendations'] } },
  { key: 'learning', label: 'Learning KPIs', definition: 'Learning progress + intervention uptake measures.', exampleKpis: ['Learning progress', 'Intervention uptake', 'Practice engagement'], status: 'SUPPORTED', evidence: { services: ['services/learning-path-engine.ts', 'services/intervention-intelligence.ts'], tables: ['wc3_longitudinal_snapshots', 'capadex_interventions'] } },
  { key: 'business', label: 'Business KPIs', definition: 'Placement / hiring conversion + commercial outcomes (revenue reported separately).', exampleKpis: ['Placement rate', 'Hiring conversion', 'Revenue (separate ledger, honest-null here)'], status: 'PARTIAL', statusNote: 'Placement/hiring realized via validation_loop_outcomes; revenue lives in the SEPARATE commerce ledger (capadex_payments) and is NOT composited into outcome KPIs — Coverage present, accuracy/volume adoption-gated.', evidence: { services: ['services/outcome-intelligence-engine.ts'], tables: ['validation_loop_outcomes', 'capadex_payments'] } },
  { key: 'organizational', label: 'Organizational KPIs', definition: 'Cohort movement + institute / batch coverage (k-anon aggregate).', exampleKpis: ['Cohort movement', 'Institute coverage', 'Batch progression (aggregate)'], status: 'SUPPORTED', statusNote: 'Real k-anon aggregation (MX-302H); scores masked below k_min, roster always shown.', evidence: { services: ['services/longitudinal-memory.ts', 'services/benchmark-engine.ts'], tables: ['longitudinal_patterns', 'wc3_longitudinal_snapshots'] } },
  { key: 'platform', label: 'Platform KPIs', definition: 'Active users / retention / engagement rolled up by the analytics engine.', exampleKpis: ['Active users', 'Retention', 'Engagement (daily KPI roll-up)'], status: 'PARTIAL', statusNote: 'Analytics KPI substrate present (anl_kpi_daily/anl_cohort_analysis); population is adoption-driven (real volume) — Coverage⟂Adoption, null≠0.', evidence: { services: ['services/enterprise-analytics-schema.ts', 'services/report-factory/benchmark-engine.ts'], tables: ['anl_kpi_daily', 'anl_cohort_analysis', 'anl_benchmark_snapshot'] } },
];

/**
 * PER-LIFECYCLE-STAGE OUTCOMES (FROZEN — the four coded stages, in order).
 * For each stage: the outcome types that realize there + the KPI families they update + the
 * measurable outcome definition. REFERENCES the EXISTING readiness + outcome machinery — no new
 * gate, no new KPI engine.
 */
export interface LifecycleOutcomeRule {
  code: LifecycleStageCode;
  label: string;
  order: number;
  /** Outcome-type ids that realize at this stage. */
  outcomesAtStage: string[];
  /** KPI-family keys that update from this stage's outcomes. */
  kpisUpdated: string[];
  measurableOutcome: string;
  status: OutcomeKpiStatus;
  statusNote?: string;
  evidence: OutcomeEvidence;
}

export const LIFECYCLE_OUTCOME_RULES: LifecycleOutcomeRule[] = [
  {
    code: 'CAP_CUR', label: 'Curiosity', order: 0,
    outcomesAtStage: ['assessment_completion', 'diagnosis_delivered'],
    kpisUpdated: ['individual', 'assessment', 'ai'],
    measurableOutcome: 'A scored baseline + first AI diagnosis exist (the entry outcome of every chain).',
    status: 'SUPPORTED',
    statusNote: 'Entry → baseline → diagnosis is the most mature outcome segment.',
    evidence: {
      services: ['services/pil/runtime-guidance-engine.ts', 'services/wc3/longitudinal-foundation.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['capadex_sessions', 'capadex_user_profiles', 'wc3_longitudinal_snapshots'],
      frontend: ['components/FreeAssessmentModal.tsx'],
    },
  },
  {
    code: 'CAP_INS', label: 'Insight', order: 1,
    outcomesAtStage: ['recommendation_engagement', 'intervention_uptake', 'learning_progress'],
    kpisUpdated: ['individual', 'learning', 'ai', 'journey'],
    measurableOutcome: 'A recommendation + learning/intervention plan is generated and acted on.',
    status: 'SUPPORTED',
    statusNote: 'Recommendation + learning + intervention generation is well-supported (reused engines).',
    evidence: {
      services: ['services/recommendation-intelligence-engine.ts', 'services/learning-path-engine.ts', 'services/intervention-intelligence.ts'],
      routes: ['routes/capadex.ts', 'routes/career-readiness.ts'],
      tables: ['development_recommendations', 'capadex_interventions', 'wc3_longitudinal_snapshots'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    code: 'CAP_GRW', label: 'Growth', order: 2,
    outcomesAtStage: ['reassessment_completed', 'competency_improvement', 'readiness_uplift', 'realized_outcome'],
    kpisUpdated: ['individual', 'lifecycle', 'business', 'organizational'],
    measurableOutcome: 'A reassessment validates improvement vs the baseline; a realized outcome is captured.',
    status: 'PARTIAL',
    statusNote: 'Reassessment + improvement MECHANISM present (Phase 1.3 reuse + longitudinal trend); validation is ADOPTION-pending (>1 non-demo datapoint). Coverage⟂Adoption⟂Confidence never composited.',
    evidence: {
      services: ['services/capadex/progression-outcome-capture.ts', 'services/longitudinal-memory.ts', 'services/outcome-intelligence-engine.ts'],
      routes: ['routes/career-progression.ts', 'routes/career-readiness.ts'],
      tables: ['wc3_longitudinal_snapshots', 'career_readiness_history', 'validation_loop_outcomes'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    code: 'CAP_MAS', label: 'Mastery', order: 3,
    outcomesAtStage: ['stage_promotion', 'mastery_achievement', 'realized_outcome'],
    kpisUpdated: ['lifecycle', 'business', 'platform'],
    measurableOutcome: 'A reached-mastery + realized outcome is captured; the optimization loop re-enters.',
    status: 'PARTIAL',
    statusNote: 'reached_mastery + exit-eligibility MECHANISM present (progression-outcome-capture + getReassessmentSignal). Continuous re-entry cadence is adoption-gated; realized mastery volume honest-low/0 (Adoption⟂Coverage, null≠0).',
    evidence: {
      services: ['services/capadex/progression-outcome-capture.ts', 'services/outcome-intelligence-engine.ts', 'services/wc7b/longitudinal-automation.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['validation_loop_outcomes', 'wc3_stage_progression'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
];

/**
 * THE CANONICAL OUTCOME MODEL (per persona).
 * Each persona instantiates the ONE outcome spine and differs only by which steps are reachable,
 * which outcome types it realizes, which KPI families it updates, and its success metrics. Every
 * field REFERENCES an EXISTING implementation (reuse-before-build). Statuses are a Coverage axis.
 */
export interface OutcomePath {
  key: string;
  label: string;
  /** Human persona label. */
  persona: string;
  /** Persona codes P1–P9. 'aggregate' = institute roll-up; 'all' = cross-cutting. */
  personas: string[];
  /** Which canonical spine steps this persona's outcome loop actually reaches today. */
  spineReached: SpineStepKey[];
  /** Lifecycle stages the path traverses (CAP_*). [lifecycle axis] */
  lifecycleStages: LifecycleStageCode[];
  /** Canonical assessment-framework keys (Phase 1.3) this path consumes. [assessment axis] */
  assessments: string[];
  /** How AI interprets this path's signals. [ai axis] */
  aiInterpretation: string;
  /** How recommendation effectiveness is (or would be) measured for this path. [recommendation axis] */
  recommendationEffectiveness: string;
  /** How intervention effectiveness is (or would be) measured for this path. [intervention axis] */
  interventionEffectiveness: string;
  /** Outcome-type ids this path realizes. [outcome axis] */
  outcomeTypes: string[];
  /** KPI-family keys this path updates. [kpi axis] */
  kpiFamilies: string[];
  /** Realized-outcome definition for this path. */
  realizedOutcome: string;
  /** Measurable success metrics (the KPIs of success for this persona). */
  successMetrics: string;
  status: OutcomeKpiStatus;
  /** Honest note on WHY a status is PARTIAL/DEAD_END (Coverage⟂Confidence⟂Outcome⟂Adoption). */
  statusNote?: string;
  evidence: OutcomeEvidence;
}

export const OUTCOME_MODEL: OutcomePath[] = [
  {
    key: 'student_growth',
    label: 'Student → Career Growth',
    persona: 'Student (school/college)',
    personas: ['P1', 'P2', 'P3'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'intervention', 'learning', 'practice'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'behaviour', 'competency'],
    aiInterpretation: 'Behavioural signal → concern routing + competency diagnosis (PIL runtime guidance).',
    recommendationEffectiveness: 'Recommendation substrate present (development_recommendations); calibrated effectiveness abstained until volume (Confidence axis, honest-null).',
    interventionEffectiveness: 'Concern-targeted interventions (capadex_interventions); uptake inferred, effectiveness abstained.',
    outcomeTypes: ['assessment_completion', 'diagnosis_delivered', 'recommendation_engagement', 'intervention_uptake', 'learning_progress'],
    kpiFamilies: ['individual', 'assessment', 'learning', 'ai', 'persona'],
    realizedOutcome: 'Career direction chosen / measurable growth progressed; realized-outcome tail adoption-gated.',
    successMetrics: 'Assessment completion; recommendation engagement; positive re-measure movement.',
    status: 'PARTIAL',
    statusNote: 'Strong front-half (assessment→diagnose→recommend→learn→intervene). Measured-outcome + KPI roll-up MECHANISM present; per-journey realized-outcome volume is ADOPTION-pending (Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/pil/runtime-guidance-engine.ts', 'services/recommendation-intelligence-engine.ts', 'services/learning-path-engine.ts', 'services/intervention-intelligence.ts'],
      routes: ['routes/capadex.ts', 'routes/student-career-builder.ts'],
      tables: ['capadex_user_profiles', 'development_recommendations', 'capadex_interventions', 'wc3_longitudinal_snapshots'],
      frontend: ['components/FreeAssessmentModal.tsx', 'components/StudentDashboard.tsx', 'pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'fresher_readiness',
    label: 'Fresher → Placement Readiness',
    persona: 'Fresher / final-year (job-seeker)',
    personas: ['P4', 'P3'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'intervention', 'learning', 'improvement', 'measured_outcome', 'kpi_update'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'performance'],
    aiInterpretation: 'Competency + readiness diagnosis; role-DNA crosswalk for fit.',
    recommendationEffectiveness: 'Launchpad next-steps + placement matching; effectiveness measured as readiness uplift + application rate (volume-gated).',
    interventionEffectiveness: 'Readiness-gap interventions + curated practice; effectiveness via readiness-band movement.',
    outcomeTypes: ['assessment_completion', 'recommendation_engagement', 'readiness_uplift', 'realized_outcome'],
    kpiFamilies: ['individual', 'assessment', 'business', 'journey', 'persona'],
    realizedOutcome: 'Application submitted / placed (placement outcome → validation_loop_outcomes).',
    successMetrics: 'Launchpad completion; readiness uplift; application + placement rate.',
    status: 'SUPPORTED',
    statusNote: 'Launchpad + placement readiness loop is live; realized placement-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage).',
    evidence: {
      services: ['services/career-recommendation-engine.ts', 'services/employability-scoring-engine.ts', 'services/outcome-intelligence-engine.ts'],
      routes: ['routes/career-launchpad.ts', 'routes/career-readiness.ts', 'routes/talent-matching-engine.ts'],
      tables: ['career_seeker_profiles', 'career_readiness_history', 'validation_loop_outcomes'],
      frontend: ['pages/career/CareerLaunchpadDashboard.tsx', 'pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'professional_progression',
    label: 'Professional → Role Progression',
    persona: 'Working professional',
    personas: ['P5'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'learning', 'reassessment', 'improvement', 'measured_outcome', 'kpi_update', 'continuous_optimization'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['baseline', 'competency', 'performance', 'progress'],
    aiInterpretation: 'Competency + progression diagnosis; trend intelligence.',
    recommendationEffectiveness: 'Progression-aware growth plan; effectiveness via validated improvement vs baseline (abstained calibration until volume).',
    interventionEffectiveness: 'Competency-gap interventions + reinforcement; effectiveness via competency-band movement.',
    outcomeTypes: ['competency_improvement', 'readiness_uplift', 'reassessment_completed', 'stage_promotion', 'realized_outcome'],
    kpiFamilies: ['individual', 'lifecycle', 'business', 'platform'],
    realizedOutcome: 'Role progression / promotion; adoption-gated realized-outcome tail.',
    successMetrics: 'Re-run rate; positive-movement rate; progression cadence.',
    status: 'PARTIAL',
    statusNote: 'Reaches the FULL loop incl. reassessment→improvement→measured-outcome→KPI as a MECHANISM, but promotion is DERIVED (GAP-O1 promotion not uniformly gated) and validation is ADOPTION-pending (Coverage⟂Adoption⟂Confidence).',
    evidence: {
      services: ['services/recommendation-intelligence-engine.ts', 'services/longitudinal-memory.ts', 'services/outcome-intelligence-engine.ts', 'services/wc7b/longitudinal-automation.ts'],
      routes: ['routes/capadex.ts', 'routes/career-progression.ts', 'routes/career-readiness.ts'],
      tables: ['wc3_stage_progression', 'wc3_longitudinal_snapshots', 'career_readiness_history', 'validation_loop_outcomes'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'employee_competency',
    label: 'Employee → Competency / EI Development',
    persona: 'Enterprise employee',
    personas: ['P5', 'P6'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'intervention', 'learning', 'improvement'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'behaviour'],
    aiInterpretation: 'Competency genome + EI dimension diagnosis (mei-scoring-engine).',
    recommendationEffectiveness: 'Competency-gap → development recommendation; effectiveness via EI/competency delta (abstained calibration).',
    interventionEffectiveness: 'EI / competency interventions; effectiveness via ei_profile_snapshots delta.',
    outcomeTypes: ['assessment_completion', 'diagnosis_delivered', 'recommendation_engagement', 'competency_improvement', 'learning_progress'],
    kpiFamilies: ['individual', 'learning', 'ai', 'organizational'],
    realizedOutcome: 'Competency uplift; EI development; adoption-gated outcome tail.',
    successMetrics: 'Baseline coverage; competency movement; EI delta.',
    status: 'SUPPORTED',
    statusNote: 'Competency + EI development diagnosis is well-supported (mei + intervention engines); realized development-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage).',
    evidence: {
      services: ['services/mei-scoring-engine.ts', 'services/mei-recommendation-engine.ts', 'services/intervention-intelligence.ts'],
      routes: ['routes/capadex.ts', 'routes/career-competency-activation.ts'],
      tables: ['ei_profile_snapshots', 'development_recommendations', 'wc3_longitudinal_snapshots'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'recruiter_pipeline',
    label: 'HR / Recruiter → Hiring Outcome',
    persona: 'HR / recruiter',
    personas: ['P7'],
    spineReached: ['assessment', 'ai_interpretation', 'recommendation', 'measured_outcome', 'kpi_update'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'performance', 'behaviour'],
    aiInterpretation: 'Candidate-match + interview intelligence (calibration k-gated).',
    recommendationEffectiveness: 'Talent-match ranking → interview → hire decision support; calibration accrues at k_min=30 (Brier/ECE abstain below).',
    interventionEffectiveness: 'Funnel-stage prompts (recruiter-facing); effectiveness via funnel conversion + time-to-decision.',
    outcomeTypes: ['assessment_completion', 'recommendation_engagement', 'realized_outcome'],
    kpiFamilies: ['business', 'journey', 'ai', 'platform'],
    realizedOutcome: 'Hire decision / hired (hiring outcome → validation_loop_outcomes).',
    successMetrics: 'Funnel conversion; time-to-decision; match quality; calibration (k≥30).',
    status: 'SUPPORTED',
    statusNote: 'The 9-stage hiring funnel is the most complete realized-outcome family. Realized hiring-outcome capture exists; adoption + calibration reported separately (Adoption⟂Coverage; Brier/ECE abstain <k_min=30).',
    evidence: {
      services: ['services/wc7b/decision-orchestrator.ts', 'services/validation-loop-intake.ts', 'services/outcome-intelligence-engine.ts'],
      routes: ['routes/employer-portal.ts', 'routes/employer-ecosystem.ts', 'routes/employer-hiring-intelligence.ts'],
      tables: ['employer_jobs', 'job_postings', 'validation_loop_outcomes'],
      frontend: ['pages/EmployerPortalPage.tsx'],
    },
  },
  {
    key: 'institute_cohort',
    label: 'Institute Admin → Cohort Outcome',
    persona: 'Institution administrator',
    personas: ['P9', 'aggregate'],
    spineReached: ['ai_interpretation', 'recommendation', 'measured_outcome', 'kpi_update'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['competency', 'behaviour', 'progress'],
    aiInterpretation: 'k-anon cohort aggregation (MX-302H institutional intelligence).',
    recommendationEffectiveness: 'Cohort-level act recommendations (k-gated); effectiveness via cohort movement.',
    interventionEffectiveness: 'Cohort-level intervention prompts (k≥k_min); effectiveness aggregate-only.',
    outcomeTypes: ['recommendation_engagement', 'realized_outcome'],
    kpiFamilies: ['organizational', 'lifecycle', 'business', 'platform'],
    realizedOutcome: 'Cohort-level intervention / placement outcome (aggregate).',
    successMetrics: 'Cohort coverage; cohort movement; placement rate.',
    status: 'SUPPORTED',
    statusNote: 'Real k-anon aggregation (MX-302H) — scores masked below k_min, roster always shown. Realized cohort-outcome tail adoption-gated.',
    evidence: {
      services: ['services/longitudinal-memory.ts', 'services/benchmark-engine.ts'],
      routes: ['routes/employer-dashboards.ts', 'routes/career-benchmark.ts'],
      tables: ['wc3_longitudinal_snapshots', 'longitudinal_patterns', 'anl_cohort_analysis'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    },
  },
  {
    key: 'parent_support',
    label: 'Parent → Support Child Outcome',
    persona: 'Parent / guardian',
    personas: ['P1', 'P2'],
    spineReached: ['intervention', 'practice', 'measured_outcome'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['behaviour', 'competency'],
    aiInterpretation: 'Child progress framing via consent-scoped view.',
    recommendationEffectiveness: 'Support-action recommendations (journey-tail engine); effectiveness via child positive movement.',
    interventionEffectiveness: 'Parent support actions reinforcing the child loop (jt_parent_support_actions); milestone fires into the outcome tail.',
    outcomeTypes: ['intervention_uptake', 'realized_outcome'],
    kpiFamilies: ['journey', 'individual'],
    realizedOutcome: 'Support actions logged → child growth-loop continuation (captureJourneyTailMilestone).',
    successMetrics: 'Consent rate; support-action adoption; child positive movement.',
    status: 'PARTIAL',
    statusNote: 'Support-action substrate EXISTS (journeyTailCompletion: jt_parent_support_actions, fail-closed on child ownership) and a completed action fires a journey-tail milestone into the universal outcome tail (longitudinalOutcomeCapture-gated). Residual is ADOPTION (real support-action volume — Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/journey-tail-engine.ts', 'services/capadex/progression-outcome-capture.ts'],
      routes: ['routes/journey-tail.ts'],
      tables: ['jt_parent_support_actions', 'validation_loop_outcomes'],
      frontend: ['components/UnifiedParentDashboard.tsx'],
    },
  },
  {
    key: 'mentor_mentee',
    label: 'Mentor / Coach → Mentee Outcome',
    persona: 'Mentor / coach',
    personas: ['P6'],
    spineReached: ['recommendation', 'intervention', 'practice', 'measured_outcome'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'progress'],
    aiInterpretation: 'Mentee progress framing; decision-mentor bridge.',
    recommendationEffectiveness: 'Engagement / guidance recommendations (journey-tail engine); effectiveness via mentee movement.',
    interventionEffectiveness: 'Mentor engagement milestones reinforcing the mentee loop (jt_mentor_engagements); milestone fires into the outcome tail.',
    outcomeTypes: ['recommendation_engagement', 'intervention_uptake', 'realized_outcome'],
    kpiFamilies: ['journey', 'individual'],
    realizedOutcome: 'Mentee engagement logged → guidance-loop continuation (captureJourneyTailMilestone).',
    successMetrics: 'Match rate; engagement cadence; mentee movement.',
    status: 'PARTIAL',
    statusNote: 'Engagement substrate EXISTS (journeyTailCompletion: jt_mentor_engagements, gated BOTH directions via mentor_bookings to avoid IDOR) and a milestone fires into the universal outcome tail (longitudinalOutcomeCapture-gated). Residual is ADOPTION (real engagement volume — Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/journey-tail-engine.ts', 'services/capadex/progression-outcome-capture.ts', 'services/wc7b/decision-orchestrator.ts'],
      routes: ['routes/journey-tail.ts'],
      tables: ['jt_mentor_engagements', 'mentor_profiles', 'validation_loop_outcomes'],
      frontend: ['pages/MentorDashboardPage.tsx'],
    },
  },
  {
    key: 'faculty_batch',
    label: 'Faculty → Batch Outcome',
    persona: 'Faculty member',
    personas: ['aggregate'],
    spineReached: ['measured_outcome', 'kpi_update'],
    lifecycleStages: ['CAP_INS'],
    assessments: ['competency', 'behaviour'],
    aiInterpretation: 'Batch-confined cohort aggregation (nested in institute).',
    recommendationEffectiveness: 'Faculty-scoped act recommendations (k-gated); effectiveness via batch movement.',
    interventionEffectiveness: 'Batch-level intervention prompts (k≥k_min, batch-confined); effectiveness aggregate-only.',
    outcomeTypes: ['realized_outcome'],
    kpiFamilies: ['organizational', 'lifecycle'],
    realizedOutcome: 'Batch-level intervention / progression outcome (aggregate).',
    successMetrics: 'Batch coverage; batch movement.',
    status: 'PARTIAL',
    statusNote: 'Faculty batch-confined outcome view EXISTS (institutional-intelligence, role-scoped batch-confined access; MX-302H). Aggregate-only — no per-individual outcome. Adoption-gated cohort volume (Coverage⟂Adoption).',
    evidence: {
      services: ['services/longitudinal-memory.ts', 'services/benchmark-engine.ts'],
      routes: ['routes/employer-dashboards.ts'],
      tables: ['wc3_longitudinal_snapshots', 'anl_cohort_analysis'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    },
  },
];

/** Cross-cutting decisions that are NOT silent merges (documented, like 1.4/1.5). */
export interface OutcomeKpiDecision {
  topic: string;
  decision: string;
  rationale: string;
}

export const OUTCOME_KPI_DECISIONS: OutcomeKpiDecision[] = [
  {
    topic: 'Single outcome + KPI engine (no V2)',
    decision: 'COMPOSE_EXISTING',
    rationale: 'Realized outcomes are captured by EXISTING engines (outcome-intelligence-engine → validation_loop_outcomes, Phase-1.3 progression-outcome-capture); KPIs are computed by the EXISTING enterprise-analytics + benchmark + mei/employability engines. This phase adds ONE read-only composer/registry, never a parallel outcome or KPI engine.',
  },
  {
    topic: 'KPI computation',
    decision: 'REUSE_ENTERPRISE_ANALYTICS',
    rationale: 'KPI families roll up over the existing anl_kpi_daily/anl_cohort_analysis/anl_benchmark_snapshot substrate + benchmark/mei/employability engines. No second KPI engine, no new KPI table. Population is adoption-driven (Coverage⟂Adoption, null≠0).',
  },
  {
    topic: 'Recommendation / intervention effectiveness',
    decision: 'ABSTAIN_UNTIL_VOLUME',
    rationale: 'No decision-time prediction is recorded (predicted_prob_at_decision is NULL by design), so calibrated effectiveness/accuracy of the recommendation→outcome and intervention→outcome links is honestly ABSTAINED (Confidence axis), distinct from Coverage. Never fabricate effectiveness before the data exists.',
  },
  {
    topic: 'Outcome capture',
    decision: 'REUSE_VALIDATION_LOOP',
    rationale: 'Realized outcomes write to the EXISTING canonical ledger (validation_loop_outcomes) via reuse of MX-102X + Phase-1.3 capture, gated by longitudinalOutcomeCapture → byte-identical OFF. No new outcome table, no new DDL.',
  },
  {
    topic: 'Revenue / commercial KPIs',
    decision: 'KEEP_SEPARATE',
    rationale: 'Revenue lives in the SEPARATE commerce ledger (capadex_payments) and is reported on its own axis — never composited into outcome/growth KPIs. Business KPIs here mean placement/hiring realized outcomes, not money.',
  },
];
