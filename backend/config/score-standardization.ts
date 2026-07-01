/**
 * CAPADEX 3.0 — Program 3 · Phase 3.8 Enterprise Score Standardization & Interpretation Framework
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Score Standardization platform — converts a RAW assessment score into a
 * STANDARDIZED, interpretable, reusable, explainable score. It COMPOSES the EXISTING psychometric
 * substrate (services/psychometric-standardization.ts: zFromValue/zToPercentile/zToT/zToStanine/
 * zToSten/zToDeviationScore + normal CDF) under a single certified layer and adds an additive `astd_*`
 * overlay for versioned formulas, performance bands, interpretation rules, scoped standardization
 * configuration, governance (draft→…→retire + version history + rollback + audit trail) and validation.
 * NO duplicate engine, NO V2, NO breaking change.
 *
 * Scope is STANDARDIZATION & INTERPRETATION only. It sits DOWNSTREAM of scoring (3.5) + science (3.6)
 * + norm engine (3.7): it consumes measurable scores + a norm reference and turns them into standard
 * scores (percentile/z/T/stanine/sten/deviation/composite/domain/competency/behaviour/skill/overall),
 * performance bands, and deterministic interpretation-rule verdicts. It NEVER re-scores, NEVER
 * re-validates the instrument, NEVER builds a norm.
 *
 * OUT OF SCOPE (DO NOT IMPLEMENT here — later phases own these): Benchmark Engine, AI Interpretation,
 * Recommendation Engine, Report Generation, Dashboard Intelligence, Candidate Analytics.
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/score-standardization-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY
 * verifies every evidence claim here against the live filesystem + DB. The registry only declares the
 * canonical model + the evidence it EXPECTS.
 *
 * TEN INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   standardization · formula · interpretation · governance · super_admin · frontend · ux · apis ·
 *   testing · documentation.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real standardized / interpreted VOLUME) — never composited. Norm-referenced
 * standardization ABSTAINS when there are fewer than k_min real members in the reference group.
 * Formulas are a STRUCTURED AST (no eval / no new Function). Never fabricate.
 */

export type StdStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type StdAxis =
  | 'standardization' | 'formula' | 'interpretation' | 'governance' | 'super_admin'
  | 'frontend' | 'ux' | 'apis' | 'testing' | 'documentation';

export interface StdEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface StdDimension {
  key: StdAxis;
  label: string;
  status: StdStatus;
  statusNote: string;
  evidence: StdEvidence;
}

// Minimum real members in a reference group before norm-referenced standardization is reported
// (else ABSTAIN). Mirrors the k-anonymity floor used across the platform.
export const STD_K_MIN = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the ten certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const STD_AXES: { key: StdAxis; label: string; question: string }[] = [
  { key: 'standardization', label: 'Standard Score Engine', question: 'Can a raw score be standardized (percentile / z / T / stanine / sten / deviation / composite / domain / competency / behaviour / skill / overall)?' },
  { key: 'formula', label: 'Formula Engine', question: 'Are standardization formulas defined as a structured, versioned AST (no eval) that can be validated and safely evaluated?' },
  { key: 'interpretation', label: 'Interpretation Rule Engine', question: 'Is there a rule repository that deterministically interprets a standardized score into band / risk / development-priority / readiness verdicts?' },
  { key: 'governance', label: 'Governance', question: 'Do formulas / bands / rules / configs move through draft→review→validate→approve→publish→archive→retire with version history, rollback and an audit trail?' },
  { key: 'super_admin', label: 'Super Admin', question: 'Is there a super-admin console (standardization config / rule manager / band config / formula config / version control / org overrides / approval / audit)?' },
  { key: 'frontend', label: 'Frontend', question: 'Is there a standardization console / formula builder / rule builder / band builder / distribution viewer / percentile explorer / version manager / validation dashboard / preview / comparison UI?' },
  { key: 'ux', label: 'UX', question: 'Does the UX support interactive builders / live preview / distribution & bell-curve viz / drill-down / export / progressive disclosure / responsive / accessible surfaces?' },
  { key: 'apis', label: 'APIs', question: 'Do standardization / transformation / interpretation / configuration / version / validation APIs exist?' },
  { key: 'testing', label: 'Testing', question: 'Is there a testing suite (unit / integration / API) covering standardization transforms, formula evaluation, band classification and interpretation rules?' },
  { key: 'documentation', label: 'Documentation', question: 'Is there a documentation set (architecture / formula / interpretation / API / admin / release notes)?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: StdStatus; note: string }

// Standard-score types (12) — the standardized transforms of a raw score
export const STANDARD_SCORE_TYPES: CatalogItem[] = [
  { key: 'percentile', label: 'Percentile rank', status: 'SUPPORTED', note: 'zToPercentile — proportion of the reference distribution below the score (normal CDF).' },
  { key: 'z_score', label: 'z-score', status: 'SUPPORTED', note: 'zFromValue — standardized deviation from the reference mean in SD units.' },
  { key: 't_score', label: 'T-score (μ=50, σ=10)', status: 'SUPPORTED', note: 'zToT — linear rescale of z to the T metric.' },
  { key: 'standard_score', label: 'Standard score (μ=100, σ=15)', status: 'SUPPORTED', note: 'zToDeviationScore — deviation-quotient / standard-score metric.' },
  { key: 'stanine', label: 'Stanine (1–9)', status: 'SUPPORTED', note: 'zToStanine + stanineBand — nine-point standard-nine band.' },
  { key: 'sten', label: 'Sten (1–10)', status: 'SUPPORTED', note: 'zToSten — ten-point standard band.' },
  { key: 'composite', label: 'Composite score', status: 'SUPPORTED', note: 'Weighted composite of dimension standard scores via a structured AST formula (evaluateFormula).' },
  { key: 'domain', label: 'Domain score', status: 'SUPPORTED', note: 'Per-domain standardized score composed from the standardized dimension set.' },
  { key: 'competency', label: 'Competency score', status: 'SUPPORTED', note: 'Per-competency standardized score composed from the standardized dimension set.' },
  { key: 'behaviour', label: 'Behaviour score', status: 'SUPPORTED', note: 'Per-behaviour standardized score composed from the standardized dimension set.' },
  { key: 'skill', label: 'Skill score', status: 'SUPPORTED', note: 'Per-skill standardized score composed from the standardized dimension set.' },
  { key: 'overall', label: 'Overall standardized score', status: 'SUPPORTED', note: 'Overall standardized score composed via the configured composite formula.' },
];

// Performance bands (8 canonical + custom) — the qualitative band a standardized score falls into
export const PERFORMANCE_BANDS: CatalogItem[] = [
  { key: 'outstanding', label: 'Outstanding', status: 'SUPPORTED', note: 'Top canonical band (percentile ≥ 98 by default) — boundaries are config-driven, not hard-coded at runtime.' },
  { key: 'excellent', label: 'Excellent', status: 'SUPPORTED', note: 'Percentile ≥ 90 by default.' },
  { key: 'strong', label: 'Strong', status: 'SUPPORTED', note: 'Percentile ≥ 75 by default.' },
  { key: 'above_average', label: 'Above average', status: 'SUPPORTED', note: 'Percentile ≥ 60 by default.' },
  { key: 'average', label: 'Average', status: 'SUPPORTED', note: 'Percentile ≥ 40 by default.' },
  { key: 'developing', label: 'Developing', status: 'SUPPORTED', note: 'Percentile ≥ 25 by default.' },
  { key: 'needs_improvement', label: 'Needs improvement', status: 'SUPPORTED', note: 'Percentile ≥ 10 by default.' },
  { key: 'critical', label: 'Critical', status: 'SUPPORTED', note: 'Bottom canonical band (percentile < 10 by default).' },
  { key: 'custom', label: 'Custom organizational bands', status: 'SUPPORTED', note: 'Admin-defined band sets (astd_bands) are authored + versioned (saveBandSet) AND applied deterministically — classifyBand / computeHeatmap accept a custom band set, wired into POST /compute/band + /compute/heatmap + the workbench custom-band builder. Real populated custom band sets are an ADOPTION axis (honest 0), never a coverage gap.' },
];

// Interpretation rule types (9) — the verdicts a standardized score can be interpreted into
export const INTERPRETATION_RULE_TYPES: CatalogItem[] = [
  { key: 'score', label: 'Score interpretation', status: 'SUPPORTED', note: 'Overall standardized score → band verdict via the interpretation rule repository.' },
  { key: 'competency', label: 'Competency interpretation', status: 'SUPPORTED', note: 'Per-competency standardized score → band verdict.' },
  { key: 'behaviour', label: 'Behaviour interpretation', status: 'SUPPORTED', note: 'Per-behaviour standardized score → band verdict.' },
  { key: 'skill', label: 'Skill interpretation', status: 'SUPPORTED', note: 'Per-skill standardized score → band verdict.' },
  { key: 'dimension', label: 'Dimension interpretation', status: 'SUPPORTED', note: 'Per-dimension standardized score → band verdict.' },
  { key: 'overall', label: 'Overall interpretation', status: 'SUPPORTED', note: 'Composite / overall standardized score → band verdict.' },
  { key: 'risk_category', label: 'Risk category', status: 'SUPPORTED', note: 'Deterministic risk category derived from the standardized score band (low/moderate/high).' },
  { key: 'development_priority', label: 'Development priority', status: 'SUPPORTED', note: 'Deterministic development-priority verdict derived from the standardized score band.' },
  { key: 'readiness_category', label: 'Readiness category', status: 'SUPPORTED', note: 'Deterministic readiness category derived from the standardized score band (reuses readinessBand).' },
];

// Standardization configuration scopes (8)
export const STANDARDIZATION_CONFIG_SCOPES: CatalogItem[] = [
  { key: 'assessment', label: 'Assessment-specific', status: 'SUPPORTED', note: 'Per-assessment standardization config (formula / band set / rule set) keyed by assessment_slug.' },
  { key: 'persona', label: 'Persona-specific', status: 'SUPPORTED', note: 'Per-persona standardization config keyed by persona.' },
  { key: 'lifecycle', label: 'Lifecycle-specific', status: 'SUPPORTED', note: 'Per-lifecycle-stage standardization config keyed by canonical stage.' },
  { key: 'industry', label: 'Industry-specific', status: 'SUPPORTED', note: 'Industry-scoped config is stored (saveConfig scope=industry) AND resolved/applied deterministically via resolveConfig + CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve, most-specific-wins). Real populated industry configs are an ADOPTION axis (honest 0), never a coverage gap.' },
  { key: 'organization', label: 'Organization-specific', status: 'SUPPORTED', note: 'Organization override config is stored (saveConfig scope=organization) AND resolved via resolveConfig — organization has top precedence in CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated org overrides are an ADOPTION axis (honest 0), never a coverage gap.' },
  { key: 'country', label: 'Country-specific', status: 'SUPPORTED', note: 'Country-scoped config is stored (saveConfig scope=country) AND resolved via resolveConfig + CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated country configs are an ADOPTION axis (honest 0), never a coverage gap.' },
  { key: 'institution', label: 'Institution-specific', status: 'SUPPORTED', note: 'Institution-scoped config is stored (saveConfig scope=institution) AND resolved via resolveConfig — institution ranks just below organization in CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated institution configs are an ADOPTION axis (honest 0), never a coverage gap.' },
  { key: 'custom', label: 'Custom configuration', status: 'SUPPORTED', note: 'Fully custom scoped config (astd_configs.scope=custom) is stored (saveConfig) AND resolved via resolveConfig + CONFIG_SCOPE_PRECEDENCE (POST /configs/resolve). Real populated custom configs are an ADOPTION axis (honest 0), never a coverage gap.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface StdControl { key: string; label: string; status: StdStatus; evidence: string[] }

// Formula-engine capabilities (6)
export const FORMULA_CAPABILITIES: StdControl[] = [
  { key: 'structured_ast', label: 'Structured AST (no eval)', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_formulas'] },
  { key: 'versioned', label: 'Versioned formulas', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_formulas', 'astd_governance_log'] },
  { key: 'weighted_composite', label: 'Weighted composite', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_formulas'] },
  { key: 'safe_evaluation', label: 'Safe evaluation (whitelisted ops)', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts'] },
  { key: 'validation', label: 'Formula validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations'] },
  { key: 'preview', label: 'Live preview evaluation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'routes/score-standardization.ts'] },
];

// Governance states (10) — the lifecycle a standardization artefact moves through
export const GOVERNANCE_STATES: StdControl[] = [
  { key: 'draft', label: 'Draft', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'review', label: 'Review', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'validate', label: 'Validate', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations', 'astd_governance_log'] },
  { key: 'approve', label: 'Approve', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'publish', label: 'Publish', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'archive', label: 'Archive', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'retire', label: 'Retire', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'version_history', label: 'Version history', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'rollback', label: 'Rollback', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
  { key: 'audit_trail', label: 'Audit trail', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_governance_log'] },
];

// Validation checks (7)
export const VALIDATION_CHECKS: StdControl[] = [
  { key: 'formula', label: 'Formula validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations'] },
  { key: 'distribution', label: 'Distribution validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations'] },
  { key: 'range', label: 'Range validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations'] },
  { key: 'boundary', label: 'Boundary validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations'] },
  { key: 'statistical', label: 'Statistical validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'astd_validations'] },
  { key: 'regression', label: 'Regression validation', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts', 'routes/score-standardization.ts', 'astd_validations'] },
  { key: 'exception', label: 'Exception handling', status: 'SUPPORTED', evidence: ['services/score-standardization-mechanisms.ts'] },
];

// Super-admin surfaces (8)
export const SUPER_ADMIN_SURFACES: StdControl[] = [
  { key: 'standardization_config', label: 'Standardization configuration', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'rule_manager', label: 'Interpretation rule manager', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'band_config', label: 'Band configuration', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'formula_config', label: 'Formula configuration', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'version_control', label: 'Version control', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'org_overrides', label: 'Organization overrides', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx', 'routes/score-standardization.ts'] },
  { key: 'approval_workflow', label: 'Approval workflow', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'audit_console', label: 'Audit console', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
];

// Frontend surfaces (10)
export const FRONTEND_SURFACES: StdControl[] = [
  { key: 'standardization_console', label: 'Standardization console', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'formula_builder', label: 'Formula builder', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'rule_builder', label: 'Rule builder', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'band_builder', label: 'Band builder', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'distribution_viewer', label: 'Distribution viewer', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'percentile_explorer', label: 'Percentile explorer', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'version_manager', label: 'Version manager', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'validation_dashboard', label: 'Validation dashboard', status: 'SUPPORTED', evidence: ['components/superadmin/ScoreStandardizationPanel.tsx'] },
  { key: 'preview_screen', label: 'Preview screen', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'comparison_screen', label: 'Comparison screen', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx', 'routes/score-standardization.ts'] },
];

// UX criteria (12)
export const UX_CRITERIA: StdControl[] = [
  { key: 'interactive_formula_builder', label: 'Interactive formula builder', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'rule_composer', label: 'Rule composer', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'live_preview', label: 'Live preview', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'interactive_graphs', label: 'Interactive graphs', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'bell_curve', label: 'Bell-curve visualization', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'distribution_charts', label: 'Distribution charts', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'heat_maps', label: 'Heat maps', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx', 'routes/score-standardization.ts'] },
  { key: 'drill_down', label: 'Drill down', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'export', label: 'Export', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'progressive_disclosure', label: 'Progressive disclosure', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'responsive', label: 'Responsive design', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
  { key: 'accessibility', label: 'Accessibility', status: 'SUPPORTED', evidence: ['components/standardization/StandardizationWorkbench.tsx'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRACEABILITY MODEL (6) — every standardized score must trace back to its full provenance chain
// ─────────────────────────────────────────────────────────────────────────────
export interface TraceRow { key: string; label: string; source: string; status: StdStatus; note: string }
export const TRACEABILITY_MODEL: TraceRow[] = [
  { key: 'raw_score', label: 'Raw score', source: 'services/assessment-scoring-mechanisms.ts / scoring_runs', status: 'SUPPORTED', note: 'The measurable raw score produced by the 3.5 scoring engine — the standardization input.' },
  { key: 'assessment_version', label: 'Assessment version', source: 'astd_standard_scores.assessment_slug + detail.assessment_version', status: 'SUPPORTED', note: 'The assessment version the raw score was produced against — carried on every standard-score row.' },
  { key: 'formula_version', label: 'Formula version', source: 'astd_formulas.version + astd_standard_scores.formula_key/formula_version', status: 'SUPPORTED', note: 'The versioned formula (AST) used to standardize — carried on every standard-score row.' },
  { key: 'norm_version', label: 'Norm version', source: 'aint_norm_tables (3.7) + astd_standard_scores.norm_key', status: 'SUPPORTED', note: 'The norm reference (3.7 aint_norm_tables) the score was standardized against — carried on every standard-score row.' },
  { key: 'standardization_version', label: 'Standardization version', source: 'astd_configs.version + astd_standard_scores.config_key/config_version', status: 'SUPPORTED', note: 'The versioned standardization config (scope + band set + rule set) applied — carried on every standard-score row.' },
  { key: 'interpretation_rule', label: 'Interpretation rule', source: 'astd_interpretation_rules + astd_standard_scores.rule_key', status: 'SUPPORTED', note: 'The interpretation rule that produced the band / risk / readiness verdict — carried on every standard-score row.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEN certification DIMENSIONS — evidence anchored in REAL substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const STD_DIMENSIONS: StdDimension[] = [
  {
    key: 'standardization', label: 'Standard Score Engine', status: 'SUPPORTED',
    statusNote: 'ONE canonical standardization layer (astd_standard_scores) transforming a raw score into percentile / z / T / standard / stanine / sten standard scores + composite / domain / competency / behaviour / skill / overall scores by COMPOSING the pure psychometric-standardization functions (zFromValue/zToPercentile/zToT/zToStanine/zToSten/zToDeviationScore) and structured-AST composites. Pure transforms — no adoption dependency. Norm-referenced standardization ABSTAINS below k_min real members.',
    evidence: {
      services: ['services/psychometric-standardization.ts', 'services/score-standardization-mechanisms.ts', 'services/score-standardization-engine.ts'],
      routes: ['routes/score-standardization.ts'],
      frontend: ['components/standardization/StandardizationWorkbench.tsx'],
      tables: ['scoring_runs', 'astd_standard_scores'],
    },
  },
  {
    key: 'formula', label: 'Formula Engine', status: 'SUPPORTED',
    statusNote: 'ONE canonical formula engine (astd_formulas) defining standardization / composite formulas as a STRUCTURED AST (const / var / op(+,-,*,/) / weighted / clamp / standardize nodes — NO eval, NO new Function) that is versioned, validated (validateFormula) and safely evaluated (evaluateFormula) with live preview. Governed through the standardization lifecycle with version history + rollback.',
    evidence: {
      services: ['services/score-standardization-mechanisms.ts', 'services/score-standardization-engine.ts'],
      routes: ['routes/score-standardization.ts'],
      frontend: ['components/standardization/StandardizationWorkbench.tsx'],
      tables: ['astd_formulas', 'astd_governance_log'],
    },
  },
  {
    key: 'interpretation', label: 'Interpretation Rule Engine', status: 'SUPPORTED',
    statusNote: 'ONE canonical interpretation rule repository (astd_interpretation_rules) deterministically interpreting a standardized score into band / risk-category / development-priority / readiness verdicts across score / competency / behaviour / skill / dimension / overall rule types by COMPOSING classifyBand + readinessBand. Deterministic (no AI), governed, versioned.',
    evidence: {
      services: ['services/score-standardization-mechanisms.ts', 'services/score-standardization-engine.ts'],
      routes: ['routes/score-standardization.ts'],
      frontend: ['components/standardization/StandardizationWorkbench.tsx'],
      tables: ['astd_interpretation_rules', 'astd_bands'],
    },
  },
  {
    key: 'governance', label: 'Governance', status: 'SUPPORTED',
    statusNote: 'ONE canonical governance layer (astd_governance_log) moving every standardization artefact (formula / band set / rule / config) through draft→review→validate→approve→publish→archive→retire with append-only version history, rollback (restore a prior version) and a full audit trail. State transitions are recorded, never destructive.',
    evidence: {
      services: ['services/score-standardization-mechanisms.ts', 'services/score-standardization-engine.ts'],
      routes: ['routes/score-standardization.ts'],
      frontend: ['components/superadmin/ScoreStandardizationPanel.tsx'],
      tables: ['astd_governance_log', 'astd_formulas', 'astd_configs'],
    },
  },
  {
    key: 'super_admin', label: 'Super Admin', status: 'SUPPORTED',
    statusNote: 'Super-admin certification + management console (standardization configuration / interpretation rule manager / band configuration / formula configuration / version control / organization overrides / approval workflow / audit console) nested in the competency-framework admin shell. Organization overrides are wired (stored via saveConfig scope=organization, resolved via resolveConfig top-precedence, surfaced in the console) — real populated org override sets are an ADOPTION axis (honest 0), not a coverage gap.',
    evidence: {
      services: [],
      routes: ['routes/score-standardization.ts'],
      frontend: ['components/superadmin/ScoreStandardizationPanel.tsx'],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Frontend', status: 'SUPPORTED',
    statusNote: 'Interactive standardization workbench (formula builder / rule builder / band builder / distribution viewer / percentile explorer / preview) + super-admin console (standardization console / version manager / validation dashboard). Comparison is wired — a regression-diff card compares a baseline vs candidate formula/band set over reference samples via validateRegression (POST /compute/validation check_type=regression).',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/ScoreStandardizationPanel.tsx', 'components/standardization/StandardizationWorkbench.tsx'],
      tables: [],
    },
  },
  {
    key: 'ux', label: 'UX', status: 'SUPPORTED',
    statusNote: 'Interactive formula/rule builders, live preview, interactive graphs (bell-curve + distribution charts), drill-down, export, progressive disclosure, responsive + accessible surfaces. Per-cohort band heat maps are wired (computeHeatmap → POST /compute/heatmap + a workbench heat-map card).',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/standardization/StandardizationWorkbench.tsx'],
      tables: [],
    },
  },
  {
    key: 'apis', label: 'APIs', status: 'SUPPORTED',
    statusNote: 'standardization / transformation / interpretation / configuration / version / validation endpoints under /api/admin/score-standardization, composing the pure psychometric substrate + the astd_* overlay. Read certifications are GET (to_regclass/fs probes); pure standardization / formula / interpretation computes are pure POSTs; overlay writes + governance transitions are flag-gated POSTs.',
    evidence: {
      services: ['services/score-standardization-engine.ts', 'services/score-standardization-mechanisms.ts'],
      routes: ['routes/score-standardization.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'testing', label: 'Testing', status: 'SUPPORTED',
    statusNote: 'A runnable standardization test suite (scripts/test-score-standardization.ts, 53 assertions passing) covering standardization transforms, structured-AST formula evaluation + validation, band classification + per-cohort heat map, interpretation-rule verdicts, the validation checks (distribution / range / boundary / statistical / regression version-diff) and scope-precedence / governance-order invariants (UNIT), plus read-only engine composition against the live DB (INTEGRATION) — alongside the certification scan itself. Performance / accessibility / full HTTP-API tests stay a follow-on.',
    evidence: {
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'documentation', label: 'Documentation', status: 'SUPPORTED',
    statusNote: 'A documentation set (docs/SCORE_STANDARDIZATION.md — architecture / formula framework / interpretation framework / API reference / admin guide / release notes) + the auto-generated deliverable pack (15 reports). User guide stays PARTIAL (admin guide shipped; end-user guide is a follow-on).',
    evidence: {
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN standardization decisions (freeze invariants)
// ─────────────────────────────────────────────────────────────────────────────
export interface StdDecision { id: string; title: string; decision: string }
export const STD_DECISIONS: StdDecision[] = [
  { id: 'D1', title: 'Compose, never duplicate', decision: 'Score Standardization COMPOSES the existing pure psychometric substrate (psychometric-standardization: zFromValue/zToPercentile/zToT/zToStanine/zToSten/zToDeviationScore + normal CDF) under one platform + an additive astd_* overlay — NO duplicate standardization / scoring engine, NO V2.' },
  { id: 'D2', title: 'Downstream of scoring, science & norms', decision: 'Standardization consumes the measurable scores (3.5) + reliability/validity handoff (3.6) + norm references (3.7). It NEVER re-scores, NEVER re-validates the instrument, NEVER builds a norm; it turns a scored result + a norm reference into standard scores, bands and interpretation-rule verdicts.' },
  { id: 'D3', title: 'Ten dimensions certified SEPARATELY', decision: 'standardization · formula · interpretation · governance · super_admin · frontend · ux · apis · testing · documentation are reported SEPARATELY and NEVER composited into a single score.' },
  { id: 'D4', title: 'Formulas are a STRUCTURED AST (no eval)', decision: 'Standardization / composite formulas are a structured AST (const/var/op/weighted/clamp/standardize nodes) evaluated by a whitelisted interpreter — NEVER eval / new Function / string-executed. Formulas are validated before evaluation.' },
  { id: 'D5', title: 'ABSTAIN below k_min; null ≠ 0', decision: 'Norm-referenced standardization ABSTAINS below k_min real members in the reference group. Coverage ⟂ Confidence ⟂ Adoption are never composited. null (unknown) ≠ 0 (absent). Never fabricate.' },
  { id: 'D6', title: 'Governed & versioned, never destructive', decision: 'Every standardization artefact moves through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit trail. Governance transitions are recorded, never destructive.' },
  { id: 'D7', title: 'Byte-identical OFF incl. schema', decision: 'All DDL runs only on the flag-gated write paths; read certifications are GET (to_regclass/fs probes) and pure computes are side-effect-free. OFF is byte-identical incl. schema (0 astd_* tables).' },
  { id: 'D8', title: 'Out-of-scope stays out', decision: 'Benchmark Engine, AI Interpretation, Recommendation Engine, Report Generation, Dashboard Intelligence and Candidate Analytics are NOT implemented in 3.8 — they are later-phase scope.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN engineering gaps (all engineering-closed via reuse-before-build) + RESOLVED
// ─────────────────────────────────────────────────────────────────────────────
export interface StdGap { id: string; severity: GapSeverity; axis: StdAxis; title: string; detail: string }
export const STD_GAPS: StdGap[] = [];

export interface ResolvedStdGap { id: string; severity: GapSeverity; axis: StdAxis; title: string; resolution: string }
export const RESOLVED_STD_GAPS: ResolvedStdGap[] = [
  { id: 'GAP-STD-1', severity: 'High', axis: 'standardization', title: 'No canonical standard-score layer', resolution: 'ENGINEERING-CLOSED via reuse: astd_standard_scores + computeStandardScoreSet reusing the pure psychometric-standardization functions (percentile/z/T/standard/stanine/sten) + structured-AST composites (composite/domain/competency/behaviour/skill/overall). Norm-referenced standardization ABSTAINS below k_min.' },
  { id: 'GAP-STD-2', severity: 'High', axis: 'formula', title: 'No safe, versioned formula framework', resolution: 'ENGINEERING-CLOSED: astd_formulas + a STRUCTURED AST (const/var/op/weighted/clamp/standardize) evaluated by a whitelisted interpreter (evaluateFormula) — NO eval/new Function — validated by validateFormula, versioned + governed.' },
  { id: 'GAP-STD-3', severity: 'High', axis: 'interpretation', title: 'No deterministic interpretation rule repository', resolution: 'ENGINEERING-CLOSED: astd_interpretation_rules + evaluateInterpretationRule deterministically interpreting a standardized score into band / risk / development-priority / readiness verdicts (score/competency/behaviour/skill/dimension/overall) by composing classifyBand + readinessBand.' },
  { id: 'GAP-STD-4', severity: 'Medium', axis: 'governance', title: 'No governance / version history for standardization artefacts', resolution: 'ENGINEERING-CLOSED: astd_governance_log + recordGovernanceTransition moving artefacts through draft→…→retire with append-only version history + rollback + audit trail (never destructive).' },
  { id: 'GAP-STD-5', severity: 'Medium', axis: 'apis', title: 'No standardization / transformation / interpretation APIs', resolution: 'ENGINEERING-CLOSED: routes/score-standardization.ts exposing standardization / transformation / interpretation / configuration / version / validation endpoints (GET certifications, pure POST computes, flag-gated POST writes).' },
  { id: 'GAP-STD-6', severity: 'Medium', axis: 'frontend', title: 'No standardization console / workbench UI', resolution: 'ENGINEERING-CLOSED: ScoreStandardizationPanel (super-admin console) + StandardizationWorkbench (formula/rule/band builder + distribution/percentile explorer + preview) nested in the competency-framework admin shell.' },
  { id: 'GAP-STD-7', severity: 'Medium', axis: 'standardization', title: 'Scoped standardization config stored but not resolvable / applied', resolution: 'ENGINEERING-CLOSED via reuse: resolveConfig + CONFIG_SCOPE_PRECEDENCE (organization > institution > custom > industry > country > lifecycle > persona > assessment, most-specific-wins) exposed as POST /configs/resolve — the industry / organization / country / institution / custom scopes are now stored (saveConfig) AND deterministically resolved/applied. Real populated scoped configs are an ADOPTION axis (honest 0), never a coverage gap.' },
  { id: 'GAP-STD-8', severity: 'Low', axis: 'apis', title: 'No regression validation to guard artefact-version drift', resolution: 'ENGINEERING-CLOSED via reuse: validateRegression (formula + band modes, reusing validateFormula/evaluateFormula/classifyBand) wired into POST /compute/validation (check_type=regression) — proves a candidate formula/band set does not silently diverge from a baseline across reference samples beyond tolerance.' },
  { id: 'GAP-STD-9', severity: 'Low', axis: 'ux', title: 'No per-cohort band heat map', resolution: 'ENGINEERING-CLOSED via reuse: computeHeatmap (reusing classifyBand + optional custom band set) wired into POST /compute/heatmap + a workbench heat-map card — per-cohort band distribution counts. Non-finite percentiles are ignored; never fabricated.' },
  { id: 'GAP-STD-10', severity: 'Low', axis: 'frontend', title: 'No comparison / version-diff surface', resolution: 'ENGINEERING-CLOSED: a workbench regression-diff card compares a baseline vs candidate formula/band set over reference samples via validateRegression (POST /compute/validation check_type=regression), surfacing max-abs-delta + divergences.' },
  { id: 'GAP-STD-11', severity: 'Low', axis: 'super_admin', title: 'Organization-override management surface absent', resolution: 'ENGINEERING-CLOSED: an organization-overrides section in ScoreStandardizationPanel lists organization-scoped configs (GET /configs?scope=organization) + previews most-specific-wins resolution (POST /configs/resolve). Real populated org overrides are an ADOPTION axis (honest 0), never a coverage gap.' },
  { id: 'GAP-STD-12', severity: 'Low', axis: 'standardization', title: 'Custom organizational band sets authored but not applied', resolution: 'ENGINEERING-CLOSED: a workbench custom-band builder authors band sets (saveBandSet) applied deterministically via classifyBand / computeHeatmap (POST /compute/band + /compute/heatmap accept a custom band set). Real populated custom band sets are an ADOPTION axis (honest 0), never a coverage gap.' },
];
