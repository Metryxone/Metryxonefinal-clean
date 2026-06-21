/**
 * PHASE 5.10 — Interview Intelligence: interview_feedback_engine (services).
 *
 * interview_feedback_engine — records OPERATOR/panelist feedback for an interview and
 * composes Panel Reviews (a deterministic fold of the operator-entered feedback).
 *
 *   Interview Feedback — interview_feedback (one row per interview+panelist, upsert).
 *   Panel Reviews      — composeable aggregate: recommendation distribution, coverage,
 *                        and the MODAL recommendation labelled operator-recorded.
 *
 * Design contract:
 *   - Additive + flag-gated (`interviewIntelligence`). The net-new table is created by a
 *     lazy ensureFeedbackSchema() that runs ONLY on a POST/write path. GET reads use a
 *     to_regclass probe and degrade — they NEVER run DDL.
 *   - compose-never-recompute: panelReview folds operator inputs (counts/coverage/modal)
 *     and labels them operator-recorded. The modal recommendation DESCRIBES what the panel
 *     entered; it is NOT an algorithmic hire/reject verdict.
 *   - IDOR-safe: feedback is scoped to a VALID interview (readInterview); the interview row
 *     carries the job/candidate that was job-scoped at scheduling time.
 *   - never-throws: typed EngineResult; absent data degrades to honest empty/zeroed.
 */

import type { Pool } from 'pg';
import { readInterview } from './interview-engine';

export const INTERVIEW_FEEDBACK_ENGINE_VERSION = '5.10.0';

export const FEEDBACK_DISCLAIMER =
  'Operator-recorded interview feedback. Panel reviews aggregate the feedback panelists ' +
  'entered (counts, coverage, and the modal recommendation) — they DESCRIBE operator ' +
  'inputs and are NOT an algorithmic hire/reject verdict.';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input' | 'conflict', message: string): EngineResult =>
  ({ ok: false, code, message });

// ── recommendation vocabulary ───────────────────────────────────────────────
export type Recommendation = 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no';
export const RECOMMENDATIONS: Recommendation[] = ['strong_yes', 'yes', 'neutral', 'no', 'strong_no'];

export function isValidRecommendation(r: unknown): r is Recommendation {
  return typeof r === 'string' && (RECOMMENDATIONS as string[]).includes(r);
}

// ── infra helpers ───────────────────────────────────────────────────────────
async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

// ── lazy ensure-schema (WRITE PATH ONLY) ────────────────────────────────────
let schemaReady = false;
export async function ensureFeedbackSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_feedback (
      id             BIGSERIAL PRIMARY KEY,
      interview_id   BIGINT NOT NULL,
      employer_id    TEXT,
      job_id         TEXT NOT NULL,
      candidate_id   TEXT NOT NULL,
      panelist       TEXT NOT NULL,
      recommendation TEXT,
      strengths      TEXT,
      concerns       TEXT,
      comments       TEXT,
      submitted_by   TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (interview_id, panelist)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_feedback_iv   ON interview_feedback (interview_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_feedback_cand ON interview_feedback (job_id, candidate_id);`);
  schemaReady = true;
}

function shapeFeedback(row: any) {
  return {
    id: String(row.id),
    interview_id: String(row.interview_id),
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    panelist: row.panelist,
    recommendation: row.recommendation ?? null,
    strengths: row.strengths ?? null,
    concerns: row.concerns ?? null,
    comments: row.comments ?? null,
    submitted_by: row.submitted_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Interview Feedback (WRITE — upsert per interview+panelist) ───────────────
export async function submitFeedback(
  pool: Pool,
  input: {
    interviewId: string; panelist: string; recommendation?: string | null;
    strengths?: string | null; concerns?: string | null; comments?: string | null;
    actor?: string | null;
  },
): Promise<EngineResult> {
  const interviewId = String(input?.interviewId ?? '').trim();
  const panelist = String(input?.panelist ?? '').trim();
  if (!interviewId || !panelist) return err('invalid_input', 'interviewId and panelist are required');
  if (input.recommendation != null && !isValidRecommendation(input.recommendation)) {
    return err('invalid_input', `unknown recommendation "${input.recommendation}" — valid: ${RECOMMENDATIONS.join(', ')}`);
  }

  // Scope to a VALID interview (carries job/candidate job-scoped at scheduling time).
  const iv = await readInterview(pool, interviewId);
  if (!iv) return err('not_found', `interview ${interviewId} not found`);

  try {
    await ensureFeedbackSchema(pool);
  } catch (e: any) {
    return err('invalid_input', `could not ensure schema: ${e?.message ?? 'error'}`);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO interview_feedback
         (interview_id, employer_id, job_id, candidate_id, panelist, recommendation,
          strengths, concerns, comments, submitted_by)
       VALUES ($1::bigint,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (interview_id, panelist) DO UPDATE SET
         recommendation = EXCLUDED.recommendation,
         strengths      = EXCLUDED.strengths,
         concerns       = EXCLUDED.concerns,
         comments       = EXCLUDED.comments,
         submitted_by   = EXCLUDED.submitted_by,
         updated_at     = now()
       RETURNING *`,
      [
        iv.id, iv.employer_id ?? null, iv.job_id, iv.candidate_id, panelist,
        input.recommendation ?? null,
        input.strengths != null ? String(input.strengths) : null,
        input.concerns != null ? String(input.concerns) : null,
        input.comments != null ? String(input.comments) : null,
        input.actor != null ? String(input.actor) : null,
      ],
    );
    return ok({ ...shapeFeedback(rows[0]), disclaimer: FEEDBACK_DISCLAIMER });
  } catch (e: any) {
    return err('invalid_input', `could not submit feedback: ${e?.message ?? 'error'}`);
  }
}

// ── reads (GET, degrade) ────────────────────────────────────────────────────
export async function getInterviewFeedback(pool: Pool, interviewId: string): Promise<EngineResult> {
  const iv = String(interviewId ?? '').trim();
  if (!(await relExists(pool, 'interview_feedback'))) {
    return ok({ interview_id: iv, count: 0, feedback: [], disclaimer: FEEDBACK_DISCLAIMER });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interview_feedback WHERE interview_id = $1::bigint ORDER BY created_at ASC, id ASC`, [iv],
    );
    return ok({ interview_id: iv, count: rows.length, feedback: rows.map(shapeFeedback), disclaimer: FEEDBACK_DISCLAIMER });
  } catch {
    return ok({ interview_id: iv, count: 0, feedback: [], disclaimer: FEEDBACK_DISCLAIMER });
  }
}

export async function getCandidateFeedback(pool: Pool, jobId: string, candidateId: string): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  const cand = String(candidateId ?? '').trim();
  if (!(await relExists(pool, 'interview_feedback'))) {
    return ok({ job_id: job, candidate_id: cand, count: 0, feedback: [], disclaimer: FEEDBACK_DISCLAIMER });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interview_feedback WHERE job_id = $1 AND candidate_id = $2 ORDER BY created_at ASC, id ASC`,
      [job, cand],
    );
    return ok({ job_id: job, candidate_id: cand, count: rows.length, feedback: rows.map(shapeFeedback), disclaimer: FEEDBACK_DISCLAIMER });
  } catch {
    return ok({ job_id: job, candidate_id: cand, count: 0, feedback: [], disclaimer: FEEDBACK_DISCLAIMER });
  }
}

// ── Panel Reviews (GET — compose operator inputs, no verdict) ────────────────
export async function panelReview(pool: Pool, interviewId: string): Promise<EngineResult> {
  const iv = String(interviewId ?? '').trim();

  // Panel size (Coverage denominator) from the interview's recorded panelists, if any.
  let panelSize: number | null = null;
  const interview = await readInterview(pool, iv);
  if (interview) panelSize = Array.isArray(interview.panelists) ? interview.panelists.length : 0;

  const distribution: Record<string, number> = {};
  RECOMMENDATIONS.forEach((r) => { distribution[r] = 0; });
  let submitted = 0;
  let withRecommendation = 0;

  if (await relExists(pool, 'interview_feedback')) {
    try {
      const { rows } = await pool.query(
        `SELECT panelist, recommendation FROM interview_feedback WHERE interview_id = $1::bigint`, [iv],
      );
      submitted = rows.length;
      for (const r of rows) {
        if (isValidRecommendation(r.recommendation)) {
          distribution[r.recommendation] += 1;
          withRecommendation += 1;
        }
      }
    } catch { /* degrade */ }
  }

  // Modal recommendation = the single most-entered value; null on no data or a tie.
  let consensus: Recommendation | null = null;
  if (withRecommendation > 0) {
    let top: Recommendation | null = null;
    let topN = -1;
    let tie = false;
    for (const r of RECOMMENDATIONS) {
      const n = distribution[r];
      if (n > topN) { top = r; topN = n; tie = false; }
      else if (n === topN && n > 0) { tie = true; }
    }
    consensus = tie ? null : top;
  }

  // Coverage = panelists who submitted / recorded panel size. null when panel size unknown.
  const coveragePct = panelSize && panelSize > 0
    ? Math.round((submitted / panelSize) * 1000) / 10
    : (panelSize === 0 ? null : null);

  return ok({
    interview_id: iv,
    interview_found: !!interview,
    panel_size: panelSize,
    submitted,
    coverage_pct: coveragePct,
    recommendations_recorded: withRecommendation,
    distribution,
    modal_recommendation: consensus,
    provenance: 'operator_recorded',
    disclaimer: FEEDBACK_DISCLAIMER,
  });
}
