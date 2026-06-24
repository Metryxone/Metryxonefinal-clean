/**
 * PHASE 5.9 — Shortlisting Engine (services).
 *
 * shortlisting_engine — manages an OPERATOR-DRIVEN candidate hiring pipeline over
 * employer_candidates for a single job. It records the human hiring-workflow
 * decisions an operator takes and tracks every transition; it governs those
 * decisions with a workflow state-machine (the workflow_engine).
 *
 *   Statuses (operator actions): review · shortlist · hold · interview · offer ·
 *                                hire · reject.
 *   Status Management  — current status per candidate (candidate_pipeline).
 *   Workflow Tracking  — append-only transition history (workflow_transitions).
 *   workflow_engine    — the finite state-machine: funnel stage ordering, valid
 *                        entry statuses, and valid transitions between statuses.
 *
 * Design contract (mirrors the program):
 *   - Additive + flag-gated (`shortlisting`). The two net-new tables are created
 *     by a lazy ensurePipelineSchema() that runs ONLY on a POST/write path. GET
 *     reads use a to_regclass probe and degrade — they NEVER run DDL.
 *   - compose-never-recompute: the engine reads the existing candidate/job
 *     substrate and RECORDS operator decisions. It does NOT compute, predict, or
 *     recommend who to shortlist/reject — there is no algorithmic verdict here.
 *   - GET-never-writes: every read op uses relExists + degrades to empty/zeroed.
 *   - super-admin gated + IDOR-safe: a candidate is only actionable within its own
 *     job (candidateInJob, STRICT equality); cross-job / unbound candidates are
 *     refused, never silently mixed.
 *   - never-throws: every op returns a typed EngineResult; absent data degrades to
 *     honest empty/zeroed, never fabricated. Statuses are operator-recorded GROUND
 *     TRUTH (provenance), not predictions — Coverage (pipeline penetration) is the
 *     reported axis. Invalid transitions are rejected, never coerced.
 */

import type { Pool, PoolClient } from 'pg';
import { resolveJob } from './job-store-resolver.js';

export const SHORTLISTING_ENGINE_VERSION = '5.9.0';

const OPERATOR_DISCLAIMER =
  'Operator-recorded hiring-workflow status. The engine records and tracks human ' +
  'pipeline decisions and enforces valid workflow transitions — it does NOT ' +
  'generate any algorithmic shortlisting, ranking, or suitability verdict.';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input' | 'conflict', message: string): EngineResult =>
  ({ ok: false, code, message });

// ── workflow_engine: the finite state-machine ───────────────────────────────
export type PipelineStatus =
  | 'review' | 'shortlist' | 'hold' | 'interview' | 'offer' | 'hire' | 'reject';

export const PIPELINE_STATUSES: PipelineStatus[] =
  ['review', 'shortlist', 'hold', 'interview', 'offer', 'hire', 'reject'];

// Forward-funnel ordering; side states (hold/reject) are off-funnel → null.
const STAGE_ORDER: Record<PipelineStatus, number | null> = {
  review: 1, shortlist: 2, interview: 3, offer: 4, hire: 5, hold: null, reject: null,
};

// Statuses allowed as the FIRST action when a candidate is not yet in the pipeline.
// A candidate cannot be interviewed/offered/hired without first progressing.
const ENTRY_STATUSES: PipelineStatus[] = ['review', 'shortlist', 'hold', 'reject'];

// Valid transitions out of each status.
const TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  review:    ['shortlist', 'interview', 'hold', 'reject'],
  shortlist: ['interview', 'hold', 'reject', 'review'],
  hold:      ['review', 'shortlist', 'interview', 'reject'],
  interview: ['offer', 'hold', 'reject', 'shortlist'],
  offer:     ['hire', 'hold', 'reject', 'interview'],
  hire:      ['reject'],
  reject:    ['review'],
};

export function isValidStatus(s: unknown): s is PipelineStatus {
  return typeof s === 'string' && (PIPELINE_STATUSES as string[]).includes(s);
}

export function stageOrder(s: PipelineStatus): number | null {
  return STAGE_ORDER[s] ?? null;
}

/** Pure FSM check: may a candidate move from `from` (null = not yet in pipeline) to `to`? */
export function canTransition(from: PipelineStatus | null, to: PipelineStatus): boolean {
  if (!isValidStatus(to)) return false;
  if (from == null) return ENTRY_STATUSES.includes(to);
  if (from === to) return false; // same-status set is a no-op conflict, not a transition
  return TRANSITIONS[from].includes(to);
}

export function getWorkflowDefinition() {
  return {
    statuses: PIPELINE_STATUSES.map((s) => ({
      status: s,
      stage_order: STAGE_ORDER[s],
      is_entry: ENTRY_STATUSES.includes(s),
      is_terminal: TRANSITIONS[s].length === 0,
      allowed_next: TRANSITIONS[s],
    })),
    entry_statuses: ENTRY_STATUSES,
    funnel_order: PIPELINE_STATUSES.filter((s) => STAGE_ORDER[s] != null)
      .sort((a, b) => (STAGE_ORDER[a]! - STAGE_ORDER[b]!)),
    disclaimer: OPERATOR_DISCLAIMER,
  };
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

// ── lazy ensure-schema (WRITE PATH ONLY — never reached from a GET) ──────────
let schemaReady = false;
export async function ensurePipelineSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidate_pipeline (
      id            BIGSERIAL PRIMARY KEY,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      candidate_id  TEXT NOT NULL,
      status        TEXT NOT NULL,
      stage_order   INT,
      note          TEXT,
      updated_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (job_id, candidate_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_job    ON candidate_pipeline (job_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_status ON candidate_pipeline (job_id, status);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_transitions (
      id            BIGSERIAL PRIMARY KEY,
      pipeline_id   BIGINT,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      candidate_id  TEXT NOT NULL,
      from_status   TEXT,
      to_status     TEXT NOT NULL,
      note          TEXT,
      actor         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_transitions_job  ON workflow_transitions (job_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_transitions_cand ON workflow_transitions (job_id, candidate_id);`);
  schemaReady = true;
}

// ── substrate reads (read-only, never-throws) ───────────────────────────────
interface JobRow { id: string; employer_id: string | null; title: string | null; status: string | null; }
interface CandidateRow { id: string; employer_id: string | null; job_id: string | null; name: string | null; email: string | null; }

// Resolve a job from EITHER store (employer_jobs first, then job_postings) so a
// job posted via the job-posting engine is visible to shortlisting. See
// job-store-resolver.ts for the split-store rationale.
async function readJob(pool: Pool, id: string): Promise<JobRow | null> {
  return resolveJob(pool, id);
}

async function readCandidate(pool: Pool, id: string): Promise<CandidateRow | null> {
  if (!(await relExists(pool, 'employer_candidates'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id, employer_id, job_id, name, email FROM employer_candidates WHERE id = $1`, [id],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// IDOR/job-scoping: a candidate is actionable for a job ONLY when its job_id
// strictly matches. Cross-job OR unbound (null job_id) candidates are NEVER
// actionable — the contract requires the candidate to belong to the job.
function candidateInJob(c: CandidateRow, jobId: string): boolean {
  return c.job_id != null && String(c.job_id) === String(jobId);
}

// ── current-entry read (GET, degrade) ───────────────────────────────────────
async function readPipelineRow(pool: Pool, jobId: string, candidateId: string): Promise<any | null> {
  if (!(await relExists(pool, 'candidate_pipeline'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM candidate_pipeline WHERE job_id = $1 AND candidate_id = $2`,
      [String(jobId).trim(), String(candidateId).trim()],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function shapeEntry(row: any) {
  return {
    id: String(row.id),
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    employer_id: row.employer_id ?? null,
    status: row.status as PipelineStatus,
    stage_order: row.stage_order ?? null,
    note: row.note ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Status Management: set status (WRITE) ───────────────────────────────────
export async function setPipelineStatus(
  pool: Pool,
  input: { jobId: string; candidateId: string; status: string; note?: string | null; actor?: string | null },
): Promise<EngineResult> {
  const jobId = String(input?.jobId ?? '').trim();
  const candidateId = String(input?.candidateId ?? '').trim();
  if (!jobId || !candidateId) return err('invalid_input', 'jobId and candidateId are required');
  if (!isValidStatus(input?.status)) {
    return err('invalid_input', `unknown status "${input?.status}" — valid: ${PIPELINE_STATUSES.join(', ')}`);
  }
  const to = input.status as PipelineStatus;

  const job = await readJob(pool, jobId);
  if (!job) return err('not_found', `job ${jobId} not found`);
  const cand = await readCandidate(pool, candidateId);
  if (!cand) return err('not_found', `candidate ${candidateId} not found`);
  if (!candidateInJob(cand, jobId)) {
    return err('invalid_input', `candidate ${candidateId} does not belong to job ${jobId}`);
  }

  // DDL outside the transaction (idempotent CREATE TABLE IF NOT EXISTS).
  try {
    await ensurePipelineSchema(pool);
  } catch (e: any) {
    return err('invalid_input', `could not ensure schema: ${e?.message ?? 'error'}`);
  }

  const note = input.note != null ? String(input.note) : null;
  const actor = input.actor != null ? String(input.actor) : null;
  const order = stageOrder(to);
  const employerId = cand.employer_id ?? job.employer_id ?? null;

  // Atomic state-change + history append. The existing row is locked FOR UPDATE so
  // concurrent transitions serialize (no two valid moves from the same prior status);
  // for a brand-new entry the UNIQUE(job_id,candidate_id) constraint blocks a racing
  // double-insert (caught -> conflict). Status update and history insert COMMIT/ROLLBACK
  // together so the pipeline can never mutate without its matching transition row.
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (e: any) {
    return err('invalid_input', `could not acquire connection: ${e?.message ?? 'error'}`);
  }
  try {
    await client.query('BEGIN');

    const lock = await client.query(
      `SELECT * FROM candidate_pipeline WHERE job_id = $1 AND candidate_id = $2 FOR UPDATE`,
      [jobId, candidateId],
    );
    const existing = lock.rows[0] ?? null;
    const from: PipelineStatus | null = existing ? (existing.status as PipelineStatus) : null;

    if (from === to) {
      await client.query('ROLLBACK');
      return err('conflict', `candidate ${candidateId} is already in status "${to}"`);
    }
    if (!canTransition(from, to)) {
      await client.query('ROLLBACK');
      const allowed = from == null ? ENTRY_STATUSES : TRANSITIONS[from];
      return err('conflict', `invalid transition ${from ?? '(new)'} → ${to}; allowed: ${allowed.join(', ')}`);
    }

    let entryRow: any;
    if (existing) {
      const { rows } = await client.query(
        `UPDATE candidate_pipeline
            SET status = $3, stage_order = $4, note = $5, updated_by = $6, updated_at = now()
          WHERE job_id = $1 AND candidate_id = $2
        RETURNING *`,
        [jobId, candidateId, to, order, note, actor],
      );
      entryRow = rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO candidate_pipeline (employer_id, job_id, candidate_id, status, stage_order, note, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (job_id, candidate_id) DO NOTHING
         RETURNING *`,
        [employerId, jobId, candidateId, to, order, note, actor],
      );
      if (ins.rows.length === 0) {
        // A concurrent request inserted the entry first.
        await client.query('ROLLBACK');
        return err('conflict', `candidate ${candidateId} entered the pipeline concurrently; retry`);
      }
      entryRow = ins.rows[0];
    }

    await client.query(
      `INSERT INTO workflow_transitions (pipeline_id, employer_id, job_id, candidate_id, from_status, to_status, note, actor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [entryRow.id, employerId, jobId, candidateId, from, to, note, actor],
    );

    await client.query('COMMIT');
    return ok({
      ...shapeEntry(entryRow),
      previous_status: from,
      transitioned: true,
      disclaimer: OPERATOR_DISCLAIMER,
    });
  } catch (e: any) {
    try { await client.query('ROLLBACK'); } catch { /* already aborted */ }
    return err('invalid_input', `could not set status: ${e?.message ?? 'error'}`);
  } finally {
    client.release();
  }
}

// ── reads (GET, degrade — never run DDL) ────────────────────────────────────
export async function getPipelineEntry(pool: Pool, jobId: string, candidateId: string): Promise<EngineResult> {
  const row = await readPipelineRow(pool, jobId, candidateId);
  if (!row) return err('not_found', `candidate ${candidateId} is not in the pipeline for job ${jobId}`);
  return ok({ ...shapeEntry(row), disclaimer: OPERATOR_DISCLAIMER });
}

export async function listPipeline(
  pool: Pool,
  jobId: string,
  opts?: { status?: string | null },
): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  if (!(await relExists(pool, 'candidate_pipeline'))) {
    return ok({ job_id: job, count: 0, candidates: [], disclaimer: OPERATOR_DISCLAIMER });
  }
  const status = opts?.status && isValidStatus(opts.status) ? opts.status : null;
  try {
    const params: any[] = [job];
    let sql = `SELECT * FROM candidate_pipeline WHERE job_id = $1`;
    if (status) { sql += ` AND status = $2`; params.push(status); }
    sql += ` ORDER BY stage_order NULLS LAST, updated_at DESC`;
    const { rows } = await pool.query(sql, params);
    return ok({
      job_id: job,
      count: rows.length,
      status_filter: status,
      candidates: rows.map(shapeEntry),
      disclaimer: OPERATOR_DISCLAIMER,
    });
  } catch {
    return ok({ job_id: job, count: 0, candidates: [], disclaimer: OPERATOR_DISCLAIMER });
  }
}

export async function getPipelineHistory(pool: Pool, jobId: string, candidateId: string): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  const cand = String(candidateId ?? '').trim();
  if (!(await relExists(pool, 'workflow_transitions'))) {
    return ok({ job_id: job, candidate_id: cand, count: 0, transitions: [], disclaimer: OPERATOR_DISCLAIMER });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, pipeline_id, from_status, to_status, note, actor, created_at
         FROM workflow_transitions
        WHERE job_id = $1 AND candidate_id = $2
        ORDER BY created_at ASC, id ASC`,
      [job, cand],
    );
    return ok({
      job_id: job,
      candidate_id: cand,
      count: rows.length,
      transitions: rows.map((r) => ({
        id: String(r.id),
        from_status: r.from_status ?? null,
        to_status: r.to_status,
        note: r.note ?? null,
        actor: r.actor ?? null,
        created_at: r.created_at,
      })),
      disclaimer: OPERATOR_DISCLAIMER,
    });
  } catch {
    return ok({ job_id: job, candidate_id: cand, count: 0, transitions: [], disclaimer: OPERATOR_DISCLAIMER });
  }
}

export async function pipelineSummary(pool: Pool, jobId: string): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  // Total candidates for the job (Coverage denominator) — read-only, degrade.
  let totalCandidates: number | null = null;
  if (await relExists(pool, 'employer_candidates')) {
    try {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM employer_candidates WHERE job_id = $1`, [job],
      );
      totalCandidates = Number(rows[0]?.n ?? 0);
    } catch { totalCandidates = null; }
  }

  const byStatus: Record<string, number> = {};
  PIPELINE_STATUSES.forEach((s) => { byStatus[s] = 0; });
  let inPipeline = 0;
  if (await relExists(pool, 'candidate_pipeline')) {
    try {
      const { rows } = await pool.query(
        `SELECT status, count(*)::int AS n FROM candidate_pipeline WHERE job_id = $1 GROUP BY status`, [job],
      );
      for (const r of rows) {
        const n = Number(r.n ?? 0);
        if (isValidStatus(r.status)) byStatus[r.status] = n;
        inPipeline += n;
      }
    } catch { /* degrade to zeros */ }
  }

  // Coverage = pipeline penetration of the job's candidate pool. null denom → unmeasured.
  const coveragePct = totalCandidates && totalCandidates > 0
    ? Math.round((inPipeline / totalCandidates) * 1000) / 10
    : (totalCandidates === 0 ? 0 : null);

  const funnel = getWorkflowDefinition().funnel_order.map((s) => ({
    status: s, stage_order: stageOrder(s), count: byStatus[s] ?? 0,
  }));

  return ok({
    job_id: job,
    total_candidates: totalCandidates,
    in_pipeline: inPipeline,
    coverage_pct: coveragePct,
    by_status: byStatus,
    funnel,
    provenance: 'operator_recorded',
    disclaimer: OPERATOR_DISCLAIMER,
  });
}
