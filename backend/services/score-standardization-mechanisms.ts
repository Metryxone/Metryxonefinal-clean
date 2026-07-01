/**
 * CAPADEX 3.0 — Program 3 · Phase 3.8 Enterprise Score Standardization & Interpretation — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build implementation mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureStdSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The additive
 * overlay tables are:
 *   astd_formulas           — versioned standardization / composite formulas (STRUCTURED AST, no eval).
 *   astd_standard_scores    — per-subject standardized scores with full traceability provenance.
 *   astd_bands              — canonical + custom organizational performance-band sets.
 *   astd_interpretation_rules — deterministic interpretation rule repository.
 *   astd_configs            — scoped standardization configuration (assessment/persona/lifecycle/…).
 *   astd_governance_log     — append-only lifecycle transitions + version history + rollback + audit.
 *   astd_validations        — formula / distribution / range / boundary / statistical validation results.
 *
 * The PURE compute helpers (computeStandardScoreSet / evaluateFormula / validateFormula / classifyBand /
 * evaluateInterpretationRule / validateDistribution / …) have NO DB + NO DDL + NO eval — they are
 * deterministic + side-effect free and REUSE the existing pure psychometric-standardization functions
 * (zFromValue / zToPercentile / zToT / zToStanine / zToSten / zToDeviationScore / standardScoresFromZ).
 *
 * Formulas are a STRUCTURED AST (const / var / op / weighted / clamp / standardize nodes) evaluated by a
 * WHITELISTED interpreter — NEVER eval / new Function / string-executed (Phase 3.5 lesson). Formulas are
 * validated before evaluation. Norm-referenced standardization ABSTAINS below k_min real members.
 *
 * Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty).
 * This module STANDARDIZES a scored result against a norm — it never re-scores, re-validates, or benchmarks.
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { STD_K_MIN } from '../config/score-standardization';
import {
  zFromValue, zToPercentile, standardScoresFromZ, type StandardScoreSet,
} from './psychometric-standardization';

function assertEnabled(): void {
  if (!isFlagEnabled('scoreStandardization')) {
    throw new Error('score_standardization_disabled');
  }
}

let schemaReady = false;
export async function ensureStdSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS astd_formulas (
      id             BIGSERIAL PRIMARY KEY,
      formula_key    TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      label          TEXT,
      score_type     TEXT NOT NULL DEFAULT 'overall',
      ast            JSONB NOT NULL DEFAULT '{}'::jsonb,
      valid          BOOLEAN NOT NULL DEFAULT false,
      state          TEXT NOT NULL DEFAULT 'draft',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (formula_key, version)
    );
    CREATE INDEX IF NOT EXISTS astd_formulas_key_idx ON astd_formulas(formula_key);
    CREATE TABLE IF NOT EXISTS astd_standard_scores (
      id             BIGSERIAL PRIMARY KEY,
      score_key      TEXT NOT NULL,
      subject_ref    TEXT NOT NULL DEFAULT '',
      assessment_slug TEXT NOT NULL DEFAULT '',
      score_type     TEXT NOT NULL DEFAULT 'overall',
      raw_value      DOUBLE PRECISION,
      z              DOUBLE PRECISION,
      percentile     DOUBLE PRECISION,
      t_score        DOUBLE PRECISION,
      standard_score DOUBLE PRECISION,
      stanine        DOUBLE PRECISION,
      sten           DOUBLE PRECISION,
      band           TEXT,
      -- traceability provenance (raw → assessment ver → formula ver → norm ver → std ver → rule)
      assessment_version TEXT,
      formula_key    TEXT,
      formula_version INTEGER,
      norm_key       TEXT,
      config_key     TEXT,
      config_version INTEGER,
      rule_key       TEXT,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (assessment_slug, subject_ref, score_key)
    );
    CREATE INDEX IF NOT EXISTS astd_standard_scores_subject_idx ON astd_standard_scores(subject_ref);
    CREATE TABLE IF NOT EXISTS astd_bands (
      id             BIGSERIAL PRIMARY KEY,
      band_set_key   TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      label          TEXT,
      scope          TEXT NOT NULL DEFAULT 'custom',
      bands          JSONB NOT NULL DEFAULT '[]'::jsonb,
      state          TEXT NOT NULL DEFAULT 'draft',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (band_set_key, version)
    );
    CREATE TABLE IF NOT EXISTS astd_interpretation_rules (
      id             BIGSERIAL PRIMARY KEY,
      rule_key       TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      rule_type      TEXT NOT NULL DEFAULT 'score',
      label          TEXT,
      band_set_key   TEXT,
      verdicts       JSONB NOT NULL DEFAULT '[]'::jsonb,
      state          TEXT NOT NULL DEFAULT 'draft',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (rule_key, version)
    );
    CREATE INDEX IF NOT EXISTS astd_interpretation_rules_type_idx ON astd_interpretation_rules(rule_type);
    CREATE TABLE IF NOT EXISTS astd_configs (
      id             BIGSERIAL PRIMARY KEY,
      config_key     TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      scope          TEXT NOT NULL DEFAULT 'assessment',
      scope_ref      TEXT NOT NULL DEFAULT '',
      label          TEXT,
      formula_key    TEXT,
      band_set_key   TEXT,
      rule_key       TEXT,
      state          TEXT NOT NULL DEFAULT 'draft',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (config_key, version)
    );
    CREATE INDEX IF NOT EXISTS astd_configs_scope_idx ON astd_configs(scope, scope_ref);
    CREATE TABLE IF NOT EXISTS astd_governance_log (
      id             BIGSERIAL PRIMARY KEY,
      artefact_type  TEXT NOT NULL DEFAULT 'formula',
      artefact_key   TEXT NOT NULL,
      artefact_version INTEGER NOT NULL DEFAULT 1,
      from_state     TEXT,
      to_state       TEXT NOT NULL,
      action         TEXT NOT NULL DEFAULT 'transition',
      actor          TEXT,
      note           TEXT,
      snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS astd_governance_log_artefact_idx ON astd_governance_log(artefact_type, artefact_key);
    CREATE TABLE IF NOT EXISTS astd_validations (
      id             BIGSERIAL PRIMARY KEY,
      validation_key TEXT NOT NULL,
      artefact_type  TEXT NOT NULL DEFAULT 'formula',
      artefact_key   TEXT,
      check_type     TEXT NOT NULL DEFAULT 'formula',
      passed         BOOLEAN NOT NULL DEFAULT false,
      errors         JSONB NOT NULL DEFAULT '[]'::jsonb,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS astd_validations_artefact_idx ON astd_validations(artefact_type, artefact_key);
  `);
  schemaReady = true;
}

/** null on error (unreadable), 0 on no rows (empty). null ≠ 0. */
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0] ? Object.values(rows[0])[0] : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

/**
 * Read-only helpers: NEVER touch DDL. If the overlay table is absent (flag never
 * exercised via a write), the query throws → we honestly return empty ([] / null),
 * NEVER CREATE TABLE. DDL lives ONLY on the write paths (via ensureStdSchema).
 */
async function safeRows(pool: Pool, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows as Record<string, unknown>[];
  } catch {
    return [];
  }
}

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const round2 = (n: number | null): number | null => (n == null || !Number.isFinite(n) ? null : +n.toFixed(2));

// ═════════════════════════════════════════════════════════════════════════════
// PURE COMPUTE — deterministic, NO DB, NO DDL, NO eval. REUSE-before-build.
// STANDARDIZES a scored result against a norm — NEVER re-scores / re-validates.
// ═════════════════════════════════════════════════════════════════════════════

export interface StandardScoreResult extends StandardScoreSet {
  input: { value: number | null; mean: number | null; sd: number | null; n: number };
  standard_score: number | null;  // alias of deviation_score (μ=100,σ=15) — canonical "standard score"
  band: BandKey | null;
  abstained: boolean;
  reason?: string;
}
/**
 * PURE standardization: transform a raw value into the full canonical standard-score set against a
 * reference (mean, sd, n). ABSTAINS when the reference group is thin (< k_min) OR the distribution is
 * undefined (sd null/≤0) — then z is null and EVERY standard score is null (NEVER fabricated). Reuses
 * zFromValue + standardScoresFromZ.
 */
export function computeStandardScoreSet(
  value: number | null, mean: number | null, sd: number | null, n = STD_K_MIN, options: { k_min?: number } = {},
): StandardScoreResult {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : STD_K_MIN;
  const members = Number.isFinite(Number(n)) ? Number(n) : 0;
  const thin = members < kMin;
  const z = thin ? null : zFromValue(value, mean, sd);
  const set = standardScoresFromZ(z);
  const abstained = z == null;
  // The canonical "standard score" (μ=100, σ=15) is a deviation quotient built from z, NOT the SD-15
  // 0..100 deviation_score. Keep both: deviation_score (0..100 display) + standard_score (100±15).
  const standard_score = z == null ? null : Math.round((100 + z * 15) * 10) / 10;
  return {
    input: { value: value ?? null, mean: mean ?? null, sd: sd ?? null, n: members },
    ...set,
    standard_score,
    band: bandFromPercentile(set.percentile),
    abstained,
    ...(abstained ? { reason: thin ? `below_k_min(${kMin})` : 'no_reference_distribution' } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED-AST FORMULA ENGINE (no eval / no new Function — Phase 3.5 lesson)
// ─────────────────────────────────────────────────────────────────────────────
export type FormulaNode =
  | { type: 'const'; value: number }
  | { type: 'var'; name: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/'; args: FormulaNode[] }
  | { type: 'weighted'; terms: { node: FormulaNode; weight: number }[] }
  | { type: 'clamp'; arg: FormulaNode; min: number; max: number }
  | { type: 'standardize'; arg: FormulaNode; mean: number; sd: number; to?: 'z' | 'percentile' };

const FORMULA_NODE_TYPES = new Set(['const', 'var', 'op', 'weighted', 'clamp', 'standardize']);
const FORMULA_OPS = new Set(['+', '-', '*', '/']);
const MAX_FORMULA_DEPTH = 24;

export interface FormulaValidation { valid: boolean; errors: string[]; variables: string[]; depth: number }
/**
 * Validate a structured formula AST: only whitelisted node types + ops, bounded depth (guards against
 * adversarial deep nesting), collects referenced variable names. NEVER executes anything.
 */
export function validateFormula(node: unknown, knownVars?: string[]): FormulaValidation {
  const errors: string[] = [];
  const variables = new Set<string>();
  const known = knownVars ? new Set(knownVars) : null;
  let maxDepth = 0;
  const walk = (n: unknown, depth: number): void => {
    if (depth > maxDepth) maxDepth = depth;
    if (depth > MAX_FORMULA_DEPTH) { errors.push(`max_depth_exceeded(${MAX_FORMULA_DEPTH})`); return; }
    if (!n || typeof n !== 'object') { errors.push('node_not_object'); return; }
    const t = (n as { type?: unknown }).type;
    if (typeof t !== 'string' || !FORMULA_NODE_TYPES.has(t)) { errors.push(`unknown_node_type(${String(t)})`); return; }
    if (t === 'const') {
      if (!Number.isFinite(Number((n as { value?: unknown }).value))) errors.push('const_value_not_finite');
    } else if (t === 'var') {
      const name = (n as { name?: unknown }).name;
      if (typeof name !== 'string' || !name) { errors.push('var_name_missing'); return; }
      variables.add(name);
      if (known && !known.has(name)) errors.push(`unknown_var(${name})`);
    } else if (t === 'op') {
      const op = (n as { op?: unknown }).op;
      const args = (n as { args?: unknown }).args;
      if (typeof op !== 'string' || !FORMULA_OPS.has(op)) errors.push(`unknown_op(${String(op)})`);
      if (!Array.isArray(args) || args.length < 1) { errors.push('op_args_missing'); return; }
      for (const a of args) walk(a, depth + 1);
    } else if (t === 'weighted') {
      const terms = (n as { terms?: unknown }).terms;
      if (!Array.isArray(terms) || terms.length < 1) { errors.push('weighted_terms_missing'); return; }
      for (const term of terms) {
        if (!term || typeof term !== 'object') { errors.push('weighted_term_not_object'); continue; }
        if (!Number.isFinite(Number((term as { weight?: unknown }).weight))) errors.push('weighted_weight_not_finite');
        walk((term as { node?: unknown }).node, depth + 1);
      }
    } else if (t === 'clamp') {
      if (!Number.isFinite(Number((n as { min?: unknown }).min))) errors.push('clamp_min_not_finite');
      if (!Number.isFinite(Number((n as { max?: unknown }).max))) errors.push('clamp_max_not_finite');
      walk((n as { arg?: unknown }).arg, depth + 1);
    } else if (t === 'standardize') {
      if (!Number.isFinite(Number((n as { mean?: unknown }).mean))) errors.push('standardize_mean_not_finite');
      const sd = Number((n as { sd?: unknown }).sd);
      if (!Number.isFinite(sd) || sd <= 0) errors.push('standardize_sd_invalid');
      walk((n as { arg?: unknown }).arg, depth + 1);
    }
  };
  walk(node, 1);
  return { valid: errors.length === 0, errors, variables: [...variables], depth: maxDepth };
}

/**
 * Evaluate a structured formula AST against a variables map. NULL-propagating: a missing/undefined var or
 * a division by zero yields null (never NaN/Infinity/fabricated). Whitelisted interpreter — NO eval.
 * Depth-bounded (mirrors validateFormula). Returns null for any invalid / unresolvable node.
 */
export function evaluateFormula(node: unknown, vars: Record<string, number | null | undefined> = {}): number | null {
  const ev = (n: unknown, depth: number): number | null => {
    if (depth > MAX_FORMULA_DEPTH) return null;
    if (!n || typeof n !== 'object') return null;
    const t = (n as { type?: unknown }).type;
    if (typeof t !== 'string' || !FORMULA_NODE_TYPES.has(t)) return null;
    switch (t) {
      case 'const': {
        const v = Number((n as { value?: unknown }).value);
        return Number.isFinite(v) ? v : null;
      }
      case 'var': {
        const name = (n as { name?: unknown }).name;
        if (typeof name !== 'string') return null;
        const v = vars[name];
        return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      }
      case 'op': {
        const op = (n as { op?: unknown }).op as string;
        const args = (n as { args?: unknown }).args;
        if (!FORMULA_OPS.has(op) || !Array.isArray(args) || !args.length) return null;
        const vals = args.map((a) => ev(a, depth + 1));
        if (vals.some((v) => v == null)) return null;
        const nums = vals as number[];
        if (op === '+') return nums.reduce((a, b) => a + b, 0);
        if (op === '*') return nums.reduce((a, b) => a * b, 1);
        if (op === '-') return nums.slice(1).reduce((a, b) => a - b, nums[0]);
        if (op === '/') {
          let acc = nums[0];
          for (const d of nums.slice(1)) { if (d === 0) return null; acc /= d; }
          return acc;
        }
        return null;
      }
      case 'weighted': {
        const terms = (n as { terms?: unknown }).terms;
        if (!Array.isArray(terms) || !terms.length) return null;
        let acc = 0;
        for (const term of terms) {
          if (!term || typeof term !== 'object') return null;
          const w = Number((term as { weight?: unknown }).weight);
          const v = ev((term as { node?: unknown }).node, depth + 1);
          if (!Number.isFinite(w) || v == null) return null;
          acc += w * v;
        }
        return acc;
      }
      case 'clamp': {
        const v = ev((n as { arg?: unknown }).arg, depth + 1);
        const min = Number((n as { min?: unknown }).min);
        const max = Number((n as { max?: unknown }).max);
        if (v == null || !Number.isFinite(min) || !Number.isFinite(max)) return null;
        return Math.max(min, Math.min(max, v));
      }
      case 'standardize': {
        const v = ev((n as { arg?: unknown }).arg, depth + 1);
        const mean = Number((n as { mean?: unknown }).mean);
        const sd = Number((n as { sd?: unknown }).sd);
        const z = zFromValue(v, mean, sd);
        if (z == null) return null;
        const to = (n as { to?: unknown }).to;
        return to === 'percentile' ? zToPercentile(z) : Math.round(z * 1000) / 1000;
      }
      default:
        return null;
    }
  };
  return ev(node, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE BAND ENGINE — classify a standardized score into a qualitative band
// ─────────────────────────────────────────────────────────────────────────────
export type BandKey =
  | 'outstanding' | 'excellent' | 'strong' | 'above_average'
  | 'average' | 'developing' | 'needs_improvement' | 'critical';

export interface BandDef { key: string; label?: string; min_percentile: number }
// Canonical default band set (percentile floors). Boundaries are config-overridable via astd_bands.
export const DEFAULT_BAND_SET: BandDef[] = [
  { key: 'outstanding', label: 'Outstanding', min_percentile: 98 },
  { key: 'excellent', label: 'Excellent', min_percentile: 90 },
  { key: 'strong', label: 'Strong', min_percentile: 75 },
  { key: 'above_average', label: 'Above average', min_percentile: 60 },
  { key: 'average', label: 'Average', min_percentile: 40 },
  { key: 'developing', label: 'Developing', min_percentile: 25 },
  { key: 'needs_improvement', label: 'Needs improvement', min_percentile: 10 },
  { key: 'critical', label: 'Critical', min_percentile: 0 },
];

/** Canonical band from a percentile (0..100) using the default band set. null percentile → null band. */
export function bandFromPercentile(p: number | null): BandKey | null {
  if (p == null || !Number.isFinite(p)) return null;
  for (const b of DEFAULT_BAND_SET) if (p >= b.min_percentile) return b.key as BandKey;
  return 'critical';
}

export interface BandClassification { percentile: number | null; band: string | null; label: string | null; band_set: 'default' | 'custom'; abstained: boolean }
/**
 * PURE band classification: classify a percentile into a band using an OPTIONAL custom band set (sorted
 * by min_percentile desc). Falls back to the canonical DEFAULT_BAND_SET. null percentile → abstained.
 */
export function classifyBand(percentile: number | null, customBands?: BandDef[]): BandClassification {
  const usingCustom = Array.isArray(customBands) && customBands.length > 0;
  if (percentile == null || !Number.isFinite(percentile)) {
    return { percentile: null, band: null, label: null, band_set: usingCustom ? 'custom' : 'default', abstained: true };
  }
  const set = usingCustom
    ? [...customBands!].filter((b) => Number.isFinite(Number(b?.min_percentile))).sort((a, b) => Number(b.min_percentile) - Number(a.min_percentile))
    : DEFAULT_BAND_SET;
  for (const b of set) {
    if (percentile >= Number(b.min_percentile)) {
      return { percentile: round2(percentile), band: String(b.key), label: b.label ? String(b.label) : String(b.key), band_set: usingCustom ? 'custom' : 'default', abstained: false };
    }
  }
  const last = set[set.length - 1];
  return { percentile: round2(percentile), band: last ? String(last.key) : null, label: last?.label ? String(last.label) : (last ? String(last.key) : null), band_set: usingCustom ? 'custom' : 'default', abstained: false };
}

export interface HeatmapCell { band: string; label: string; count: number }
export interface HeatmapRow { cohort: string; n: number; cells: HeatmapCell[] }
export interface HeatmapResult { bands: { key: string; label: string }[]; rows: HeatmapRow[]; total: number }
/**
 * PURE per-cohort band heat map: for each cohort's list of percentiles, count how many fall into each band
 * of the default (or an OPTIONAL custom) band set — reusing classifyBand. Non-finite percentiles are
 * ignored (they contribute to neither n nor any band). Deterministic; persists nothing; never fabricated.
 */
export function computeHeatmap(cohorts: Record<string, Array<number | null>>, customBands?: BandDef[]): HeatmapResult {
  const set = Array.isArray(customBands) && customBands.length
    ? [...customBands].filter((b) => Number.isFinite(Number(b?.min_percentile))).sort((a, b) => Number(b.min_percentile) - Number(a.min_percentile))
    : DEFAULT_BAND_SET;
  const bands = set.map((b) => ({ key: String(b.key), label: b.label ? String(b.label) : String(b.key) }));
  const rows: HeatmapRow[] = [];
  let total = 0;
  const entries = cohorts && typeof cohorts === 'object' ? Object.entries(cohorts) : [];
  for (const [cohort, values] of entries) {
    const counts = new Map<string, number>();
    let n = 0;
    const list = Array.isArray(values) ? values : [];
    for (const v of list) {
      const p = v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      if (p == null) continue;
      const cls = classifyBand(p, customBands);
      if (!cls.band) continue;
      counts.set(cls.band, (counts.get(cls.band) ?? 0) + 1);
      n += 1; total += 1;
    }
    rows.push({ cohort: String(cohort), n, cells: bands.map((b) => ({ band: b.key, label: b.label, count: counts.get(b.key) ?? 0 })) });
  }
  return { bands, rows, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERPRETATION RULE ENGINE — deterministic verdicts from a standardized score
// ─────────────────────────────────────────────────────────────────────────────
export type RiskCategory = 'low' | 'moderate' | 'high' | null;
export type ReadinessCategory = 'emerging' | 'developing' | 'proficient' | 'advanced' | null;

function riskFromBand(band: string | null): RiskCategory {
  if (!band) return null;
  if (['outstanding', 'excellent', 'strong', 'above_average'].includes(band)) return 'low';
  if (['average', 'developing'].includes(band)) return 'moderate';
  return 'high';
}
function developmentPriorityFromBand(band: string | null): 'none' | 'monitor' | 'targeted' | 'urgent' | null {
  if (!band) return null;
  if (['outstanding', 'excellent', 'strong'].includes(band)) return 'none';
  if (['above_average', 'average'].includes(band)) return 'monitor';
  if (band === 'developing') return 'targeted';
  return 'urgent';
}
export function readinessFromPercentile(p: number | null): ReadinessCategory {
  if (p == null || !Number.isFinite(p)) return null;
  if (p < 25) return 'emerging';
  if (p < 50) return 'developing';
  if (p < 80) return 'proficient';
  return 'advanced';
}

export interface RuleVerdict { min_percentile: number; verdict: string; label?: string }
export interface InterpretationResult {
  ref: string;
  rule_type: string;
  percentile: number | null;
  band: string | null;
  band_label: string | null;
  verdict: string | null;
  risk_category: RiskCategory;
  development_priority: ReturnType<typeof developmentPriorityFromBand>;
  readiness_category: ReadinessCategory;
  source: 'deterministic';
  abstained: boolean;
  reason?: string;
}
/**
 * PURE interpretation: deterministically interpret a standardized percentile into a band verdict + risk /
 * development-priority / readiness categories. If custom rule verdicts are supplied they override the
 * band verdict (else the canonical band is the verdict). ABSTAINS on null percentile — never fabricated.
 */
export function evaluateInterpretationRule(input: {
  ref?: string; rule_type?: string; percentile: number | null; customBands?: BandDef[]; verdicts?: RuleVerdict[];
} = { percentile: null }): InterpretationResult {
  const ref = input?.ref ? String(input.ref) : 'candidate';
  const rule_type = input?.rule_type ? String(input.rule_type) : 'score';
  const p = input?.percentile == null || !Number.isFinite(Number(input.percentile)) ? null : num(input.percentile);
  if (p == null) {
    return { ref, rule_type, percentile: null, band: null, band_label: null, verdict: null, risk_category: null, development_priority: null, readiness_category: null, source: 'deterministic', abstained: true, reason: 'no_percentile' };
  }
  const cls = classifyBand(p, input?.customBands);
  let verdict: string | null = cls.band;
  const custom = Array.isArray(input?.verdicts) && input!.verdicts!.length
    ? [...input!.verdicts!].filter((v) => Number.isFinite(Number(v?.min_percentile))).sort((a, b) => Number(b.min_percentile) - Number(a.min_percentile))
    : null;
  if (custom) {
    verdict = null;
    for (const v of custom) if (p >= Number(v.min_percentile)) { verdict = String(v.verdict); break; }
  }
  return {
    ref, rule_type, percentile: round2(p), band: cls.band, band_label: cls.label, verdict,
    risk_category: riskFromBand(cls.band),
    development_priority: developmentPriorityFromBand(cls.band),
    readiness_category: readinessFromPercentile(p),
    source: 'deterministic', abstained: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION — formula / distribution / range / boundary / statistical / exception
// ─────────────────────────────────────────────────────────────────────────────
export interface ValidationResult { check_type: string; passed: boolean; errors: string[]; detail: Record<string, unknown> }

/** Distribution validation: n ≥ k_min AND sd > 0 (a usable reference distribution). */
export function validateDistribution(input: { n?: number | null; mean?: number | null; sd?: number | null } = {}, options: { k_min?: number } = {}): ValidationResult {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : STD_K_MIN;
  const errors: string[] = [];
  const n = Number(input?.n);
  const sd = Number(input?.sd);
  if (!Number.isFinite(n) || n < kMin) errors.push(`n_below_k_min(${kMin})`);
  if (!Number.isFinite(sd) || sd <= 0) errors.push('sd_not_positive');
  if (input?.mean != null && !Number.isFinite(Number(input.mean))) errors.push('mean_not_finite');
  return { check_type: 'distribution', passed: errors.length === 0, errors, detail: { n: Number.isFinite(n) ? n : null, sd: Number.isFinite(sd) ? sd : null, k_min: kMin } };
}

/** Range validation: value within [min,max] (inclusive). */
export function validateRange(value: number | null, min: number, max: number): ValidationResult {
  const errors: string[] = [];
  if (value == null || !Number.isFinite(Number(value))) errors.push('value_not_finite');
  else if (Number(value) < min || Number(value) > max) errors.push(`out_of_range[${min},${max}]`);
  return { check_type: 'range', passed: errors.length === 0, errors, detail: { value: value ?? null, min, max } };
}

/** Boundary validation: a band set covers 0..100 with monotonically-decreasing floors and no gaps/overlaps. */
export function validateBoundary(bands: BandDef[]): ValidationResult {
  const errors: string[] = [];
  const list = Array.isArray(bands) ? bands.filter((b) => Number.isFinite(Number(b?.min_percentile))) : [];
  if (!list.length) errors.push('no_bands');
  const floors = list.map((b) => Number(b.min_percentile));
  const sorted = [...floors].sort((a, b) => b - a);
  if (JSON.stringify(floors) !== JSON.stringify(sorted)) errors.push('floors_not_descending');
  if (floors.some((f) => f < 0 || f > 100)) errors.push('floor_out_of_0_100');
  if (list.length && sorted[sorted.length - 1] !== 0) errors.push('lowest_floor_not_0');
  if (new Set(floors).size !== floors.length) errors.push('duplicate_floors');
  return { check_type: 'boundary', passed: errors.length === 0, errors, detail: { floors } };
}

/** Statistical validation: sd within a plausible band and mean finite (guards degenerate references). */
export function validateStatistical(input: { mean?: number | null; sd?: number | null } = {}): ValidationResult {
  const errors: string[] = [];
  const mean = Number(input?.mean);
  const sd = Number(input?.sd);
  if (!Number.isFinite(mean)) errors.push('mean_not_finite');
  if (!Number.isFinite(sd) || sd <= 0) errors.push('sd_not_positive');
  return { check_type: 'statistical', passed: errors.length === 0, errors, detail: { mean: Number.isFinite(mean) ? mean : null, sd: Number.isFinite(sd) ? sd : null } };
}

export interface RegressionInput {
  mode?: 'formula' | 'band';
  baseline?: unknown;
  candidate?: unknown;
  samples?: unknown[];
  tolerance?: number;
  knownVars?: string[];
}
/**
 * Regression validation: prove a NEW artefact version does not silently diverge from a PRIOR baseline
 * across a set of reference inputs. In `formula` mode both ASTs are validated then evaluated over each
 * sample's vars and the absolute delta is compared against a tolerance; in `band` mode each sample
 * percentile is classified by both band sets and the band keys must match. Divergences beyond tolerance,
 * an invalid baseline/candidate, or an empty sample set are explicit errors — never fabricated as a pass.
 * PURE (reuses validateFormula/evaluateFormula/classifyBand); persists nothing.
 */
export function validateRegression(input: RegressionInput = {}): ValidationResult {
  const mode = input?.mode === 'band' ? 'band' : 'formula';
  const tolerance = Number.isFinite(Number(input?.tolerance)) ? Math.abs(Number(input.tolerance)) : 1e-9;
  const samples = Array.isArray(input?.samples) ? input!.samples! : [];
  const errors: string[] = [];
  const divergences: Array<Record<string, unknown>> = [];
  let maxAbsDelta: number | null = null;
  if (!samples.length) errors.push('no_samples');

  if (mode === 'formula') {
    const knownVars = Array.isArray(input?.knownVars) ? input!.knownVars!.map(String) : undefined;
    const baseV = validateFormula(input?.baseline as FormulaNode, knownVars);
    const candV = validateFormula(input?.candidate as FormulaNode, knownVars);
    if (!baseV.valid) errors.push('baseline_formula_invalid');
    if (!candV.valid) errors.push('candidate_formula_invalid');
    if (baseV.valid && candV.valid) {
      maxAbsDelta = 0;
      samples.forEach((s, i) => {
        const vars = (s && typeof s === 'object') ? (s as Record<string, number>) : {};
        const b = evaluateFormula(input!.baseline as FormulaNode, vars);
        const c = evaluateFormula(input!.candidate as FormulaNode, vars);
        if (b == null || c == null) { divergences.push({ index: i, baseline: b, candidate: c, reason: 'null_value' }); return; }
        const delta = Math.abs(Number(b) - Number(c));
        if (maxAbsDelta == null || delta > maxAbsDelta) maxAbsDelta = delta;
        if (delta > tolerance) divergences.push({ index: i, baseline: round2(Number(b)), candidate: round2(Number(c)), delta: round2(delta) });
      });
    }
  } else {
    samples.forEach((s, i) => {
      const p = s == null || !Number.isFinite(Number(s)) ? null : Number(s);
      const b = classifyBand(p, input?.baseline as BandDef[]);
      const c = classifyBand(p, input?.candidate as BandDef[]);
      if (b.band !== c.band) divergences.push({ index: i, percentile: p, baseline_band: b.band, candidate_band: c.band });
    });
  }
  if (divergences.length) errors.push(`regression_divergence(${divergences.length})`);
  return {
    check_type: 'regression',
    passed: errors.length === 0,
    errors,
    detail: { mode, tolerance, sample_count: samples.length, divergence_count: divergences.length, max_abs_delta: maxAbsDelta, divergences: divergences.slice(0, 50) },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERLAY WRITES (flag-gated; ensureStdSchema is the ONLY DDL site) + LISTS (read-only)
// ═════════════════════════════════════════════════════════════════════════════

export interface SaveFormulaInput { formula_key: string; version?: number; label?: string; score_type?: string; ast: FormulaNode; knownVars?: string[]; detail?: Record<string, unknown> }
export async function saveFormula(pool: Pool, input: SaveFormulaInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const v = validateFormula(input.ast, input.knownVars);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO astd_formulas (formula_key, version, label, score_type, ast, valid, detail)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb)
     ON CONFLICT (formula_key, version) DO UPDATE SET
       label=EXCLUDED.label, score_type=EXCLUDED.score_type, ast=EXCLUDED.ast, valid=EXCLUDED.valid,
       detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.formula_key, version, input.label ?? null, input.score_type ?? 'overall', JSON.stringify(input.ast ?? {}), v.valid, JSON.stringify({ ...(input.detail ?? {}), validation: v })],
  );
  return rows[0];
}
export async function listFormulas(pool: Pool, formulaKey?: string): Promise<Record<string, unknown>[]> {
  return formulaKey
    ? safeRows(pool, `SELECT * FROM astd_formulas WHERE formula_key=$1 ORDER BY version DESC`, [formulaKey])
    : safeRows(pool, `SELECT * FROM astd_formulas ORDER BY formula_key, version DESC LIMIT 500`);
}

export interface SaveStandardScoreInput {
  score_key: string; subject_ref?: string; assessment_slug?: string; score_type?: string;
  raw_value?: number | null; z?: number | null; percentile?: number | null; t_score?: number | null;
  standard_score?: number | null; stanine?: number | null; sten?: number | null; band?: string | null;
  assessment_version?: string | null; formula_key?: string | null; formula_version?: number | null;
  norm_key?: string | null; config_key?: string | null; config_version?: number | null; rule_key?: string | null;
  abstained?: boolean; detail?: Record<string, unknown>;
}
export async function saveStandardScore(pool: Pool, input: SaveStandardScoreInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO astd_standard_scores
       (score_key, subject_ref, assessment_slug, score_type, raw_value, z, percentile, t_score, standard_score,
        stanine, sten, band, assessment_version, formula_key, formula_version, norm_key, config_key, config_version,
        rule_key, abstained, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb)
     ON CONFLICT (assessment_slug, subject_ref, score_key) DO UPDATE SET
       score_type=EXCLUDED.score_type, raw_value=EXCLUDED.raw_value, z=EXCLUDED.z, percentile=EXCLUDED.percentile,
       t_score=EXCLUDED.t_score, standard_score=EXCLUDED.standard_score, stanine=EXCLUDED.stanine, sten=EXCLUDED.sten,
       band=EXCLUDED.band, assessment_version=EXCLUDED.assessment_version, formula_key=EXCLUDED.formula_key,
       formula_version=EXCLUDED.formula_version, norm_key=EXCLUDED.norm_key, config_key=EXCLUDED.config_key,
       config_version=EXCLUDED.config_version, rule_key=EXCLUDED.rule_key, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail
     RETURNING *`,
    [
      input.score_key, input.subject_ref ?? '', input.assessment_slug ?? '', input.score_type ?? 'overall',
      input.raw_value ?? null, input.z ?? null, input.percentile ?? null, input.t_score ?? null, input.standard_score ?? null,
      input.stanine ?? null, input.sten ?? null, input.band ?? null, input.assessment_version ?? null,
      input.formula_key ?? null, input.formula_version ?? null, input.norm_key ?? null, input.config_key ?? null,
      input.config_version ?? null, input.rule_key ?? null, input.abstained ?? false, JSON.stringify(input.detail ?? {}),
    ],
  );
  return rows[0];
}
export async function listStandardScores(pool: Pool, subjectRef?: string): Promise<Record<string, unknown>[]> {
  return subjectRef
    ? safeRows(pool, `SELECT * FROM astd_standard_scores WHERE subject_ref=$1 ORDER BY created_at DESC LIMIT 200`, [subjectRef])
    : safeRows(pool, `SELECT * FROM astd_standard_scores ORDER BY created_at DESC LIMIT 200`);
}

export interface SaveBandSetInput { band_set_key: string; version?: number; label?: string; scope?: string; bands: BandDef[]; detail?: Record<string, unknown> }
export async function saveBandSet(pool: Pool, input: SaveBandSetInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO astd_bands (band_set_key, version, label, scope, bands, detail)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
     ON CONFLICT (band_set_key, version) DO UPDATE SET
       label=EXCLUDED.label, scope=EXCLUDED.scope, bands=EXCLUDED.bands, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.band_set_key, version, input.label ?? null, input.scope ?? 'custom', JSON.stringify(input.bands ?? []), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listBandSets(pool: Pool, bandSetKey?: string): Promise<Record<string, unknown>[]> {
  return bandSetKey
    ? safeRows(pool, `SELECT * FROM astd_bands WHERE band_set_key=$1 ORDER BY version DESC`, [bandSetKey])
    : safeRows(pool, `SELECT * FROM astd_bands ORDER BY band_set_key, version DESC LIMIT 500`);
}

export interface SaveRuleInput { rule_key: string; version?: number; rule_type?: string; label?: string; band_set_key?: string; verdicts?: RuleVerdict[]; detail?: Record<string, unknown> }
export async function saveInterpretationRule(pool: Pool, input: SaveRuleInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO astd_interpretation_rules (rule_key, version, rule_type, label, band_set_key, verdicts, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     ON CONFLICT (rule_key, version) DO UPDATE SET
       rule_type=EXCLUDED.rule_type, label=EXCLUDED.label, band_set_key=EXCLUDED.band_set_key,
       verdicts=EXCLUDED.verdicts, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.rule_key, version, input.rule_type ?? 'score', input.label ?? null, input.band_set_key ?? null, JSON.stringify(input.verdicts ?? []), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listInterpretationRules(pool: Pool, ruleType?: string): Promise<Record<string, unknown>[]> {
  return ruleType
    ? safeRows(pool, `SELECT * FROM astd_interpretation_rules WHERE rule_type=$1 ORDER BY rule_key, version DESC`, [ruleType])
    : safeRows(pool, `SELECT * FROM astd_interpretation_rules ORDER BY rule_key, version DESC LIMIT 500`);
}

export interface SaveConfigInput { config_key: string; version?: number; scope?: string; scope_ref?: string; label?: string; formula_key?: string; band_set_key?: string; rule_key?: string; detail?: Record<string, unknown> }
export async function saveConfig(pool: Pool, input: SaveConfigInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO astd_configs (config_key, version, scope, scope_ref, label, formula_key, band_set_key, rule_key, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (config_key, version) DO UPDATE SET
       scope=EXCLUDED.scope, scope_ref=EXCLUDED.scope_ref, label=EXCLUDED.label, formula_key=EXCLUDED.formula_key,
       band_set_key=EXCLUDED.band_set_key, rule_key=EXCLUDED.rule_key, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.config_key, version, input.scope ?? 'assessment', input.scope_ref ?? '', input.label ?? null, input.formula_key ?? null, input.band_set_key ?? null, input.rule_key ?? null, JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listConfigs(pool: Pool, scope?: string): Promise<Record<string, unknown>[]> {
  return scope
    ? safeRows(pool, `SELECT * FROM astd_configs WHERE scope=$1 ORDER BY config_key, version DESC`, [scope])
    : safeRows(pool, `SELECT * FROM astd_configs ORDER BY config_key, version DESC LIMIT 500`);
}

/**
 * CONFIG SCOPE PRECEDENCE — deterministic order (most-specific wins) used to RESOLVE which stored
 * standardization config actually APPLIES for a given resolution context. Organization / institution
 * overrides beat a fully-custom scope, which beats the demographic (industry / country) and the
 * assessment-context (lifecycle / persona / assessment) scopes. This turns the eight config SCOPES from
 * "can be stored" into "stored AND resolvable/applied".
 */
export const CONFIG_SCOPE_PRECEDENCE = [
  'organization', 'institution', 'custom', 'industry', 'country', 'lifecycle', 'persona', 'assessment',
] as const;
export type ConfigScope = typeof CONFIG_SCOPE_PRECEDENCE[number];

// Which resolution-context field carries the scope_ref for each scope (assessment uses assessment_slug).
const SCOPE_CONTEXT_FIELD: Record<ConfigScope, string> = {
  organization: 'organization', institution: 'institution', custom: 'custom', industry: 'industry',
  country: 'country', lifecycle: 'lifecycle', persona: 'persona', assessment: 'assessment_slug',
};

export interface ResolveConfigContext {
  assessment_slug?: string; persona?: string; lifecycle?: string; industry?: string;
  organization?: string; country?: string; institution?: string; custom?: string;
}
export interface ResolveConfigResult {
  resolved: boolean;
  scope: ConfigScope | null;
  scope_ref: string | null;
  config: Record<string, unknown> | null;
  precedence: readonly ConfigScope[];
  candidates_considered: number;
  reason: string;
}
/**
 * PURE (read-only) config resolution: walk CONFIG_SCOPE_PRECEDENCE (most-specific first) and, for each
 * scope the context supplies a scope_ref for, look up the latest matching astd_configs row. The first
 * match wins. If no context field is supplied → resolved:false / reason:'no_context'; if context is
 * supplied but nothing matches → resolved:false / reason:'no_matching_config'. Reuses the null-safe
 * `safeRows` reader (missing overlay table → [] → resolved:false), so it is byte-identical OFF (the
 * route is flag-gated) and never throws. Persists nothing; never fabricates a config.
 */
export async function resolveConfig(pool: Pool, context: ResolveConfigContext = {}): Promise<ResolveConfigResult> {
  let considered = 0;
  for (const scope of CONFIG_SCOPE_PRECEDENCE) {
    const raw = context ? (context as Record<string, unknown>)[SCOPE_CONTEXT_FIELD[scope]] : undefined;
    const ref = raw == null ? '' : String(raw).trim();
    if (!ref) continue;
    considered += 1;
    const rows = await safeRows(
      pool,
      `SELECT * FROM astd_configs WHERE scope=$1 AND scope_ref=$2 ORDER BY version DESC LIMIT 1`,
      [scope, ref],
    );
    if (rows[0]) {
      return { resolved: true, scope, scope_ref: ref, config: rows[0], precedence: CONFIG_SCOPE_PRECEDENCE, candidates_considered: considered, reason: 'matched' };
    }
  }
  return {
    resolved: false, scope: null, scope_ref: null, config: null,
    precedence: CONFIG_SCOPE_PRECEDENCE, candidates_considered: considered,
    reason: considered === 0 ? 'no_context' : 'no_matching_config',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE — append-only lifecycle transitions + version history + rollback + audit
// ─────────────────────────────────────────────────────────────────────────────
export const GOVERNANCE_ORDER = ['draft', 'review', 'validate', 'approve', 'publish', 'archive', 'retire'] as const;
export type GovernanceState = typeof GOVERNANCE_ORDER[number];
const ARTEFACT_TABLE: Record<string, string> = {
  formula: 'astd_formulas', band: 'astd_bands', rule: 'astd_interpretation_rules', config: 'astd_configs',
};

export interface GovernanceInput { artefact_type: string; artefact_key: string; artefact_version?: number; to_state: string; actor?: string; note?: string }
/**
 * Record a governance transition (append-only) AND advance the artefact's `state` column (never
 * destructive). A snapshot of the artefact row is stored on the log entry so version history + rollback
 * can restore a prior state. Only whitelisted artefact types are accepted.
 */
export async function recordGovernanceTransition(pool: Pool, input: GovernanceInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const table = ARTEFACT_TABLE[input.artefact_type];
  if (!table) throw new Error('unknown_artefact_type');
  const version = Number.isFinite(Number(input.artefact_version)) ? Number(input.artefact_version) : 1;
  const keyCol = input.artefact_type === 'formula' ? 'formula_key' : input.artefact_type === 'band' ? 'band_set_key' : input.artefact_type === 'rule' ? 'rule_key' : 'config_key';
  const cur = await safeRows(pool, `SELECT * FROM ${table} WHERE ${keyCol}=$1 AND version=$2`, [input.artefact_key, version]);
  const fromState = cur[0] ? String(cur[0].state ?? '') : null;
  await pool.query(
    `INSERT INTO astd_governance_log (artefact_type, artefact_key, artefact_version, from_state, to_state, action, actor, note, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [input.artefact_type, input.artefact_key, version, fromState, input.to_state, 'transition', input.actor ?? null, input.note ?? null, JSON.stringify(cur[0] ?? {})],
  );
  if (cur[0]) {
    await pool.query(`UPDATE ${table} SET state=$1, updated_at=now() WHERE ${keyCol}=$2 AND version=$3`, [input.to_state, input.artefact_key, version]);
  }
  const { rows } = await pool.query(
    `SELECT * FROM astd_governance_log WHERE artefact_type=$1 AND artefact_key=$2 ORDER BY id DESC LIMIT 1`,
    [input.artefact_type, input.artefact_key],
  );
  return rows[0];
}
export async function listGovernanceLog(pool: Pool, artefactType?: string, artefactKey?: string): Promise<Record<string, unknown>[]> {
  if (artefactType && artefactKey) return safeRows(pool, `SELECT * FROM astd_governance_log WHERE artefact_type=$1 AND artefact_key=$2 ORDER BY id DESC LIMIT 200`, [artefactType, artefactKey]);
  return safeRows(pool, `SELECT * FROM astd_governance_log ORDER BY id DESC LIMIT 200`);
}

export interface SaveValidationInput { validation_key: string; artefact_type?: string; artefact_key?: string; check_type: string; passed: boolean; errors?: string[]; detail?: Record<string, unknown> }
export async function saveValidation(pool: Pool, input: SaveValidationInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureStdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO astd_validations (validation_key, artefact_type, artefact_key, check_type, passed, errors, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) RETURNING *`,
    [input.validation_key, input.artefact_type ?? 'formula', input.artefact_key ?? null, input.check_type, input.passed, JSON.stringify(input.errors ?? []), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listValidations(pool: Pool, artefactKey?: string): Promise<Record<string, unknown>[]> {
  return artefactKey
    ? safeRows(pool, `SELECT * FROM astd_validations WHERE artefact_key=$1 ORDER BY id DESC LIMIT 200`, [artefactKey])
    : safeRows(pool, `SELECT * FROM astd_validations ORDER BY id DESC LIMIT 200`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE — null-safe counts over the overlay (null on error ≠ 0 on empty)
// ═════════════════════════════════════════════════════════════════════════════
export interface StdOverlayCoverage {
  formulas: number | null; valid_formulas: number | null; standard_scores: number | null;
  abstained_scores: number | null; band_sets: number | null; interpretation_rules: number | null;
  configs: number | null; governance_events: number | null; validations: number | null; validations_passed: number | null;
}
export async function computeOverlayCoverage(pool: Pool): Promise<StdOverlayCoverage> {
  const [formulas, valid_formulas, standard_scores, abstained_scores, band_sets, interpretation_rules, configs, governance_events, validations, validations_passed] = await Promise.all([
    count(pool, `SELECT count(*) FROM astd_formulas`),
    count(pool, `SELECT count(*) FROM astd_formulas WHERE valid=true`),
    count(pool, `SELECT count(*) FROM astd_standard_scores`),
    count(pool, `SELECT count(*) FROM astd_standard_scores WHERE abstained=true`),
    count(pool, `SELECT count(*) FROM astd_bands`),
    count(pool, `SELECT count(*) FROM astd_interpretation_rules`),
    count(pool, `SELECT count(*) FROM astd_configs`),
    count(pool, `SELECT count(*) FROM astd_governance_log`),
    count(pool, `SELECT count(*) FROM astd_validations`),
    count(pool, `SELECT count(*) FROM astd_validations WHERE passed=true`),
  ]);
  return { formulas, valid_formulas, standard_scores, abstained_scores, band_sets, interpretation_rules, configs, governance_events, validations, validations_passed };
}
