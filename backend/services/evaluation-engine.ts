/**
 * PHASE 5.10 — Interview Intelligence: evaluation_engine (services).
 *
 * evaluation_engine — records OPERATOR/panelist interview SCORES per criterion and
 * composes Interview Evaluation (a deterministic fold of the operator-entered scores).
 *
 *   Interview Scoring    — interview_scores (one row per interview+panelist+criterion).
 *   Interview Evaluation — composeable aggregate: per-criterion mean, overall mean,
 *                          and coverage; labelled operator-recorded.
 *
 * Design contract:
 *   - Additive + flag-gated (`interviewIntelligence`). The net-new table is created by a
 *     lazy ensureScoreSchema() that runs ONLY on a POST/write path. GET reads use a
 *     to_regclass probe and degrade — they NEVER run DDL.
 *   - compose-never-recompute: evaluation summaries AVERAGE operator-entered scores and
 *     label them operator-recorded. They are arithmetic over operator inputs, NOT an
 *     algorithmic hire/reject verdict.
 *   - IDOR-safe: scores are scoped to a VALID interview (readInterview); the interview row
 *     carries the job/candidate that was job-scoped at scheduling time.
 *   - never-throws: typed EngineResult; absent data degrades to honest empty/null (NOT 0).
 */

import type { Pool } from 'pg';
import { readInterview } from './interview-engine';

export const EVALUATION_ENGINE_VERSION = '5.10.0';

export const EVALUATION_DISCLAIMER =
  'Operator-recorded interview scores. Evaluation summaries average the scores panelists ' +
  'entered (per-criterion and overall, with coverage) — they are arithmetic over operator ' +
  'inputs and are NOT an algorithmic hire/reject verdict.';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input' | 'conflict', message: string): EngineResult =>
  ({ ok: false, code, message });

// ── infra helpers ───────────────────────────────────────────────────────────
async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ── lazy ensure-schema (WRITE PATH ONLY) ────────────────────────────────────
let schemaReady = false;
export async function ensureScoreSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_scores (
      id            BIGSERIAL PRIMARY KEY,
      interview_id  BIGINT NOT NULL,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      candidate_id  TEXT NOT NULL,
      panelist      TEXT NOT NULL,
      criterion     TEXT NOT NULL,
      score         NUMERIC NOT NULL,
      max_score     NUMERIC NOT NULL DEFAULT 5,
      comments      TEXT,
      scored_by     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (interview_id, panelist, criterion)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_scores_iv   ON interview_scores (interview_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_scores_cand ON interview_scores (job_id, candidate_id);`);
  schemaReady = true;
}

function shapeScore(row: any) {
  return {
    id: String(row.id),
    interview_id: String(row.interview_id),
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    panelist: row.panelist,
    criterion: row.criterion,
    score: row.score != null ? Number(row.score) : null,
    max_score: row.max_score != null ? Number(row.max_score) : null,
    comments: row.comments ?? null,
    scored_by: row.scored_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Interview Scoring (WRITE — upsert per interview+panelist+criterion) ──────
export async function recordScore(
  pool: Pool,
  input: {
    interviewId: string; panelist: string; criterion: string;
    score: number | string; maxScore?: number | string | null;
    comments?: string | null; actor?: string | null;
  },
): Promise<EngineResult> {
  const interviewId = String(input?.interviewId ?? '').trim();
  const panelist = String(input?.panelist ?? '').trim();
  const criterion = String(input?.criterion ?? '').trim();
  if (!interviewId || !panelist || !criterion) {
    return err('invalid_input', 'interviewId, panelist and criterion are required');
  }
  const score = Number(input?.score);
  if (!Number.isFinite(score)) return err('invalid_input', 'score must be a finite number');
  const maxScore = input.maxScore != null && String(input.maxScore).trim() !== '' ? Number(input.maxScore) : 5;
  if (!Number.isFinite(maxScore) || maxScore <= 0) return err('invalid_input', 'maxScore must be a positive number');
  if (score < 0 || score > maxScore) return err('invalid_input', `score must be within [0, ${maxScore}]`);

  // Scope to a VALID interview (carries job/candidate job-scoped at scheduling time).
  const iv = await readInterview(pool, interviewId);
  if (!iv) return err('not_found', `interview ${interviewId} not found`);

  try {
    await ensureScoreSchema(pool);
  } catch (e: any) {
    return err('invalid_input', `could not ensure schema: ${e?.message ?? 'error'}`);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO interview_scores
         (interview_id, employer_id, job_id, candidate_id, panelist, criterion, score, max_score, comments, scored_by)
       VALUES ($1::bigint,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (interview_id, panelist, criterion) DO UPDATE SET
         score      = EXCLUDED.score,
         max_score  = EXCLUDED.max_score,
         comments   = EXCLUDED.comments,
         scored_by  = EXCLUDED.scored_by,
         updated_at = now()
       RETURNING *`,
      [
        iv.id, iv.employer_id ?? null, iv.job_id, iv.candidate_id, panelist, criterion,
        score, maxScore,
        input.comments != null ? String(input.comments) : null,
        input.actor != null ? String(input.actor) : null,
      ],
    );
    return ok({ ...shapeScore(rows[0]), disclaimer: EVALUATION_DISCLAIMER });
  } catch (e: any) {
    return err('invalid_input', `could not record score: ${e?.message ?? 'error'}`);
  }
}

// ── reads (GET, degrade) ────────────────────────────────────────────────────
export async function getScores(pool: Pool, interviewId: string): Promise<EngineResult> {
  const iv = String(interviewId ?? '').trim();
  if (!(await relExists(pool, 'interview_scores'))) {
    return ok({ interview_id: iv, count: 0, scores: [], disclaimer: EVALUATION_DISCLAIMER });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interview_scores WHERE interview_id = $1::bigint ORDER BY criterion ASC, panelist ASC, id ASC`, [iv],
    );
    return ok({ interview_id: iv, count: rows.length, scores: rows.map(shapeScore), disclaimer: EVALUATION_DISCLAIMER });
  } catch {
    return ok({ interview_id: iv, count: 0, scores: [], disclaimer: EVALUATION_DISCLAIMER });
  }
}

interface ScoreAgg { sumPct: number; n: number; panelists: Set<string>; }

// Fold a set of score rows into per-criterion means + an overall normalized mean.
function foldScores(rows: any[]) {
  const byCriterion = new Map<string, ScoreAgg>();
  const panelists = new Set<string>();
  let overallSumPct = 0;
  let overallN = 0;
  for (const r of rows) {
    const score = Number(r.score);
    const max = Number(r.max_score);
    if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) continue;
    const pct = (score / max) * 100;
    const crit = String(r.criterion);
    if (!byCriterion.has(crit)) byCriterion.set(crit, { sumPct: 0, n: 0, panelists: new Set() });
    const agg = byCriterion.get(crit)!;
    agg.sumPct += pct;
    agg.n += 1;
    if (r.panelist != null) agg.panelists.add(String(r.panelist));
    if (r.panelist != null) panelists.add(String(r.panelist));
    overallSumPct += pct;
    overallN += 1;
  }
  const criteria = Array.from(byCriterion.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([criterion, agg]) => ({
      criterion,
      score_count: agg.n,
      panelists: agg.panelists.size,
      mean_pct: agg.n > 0 ? round1(agg.sumPct / agg.n) : null,
    }));
  return {
    criteria,
    distinct_panelists: panelists.size,
    overall_mean_pct: overallN > 0 ? round1(overallSumPct / overallN) : null,
    total_scores: overallN,
  };
}

// ── Interview Evaluation (GET — compose operator scores, no verdict) ─────────
export async function evaluationSummary(pool: Pool, interviewId: string): Promise<EngineResult> {
  const iv = String(interviewId ?? '').trim();
  const interview = await readInterview(pool, iv);

  if (!(await relExists(pool, 'interview_scores'))) {
    return ok({
      interview_id: iv, interview_found: !!interview, total_scores: 0,
      distinct_panelists: 0, overall_mean_pct: null, criteria: [],
      provenance: 'operator_recorded', disclaimer: EVALUATION_DISCLAIMER,
    });
  }
  try {
    const { rows } = await pool.query(`SELECT * FROM interview_scores WHERE interview_id = $1::bigint`, [iv]);
    const folded = foldScores(rows);
    return ok({
      interview_id: iv,
      interview_found: !!interview,
      ...folded,
      provenance: 'operator_recorded',
      disclaimer: EVALUATION_DISCLAIMER,
    });
  } catch {
    return ok({
      interview_id: iv, interview_found: !!interview, total_scores: 0,
      distinct_panelists: 0, overall_mean_pct: null, criteria: [],
      provenance: 'operator_recorded', disclaimer: EVALUATION_DISCLAIMER,
    });
  }
}

// candidateEvaluation — composes ALL of a candidate's interview scores (across rounds)
// for a job into one operator-recorded evaluation. Coverage = interviews that have scores.
export async function candidateEvaluation(pool: Pool, jobId: string, candidateId: string): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  const cand = String(candidateId ?? '').trim();

  if (!(await relExists(pool, 'interview_scores'))) {
    return ok({
      job_id: job, candidate_id: cand, total_scores: 0, distinct_panelists: 0,
      overall_mean_pct: null, criteria: [], interviews_scored: 0,
      provenance: 'operator_recorded', disclaimer: EVALUATION_DISCLAIMER,
    });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interview_scores WHERE job_id = $1 AND candidate_id = $2`, [job, cand],
    );
    const folded = foldScores(rows);
    const interviewsScored = new Set(rows.map((r) => String(r.interview_id))).size;
    return ok({
      job_id: job,
      candidate_id: cand,
      interviews_scored: interviewsScored,
      ...folded,
      provenance: 'operator_recorded',
      disclaimer: EVALUATION_DISCLAIMER,
    });
  } catch {
    return ok({
      job_id: job, candidate_id: cand, total_scores: 0, distinct_panelists: 0,
      overall_mean_pct: null, criteria: [], interviews_scored: 0,
      provenance: 'operator_recorded', disclaimer: EVALUATION_DISCLAIMER,
    });
  }
}
