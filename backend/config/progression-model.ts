/**
 * CAPADEX 3.0 — Program 1 · Phase 1.5 Progression Engine / Continuous Growth
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE ONE canonical Progression Model (single source of truth).
 *
 * This module is PURE DATA. It introduces NO new progression engine, NO V2, NO duplicate
 * growth logic and NO schema. It promotes the Program-0 FROZEN blueprint
 * (`backend/audit/capadex-3.0-product-blueprint-final/06_CANONICAL_LIFECYCLE.md`,
 * `12_RECOMMENDATION_*`, `13_OUTCOME_*`, `14_KPI_*`) to a runtime-readable registry that
 * describes EXACTLY how a customer progresses — the continuous growth LOOP — and REFERENCES
 * the EXISTING implementations by file/table only (reuse-before-build).
 *
 * The growth spine, the four lifecycle promotion rules, the loop-closure invariants and the
 * per-persona progression paths are FROZEN — this phase does NOT invent new growth machinery.
 * The runtime loop already exists by REUSE: Phase 1.3 closed the universal close-the-loop
 * capture (`services/capadex/progression-outcome-capture.ts`) and the evidence-gated readiness
 * (`services/capadex/evidence-gate.ts`). This registry COMPOSES those + the existing
 * recommendation / learning / intervention / longitudinal engines into ONE explainable model.
 *
 * Honesty contract: `status` is a Coverage axis (does an implementation exist?), kept SEPARATE
 * from any Confidence/Outcome/Adoption axis. Evidence paths are CLAIMS verified independently by
 * `scripts/capadex-1.5-progression-scan.ts` against the live filesystem + DB — the scan, not
 * this file, is the SSoT for "present/absent" numbers. null ≠ 0; never fabricate.
 */

/** Progression coverage status (mirrors the FROZEN blueprint register vocabulary). */
export type ProgressionStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';

/** Canonical lifecycle stage codes (lib/lifecycle.ts). */
export type LifecycleStageCode = 'CAP_CUR' | 'CAP_INS' | 'CAP_GRW' | 'CAP_MAS';

/** Canonical progression spine step keys (FROZEN 15-step continuous-growth loop). */
export type SpineStepKey =
  | 'assessment'
  | 'evidence_collection'
  | 'ai_interpretation'
  | 'recommendation'
  | 'learning_plan'
  | 'practice_activity'
  | 'behaviour_reinforcement'
  | 'competency_development'
  | 'personalized_intervention'
  | 'progress_measurement'
  | 'reassessment'
  | 'improvement_validation'
  | 'outcome_achievement'
  | 'promotion'
  | 'continuous_development';

/** The eight progression axes (used by the per-persona matrices in the deliverables). */
export const PROGRESSION_AXES = [
  'persona',
  'lifecycle',
  'assessment',
  'ai',
  'recommendation',
  'intervention',
  'outcome',
  'promotion',
] as const;
export type ProgressionAxis = typeof PROGRESSION_AXES[number];

/** Repo evidence — existing implementations REUSED by each progression path (no rebuild). */
export interface ProgressionEvidence {
  /** backend/services/*.ts engines that drive this progression path (reused). */
  services: string[];
  /** backend/routes/*.ts (or routes.ts surfaces) that expose it. */
  routes: string[];
  /** database tables/objects that persist it. */
  tables: string[];
  /** frontend/src surfaces that render it. */
  frontend: string[];
}

/**
 * THE CANONICAL PROGRESSION SPINE (FROZEN — 15 steps).
 * The ONE continuous-growth loop every persona instantiates. It runs Assessment → Evidence →
 * AI interpretation → Recommendation → Learning → Practice → Reinforcement → Competency →
 * Intervention → Progress measurement → Reassessment → Improvement validation → Outcome →
 * Promotion → Continuous development (re-entry). Source: blueprint 06/12/13/14. This is the
 * MEASURED canonical loop — it is NOT padded to a round number.
 */
export interface CanonicalSpineStep {
  key: SpineStepKey;
  order: number;
  label: string;
  definition: string;
  /** The EXISTING implementation this step REUSES (verified by the scan). */
  reuses: string;
}

export const PROGRESSION_SPINE: CanonicalSpineStep[] = [
  { key: 'assessment', order: 1, label: 'Assessment', definition: 'A scored behavioural / competency assessment establishes the working signal.', reuses: 'capadex_sessions + scoring (routes/capadex.ts)' },
  { key: 'evidence_collection', order: 2, label: 'Evidence Collection', definition: 'Evidence accrues into the longitudinal record (one datapoint per progression).', reuses: 'services/wc3/longitudinal-foundation.ts → wc3_longitudinal_snapshots' },
  { key: 'ai_interpretation', order: 3, label: 'AI Interpretation', definition: 'AI interprets signals/competencies into an explainable diagnosis.', reuses: 'services/pil/runtime-guidance-engine.ts + behavioural-signal' },
  { key: 'recommendation', order: 4, label: 'Recommendation Generation', definition: 'Next-best-action / growth recommendations are generated.', reuses: 'services/recommendation-intelligence-engine.ts + career/lbi/mei recommendation engines' },
  { key: 'learning_plan', order: 5, label: 'Learning Plan', definition: 'A personalised learning / development plan is composed.', reuses: 'services/learning-path-engine.ts' },
  { key: 'practice_activity', order: 6, label: 'Practice Activity', definition: 'Practice / activities are surfaced for the learner to act on.', reuses: 'recommendation + intervention catalogs (services/pil/recommendation-catalog.ts)' },
  { key: 'behaviour_reinforcement', order: 7, label: 'Behaviour Reinforcement', definition: 'Behavioural reinforcement nudges the learner toward the target pattern.', reuses: 'services/intervention-intelligence.ts (reinforcement-class interventions)' },
  { key: 'competency_development', order: 8, label: 'Competency Development', definition: 'Competency / EI development is tracked against the genome.', reuses: 'services/mei-scoring-engine.ts + development_recommendations' },
  { key: 'personalized_intervention', order: 9, label: 'Personalized Intervention', definition: 'A targeted intervention is delivered for the diagnosed gap.', reuses: 'services/intervention-intelligence.ts → capadex_interventions / lbi_intervention_library' },
  { key: 'progress_measurement', order: 10, label: 'Progress Measurement', definition: 'Progress is measured as a longitudinal trend vs the baseline.', reuses: 'services/longitudinal-memory.ts + longitudinal_patterns' },
  { key: 'reassessment', order: 11, label: 'Reassessment', definition: 'Interval / exit re-administration of the existing assessment (close-the-loop).', reuses: 'services/capadex/progression-outcome-capture.ts (getReassessmentSignal) + wc7b/longitudinal-automation.ts' },
  { key: 'improvement_validation', order: 12, label: 'Improvement Validation', definition: 'Improvement is validated against the prior datapoint(s).', reuses: 'services/longitudinal-memory.ts (trend) + career_readiness_history' },
  { key: 'outcome_achievement', order: 13, label: 'Outcome Achievement', definition: 'A realized outcome is captured into the canonical ledger.', reuses: 'services/outcome-intelligence-engine.ts → validation_loop_outcomes' },
  { key: 'promotion', order: 14, label: 'Promotion', definition: 'The subject is promoted along the lifecycle (Curiosity→Insight→Growth→Mastery).', reuses: 'lib/lifecycle.ts + services/capadex/evidence-gate.ts → wc3_stage_progression' },
  { key: 'continuous_development', order: 15, label: 'Continuous Development', definition: 'The loop re-enters: the next growth cycle begins from the new baseline.', reuses: 'services/wc7b/longitudinal-automation.ts (reassessment cadence) — adoption-gated' },
];

/**
 * THE FOUR LOOP-CLOSURE INVARIANTS (FROZEN).
 * "Continuous growth" is real only if the loop CLOSES. Each invariant is a measurable link
 * between two spine steps, each backed by an EXISTING engine + table (reused, never rebuilt).
 * `mechanism` is a Coverage statement (the link exists in code); ADOPTION (is it exercised by
 * real non-demo volume) is reported SEPARATELY by the composer and NEVER composited here.
 */
export interface LoopClosureInvariant {
  id: string;
  title: string;
  from: SpineStepKey;
  to: SpineStepKey;
  /** Coverage: the existing mechanism that links the two steps. */
  mechanism: string;
  /** The EXISTING service(s) that realise the link. */
  services: string[];
  /** The table(s) that persist evidence of the link. */
  tables: string[];
  /** Honest residual after the mechanism is in place — usually ADOPTION (usage-driven). */
  residual: string;
}

export const LOOP_CLOSURE_INVARIANTS: LoopClosureInvariant[] = [
  {
    id: 'INV1-RECOMMEND-TO-ACTION',
    title: 'Recommendation → Learning / Practice / Intervention (the growth action is generated)',
    from: 'recommendation',
    to: 'personalized_intervention',
    mechanism: 'Recommendation engines feed the learning-path + intervention catalogs, so every diagnosis yields a concrete next action. COMPOSED by reference, never invoked.',
    services: ['services/recommendation-intelligence-engine.ts', 'services/learning-path-engine.ts', 'services/intervention-intelligence.ts'],
    tables: ['development_recommendations', 'capadex_interventions', 'lbi_intervention_library'],
    residual: 'ADOPTION: real recommendation→action engagement volume is usage-driven (Coverage⟂Adoption, null≠0).',
  },
  {
    id: 'INV2-INTERVENTION-TO-REASSESS',
    title: 'Intervention → Reassessment (the action is followed by a re-measurement)',
    from: 'personalized_intervention',
    to: 'reassessment',
    mechanism: 'After an intervention, the reassessment signal (getReassessmentSignal) surfaces interval/exit re-administration eligibility from the accrued longitudinal record. MECHANISM present (Phase 1.3 reuse); gated by longitudinalOutcomeCapture.',
    services: ['services/capadex/progression-outcome-capture.ts', 'services/wc7b/longitudinal-automation.ts'],
    tables: ['wc3_longitudinal_snapshots', 'validation_loop_outcomes'],
    residual: 'ADOPTION: real re-administration volume is usage-driven (honest-low/0; reported separately — Adoption⟂Coverage, null≠0).',
  },
  {
    id: 'INV3-REASSESS-TO-IMPROVEMENT',
    title: 'Reassessment → Improvement validation (the re-measurement is compared to the baseline)',
    from: 'reassessment',
    to: 'improvement_validation',
    mechanism: 'A second datapoint lets the longitudinal trend validate improvement vs the prior baseline. MECHANISM present; effectiveness/accuracy stays abstained (no decision-time prediction recorded) until real volume accrues — honest-null, never fabricated.',
    services: ['services/longitudinal-memory.ts', 'services/wc3/longitudinal-foundation.ts'],
    tables: ['longitudinal_patterns', 'career_readiness_history'],
    residual: 'ADOPTION + CONFIDENCE: improvement is measurable once >1 non-demo datapoint exists; calibrated accuracy is abstained by design (Coverage⟂Confidence⟂Adoption, null≠0).',
  },
  {
    id: 'INV4-IMPROVEMENT-TO-PROMOTION',
    title: 'Improvement → Promotion / Outcome (validated growth advances the lifecycle stage)',
    from: 'improvement_validation',
    to: 'promotion',
    mechanism: 'Validated readiness drives stage promotion (evidence-gate readiness band) and a realized-outcome capture into the canonical ledger. MECHANISM present (evidence-gate + progression-outcome-capture); promotion is readiness-DERIVED, not a uniformly enforced per-persona gate (see GAP-P1).',
    services: ['services/capadex/evidence-gate.ts', 'services/capadex/progression-outcome-capture.ts', 'services/outcome-intelligence-engine.ts'],
    tables: ['wc3_stage_progression', 'wc3_stage_state', 'validation_loop_outcomes'],
    residual: 'ENGINEERING (GAP-P1, Medium): promotion criteria are readiness-derived, not a single enforced gate across all personas. ADOPTION: realized-outcome volume is usage-driven (null≠0).',
  },
];

/**
 * PER-LIFECYCLE-STAGE PROMOTION RULES (FROZEN — the four coded stages, in order).
 * For each stage: the entry/exit criteria, the assessments/evidence/outcomes the stage requires,
 * and the promotion rule that advances to the next stage. REFERENCES the EXISTING readiness +
 * progression machinery (lib/lifecycle.ts, evidence-gate.ts, wc3_stage_progression) — no new gate.
 */
export interface LifecyclePromotionRule {
  code: LifecycleStageCode;
  label: string;
  order: number;
  entryCriteria: string;
  exitCriteria: string;
  requiredAssessments: string[];
  requiredEvidence: string;
  requiredOutcomes: string;
  promotionRule: string;
  status: ProgressionStatus;
  statusNote?: string;
  evidence: ProgressionEvidence;
}

export const LIFECYCLE_PROMOTION_RULES: LifecyclePromotionRule[] = [
  {
    code: 'CAP_CUR', label: 'Curiosity', order: 0,
    entryCriteria: 'First-touch / entry assessment started (or anonymous first signal).',
    exitCriteria: 'A scored baseline exists and the first AI diagnosis has been surfaced.',
    requiredAssessments: ['entry', 'baseline'],
    requiredEvidence: 'At least one scored session captured into the longitudinal record.',
    requiredOutcomes: 'Diagnosis delivered (no realized growth-outcome required yet).',
    promotionRule: 'Curiosity→Insight when a baseline + diagnosis exist (readiness band derived by evidence-gate; promotion recorded in wc3_stage_progression).',
    status: 'SUPPORTED',
    statusNote: 'Entry → baseline → diagnosis is the most mature segment of the loop.',
    evidence: {
      services: ['services/capadex/evidence-gate.ts', 'services/wc3/longitudinal-foundation.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['capadex_sessions', 'wc3_stage_state', 'wc3_longitudinal_snapshots'],
      frontend: ['components/FreeAssessmentModal.tsx'],
    },
  },
  {
    code: 'CAP_INS', label: 'Insight', order: 1,
    entryCriteria: 'Baseline + diagnosis exist (display alias "Clarity").',
    exitCriteria: 'Recommendations + a learning/intervention plan have been generated and acted on.',
    requiredAssessments: ['baseline', 'behaviour', 'competency'],
    requiredEvidence: 'Recommendation + intervention/learning-plan generated for the diagnosed gap.',
    requiredOutcomes: 'Growth action started (recommendation engagement); realized-outcome adoption-gated.',
    promotionRule: 'Insight→Growth when a growth plan is generated and the subject begins acting (recommendation→action link, INV1).',
    status: 'SUPPORTED',
    statusNote: 'Recommendation + learning + intervention generation is well-supported (reused engines).',
    evidence: {
      services: ['services/recommendation-intelligence-engine.ts', 'services/learning-path-engine.ts', 'services/intervention-intelligence.ts'],
      routes: ['routes/capadex.ts', 'routes/career-readiness.ts'],
      tables: ['development_recommendations', 'capadex_interventions', 'lbi_intervention_library'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    code: 'CAP_GRW', label: 'Growth', order: 2,
    entryCriteria: 'A growth plan is active and the subject is acting on recommendations.',
    exitCriteria: 'A reassessment shows validated improvement vs the baseline (INV2 + INV3).',
    requiredAssessments: ['progress', 'competency', 'performance'],
    requiredEvidence: '>1 longitudinal datapoint (re-administration) showing positive movement.',
    requiredOutcomes: 'Validated improvement captured; realized-outcome ledger entry (adoption-gated).',
    promotionRule: 'Growth→Mastery when reassessment validates sustained improvement (readiness band high) — readiness-DERIVED (GAP-P1: not a uniformly enforced per-persona gate).',
    status: 'PARTIAL',
    statusNote: 'Reassessment + improvement MECHANISM present (Phase 1.3 reuse + longitudinal trend); the exit→promotion link is readiness-derived and the validation is ADOPTION-pending (>1 non-demo datapoint required). Coverage⟂Adoption⟂Confidence never composited.',
    evidence: {
      services: ['services/capadex/progression-outcome-capture.ts', 'services/longitudinal-memory.ts', 'services/wc7b/longitudinal-automation.ts'],
      routes: ['routes/career-progression.ts', 'routes/career-readiness.ts'],
      tables: ['wc3_longitudinal_snapshots', 'longitudinal_patterns', 'career_readiness_history'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    code: 'CAP_MAS', label: 'Mastery', order: 3,
    entryCriteria: 'Sustained validated improvement; readiness at the top band.',
    exitCriteria: 'Exit / continuous assessment confirms mastery; outcome realized + loop re-enters.',
    requiredAssessments: ['exit', 'continuous', 'performance'],
    requiredEvidence: 'Reached-Mastery milestone + exit-eligibility signal.',
    requiredOutcomes: 'Realized mastery outcome captured (reached_mastery milestone); continuous-development re-entry.',
    promotionRule: 'Mastery is terminal in the coded ladder; the loop re-enters via continuous-development (reassessment cadence) — adoption-gated.',
    status: 'PARTIAL',
    statusNote: 'Reached-Mastery + exit-eligibility MECHANISM present (progression-outcome-capture reached_mastery + getReassessmentSignal). Continuous re-entry cadence is adoption-gated; realized mastery-outcome volume is honest-low/0 (Adoption⟂Coverage, null≠0).',
    evidence: {
      services: ['services/capadex/progression-outcome-capture.ts', 'services/outcome-intelligence-engine.ts', 'services/wc7b/longitudinal-automation.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['validation_loop_outcomes', 'wc3_stage_progression'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
];

/**
 * THE CANONICAL PROGRESSION MODEL (per persona).
 * Each persona instantiates the ONE growth spine and differs only by which steps are reachable,
 * which assessments/recommendations/interventions/outcomes apply, and its promotion rule. Every
 * field REFERENCES an EXISTING implementation (reuse-before-build). Statuses are a Coverage axis.
 */
export interface ProgressionPath {
  key: string;
  label: string;
  /** Human persona label. */
  persona: string;
  /** Persona codes P1–P9 (see PERSONA_BLUEPRINT). 'aggregate' = institute roll-up; 'all' = cross-cutting. */
  personas: string[];
  /** Which canonical spine steps this persona's growth loop actually reaches today. */
  spineReached: SpineStepKey[];
  /** Lifecycle stages the path traverses (CAP_*). [lifecycle axis] */
  lifecycleStages: LifecycleStageCode[];
  /** Canonical assessment-framework keys (Phase 1.3) this path consumes. [assessment axis] */
  assessments: string[];
  /** How AI interprets this path's signals. [ai axis] */
  aiInterpretation: string;
  /** Recommendation rules surfaced. [recommendation axis] */
  recommendationRule: string;
  /** Intervention path (how targeted interventions are delivered). [intervention axis] */
  interventionPath: string;
  /** Learning/development plan path. */
  learningPath: string;
  /** Reassessment / re-measurement rule (close-the-loop). */
  reassessmentRule: string;
  /** Realized-outcome definition for this path. [outcome axis] */
  outcomes: string;
  /** Promotion rule (how the subject advances the lifecycle). [promotion axis] */
  promotionRule: string;
  /** Measurable success criteria (KPIs of growth). */
  successCriteria: string;
  status: ProgressionStatus;
  /** Honest note on WHY a status is PARTIAL/DEAD_END (Coverage⟂Confidence⟂Outcome⟂Adoption). */
  statusNote?: string;
  evidence: ProgressionEvidence;
}

export const PROGRESSION_MODEL: ProgressionPath[] = [
  {
    key: 'student_growth',
    label: 'Student → Career Growth',
    persona: 'Student (school/college)',
    personas: ['P1', 'P2', 'P3'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'learning_plan', 'practice_activity', 'personalized_intervention', 'progress_measurement'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'behaviour', 'competency'],
    aiInterpretation: 'Behavioural signal → concern routing + competency diagnosis (PIL runtime guidance).',
    recommendationRule: 'Career-builder growth recommendations + growth-plan bridge (decision orchestrator).',
    interventionPath: 'Concern-targeted interventions (intervention-intelligence → capadex_interventions).',
    learningPath: 'Guided learning plan (learning-path-engine) surfaced in Career Builder.',
    reassessmentRule: 'Interval reassessment signal (getReassessmentSignal) once a baseline accrues; adoption-gated.',
    outcomes: 'Career direction chosen / measurable growth progressed; realized-outcome tail adoption-gated.',
    promotionRule: 'Curiosity→Insight→Growth via baseline+diagnosis then growth-plan action (INV1).',
    successCriteria: 'Assessment completion; recommendation engagement; positive re-measure movement.',
    status: 'PARTIAL',
    statusNote: 'Strong front-half (assessment→diagnose→recommend→learn→intervene). Progress measurement MECHANISM present; per-journey reassessment/improvement is ADOPTION-pending (Coverage⟂Adoption, null≠0).',
    evidence: {
      services: ['services/pil/runtime-guidance-engine.ts', 'services/recommendation-intelligence-engine.ts', 'services/learning-path-engine.ts', 'services/intervention-intelligence.ts'],
      routes: ['routes/capadex.ts', 'routes/student-career-builder.ts'],
      tables: ['capadex_user_profiles', 'wc3_stage_state', 'capadex_interventions', 'wc3_longitudinal_snapshots'],
      frontend: ['components/FreeAssessmentModal.tsx', 'components/StudentDashboard.tsx', 'pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'fresher_readiness',
    label: 'Fresher → Placement Readiness',
    persona: 'Fresher / final-year (job-seeker)',
    personas: ['P4', 'P3'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'learning_plan', 'competency_development', 'progress_measurement', 'outcome_achievement'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'performance'],
    aiInterpretation: 'Competency + readiness diagnosis; role-DNA crosswalk for fit.',
    recommendationRule: 'Launchpad next-steps + campus placement matching (career-recommendation-engine).',
    interventionPath: 'Readiness-gap interventions + curated practice (recommendation catalog).',
    learningPath: 'Launchpad learning plan toward role readiness (learning-path-engine).',
    reassessmentRule: 'Readiness re-measure as launchpad checklist advances; adoption-gated.',
    outcomes: 'Application submitted / placed (placement outcome → validation_loop_outcomes).',
    promotionRule: 'Curiosity→Insight→Growth as readiness band rises (evidence-gate); placement = realized outcome.',
    successCriteria: 'Launchpad completion; readiness uplift; application + placement rate.',
    status: 'SUPPORTED',
    statusNote: 'Launchpad + campus placement readiness loop is live; realized placement-outcome capture is the universal adoption-gated tail (Adoption⟂Coverage).',
    evidence: {
      services: ['services/career-recommendation-engine.ts', 'services/career-recommendation-aggregator.ts', 'services/learning-path-engine.ts'],
      routes: ['routes/career-launchpad.ts', 'routes/career-readiness.ts', 'routes/talent-matching-engine.ts'],
      tables: ['career_seeker_profiles', 'career_readiness_history', 'job_postings'],
      frontend: ['pages/career/CareerLaunchpadDashboard.tsx', 'pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'professional_progression',
    label: 'Professional → Role Progression',
    persona: 'Working professional',
    personas: ['P5'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'learning_plan', 'competency_development', 'progress_measurement', 'reassessment', 'improvement_validation', 'promotion'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['baseline', 'competency', 'performance', 'progress'],
    aiInterpretation: 'Competency + progression diagnosis; trend intelligence.',
    recommendationRule: 'Progression-aware growth plan (recommendation-intelligence-engine).',
    interventionPath: 'Competency-gap interventions + reinforcement nudges.',
    learningPath: 'Progression learning plan toward the next role band.',
    reassessmentRule: 'Interval reassessment (longitudinal-automation cadence) → improvement validation vs baseline.',
    outcomes: 'Role progression / promotion; adoption-gated realized-outcome tail.',
    promotionRule: 'Growth→Mastery on validated sustained improvement (readiness-DERIVED — GAP-P1).',
    successCriteria: 'Re-run rate; positive-movement rate; progression cadence.',
    status: 'PARTIAL',
    statusNote: 'Reaches the FULL loop incl. reassessment→improvement→promotion as a MECHANISM, but promotion is DERIVED (not a uniformly enforced per-persona gate, GAP-P1) and validation is ADOPTION-pending (Coverage⟂Adoption⟂Confidence).',
    evidence: {
      services: ['services/recommendation-intelligence-engine.ts', 'services/capadex/evidence-gate.ts', 'services/longitudinal-memory.ts', 'services/wc7b/longitudinal-automation.ts'],
      routes: ['routes/capadex.ts', 'routes/career-progression.ts', 'routes/career-readiness.ts'],
      tables: ['wc3_stage_progression', 'wc3_longitudinal_snapshots', 'longitudinal_patterns', 'career_readiness_history'],
      frontend: ['pages/CareerBuilderPage.tsx'],
    },
  },
  {
    key: 'employee_competency',
    label: 'Employee → Competency / EI Development',
    persona: 'Enterprise employee',
    personas: ['P5', 'P6'],
    spineReached: ['assessment', 'evidence_collection', 'ai_interpretation', 'recommendation', 'competency_development', 'personalized_intervention', 'progress_measurement'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS', 'CAP_GRW'],
    assessments: ['entry', 'baseline', 'competency', 'behaviour'],
    aiInterpretation: 'Competency genome + EI dimension diagnosis (mei-scoring-engine).',
    recommendationRule: 'Competency-gap → development recommendation (mei-recommendation-engine).',
    interventionPath: 'EI / competency interventions (intervention-intelligence).',
    learningPath: 'Competency development plan against the genome.',
    reassessmentRule: 'EI re-measure (ei_profile_snapshots) as development progresses; adoption-gated.',
    outcomes: 'Competency uplift; EI development; adoption-gated outcome tail.',
    promotionRule: 'Insight→Growth as competency/EI band rises (evidence-gate readiness).',
    successCriteria: 'Baseline coverage; competency movement; EI delta.',
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
    label: 'HR / Recruiter → Hiring Progression',
    persona: 'HR / recruiter',
    personas: ['P7'],
    spineReached: ['assessment', 'ai_interpretation', 'recommendation', 'progress_measurement', 'outcome_achievement'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'performance', 'behaviour'],
    aiInterpretation: 'Candidate-match + interview intelligence (calibration k-gated).',
    recommendationRule: 'Talent-match ranking → interview → hire decision support.',
    interventionPath: 'Funnel-stage prompts (assessment → interview → decision) — recruiter-facing.',
    learningPath: 'N/A for recruiter (the candidate is the learner) — reuse only.',
    reassessmentRule: 'Candidate re-assessment across funnel stages; calibration accrues at k_min=30.',
    outcomes: 'Hire decision / hired (hiring outcome → validation_loop_outcomes).',
    promotionRule: 'Funnel-stage advancement; realized hiring-outcome capture (employer-ecosystem).',
    successCriteria: 'Funnel conversion; time-to-decision; match quality; calibration (k≥30).',
    status: 'SUPPORTED',
    statusNote: 'The 9-stage hiring funnel is the most complete progression family. Realized hiring-outcome capture exists; adoption + calibration reported separately (Adoption⟂Coverage; Brier/ECE abstain <k_min=30).',
    evidence: {
      services: ['services/wc7b/decision-orchestrator.ts', 'services/validation-loop-intake.ts'],
      routes: ['routes/employer-portal.ts', 'routes/employer-ecosystem.ts', 'routes/employer-hiring-intelligence.ts'],
      tables: ['employer_jobs', 'job_postings', 'validation_loop_outcomes'],
      frontend: ['pages/EmployerPortalPage.tsx'],
    },
  },
  {
    key: 'institute_cohort',
    label: 'Institute Admin → Cohort Progression',
    persona: 'Institution administrator',
    personas: ['P9', 'aggregate'],
    spineReached: ['ai_interpretation', 'recommendation', 'progress_measurement'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['competency', 'behaviour', 'progress'],
    aiInterpretation: 'k-anon cohort aggregation (MX-302H institutional intelligence).',
    recommendationRule: 'Cohort-level act recommendations (k-gated).',
    interventionPath: 'Cohort-level intervention prompts (k≥k_min).',
    learningPath: 'Cohort learning-gap roll-up (aggregate, not per-individual).',
    reassessmentRule: 'Cohort re-measure across terms (longitudinal aggregate); adoption-gated.',
    outcomes: 'Cohort-level intervention / placement outcome (aggregate).',
    promotionRule: 'Cohort movement across bands (aggregate trend); no individual promotion gate.',
    successCriteria: 'Cohort coverage; cohort movement; placement rate.',
    status: 'SUPPORTED',
    statusNote: 'Real k-anon aggregation (MX-302H) — scores masked below k_min, roster always shown. Realized cohort-outcome tail adoption-gated.',
    evidence: {
      services: ['services/longitudinal-memory.ts'],
      routes: ['routes/employer-dashboards.ts', 'routes/career-benchmark.ts'],
      tables: ['wc3_longitudinal_snapshots', 'longitudinal_patterns'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    },
  },
  {
    key: 'parent_support',
    label: 'Parent → Support Child Growth',
    persona: 'Parent / guardian',
    personas: ['P1', 'P2'],
    spineReached: ['progress_measurement', 'behaviour_reinforcement'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    assessments: ['behaviour', 'competency'],
    aiInterpretation: 'Child progress framing via consent-scoped view.',
    recommendationRule: 'Support-action recommendations (journey-tail engine).',
    interventionPath: 'Parent support actions reinforcing the child growth loop (jt_parent_support_actions).',
    learningPath: 'N/A for parent (the child is the learner) — reuse only.',
    reassessmentRule: 'Child re-measure surfaced to the parent; support action fires a journey-tail milestone.',
    outcomes: 'Support actions logged → child growth loop continuation (captureJourneyTailMilestone).',
    promotionRule: 'No parent promotion; reinforces the child progression (INV1 reinforcement link).',
    successCriteria: 'Consent rate; support-action adoption; child positive movement.',
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
    label: 'Mentor / Coach → Mentee Progression',
    persona: 'Mentor / coach',
    personas: ['P6'],
    spineReached: ['recommendation', 'personalized_intervention', 'progress_measurement', 'behaviour_reinforcement'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    assessments: ['competency', 'progress'],
    aiInterpretation: 'Mentee progress framing; decision-mentor bridge.',
    recommendationRule: 'Engagement / guidance recommendations (journey-tail engine).',
    interventionPath: 'Mentor engagement milestones reinforcing the mentee loop (jt_mentor_engagements).',
    learningPath: 'Mentee guidance plan (mentor-facing).',
    reassessmentRule: 'Mentee re-measure across engagements; milestone fires into the outcome tail.',
    outcomes: 'Mentee engagement logged → guidance loop continuation (captureJourneyTailMilestone).',
    promotionRule: 'No mentor promotion; advances the mentee progression (INV1/INV2 links).',
    successCriteria: 'Match rate; engagement cadence; mentee movement.',
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
    label: 'Faculty → Batch Progression',
    persona: 'Faculty member',
    personas: ['aggregate'],
    spineReached: ['progress_measurement'],
    lifecycleStages: ['CAP_INS'],
    assessments: ['competency', 'behaviour'],
    aiInterpretation: 'Batch-confined cohort aggregation (nested in institute).',
    recommendationRule: 'Faculty-scoped act recommendations (k-gated).',
    interventionPath: 'Batch-level intervention prompts (k≥k_min, batch-confined).',
    learningPath: 'Batch learning-gap roll-up (aggregate).',
    reassessmentRule: 'Batch re-measure across terms (aggregate); adoption-gated.',
    outcomes: 'Batch-level intervention (aggregate).',
    promotionRule: 'Batch movement across bands (aggregate); no individual promotion gate.',
    successCriteria: 'Batch coverage; batch movement.',
    status: 'PARTIAL',
    statusNote: 'Faculty batch-confined progress view EXISTS (institutional-intelligence, role-scoped batch-confined access; MX-302H). Aggregate-only — no per-individual progression. Adoption-gated cohort volume (Coverage⟂Adoption).',
    evidence: {
      services: ['services/longitudinal-memory.ts'],
      routes: ['routes/employer-dashboards.ts'],
      tables: ['wc3_longitudinal_snapshots'],
      frontend: ['components/UnifiedInstituteDashboard.tsx'],
    },
  },
];

/** Cross-cutting decisions that are NOT silent merges (documented, like 1.4 duplicate-entrances). */
export interface ProgressionDecision {
  topic: string;
  decision: string;
  rationale: string;
}

export const PROGRESSION_DECISIONS: ProgressionDecision[] = [
  {
    topic: 'Single progression engine (no V2)',
    decision: 'COMPOSE_EXISTING',
    rationale: 'The continuous-growth loop is realised by EXISTING engines (progression-outcome-capture, evidence-gate, recommendation/learning/intervention/longitudinal). This phase adds ONE read-only composer/registry, never a parallel progression engine.',
  },
  {
    topic: 'Promotion gate',
    decision: 'READINESS_DERIVED',
    rationale: 'Promotion is derived from evidence-gate readiness bands recorded in wc3_stage_progression, NOT a new hard gate. A uniformly enforced per-persona promotion gate is GAP-P1 (Medium) — additive/optional, never fabricated as done.',
  },
  {
    topic: 'Reassessment cadence',
    decision: 'ON_READ_SIGNAL',
    rationale: 'getReassessmentSignal derives eligibility on read (no scheduler). Automated cadence (wc7b/longitudinal-automation) is adoption-gated. Continuous growth is a MECHANISM (Coverage) whose ADOPTION is usage-driven (null≠0).',
  },
];
