/**
 * CAPADEX 3.0 — Program 3 · Phase 3.9 Enterprise Benchmark Intelligence — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build implementation mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureBenchmarkSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The additive
 * overlay tables are:
 *   abmk_groups         — versioned benchmark group definitions (type + scope + inclusion/exclusion +
 *                         min_sample_size + effective dates).
 *   abmk_configs        — scoped benchmark configuration (group + dimension + time mode + composite formula).
 *   abmk_results        — per-subject benchmark results with full traceability provenance.
 *   abmk_governance_log — append-only lifecycle transitions + version history + rollback + audit.
 *   abmk_audit_log      — append-only benchmark audit trail.
 *   abmk_saved_views    — saved benchmark explorer / comparison views.
 *
 * The PURE compute helpers (computeReferenceStats / computeBenchmarkComparison / computeGroupComparison /
 * computeTrend / computeDistribution / computePercentileRank / evaluateBenchmarkFormula) have NO DB +
 * NO DDL + NO eval — they are deterministic + side-effect free and REUSE the existing pure
 * psychometric-standardization transforms (zFromValue / zToPercentile) + the 3.8 structured-AST formula
 * engine (evaluateFormula / validateFormula — const / var / op / weighted / clamp / standardize nodes,
 * evaluated by a WHITELISTED interpreter — NEVER eval / new Function / string-executed).
 *
 * Benchmarking ABSTAINS below k_min real members in the reference group (suppressed:true → z / percentile /
 * delta / quartile null). Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable)
 * ≠ 0 (empty). This module BENCHMARKS a standardized result against a reference group — it never re-scores,
 * re-standardizes, or builds a norm. NO AI: every output is deterministic.
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { BMK_K_MIN } from '../config/benchmark-intelligence';
import { zFromValue, zToPercentile } from './psychometric-standardization';
import { evaluateFormula, validateFormula } from './score-standardization-mechanisms';

function assertEnabled(): void {
  if (!isFlagEnabled('benchmarkIntelligence')) {
    throw new Error('benchmark_intelligence_disabled');
  }
}

let schemaReady = false;
export async function ensureBenchmarkSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abmk_groups (
      id               BIGSERIAL PRIMARY KEY,
      group_key        TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      label            TEXT,
      benchmark_type   TEXT NOT NULL DEFAULT 'custom',
      scope            TEXT NOT NULL DEFAULT 'custom',
      scope_ref        TEXT NOT NULL DEFAULT '',
      inclusion        JSONB NOT NULL DEFAULT '[]'::jsonb,
      exclusion        JSONB NOT NULL DEFAULT '[]'::jsonb,
      min_sample_size  INTEGER NOT NULL DEFAULT ${BMK_K_MIN},
      effective_from   TIMESTAMPTZ,
      effective_to     TIMESTAMPTZ,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (group_key, version)
    );
    CREATE INDEX IF NOT EXISTS abmk_groups_key_idx ON abmk_groups(group_key);
    CREATE INDEX IF NOT EXISTS abmk_groups_type_idx ON abmk_groups(benchmark_type);
    CREATE TABLE IF NOT EXISTS abmk_configs (
      id               BIGSERIAL PRIMARY KEY,
      config_key       TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      scope            TEXT NOT NULL DEFAULT 'assessment',
      scope_ref        TEXT NOT NULL DEFAULT '',
      label            TEXT,
      group_key        TEXT,
      dimension        TEXT NOT NULL DEFAULT 'overall',
      time_mode        TEXT NOT NULL DEFAULT 'current',
      formula_key      TEXT,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (config_key, version)
    );
    CREATE INDEX IF NOT EXISTS abmk_configs_scope_idx ON abmk_configs(scope, scope_ref);
    CREATE TABLE IF NOT EXISTS abmk_results (
      id                       BIGSERIAL PRIMARY KEY,
      result_key               TEXT NOT NULL,
      subject_ref              TEXT NOT NULL DEFAULT '',
      assessment_slug          TEXT NOT NULL DEFAULT '',
      benchmark_type           TEXT NOT NULL DEFAULT 'custom',
      dimension                TEXT NOT NULL DEFAULT 'overall',
      time_mode                TEXT NOT NULL DEFAULT 'current',
      group_key                TEXT,
      value                    DOUBLE PRECISION,
      z                        DOUBLE PRECISION,
      percentile               DOUBLE PRECISION,
      delta                    DOUBLE PRECISION,
      quartile                 INTEGER,
      cohort_size              INTEGER,
      suppressed               BOOLEAN NOT NULL DEFAULT false,
      abstained                BOOLEAN NOT NULL DEFAULT false,
      -- traceability provenance (standardized score → assessment ver → norm ver → std ver → benchmark ver)
      assessment_version       TEXT,
      norm_version             TEXT,
      standardization_version  TEXT,
      benchmark_version        TEXT,
      detail                   JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (assessment_slug, subject_ref, result_key)
    );
    CREATE INDEX IF NOT EXISTS abmk_results_subject_idx ON abmk_results(subject_ref);
    CREATE INDEX IF NOT EXISTS abmk_results_time_idx ON abmk_results(subject_ref, dimension, created_at);
    CREATE TABLE IF NOT EXISTS abmk_governance_log (
      id               BIGSERIAL PRIMARY KEY,
      artefact_type    TEXT NOT NULL DEFAULT 'group',
      artefact_key     TEXT NOT NULL,
      artefact_version INTEGER NOT NULL DEFAULT 1,
      from_state       TEXT,
      to_state         TEXT NOT NULL,
      action           TEXT NOT NULL DEFAULT 'transition',
      actor            TEXT,
      note             TEXT,
      snapshot         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS abmk_governance_log_artefact_idx ON abmk_governance_log(artefact_type, artefact_key);
    CREATE TABLE IF NOT EXISTS abmk_audit_log (
      id               BIGSERIAL PRIMARY KEY,
      audit_key        TEXT NOT NULL DEFAULT '',
      action           TEXT NOT NULL DEFAULT 'event',
      actor            TEXT,
      target_type      TEXT,
      target_key       TEXT,
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS abmk_audit_log_target_idx ON abmk_audit_log(target_type, target_key);
    CREATE TABLE IF NOT EXISTS abmk_saved_views (
      id               BIGSERIAL PRIMARY KEY,
      view_key         TEXT NOT NULL,
      version          INTEGER NOT NULL DEFAULT 1,
      label            TEXT,
      owner            TEXT,
      config           JSONB NOT NULL DEFAULT '{}'::jsonb,
      state            TEXT NOT NULL DEFAULT 'draft',
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (view_key, version)
    );
    CREATE INDEX IF NOT EXISTS abmk_saved_views_key_idx ON abmk_saved_views(view_key);
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
 * NEVER CREATE TABLE. DDL lives ONLY on the write paths (via ensureBenchmarkSchema).
 */
async function safeRows(pool: Pool, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows as Record<string, unknown>[];
  } catch {
    return [];
  }
}

const round2 = (n: number | null): number | null => (n == null || !Number.isFinite(n) ? null : +n.toFixed(2));
const round4 = (n: number | null): number | null => (n == null || !Number.isFinite(n) ? null : +n.toFixed(4));

/** Coerce an array of maybe-numbers to the finite subset only (nulls / NaN / ±Inf dropped, never fabricated). */
function finiteValues(values: Array<number | null | undefined>): number[] {
  const out: number[] = [];
  for (const v of values ?? []) {
    const n = Number(v);
    if (v != null && Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Linear-interpolated percentile of a SORTED ascending finite array (p in 0..100). */
function percentileOfSorted(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/** Quartile band (1..4, higher = better) from a percentile. null percentile → null quartile. */
function quartileFromPercentile(p: number | null): number | null {
  if (p == null || !Number.isFinite(p)) return null;
  if (p >= 75) return 4;
  if (p >= 50) return 3;
  if (p >= 25) return 2;
  return 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// PURE COMPUTE — deterministic, NO DB, NO DDL, NO eval, NO AI. REUSE-before-build.
// BENCHMARKS a standardized result against a reference group — NEVER re-scores / re-standardizes.
// ═════════════════════════════════════════════════════════════════════════════

export interface ReferenceStats {
  n: number;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  sufficient: boolean; // n >= kMin
  k_min: number;
}
/** Descriptive statistics of a reference group (finite values only). Population SD. Never fabricates. */
export function computeReferenceStats(values: Array<number | null | undefined>, kMin: number = BMK_K_MIN): ReferenceStats {
  const vals = finiteValues(values);
  const n = vals.length;
  if (n === 0) {
    return { n: 0, mean: null, sd: null, min: null, max: null, q1: null, median: null, q3: null, sufficient: false, k_min: kMin };
  }
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  const sd = Math.sqrt(variance);
  const sorted = [...vals].sort((a, b) => a - b);
  return {
    n,
    mean: round4(mean),
    sd: round4(sd),
    min: round4(sorted[0]),
    max: round4(sorted[sorted.length - 1]),
    q1: round4(percentileOfSorted(sorted, 25)),
    median: round4(percentileOfSorted(sorted, 50)),
    q3: round4(percentileOfSorted(sorted, 75)),
    sufficient: n >= kMin,
    k_min: kMin,
  };
}

export interface BenchmarkComparison {
  value: number | null;
  n: number;
  mean: number | null;
  sd: number | null;
  z: number | null;
  percentile: number | null;
  delta: number | null;
  quartile: number | null;
  cohort_size: number;
  suppressed: boolean;
  abstained: boolean;
  reason: string;
}
/**
 * Benchmark a standardized value against a reference group. The reference is either raw values
 * (stats computed here) OR pre-aggregated {n, mean, sd}. ABSTAINS (suppressed:true → z / percentile /
 * delta / quartile null) when the cohort has fewer than k_min real members. Reuses the pure psychometric
 * transforms zFromValue / zToPercentile. Deterministic; never fabricates a percentile for a thin cohort.
 */
export function computeBenchmarkComparison(input: {
  value: number | null | undefined;
  reference?: Array<number | null | undefined>;
  stats?: { n?: number; mean?: number | null; sd?: number | null };
  kMin?: number;
}): BenchmarkComparison {
  const kMin = Number.isFinite(Number(input.kMin)) ? Number(input.kMin) : BMK_K_MIN;
  const rawValue = Number(input.value);
  const value = input.value != null && Number.isFinite(rawValue) ? rawValue : null;

  let n = 0;
  let mean: number | null = null;
  let sd: number | null = null;
  if (input.stats && (input.stats.n != null || input.stats.mean != null)) {
    n = Number.isFinite(Number(input.stats.n)) ? Number(input.stats.n) : 0;
    mean = input.stats.mean != null && Number.isFinite(Number(input.stats.mean)) ? Number(input.stats.mean) : null;
    sd = input.stats.sd != null && Number.isFinite(Number(input.stats.sd)) ? Number(input.stats.sd) : null;
  } else {
    const stats = computeReferenceStats(input.reference ?? [], kMin);
    n = stats.n; mean = stats.mean; sd = stats.sd;
  }

  const cohort_size = n;
  const empty = { value, n, mean: round4(mean), sd: round4(sd), z: null, percentile: null, delta: null, quartile: null, cohort_size };
  if (value == null) {
    return { ...empty, suppressed: n < kMin, abstained: true, reason: 'no_value' };
  }
  if (n < kMin) {
    return { ...empty, suppressed: true, abstained: true, reason: `cohort_below_k_min(${n}<${kMin})` };
  }
  const z = zFromValue(value, mean, sd);
  const percentile = zToPercentile(z);
  const delta = mean == null ? null : value - mean;
  return {
    value,
    n,
    mean: round4(mean),
    sd: round4(sd),
    z: round4(z),
    percentile: round2(percentile),
    delta: round4(delta),
    quartile: quartileFromPercentile(percentile),
    cohort_size,
    suppressed: false,
    abstained: false,
    reason: 'benchmarked',
  };
}

export interface GroupComparisonRow { label: string; benchmark_type?: string; comparison: BenchmarkComparison }
export interface GroupComparison { value: number | null; k_min: number; groups: GroupComparisonRow[] }
/** Compare one value against MULTIPLE reference groups side-by-side (each independently ABSTAINS below k_min). */
export function computeGroupComparison(input: {
  value: number | null | undefined;
  groups: Array<{ label: string; benchmark_type?: string; values?: Array<number | null | undefined>; stats?: { n?: number; mean?: number | null; sd?: number | null } }>;
  kMin?: number;
}): GroupComparison {
  const kMin = Number.isFinite(Number(input.kMin)) ? Number(input.kMin) : BMK_K_MIN;
  const rawValue = Number(input.value);
  const value = input.value != null && Number.isFinite(rawValue) ? rawValue : null;
  const groups = (input.groups ?? []).map((g) => ({
    label: g.label,
    benchmark_type: g.benchmark_type,
    comparison: computeBenchmarkComparison({ value, reference: g.values, stats: g.stats, kMin }),
  }));
  return { value, k_min: kMin, groups };
}

export interface TrendResult {
  n: number;
  first: number | null;
  last: number | null;
  delta: number | null;
  slope: number | null;
  direction: 'improving' | 'declining' | 'stable' | null;
  points: number[];
}
/**
 * Deterministic trend over a benchmark series (raw numbers or {value} rows, chronological order assumed).
 * Least-squares slope over the point index; direction improving / declining / stable by an epsilon band.
 * Fewer than 2 finite points → direction null (honest; never fabricates a trend from one point).
 */
export function computeTrend(
  series: Array<number | null | undefined | { value?: number | null }>,
  options: { epsilon?: number } = {},
): TrendResult {
  const raw = (series ?? []).map((s) => (typeof s === 'object' && s !== null ? (s as { value?: number | null }).value : s));
  const points = finiteValues(raw as Array<number | null | undefined>);
  const n = points.length;
  const epsilon = Number.isFinite(Number(options.epsilon)) ? Number(options.epsilon) : 1e-9;
  if (n === 0) return { n: 0, first: null, last: null, delta: null, slope: null, direction: null, points: [] };
  const first = points[0];
  const last = points[n - 1];
  if (n < 2) return { n, first: round4(first), last: round4(last), delta: 0, slope: null, direction: null, points };
  // least-squares slope over x = 0..n-1
  const xs = points.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = points.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (points[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  const direction: TrendResult['direction'] = slope > epsilon ? 'improving' : slope < -epsilon ? 'declining' : 'stable';
  return { n, first: round4(first), last: round4(last), delta: round4(last - first), slope: round4(slope), direction, points };
}

export interface DistributionBin { min: number; max: number; count: number }
export interface DistributionResult { n: number; mean: number | null; sd: number | null; min: number | null; max: number | null; bins: DistributionBin[] }
/** Histogram binning of a value set (equal-width bins). No fabrication — empty set → 0 bins. */
export function computeDistribution(values: Array<number | null | undefined>, binCount = 10): DistributionResult {
  const vals = finiteValues(values);
  const n = vals.length;
  const bins = Math.max(1, Math.floor(Number(binCount) || 10));
  if (n === 0) return { n: 0, mean: null, sd: null, min: null, max: null, bins: [] };
  const stats = computeReferenceStats(vals);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const width = max === min ? 1 : (max - min) / bins;
  const out: DistributionBin[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = min + i * width;
    const hi = i === bins - 1 ? max : min + (i + 1) * width;
    out.push({ min: round4(lo) as number, max: round4(hi) as number, count: 0 });
  }
  for (const v of vals) {
    let idx = width === 0 ? 0 : Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    out[idx].count += 1;
  }
  return { n, mean: stats.mean, sd: stats.sd, min: round4(min), max: round4(max), bins: out };
}

export interface PercentileRankResult { value: number | null; n: number; below: number; equal: number; percentile: number | null }
/** Empirical percentile rank of a value within a set: (below + 0.5·equal)/n · 100. Deterministic; null if empty. */
export function computePercentileRank(value: number | null | undefined, values: Array<number | null | undefined>): PercentileRankResult {
  const rawValue = Number(value);
  const v = value != null && Number.isFinite(rawValue) ? rawValue : null;
  const vals = finiteValues(values);
  const n = vals.length;
  if (v == null || n === 0) return { value: v, n, below: 0, equal: 0, percentile: null };
  let below = 0;
  let equal = 0;
  for (const x of vals) {
    if (x < v) below += 1;
    else if (x === v) equal += 1;
  }
  const percentile = ((below + 0.5 * equal) / n) * 100;
  return { value: v, n, below, equal, percentile: round2(percentile) };
}

export interface BenchmarkFormulaResult { valid: boolean; value: number | null; errors: string[]; variables: string[] }
/**
 * Composite benchmark index: reuse the 3.8 structured-AST formula engine (validateFormula → evaluateFormula).
 * const / var / op / weighted / clamp / standardize nodes only — NEVER eval / new Function. Validated first;
 * an invalid AST returns valid:false / value:null with the validator errors (never a fabricated value).
 */
export function evaluateBenchmarkFormula(
  ast: unknown,
  vars: Record<string, number | null | undefined> = {},
  knownVars?: string[],
): BenchmarkFormulaResult {
  const validation = validateFormula(ast, knownVars ?? Object.keys(vars ?? {}));
  if (!validation.valid) {
    return { valid: false, value: null, errors: validation.errors, variables: validation.variables };
  }
  const value = evaluateFormula(ast, vars);
  return { valid: true, value: round4(value), errors: [], variables: validation.variables };
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERLAY WRITES + READS — flag-gated writes (DDL via ensureBenchmarkSchema); null-safe reads.
// ═════════════════════════════════════════════════════════════════════════════

export interface SaveGroupInput {
  group_key: string; version?: number; label?: string; benchmark_type?: string; scope?: string; scope_ref?: string;
  inclusion?: unknown[]; exclusion?: unknown[]; min_sample_size?: number; effective_from?: string | null; effective_to?: string | null;
  detail?: Record<string, unknown>;
}
export async function saveGroup(pool: Pool, input: SaveGroupInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureBenchmarkSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const minSample = Number.isFinite(Number(input.min_sample_size)) ? Number(input.min_sample_size) : BMK_K_MIN;
  const { rows } = await pool.query(
    `INSERT INTO abmk_groups (group_key, version, label, benchmark_type, scope, scope_ref, inclusion, exclusion, min_sample_size, effective_from, effective_to, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb)
     ON CONFLICT (group_key, version) DO UPDATE SET
       label=EXCLUDED.label, benchmark_type=EXCLUDED.benchmark_type, scope=EXCLUDED.scope, scope_ref=EXCLUDED.scope_ref,
       inclusion=EXCLUDED.inclusion, exclusion=EXCLUDED.exclusion, min_sample_size=EXCLUDED.min_sample_size,
       effective_from=EXCLUDED.effective_from, effective_to=EXCLUDED.effective_to, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.group_key, version, input.label ?? null, input.benchmark_type ?? 'custom', input.scope ?? 'custom', input.scope_ref ?? '',
      JSON.stringify(input.inclusion ?? []), JSON.stringify(input.exclusion ?? []), minSample,
      input.effective_from ?? null, input.effective_to ?? null, JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listGroups(pool: Pool, benchmarkType?: string): Promise<Record<string, unknown>[]> {
  return benchmarkType
    ? safeRows(pool, `SELECT * FROM abmk_groups WHERE benchmark_type=$1 ORDER BY group_key, version DESC LIMIT 500`, [benchmarkType])
    : safeRows(pool, `SELECT * FROM abmk_groups ORDER BY group_key, version DESC LIMIT 500`);
}

export interface SaveConfigInput {
  config_key: string; version?: number; scope?: string; scope_ref?: string; label?: string;
  group_key?: string; dimension?: string; time_mode?: string; formula_key?: string; detail?: Record<string, unknown>;
}
export async function saveConfig(pool: Pool, input: SaveConfigInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureBenchmarkSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO abmk_configs (config_key, version, scope, scope_ref, label, group_key, dimension, time_mode, formula_key, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (config_key, version) DO UPDATE SET
       scope=EXCLUDED.scope, scope_ref=EXCLUDED.scope_ref, label=EXCLUDED.label, group_key=EXCLUDED.group_key,
       dimension=EXCLUDED.dimension, time_mode=EXCLUDED.time_mode, formula_key=EXCLUDED.formula_key, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.config_key, version, input.scope ?? 'assessment', input.scope_ref ?? '', input.label ?? null,
      input.group_key ?? null, input.dimension ?? 'overall', input.time_mode ?? 'current', input.formula_key ?? null,
      JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listConfigs(pool: Pool, scope?: string): Promise<Record<string, unknown>[]> {
  return scope
    ? safeRows(pool, `SELECT * FROM abmk_configs WHERE scope=$1 ORDER BY config_key, version DESC LIMIT 500`, [scope])
    : safeRows(pool, `SELECT * FROM abmk_configs ORDER BY config_key, version DESC LIMIT 500`);
}

// Scope precedence (most-specific wins) — mirrors the 3.8 standardization config precedence.
export const CONFIG_SCOPE_PRECEDENCE = [
  'organization', 'institution', 'custom', 'industry', 'country', 'lifecycle', 'persona', 'assessment',
] as const;
export type ConfigScope = typeof CONFIG_SCOPE_PRECEDENCE[number];
const SCOPE_CONTEXT_FIELD: Record<ConfigScope, string> = {
  organization: 'organization', institution: 'institution', custom: 'custom', industry: 'industry',
  country: 'country', lifecycle: 'lifecycle', persona: 'persona', assessment: 'assessment_slug',
};
export interface ResolveConfigContext {
  assessment_slug?: string; persona?: string; lifecycle?: string; industry?: string;
  organization?: string; country?: string; institution?: string; custom?: string;
}
export interface ResolveConfigResult {
  resolved: boolean; scope: ConfigScope | null; scope_ref: string | null;
  config: Record<string, unknown> | null; precedence: readonly ConfigScope[];
  candidates_considered: number; reason: string;
}
/**
 * PURE (read-only) benchmark-config resolution: walk CONFIG_SCOPE_PRECEDENCE (most-specific first) and,
 * for each scope the context supplies a scope_ref for, look up the latest matching abmk_configs row.
 * First match wins. Reuses the null-safe safeRows reader (missing overlay table → [] → resolved:false),
 * so it is byte-identical OFF (the route is flag-gated) and never throws. Persists nothing; never fabricates.
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
      `SELECT * FROM abmk_configs WHERE scope=$1 AND scope_ref=$2 ORDER BY version DESC LIMIT 1`,
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

export interface SaveResultInput {
  result_key: string; subject_ref?: string; assessment_slug?: string; benchmark_type?: string;
  dimension?: string; time_mode?: string; group_key?: string;
  value?: number | null; z?: number | null; percentile?: number | null; delta?: number | null;
  quartile?: number | null; cohort_size?: number | null; suppressed?: boolean; abstained?: boolean;
  assessment_version?: string | null; norm_version?: string | null; standardization_version?: string | null; benchmark_version?: string | null;
  detail?: Record<string, unknown>;
}
export async function saveResult(pool: Pool, input: SaveResultInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureBenchmarkSchema(pool);
  const numOrNull = (v: unknown): number | null => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const { rows } = await pool.query(
    `INSERT INTO abmk_results (result_key, subject_ref, assessment_slug, benchmark_type, dimension, time_mode, group_key,
       value, z, percentile, delta, quartile, cohort_size, suppressed, abstained,
       assessment_version, norm_version, standardization_version, benchmark_version, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
     ON CONFLICT (assessment_slug, subject_ref, result_key) DO UPDATE SET
       benchmark_type=EXCLUDED.benchmark_type, dimension=EXCLUDED.dimension, time_mode=EXCLUDED.time_mode, group_key=EXCLUDED.group_key,
       value=EXCLUDED.value, z=EXCLUDED.z, percentile=EXCLUDED.percentile, delta=EXCLUDED.delta, quartile=EXCLUDED.quartile,
       cohort_size=EXCLUDED.cohort_size, suppressed=EXCLUDED.suppressed, abstained=EXCLUDED.abstained,
       assessment_version=EXCLUDED.assessment_version, norm_version=EXCLUDED.norm_version,
       standardization_version=EXCLUDED.standardization_version, benchmark_version=EXCLUDED.benchmark_version, detail=EXCLUDED.detail
     RETURNING *`,
    [input.result_key, input.subject_ref ?? '', input.assessment_slug ?? '', input.benchmark_type ?? 'custom',
      input.dimension ?? 'overall', input.time_mode ?? 'current', input.group_key ?? null,
      numOrNull(input.value), numOrNull(input.z), numOrNull(input.percentile), numOrNull(input.delta),
      numOrNull(input.quartile), numOrNull(input.cohort_size), !!input.suppressed, !!input.abstained,
      input.assessment_version ?? null, input.norm_version ?? null, input.standardization_version ?? null, input.benchmark_version ?? null,
      JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
/** Read a subject's benchmark results (optionally a single dimension), chronological — feeds trend/historical. */
export async function listResults(pool: Pool, subjectRef?: string, dimension?: string): Promise<Record<string, unknown>[]> {
  if (subjectRef && dimension) {
    return safeRows(pool, `SELECT * FROM abmk_results WHERE subject_ref=$1 AND dimension=$2 ORDER BY created_at ASC LIMIT 500`, [subjectRef, dimension]);
  }
  if (subjectRef) {
    return safeRows(pool, `SELECT * FROM abmk_results WHERE subject_ref=$1 ORDER BY created_at ASC LIMIT 500`, [subjectRef]);
  }
  return safeRows(pool, `SELECT * FROM abmk_results ORDER BY id DESC LIMIT 500`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE — append-only lifecycle transitions + version history + rollback + audit
// ─────────────────────────────────────────────────────────────────────────────
export const GOVERNANCE_ORDER = ['draft', 'review', 'validate', 'approve', 'publish', 'archive', 'retire'] as const;
export type GovernanceState = typeof GOVERNANCE_ORDER[number];
const ARTEFACT_TABLE: Record<string, string> = {
  group: 'abmk_groups', config: 'abmk_configs', view: 'abmk_saved_views',
};
const ARTEFACT_KEY_COL: Record<string, string> = {
  group: 'group_key', config: 'config_key', view: 'view_key',
};
export interface GovernanceInput { artefact_type: string; artefact_key: string; artefact_version?: number; to_state: string; actor?: string; note?: string }
/**
 * Record a benchmark governance transition (append-only) AND advance the artefact's `state` column (never
 * destructive). A snapshot of the artefact row is stored on the log entry so version history + rollback can
 * restore a prior state. Only whitelisted artefact types (group / config / view) are accepted.
 */
export async function recordGovernanceTransition(pool: Pool, input: GovernanceInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureBenchmarkSchema(pool);
  const table = ARTEFACT_TABLE[input.artefact_type];
  const keyCol = ARTEFACT_KEY_COL[input.artefact_type];
  if (!table || !keyCol) throw new Error('unknown_artefact_type');
  const version = Number.isFinite(Number(input.artefact_version)) ? Number(input.artefact_version) : 1;
  const cur = await safeRows(pool, `SELECT * FROM ${table} WHERE ${keyCol}=$1 AND version=$2`, [input.artefact_key, version]);
  const fromState = cur[0] ? String(cur[0].state ?? '') : null;
  await pool.query(
    `INSERT INTO abmk_governance_log (artefact_type, artefact_key, artefact_version, from_state, to_state, action, actor, note, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [input.artefact_type, input.artefact_key, version, fromState, input.to_state, 'transition', input.actor ?? null, input.note ?? null, JSON.stringify(cur[0] ?? {})],
  );
  if (cur[0]) {
    await pool.query(`UPDATE ${table} SET state=$1, updated_at=now() WHERE ${keyCol}=$2 AND version=$3`, [input.to_state, input.artefact_key, version]);
  }
  const { rows } = await pool.query(
    `SELECT * FROM abmk_governance_log WHERE artefact_type=$1 AND artefact_key=$2 ORDER BY id DESC LIMIT 1`,
    [input.artefact_type, input.artefact_key],
  );
  return rows[0];
}
export async function listGovernanceLog(pool: Pool, artefactType?: string, artefactKey?: string): Promise<Record<string, unknown>[]> {
  if (artefactType && artefactKey) return safeRows(pool, `SELECT * FROM abmk_governance_log WHERE artefact_type=$1 AND artefact_key=$2 ORDER BY id DESC LIMIT 200`, [artefactType, artefactKey]);
  return safeRows(pool, `SELECT * FROM abmk_governance_log ORDER BY id DESC LIMIT 200`);
}

export interface AuditInput { audit_key?: string; action: string; actor?: string; target_type?: string; target_key?: string; detail?: Record<string, unknown> }
export async function recordAudit(pool: Pool, input: AuditInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureBenchmarkSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO abmk_audit_log (audit_key, action, actor, target_type, target_key, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
    [input.audit_key ?? '', input.action, input.actor ?? null, input.target_type ?? null, input.target_key ?? null, JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listAudit(pool: Pool, targetKey?: string): Promise<Record<string, unknown>[]> {
  return targetKey
    ? safeRows(pool, `SELECT * FROM abmk_audit_log WHERE target_key=$1 ORDER BY id DESC LIMIT 200`, [targetKey])
    : safeRows(pool, `SELECT * FROM abmk_audit_log ORDER BY id DESC LIMIT 200`);
}

export interface SaveViewInput { view_key: string; version?: number; label?: string; owner?: string; config?: Record<string, unknown>; detail?: Record<string, unknown> }
export async function saveView(pool: Pool, input: SaveViewInput): Promise<Record<string, unknown>> {
  assertEnabled();
  await ensureBenchmarkSchema(pool);
  const version = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const { rows } = await pool.query(
    `INSERT INTO abmk_saved_views (view_key, version, label, owner, config, detail)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
     ON CONFLICT (view_key, version) DO UPDATE SET
       label=EXCLUDED.label, owner=EXCLUDED.owner, config=EXCLUDED.config, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.view_key, version, input.label ?? null, input.owner ?? null, JSON.stringify(input.config ?? {}), JSON.stringify(input.detail ?? {})],
  );
  return rows[0];
}
export async function listViews(pool: Pool, owner?: string): Promise<Record<string, unknown>[]> {
  return owner
    ? safeRows(pool, `SELECT * FROM abmk_saved_views WHERE owner=$1 ORDER BY view_key, version DESC LIMIT 200`, [owner])
    : safeRows(pool, `SELECT * FROM abmk_saved_views ORDER BY view_key, version DESC LIMIT 200`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE — null-safe counts over the overlay (null on error ≠ 0 on empty)
// ═════════════════════════════════════════════════════════════════════════════
export interface BenchmarkOverlayCoverage {
  groups: number | null; configs: number | null; results: number | null; suppressed_results: number | null;
  abstained_results: number | null; governance_events: number | null; audit_events: number | null; saved_views: number | null;
}
export async function computeOverlayCoverage(pool: Pool): Promise<BenchmarkOverlayCoverage> {
  const [groups, configs, results, suppressed_results, abstained_results, governance_events, audit_events, saved_views] = await Promise.all([
    count(pool, `SELECT count(*) FROM abmk_groups`),
    count(pool, `SELECT count(*) FROM abmk_configs`),
    count(pool, `SELECT count(*) FROM abmk_results`),
    count(pool, `SELECT count(*) FROM abmk_results WHERE suppressed=true`),
    count(pool, `SELECT count(*) FROM abmk_results WHERE abstained=true`),
    count(pool, `SELECT count(*) FROM abmk_governance_log`),
    count(pool, `SELECT count(*) FROM abmk_audit_log`),
    count(pool, `SELECT count(*) FROM abmk_saved_views`),
  ]);
  return { groups, configs, results, suppressed_results, abstained_results, governance_events, audit_events, saved_views };
}
