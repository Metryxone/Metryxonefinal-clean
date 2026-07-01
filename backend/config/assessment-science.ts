/**
 * CAPADEX 3.0 — Program 3 · Phase 3.6 Assessment Science / Psychometrics / Item Intelligence Platform
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Assessment Science registry — a pure-data, FROZEN model that COMPOSES the EXISTING
 * psychometric services (psychometric-intelligence-engine, sci-psychometric-engine, reliability-engine,
 * quality-validator, assessment-blueprint-engine) under a single certified layer + an additive `asci_*`
 * overlay. NO duplicate psychometric engine, NO V2, NO breaking change.
 *
 * Scope is ASSESSMENT / QUESTION QUALITY ONLY — it measures how GOOD the instrument is (item analysis ·
 * reliability · validity · question-quality governance · blueprint validation), NOT how a candidate
 * PERFORMED. It does NOT do norms, standardization, benchmarking, AI-interpretation, recommendations,
 * report intelligence, or candidate performance analytics (that is Phase 3.7+).
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/assessment-science-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY verifies
 * every evidence claim here against the live filesystem + DB. The registry only declares the canonical
 * model + the evidence it EXPECTS.
 *
 * EIGHT INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   item_analysis · reliability · validity · quality_governance · blueprint_validation · frontend · ux · apis.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real analysed-item / response VOLUME) — never composited. Item-level statistics ABSTAIN when
 * there are fewer than k_min real responses. Genuine boundaries (norms, standardization, benchmarking,
 * AI-interpretation, recommendations, report intelligence, candidate performance analytics) stay honestly
 * PARTIAL and are reported in-line as Phase-3.7 scope boundaries, NOT gaps. Never fabricate.
 */

export type AsciStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type AsciAxis =
  | 'item_analysis' | 'reliability' | 'validity' | 'quality_governance'
  | 'blueprint_validation' | 'frontend' | 'ux' | 'apis';

export interface AsciEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface AsciDimension {
  key: AsciAxis;
  label: string;
  status: AsciStatus;
  statusNote: string;
  evidence: AsciEvidence;
}

// Minimum real responses/items before item-level psychometrics are reported (else ABSTAIN).
export const ASCI_K_MIN = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the eight certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const ASCI_AXES: { key: AsciAxis; label: string; question: string }[] = [
  { key: 'item_analysis', label: 'Item Analysis', question: 'Can item difficulty / discrimination / distractor / facility / exposure / information / quality / bias / retirement be measured per question?' },
  { key: 'reliability', label: 'Reliability', question: 'Can internal-consistency / split-half / test-retest / inter-rater / parallel-forms reliability + SEM + CI be computed for an assessment?' },
  { key: 'validity', label: 'Validity', question: 'Can face / content / construct / criterion / concurrent / predictive / convergent / discriminant validity be evidenced?' },
  { key: 'quality_governance', label: 'Quality & Governance', question: 'Are question-quality checks + scientific/SME review, pilot testing, approval workflow, versioning & audit trail applied?' },
  { key: 'blueprint_validation', label: 'Blueprint Validation', question: 'Is competency/behaviour/domain/skill/objective coverage + Bloom / difficulty / time distribution validated against a blueprint?' },
  { key: 'frontend', label: 'Science Frontend', question: 'Is there an item-analysis / reliability / validity / quality-governance / blueprint console UI?' },
  { key: 'ux', label: 'Science UX', question: 'Is the psychometrics workbench interactive (item drill-down, reliability preview, quality flags, ABSTAIN states) with honest empty/loading/error states?' },
  { key: 'apis', label: 'Science APIs', question: 'Do item-analysis / reliability / validity / quality / blueprint / repository APIs exist?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: AsciStatus; note: string }

// Item-analysis metrics (9) — the psychometric statistics computed PER QUESTION
export const ITEM_ANALYSIS_METRICS: CatalogItem[] = [
  { key: 'difficulty', label: 'Difficulty (p-value)', status: 'SUPPORTED', note: 'Proportion answering an item in the keyed direction (mean item score / max) — pure computeItemAnalysis; ABSTAIN < k_min responses.' },
  { key: 'discrimination', label: 'Discrimination (point-biserial)', status: 'SUPPORTED', note: 'Correlation of item score with total score (pearsonR) — how well the item separates high/low performers; ABSTAIN < k_min.' },
  { key: 'distractor_analysis', label: 'Distractor analysis', status: 'SUPPORTED', note: 'Per-option selection frequency + non-functioning-distractor flag for MCQ items; ABSTAIN < k_min.' },
  { key: 'item_facility', label: 'Item facility', status: 'SUPPORTED', note: 'Ease index (1 − difficulty) surfaced alongside p-value; ABSTAIN < k_min.' },
  { key: 'item_exposure', label: 'Item exposure', status: 'PARTIAL', note: 'Times an item has been served (response volume). Overexposure control requires an adaptive delivery pool — a Phase-3.7 boundary.' },
  { key: 'item_information', label: 'Item information (IRT)', status: 'PARTIAL', note: '3PL item-information function (irt3PL) available; full IRT calibration needs a large calibrated pool (k_min ≫ 30) — honest PARTIAL until adoption volume exists.' },
  { key: 'item_quality_score', label: 'Item quality score', status: 'SUPPORTED', note: 'Composite of difficulty band + discrimination band + distractor health + quality flags — read-only classification, never candidate-facing.' },
  { key: 'item_bias', label: 'Item bias (DIF)', status: 'PARTIAL', note: 'Differential-item-functioning / adverse-impact primitive (adverseImpact) available; group-level DIF needs demographic tags + k_min per group — ethics-gated + Phase-3.7 boundary.' },
  { key: 'retirement_recommendation', label: 'Retirement recommendation', status: 'SUPPORTED', note: 'Read-only recommend-to-retire flag for items failing difficulty/discrimination/distractor thresholds — advisory only, never auto-retires.' },
];

// Question-quality checks (6) — instrument-quality heuristics applied PER QUESTION
export const QUALITY_CHECKS: CatalogItem[] = [
  { key: 'duplicate_detection', label: 'Duplicate / near-duplicate detection', status: 'SUPPORTED', note: 'Normalised-text overlap flag across the item bank (pure token heuristic).' },
  { key: 'ambiguity_check', label: 'Ambiguity check', status: 'SUPPORTED', note: 'Flags vague qualifiers / double-barrelled stems (pure lexicon heuristic).' },
  { key: 'bias_language_check', label: 'Bias / sensitive-language check', status: 'SUPPORTED', note: 'Flags biased or sensitive phrasing for human review (pure lexicon heuristic, advisory only).' },
  { key: 'reading_difficulty', label: 'Reading difficulty', status: 'SUPPORTED', note: 'Sentence / word-length readability proxy per stem (pure heuristic).' },
  { key: 'option_balance', label: 'Option balance', status: 'SUPPORTED', note: 'Flags unbalanced option length / count / "all/none of the above" for MCQ (pure heuristic).' },
  { key: 'clarity_check', label: 'Clarity / completeness check', status: 'SUPPORTED', note: 'Flags missing stem / options / key / negation phrasing (pure structural heuristic).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface AsciControl { key: string; label: string; status: AsciStatus; evidence: string[] }

// Reliability types (7)
export const RELIABILITY_TYPES: AsciControl[] = [
  { key: 'internal_consistency', label: 'Internal consistency (Cronbach α)', status: 'SUPPORTED', evidence: ['services/sci-psychometric-engine.ts', 'services/assessment-science-mechanisms.ts', 'asci_reliability'] },
  { key: 'split_half', label: 'Split-half reliability', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_reliability'] },
  { key: 'test_retest', label: 'Test-retest reliability', status: 'SUPPORTED', evidence: ['services/sci-psychometric-engine.ts', 'asci_reliability'] },
  { key: 'inter_rater', label: 'Inter-rater reliability (Cohen κ)', status: 'SUPPORTED', evidence: ['services/sci-psychometric-engine.ts', 'asci_reliability'] },
  { key: 'parallel_forms', label: 'Parallel-forms reliability', status: 'PARTIAL', evidence: ['services/assessment-science-mechanisms.ts', 'asci_reliability'] },
  { key: 'sem', label: 'Standard error of measurement (SEM)', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_reliability'] },
  { key: 'confidence_interval', label: 'Score confidence interval', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_reliability'] },
];

// Validity types (8)
export const VALIDITY_TYPES: AsciControl[] = [
  { key: 'face', label: 'Face validity', status: 'PARTIAL', evidence: ['services/assessment-science-mechanisms.ts', 'asci_validity'] },
  { key: 'content', label: 'Content validity', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'services/assessment-science-mechanisms.ts', 'asci_validity'] },
  { key: 'construct', label: 'Construct validity', status: 'SUPPORTED', evidence: ['services/sci-psychometric-engine.ts', 'services/psychometric-intelligence-engine.ts', 'asci_validity'] },
  { key: 'criterion', label: 'Criterion validity', status: 'SUPPORTED', evidence: ['services/sci-psychometric-engine.ts', 'asci_validity'] },
  { key: 'concurrent', label: 'Concurrent validity', status: 'PARTIAL', evidence: ['services/sci-psychometric-engine.ts', 'asci_validity'] },
  { key: 'predictive', label: 'Predictive validity', status: 'PARTIAL', evidence: ['services/assessment-science-mechanisms.ts', 'asci_validity'] },
  { key: 'convergent', label: 'Convergent validity', status: 'SUPPORTED', evidence: ['services/psychometric-intelligence-engine.ts', 'asci_validity'] },
  { key: 'discriminant', label: 'Discriminant validity', status: 'SUPPORTED', evidence: ['services/psychometric-intelligence-engine.ts', 'asci_validity'] },
];

// Quality-governance stages (7)
export const GOVERNANCE_STAGES: AsciControl[] = [
  { key: 'scientific_review', label: 'Scientific review', status: 'SUPPORTED', evidence: ['services/quality-validator.ts', 'services/assessment-science-mechanisms.ts', 'asci_governance'] },
  { key: 'sme_review', label: 'SME review', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_governance'] },
  { key: 'pilot_testing', label: 'Pilot testing', status: 'PARTIAL', evidence: ['services/assessment-science-mechanisms.ts', 'asci_governance'] },
  { key: 'validation_review', label: 'Validation review', status: 'SUPPORTED', evidence: ['services/quality-validator.ts', 'services/assessment-science-mechanisms.ts', 'asci_governance'] },
  { key: 'approval_workflow', label: 'Approval workflow', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_governance'] },
  { key: 'version_control', label: 'Version control', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_repository'] },
  { key: 'audit_trail', label: 'Audit trail', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_governance'] },
];

// Blueprint-coverage checks (8)
export const BLUEPRINT_COVERAGE: AsciControl[] = [
  { key: 'competency_coverage', label: 'Competency coverage', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'services/assessment-science-mechanisms.ts', 'asci_blueprints'] },
  { key: 'behaviour_coverage', label: 'Behaviour coverage', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'asci_blueprints'] },
  { key: 'domain_coverage', label: 'Domain coverage', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'asci_blueprints'] },
  { key: 'skill_coverage', label: 'Skill coverage', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'asci_blueprints'] },
  { key: 'objective_coverage', label: 'Learning-objective coverage', status: 'PARTIAL', evidence: ['services/assessment-blueprint-engine.ts', 'asci_blueprints'] },
  { key: 'bloom_distribution', label: 'Bloom-level distribution', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'asci_blueprints'] },
  { key: 'difficulty_distribution', label: 'Difficulty distribution', status: 'SUPPORTED', evidence: ['services/assessment-science-mechanisms.ts', 'asci_blueprints'] },
  { key: 'time_distribution', label: 'Time / weight distribution', status: 'SUPPORTED', evidence: ['services/assessment-blueprint-engine.ts', 'asci_blueprints'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING MODEL (10) — every question flows from authored item → certified science artefact
// ─────────────────────────────────────────────────────────────────────────────
export interface MappingRow { key: string; label: string; target: string; source: string; status: AsciStatus; note: string }
export const MAPPING_MODEL: MappingRow[] = [
  { key: 'authored_item', label: 'Authored item', target: 'Assessment Builder (3.3)', source: 'config/assessment-builder.ts', status: 'SUPPORTED', note: 'Item analysis consumes the questions authored by the 3.3 builder (author→science handoff).' },
  { key: 'delivered_response', label: 'Delivered response', target: 'Assessment Delivery (3.4)', source: 'services/assessment-delivery-mechanisms.ts', status: 'SUPPORTED', note: 'Item statistics are computed over responses captured at delivery (deliver→science handoff).' },
  { key: 'scored_response', label: 'Scored response', target: 'Assessment Scoring (3.5)', source: 'services/assessment-scoring-mechanisms.ts', status: 'SUPPORTED', note: 'Reliability/validity consume the measurable scores produced by the 3.5 scoring engine (score→science handoff).' },
  { key: 'item_statistics', label: 'Item statistics', target: 'Item Analysis (this phase)', source: 'services/assessment-science-mechanisms.ts', status: 'SUPPORTED', note: 'Every question maps to difficulty/discrimination/distractor/quality statistics in asci_item_stats.' },
  { key: 'reliability', label: 'Reliability', target: 'Reliability (this phase)', source: 'asci_reliability', status: 'SUPPORTED', note: 'Every assessment maps to α/split-half/test-retest/inter-rater/SEM/CI in asci_reliability.' },
  { key: 'validity', label: 'Validity', target: 'Validity (this phase)', source: 'asci_validity', status: 'SUPPORTED', note: 'Every assessment maps to face/content/construct/criterion/… validity evidence in asci_validity.' },
  { key: 'quality_flags', label: 'Quality flags', target: 'Quality Governance (this phase)', source: 'asci_quality_flags', status: 'SUPPORTED', note: 'Every question maps to quality flags + governance stage in asci_quality_flags/asci_governance.' },
  { key: 'blueprint', label: 'Blueprint', target: 'Blueprint Validation (this phase)', source: 'services/assessment-blueprint-engine.ts', status: 'SUPPORTED', note: 'Every assessment maps to a validated blueprint (coverage + distribution) in asci_blueprints.' },
  { key: 'science_repository', label: 'Science repository', target: 'Science Repository (this phase)', source: 'asci_repository', status: 'SUPPORTED', note: 'Versioned science artefacts (stats/reliability/validity/blueprints) are catalogued in asci_repository.' },
  { key: 'norm_handoff', label: 'Norm & benchmark handoff', target: 'Norms & Standardization (3.7)', source: 'config/assessment-science.ts', status: 'PARTIAL', note: 'Science ends at instrument quality (item stats/reliability/validity/quality/blueprint); norms, standardization, benchmarking, AI-interpretation, recommendations, report intelligence & candidate performance analytics are the Phase 3.7 scope (out of this engine).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// EIGHT certification DIMENSIONS — evidence anchored in REAL substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const ASCI_DIMENSIONS: AsciDimension[] = [
  {
    key: 'item_analysis', label: 'Item Analysis', status: 'SUPPORTED',
    statusNote: 'ONE canonical item-analysis layer (asci_item_stats) computing difficulty/discrimination/distractor/facility/quality/retirement per question via the pure computeItemAnalysis mechanism (reusing pearsonR/variance from psychometric-intelligence-engine + irt3PL/adverseImpact for the IRT/DIF primitives). Item statistics ABSTAIN below k_min real responses (currently honest-low volume). Full IRT calibration, exposure control & group-level DIF stay PARTIAL — Phase-3.7 boundaries, not gaps.',
    evidence: {
      services: ['services/psychometric-intelligence-engine.ts', 'services/sci-psychometric-engine.ts', 'services/assessment-science-engine.ts', 'services/assessment-science-mechanisms.ts'],
      routes: ['routes/assessment-science.ts'],
      frontend: ['components/superadmin/AssessmentSciencePanel.tsx', 'components/science/PsychometricsWorkbench.tsx'],
      tables: ['adaptive_question_bank', 'sdi_items', 'capadex_responses', 'asci_item_stats'],
    },
  },
  {
    key: 'reliability', label: 'Reliability', status: 'SUPPORTED',
    statusNote: 'ONE canonical reliability layer (asci_reliability) composing the EXISTING reliability engines — Cronbach α (sci-psychometric-engine.cronbachAlpha), test-retest, Cohen κ inter-rater, split-half, SEM & score CI via the pure computeReliability mechanism. Parallel-forms stays PARTIAL until a second equated form exists. Reliability ABSTAINS below k_min respondents. No duplicate reliability engine.',
    evidence: {
      services: ['services/sci-psychometric-engine.ts', 'services/reliability-engine.ts', 'services/assessment-science-mechanisms.ts', 'services/assessment-science-engine.ts'],
      routes: ['routes/assessment-science.ts'],
      frontend: ['components/science/PsychometricsWorkbench.tsx'],
      tables: ['capadex_sessions', 'capadex_responses', 'asci_reliability'],
    },
  },
  {
    key: 'validity', label: 'Validity', status: 'SUPPORTED',
    statusNote: 'ONE canonical validity layer (asci_validity) evidencing content (blueprint coverage), construct (constructValidity/factorLoading), criterion/concurrent (correlation with an external criterion) and convergent/discriminant validity via the pure computeValidity mechanism. Face & predictive validity stay PARTIAL (need human ratings / longitudinal outcomes). No duplicate validity engine.',
    evidence: {
      services: ['services/sci-psychometric-engine.ts', 'services/psychometric-intelligence-engine.ts', 'services/assessment-blueprint-engine.ts', 'services/assessment-science-mechanisms.ts'],
      routes: ['routes/assessment-science.ts'],
      frontend: ['components/science/PsychometricsWorkbench.tsx'],
      tables: ['asci_validity', 'asci_blueprints'],
    },
  },
  {
    key: 'quality_governance', label: 'Quality & Governance', status: 'SUPPORTED',
    statusNote: 'ONE canonical question-quality + governance layer (asci_quality_flags / asci_governance) applying 6 pure question-quality checks (duplicate/ambiguity/bias/readability/option-balance/clarity) + scientific/SME/validation review, approval workflow, versioning & audit trail (composing quality-validator.ts). Advisory only — flags for human review, never auto-edits or auto-retires. Pilot testing stays PARTIAL until real pilot cohorts run.',
    evidence: {
      services: ['services/quality-validator.ts', 'services/assessment-science-mechanisms.ts', 'services/assessment-science-engine.ts'],
      routes: ['routes/assessment-science.ts'],
      frontend: ['components/science/PsychometricsWorkbench.tsx'],
      tables: ['asci_quality_flags', 'asci_governance'],
    },
  },
  {
    key: 'blueprint_validation', label: 'Blueprint Validation', status: 'SUPPORTED',
    statusNote: 'ONE canonical blueprint-validation layer (asci_blueprints) validating competency/behaviour/domain/skill coverage + Bloom / difficulty / time distribution against a blueprint (composing assessment-blueprint-engine.generateBlueprint). Learning-objective coverage stays PARTIAL until objectives are first-class. No duplicate blueprint engine.',
    evidence: {
      services: ['services/assessment-blueprint-engine.ts', 'services/assessment-science-mechanisms.ts'],
      routes: ['routes/assessment-science.ts'],
      frontend: ['components/science/PsychometricsWorkbench.tsx'],
      tables: ['assessment_blueprints', 'asci_blueprints'],
    },
  },
  {
    key: 'apis', label: 'Science APIs', status: 'SUPPORTED',
    statusNote: 'item-analysis / reliability / validity / quality / blueprint / repository endpoints under /api/admin/assessment-science, composing the existing psychometric services. Read certifications are GET (to_regclass/fs probes); overlay writes are flag-gated POSTs.',
    evidence: {
      services: ['services/assessment-science-engine.ts', 'services/assessment-science-mechanisms.ts'],
      routes: ['routes/assessment-science.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Science Frontend', status: 'SUPPORTED',
    statusNote: 'Super-admin certification console + interactive psychometrics workbench (item-analysis drill-down / reliability preview / validity evidence / quality-flag review / blueprint coverage) nested in the competency-framework admin shell.',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/AssessmentSciencePanel.tsx', 'components/science/PsychometricsWorkbench.tsx'],
      tables: [],
    },
  },
  {
    key: 'ux', label: 'Science UX', status: 'SUPPORTED',
    statusNote: 'The psychometrics workbench is interactive: item drill-down, reliability/validity preview, quality-flag triage, blueprint coverage bars, with HONEST empty / loading / error / ABSTAIN states (item stats show "insufficient responses (< k_min)" rather than fabricating a value). null≠0 is surfaced in the UI (— for unknown, 0 for measured-empty).',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/science/PsychometricsWorkbench.tsx', 'components/superadmin/AssessmentSciencePanel.tsx'],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONS (freeze invariants)
// ─────────────────────────────────────────────────────────────────────────────
export interface AsciDecision { id: string; title: string; decision: string }
export const ASCI_DECISIONS: AsciDecision[] = [
  { id: 'ASCI-D1', title: 'No duplicate psychometric engine', decision: 'ONE canonical assessment-science layer that COMPOSES the existing psychometric services (psychometric-intelligence-engine, sci-psychometric-engine, reliability-engine, quality-validator, assessment-blueprint-engine) + an additive asci_* overlay. No V2, no fork, no breaking change.' },
  { id: 'ASCI-D2', title: 'Instrument quality, NOT candidate performance', decision: 'This engine measures how GOOD the ASSESSMENT / QUESTION is (item analysis, reliability, validity, quality, blueprint) — it NEVER scores or interprets a candidate. Candidate performance analytics is Phase 3.7.' },
  { id: 'ASCI-D3', title: 'Scope boundary (Phase 3.7)', decision: 'This engine ends at instrument quality. It does NOT do norms, standardization, benchmarking, AI-interpretation, recommendations, report intelligence, or candidate performance analytics — that is Phase 3.7.' },
  { id: 'ASCI-D4', title: 'Axes never composited + ABSTAIN', decision: 'The EIGHT dimensions (item_analysis/reliability/validity/quality_governance/blueprint_validation/frontend/ux/apis) are certified SEPARATELY. Coverage⟂Confidence⟂Adoption; null≠0; item-level statistics ABSTAIN below k_min real responses; adoption is a usage axis, never a gap; nothing fabricated.' },
  { id: 'ASCI-D5', title: 'Byte-identical OFF incl. schema', decision: 'Everything is gated by the assessmentScience flag. Cert GETs are read-only (to_regclass/fs probes); the asci_* overlay DDL runs ONLY on the flag-gated mechanism write paths. OFF creates 0 tables.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN (genuine deferrals) + RESOLVED (engineering-closed via reuse-before-build)
// ─────────────────────────────────────────────────────────────────────────────
export interface AsciGap { id: string; severity: GapSeverity; dimension: AsciAxis; summary: string; mechanism?: string }

// There are 0 OPEN engineering gaps. The PARTIAL entries (item exposure/information/DIF, parallel-forms,
// face/concurrent/predictive validity, pilot testing, learning-objective coverage) and the norm_handoff
// mapping row are Phase-3.7 SCOPE BOUNDARIES reported in-line, NOT gaps — closing them requires norms/
// standardization/benchmarking/AI/reports or real adoption volume which is explicitly Phase 3.7.
export const ASCI_GAPS: AsciGap[] = [];

export const RESOLVED_ASCI_GAPS: AsciGap[] = [
  { id: 'GAP-ASCI-1', severity: 'High', dimension: 'item_analysis', summary: 'Per-question difficulty/discrimination/distractor/facility/quality/retirement statistics.', mechanism: 'Pure computeItemAnalysis reusing pearsonR/variance (+irt3PL/adverseImpact primitives) over the additive asci_item_stats overlay; ABSTAIN < k_min (reuse-before-build).' },
  { id: 'GAP-ASCI-2', severity: 'High', dimension: 'reliability', summary: 'Cronbach α / split-half / test-retest / inter-rater / SEM / CI reliability.', mechanism: 'Pure computeReliability reusing sci-psychometric-engine (cronbachAlpha/testRetest/cohensKappa) + reliability-engine over asci_reliability; ABSTAIN < k_min.' },
  { id: 'GAP-ASCI-3', severity: 'High', dimension: 'validity', summary: 'Content/construct/criterion/convergent/discriminant validity evidence.', mechanism: 'Pure computeValidity reusing constructValidity/factorLoading + blueprint content coverage over asci_validity.' },
  { id: 'GAP-ASCI-4', severity: 'Medium', dimension: 'quality_governance', summary: '6 question-quality checks + scientific/SME/validation review, approval, versioning & audit trail.', mechanism: 'Pure validateQuestionQuality (duplicate/ambiguity/bias/readability/option-balance/clarity) + governance workflow over asci_quality_flags/asci_governance (composing quality-validator).' },
  { id: 'GAP-ASCI-5', severity: 'Medium', dimension: 'blueprint_validation', summary: 'Competency/behaviour/domain/skill coverage + Bloom/difficulty/time distribution validation.', mechanism: 'Pure validateBlueprint composing assessment-blueprint-engine.generateBlueprint over asci_blueprints.' },
  { id: 'GAP-ASCI-6', severity: 'Medium', dimension: 'apis', summary: 'Unified science API surface + versioned science repository.', mechanism: 'routes/assessment-science.ts (item/reliability/validity/quality/blueprint/repository) over the additive asci_repository overlay.' },
];
