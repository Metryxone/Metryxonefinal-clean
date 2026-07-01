/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting) — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build engineering-closure mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureAintSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The additive
 * overlay tables are:
 *   aint_norm_tables    — stored / computed norm reference groups (cohort/role/stage/self/custom).
 *   aint_standard_scores— per-candidate standardized scores (percentile/z/T/stanine/sten/deviation).
 *   aint_benchmarks     — per-candidate benchmark comparisons (peer/role/stage/temporal/…).
 *   aint_interpretations— per-candidate AI narrative (strengths/development/reasoning/recommendations).
 *   aint_reports        — per-candidate structured, section-aware interpretation reports.
 *   aint_performance    — per-candidate performance analytics (standing/profile/percentile/growth/…).
 *   aint_repository     — versioned interpretation-artefact catalogue.
 *
 * The PURE compute helpers (computeStandardScores/computeNormReference/computeBenchmark/
 * computeInterpretation/computeReport/computePerformance) have NO DB + NO DDL + NO eval — they are
 * deterministic + side-effect free and REUSE the existing pure psychometric-standardization functions
 * (zFromValue/zToPercentile/zToT/zToStanine/zToSten/zToDeviationScore/standardScoresFromZ). The heavier
 * interpretation services (peer-benchmark, benchmark-engine, intelligence-narrative-engine,
 * ai-reasoning-engine, dynamic-report) are COMPOSED by EXISTENCE — never invoked from a read/compute path.
 *
 * Norm-referenced statistics + benchmarks ABSTAIN below k_min real members in the reference group —
 * they return { abstained:true } rather than fabricating a value. AI narrative confidence stays null
 * while cold-start / uncalibrated. This module INTERPRETS a scored+validated result — it never re-scores
 * and never re-validates the instrument.
 *
 * Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty).
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { AINT_K_MIN } from '../config/assessment-intelligence';
import {
  zFromValue, zToPercentile, standardScoresFromZ, type StandardScoreSet,
} from './psychometric-standardization';

function assertEnabled(): void {
  if (!isFlagEnabled('assessmentIntelligence')) {
    throw new Error('assessment_intelligence_disabled');
  }
}

let schemaReady = false;
export async function ensureAintSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aint_norm_tables (
      id             BIGSERIAL PRIMARY KEY,
      norm_key       TEXT NOT NULL,
      norm_type      TEXT NOT NULL DEFAULT 'cohort_norm',
      label          TEXT,
      assessment_slug TEXT NOT NULL DEFAULT '',
      reference_mean DOUBLE PRECISION,
      reference_sd   DOUBLE PRECISION,
      n_members      INTEGER NOT NULL DEFAULT 0,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (norm_key, norm_type)
    );
    CREATE INDEX IF NOT EXISTS aint_norm_tables_assessment_idx ON aint_norm_tables(assessment_slug);
    CREATE TABLE IF NOT EXISTS aint_standard_scores (
      id             BIGSERIAL PRIMARY KEY,
      score_key      TEXT NOT NULL,
      subject_ref    TEXT,
      assessment_slug TEXT NOT NULL DEFAULT '',
      raw_value      DOUBLE PRECISION,
      z              DOUBLE PRECISION,
      percentile     DOUBLE PRECISION,
      t_score        DOUBLE PRECISION,
      stanine        DOUBLE PRECISION,
      sten           DOUBLE PRECISION,
      deviation_score DOUBLE PRECISION,
      norm_key       TEXT,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (score_key)
    );
    CREATE INDEX IF NOT EXISTS aint_standard_scores_subject_idx ON aint_standard_scores(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_benchmarks (
      id             BIGSERIAL PRIMARY KEY,
      benchmark_key  TEXT NOT NULL,
      subject_ref    TEXT,
      scope          TEXT NOT NULL DEFAULT 'peer_cohort',
      assessment_slug TEXT NOT NULL DEFAULT '',
      value          DOUBLE PRECISION,
      percentile     DOUBLE PRECISION,
      relative       TEXT,
      n_members      INTEGER NOT NULL DEFAULT 0,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (benchmark_key, scope)
    );
    CREATE INDEX IF NOT EXISTS aint_benchmarks_subject_idx ON aint_benchmarks(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_interpretations (
      id             BIGSERIAL PRIMARY KEY,
      interp_key     TEXT NOT NULL,
      subject_ref    TEXT,
      assessment_slug TEXT NOT NULL DEFAULT '',
      narrative      TEXT,
      strengths      JSONB NOT NULL DEFAULT '[]'::jsonb,
      development_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
      reasoning      JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      confidence     DOUBLE PRECISION,
      source         TEXT NOT NULL DEFAULT 'deterministic',
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (interp_key)
    );
    CREATE INDEX IF NOT EXISTS aint_interpretations_subject_idx ON aint_interpretations(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_reports (
      id             BIGSERIAL PRIMARY KEY,
      report_key     TEXT NOT NULL,
      subject_ref    TEXT,
      assessment_slug TEXT NOT NULL DEFAULT '',
      sections       JSONB NOT NULL DEFAULT '[]'::jsonb,
      section_count  INTEGER NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'draft',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (report_key)
    );
    CREATE INDEX IF NOT EXISTS aint_reports_subject_idx ON aint_reports(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_performance (
      id             BIGSERIAL PRIMARY KEY,
      perf_key       TEXT NOT NULL,
      subject_ref    TEXT,
      assessment_slug TEXT NOT NULL DEFAULT '',
      overall_standing TEXT,
      overall_score  DOUBLE PRECISION,
      percentile     DOUBLE PRECISION,
      readiness_band TEXT,
      peer_relative  TEXT,
      growth_trajectory TEXT,
      dimension_profile JSONB NOT NULL DEFAULT '[]'::jsonb,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (perf_key)
    );
    CREATE INDEX IF NOT EXISTS aint_performance_subject_idx ON aint_performance(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_repository (
      id             BIGSERIAL PRIMARY KEY,
      artefact_key   TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      artefact_type  TEXT NOT NULL DEFAULT 'standard_scores',
      ref            TEXT,
      payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
      status         TEXT NOT NULL DEFAULT 'active',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (artefact_key, version)
    );
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
 * NEVER CREATE TABLE. DDL lives ONLY on the write paths (via ensureAintSchema).
 */
async function safeRows(pool: Pool, sql: string, params: unknown[] = []): Promise<unknown[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch {
    return [];
  }
}

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const round2 = (n: number | null): number | null => (n == null || !Number.isFinite(n) ? null : +n.toFixed(2));

// Bands derived from a percentile (0..100). null percentile → null band (never fabricated).
function percentileBand(p: number | null): 'low' | 'below_average' | 'average' | 'above_average' | 'high' | null {
  if (p == null || !Number.isFinite(p)) return null;
  if (p < 10) return 'low';
  if (p < 25) return 'below_average';
  if (p < 75) return 'average';
  if (p < 90) return 'above_average';
  return 'high';
}
function readinessBand(p: number | null): 'emerging' | 'developing' | 'proficient' | 'advanced' | null {
  if (p == null || !Number.isFinite(p)) return null;
  if (p < 25) return 'emerging';
  if (p < 50) return 'developing';
  if (p < 80) return 'proficient';
  return 'advanced';
}

// ═════════════════════════════════════════════════════════════════════════════
// PURE COMPUTE — deterministic, NO DB, NO DDL, NO eval. REUSE-before-build.
// INTERPRETS a scored+validated result — NEVER re-scores / re-validates.
// ═════════════════════════════════════════════════════════════════════════════

export interface StandardScoreResult extends StandardScoreSet {
  input: { value: number | null; mean: number | null; sd: number | null };
  band: ReturnType<typeof percentileBand>;
  abstained: boolean;
  reason?: string;
}
/**
 * PURE standardization: transform a raw value into the full canonical standard-score set against a
 * reference (mean, sd). If the distribution is undefined (sd null/≤0) the z is null and EVERY standard
 * score is null — NEVER fabricated. Reuses zFromValue + standardScoresFromZ.
 */
export function computeStandardScores(value: number | null, mean: number | null, sd: number | null): StandardScoreResult {
  const z = zFromValue(value, mean, sd);
  const set = standardScoresFromZ(z);
  const abstained = z == null;
  return {
    input: { value: value ?? null, mean: mean ?? null, sd: sd ?? null },
    ...set,
    band: percentileBand(set.percentile),
    abstained,
    ...(abstained ? { reason: 'no_reference_distribution' } : {}),
  };
}

export interface NormReference { norm_type?: string; label?: string; mean: number | null; sd: number | null; n?: number }
export interface NormReferenceResult {
  norm_type: string;
  reference_label: string | null;
  n_members: number;
  abstained: boolean;
  reason?: string;
  z: number | null;
  percentile: number | null;
  band: ReturnType<typeof percentileBand>;
  standard_scores: StandardScoreSet | null;
}
/**
 * PURE norm-referencing: interpret a raw value against a norm reference group. ABSTAINS when the
 * reference group has fewer than k_min real members (or the distribution is undefined) — the norm
 * statistics stay null rather than being fabricated on a thin reference sample.
 */
export function computeNormReference(value: number | null, reference: NormReference, options: { k_min?: number } = {}): NormReferenceResult {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : AINT_K_MIN;
  const n = Number.isFinite(Number(reference?.n)) ? Number(reference.n) : 0;
  const thin = n < kMin;
  const z = thin ? null : zFromValue(value, reference?.mean ?? null, reference?.sd ?? null);
  const set = z == null ? null : standardScoresFromZ(z);
  const abstained = z == null;
  return {
    norm_type: reference?.norm_type ? String(reference.norm_type) : 'cohort_norm',
    reference_label: reference?.label ? String(reference.label) : null,
    n_members: n,
    abstained,
    ...(abstained ? { reason: thin ? `below_k_min(${kMin})` : 'no_reference_distribution' } : {}),
    z: set?.z ?? null,
    percentile: set?.percentile ?? null,
    band: percentileBand(set?.percentile ?? null),
    standard_scores: set,
  };
}

export interface BenchmarkGroup { scope?: string; label?: string; mean: number | null; sd: number | null; n?: number }
export interface BenchmarkGroupResult {
  scope: string;
  label: string | null;
  n_members: number;
  abstained: boolean;
  reason?: string;
  percentile: number | null;
  band: ReturnType<typeof percentileBand>;
  relative: 'above' | 'at' | 'below' | null;
}
/**
 * PURE benchmarking: compare a value against one or more reference groups (peer/role/stage/temporal/…).
 * Each group ABSTAINS below k_min real members. `relative` is above/at/below the group mean; percentile
 * is the normal-CDF standing. Nothing is fabricated on a thin group.
 */
export function computeBenchmark(value: number | null, groups: BenchmarkGroup[], options: { k_min?: number } = {}): {
  value: number | null; k_min: number; group_count: number; groups: BenchmarkGroupResult[];
} {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : AINT_K_MIN;
  const list = Array.isArray(groups) ? groups : [];
  const out: BenchmarkGroupResult[] = list.map((g) => {
    const n = Number.isFinite(Number(g?.n)) ? Number(g.n) : 0;
    const thin = n < kMin;
    const z = thin ? null : zFromValue(value, g?.mean ?? null, g?.sd ?? null);
    const percentile = z == null ? null : zToPercentile(z);
    let relative: 'above' | 'at' | 'below' | null = null;
    if (value != null && g?.mean != null && Number.isFinite(value) && Number.isFinite(g.mean)) {
      relative = value > g.mean ? 'above' : value < g.mean ? 'below' : 'at';
    }
    return {
      scope: g?.scope ? String(g.scope) : 'peer_cohort',
      label: g?.label ? String(g.label) : null,
      n_members: n,
      abstained: z == null,
      ...(z == null ? { reason: thin ? `below_k_min(${kMin})` : 'no_reference_distribution' } : {}),
      percentile,
      band: percentileBand(percentile),
      relative,
    };
  });
  return { value: value ?? null, k_min: kMin, group_count: out.length, groups: out };
}

export interface InterpDimension { key?: string; label?: string; score: number | null; max?: number }
export interface InterpretationResult {
  ref: string;
  dimension_count: number;
  strengths: { key: string; label: string; pct: number | null }[];
  development_areas: { key: string; label: string; pct: number | null }[];
  narrative: string;
  reasoning: { step: string; detail: string }[];
  recommendations: string[];
  confidence: number | null;
  source: string;
  abstained: boolean;
  reason?: string;
}
/**
 * PURE interpretation: deterministically compose a narrative (strengths / development areas / reasoning
 * chain / recommendations) from per-dimension scores. This is the deterministic seam that the AI narrative
 * engine (intelligence-narrative-engine / ai-reasoning-engine) enriches when adopted — the pure compute
 * NEVER invokes the LLM. Confidence stays null (cold-start / uncalibrated) — never fabricated.
 */
export function computeInterpretation(input: { ref?: string; dimensions?: InterpDimension[]; confidence?: number | null } = {}): InterpretationResult {
  const ref = input?.ref ? String(input.ref) : 'candidate';
  const dims = (Array.isArray(input?.dimensions) ? input!.dimensions! : [])
    .map((d, i) => {
      const max = Number.isFinite(Number(d?.max)) && Number(d.max) > 0 ? Number(d.max) : 100;
      const raw = d?.score;
      const pct = raw == null || !Number.isFinite(Number(raw)) ? null : Math.max(0, Math.min(100, (num(raw) / max) * 100));
      return { key: d?.key ? String(d.key) : `dim_${i + 1}`, label: d?.label ? String(d.label) : (d?.key ? String(d.key) : `Dimension ${i + 1}`), pct: pct == null ? null : round2(pct) };
    })
    .filter((d) => d.pct != null);
  if (!dims.length) {
    return {
      ref, dimension_count: 0, strengths: [], development_areas: [],
      narrative: 'No scored dimensions available to interpret.', reasoning: [], recommendations: [],
      confidence: null, source: 'deterministic', abstained: true, reason: 'no_scored_dimensions',
    };
  }
  const sorted = [...dims].sort((a, b) => (b.pct as number) - (a.pct as number));
  const strengths = sorted.filter((d) => (d.pct as number) >= 66).slice(0, 3);
  const development = [...sorted].reverse().filter((d) => (d.pct as number) < 50).slice(0, 3);
  const strengthTxt = strengths.length ? strengths.map((d) => d.label).join(', ') : 'no clearly dominant strengths yet';
  const devTxt = development.length ? development.map((d) => d.label).join(', ') : 'no critical development areas';
  const narrative =
    `Across ${dims.length} measured dimension(s), the profile shows relative strength in ${strengthTxt}. ` +
    `The priority development focus is ${devTxt}. This interpretation is deterministic (band-based); an ` +
    `AI narrative enrichment can be layered when adopted.`;
  const reasoning = [
    { step: 'normalize', detail: `Each dimension score normalized to a 0–100 band (${dims.length} dimensions).` },
    { step: 'rank', detail: 'Dimensions ranked; ≥66 flagged as strengths, <50 flagged as development areas.' },
    { step: 'compose', detail: 'Deterministic narrative composed from the ranked bands (no fabricated confidence).' },
  ];
  const recommendations = development.map((d) => `Prioritize development in ${d.label} (currently ${d.pct}%).`);
  const confidence = input?.confidence != null && Number.isFinite(Number(input.confidence)) ? round2(Number(input.confidence)) : null;
  return {
    ref, dimension_count: dims.length, strengths, development_areas: development,
    narrative, reasoning, recommendations, confidence, source: 'deterministic', abstained: false,
  };
}

export interface ReportSectionResult { key: string; label: string; present: boolean; content: unknown }
/**
 * PURE report composition: assemble the 8 canonical interpretation-report sections from whatever
 * artefacts the caller provides (score summary / norm / benchmark / narrative / recommendations …).
 * A section is `present:false` when its artefact is absent — never filled with a fabricated placeholder.
 */
export function computeReport(input: Record<string, unknown> = {}): { ref: string; section_count: number; present_count: number; sections: ReportSectionResult[] } {
  const ref = input?.ref ? String(input.ref) : 'candidate';
  const defs: { key: string; label: string; src: string }[] = [
    { key: 'overview', label: 'Overview', src: 'overview' },
    { key: 'score_summary', label: 'Score summary', src: 'score_summary' },
    { key: 'norm_interpretation', label: 'Norm interpretation', src: 'norm' },
    { key: 'benchmark', label: 'Benchmark comparison', src: 'benchmark' },
    { key: 'narrative', label: 'AI narrative', src: 'narrative' },
    { key: 'strengths_development', label: 'Strengths & development areas', src: 'strengths_development' },
    { key: 'recommendations', label: 'Recommendations', src: 'recommendations' },
    { key: 'next_steps', label: 'Next steps / action plan', src: 'next_steps' },
  ];
  const sections = defs.map((d) => {
    const content = (input as Record<string, unknown>)[d.src] ?? null;
    const present = content != null && !(Array.isArray(content) && content.length === 0);
    return { key: d.key, label: d.label, present, content: present ? content : null };
  });
  return { ref, section_count: sections.length, present_count: sections.filter((s) => s.present).length, sections };
}

export interface PerformanceInput {
  ref?: string;
  score: number | null;
  reference?: NormReference;          // cohort/role reference for percentile + peer-relative
  history?: (number | null)[];        // prior scores oldest→newest for growth trajectory
  dimensions?: InterpDimension[];     // per-dimension profile
}
export interface PerformanceResult {
  ref: string;
  overall_score: number | null;
  overall_standing: ReturnType<typeof percentileBand>;
  percentile: number | null;
  percentile_abstained: boolean;
  peer_relative: 'above' | 'at' | 'below' | null;
  readiness_band: ReturnType<typeof readinessBand>;
  growth_trajectory: 'improving' | 'stable' | 'declining' | null;
  dimension_profile: { key: string; label: string; pct: number | null }[];
}
/**
 * PURE candidate-performance analytics: overall standing / percentile (ABSTAINS below k_min) / peer-relative
 * / readiness band / growth trajectory / dimension profile. Percentile + peer-relative ABSTAIN when the
 * reference group is thin; growth is null with < 2 historical points. Nothing fabricated.
 */
export function computePerformance(input: PerformanceInput, options: { k_min?: number } = {}): PerformanceResult {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : AINT_K_MIN;
  const ref = input?.ref ? String(input.ref) : 'candidate';
  const score = input?.score == null || !Number.isFinite(Number(input.score)) ? null : num(input.score);
  const reference = input?.reference;
  const nRef = Number.isFinite(Number(reference?.n)) ? Number(reference!.n) : 0;
  const thin = nRef < kMin;
  const z = thin ? null : zFromValue(score, reference?.mean ?? null, reference?.sd ?? null);
  const percentile = z == null ? null : zToPercentile(z);
  let peer_relative: 'above' | 'at' | 'below' | null = null;
  if (!thin && score != null && reference?.mean != null && Number.isFinite(reference.mean)) {
    peer_relative = score > reference.mean ? 'above' : score < reference.mean ? 'below' : 'at';
  }
  const history = (Array.isArray(input?.history) ? input!.history! : []).map((h) => (h == null ? null : num(h))).filter((h): h is number => h != null && Number.isFinite(h));
  let growth: 'improving' | 'stable' | 'declining' | null = null;
  if (history.length >= 2) {
    const delta = history[history.length - 1] - history[0];
    growth = delta > 1 ? 'improving' : delta < -1 ? 'declining' : 'stable';
  }
  const dimension_profile = (Array.isArray(input?.dimensions) ? input!.dimensions! : []).map((d, i) => {
    const max = Number.isFinite(Number(d?.max)) && Number(d.max) > 0 ? Number(d.max) : 100;
    const raw = d?.score;
    const pct = raw == null || !Number.isFinite(Number(raw)) ? null : round2(Math.max(0, Math.min(100, (num(raw) / max) * 100)));
    return { key: d?.key ? String(d.key) : `dim_${i + 1}`, label: d?.label ? String(d.label) : (d?.key ? String(d.key) : `Dimension ${i + 1}`), pct };
  });
  return {
    ref,
    overall_score: score,
    overall_standing: percentileBand(percentile),
    percentile,
    percentile_abstained: percentile == null,
    peer_relative,
    readiness_band: readinessBand(percentile),
    growth_trajectory: growth,
    dimension_profile,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERLAY WRITES (flag-gated; the ONLY DDL sites) + reads
// ═════════════════════════════════════════════════════════════════════════════

export interface NormTableInput {
  norm_key: string; norm_type?: string; label?: string; assessment_slug?: string;
  reference_mean?: number | null; reference_sd?: number | null; n_members?: number; abstained?: boolean; detail?: unknown;
}
export async function saveNormTable(pool: Pool, input: NormTableInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_norm_tables (norm_key, norm_type, label, assessment_slug, reference_mean, reference_sd, n_members, abstained, detail)
     VALUES ($1,COALESCE($2,'cohort_norm'),$3,COALESCE($4,''),$5,$6,COALESCE($7,0),COALESCE($8,false),COALESCE($9,'{}')::jsonb)
     ON CONFLICT (norm_key, norm_type) DO UPDATE SET
       label=EXCLUDED.label, assessment_slug=EXCLUDED.assessment_slug, reference_mean=EXCLUDED.reference_mean,
       reference_sd=EXCLUDED.reference_sd, n_members=EXCLUDED.n_members, abstained=EXCLUDED.abstained,
       detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.norm_key, input.norm_type ?? null, input.label ?? null, input.assessment_slug ?? null,
      input.reference_mean ?? null, input.reference_sd ?? null, input.n_members ?? null, input.abstained ?? null,
      input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listNormTables(pool: Pool, assessmentSlug?: string): Promise<unknown[]> {
  assertEnabled();
  return assessmentSlug
    ? safeRows(pool, `SELECT * FROM aint_norm_tables WHERE assessment_slug=$1 ORDER BY updated_at DESC LIMIT 500`, [assessmentSlug])
    : safeRows(pool, `SELECT * FROM aint_norm_tables ORDER BY updated_at DESC LIMIT 500`);
}

export interface StandardScoreInput {
  score_key: string; subject_ref?: string; assessment_slug?: string; raw_value?: number | null;
  z?: number | null; percentile?: number | null; t_score?: number | null; stanine?: number | null;
  sten?: number | null; deviation_score?: number | null; norm_key?: string; abstained?: boolean; detail?: unknown;
}
export async function saveStandardScore(pool: Pool, input: StandardScoreInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_standard_scores (score_key, subject_ref, assessment_slug, raw_value, z, percentile, t_score, stanine, sten, deviation_score, norm_key, abstained, detail)
     VALUES ($1,$2,COALESCE($3,''),$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,false),COALESCE($13,'{}')::jsonb)
     ON CONFLICT (score_key) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, assessment_slug=EXCLUDED.assessment_slug, raw_value=EXCLUDED.raw_value,
       z=EXCLUDED.z, percentile=EXCLUDED.percentile, t_score=EXCLUDED.t_score, stanine=EXCLUDED.stanine,
       sten=EXCLUDED.sten, deviation_score=EXCLUDED.deviation_score, norm_key=EXCLUDED.norm_key,
       abstained=EXCLUDED.abstained, detail=EXCLUDED.detail
     RETURNING *`,
    [input.score_key, input.subject_ref ?? null, input.assessment_slug ?? null, input.raw_value ?? null,
      input.z ?? null, input.percentile ?? null, input.t_score ?? null, input.stanine ?? null, input.sten ?? null,
      input.deviation_score ?? null, input.norm_key ?? null, input.abstained ?? null,
      input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listStandardScores(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_standard_scores WHERE subject_ref=$1 ORDER BY created_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_standard_scores ORDER BY created_at DESC LIMIT 500`);
}

export interface BenchmarkInput {
  benchmark_key: string; subject_ref?: string; scope?: string; assessment_slug?: string; value?: number | null;
  percentile?: number | null; relative?: string; n_members?: number; abstained?: boolean; detail?: unknown;
}
export async function saveBenchmark(pool: Pool, input: BenchmarkInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_benchmarks (benchmark_key, subject_ref, scope, assessment_slug, value, percentile, relative, n_members, abstained, detail)
     VALUES ($1,$2,COALESCE($3,'peer_cohort'),COALESCE($4,''),$5,$6,$7,COALESCE($8,0),COALESCE($9,false),COALESCE($10,'{}')::jsonb)
     ON CONFLICT (benchmark_key, scope) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, assessment_slug=EXCLUDED.assessment_slug, value=EXCLUDED.value,
       percentile=EXCLUDED.percentile, relative=EXCLUDED.relative, n_members=EXCLUDED.n_members,
       abstained=EXCLUDED.abstained, detail=EXCLUDED.detail
     RETURNING *`,
    [input.benchmark_key, input.subject_ref ?? null, input.scope ?? null, input.assessment_slug ?? null,
      input.value ?? null, input.percentile ?? null, input.relative ?? null, input.n_members ?? null,
      input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listBenchmarks(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_benchmarks WHERE subject_ref=$1 ORDER BY created_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_benchmarks ORDER BY created_at DESC LIMIT 500`);
}

export interface InterpretationInput {
  interp_key: string; subject_ref?: string; assessment_slug?: string; narrative?: string;
  strengths?: unknown; development_areas?: unknown; reasoning?: unknown; recommendations?: unknown;
  confidence?: number | null; source?: string; abstained?: boolean; detail?: unknown;
}
export async function saveInterpretation(pool: Pool, input: InterpretationInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_interpretations (interp_key, subject_ref, assessment_slug, narrative, strengths, development_areas, reasoning, recommendations, confidence, source, abstained, detail)
     VALUES ($1,$2,COALESCE($3,''),$4,COALESCE($5,'[]')::jsonb,COALESCE($6,'[]')::jsonb,COALESCE($7,'[]')::jsonb,COALESCE($8,'[]')::jsonb,$9,COALESCE($10,'deterministic'),COALESCE($11,false),COALESCE($12,'{}')::jsonb)
     ON CONFLICT (interp_key) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, assessment_slug=EXCLUDED.assessment_slug, narrative=EXCLUDED.narrative,
       strengths=EXCLUDED.strengths, development_areas=EXCLUDED.development_areas, reasoning=EXCLUDED.reasoning,
       recommendations=EXCLUDED.recommendations, confidence=EXCLUDED.confidence, source=EXCLUDED.source,
       abstained=EXCLUDED.abstained, detail=EXCLUDED.detail
     RETURNING *`,
    [input.interp_key, input.subject_ref ?? null, input.assessment_slug ?? null, input.narrative ?? null,
      input.strengths ? JSON.stringify(input.strengths) : null, input.development_areas ? JSON.stringify(input.development_areas) : null,
      input.reasoning ? JSON.stringify(input.reasoning) : null, input.recommendations ? JSON.stringify(input.recommendations) : null,
      input.confidence ?? null, input.source ?? null, input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listInterpretations(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_interpretations WHERE subject_ref=$1 ORDER BY created_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_interpretations ORDER BY created_at DESC LIMIT 500`);
}

export interface ReportInput {
  report_key: string; subject_ref?: string; assessment_slug?: string; sections?: unknown; section_count?: number; status?: string; detail?: unknown;
}
export async function saveReport(pool: Pool, input: ReportInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_reports (report_key, subject_ref, assessment_slug, sections, section_count, status, detail)
     VALUES ($1,$2,COALESCE($3,''),COALESCE($4,'[]')::jsonb,COALESCE($5,0),COALESCE($6,'draft'),COALESCE($7,'{}')::jsonb)
     ON CONFLICT (report_key) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, assessment_slug=EXCLUDED.assessment_slug, sections=EXCLUDED.sections,
       section_count=EXCLUDED.section_count, status=EXCLUDED.status, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.report_key, input.subject_ref ?? null, input.assessment_slug ?? null,
      input.sections ? JSON.stringify(input.sections) : null, input.section_count ?? null, input.status ?? null,
      input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listReports(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_reports WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_reports ORDER BY updated_at DESC LIMIT 500`);
}

export interface PerformanceRecordInput {
  perf_key: string; subject_ref?: string; assessment_slug?: string; overall_standing?: string; overall_score?: number | null;
  percentile?: number | null; readiness_band?: string; peer_relative?: string; growth_trajectory?: string;
  dimension_profile?: unknown; abstained?: boolean; detail?: unknown;
}
export async function savePerformance(pool: Pool, input: PerformanceRecordInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_performance (perf_key, subject_ref, assessment_slug, overall_standing, overall_score, percentile, readiness_band, peer_relative, growth_trajectory, dimension_profile, abstained, detail)
     VALUES ($1,$2,COALESCE($3,''),$4,$5,$6,$7,$8,$9,COALESCE($10,'[]')::jsonb,COALESCE($11,false),COALESCE($12,'{}')::jsonb)
     ON CONFLICT (perf_key) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, assessment_slug=EXCLUDED.assessment_slug, overall_standing=EXCLUDED.overall_standing,
       overall_score=EXCLUDED.overall_score, percentile=EXCLUDED.percentile, readiness_band=EXCLUDED.readiness_band,
       peer_relative=EXCLUDED.peer_relative, growth_trajectory=EXCLUDED.growth_trajectory,
       dimension_profile=EXCLUDED.dimension_profile, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.perf_key, input.subject_ref ?? null, input.assessment_slug ?? null, input.overall_standing ?? null,
      input.overall_score ?? null, input.percentile ?? null, input.readiness_band ?? null, input.peer_relative ?? null,
      input.growth_trajectory ?? null, input.dimension_profile ? JSON.stringify(input.dimension_profile) : null,
      input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listPerformance(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_performance WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_performance ORDER BY updated_at DESC LIMIT 500`);
}

export interface RepositoryInput { artefact_key: string; version?: number; artefact_type?: string; ref?: string; payload?: unknown; status?: string }
export async function saveRepositoryArtefact(pool: Pool, input: RepositoryInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_repository (artefact_key, version, artefact_type, ref, payload, status)
     VALUES ($1,COALESCE($2,1),COALESCE($3,'standard_scores'),$4,COALESCE($5,'{}')::jsonb,COALESCE($6,'active'))
     ON CONFLICT (artefact_key, version) DO UPDATE SET
       artefact_type=EXCLUDED.artefact_type, ref=EXCLUDED.ref, payload=EXCLUDED.payload,
       status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.artefact_key, input.version ?? null, input.artefact_type ?? null, input.ref ?? null,
      input.payload ? JSON.stringify(input.payload) : null, input.status ?? null],
  );
  return rows[0];
}
export async function listRepository(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM aint_repository ORDER BY updated_at DESC LIMIT 500`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE — read-only adoption counts (null-safe; SEPARATE axis, never a gap)
// ═════════════════════════════════════════════════════════════════════════════
export async function normTablesCoverage(pool: Pool): Promise<{ norm_tables: number | null; types_used: number | null; assessments: number | null; abstained: number | null }> {
  return {
    norm_tables: await count(pool, `SELECT COUNT(*)::int FROM aint_norm_tables`),
    types_used: await count(pool, `SELECT COUNT(DISTINCT norm_type)::int FROM aint_norm_tables`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM aint_norm_tables`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_norm_tables WHERE abstained=true`),
  };
}
export async function standardScoresCoverage(pool: Pool): Promise<{ scores: number | null; subjects: number | null; assessments: number | null; abstained: number | null }> {
  return {
    scores: await count(pool, `SELECT COUNT(*)::int FROM aint_standard_scores`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_standard_scores`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM aint_standard_scores`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_standard_scores WHERE abstained=true`),
  };
}
export async function benchmarksCoverage(pool: Pool): Promise<{ benchmarks: number | null; subjects: number | null; scopes_used: number | null; abstained: number | null }> {
  return {
    benchmarks: await count(pool, `SELECT COUNT(*)::int FROM aint_benchmarks`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_benchmarks`),
    scopes_used: await count(pool, `SELECT COUNT(DISTINCT scope)::int FROM aint_benchmarks`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_benchmarks WHERE abstained=true`),
  };
}
export async function interpretationsCoverage(pool: Pool): Promise<{ interpretations: number | null; subjects: number | null; with_confidence: number | null; abstained: number | null }> {
  return {
    interpretations: await count(pool, `SELECT COUNT(*)::int FROM aint_interpretations`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_interpretations`),
    with_confidence: await count(pool, `SELECT COUNT(*)::int FROM aint_interpretations WHERE confidence IS NOT NULL`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_interpretations WHERE abstained=true`),
  };
}
export async function reportsCoverage(pool: Pool): Promise<{ reports: number | null; subjects: number | null; assessments: number | null }> {
  return {
    reports: await count(pool, `SELECT COUNT(*)::int FROM aint_reports`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_reports`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM aint_reports`),
  };
}
export async function performanceCoverage(pool: Pool): Promise<{ performance: number | null; subjects: number | null; assessments: number | null; abstained: number | null }> {
  return {
    performance: await count(pool, `SELECT COUNT(*)::int FROM aint_performance`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_performance`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM aint_performance`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_performance WHERE abstained=true`),
  };
}
export async function repositoryCoverage(pool: Pool): Promise<{ artefacts: number | null; types_used: number | null; active: number | null }> {
  return {
    artefacts: await count(pool, `SELECT COUNT(*)::int FROM aint_repository`),
    types_used: await count(pool, `SELECT COUNT(DISTINCT artefact_type)::int FROM aint_repository`),
    active: await count(pool, `SELECT COUNT(*)::int FROM aint_repository WHERE status='active'`),
  };
}
