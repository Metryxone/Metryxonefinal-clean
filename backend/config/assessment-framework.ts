/**
 * CAPADEX 3.0 — Program 1 · Phase 1.3 Assessment Framework Completion
 * ──────────────────────────────────────────────────────────────────
 * THE ONE canonical Assessment Framework (single source of truth).
 *
 * This module is PURE DATA. It introduces NO new assessment engine, NO V2, NO duplicate
 * logic and NO schema. It promotes the Program-0 FROZEN taxonomy
 * (`backend/audit/capadex-3.0-product-blueprint-final/08_ASSESSMENT_BLUEPRINT.md`) to a
 * runtime-readable registry that maps EVERY assessment to the eight platform axes and
 * REFERENCES the EXISTING implementations by file/table only (reuse-before-build).
 *
 * The taxonomy is FROZEN — this phase does NOT re-decide it. The spec's 19-name list folds
 * into the canonical 10 types via `SPEC_19_CROSSWALK` (honest mapping, never a new engine).
 *
 * Honesty contract: `status` is a Coverage axis (does an implementation exist?), kept
 * SEPARATE from any Confidence/Outcome axis. Evidence paths are CLAIMS verified independently
 * by `scripts/capadex-1.3-assessment-framework-scan.ts` against the live filesystem + DB —
 * the scan, not this file, is the SSoT for "present/absent" numbers. null ≠ 0; never fabricate.
 */

export type AssessmentStatus = 'IMPLEMENTED' | 'PARTIAL' | 'MISSING';

/** Canonical lifecycle stage codes (lib/lifecycle.ts). */
export type LifecycleStageCode = 'CAP_CUR' | 'CAP_INS' | 'CAP_GRW' | 'CAP_MAS';

/** Repo evidence — existing implementations REUSED by each assessment type (no rebuild). */
export interface AssessmentEvidence {
  /** backend/services/*.ts engines that compute this assessment (reused). */
  services: string[];
  /** backend/routes/*.ts (or routes.ts surfaces) that expose it. */
  routes: string[];
  /** database tables/objects that persist it. */
  tables: string[];
  /** frontend/src surfaces that render it. */
  frontend: string[];
}

export interface CanonicalAssessmentType {
  key: string;
  label: string;
  definition: string;
  /** Which of the spec's 19 names fold into this canonical type. */
  specAliases: string[];
  purpose: string;
  businessValue: string;
  /** Persona codes P1–P9 (see PERSONA_MODEL). 'aggregate' = institute roll-up; 'n/a' = not applicable. */
  personas: string[];
  lifecycleStages: LifecycleStageCode[];
  customerJourney: string;
  entryCriteria: string;
  completionCriteria: string;
  scoringMethod: string;
  benchmarking: string;
  aiInterpretation: string;
  recommendationRules: string;
  interventionRules: string;
  reports: string;
  dashboards: string;
  outcomes: string;
  kpis: string;
  dependencies: string[];
  status: AssessmentStatus;
  /** Honest note on WHY a status is PARTIAL/MISSING (Coverage⟂Confidence). */
  statusNote?: string;
  evidence: AssessmentEvidence;
}

/**
 * THE CANONICAL 10-TYPE TAXONOMY (FROZEN).
 * Ordered by lifecycle position. Status mirrors the frozen 08_ASSESSMENT_BLUEPRINT verdict.
 */
export const ASSESSMENT_FRAMEWORK: CanonicalAssessmentType[] = [
  {
    key: 'entry',
    label: 'Entry Assessment',
    definition: 'First-touch placement — persona capture + concern discovery at the very start of the journey.',
    specAliases: ['Entry', 'Discovery'],
    purpose: 'Place a brand-new user: capture persona/cohort and surface the presenting concern so the right bank/flow is served.',
    businessValue: 'Top-of-funnel conversion + correct routing; the only assessment every persona always meets.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_CUR'],
    customerJourney: 'Acquisition → first session (FreeAssessmentModal IntroPhase).',
    entryCriteria: 'New/anonymous session opened; no prior persona on capadex_user_profiles.',
    completionCriteria: 'Persona + concern selected; IntroPhase progressive form valid.',
    scoringMethod: 'Non-scored placement (selection + concern routing); feeds bank resolution.',
    benchmarking: 'n/a (placement, not a score).',
    aiInterpretation: 'Concern → signal routing (analyzeConcern / clarity mapping).',
    recommendationRules: 'Routes to the correct sub-persona question bank (resolveQuestionBank).',
    interventionRules: 'n/a at entry.',
    reports: 'No standalone report (feeds Behaviour/Diagnostic report).',
    dashboards: 'Counts roll into Student/Founder dashboards.',
    outcomes: 'Session-start telemetry (capadex_session_telemetry).',
    kpis: 'Started→completed conversion; persona distribution.',
    dependencies: ['persona model', 'concern banks'],
    status: 'IMPLEMENTED',
    evidence: {
      services: ['services/behavioral-signal-engine.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['capadex_user_profiles', 'capadex_sessions', 'capadex_session_telemetry'],
      frontend: ['components/FreeAssessmentModal.tsx', 'components/assessment/phases/IntroPhase.tsx'],
    },
  },
  {
    key: 'baseline',
    label: 'Baseline Assessment',
    definition: 'Initial level snapshot — the first scored run that establishes a reference point.',
    specAliases: ['Baseline'],
    purpose: 'Establish the user’s starting level so later runs can measure movement.',
    businessValue: 'Anchors Progress/Outcome measurement; without a baseline, growth is unmeasurable.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS'],
    customerJourney: 'First scored assessment after entry.',
    entryCriteria: 'Entry complete; first competency/EI/behaviour run begins.',
    completionCriteria: 'First employability_scoring_runs row persisted for the subject.',
    scoringMethod: 'Engine-scored (behavioural / competency / EI) → employability_scoring_runs.',
    benchmarking: 'Cohort percentile where k≥k_min; else suppressed.',
    aiInterpretation: 'Behavioural report synthesis (capadex-report-synthesis).',
    recommendationRules: 'Seeds first PIL recommendation set.',
    interventionRules: 'Wellbeing/learning intervention triggers if signals warrant.',
    reports: 'First CAPADEX report (ReportPhase).',
    dashboards: 'Student/career dashboards baseline values.',
    outcomes: 'Baseline row referenced by Progress deltas.',
    kpis: 'Baseline completion rate; baseline score distribution.',
    dependencies: ['entry'],
    status: 'IMPLEMENTED',
    evidence: {
      services: ['services/capadex-report-synthesis.ts', 'services/behavioral-signal-engine.ts'],
      routes: ['routes/capadex.ts'],
      tables: ['employability_scoring_runs', 'capadex_sessions'],
      frontend: ['components/assessment/phases/ReportPhase.tsx'],
    },
  },
  {
    key: 'diagnostic',
    label: 'Diagnostic Assessment',
    definition: 'Concern / behaviour diagnosis — the deepest assessment surface (concern banks, signal analysis, clarity).',
    specAliases: ['Diagnostic', 'Discovery', 'Wellness'],
    purpose: 'Diagnose the presenting concern and the behavioural signals driving it; surface wellbeing flags.',
    businessValue: 'Core differentiator — the diagnostic depth that drives interventions and trust.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS'],
    customerJourney: 'Curiosity→Insight; clarity loop resolves ambiguous signals.',
    entryCriteria: 'Concern selected; behavioural questionnaire served.',
    completionCriteria: 'Signals analysed; clarity resolved; concern→signal mapping produced.',
    scoringMethod: '4-tier signal ontology + clarity mapping (concern-diagnostic).',
    benchmarking: 'Concern-band stats (diagnostic, not a strength score).',
    aiInterpretation: 'Signal analysis + contradiction detection + clarity.',
    recommendationRules: 'Concern-specific guidance (PIL runtime-guidance-engine).',
    interventionRules: 'capadex-intervention-engine (learning/wellbeing).',
    reports: 'Behavioural/diagnostic narrative report.',
    dashboards: 'Behavioural growth tab; concern roll-ups.',
    outcomes: 'Interventions logged (capadex_session_interventions).',
    kpis: 'Concern coverage; clarity-resolution rate; intervention uptake.',
    dependencies: ['entry', 'concern banks', 'signal ontology'],
    status: 'IMPLEMENTED',
    statusNote: 'Deepest surface. Concern-diagnostic ⟂ Behaviour-signal are distinct subjects (boundary documented, not merged).',
    evidence: {
      services: ['services/behavioral-signal-engine.ts', 'services/behavioral-contradiction-engine.ts', 'services/capadex-intervention-engine.ts'],
      routes: ['routes/capadex.ts', 'routes/behavioural-signals.ts'],
      tables: ['behavioural_insights', 'capadex_session_interventions', 'contradiction_events'],
      frontend: ['components/assessment/phases/CapadexClarifyPhase.tsx', 'components/career/BehavioralGrowthTab.tsx'],
    },
  },
  {
    key: 'behaviour',
    label: 'Behaviour Assessment',
    definition: 'Behavioural signal patterns — timing/linguistic signals captured during the session (4-tier ontology).',
    specAliases: ['Behaviour', 'Personality'],
    purpose: 'Measure behavioural traits/patterns (incl. personality-style surfaces) from real session signals.',
    businessValue: 'Behavioural intelligence is the platform’s core IP; powers honesty/contradiction guards.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_CUR', 'CAP_INS'],
    customerJourney: 'Runs underneath every CAPADEX session.',
    entryCriteria: 'Any CAPADEX questionnaire session active.',
    completionCriteria: 'Behavioural signals processed into behavioural_insights.',
    scoringMethod: 'behavioural-signal-engine (timing/linguistic) → namespace-aligned signals.',
    benchmarking: 'Cohort signal bands (k-gated).',
    aiInterpretation: 'Signal namespace alignment + contradiction detection.',
    recommendationRules: 'Feeds PIL active-construct derivation.',
    interventionRules: 'Reliability flags when contradictions detected.',
    reports: 'Behavioural section of CAPADEX report.',
    dashboards: 'BehavioralGrowthTab; LBI dashboard (student product).',
    outcomes: 'Signal trends fold into longitudinal/behaviour memory.',
    kpis: 'Signal capture rate; contradiction/reliability rate.',
    dependencies: ['entry'],
    status: 'IMPLEMENTED',
    statusNote: 'Personality folds in as a behavioural-trait surface — NOT a separate clinical personality test.',
    evidence: {
      services: ['services/behavioral-signal-engine.ts', 'services/behavioral-contradiction-engine.ts'],
      routes: ['routes/behavioural-signals.ts', 'routes/cognitive-load.ts'],
      tables: ['behavioural_insights', 'contradiction_events'],
      frontend: ['components/career/BehavioralGrowthTab.tsx', 'components/career/LBIDashboard.tsx'],
    },
  },
  {
    key: 'competency',
    label: 'Competency Assessment',
    definition: 'Frameworked skill assessment — onto_*/competency_* genome with adaptive question bank.',
    specAliases: ['Competency', 'Skill', 'Psychometric', 'Leadership', 'Career'],
    purpose: 'Measure frameworked competencies/skills against the ontology genome and Role-DNA.',
    businessValue: 'The employability spine — drives readiness, matching, hiring and career planning.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    customerJourney: 'Insight→Growth→Mastery; candidate-side for employers.',
    entryCriteria: 'Competency/Role-DNA assessment selected; adaptive bank served.',
    completionCriteria: 'Competency scores persisted; level bands assigned.',
    scoringMethod: 'Adaptive question bank + ai-competency-inference + role-DNA runtime.',
    benchmarking: 'Role-DNA expected level; cohort percentile (k-gated).',
    aiInterpretation: 'ai-competency-inference-engine; competency intelligence.',
    recommendationRules: 'Gap → development recommendations (career/learning).',
    interventionRules: 'Learning-path nudges on competency gaps.',
    reports: 'Competency report; report-factory blueprints.',
    dashboards: 'MEI/Hiring-readiness/Skill bars; competency admin panels.',
    outcomes: 'Feeds talent match + hiring-decision outcomes.',
    kpis: 'Competency coverage; level distribution; gap closure.',
    dependencies: ['baseline', 'competency ontology', 'Role-DNA'],
    status: 'IMPLEMENTED',
    statusNote: 'Skill/Psychometric/Leadership/Career fold in as competency domains/lenses. LBI (lbi_*) ⟂ Competency (onto_*) are two products by design — NOT merged.',
    evidence: {
      services: ['services/ai-competency-inference-engine.ts', 'services/role-dna-runtime-engine.ts', 'services/career-readiness-engine.ts'],
      routes: ['routes/competency-runtime-v2.ts', 'routes/career-genome.ts', 'routes/role-dna-runtime.ts', 'routes/competency-questions.ts'],
      tables: ['competency_question_templates', 'onto_competencies', 'onto_role_competency_profiles', 'role_dna_master_profiles'],
      frontend: ['modules/career-builder/competency/views/AdaptiveAssessmentRuntime.tsx', 'components/career/HiringReadinessTab.tsx', 'components/career/MEIDashboard.tsx'],
    },
  },
  {
    key: 'learning',
    label: 'Learning Assessment',
    definition: 'Knowledge/learning checks — curated coding MCQ, practice sets, learning-path checks.',
    specAliases: ['Learning', 'Practice'],
    purpose: 'Verify knowledge acquisition through curated MCQ / practice items.',
    businessValue: 'Closes the learn→prove loop; supports upskilling claims.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW'],
    customerJourney: 'Growth — between competency runs.',
    entryCriteria: 'Learning/practice module selected (exam-ready / curated MCQ).',
    completionCriteria: 'Item set submitted; score computed.',
    scoringMethod: 'MCQ scoring (assessment-runtime-orchestrator / exam-ready).',
    benchmarking: 'Per-domain breakdown; no platform-wide norm yet.',
    aiInterpretation: 'Limited — score + domain breakdown.',
    recommendationRules: 'Weak-domain → next practice suggestion.',
    interventionRules: 'Practice nudges on weak domains.',
    reports: 'Exam-ready report view (domain-wise).',
    dashboards: 'Exam-ready report screens.',
    outcomes: 'Practice deltas (not yet systematically tied to outcomes).',
    kpis: 'Practice completion; domain mastery.',
    dependencies: ['competency'],
    status: 'PARTIAL',
    statusNote: 'Uneven across stages/personas; no-sandbox curated MCQ only. Coverage exists, learner back-half thin.',
    evidence: {
      services: ['services/assessment-runtime-orchestrator.ts', 'services/caf/scoring-engine.ts'],
      routes: ['routes/short-assessments.ts', 'routes/caf-runtime.ts'],
      tables: ['assessment_templates', 'exam_attempts', 'short_assessment_questions'],
      frontend: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/pages/ReportViewPage.tsx'],
    },
  },
  {
    key: 'performance',
    label: 'Performance Assessment',
    definition: 'Applied/role performance — role-DNA fit, talent match, interview intelligence, readiness.',
    specAliases: ['Performance', 'Readiness', 'Career'],
    purpose: 'Measure applied performance / role fit and career readiness against real role demands.',
    businessValue: 'Employer-side revenue surface; strongest applied-evidence assessment.',
    personas: ['P4', 'P5', 'P6', 'P7', 'P8'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    customerJourney: 'Growth→Mastery; employer hiring funnel.',
    entryCriteria: 'Role/job context present; candidate competency substrate available.',
    completionCriteria: 'Role-fit / readiness score computed.',
    scoringMethod: 'role-DNA runtime + career-readiness-engine + talent match.',
    benchmarking: 'Role-DNA expected level; readiness bands.',
    aiInterpretation: 'Talent-match + interview intelligence.',
    recommendationRules: 'Readiness gap → development roadmap.',
    interventionRules: 'Targeted prep on readiness gaps.',
    reports: 'Hiring/readiness reports; employer candidate drawer.',
    dashboards: 'Hiring-readiness/Future-readiness tabs; employer dashboards.',
    outcomes: 'Hiring-decision outcomes (validation_loop_outcomes).',
    kpis: 'Readiness distribution; match precision; hire conversion.',
    dependencies: ['competency', 'Role-DNA'],
    status: 'PARTIAL',
    statusNote: 'STRONG on the employer surface, thin on the learner back-half. Readiness/Career fold in here.',
    evidence: {
      services: ['services/role-dna-runtime-engine.ts', 'services/career-readiness-engine.ts'],
      routes: ['routes/role-dna-runtime.ts', 'routes/career-genome.ts'],
      tables: ['role_dna_master_profiles', 'career_readiness_history', 'validation_loop_outcomes'],
      frontend: ['components/career/HiringReadinessTab.tsx', 'components/career/FutureReadinessTab.tsx'],
    },
  },
  {
    key: 'progress',
    label: 'Progress Assessment',
    definition: 'Re-measure vs baseline — employability_scoring_runs deltas across sessions.',
    specAliases: ['Progress'],
    purpose: 'Measure movement against the baseline over time.',
    businessValue: 'Proves the product works; the basis of the growth narrative.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    customerJourney: 'Growth→Mastery; longitudinal.',
    entryCriteria: 'A baseline + at least one re-run exists for the subject.',
    completionCriteria: 'Delta computed vs baseline.',
    scoringMethod: 'employability_scoring_runs deltas + longitudinal_patterns.',
    benchmarking: 'Self vs baseline; cohort movement (k-gated).',
    aiInterpretation: 'Longitudinal trend + Bayesian construct update.',
    recommendationRules: 'Trend-aware next-step guidance.',
    interventionRules: 'Drop alerts (≥ threshold) trigger nudges.',
    reports: 'Progression / longitudinal report.',
    dashboards: 'CareerMemoryTab; progression views.',
    outcomes: 'Progress deltas feed outcome capture.',
    kpis: 'Re-run rate; positive-movement rate.',
    dependencies: ['baseline'],
    status: 'PARTIAL',
    statusNote: 'Data + deltas EXIST but assessments are NOT systematically re-administered → "Progress (systematic)" is the depth gap.',
    evidence: {
      services: ['services/longitudinal-memory.ts', 'services/bayesian-inference-engine.ts'],
      routes: ['routes/longitudinal.ts', 'routes/memory-architecture.ts'],
      tables: ['employability_scoring_runs', 'longitudinal_patterns', 'wc3_stage_progression'],
      frontend: ['components/career/CareerMemoryTab.tsx'],
    },
  },
  {
    key: 'exit',
    label: 'Exit Assessment',
    definition: 'Stage/lifecycle exit gate — a re-administration of existing assessments at stage/lifecycle exit.',
    specAliases: ['Exit'],
    purpose: 'Gate stage/lifecycle exit by re-administering existing assessments to confirm readiness to move on.',
    businessValue: 'Completes the closed growth loop; turns the platform from measure-once to measure-and-confirm.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_GRW', 'CAP_MAS'],
    customerJourney: 'Stage/lifecycle boundary.',
    entryCriteria: 'Subject reaches a stage-exit boundary (evidence-gated progression).',
    completionCriteria: 'Re-run gate passes/fails; exit recorded.',
    scoringMethod: 'Re-administer baseline/competency at exit (NO new engine).',
    benchmarking: 'Exit vs entry delta.',
    aiInterpretation: 'Reuses existing readiness/progression interpretation.',
    recommendationRules: 'Pass → advance; fail → remediation loop.',
    interventionRules: 'Remediation on failed exit gate.',
    reports: 'Exit summary (reuse progression report).',
    dashboards: 'Stage-exit indicators.',
    outcomes: 'Exit event = strongest close-the-loop signal.',
    kpis: 'Exit-gate pass rate; time-to-exit.',
    dependencies: ['progress', 'evidence-gated progression', 'close-the-loop'],
    status: 'MISSING',
    statusNote: 'No exit-gate assessment event is instrumented. Forward work: re-administer existing assessments at exit — NOT a net-new engine (blueprint GAP-A4).',
    evidence: { services: [], routes: [], tables: [], frontend: [] },
  },
  {
    key: 'continuous',
    label: 'Continuous Assessment',
    definition: 'Ongoing re-assessment — interval re-administration of existing assessments.',
    specAliases: ['Continuous'],
    purpose: 'Keep the picture current by re-administering existing assessments on an interval.',
    businessValue: 'Sustains engagement + outcome evidence beyond the first measurement.',
    personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    lifecycleStages: ['CAP_INS', 'CAP_GRW', 'CAP_MAS'],
    customerJourney: 'Ongoing across the lifecycle.',
    entryCriteria: 'Interval/trigger reached for a returning subject.',
    completionCriteria: 'Interval re-run completed; trend updated.',
    scoringMethod: 'Re-administer existing assessments on interval (NO new engine).',
    benchmarking: 'Rolling trend.',
    aiInterpretation: 'Longitudinal/Bayesian substrate EXISTS (reuse).',
    recommendationRules: 'Trend-aware ongoing guidance.',
    interventionRules: 'Continuous drop alerts.',
    reports: 'Trend report (reuse longitudinal).',
    dashboards: 'Trend dashboards.',
    outcomes: 'Continuous evidence stream.',
    kpis: 'Re-engagement rate; cadence adherence.',
    dependencies: ['progress', 'longitudinal_patterns'],
    status: 'MISSING',
    statusNote: 'Longitudinal/Bayesian SUBSTRATE exists, but there is NO scheduled re-administration of assessments. Gap = the scheduler/trigger, NOT the infra.',
    evidence: {
      services: ['services/longitudinal-memory.ts', 'services/bayesian-inference-engine.ts'],
      routes: ['routes/longitudinal.ts'],
      tables: ['longitudinal_patterns'],
      frontend: [],
    },
  },
];

/**
 * SPEC-19 → CANONICAL-10 CROSSWALK.
 * Honest mapping of the Phase 1.3 brief's 19 names onto the FROZEN taxonomy. No name spawns a
 * new engine; each routes to its canonical implementing type (reuse-before-build).
 */
export const SPEC_19_CROSSWALK: { specName: string; canonicalKey: string; note: string }[] = [
  { specName: 'Entry', canonicalKey: 'entry', note: 'Direct.' },
  { specName: 'Baseline', canonicalKey: 'baseline', note: 'Direct.' },
  { specName: 'Discovery', canonicalKey: 'entry', note: 'Concern discovery within Entry/Diagnostic (IntroPhase).' },
  { specName: 'Diagnostic', canonicalKey: 'diagnostic', note: 'Direct (deepest surface).' },
  { specName: 'Behaviour', canonicalKey: 'behaviour', note: 'Direct.' },
  { specName: 'Personality', canonicalKey: 'behaviour', note: 'Behavioural-trait surface; NOT a clinical personality test.' },
  { specName: 'Psychometric', canonicalKey: 'competency', note: 'Delivery method (psychometric question bank / LBI) — folds into Behaviour/Competency, not a separate type.' },
  { specName: 'Competency', canonicalKey: 'competency', note: 'Direct (spine).' },
  { specName: 'Skill', canonicalKey: 'competency', note: 'Skill = competency sub-domain.' },
  { specName: 'Learning', canonicalKey: 'learning', note: 'Direct.' },
  { specName: 'Practice', canonicalKey: 'learning', note: 'Practice = learning sub-type (curated MCQ).' },
  { specName: 'Progress', canonicalKey: 'progress', note: 'Direct (PARTIAL — not systematically re-run).' },
  { specName: 'Performance', canonicalKey: 'performance', note: 'Direct (strong employer-side).' },
  { specName: 'Readiness', canonicalKey: 'performance', note: 'Career readiness folds into Performance (career-readiness-engine).' },
  { specName: 'Career', canonicalKey: 'performance', note: 'Career fit spans Competency+Performance; canonical home = Performance.' },
  { specName: 'Leadership', canonicalKey: 'competency', note: 'Leadership = competency domain (no separate engine).' },
  { specName: 'Wellness', canonicalKey: 'diagnostic', note: 'Wellbeing flags via capadex-intervention-engine within Diagnostic.' },
  { specName: 'Exit', canonicalKey: 'exit', note: 'MISSING — re-administer existing assessments at exit.' },
  { specName: 'Continuous', canonicalKey: 'continuous', note: 'MISSING scheduler; longitudinal substrate exists.' },
];

/** The eight platform axes every assessment must map to (acceptance criteria). */
export const ASSESSMENT_AXES = [
  'persona', 'lifecycle', 'journey', 'ai', 'reports', 'dashboards', 'outcomes', 'kpis',
] as const;
export type AssessmentAxis = typeof ASSESSMENT_AXES[number];

/** Known overlaps/duplicates carried from the frozen blueprint + Phase 1.3 discovery — DECISIONS, not bugs to silently merge. */
export const KNOWN_OVERLAPS: { pair: string; decision: 'KEEP_SEPARATE' | 'CONSOLIDATION_CANDIDATE'; rationale: string }[] = [
  { pair: 'Concern-diagnostic ⟂ Behaviour-signal', decision: 'KEEP_SEPARATE', rationale: 'Distinct subjects (overlap in input only); boundary documented in blueprint 04 dictionary.' },
  { pair: 'LBI (lbi_*) ⟂ Competency (onto_*)', decision: 'KEEP_SEPARATE', rationale: 'Two products by design; merging would break the LBI student product.' },
  { pair: 'competency-runtime.ts ⟂ competency-runtime-v2.ts', decision: 'CONSOLIDATION_CANDIDATE', rationale: 'Migration-in-progress; consolidation is breaking-risk → recommend + human approval, do NOT silently merge.' },
  { pair: 'FreeAssessmentModal ⟂ AdaptiveAssessmentRuntime', decision: 'KEEP_SEPARATE', rationale: 'Flagship consumer flow vs flag-gated standalone adaptive runtime (different entry points).' },
  { pair: 'spe-scoring-engine ⟂ caf/scoring-engine', decision: 'CONSOLIDATION_CANDIDATE', rationale: 'Similar weighted scoring in different dirs; review for shared util — breaking-risk, recommend only.' },
  { pair: 'lbi_questions_legacy', decision: 'CONSOLIDATION_CANDIDATE', rationale: 'Deprecated in favour of sdi_items / psychometric_question_bank; retire (archive) on approval, never delete blindly.' },
];
