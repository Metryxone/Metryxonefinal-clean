/**
 * CAPADEX 3.0 — Program 3 · Phase 3.7 Assessment Intelligence (Interpretation & Reporting) — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build engineering-closure mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureAintSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The additive
 * overlay tables are:
 *   aint_norm_tables     — norm reference tables (cohort/role/stage/self/custom) with mean/sd/n.
 *   aint_standard_scores — per-subject percentile/z/T/stanine/sten/deviation standard scores.
 *   aint_benchmarks      — per-subject peer/role/stage/temporal benchmark comparisons.
 *   aint_interpretations — per-subject AI narrative (strengths/development/reasoning/recommendations).
 *   aint_reports         — per-subject section-aware interpretation reports.
 *   aint_performance     — per-subject candidate-performance analytics.
 *   aint_repository      — versioned interpretation-artefact catalogue.
 *
 * The PURE compute/compose helpers (computeStandardScores/composeNormReference/composeBenchmark/
 * composeInterpretation/composeReport/composePerformance) have NO DB + NO DDL + NO eval — they are
 * deterministic + side-effect free and REUSE the existing interpretation services
 * (psychometric-standardization). Norm-referenced statistics + benchmarks ABSTAIN below k_min real
 * members — they return { abstained:true } rather than fabricating a value. AI narrative confidence
 * stays null while cold-start / uncalibrated. This module turns a SCORED result into MEANING — it
 * NEVER re-scores or re-validates the instrument.
 *
 * Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty).
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { AINT_K_MIN } from '../config/assessment-intelligence';
import {
  zFromValue, zToPercentile, standardScoresFromZ, stanineBand, type StandardScoreSet,
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
      ref_group      TEXT NOT NULL DEFAULT '',
      mean           DOUBLE PRECISION,
      sd             DOUBLE PRECISION,
      n_members      INTEGER NOT NULL DEFAULT 0,
      percentiles    JSONB NOT NULL DEFAULT '{}'::jsonb,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      status         TEXT NOT NULL DEFAULT 'active',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (norm_key, norm_type)
    );
    CREATE INDEX IF NOT EXISTS aint_norm_tables_type_idx ON aint_norm_tables(norm_type);
    CREATE TABLE IF NOT EXISTS aint_standard_scores (
      id             BIGSERIAL PRIMARY KEY,
      score_key      TEXT NOT NULL,
      subject_ref    TEXT NOT NULL DEFAULT '',
      assessment_slug TEXT NOT NULL DEFAULT '',
      raw_value      DOUBLE PRECISION,
      z              DOUBLE PRECISION,
      percentile     DOUBLE PRECISION,
      t_score        DOUBLE PRECISION,
      stanine        DOUBLE PRECISION,
      sten           DOUBLE PRECISION,
      deviation      DOUBLE PRECISION,
      band           TEXT,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (score_key, assessment_slug)
    );
    CREATE INDEX IF NOT EXISTS aint_standard_scores_subject_idx ON aint_standard_scores(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_benchmarks (
      id             BIGSERIAL PRIMARY KEY,
      benchmark_key  TEXT NOT NULL,
      subject_ref    TEXT NOT NULL DEFAULT '',
      scope          TEXT NOT NULL DEFAULT 'peer_cohort',
      ref_group      TEXT NOT NULL DEFAULT '',
      candidate_value DOUBLE PRECISION,
      ref_mean       DOUBLE PRECISION,
      ref_sd         DOUBLE PRECISION,
      n_members      INTEGER NOT NULL DEFAULT 0,
      percentile     DOUBLE PRECISION,
      position       TEXT,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (benchmark_key, scope)
    );
    CREATE INDEX IF NOT EXISTS aint_benchmarks_subject_idx ON aint_benchmarks(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_interpretations (
      id             BIGSERIAL PRIMARY KEY,
      interp_key     TEXT NOT NULL,
      subject_ref    TEXT NOT NULL DEFAULT '',
      assessment_slug TEXT NOT NULL DEFAULT '',
      narrative      TEXT,
      strengths      JSONB NOT NULL DEFAULT '[]'::jsonb,
      development    JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      reasoning      JSONB NOT NULL DEFAULT '[]'::jsonb,
      confidence     DOUBLE PRECISION,
      source         TEXT NOT NULL DEFAULT 'composed',
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (interp_key, assessment_slug)
    );
    CREATE INDEX IF NOT EXISTS aint_interpretations_subject_idx ON aint_interpretations(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_reports (
      id             BIGSERIAL PRIMARY KEY,
      report_key     TEXT NOT NULL,
      subject_ref    TEXT NOT NULL DEFAULT '',
      assessment_slug TEXT NOT NULL DEFAULT '',
      sections       JSONB NOT NULL DEFAULT '[]'::jsonb,
      status         TEXT NOT NULL DEFAULT 'composed',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (report_key, assessment_slug)
    );
    CREATE INDEX IF NOT EXISTS aint_reports_subject_idx ON aint_reports(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_performance (
      id             BIGSERIAL PRIMARY KEY,
      perf_key       TEXT NOT NULL,
      subject_ref    TEXT NOT NULL DEFAULT '',
      assessment_slug TEXT NOT NULL DEFAULT '',
      overall_standing DOUBLE PRECISION,
      dimension_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      percentile     DOUBLE PRECISION,
      peer_relative  DOUBLE PRECISION,
      growth_trajectory JSONB NOT NULL DEFAULT '{}'::jsonb,
      readiness_band TEXT,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (perf_key, assessment_slug)
    );
    CREATE INDEX IF NOT EXISTS aint_performance_subject_idx ON aint_performance(subject_ref);
    CREATE TABLE IF NOT EXISTS aint_repository (
      id             BIGSERIAL PRIMARY KEY,
      artefact_key   TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      artefact_type  TEXT NOT NULL DEFAULT 'interpretation',
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
 * exercised via a write), the query throws → we honestly return empty ([]),
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

// ═════════════════════════════════════════════════════════════════════════════
// PURE compute/compose helpers (NO DB, NO DDL, NO eval, deterministic, side-effect free)
// ═════════════════════════════════════════════════════════════════════════════

export interface StandardScoreResult extends StandardScoreSet {
  z: number | null;
  band: string | null;
  abstained: boolean;
  reason?: string;
}

/**
 * Standardize a raw value against a reference distribution (mean, sd). REUSES the pure
 * psychometric-standardization functions. Returns { abstained:true } when the reference is
 * unusable (missing/zero SD) — never fabricates a standard score.
 */
export function computeStandardScores(rawValue: number | null, mean: number | null, sd: number | null): StandardScoreResult {
  const z = zFromValue(rawValue, mean, sd);
  if (z === null) {
    return { z: null, percentile: null, t: null, stanine: null, sten: null, deviation: null, band: null, abstained: true, reason: 'unusable_reference_distribution' };
  }
  const set = standardScoresFromZ(z);
  return { z, ...set, band: stanineBand(set.stanine), abstained: false };
}

export interface NormReferenceResult {
  norm_type: string;
  ref_group: string;
  n_members: number;
  percentile: number | null;
  band: string | null;
  abstained: boolean;
  reason?: string;
}

/**
 * Interpret a raw value against a norm reference group. ABSTAINS below k_min real members —
 * returns { abstained:true } rather than fabricating a percentile.
 */
export function composeNormReference(
  rawValue: number | null,
  ref: { norm_type?: string; ref_group?: string; mean: number | null; sd: number | null; n_members: number },
): NormReferenceResult {
  const norm_type = ref.norm_type ?? 'cohort_norm';
  const ref_group = ref.ref_group ?? '';
  if (ref.n_members < AINT_K_MIN) {
    return { norm_type, ref_group, n_members: ref.n_members, percentile: null, band: null, abstained: true, reason: `below_k_min_${AINT_K_MIN}` };
  }
  const z = zFromValue(rawValue, ref.mean, ref.sd);
  if (z === null) {
    return { norm_type, ref_group, n_members: ref.n_members, percentile: null, band: null, abstained: true, reason: 'unusable_reference_distribution' };
  }
  return { norm_type, ref_group, n_members: ref.n_members, percentile: zToPercentile(z), band: stanineBand(standardScoresFromZ(z).stanine), abstained: false };
}

export interface BenchmarkResult {
  scope: string;
  ref_group: string;
  n_members: number;
  percentile: number | null;
  position: string | null;
  abstained: boolean;
  reason?: string;
}

/**
 * Benchmark a candidate value against a reference group. ABSTAINS below k_min real members.
 * Position is a deterministic band derived from the percentile (never fabricated).
 */
export function composeBenchmark(
  candidateValue: number | null,
  ref: { scope?: string; ref_group?: string; mean: number | null; sd: number | null; n_members: number },
): BenchmarkResult {
  const scope = ref.scope ?? 'peer_cohort';
  const ref_group = ref.ref_group ?? '';
  if (ref.n_members < AINT_K_MIN) {
    return { scope, ref_group, n_members: ref.n_members, percentile: null, position: null, abstained: true, reason: `below_k_min_${AINT_K_MIN}` };
  }
  const z = zFromValue(candidateValue, ref.mean, ref.sd);
  if (z === null) {
    return { scope, ref_group, n_members: ref.n_members, percentile: null, position: null, abstained: true, reason: 'unusable_reference_distribution' };
  }
  const pct = zToPercentile(z);
  let position: string | null = null;
  if (pct !== null) {
    position = pct >= 75 ? 'above_reference' : pct >= 25 ? 'at_reference' : 'below_reference';
  }
  return { scope, ref_group, n_members: ref.n_members, percentile: pct, position, abstained: false };
}

export interface InterpretationResult {
  narrative: string;
  strengths: string[];
  development: string[];
  recommendations: string[];
  reasoning: string[];
  confidence: number | null;
  source: string;
  abstained: boolean;
}

/**
 * Compose a DETERMINISTIC narrative interpretation over a set of standardized dimension scores.
 * This is a template-composed narrative (not an LLM call) — honest + reproducible; confidence stays
 * null while there is no calibrated model. Strengths/development are derived from the percentile band
 * of each dimension (>= 60 strength, < 40 development). Never fabricates a confidence number.
 */
export function composeInterpretation(
  dimensions: { key: string; label?: string; percentile: number | null }[],
): InterpretationResult {
  const measured = dimensions.filter((d) => typeof d.percentile === 'number' && Number.isFinite(d.percentile));
  if (measured.length === 0) {
    return { narrative: 'Insufficient standardized data to interpret.', strengths: [], development: [], recommendations: [], reasoning: [], confidence: null, source: 'composed', abstained: true };
  }
  const strengths = measured.filter((d) => (d.percentile as number) >= 60).map((d) => d.label ?? d.key);
  const development = measured.filter((d) => (d.percentile as number) < 40).map((d) => d.label ?? d.key);
  const reasoning = measured.map((d) => `${d.label ?? d.key}: percentile ${Math.round(d.percentile as number)}`);
  const recommendations = development.map((d) => `Focus development on ${d}.`);
  const narrative =
    (strengths.length ? `Relative strengths: ${strengths.join(', ')}. ` : '') +
    (development.length ? `Development areas: ${development.join(', ')}. ` : '') +
    (!strengths.length && !development.length ? 'Performance is broadly at the reference midpoint across dimensions. ' : '');
  return { narrative: narrative.trim(), strengths, development, recommendations, reasoning, confidence: null, source: 'composed', abstained: false };
}

export interface ReportSection { key: string; label: string; present: boolean; content: unknown }
export interface ReportResult { sections: ReportSection[]; section_count: number }

/**
 * Assemble a section-aware interpretation report from the interpretation artefacts. Sections with no
 * content are marked present:false (honest empty), never fabricated.
 */
export function composeReport(parts: {
  overview?: unknown; scoreSummary?: unknown; normInterpretation?: unknown; benchmark?: unknown;
  narrative?: unknown; strengthsDevelopment?: unknown; recommendations?: unknown; nextSteps?: unknown;
}): ReportResult {
  const def: { key: string; label: string; content: unknown }[] = [
    { key: 'overview', label: 'Overview', content: parts.overview ?? null },
    { key: 'score_summary', label: 'Score summary', content: parts.scoreSummary ?? null },
    { key: 'norm_interpretation', label: 'Norm interpretation', content: parts.normInterpretation ?? null },
    { key: 'benchmark', label: 'Benchmark comparison', content: parts.benchmark ?? null },
    { key: 'narrative', label: 'AI narrative', content: parts.narrative ?? null },
    { key: 'strengths_development', label: 'Strengths & development areas', content: parts.strengthsDevelopment ?? null },
    { key: 'recommendations', label: 'Recommendations', content: parts.recommendations ?? null },
    { key: 'next_steps', label: 'Next steps / action plan', content: parts.nextSteps ?? null },
  ];
  const sections = def.map((s) => ({ ...s, present: s.content != null }));
  return { sections, section_count: sections.length };
}

export interface PerformanceResult {
  overall_standing: number | null;
  dimension_profile: { key: string; percentile: number | null }[];
  percentile: number | null;
  readiness_band: string | null;
  abstained: boolean;
}

/**
 * Compose candidate-performance analytics from standardized dimension percentiles. Overall standing is
 * the mean of measured dimension percentiles; readiness band derived deterministically. ABSTAINS when
 * no dimension is measured.
 */
export function composePerformance(
  dimensions: { key: string; percentile: number | null }[],
): PerformanceResult {
  const profile = dimensions.map((d) => ({ key: d.key, percentile: (typeof d.percentile === 'number' && Number.isFinite(d.percentile)) ? d.percentile : null }));
  const measured = profile.filter((d) => d.percentile !== null) as { key: string; percentile: number }[];
  if (measured.length === 0) {
    return { overall_standing: null, dimension_profile: profile, percentile: null, readiness_band: null, abstained: true };
  }
  const overall = measured.reduce((a, d) => a + d.percentile, 0) / measured.length;
  const band = overall >= 75 ? 'high' : overall >= 50 ? 'above_average' : overall >= 25 ? 'below_average' : 'low';
  return { overall_standing: overall, dimension_profile: profile, percentile: overall, readiness_band: band, abstained: false };
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERLAY WRITES (flag-gated; the ONLY DDL sites) + reads
// ═════════════════════════════════════════════════════════════════════════════

export interface NormTableInput { norm_key: string; norm_type?: string; ref_group?: string; mean?: number | null; sd?: number | null; n_members?: number; percentiles?: unknown; abstained?: boolean; status?: string }
export async function saveNormTable(pool: Pool, input: NormTableInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_norm_tables (norm_key, norm_type, ref_group, mean, sd, n_members, percentiles, abstained, status)
     VALUES ($1,COALESCE($2,'cohort_norm'),COALESCE($3,''),$4,$5,COALESCE($6,0),COALESCE($7,'{}')::jsonb,COALESCE($8,false),COALESCE($9,'active'))
     ON CONFLICT (norm_key, norm_type) DO UPDATE SET
       ref_group=EXCLUDED.ref_group, mean=EXCLUDED.mean, sd=EXCLUDED.sd, n_members=EXCLUDED.n_members,
       percentiles=EXCLUDED.percentiles, abstained=EXCLUDED.abstained, status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.norm_key, input.norm_type ?? null, input.ref_group ?? null, input.mean ?? null, input.sd ?? null,
      input.n_members ?? null, input.percentiles ? JSON.stringify(input.percentiles) : null, input.abstained ?? null, input.status ?? null],
  );
  return rows[0];
}
export async function listNormTables(pool: Pool, normType?: string): Promise<unknown[]> {
  assertEnabled();
  return normType
    ? safeRows(pool, `SELECT * FROM aint_norm_tables WHERE norm_type=$1 ORDER BY updated_at DESC LIMIT 500`, [normType])
    : safeRows(pool, `SELECT * FROM aint_norm_tables ORDER BY updated_at DESC LIMIT 500`);
}

export interface StandardScoreInput {
  score_key: string; subject_ref?: string; assessment_slug?: string; raw_value?: number | null;
  z?: number | null; percentile?: number | null; t_score?: number | null; stanine?: number | null;
  sten?: number | null; deviation?: number | null; band?: string | null; abstained?: boolean; detail?: unknown;
}
export async function saveStandardScore(pool: Pool, input: StandardScoreInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_standard_scores (score_key, subject_ref, assessment_slug, raw_value, z, percentile, t_score,
       stanine, sten, deviation, band, abstained, detail)
     VALUES ($1,COALESCE($2,''),COALESCE($3,''),$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,false),COALESCE($13,'{}')::jsonb)
     ON CONFLICT (score_key, assessment_slug) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, raw_value=EXCLUDED.raw_value, z=EXCLUDED.z, percentile=EXCLUDED.percentile,
       t_score=EXCLUDED.t_score, stanine=EXCLUDED.stanine, sten=EXCLUDED.sten, deviation=EXCLUDED.deviation,
       band=EXCLUDED.band, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.score_key, input.subject_ref ?? null, input.assessment_slug ?? null, input.raw_value ?? null,
      input.z ?? null, input.percentile ?? null, input.t_score ?? null, input.stanine ?? null, input.sten ?? null,
      input.deviation ?? null, input.band ?? null, input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listStandardScores(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_standard_scores WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_standard_scores ORDER BY updated_at DESC LIMIT 500`);
}

export interface BenchmarkRecordInput {
  benchmark_key: string; subject_ref?: string; scope?: string; ref_group?: string; candidate_value?: number | null;
  ref_mean?: number | null; ref_sd?: number | null; n_members?: number; percentile?: number | null; position?: string | null;
  abstained?: boolean; detail?: unknown;
}
export async function saveBenchmark(pool: Pool, input: BenchmarkRecordInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_benchmarks (benchmark_key, subject_ref, scope, ref_group, candidate_value, ref_mean, ref_sd,
       n_members, percentile, position, abstained, detail)
     VALUES ($1,COALESCE($2,''),COALESCE($3,'peer_cohort'),COALESCE($4,''),$5,$6,$7,COALESCE($8,0),$9,$10,COALESCE($11,false),COALESCE($12,'{}')::jsonb)
     ON CONFLICT (benchmark_key, scope) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, ref_group=EXCLUDED.ref_group, candidate_value=EXCLUDED.candidate_value,
       ref_mean=EXCLUDED.ref_mean, ref_sd=EXCLUDED.ref_sd, n_members=EXCLUDED.n_members, percentile=EXCLUDED.percentile,
       position=EXCLUDED.position, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.benchmark_key, input.subject_ref ?? null, input.scope ?? null, input.ref_group ?? null, input.candidate_value ?? null,
      input.ref_mean ?? null, input.ref_sd ?? null, input.n_members ?? null, input.percentile ?? null, input.position ?? null,
      input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listBenchmarks(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_benchmarks WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_benchmarks ORDER BY updated_at DESC LIMIT 500`);
}

export interface InterpretationInput {
  interp_key: string; subject_ref?: string; assessment_slug?: string; narrative?: string | null;
  strengths?: unknown; development?: unknown; recommendations?: unknown; reasoning?: unknown;
  confidence?: number | null; source?: string; abstained?: boolean; detail?: unknown;
}
export async function saveInterpretation(pool: Pool, input: InterpretationInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_interpretations (interp_key, subject_ref, assessment_slug, narrative, strengths, development,
       recommendations, reasoning, confidence, source, abstained, detail)
     VALUES ($1,COALESCE($2,''),COALESCE($3,''),$4,COALESCE($5,'[]')::jsonb,COALESCE($6,'[]')::jsonb,
       COALESCE($7,'[]')::jsonb,COALESCE($8,'[]')::jsonb,$9,COALESCE($10,'composed'),COALESCE($11,false),COALESCE($12,'{}')::jsonb)
     ON CONFLICT (interp_key, assessment_slug) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, narrative=EXCLUDED.narrative, strengths=EXCLUDED.strengths,
       development=EXCLUDED.development, recommendations=EXCLUDED.recommendations, reasoning=EXCLUDED.reasoning,
       confidence=EXCLUDED.confidence, source=EXCLUDED.source, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.interp_key, input.subject_ref ?? null, input.assessment_slug ?? null, input.narrative ?? null,
      input.strengths ? JSON.stringify(input.strengths) : null, input.development ? JSON.stringify(input.development) : null,
      input.recommendations ? JSON.stringify(input.recommendations) : null, input.reasoning ? JSON.stringify(input.reasoning) : null,
      input.confidence ?? null, input.source ?? null, input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listInterpretations(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_interpretations WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_interpretations ORDER BY updated_at DESC LIMIT 500`);
}

export interface ReportRecordInput { report_key: string; subject_ref?: string; assessment_slug?: string; sections?: unknown; status?: string; detail?: unknown }
export async function saveReport(pool: Pool, input: ReportRecordInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_reports (report_key, subject_ref, assessment_slug, sections, status, detail)
     VALUES ($1,COALESCE($2,''),COALESCE($3,''),COALESCE($4,'[]')::jsonb,COALESCE($5,'composed'),COALESCE($6,'{}')::jsonb)
     ON CONFLICT (report_key, assessment_slug) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, sections=EXCLUDED.sections, status=EXCLUDED.status, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.report_key, input.subject_ref ?? null, input.assessment_slug ?? null,
      input.sections ? JSON.stringify(input.sections) : null, input.status ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listReports(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM aint_reports WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM aint_reports ORDER BY updated_at DESC LIMIT 500`);
}

export interface PerformanceInput {
  perf_key: string; subject_ref?: string; assessment_slug?: string; overall_standing?: number | null;
  dimension_profile?: unknown; percentile?: number | null; peer_relative?: number | null;
  growth_trajectory?: unknown; readiness_band?: string | null; abstained?: boolean; detail?: unknown;
}
export async function savePerformance(pool: Pool, input: PerformanceInput): Promise<unknown> {
  assertEnabled();
  await ensureAintSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO aint_performance (perf_key, subject_ref, assessment_slug, overall_standing, dimension_profile,
       percentile, peer_relative, growth_trajectory, readiness_band, abstained, detail)
     VALUES ($1,COALESCE($2,''),COALESCE($3,''),$4,COALESCE($5,'{}')::jsonb,$6,$7,COALESCE($8,'{}')::jsonb,$9,COALESCE($10,false),COALESCE($11,'{}')::jsonb)
     ON CONFLICT (perf_key, assessment_slug) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, overall_standing=EXCLUDED.overall_standing, dimension_profile=EXCLUDED.dimension_profile,
       percentile=EXCLUDED.percentile, peer_relative=EXCLUDED.peer_relative, growth_trajectory=EXCLUDED.growth_trajectory,
       readiness_band=EXCLUDED.readiness_band, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail, updated_at=now()
     RETURNING *`,
    [input.perf_key, input.subject_ref ?? null, input.assessment_slug ?? null, input.overall_standing ?? null,
      input.dimension_profile ? JSON.stringify(input.dimension_profile) : null, input.percentile ?? null, input.peer_relative ?? null,
      input.growth_trajectory ? JSON.stringify(input.growth_trajectory) : null, input.readiness_band ?? null,
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
     VALUES ($1,COALESCE($2,1),COALESCE($3,'interpretation'),$4,COALESCE($5,'{}')::jsonb,COALESCE($6,'active'))
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
export async function normCoverage(pool: Pool): Promise<{ norm_tables: number | null; types_used: number | null; abstained: number | null }> {
  return {
    norm_tables: await count(pool, `SELECT COUNT(*)::int FROM aint_norm_tables`),
    types_used: await count(pool, `SELECT COUNT(DISTINCT norm_type)::int FROM aint_norm_tables`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_norm_tables WHERE abstained=true`),
  };
}
export async function standardScoreCoverage(pool: Pool): Promise<{ records: number | null; subjects: number | null; abstained: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM aint_standard_scores`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_standard_scores`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_standard_scores WHERE abstained=true`),
  };
}
export async function benchmarkCoverage(pool: Pool): Promise<{ records: number | null; subjects: number | null; scopes_used: number | null; abstained: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM aint_benchmarks`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_benchmarks`),
    scopes_used: await count(pool, `SELECT COUNT(DISTINCT scope)::int FROM aint_benchmarks`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_benchmarks WHERE abstained=true`),
  };
}
export async function interpretationCoverage(pool: Pool): Promise<{ records: number | null; subjects: number | null; with_confidence: number | null; abstained: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM aint_interpretations`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_interpretations`),
    with_confidence: await count(pool, `SELECT COUNT(*)::int FROM aint_interpretations WHERE confidence IS NOT NULL`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM aint_interpretations WHERE abstained=true`),
  };
}
export async function reportCoverage(pool: Pool): Promise<{ records: number | null; subjects: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM aint_reports`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_reports`),
  };
}
export async function performanceCoverage(pool: Pool): Promise<{ records: number | null; subjects: number | null; abstained: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM aint_performance`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM aint_performance`),
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
