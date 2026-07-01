/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence Platform
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Benchmark Intelligence platform — turns a STANDARDIZED score (3.8) into a
 * BENCHMARKED, comparative, contextual result. It COMPOSES the EXISTING benchmark substrate
 * (services/peer-benchmark.ts · m5-org-benchmark.ts · mei-benchmark-engine.ts · adaptive-benchmark.ts ·
 * benchmark-engine.ts · comparative-intelligence.ts) + the pure psychometric transforms
 * (psychometric-standardization: zFromValue/zToPercentile) + the 3.8 structured-AST formula engine
 * (score-standardization-mechanisms: evaluateFormula/validateFormula) under a single certified layer,
 * and adds an additive `abmk_*` overlay for benchmark groups, benchmark configs, benchmark results,
 * governance (draft→…→retire + version history + rollback + audit trail) and saved views.
 * NO duplicate benchmark engine, NO V2, NO breaking change.
 *
 * Scope is BENCHMARKING & COMPARISON only. It sits DOWNSTREAM of standardization (3.8): it consumes a
 * standardized score + a reference group and turns them into a benchmark result (percentile / z / delta /
 * quartile / cohort-size / suppressed) across 17 reference-group TYPES, 11 comparison DIMENSIONS and 8
 * TIME modes. It NEVER re-scores, NEVER re-standardizes, NEVER builds a norm.
 *
 * OUT OF SCOPE (DO NOT IMPLEMENT here — later phases own these): AI Interpretation, Recommendation
 * Engine, Personalized Guidance, Report Generation, Dashboard Intelligence, Candidate Analytics.
 * There is NO AI in this phase — every benchmark output is deterministic.
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/benchmark-intelligence-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY
 * verifies every evidence claim here against the live filesystem + DB. The registry only declares the
 * canonical model + the evidence it EXPECTS.
 *
 * NINE INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis ·
 *   testing · documentation.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real benchmarked VOLUME) — never composited. Benchmarking ABSTAINS when there are fewer
 * than k_min real members in the reference group. The composite benchmark index is a STRUCTURED AST
 * (no eval / no new Function). Breadth is honest — institutional / geographic cohort TYPES, fine-grained
 * comparison DIMENSIONS and time-series MODES are PARTIAL (mechanism-present, dedicated-substrate /
 * accumulated-volume pending), reported in-line, never forced to 100%. Never fabricate.
 */

export type BmkStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type BmkAxis =
  | 'benchmark_engine' | 'comparison_engine' | 'governance' | 'super_admin'
  | 'frontend' | 'ux' | 'apis' | 'testing' | 'documentation';

export interface BmkEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface BmkDimension {
  key: BmkAxis;
  label: string;
  status: BmkStatus;
  statusNote: string;
  evidence: BmkEvidence;
}

// Minimum real members in a reference group before a benchmark is reported (else ABSTAIN).
// Mirrors the k-anonymity floor used across the platform (peer-benchmark K=30).
export const BMK_K_MIN = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the nine certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const BMK_AXES: { key: BmkAxis; label: string; question: string }[] = [
  { key: 'benchmark_engine', label: 'Benchmark Engine', question: 'Can a standardized score be benchmarked against a reference group (self / peer / cohort / organization / industry / functional / geographic / global / custom) with percentile / z / delta / quartile, abstaining below k_min?' },
  { key: 'comparison_engine', label: 'Comparison Engine', question: 'Can a subject be compared across multiple dimensions (overall / domain / competency / behaviour / employability / leadership / readiness …) and time modes (current / historical / trend …)?' },
  { key: 'governance', label: 'Governance', question: 'Do benchmark groups / configs / rules move through draft→review→validate→approve→publish→archive→retire with version history, rollback and an audit trail?' },
  { key: 'super_admin', label: 'Super Admin', question: 'Is there a super-admin console (benchmark library / configuration / rules / version manager / organization mapping / approval / audit)?' },
  { key: 'frontend', label: 'Frontend', question: 'Is there a benchmark dashboard / explorer / comparison workspace / trend dashboard / heat maps / radar / scatter / distribution charts / cohort & historical comparison UI?' },
  { key: 'ux', label: 'UX', question: 'Does the UX support interactive filtering / drill-down / compare-multiple-groups / side-by-side / benchmark explorer / saved views / responsive / accessible surfaces?' },
  { key: 'apis', label: 'APIs', question: 'Do benchmark / comparison / trend / historical / configuration APIs exist?' },
  { key: 'testing', label: 'Testing', question: 'Is there a testing suite (unit / integration / API) covering benchmark comparison, group comparison, trend, distribution and composite-index evaluation?' },
  { key: 'documentation', label: 'Documentation', question: 'Is there a documentation set (architecture / benchmark library / configuration / API / admin / release notes)?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: BmkStatus; note: string }

// Benchmark reference-group TYPES (17). SUPPORTED = a dedicated reuse-backed substrate exists;
// PARTIAL = reachable ONLY via a generic custom benchmark group (abmk_groups + computeBenchmarkComparison),
// a first-class institutional-roster / geo-cohort ingestion is deferred (tracked as GAP-BMK-1). Never MISSING.
export const BENCHMARK_TYPES: CatalogItem[] = [
  { key: 'self', label: 'Self (own baseline / prior)', status: 'SUPPORTED', note: 'A subject benchmarked against its own standardized baseline (3.8 astd_standard_scores) — computeBenchmarkComparison against the subject\'s prior standard score. No cohort, no k_min gating.' },
  { key: 'peer', label: 'Peer cohort', status: 'SUPPORTED', note: 'Peer benchmarking reuses services/peer-benchmark.ts (K=30 cohort) + comparative-intelligence — percentile / delta vs a peer group, ABSTAINS below k_min.' },
  { key: 'class', label: 'Class', status: 'PARTIAL', note: 'Reachable via a generic custom benchmark group (abmk_groups with an explicit class member scope) computed by computeBenchmarkComparison; a first-class class roster/aggregation is deferred (GAP-BMK-1). PARTIAL, not MISSING.' },
  { key: 'batch', label: 'Batch', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups); a first-class batch roster/aggregation is deferred (GAP-BMK-1).' },
  { key: 'school', label: 'School', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups); a first-class school roster/aggregation is deferred (GAP-BMK-1).' },
  { key: 'college', label: 'College', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups); a first-class college roster/aggregation is deferred (GAP-BMK-1).' },
  { key: 'university', label: 'University', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups); a first-class university roster/aggregation is deferred (GAP-BMK-1).' },
  { key: 'coaching', label: 'Coaching institute', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups); a first-class coaching-institute roster/aggregation is deferred (GAP-BMK-1).' },
  { key: 'organization', label: 'Organization', status: 'SUPPORTED', note: 'Organization benchmarking reuses services/m5-org-benchmark.ts — org-scoped percentile / delta, ABSTAINS below k_min.' },
  { key: 'department', label: 'Department', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups with a department member scope) computed over org substrate; a first-class department aggregation is deferred (GAP-BMK-1).' },
  { key: 'team', label: 'Team', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups with a team member scope); a first-class team aggregation is deferred (GAP-BMK-1).' },
  { key: 'industry', label: 'Industry', status: 'SUPPORTED', note: 'Industry benchmarking reuses m5-org-benchmark industry references + mei-benchmark-engine + adaptive-benchmark (industry cohort) — ABSTAINS below k_min.' },
  { key: 'functional', label: 'Functional / role family', status: 'SUPPORTED', note: 'Functional (role-family) benchmarking reuses adaptive-benchmark cohort resolution + benchmark-engine — ABSTAINS below k_min.' },
  { key: 'national', label: 'National', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups with a national geo scope); a first-class national geo-cohort ingestion is deferred (GAP-BMK-1).' },
  { key: 'regional', label: 'Regional', status: 'PARTIAL', note: 'Reachable via a custom benchmark group (abmk_groups with a regional geo scope); a first-class regional geo-cohort ingestion is deferred (GAP-BMK-1).' },
  { key: 'global', label: 'Global', status: 'SUPPORTED', note: 'Global benchmarking reuses adaptive-benchmark (global cohort) / benchmark-engine (unfiltered reference) — percentile vs the whole standardized population, ABSTAINS below k_min.' },
  { key: 'custom', label: 'Custom benchmark group', status: 'SUPPORTED', note: 'Fully custom benchmark groups (abmk_groups: benchmark_type + scope + inclusion/exclusion rules + min_sample_size + effective dates) computed deterministically by computeBenchmarkComparison — the reuse path that makes every PARTIAL institutional / geo type reachable. Real populated custom groups are an ADOPTION axis (honest 0), never a coverage gap.' },
];

// Comparison DIMENSIONS (11). SUPPORTED where the standardized substrate exposes the axis;
// PARTIAL where a finer-grained standardized input is not uniformly present upstream (GAP-BMK-2).
export const COMPARISON_DIMENSIONS: CatalogItem[] = [
  { key: 'overall', label: 'Overall', status: 'SUPPORTED', note: 'Overall standardized score benchmarked against the reference group — benchmark-engine + astd_standard_scores.overall.' },
  { key: 'domain', label: 'Domain', status: 'SUPPORTED', note: 'Per-domain benchmarking reuses adaptive-benchmark (family/domain) + comparative-intelligence.' },
  { key: 'sub_domain', label: 'Sub-domain', status: 'PARTIAL', note: 'Sub-domain benchmarking depends on a finer-grained standardized sub-domain input that is not uniformly present upstream (3.5/3.6/3.8) — reachable when the standardized substrate exposes sub-domain scores (GAP-BMK-2).' },
  { key: 'competency', label: 'Competency', status: 'SUPPORTED', note: 'Per-competency benchmarking reuses adaptive-benchmark (competency) + comparative-intelligence.' },
  { key: 'behaviour', label: 'Behaviour', status: 'SUPPORTED', note: 'Per-behaviour benchmarking reuses benchmark-engine behaviour metrics + the standardized behaviour scores.' },
  { key: 'skill', label: 'Skill', status: 'PARTIAL', note: 'Skill-level benchmarking depends on a finer-grained standardized skill input not uniformly present upstream (GAP-BMK-2).' },
  { key: 'trait', label: 'Trait', status: 'PARTIAL', note: 'Trait-level benchmarking depends on a standardized trait input not uniformly present upstream (GAP-BMK-2).' },
  { key: 'learning_outcome', label: 'Learning outcome', status: 'PARTIAL', note: 'Learning-outcome benchmarking depends on a standardized learning-outcome input not uniformly present upstream (GAP-BMK-2).' },
  { key: 'employability', label: 'Employability', status: 'SUPPORTED', note: 'Employability benchmarking reuses services/mei-benchmark-engine.ts (MEI) — ABSTAINS below k_min.' },
  { key: 'leadership', label: 'Leadership', status: 'SUPPORTED', note: 'Leadership benchmarking reuses m5-org-benchmark leadership references + comparative-intelligence.' },
  { key: 'readiness', label: 'Readiness', status: 'SUPPORTED', note: 'Readiness benchmarking reuses benchmark-engine + comparative-intelligence readiness metrics.' },
];

// Benchmark TIME modes (8). SUPPORTED = point-in-time (computable now). PARTIAL = the pure computeTrend
// mechanism + timestamp/version columns on abmk_results + /compute/trend + /results/list exist, but a real
// benchmark time-series depends on accumulated abmk_results VOLUME (an ADOPTION axis, honest 0) — never a gap.
export const TIME_MODES: CatalogItem[] = [
  { key: 'current', label: 'Current (point-in-time)', status: 'SUPPORTED', note: 'A point-in-time benchmark of the subject\'s current standardized score against the reference group — fully computable now.' },
  { key: 'historical', label: 'Historical', status: 'PARTIAL', note: 'Mechanism present (timestamped/versioned abmk_results + /results/list ordered by time); real historical benchmark VOLUME is an ADOPTION axis (honest 0), reported SEPARATELY, never a gap.' },
  { key: 'trend', label: 'Trend', status: 'PARTIAL', note: 'Mechanism present (pure computeTrend over a benchmark series + POST /compute/trend); real time-series VOLUME across abmk_results is an ADOPTION axis (honest 0).' },
  { key: 'growth', label: 'Growth', status: 'PARTIAL', note: 'Mechanism present (computeTrend delta/direction over a benchmark series); real longitudinal benchmark VOLUME is an ADOPTION axis (honest 0).' },
  { key: 'improvement', label: 'Improvement', status: 'PARTIAL', note: 'Mechanism present (computeTrend positive-slope detection); real time-series VOLUME is an ADOPTION axis (honest 0).' },
  { key: 'regression', label: 'Regression (backward slide)', status: 'PARTIAL', note: 'Mechanism present (computeTrend negative-slope / decline detection); real time-series VOLUME is an ADOPTION axis (honest 0). Distinct from formula/version regression validation.' },
  { key: 'longitudinal', label: 'Longitudinal', status: 'PARTIAL', note: 'Mechanism present (computeTrend over the full benchmark series); real longitudinal benchmark VOLUME is an ADOPTION axis (honest 0).' },
  { key: 'cohort_progression', label: 'Cohort progression', status: 'PARTIAL', note: 'Mechanism present (computeGroupComparison over successive cohort snapshots); real cohort-snapshot VOLUME is an ADOPTION axis (honest 0).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface BmkControl { key: string; label: string; status: BmkStatus; evidence: string[] }

// Benchmark configuration capabilities (7)
export const BENCHMARK_CONFIG: BmkControl[] = [
  { key: 'benchmark_groups', label: 'Benchmark group definitions', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_groups'] },
  { key: 'inclusion_rules', label: 'Inclusion rules', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_groups'] },
  { key: 'exclusion_rules', label: 'Exclusion rules', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_groups'] },
  { key: 'min_sample_size', label: 'Minimum sample size (k_min)', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_groups'] },
  { key: 'versioning', label: 'Benchmark versioning', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_configs', 'abmk_governance_log'] },
  { key: 'effective_dates', label: 'Effective dates', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_groups'] },
  { key: 'organization_overrides', label: 'Organization overrides (scope precedence)', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'routes/benchmark-intelligence.ts', 'abmk_configs'] },
];

// Governance states (8) — the lifecycle a benchmark artefact moves through + the audit trail
export const GOVERNANCE_STATES: BmkControl[] = [
  { key: 'draft', label: 'Draft', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'review', label: 'Review', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'validate', label: 'Validate', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'approve', label: 'Approve', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'publish', label: 'Publish', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'archive', label: 'Archive', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'retire', label: 'Retire', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_governance_log'] },
  { key: 'audit_trail', label: 'Audit trail', status: 'SUPPORTED', evidence: ['services/benchmark-intelligence-mechanisms.ts', 'abmk_audit_log', 'abmk_governance_log'] },
];

// Super-admin surfaces (7)
export const SUPER_ADMIN_SURFACES: BmkControl[] = [
  { key: 'benchmark_library', label: 'Benchmark library', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
  { key: 'benchmark_configuration', label: 'Benchmark configuration', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
  { key: 'benchmark_rules', label: 'Benchmark rules', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
  { key: 'version_manager', label: 'Version manager', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
  { key: 'organization_mapping', label: 'Organization mapping', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx', 'routes/benchmark-intelligence.ts'] },
  { key: 'benchmark_approval', label: 'Benchmark approval workflow', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
  { key: 'audit_console', label: 'Audit console', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
];

// Frontend surfaces (10)
export const FRONTEND_SURFACES: BmkControl[] = [
  { key: 'benchmark_dashboard', label: 'Benchmark dashboard', status: 'SUPPORTED', evidence: ['components/superadmin/BenchmarkIntelligencePanel.tsx'] },
  { key: 'benchmark_explorer', label: 'Benchmark explorer', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'comparison_workspace', label: 'Comparison workspace', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'trend_dashboard', label: 'Trend dashboard', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'heat_maps', label: 'Heat maps', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'radar_charts', label: 'Radar charts', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'scatter_charts', label: 'Scatter charts', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'distribution_charts', label: 'Distribution charts', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'cohort_comparison', label: 'Cohort comparison', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'historical_comparison', label: 'Historical comparison', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx', 'routes/benchmark-intelligence.ts'] },
];

// UX criteria (8)
export const UX_CRITERIA: BmkControl[] = [
  { key: 'interactive_filtering', label: 'Interactive filtering', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'drill_down', label: 'Drill down', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'compare_multiple_groups', label: 'Compare multiple groups', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'side_by_side', label: 'Side-by-side view', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'benchmark_explorer', label: 'Benchmark explorer', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'saved_views', label: 'Saved views', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx', 'routes/benchmark-intelligence.ts', 'abmk_saved_views'] },
  { key: 'responsive', label: 'Responsive design', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
  { key: 'accessibility', label: 'Accessibility', status: 'SUPPORTED', evidence: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'] },
];

// API groups (5)
export const API_GROUPS: BmkControl[] = [
  { key: 'benchmark_apis', label: 'Benchmark APIs', status: 'SUPPORTED', evidence: ['routes/benchmark-intelligence.ts', 'services/benchmark-intelligence-mechanisms.ts'] },
  { key: 'comparison_apis', label: 'Comparison APIs', status: 'SUPPORTED', evidence: ['routes/benchmark-intelligence.ts', 'services/benchmark-intelligence-mechanisms.ts'] },
  { key: 'trend_apis', label: 'Trend APIs', status: 'SUPPORTED', evidence: ['routes/benchmark-intelligence.ts', 'services/benchmark-intelligence-mechanisms.ts'] },
  { key: 'historical_apis', label: 'Historical APIs', status: 'SUPPORTED', evidence: ['routes/benchmark-intelligence.ts', 'abmk_results'] },
  { key: 'configuration_apis', label: 'Configuration APIs', status: 'SUPPORTED', evidence: ['routes/benchmark-intelligence.ts', 'abmk_configs', 'abmk_groups'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRACEABILITY MODEL (5) — every benchmark result must trace back to its full provenance chain
// ─────────────────────────────────────────────────────────────────────────────
export interface TraceRow { key: string; label: string; source: string; status: BmkStatus; note: string }
export const TRACEABILITY_MODEL: TraceRow[] = [
  { key: 'standardized_score', label: 'Standardized score', source: 'astd_standard_scores', status: 'SUPPORTED', note: 'The standardized score (3.8) benchmarked — the benchmark input, carried on every benchmark result.' },
  { key: 'assessment_version', label: 'Assessment version', source: 'abmk_results.assessment_version', status: 'SUPPORTED', note: 'The assessment version the standardized score was produced against — carried on every benchmark result.' },
  { key: 'norm_version', label: 'Norm version', source: 'aint_norm_tables (3.7) + abmk_results.norm_version', status: 'SUPPORTED', note: 'The norm reference (3.7) the score was standardized against — carried on every benchmark result.' },
  { key: 'standardization_version', label: 'Standardization version', source: 'astd_configs + abmk_results.standardization_version', status: 'SUPPORTED', note: 'The versioned standardization config (3.8) applied — carried on every benchmark result.' },
  { key: 'benchmark_version', label: 'Benchmark version', source: 'abmk_configs.version + abmk_results.benchmark_version', status: 'SUPPORTED', note: 'The versioned benchmark config (group + dimension + time mode) applied — carried on every benchmark result.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// NINE certification DIMENSIONS — evidence anchored in REUSED substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const BMK_DIMENSIONS: BmkDimension[] = [
  {
    key: 'benchmark_engine', label: 'Benchmark Engine', status: 'SUPPORTED',
    statusNote: 'ONE canonical benchmark layer (abmk_results) turning a standardized score into a benchmark result (percentile / z / delta / quartile / cohort-size / suppressed) by COMPOSING the existing benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence) + the pure psychometric transforms (zFromValue/zToPercentile) — ABSTAINS below k_min real members, never fabricated. 7 reference-group TYPES are dedicated-substrate SUPPORTED (self/peer/organization/industry/functional/global/custom); the 10 institutional / geographic TYPES (class/batch/school/college/university/coaching/department/team/national/regional) are PARTIAL — reachable via generic custom benchmark groups, a first-class roster/geo-cohort ingestion is deferred (GAP-BMK-1), a coverage-breadth boundary NOT an engine gap. A composite benchmark index reuses the 3.8 structured-AST formula engine (no eval).',
    evidence: {
      services: ['services/benchmark-intelligence-mechanisms.ts', 'services/benchmark-intelligence-engine.ts', 'services/peer-benchmark.ts', 'services/m5-org-benchmark.ts', 'services/mei-benchmark-engine.ts', 'services/adaptive-benchmark.ts', 'services/benchmark-engine.ts', 'services/comparative-intelligence.ts', 'services/psychometric-standardization.ts'],
      routes: ['routes/benchmark-intelligence.ts'],
      frontend: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'],
      tables: ['astd_standard_scores', 'abmk_results', 'abmk_groups'],
    },
  },
  {
    key: 'comparison_engine', label: 'Comparison Engine', status: 'SUPPORTED',
    statusNote: 'Multi-dimensional + multi-mode comparison: computeGroupComparison + per-dimension benchmarking across 7 SUPPORTED comparison dimensions (overall / domain / competency / behaviour / employability / leadership / readiness) — the 4 finer dimensions (sub_domain / skill / trait / learning_outcome) are PARTIAL, depending on a finer-grained standardized input upstream (GAP-BMK-2). Point-in-time (current) comparison is SUPPORTED; 7 time-series modes (historical / trend / growth / improvement / regression / longitudinal / cohort_progression) are mechanism-present (pure computeTrend + timestamped/versioned abmk_results) with real time-series VOLUME an ADOPTION axis (honest 0), never a gap.',
    evidence: {
      services: ['services/benchmark-intelligence-mechanisms.ts', 'services/benchmark-intelligence-engine.ts', 'services/comparative-intelligence.ts', 'services/adaptive-benchmark.ts'],
      routes: ['routes/benchmark-intelligence.ts'],
      frontend: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'],
      tables: ['abmk_results', 'abmk_configs'],
    },
  },
  {
    key: 'governance', label: 'Governance', status: 'SUPPORTED',
    statusNote: 'ONE canonical governance layer (abmk_governance_log + abmk_audit_log) moving every benchmark artefact (group / config / rule set) through draft→review→validate→approve→publish→archive→retire with append-only version history, rollback (restore a prior version) and a full audit trail. State transitions are recorded, never destructive.',
    evidence: {
      services: ['services/benchmark-intelligence-mechanisms.ts', 'services/benchmark-intelligence-engine.ts'],
      routes: ['routes/benchmark-intelligence.ts'],
      frontend: ['components/superadmin/BenchmarkIntelligencePanel.tsx'],
      tables: ['abmk_governance_log', 'abmk_audit_log', 'abmk_configs'],
    },
  },
  {
    key: 'super_admin', label: 'Super Admin', status: 'SUPPORTED',
    statusNote: 'Super-admin certification + management console (benchmark library / benchmark configuration / benchmark rules / version manager / organization mapping / benchmark approval / audit console) nested in the competency-framework admin shell. Organization mapping is wired (organization-scoped configs stored via saveConfig scope=organization, resolved via resolveConfig top-precedence). Real populated organization overrides are an ADOPTION axis (honest 0), not a coverage gap.',
    evidence: {
      services: [],
      routes: ['routes/benchmark-intelligence.ts'],
      frontend: ['components/superadmin/BenchmarkIntelligencePanel.tsx'],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Frontend', status: 'SUPPORTED',
    statusNote: 'Interactive benchmark workbench (benchmark explorer / comparison workspace / trend dashboard / heat maps / radar / scatter / distribution charts / cohort & historical comparison) + super-admin console (benchmark dashboard / library / version manager / audit console). Charts render REAL computed data (SVG/table) — no fabricated series; empty series render an honest empty/abstain state.',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/BenchmarkIntelligencePanel.tsx', 'components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'],
      tables: [],
    },
  },
  {
    key: 'ux', label: 'UX', status: 'SUPPORTED',
    statusNote: 'Interactive filtering, drill-down, compare-multiple-groups, side-by-side view, benchmark explorer, saved views (abmk_saved_views), responsive + accessible surfaces. Distribution / bell-curve / heat-map / radar / scatter visualizations render real computed data; non-finite values are ignored, never fabricated.',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/benchmark-intelligence/BenchmarkIntelligenceWorkbench.tsx'],
      tables: ['abmk_saved_views'],
    },
  },
  {
    key: 'apis', label: 'APIs', status: 'SUPPORTED',
    statusNote: 'benchmark / comparison / trend / historical / configuration endpoints under /api/admin/benchmark-intelligence, composing the reused benchmark substrate + the abmk_* overlay. Read certifications are GET (to_regclass/fs probes); pure benchmark / comparison / trend / distribution / composite computes are pure POSTs; overlay writes + governance transitions are flag-gated POSTs. The trend / historical endpoints compute over abmk_results and return an honest empty/abstain when the series is empty.',
    evidence: {
      services: ['services/benchmark-intelligence-engine.ts', 'services/benchmark-intelligence-mechanisms.ts'],
      routes: ['routes/benchmark-intelligence.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'testing', label: 'Testing', status: 'SUPPORTED',
    statusNote: 'A runnable benchmark test suite (tests/capadex-3.9-benchmark-intelligence.test.ts) covering benchmark comparison (percentile/z/delta/quartile + ABSTAIN below k_min), reference stats, group comparison + suppression, trend direction (improving/declining/stable), distribution binning, empirical percentile rank and structured-AST composite-index evaluation + validation (no eval), plus read-only engine composition against the live DB (INTEGRATION) — alongside the certification scan itself. UI / end-to-end / accessibility / performance test suites stay a follow-on boundary (PARTIAL), reported in-line, NOT a gap.',
    evidence: {
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'documentation', label: 'Documentation', status: 'SUPPORTED',
    statusNote: 'A documentation set (docs/BENCHMARK_INTELLIGENCE.md — architecture / benchmark library / configuration / comparison framework / API reference / admin guide / release notes) + the auto-generated deliverable pack (16 reports). An end-user (learner/candidate-facing) benchmark guide stays a follow-on boundary (PARTIAL), reported in-line, NOT a gap.',
    evidence: {
      services: [],
      routes: [],
      frontend: [],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN benchmark decisions (freeze invariants)
// ─────────────────────────────────────────────────────────────────────────────
export interface BmkDecision { id: string; title: string; decision: string }
export const BMK_DECISIONS: BmkDecision[] = [
  { id: 'D1', title: 'Compose, never duplicate', decision: 'Benchmark Intelligence COMPOSES the existing benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence) + the pure psychometric transforms + the 3.8 structured-AST formula engine under one platform + an additive abmk_* overlay — NO duplicate benchmark / comparison engine, NO V2, NO breaking change.' },
  { id: 'D2', title: 'Downstream of standardization', decision: 'Benchmarking consumes the standardized scores (3.8) + norm references (3.7). It NEVER re-scores, NEVER re-standardizes, NEVER builds a norm; it turns a standardized result + a reference group into a benchmark result (percentile / z / delta / quartile) and comparison verdicts.' },
  { id: 'D3', title: 'Nine dimensions certified SEPARATELY', decision: 'benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation are reported SEPARATELY and NEVER composited into a single score.' },
  { id: 'D4', title: 'Composite index is a STRUCTURED AST (no eval)', decision: 'The composite benchmark index reuses the 3.8 structured-AST formula engine (const/var/op/weighted/clamp/standardize nodes) evaluated by a whitelisted interpreter (evaluateFormula) — NEVER eval / new Function / string-executed. Formulas are validated before evaluation.' },
  { id: 'D5', title: 'ABSTAIN below k_min; null ≠ 0', decision: 'Benchmarking ABSTAINS below k_min real members in the reference group. Coverage ⟂ Confidence ⟂ Adoption are never composited. null (unknown) ≠ 0 (absent). Never fabricate.' },
  { id: 'D6', title: 'Governed & versioned, never destructive', decision: 'Every benchmark artefact moves through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit trail. Governance transitions are recorded, never destructive.' },
  { id: 'D7', title: 'Byte-identical OFF incl. schema', decision: 'All DDL runs only on the flag-gated write paths; read certifications are GET (to_regclass/fs probes) and pure computes are side-effect-free. OFF is byte-identical incl. schema (0 abmk_* tables).' },
  { id: 'D8', title: 'NO AI in this phase', decision: 'Every benchmark output is DETERMINISTIC. AI Interpretation, Recommendation Engine, Personalized Guidance, Report Generation, Dashboard Intelligence and Candidate Analytics are NOT implemented in 3.9 — they are later-phase scope.' },
  { id: 'D9', title: 'Breadth is honest, never forced', decision: 'Institutional / geographic cohort TYPES (reachable via custom groups), fine-grained comparison DIMENSIONS (finer standardized inputs upstream) and time-series MODES (accumulated volume) are PARTIAL / ADOPTION — reported SEPARATELY and in-line, never padded to 100%, never fabricated.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN engineering gaps (honest breadth deferrals) + RESOLVED (via reuse-before-build)
// ─────────────────────────────────────────────────────────────────────────────
export interface BmkGap { id: string; severity: GapSeverity; axis: BmkAxis; title: string; detail: string }
export const BENCHMARK_GAPS: BmkGap[] = [
  { id: 'GAP-BMK-1', severity: 'Medium', axis: 'benchmark_engine', title: 'Dedicated institutional & geographic reference-cohort substrate deferred', detail: 'class / batch / school / college / university / coaching / department / team / national / regional benchmark types are reachable ONLY via generic custom benchmark groups (abmk_groups with an explicit member/geo scope) computed by computeBenchmarkComparison; a first-class institutional-roster / geo-cohort ingestion + aggregation pipeline is NOT built in 3.9. PARTIAL (mechanism-present via custom groups), never MISSING. Closing it needs roster/geo data ingestion (integration + adoption), not a new benchmark engine.' },
  { id: 'GAP-BMK-2', severity: 'Medium', axis: 'comparison_engine', title: 'Fine-grained comparison dimensions PARTIAL', detail: 'sub_domain / skill / trait / learning_outcome comparison depends on a finer-grained standardized input that the upstream standardized substrate (3.5 / 3.6 / 3.8) does not uniformly expose; overall / domain / competency / behaviour / employability / leadership / readiness are SUPPORTED. Closing it depends on finer standardized inputs upstream, not the comparison engine itself.' },
  { id: 'GAP-BMK-3', severity: 'Future', axis: 'benchmark_engine', title: 'Cross-version benchmark re-baselining', detail: 'Auto-migrating a subject\'s historical benchmark results when a benchmark config version supersedes another is a Future enhancement; full version lineage (assessment / norm / standardization / benchmark version) is already carried on every abmk_results row today, so re-baselining is additive, not a correctness gap.' },
];

export interface ResolvedBmkGap { id: string; severity: GapSeverity; axis: BmkAxis; title: string; resolution: string }
export const RESOLVED_BENCHMARK_GAPS: ResolvedBmkGap[] = [
  { id: 'GAP-BMK-R1', severity: 'High', axis: 'benchmark_engine', title: 'No canonical benchmark layer', resolution: 'ENGINEERING-CLOSED via reuse: abmk_results + computeBenchmarkComparison reusing the pure psychometric zFromValue/zToPercentile + COMPOSING peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence — percentile / z / delta / quartile across 7 dedicated-substrate reference-group types. ABSTAINS below k_min.' },
  { id: 'GAP-BMK-R2', severity: 'High', axis: 'comparison_engine', title: 'No multi-dimension comparison', resolution: 'ENGINEERING-CLOSED via reuse: computeGroupComparison + per-dimension benchmarking across overall / domain / competency / behaviour / employability / leadership / readiness (7 SUPPORTED) composing comparative-intelligence + adaptive-benchmark.' },
  { id: 'GAP-BMK-R3', severity: 'Medium', axis: 'governance', title: 'No governance / version history for benchmark artefacts', resolution: 'ENGINEERING-CLOSED: abmk_governance_log + abmk_audit_log + recordGovernanceTransition moving artefacts through draft→…→retire with append-only version history + rollback + audit trail (never destructive).' },
  { id: 'GAP-BMK-R4', severity: 'Medium', axis: 'apis', title: 'No benchmark / comparison / trend / historical / configuration APIs', resolution: 'ENGINEERING-CLOSED: routes/benchmark-intelligence.ts exposing benchmark / comparison / trend / historical / configuration endpoints (GET certifications, pure POST computes, flag-gated POST writes).' },
  { id: 'GAP-BMK-R5', severity: 'Medium', axis: 'frontend', title: 'No benchmark console / workbench UI', resolution: 'ENGINEERING-CLOSED: BenchmarkIntelligencePanel (super-admin console) + BenchmarkIntelligenceWorkbench (benchmark explorer / comparison workspace / trend dashboard / heat maps / radar / scatter / distribution / cohort & historical comparison) nested in the competency-framework admin shell.' },
  { id: 'GAP-BMK-R6', severity: 'Medium', axis: 'super_admin', title: 'No benchmark library / config / rules / version / org-mapping / approval / audit console', resolution: 'ENGINEERING-CLOSED: BenchmarkIntelligencePanel surfaces (benchmark library / configuration / rules / version manager / organization mapping / approval / audit console).' },
  { id: 'GAP-BMK-R7', severity: 'Low', axis: 'benchmark_engine', title: 'Custom benchmark groups authored but not resolvable / applied', resolution: 'ENGINEERING-CLOSED via reuse: abmk_groups (benchmark_type + scope + inclusion/exclusion rules + min_sample_size + effective dates) + abmk_configs + resolveConfig + CONFIG_SCOPE_PRECEDENCE (organization > institution > custom > industry > country > lifecycle > persona > assessment, most-specific-wins) exposed as POST /configs/resolve. Real populated custom groups are an ADOPTION axis (honest 0), never a coverage gap.' },
  { id: 'GAP-BMK-R8', severity: 'Low', axis: 'ux', title: 'No saved views / side-by-side / drill-down', resolution: 'ENGINEERING-CLOSED: abmk_saved_views + saveView/listViews + workbench side-by-side + drill-down + interactive filtering + compare-multiple-groups.' },
  { id: 'GAP-BMK-R9', severity: 'Low', axis: 'benchmark_engine', title: 'No composite benchmark index', resolution: 'ENGINEERING-CLOSED via reuse: evaluateBenchmarkFormula reusing the 3.8 structured-AST formula engine (evaluateFormula/validateFormula — const/var/op/weighted/clamp/standardize, NO eval/new Function) to compose a weighted composite benchmark index, validated before evaluation.' },
  { id: 'GAP-BMK-R10', severity: 'Low', axis: 'ux', title: 'No distribution / bell-curve / heat-map / radar / scatter visualization', resolution: 'ENGINEERING-CLOSED via reuse: computeDistribution + computeGroupComparison + workbench SVG/table viz cards (distribution / bell curve / heat map / radar / scatter) rendering REAL computed data. Non-finite values are ignored, never fabricated.' },
];
