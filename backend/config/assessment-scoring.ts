/**
 * CAPADEX 3.0 — Program 3 · Phase 3.5 Assessment Measurement & Scoring Engine
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Assessment Measurement & Scoring registry — a pure-data, FROZEN model that
 * COMPOSES the EXISTING scoring services (competency-scoring, dimension-scoring-engine,
 * competency-ei-scoring-shared, caf/scoring-engine, mei-scoring-engine, employability-scoring-engine,
 * contextual-scoring-engine, omega-x-scoring) under a single certified layer + an additive `as_*`
 * overlay. NO duplicate scoring engine, NO V2, NO breaking change.
 *
 * Scope is MEASUREMENT & SCORING ONLY — it transforms assessment RESPONSES into measurable SCORES
 * and INDICATORS: scoring models · scoring rules · response processing · measurement types ·
 * scoring configuration · validation · APIs · frontend. It does NOT do psychometric item analysis
 * (difficulty/discrimination/distractor), reliability, validity, norms, standardization, benchmarking,
 * AI-interpretation, recommendations, or reports/analytics (that is Phase 3.6+).
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/assessment-scoring-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY
 * verifies every evidence claim here against the live filesystem + DB. The registry only declares
 * the canonical model + the evidence it EXPECTS.
 *
 * SEVEN INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real scored-assessment volume) — never composited. Genuine boundaries (standardized
 * learning/cognitive/personality/leadership measurement that requires norms) stay honestly PARTIAL
 * and are reported in-line as Phase-3.6 scope boundaries, NOT gaps. Never fabricate.
 */

export type AsStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type AsAxis =
  | 'measurement_engine' | 'scoring_engine' | 'formula_engine'
  | 'rule_engine' | 'validation' | 'apis' | 'frontend';

export interface AsEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface AsDimension {
  key: AsAxis;
  label: string;
  status: AsStatus;
  statusNote: string;
  evidence: AsEvidence;
}

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the seven certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const AS_AXES: { key: AsAxis; label: string; question: string }[] = [
  { key: 'measurement_engine', label: 'Measurement Engine', question: 'Can responses be measured across competency/behaviour/skill/learning/cognitive/aptitude/personality/employability/leadership?' },
  { key: 'scoring_engine', label: 'Scoring Engine', question: 'Can responses be scored via raw/weighted/reverse/composite/percentage/domain/competency/behaviour/skill/trait/dimension/overall models?' },
  { key: 'formula_engine', label: 'Formula Engine', question: 'Is there a safe, configurable, versioned formula framework (no eval)?' },
  { key: 'rule_engine', label: 'Rule Engine', question: 'Are positive/negative weight, partial credit, bonus/penalty, mandatory/section/assessment rules applied?' },
  { key: 'validation', label: 'Validation', question: 'Can formulas, rules, configurations & responses be validated before scoring?' },
  { key: 'apis', label: 'Scoring APIs', question: 'Do score / recalculate / validation / configuration APIs exist?' },
  { key: 'frontend', label: 'Scoring Frontend', question: 'Is there a score-config / formula-mgmt / rule-mgmt / score-preview / validation-console UI?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: AsStatus; note: string }

// Scoring models (13) — the score TYPES the engine can compute
export const SCORING_MODELS: CatalogItem[] = [
  { key: 'raw_score', label: 'Raw score', status: 'SUPPORTED', note: 'Sum of item scores (computeScore raw model).' },
  { key: 'weighted_score', label: 'Weighted score', status: 'SUPPORTED', note: 'Σ(item × weight) (computeScore weighted model + as_rules positive/negative weight).' },
  { key: 'reverse_scoring', label: 'Reverse scoring', status: 'SUPPORTED', note: 'Polarity-inverted items (max+min−value) (computeScore reverse model).' },
  { key: 'composite_score', label: 'Composite score', status: 'SUPPORTED', note: 'Weighted composite of sub-scores (computeScore composite model).' },
  { key: 'percentage', label: 'Percentage', status: 'SUPPORTED', note: 'obtained/maximum × 100 (computeScore percentage model).' },
  { key: 'domain_score', label: 'Domain score', status: 'SUPPORTED', note: 'Per-domain aggregate (dimension-scoring-engine + composite aggregation).' },
  { key: 'sub_domain_score', label: 'Sub-domain score', status: 'SUPPORTED', note: 'Per-sub-domain aggregate (dimension-scoring-engine nested groups).' },
  { key: 'competency_score', label: 'Competency score', status: 'SUPPORTED', note: 'Per-competency aggregate (competency-scoring + competency-ei-scoring-shared).' },
  { key: 'behaviour_score', label: 'Behaviour score', status: 'SUPPORTED', note: 'Behavioural indicator aggregate (behavioral-dimension-signals + CAPADEX runtime).' },
  { key: 'skill_score', label: 'Skill score', status: 'SUPPORTED', note: 'Per-skill aggregate (competency-skill-intelligence).' },
  { key: 'trait_score', label: 'Trait score', status: 'SUPPORTED', note: 'Trait indicator aggregate (behavioural-insights trait mapping). Standardized trait norms are Phase 3.6.' },
  { key: 'dimension_score', label: 'Dimension score', status: 'SUPPORTED', note: 'Per-dimension aggregate (dimension-scoring-engine + competency-ei-dimensions).' },
  { key: 'overall_score', label: 'Overall assessment score', status: 'SUPPORTED', note: 'Top-level composite of all model outputs (computeScore composite over domains).' },
];

// Response-processing modes (5) — how raw responses are prepared before scoring
export const RESPONSE_PROCESSING: CatalogItem[] = [
  { key: 'validate_responses', label: 'Validate responses', status: 'SUPPORTED', note: 'Type/range/option validation before scoring (validateResponses mechanism).' },
  { key: 'missing_response', label: 'Missing response handling', status: 'SUPPORTED', note: 'Missing answers scored per policy (skip/zero/impute-neutral) (validateResponses + computeScore policy).' },
  { key: 'null_response', label: 'Null response handling', status: 'SUPPORTED', note: 'Null/blank distinguished from 0 — null never coerced to a fabricated 0.' },
  { key: 'optional_question', label: 'Optional question handling', status: 'SUPPORTED', note: 'Optional items excluded from the denominator per rule.' },
  { key: 'incomplete_assessment', label: 'Incomplete assessment rules', status: 'SUPPORTED', note: 'Incomplete submissions scored partial / withheld per as_rules assessment rule.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface AsControl { key: string; label: string; status: AsStatus; evidence: string[] }

// Measurement types (9)
export const MEASUREMENT_TYPES: AsControl[] = [
  { key: 'competency', label: 'Competency measurement', status: 'SUPPORTED', evidence: ['services/competency-scoring.ts', 'services/competency-ei-scoring-shared.ts', 'as_measurements'] },
  { key: 'behaviour', label: 'Behaviour measurement', status: 'SUPPORTED', evidence: ['services/behavioral-dimension-signals.ts', 'services/assessment-scoring-mechanisms.ts', 'as_measurements'] },
  { key: 'skill', label: 'Skill measurement', status: 'SUPPORTED', evidence: ['services/competency-skill-intelligence.ts', 'as_measurements'] },
  { key: 'learning', label: 'Learning measurement', status: 'PARTIAL', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_measurements'] },
  { key: 'cognitive', label: 'Cognitive measurement', status: 'PARTIAL', evidence: ['services/caf/scoring-engine.ts', 'as_measurements'] },
  { key: 'aptitude', label: 'Aptitude measurement', status: 'SUPPORTED', evidence: ['services/caf/scoring-engine.ts', 'as_measurements'] },
  { key: 'personality', label: 'Personality measurement', status: 'PARTIAL', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_measurements'] },
  { key: 'employability', label: 'Employability measurement', status: 'SUPPORTED', evidence: ['services/employability-scoring-engine.ts', 'services/mei-scoring-engine.ts', 'as_measurements'] },
  { key: 'leadership', label: 'Leadership measurement', status: 'PARTIAL', evidence: ['services/competency-scoring.ts', 'as_measurements'] },
];

// Scoring rules (8)
export const SCORING_RULES: AsControl[] = [
  { key: 'positive_weight', label: 'Positive weight', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'negative_weight', label: 'Negative weight', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'partial_credit', label: 'Partial credit', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'bonus_marks', label: 'Bonus marks', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'penalty_marks', label: 'Penalty marks', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'mandatory_question', label: 'Mandatory question rules', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'section_rules', label: 'Section rules', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
  { key: 'assessment_rules', label: 'Assessment rules', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules'] },
];

// Scoring configuration (5)
export const SCORING_CONFIG: AsControl[] = [
  { key: 'formula_config', label: 'Formula configuration', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_formulas', 'as_score_configs'] },
  { key: 'weight_config', label: 'Weight configuration', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules', 'as_score_configs'] },
  { key: 'threshold_config', label: 'Threshold configuration', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_score_configs'] },
  { key: 'rule_config', label: 'Rule configuration', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_rules', 'as_score_configs'] },
  { key: 'versioning', label: 'Versioning', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_score_configs'] },
];

// Validation checks (4)
export const VALIDATION_CHECKS: AsControl[] = [
  { key: 'formula_validation', label: 'Formula validation', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_validations'] },
  { key: 'rule_validation', label: 'Rule validation', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_validations'] },
  { key: 'configuration_validation', label: 'Configuration validation', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_validations'] },
  { key: 'response_validation', label: 'Response validation', status: 'SUPPORTED', evidence: ['services/assessment-scoring-mechanisms.ts', 'as_validations'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING MODEL (10) — every assessment maps to the platform's canonical dimensions
// ─────────────────────────────────────────────────────────────────────────────
export interface MappingRow { key: string; label: string; target: string; source: string; status: AsStatus; note: string }
export const MAPPING_MODEL: MappingRow[] = [
  { key: 'authored_assessment', label: 'Authored assessment', target: 'Assessment Builder (3.3)', source: 'config/assessment-builder.ts', status: 'SUPPORTED', note: 'Scoring consumes the assessment authored by the 3.3 builder (author→score handoff).' },
  { key: 'delivered_response', label: 'Delivered response', target: 'Assessment Delivery (3.4)', source: 'services/assessment-delivery-mechanisms.ts', status: 'SUPPORTED', note: 'Scoring consumes candidate responses captured at delivery (deliver→score handoff).' },
  { key: 'scoring_model', label: 'Scoring model', target: 'Scoring Engine (this phase)', source: 'services/assessment-scoring-mechanisms.ts', status: 'SUPPORTED', note: 'Every assessment maps to one of the 13 canonical scoring models.' },
  { key: 'formula', label: 'Formula', target: 'Formula Engine (this phase)', source: 'as_formulas', status: 'SUPPORTED', note: 'Every scoring model resolves through a safe, versioned formula (no eval).' },
  { key: 'competency', label: 'Competency', target: 'Competency scoring', source: 'services/competency-scoring.ts', status: 'SUPPORTED', note: 'Assessment maps to competency scores via the existing competency engine.' },
  { key: 'behaviour', label: 'Behaviour', target: 'Behavioural signals', source: 'services/behavioral-dimension-signals.ts', status: 'SUPPORTED', note: 'Assessment maps to behaviour indicators via the existing signal engine.' },
  { key: 'skill', label: 'Skill', target: 'Skill intelligence', source: 'services/competency-skill-intelligence.ts', status: 'SUPPORTED', note: 'Assessment maps to skill scores via the existing skill engine.' },
  { key: 'dimension', label: 'Dimension', target: 'Dimension scoring', source: 'services/dimension-scoring-engine.ts', status: 'SUPPORTED', note: 'Assessment maps to dimension scores via the existing dimension engine.' },
  { key: 'product_blueprint', label: 'Product blueprint', target: 'Product blueprint', source: 'config/assessment-scoring.ts', status: 'SUPPORTED', note: 'Each scoring model is anchored to the product blueprint registry (this file).' },
  { key: 'psychometric_handoff', label: 'Psychometric handoff', target: 'Psychometric & Item Analysis (3.6)', source: 'config/assessment-scoring.ts', status: 'PARTIAL', note: 'Scoring ends at measurable scores/indicators; item analysis/reliability/validity/norms/standardization/benchmark/AI/reports are the Phase 3.6 scope (out of this engine).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEVEN certification DIMENSIONS — evidence anchored in REAL substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const AS_DIMENSIONS: AsDimension[] = [
  {
    key: 'measurement_engine', label: 'Measurement Engine', status: 'SUPPORTED',
    statusNote: 'ONE canonical measurement layer (as_measurements) composing the existing measurement engines (competency-scoring, dimension-scoring-engine, competency-ei-scoring-shared, mei/employability, caf) across competency/behaviour/skill/aptitude/employability. Standardized learning/cognitive/personality/leadership measurement (which requires norms/standardization) stays honestly PARTIAL — a Phase-3.6 boundary, not a gap.',
    evidence: {
      services: ['services/competency-scoring.ts', 'services/dimension-scoring-engine.ts', 'services/competency-ei-scoring-shared.ts', 'services/mei-scoring-engine.ts', 'services/employability-scoring-engine.ts', 'services/assessment-scoring-engine.ts', 'services/assessment-scoring-mechanisms.ts'],
      routes: ['routes/assessment-scoring.ts'],
      frontend: ['components/career/EIGauge.tsx', 'components/ResultsSummary.tsx'],
      tables: ['capadex_sessions', 'as_measurements', 'as_scores'],
    },
  },
  {
    key: 'scoring_engine', label: 'Scoring Engine', status: 'SUPPORTED',
    statusNote: 'ONE canonical scoring layer (as_scores) composing the existing scoring engines (competency-scoring, caf/scoring-engine, contextual-scoring-engine, omega-x-scoring) — 13 scoring models (raw/weighted/reverse/composite/percentage/domain/sub-domain/competency/behaviour/skill/trait/dimension/overall) over the pure computeScore mechanism. No duplicate scoring engine.',
    evidence: {
      services: ['services/competency-scoring.ts', 'services/caf/scoring-engine.ts', 'services/contextual-scoring-engine.ts', 'services/omega-x-scoring.ts', 'services/assessment-scoring-mechanisms.ts', 'services/assessment-scoring-engine.ts'],
      routes: ['routes/assessment-scoring.ts', 'routes/caf-runtime.ts', 'routes/dynamic-assessment-runtime.ts'],
      frontend: ['components/ResultsSummary.tsx', 'components/StudentParentTestResults.tsx'],
      tables: ['as_scores', 'as_score_configs', 'capadex_responses'],
    },
  },
  {
    key: 'formula_engine', label: 'Formula Engine', status: 'SUPPORTED',
    statusNote: 'Safe, configurable, versioned formula framework — structured formula AST (weighted-sum / composite / percentage / reverse), validated by validateFormula. NO eval / new Function; formulas persisted + versioned in as_formulas / as_score_configs.',
    evidence: {
      services: ['services/assessment-scoring-mechanisms.ts', 'services/assessment-scoring-engine.ts'],
      routes: ['routes/assessment-scoring.ts'],
      frontend: ['components/scoring/ScoringWorkbench.tsx', 'lib/engines/explainableScoringEngine.ts'],
      tables: ['as_formulas', 'as_score_configs'],
    },
  },
  {
    key: 'rule_engine', label: 'Rule Engine', status: 'SUPPORTED',
    statusNote: 'Positive/negative weight, partial credit, bonus/penalty marks, mandatory-question, section & assessment rules applied at score time over the as_rules overlay + validated by validateRule.',
    evidence: {
      services: ['services/assessment-scoring-mechanisms.ts'],
      routes: ['routes/assessment-scoring.ts'],
      frontend: ['components/scoring/ScoringWorkbench.tsx'],
      tables: ['as_rules', 'as_score_configs'],
    },
  },
  {
    key: 'validation', label: 'Validation', status: 'SUPPORTED',
    statusNote: 'Formula / rule / configuration / response validation via pure validate* mechanisms before scoring; validation runs recorded in as_validations. This is INPUT validation — NOT psychometric validity (which is Phase 3.6).',
    evidence: {
      services: ['services/assessment-scoring-mechanisms.ts'],
      routes: ['routes/assessment-scoring.ts'],
      frontend: ['components/scoring/ScoringWorkbench.tsx'],
      tables: ['as_validations'],
    },
  },
  {
    key: 'apis', label: 'Scoring APIs', status: 'SUPPORTED',
    statusNote: 'score / recalculate / validation / configuration endpoints under /api/admin/assessment-scoring, composing the existing runtime scoring routes.',
    evidence: {
      services: ['services/assessment-scoring-engine.ts'],
      routes: ['routes/assessment-scoring.ts', 'routes/caf-runtime.ts', 'routes/dynamic-assessment-runtime.ts', 'routes/adaptive-assessment.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Scoring Frontend', status: 'SUPPORTED',
    statusNote: 'Super-admin certification console + interactive scoring workbench (score-config / formula-mgmt / rule-mgmt / score-preview / validation-console) + reused score-display surfaces (ResultsSummary / EIGauge).',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/AssessmentScoringPanel.tsx', 'components/scoring/ScoringWorkbench.tsx', 'components/ResultsSummary.tsx', 'components/career/EIGauge.tsx', 'lib/engines/employabilityEngine.ts', 'lib/engines/explainableScoringEngine.ts', 'lib/behavioural-insights.ts'],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONS (freeze invariants)
// ─────────────────────────────────────────────────────────────────────────────
export interface AsDecision { id: string; title: string; decision: string }
export const AS_DECISIONS: AsDecision[] = [
  { id: 'AS-D1', title: 'No duplicate scoring engine', decision: 'ONE canonical scoring/measurement layer that COMPOSES the existing scoring services (competency-scoring, dimension-scoring-engine, caf/scoring-engine, mei/employability, contextual, omega-x) + an additive as_* overlay. No V2, no fork, no breaking change.' },
  { id: 'AS-D2', title: 'Safe formula evaluation', decision: 'Formulas are a STRUCTURED AST (weighted-sum/composite/percentage/reverse) evaluated by a pure interpreter — NEVER eval / new Function / string execution. validateFormula rejects unknown ops/vars before scoring.' },
  { id: 'AS-D3', title: 'Scope boundary (Phase 3.6)', decision: 'This engine transforms responses into measurable scores/indicators. It does NOT do psychometric item analysis, reliability, validity, norms, standardization, benchmarking, AI-interpretation, recommendations, or reports/analytics — that is Phase 3.6.' },
  { id: 'AS-D4', title: 'Axes never composited', decision: 'The SEVEN dimensions (measurement/scoring/formula/rule/validation/apis/frontend) are certified SEPARATELY. Coverage⟂Confidence⟂Adoption; null≠0; adoption is a usage axis, never a gap; nothing fabricated.' },
  { id: 'AS-D5', title: 'Byte-identical OFF incl. schema', decision: 'Everything is gated by the assessmentScoring flag. Cert GETs are read-only (to_regclass/fs probes); the as_* overlay DDL runs ONLY on the flag-gated mechanism write paths. OFF creates 0 tables.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN (genuine deferrals) + RESOLVED (engineering-closed via reuse-before-build)
// ─────────────────────────────────────────────────────────────────────────────
export interface AsGap { id: string; severity: GapSeverity; dimension: AsAxis; summary: string; mechanism?: string }

// There are 0 OPEN engineering gaps. The PARTIAL measurement types (learning/cognitive/personality/
// leadership) and the psychometric_handoff mapping row are Phase-3.6 SCOPE BOUNDARIES reported in-line,
// NOT gaps — closing them requires norms/standardization/psychometrics which is explicitly Phase 3.6.
export const AS_GAPS: AsGap[] = [];

export const RESOLVED_AS_GAPS: AsGap[] = [
  { id: 'GAP-AS-1', severity: 'High', dimension: 'scoring_engine', summary: 'Unified score computation across the 13 canonical scoring models (raw/weighted/reverse/composite/percentage/domain/…/overall).', mechanism: 'Pure computeScore mechanism reusing the existing scoring-engine math + additive as_scores overlay (reuse-before-build).' },
  { id: 'GAP-AS-2', severity: 'High', dimension: 'formula_engine', summary: 'Safe, configurable, versioned formula framework without string execution.', mechanism: 'Structured formula AST + validateFormula (NO eval/new Function) persisted/versioned in as_formulas/as_score_configs.' },
  { id: 'GAP-AS-3', severity: 'Medium', dimension: 'rule_engine', summary: '8 scoring rules (positive/negative weight, partial credit, bonus/penalty, mandatory/section/assessment).', mechanism: 'validateRule + rule application inside computeScore over the additive as_rules overlay.' },
  { id: 'GAP-AS-4', severity: 'Medium', dimension: 'measurement_engine', summary: 'Multi-type measurement layer (competency/behaviour/skill/aptitude/employability).', mechanism: 'Composes the existing competency/dimension/mei/employability/caf engines into the additive as_measurements overlay (existence-read, never invoked).' },
  { id: 'GAP-AS-5', severity: 'Medium', dimension: 'validation', summary: 'Formula/rule/configuration/response validation before scoring.', mechanism: 'Pure validateFormula/validateRule/validateConfig/validateResponses mechanisms + as_validations ledger.' },
  { id: 'GAP-AS-6', severity: 'Low', dimension: 'apis', summary: 'Unified score/recalculate/validation/configuration API surface + versioned config.', mechanism: 'Flag-gated /api/admin/assessment-scoring routes + as_score_configs overlay (reuse-before-build).' },
];
