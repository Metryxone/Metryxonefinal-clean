/**
 * MX-101B — Assessment Readiness Engine (Phase 3) + coverage/readiness trend snapshots (Phase 5).
 *
 * ADDITIVE, flag-gated (`assessmentReadiness`). COMPOSES the existing three-axis coverage
 * (getThreeAxisCoverage) — it does NOT recompute or replace it. It EXTENDS the assessment-ready
 * axis with a fourth, CONFIDENCE criterion (quality-threshold) derived from the Phase-1
 * certification ledger, keeping Coverage (how many competencies are shaped) and Confidence
 * (how many of those are quality-assured) on SEPARATE axes.
 *
 * Per-competency readiness criteria (the first three mirror the existing live gate EXACTLY):
 *   1. approved_exist        — >=4 approved + active-mapped questions
 *   2. difficulty_coverage   — >=2 distinct difficulty bands among them
 *   3. diversity             — >=2 distinct question types among them
 *   4. quality_threshold_met — NEW: every approved question is certified non-failed AND the mean
 *                              STRUCTURAL certification score clears the floor. If any approved
 *                              question has no certification, quality is INDETERMINATE (null) —
 *                              never silently treated as pass or fail.
 *
 * Honest readiness ladder (each strictly contains the next): not_ready ⊂ ready_unverified /
 * ready_quality_concern ⊂ ready_assured. quality_assured <= base_ready <= approved <= draft, always.
 *
 * GET-never-writes: reads probe with to_regclass and degrade. ensure-schema is POST/snapshot-only.
 */
import type { Pool } from 'pg';
import { getThreeAxisCoverage } from './question-factory-population';

export const READINESS_VERSION = 'mx101b-readiness-1.0.0';

// Mirrors the live assessment-ready gate (question-factory-population.ts).
const MIN_APPROVED = 4;
const MIN_TYPES = 2;
const MIN_DIFFS = 2;
// NEW confidence floor for the structural certification mean of a competency's approved questions.
const QUALITY_STRUCTURAL_FLOOR = 70;

const num = (v: any) => Number(v ?? 0) || 0;

async function certReady(pool: Pool): Promise<boolean> {
  const r = await pool.query<{ ready: boolean }>(`SELECT to_regclass('question_certifications') IS NOT NULL AS ready`);
  return Boolean(r.rows[0]?.ready);
}
async function snapshotReady(pool: Pool): Promise<boolean> {
  const r = await pool.query<{ ready: boolean }>(`SELECT to_regclass('qf_coverage_snapshots') IS NOT NULL AS ready`);
  return Boolean(r.rows[0]?.ready);
}

/* --------------------------------- schema ---------------------------------- */
export async function ensureSnapshotSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qf_coverage_snapshots (
      id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      captured_at                   timestamptz NOT NULL DEFAULT now(),
      label                         text,
      total_competencies            int NOT NULL DEFAULT 0,
      draft_competencies            int NOT NULL DEFAULT 0,
      approved_competencies         int NOT NULL DEFAULT 0,
      base_ready_competencies       int NOT NULL DEFAULT 0,
      quality_assured_competencies  int NOT NULL DEFAULT 0,
      approved_questions            int NOT NULL DEFAULT 0,
      draft_questions               int NOT NULL DEFAULT 0,
      certified_questions           int NOT NULL DEFAULT 0,
      metrics                       jsonb NOT NULL DEFAULT '{}'::jsonb
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qfsnap_time ON qf_coverage_snapshots (captured_at);`);
}

/* ----------------------------- readiness core ------------------------------ */
type PerComp = {
  competency_id: string;
  canonical_name: string | null;
  n_approved: number;
  distinct_types: number;
  distinct_diffs: number;
  certified_count: number; // approved Qs that carry ANY latest cert
  failed_count: number;
  avg_structural: number | null;
  base_ready: boolean;
  quality_threshold_met: boolean | null; // null = indeterminate (uncertified approved Qs)
  readiness_level: 'not_ready' | 'ready_unverified' | 'ready_quality_concern' | 'ready_assured';
  reasons: string[];
};

async function loadPerCompetency(pool: Pool, competencyId?: string): Promise<PerComp[]> {
  const haveCert = await certReady(pool);
  const args: any[] = [];
  let filter = '';
  if (competencyId) { args.push(competencyId); filter = `AND m.competency_id = $${args.length}`; }

  const certCte = haveCert
    ? `, latest_cert AS (
         SELECT DISTINCT ON (question_id) question_id, cert_status, structural_score
         FROM question_certifications ORDER BY question_id, created_at DESC
       )`
    : '';
  const certJoin = haveCert ? `LEFT JOIN latest_cert lc ON lc.question_id = a.qid` : '';
  const certAgg = haveCert
    ? `COUNT(lc.question_id)::int AS certified_count,
       COUNT(*) FILTER (WHERE lc.cert_status='failed')::int AS failed_count,
       AVG(lc.structural_score) AS avg_structural`
    : `0::int AS certified_count, 0::int AS failed_count, NULL::numeric AS avg_structural`;

  const rs = await pool.query(`
    WITH appr AS (
      SELECT m.competency_id AS cid, t.id AS qid, t.question_type, t.difficulty_band
      FROM competency_question_templates t
      JOIN onto_competency_question_map m ON m.question_id = t.id AND m.active = true
      WHERE t.status='approved' AND t.quality_review_status='approved' ${filter}
    )${certCte}
    SELECT a.cid AS competency_id, comp.canonical_name,
      COUNT(*)::int AS n_approved,
      COUNT(DISTINCT a.question_type)::int AS distinct_types,
      COUNT(DISTINCT a.difficulty_band)::int AS distinct_diffs,
      ${certAgg}
    FROM appr a
    LEFT JOIN onto_competencies comp ON comp.id = a.cid AND comp.deprecated IS NOT TRUE
    ${certJoin}
    GROUP BY a.cid, comp.canonical_name
    ORDER BY n_approved DESC`, args);

  return rs.rows.map((r: any) => {
    const n = num(r.n_approved), types = num(r.distinct_types), diffs = num(r.distinct_diffs);
    const certified = num(r.certified_count), failed = num(r.failed_count);
    const avg = r.avg_structural == null ? null : Number(r.avg_structural);
    const base_ready = n >= MIN_APPROVED && types >= MIN_TYPES && diffs >= MIN_DIFFS;

    const reasons: string[] = [];
    if (n < MIN_APPROVED) reasons.push(`Needs ${MIN_APPROVED - n} more approved question(s) (has ${n}/${MIN_APPROVED}).`);
    if (types < MIN_TYPES) reasons.push(`Needs ${MIN_TYPES} question types (has ${types}).`);
    if (diffs < MIN_DIFFS) reasons.push(`Needs ${MIN_DIFFS} difficulty bands (has ${diffs}).`);

    let quality_threshold_met: boolean | null;
    let readiness_level: PerComp['readiness_level'];
    if (!base_ready) {
      quality_threshold_met = null;
      readiness_level = 'not_ready';
    } else if (certified < n) {
      // some approved questions are not certified → confidence indeterminate (never assume pass)
      quality_threshold_met = null;
      readiness_level = 'ready_unverified';
      reasons.push(`${n - certified} of ${n} approved question(s) are uncertified — quality is unverified (run certification).`);
    } else if (failed > 0 || (avg != null && avg < QUALITY_STRUCTURAL_FLOOR)) {
      quality_threshold_met = false;
      readiness_level = 'ready_quality_concern';
      if (failed > 0) reasons.push(`${failed} approved question(s) failed certification.`);
      if (avg != null && avg < QUALITY_STRUCTURAL_FLOOR) reasons.push(`Mean structural certification ${avg.toFixed(1)} is below the ${QUALITY_STRUCTURAL_FLOOR} floor.`);
    } else {
      quality_threshold_met = true;
      readiness_level = 'ready_assured';
    }

    return {
      competency_id: String(r.competency_id), canonical_name: r.canonical_name ?? null,
      n_approved: n, distinct_types: types, distinct_diffs: diffs,
      certified_count: certified, failed_count: failed, avg_structural: avg,
      base_ready, quality_threshold_met, readiness_level, reasons,
    };
  });
}

/** Platform-wide readiness rollup. Read-only; composes getThreeAxisCoverage for the base axes. */
export async function getAssessmentReadiness(pool: Pool) {
  const haveCert = await certReady(pool);
  const [axes, perComp] = await Promise.all([getThreeAxisCoverage(pool), loadPerCompetency(pool)]);

  const levels = { not_ready: 0, ready_unverified: 0, ready_quality_concern: 0, ready_assured: 0 };
  for (const c of perComp) levels[c.readiness_level] += 1;
  const base_ready = perComp.filter((c) => c.base_ready).length;

  return {
    ok: true, version: READINESS_VERSION, certification_available: haveCert,
    coverage_axes: {
      draft: axes.draft_coverage,
      approved: axes.approved_coverage,
      assessment_ready: axes.assessment_ready_coverage, // canonical live gate (unchanged)
    },
    readiness_breakdown: {
      base_ready, // == live assessment-ready gate
      ready_assured: levels.ready_assured, // base-ready AND quality-assured (the CONFIDENCE axis)
      ready_unverified: levels.ready_unverified, // base-ready but quality not yet certified
      ready_quality_concern: levels.ready_quality_concern, // base-ready but certification flagged a concern
    },
    criteria: {
      min_approved: MIN_APPROVED, min_types: MIN_TYPES, min_difficulty_bands: MIN_DIFFS,
      quality_structural_floor: QUALITY_STRUCTURAL_FLOOR,
    },
    confidence_note: 'base_ready is the live Coverage gate (approved questions shaped correctly). ready_assured is a SEPARATE Confidence axis layered on top via certification — it is always <= base_ready and is never composited into the coverage number. quality_unverified is honest (uncertified), not a failure.',
  };
}

/** Per-competency readiness detail (sorted not_ready-closest-first for review prioritisation). */
export async function getCompetencyReadiness(pool: Pool, opts: { onlyLevel?: string; limit?: number; competencyId?: string } = {}) {
  let rows = await loadPerCompetency(pool, opts.competencyId);
  if (opts.onlyLevel) rows = rows.filter((r) => r.readiness_level === opts.onlyLevel);
  // Prioritise the nearly-ready: base-ready-but-unverified, then quality-concern, then not-ready by closeness.
  const rank: Record<string, number> = { ready_unverified: 0, ready_quality_concern: 1, not_ready: 2, ready_assured: 3 };
  rows.sort((a, b) => (rank[a.readiness_level] - rank[b.readiness_level]) || (b.n_approved - a.n_approved));
  const limit = Math.min(Math.max(num(opts.limit) || 200, 1), 1000);
  return { ok: true, version: READINESS_VERSION, count: rows.length, items: rows.slice(0, limit) };
}

/* ------------------------- snapshots + trend series ------------------------ */

/** Capture ONE coverage/readiness snapshot (append-only). This is the only write path here. */
export async function captureSnapshot(pool: Pool, label?: string | null) {
  await ensureSnapshotSchema(pool);
  const haveCert = await certReady(pool);
  const [axes, perComp] = await Promise.all([getThreeAxisCoverage(pool), loadPerCompetency(pool)]);
  const quality_assured = perComp.filter((c) => c.readiness_level === 'ready_assured').length;
  const base_ready = perComp.filter((c) => c.base_ready).length;

  const qCounts = (await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='draft')::int draft_q,
      COUNT(*) FILTER (WHERE status='approved')::int approved_q
    FROM competency_question_templates`)).rows[0] || {};
  const certified_questions = haveCert
    ? num((await pool.query(`
        WITH latest AS (SELECT DISTINCT ON (question_id) question_id, cert_status FROM question_certifications ORDER BY question_id, created_at DESC)
        SELECT COUNT(*)::int c FROM latest WHERE cert_status='certified'`)).rows[0]?.c)
    : 0;

  const total = num(axes.genome_competencies);
  const metrics = {
    levels: perComp.reduce((acc: any, c) => { acc[c.readiness_level] = (acc[c.readiness_level] || 0) + 1; return acc; }, {}),
    certification_available: haveCert,
  };
  const ins = await pool.query(`
    INSERT INTO qf_coverage_snapshots
      (label, total_competencies, draft_competencies, approved_competencies, base_ready_competencies,
       quality_assured_competencies, approved_questions, draft_questions, certified_questions, metrics)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id, captured_at`,
    [
      label ? String(label) : null, total,
      num(axes.draft_coverage?.competencies), num(axes.approved_coverage?.competencies),
      base_ready, quality_assured, num(qCounts.approved_q), num(qCounts.draft_q), certified_questions,
      JSON.stringify(metrics),
    ]);
  return { ok: true, version: READINESS_VERSION, snapshot: ins.rows[0], base_ready, quality_assured };
}

/** Trend series over snapshots. <2 snapshots → insufficient_history (NEVER a fabricated 0-trend). */
export async function getCoverageTrends(pool: Pool, limit = 60) {
  if (!(await snapshotReady(pool))) {
    return { ok: true, version: READINESS_VERSION, schema_initialized: false, series: [], points: 0, trend: 'insufficient_history', note: 'No snapshots captured yet.' };
  }
  const rs = await pool.query(`
    SELECT id, captured_at, label, total_competencies, draft_competencies, approved_competencies,
           base_ready_competencies, quality_assured_competencies, approved_questions, draft_questions, certified_questions
    FROM qf_coverage_snapshots ORDER BY captured_at ASC LIMIT $1`, [Math.min(Math.max(num(limit) || 60, 1), 365)]);
  const series = rs.rows.map((r: any) => ({
    id: String(r.id), captured_at: r.captured_at, label: r.label,
    total_competencies: num(r.total_competencies), draft_competencies: num(r.draft_competencies),
    approved_competencies: num(r.approved_competencies), base_ready_competencies: num(r.base_ready_competencies),
    quality_assured_competencies: num(r.quality_assured_competencies),
    approved_questions: num(r.approved_questions), draft_questions: num(r.draft_questions), certified_questions: num(r.certified_questions),
  }));
  if (series.length < 2) return { ok: true, version: READINESS_VERSION, schema_initialized: true, series, points: series.length, trend: 'insufficient_history', note: 'Need at least two snapshots to compute a trend.' };
  const first = series[0], last = series[series.length - 1];
  const delta = (a: number, b: number) => b - a;
  return {
    ok: true, version: READINESS_VERSION, schema_initialized: true, series, points: series.length, trend: 'available',
    deltas: {
      approved_competencies: delta(first.approved_competencies, last.approved_competencies),
      base_ready_competencies: delta(first.base_ready_competencies, last.base_ready_competencies),
      quality_assured_competencies: delta(first.quality_assured_competencies, last.quality_assured_competencies),
      approved_questions: delta(first.approved_questions, last.approved_questions),
    },
  };
}
