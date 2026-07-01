/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting Layer)
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Assessment Intelligence registry — a pure-data, FROZEN model that COMPOSES the EXISTING
 * interpretation / benchmarking / narrative / reporting services (psychometric-standardization,
 * benchmark-engine, peer-benchmark, intelligence-narrative-engine, ai-reasoning-engine, dynamic-report)
 * under a single certified layer + an additive `aint_*` overlay. NO duplicate engine, NO V2, NO breaking
 * change.
 *
 * Scope is INTERPRETATION & REPORTING — it turns a SCORED + VALIDATED assessment (Phase 3.5 Scoring + 3.6
 * Science) into MEANING: norm-referenced interpretation, standardization (percentile/z/T/stanine/sten),
 * benchmarking (peer/role/stage/temporal), AI narrative interpretation, report intelligence, and
 * candidate-performance analytics. It sits DOWNSTREAM of scoring (it consumes measurable scores) and
 * downstream of science (it consumes reliability/validity/norm handoff); it never re-scores, never
 * re-validates the instrument.
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/assessment-intelligence-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY
 * verifies every evidence claim here against the live filesystem + DB. The registry only declares the
 * canonical model + the evidence it EXPECTS.
 *
 * EIGHT INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   norms · standardization · benchmarking · ai_interpretation · report_intelligence ·
 *   candidate_performance · frontend · apis.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real interpreted / benchmarked / reported VOLUME) — never composited. Norm-referenced
 * statistics and benchmarks ABSTAIN when there are fewer than k_min real members in the reference
 * group. AI narrative confidence stays honestly null while cold-start / uncalibrated — never fabricated.
 */

export type AintStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type AintAxis =
  | 'norms' | 'standardization' | 'benchmarking' | 'ai_interpretation'
  | 'report_intelligence' | 'candidate_performance' | 'frontend' | 'apis';

export interface AintEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface AintDimension {
  key: AintAxis;
  label: string;
  status: AintStatus;
  statusNote: string;
  evidence: AintEvidence;
}

// Minimum real members in a reference group before norm-referenced statistics / benchmarks are reported
// (else ABSTAIN). Mirrors the k-anonymity floor used across the platform.
export const AINT_K_MIN = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the eight certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const AINT_AXES: { key: AintAxis; label: string; question: string }[] = [
  { key: 'norms', label: 'Norm Referencing', question: 'Can a raw score be interpreted against a norm reference (cohort / role / stage / age / self / custom)?' },
  { key: 'standardization', label: 'Standardization', question: 'Can a raw score be standardized (percentile / z / T / stanine / sten / deviation) against a distribution?' },
  { key: 'benchmarking', label: 'Benchmarking', question: 'Can a candidate be benchmarked against peers / role / stage / institution / temporal-self / national reference groups?' },
  { key: 'ai_interpretation', label: 'AI Interpretation', question: 'Can an AI narrative (strengths / development / reasoning / recommendations) be generated over a scored result?' },
  { key: 'report_intelligence', label: 'Report Intelligence', question: 'Can a structured, section-aware interpretation report be composed (overview → summary → norm → benchmark → narrative → recommendations → next steps)?' },
  { key: 'candidate_performance', label: 'Candidate Performance', question: 'Can candidate-performance analytics (overall standing / dimension profile / percentile / growth trajectory / peer-relative / readiness band) be surfaced?' },
  { key: 'frontend', label: 'Intelligence Frontend', question: 'Is there a norm / standardization / benchmark / narrative / report / performance console UI?' },
  { key: 'apis', label: 'Intelligence APIs', question: 'Do interpretation / standardization / benchmark / narrative / report / performance / repository APIs exist?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: AintStatus; note: string }

// Norm reference types (7) — the reference groups a raw score can be interpreted against
export const NORM_TYPES: CatalogItem[] = [
  { key: 'cohort_norm', label: 'Cohort norm', status: 'SUPPORTED', note: 'Score interpreted against a k-anonymous peer cohort (peer-benchmark) — ABSTAINS below k_min real members.' },
  { key: 'role_norm', label: 'Role norm', status: 'SUPPORTED', note: 'Score interpreted against a role reference group (benchmark-engine role metrics) — ABSTAINS below k_min.' },
  { key: 'stage_norm', label: 'Stage / lifecycle norm', status: 'SUPPORTED', note: 'Score interpreted against a lifecycle-stage band (stageBandForScore) — norm boundaries are stage-canonical.' },
  { key: 'self_norm', label: 'Self / ipsative (temporal) norm', status: 'SUPPORTED', note: 'Score interpreted against the candidate\'s own prior scores (longitudinal snapshots) — ipsative growth reference.' },
  { key: 'age_norm', label: 'Age / grade norm', status: 'PARTIAL', note: 'Age-referenced norm requires an age-tagged reference sample at k_min per band — honest PARTIAL until adoption volume exists.' },
  { key: 'national_norm', label: 'National / population norm', status: 'PARTIAL', note: 'Population norm requires a representative national reference sample — a data-availability boundary, not an engineering gap.' },
  { key: 'custom_norm', label: 'Custom (admin-defined) norm', status: 'PARTIAL', note: 'Admin-defined norm tables (aint_norm_tables) can be stored + applied; PARTIAL until real custom norm groups are populated.' },
];

// Standard-score types (8) — the standardized transforms of a raw score (pure functions, no adoption dependency)
export const STANDARD_SCORE_TYPES: CatalogItem[] = [
  { key: 'percentile', label: 'Percentile rank', status: 'SUPPORTED', note: 'zToPercentile — proportion of the reference distribution below the score (normal CDF).' },
  { key: 'z_score', label: 'z-score', status: 'SUPPORTED', note: 'zFromValue — standardized deviation from the reference mean in SD units.' },
  { key: 't_score', label: 'T-score (μ=50, σ=10)', status: 'SUPPORTED', note: 'zToT — linear rescale of z to the T metric.' },
  { key: 'stanine', label: 'Stanine (1–9)', status: 'SUPPORTED', note: 'zToStanine + stanineBand — nine-point standard-nine band.' },
  { key: 'sten', label: 'Sten (1–10)', status: 'SUPPORTED', note: 'zToSten — ten-point standard band.' },
  { key: 'deviation_score', label: 'Deviation score (μ=100, σ=15)', status: 'SUPPORTED', note: 'zToDeviationScore — deviation-quotient metric.' },
  { key: 'nce', label: 'Normal curve equivalent (NCE)', status: 'PARTIAL', note: 'Derivable from percentile but not yet surfaced as a first-class standard score — a display boundary, not a gap.' },
  { key: 'scaled_score', label: 'Scaled score', status: 'PARTIAL', note: 'Linear scaled score requires a defined target scale per assessment — PARTIAL until scales are first-class.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface AintControl { key: string; label: string; status: AintStatus; evidence: string[] }

// Benchmark scopes (6)
export const BENCHMARK_SCOPES: AintControl[] = [
  { key: 'peer_cohort', label: 'Peer-cohort benchmark', status: 'SUPPORTED', evidence: ['services/peer-benchmark.ts', 'services/assessment-intelligence-mechanisms.ts', 'aint_benchmarks'] },
  { key: 'role', label: 'Role benchmark', status: 'SUPPORTED', evidence: ['services/benchmark-engine.ts', 'services/assessment-intelligence-mechanisms.ts', 'aint_benchmarks'] },
  { key: 'stage', label: 'Stage / lifecycle benchmark', status: 'SUPPORTED', evidence: ['services/peer-benchmark.ts', 'aint_benchmarks'] },
  { key: 'temporal_self', label: 'Temporal (self-over-time) benchmark', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'wc3_longitudinal_snapshots', 'aint_benchmarks'] },
  { key: 'institution', label: 'Institution benchmark', status: 'PARTIAL', evidence: ['services/benchmark-engine.ts', 'aint_benchmarks'] },
  { key: 'national', label: 'National / population benchmark', status: 'PARTIAL', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_benchmarks'] },
];

// AI-interpretation capabilities (6)
export const AI_INTERPRETATION_CAPABILITIES: AintControl[] = [
  { key: 'narrative_generation', label: 'Narrative generation', status: 'SUPPORTED', evidence: ['services/intelligence-narrative-engine.ts', 'services/assessment-intelligence-mechanisms.ts', 'aint_interpretations'] },
  { key: 'strength_identification', label: 'Strength identification', status: 'SUPPORTED', evidence: ['services/intelligence-narrative-engine.ts', 'aint_interpretations'] },
  { key: 'development_area', label: 'Development-area identification', status: 'SUPPORTED', evidence: ['services/intelligence-narrative-engine.ts', 'aint_interpretations'] },
  { key: 'reasoning_chain', label: 'Explainable reasoning chain', status: 'SUPPORTED', evidence: ['services/ai-reasoning-engine.ts', 'ai_reasoning_chains', 'aint_interpretations'] },
  { key: 'recommendation', label: 'Development recommendation', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'development_recommendations', 'aint_interpretations'] },
  { key: 'confidence_scoring', label: 'Interpretation confidence', status: 'PARTIAL', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_interpretations'] },
];

// Report sections (8)
export const REPORT_SECTIONS: AintControl[] = [
  { key: 'overview', label: 'Overview', status: 'SUPPORTED', evidence: ['services/dynamic-report.ts', 'services/assessment-intelligence-mechanisms.ts', 'aint_reports'] },
  { key: 'score_summary', label: 'Score summary', status: 'SUPPORTED', evidence: ['services/dynamic-report.ts', 'aint_reports'] },
  { key: 'norm_interpretation', label: 'Norm interpretation', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_reports'] },
  { key: 'benchmark', label: 'Benchmark comparison', status: 'SUPPORTED', evidence: ['services/benchmark-engine.ts', 'aint_reports'] },
  { key: 'narrative', label: 'AI narrative', status: 'SUPPORTED', evidence: ['services/intelligence-narrative-engine.ts', 'aint_reports'] },
  { key: 'strengths_development', label: 'Strengths & development areas', status: 'SUPPORTED', evidence: ['services/intelligence-narrative-engine.ts', 'aint_reports'] },
  { key: 'recommendations', label: 'Recommendations', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_reports'] },
  { key: 'next_steps', label: 'Next steps / action plan', status: 'PARTIAL', evidence: ['services/dynamic-report.ts', 'aint_reports'] },
];

// Candidate-performance metrics (8)
export const PERFORMANCE_METRICS: AintControl[] = [
  { key: 'overall_standing', label: 'Overall standing', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_performance'] },
  { key: 'dimension_profile', label: 'Dimension profile', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_performance'] },
  { key: 'percentile_standing', label: 'Percentile standing', status: 'SUPPORTED', evidence: ['services/psychometric-standardization.ts', 'aint_performance'] },
  { key: 'peer_relative', label: 'Peer-relative standing', status: 'SUPPORTED', evidence: ['services/peer-benchmark.ts', 'aint_performance'] },
  { key: 'growth_trajectory', label: 'Growth trajectory', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'wc3_longitudinal_snapshots', 'aint_performance'] },
  { key: 'readiness_band', label: 'Readiness band', status: 'SUPPORTED', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_performance'] },
  { key: 'consistency', label: 'Response consistency', status: 'PARTIAL', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_performance'] },
  { key: 'response_time', label: 'Response-time analytics', status: 'PARTIAL', evidence: ['services/assessment-intelligence-mechanisms.ts', 'aint_performance'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING MODEL (9) — every scored result flows into a certified intelligence artefact
// ─────────────────────────────────────────────────────────────────────────────
export interface MappingRow { key: string; label: string; target: string; source: string; status: AintStatus; note: string }
export const MAPPING_MODEL: MappingRow[] = [
  { key: 'scored_result', label: 'Scored result', target: 'Assessment Scoring (3.5)', source: 'services/assessment-scoring-mechanisms.ts', status: 'SUPPORTED', note: 'Interpretation consumes the measurable scores produced by the 3.5 scoring engine (score→intelligence handoff).' },
  { key: 'science_handoff', label: 'Science handoff', target: 'Assessment Science (3.6)', source: 'config/assessment-science.ts', status: 'SUPPORTED', note: 'Interpretation consumes reliability/validity/norm handoff from 3.6 — norm-referencing rides the science seam.' },
  { key: 'norm_reference', label: 'Norm reference', target: 'Norm Referencing (this phase)', source: 'aint_norm_tables', status: 'SUPPORTED', note: 'Every raw score maps to a norm reference (cohort/role/stage/self) in aint_norm_tables — ABSTAINS below k_min.' },
  { key: 'standard_score', label: 'Standard score', target: 'Standardization (this phase)', source: 'services/psychometric-standardization.ts', status: 'SUPPORTED', note: 'Every raw score maps to percentile/z/T/stanine/sten/deviation standard scores in aint_standard_scores.' },
  { key: 'benchmark', label: 'Benchmark', target: 'Benchmarking (this phase)', source: 'aint_benchmarks', status: 'SUPPORTED', note: 'Every standardized score maps to peer/role/stage/temporal benchmarks in aint_benchmarks — ABSTAINS below k_min.' },
  { key: 'ai_narrative', label: 'AI narrative', target: 'AI Interpretation (this phase)', source: 'services/intelligence-narrative-engine.ts', status: 'SUPPORTED', note: 'Every interpreted score maps to a narrative (strengths/development/reasoning/recommendations) in aint_interpretations.' },
  { key: 'report', label: 'Report', target: 'Report Intelligence (this phase)', source: 'services/dynamic-report.ts', status: 'SUPPORTED', note: 'Every interpretation maps to a structured, section-aware report in aint_reports.' },
  { key: 'performance_analytics', label: 'Performance analytics', target: 'Candidate Performance (this phase)', source: 'aint_performance', status: 'SUPPORTED', note: 'Every candidate maps to overall standing / dimension profile / percentile / growth-trajectory analytics in aint_performance.' },
  { key: 'outcome_handoff', label: 'Outcome & KPI handoff', target: 'Outcome & KPI (1.6) / Program cert', source: 'config/outcome-kpi-model.ts', status: 'PARTIAL', note: 'Interpretation ends at meaning (norms/standard-scores/benchmarks/narrative/report/performance); realized outcomes & KPI roll-up are the downstream Outcome/KPI scope (out of this engine).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// EIGHT certification DIMENSIONS — evidence anchored in REAL substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const AINT_DIMENSIONS: AintDimension[] = [
  {
    key: 'norms', label: 'Norm Referencing', status: 'SUPPORTED',
    statusNote: 'ONE canonical norm-referencing layer (aint_norm_tables) interpreting a raw score against a cohort / role / stage / self reference group by COMPOSING the existing peer-benchmark (k-anonymous cohort) + benchmark-engine (role) + stage bands. Norm-referenced statistics ABSTAIN below k_min real members. Age / national / custom norms stay PARTIAL — data-availability boundaries, not engineering gaps.',
    evidence: {
      services: ['services/peer-benchmark.ts', 'services/benchmark-engine.ts', 'services/assessment-intelligence-engine.ts', 'services/assessment-intelligence-mechanisms.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: ['components/superadmin/AssessmentIntelligencePanel.tsx', 'components/intelligence/InterpretationWorkbench.tsx'],
      tables: ['capadex_sessions', 'scoring_runs', 'aint_norm_tables'],
    },
  },
  {
    key: 'standardization', label: 'Standardization', status: 'SUPPORTED',
    statusNote: 'ONE canonical standardization layer (aint_standard_scores) transforming a raw score into percentile / z / T / stanine / sten / deviation standard scores by COMPOSING the pure psychometric-standardization functions (zFromValue/zToPercentile/zToT/zToStanine/zToSten/zToDeviationScore). Pure transforms — no adoption dependency. NCE & scaled scores stay PARTIAL (display / scale boundaries).',
    evidence: {
      services: ['services/psychometric-standardization.ts', 'services/assessment-intelligence-mechanisms.ts', 'services/assessment-intelligence-engine.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: ['components/intelligence/InterpretationWorkbench.tsx'],
      tables: ['scoring_runs', 'aint_standard_scores'],
    },
  },
  {
    key: 'benchmarking', label: 'Benchmarking', status: 'SUPPORTED',
    statusNote: 'ONE canonical benchmarking layer (aint_benchmarks) comparing a candidate against peer-cohort / role / stage / temporal-self reference groups by COMPOSING peer-benchmark + benchmark-engine + longitudinal snapshots. Benchmarks ABSTAIN below k_min real members. Institution & national benchmarks stay PARTIAL until those reference groups are populated.',
    evidence: {
      services: ['services/peer-benchmark.ts', 'services/benchmark-engine.ts', 'services/assessment-intelligence-mechanisms.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: ['components/intelligence/InterpretationWorkbench.tsx'],
      tables: ['wc3_longitudinal_snapshots', 'aint_benchmarks'],
    },
  },
  {
    key: 'ai_interpretation', label: 'AI Interpretation', status: 'SUPPORTED',
    statusNote: 'ONE canonical AI-interpretation layer (aint_interpretations) generating a narrative (strengths / development areas / explainable reasoning chain / recommendation) over a scored result by COMPOSING intelligence-narrative-engine + ai-reasoning-engine + the development-recommendation substrate. Interpretation confidence stays honestly null while cold-start / uncalibrated (never fabricated).',
    evidence: {
      services: ['services/intelligence-narrative-engine.ts', 'services/ai-reasoning-engine.ts', 'services/assessment-intelligence-mechanisms.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: ['components/intelligence/InterpretationWorkbench.tsx'],
      tables: ['ai_reasoning_chains', 'development_recommendations', 'aint_interpretations'],
    },
  },
  {
    key: 'report_intelligence', label: 'Report Intelligence', status: 'SUPPORTED',
    statusNote: 'ONE canonical report-intelligence layer (aint_reports) composing a structured, section-aware interpretation report (overview → score summary → norm interpretation → benchmark → narrative → strengths/development → recommendations → next steps) by COMPOSING dynamic-report + the interpretation artefacts. Next-steps / action-plan stays PARTIAL until action plans are first-class.',
    evidence: {
      services: ['services/dynamic-report.ts', 'services/assessment-intelligence-mechanisms.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: ['components/intelligence/InterpretationWorkbench.tsx'],
      tables: ['capadex_reports', 'aint_reports'],
    },
  },
  {
    key: 'candidate_performance', label: 'Candidate Performance', status: 'SUPPORTED',
    statusNote: 'ONE canonical candidate-performance layer (aint_performance) surfacing overall standing / dimension profile / percentile standing / peer-relative standing / growth trajectory / readiness band by COMPOSING the standardization + benchmark + longitudinal substrate. Response-consistency & response-time analytics stay PARTIAL until per-item timing is captured.',
    evidence: {
      services: ['services/assessment-intelligence-mechanisms.ts', 'services/psychometric-standardization.ts', 'services/peer-benchmark.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: ['components/intelligence/InterpretationWorkbench.tsx'],
      tables: ['wc3_longitudinal_snapshots', 'aint_performance'],
    },
  },
  {
    key: 'apis', label: 'Intelligence APIs', status: 'SUPPORTED',
    statusNote: 'norm / standardization / benchmark / narrative / report / performance / repository endpoints under /api/admin/assessment-intelligence, composing the existing interpretation services. Read certifications are GET (to_regclass/fs probes); pure interpretation computes are pure POSTs; overlay writes are flag-gated POSTs.',
    evidence: {
      services: ['services/assessment-intelligence-engine.ts', 'services/assessment-intelligence-mechanisms.ts'],
      routes: ['routes/assessment-intelligence.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Intelligence Frontend', status: 'SUPPORTED',
    statusNote: 'Super-admin certification console + interactive interpretation workbench (norm interpretation / standard-score preview / benchmark comparison / AI narrative / report sections / candidate-performance) nested in the competency-framework admin shell.',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/AssessmentIntelligencePanel.tsx', 'components/intelligence/InterpretationWorkbench.tsx'],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN intelligence decisions (freeze invariants)
// ─────────────────────────────────────────────────────────────────────────────
export interface AintDecision { id: string; title: string; decision: string }
export const AINT_DECISIONS: AintDecision[] = [
  { id: 'D1', title: 'Compose, never duplicate', decision: 'Assessment Intelligence COMPOSES the existing interpretation services (psychometric-standardization, benchmark-engine, peer-benchmark, intelligence-narrative-engine, ai-reasoning-engine, dynamic-report) under one registry + an additive aint_* overlay — NO duplicate interpretation/benchmark/narrative/report engine, NO V2.' },
  { id: 'D2', title: 'Downstream of scoring & science', decision: 'Interpretation consumes the measurable scores (3.5) + reliability/validity/norm handoff (3.6). It NEVER re-scores, NEVER re-validates the instrument; it turns a scored+validated result into MEANING.' },
  { id: 'D3', title: 'Eight dimensions certified SEPARATELY', decision: 'norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis are reported SEPARATELY and NEVER composited into a single score.' },
  { id: 'D4', title: 'ABSTAIN below k_min; confidence honest-null', decision: 'Norm-referenced statistics + benchmarks ABSTAIN below k_min real members in the reference group. AI narrative confidence stays null while cold-start / uncalibrated. null (unknown) ≠ 0 (absent). Never fabricate.' },
  { id: 'D5', title: 'Byte-identical OFF incl. schema', decision: 'All DDL runs only on the flag-gated write paths; read certifications are GET (to_regclass/fs probes) and pure computes are side-effect-free. OFF is byte-identical incl. schema (0 aint_* tables).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN engineering gaps (all engineering-closed via reuse-before-build) + RESOLVED
// ─────────────────────────────────────────────────────────────────────────────
export interface AintGap { id: string; severity: GapSeverity; axis: AintAxis; title: string; detail: string }
export const AINT_GAPS: AintGap[] = [];

export interface ResolvedAintGap { id: string; severity: GapSeverity; axis: AintAxis; title: string; resolution: string }
export const RESOLVED_AINT_GAPS: ResolvedAintGap[] = [
  { id: 'GAP-AINT-1', severity: 'High', axis: 'norms', title: 'No canonical norm-referencing layer', resolution: 'ENGINEERING-CLOSED via reuse: aint_norm_tables + composeNormReference reusing peer-benchmark (cohort) + benchmark-engine (role) + stage bands; ABSTAINS below k_min. Age/national/custom norms are data-availability boundaries (PARTIAL), not gaps.' },
  { id: 'GAP-AINT-2', severity: 'High', axis: 'standardization', title: 'No standard-score transforms surfaced', resolution: 'ENGINEERING-CLOSED via reuse: aint_standard_scores + computeStandardScores reusing the pure psychometric-standardization functions (percentile/z/T/stanine/sten/deviation). NCE/scaled are display/scale boundaries (PARTIAL).' },
  { id: 'GAP-AINT-3', severity: 'High', axis: 'benchmarking', title: 'No unified benchmarking layer', resolution: 'ENGINEERING-CLOSED via reuse: aint_benchmarks + composeBenchmark reusing peer-benchmark + benchmark-engine + longitudinal snapshots (peer/role/stage/temporal-self); ABSTAINS below k_min. Institution/national are data boundaries (PARTIAL).' },
  { id: 'GAP-AINT-4', severity: 'Medium', axis: 'ai_interpretation', title: 'No narrative interpretation over scored results', resolution: 'ENGINEERING-CLOSED via reuse: aint_interpretations + composeInterpretation reusing intelligence-narrative-engine + ai-reasoning-engine + development-recommendation substrate. Interpretation confidence stays honest-null while cold-start.' },
  { id: 'GAP-AINT-5', severity: 'Medium', axis: 'report_intelligence', title: 'No section-aware interpretation report', resolution: 'ENGINEERING-CLOSED via reuse: aint_reports + composeReport reusing dynamic-report + the interpretation artefacts (8 sections). Next-steps/action-plan is a first-class-objective boundary (PARTIAL).' },
  { id: 'GAP-AINT-6', severity: 'Medium', axis: 'candidate_performance', title: 'No candidate-performance analytics', resolution: 'ENGINEERING-CLOSED via reuse: aint_performance + composePerformance reusing standardization + peer-benchmark + longitudinal substrate (standing/profile/percentile/peer-relative/growth/readiness). Consistency/response-time need per-item timing (PARTIAL).' },
];
