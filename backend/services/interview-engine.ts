/**
 * PHASE 5.10 — Interview Intelligence: interview_engine (services).
 *
 * interview_engine — manages OPERATOR-DRIVEN interview scheduling and decision
 * tracking for a candidate within a job. It records the interviews an operator
 * schedules, governs their lifecycle with a state-machine, and tracks the hiring
 * decisions an operator records after interviews.
 *
 *   Interview Scheduling — interview_schedules (one row per scheduled interview).
 *   Interview lifecycle  — FSM: scheduled -> completed/cancelled/no_show/rescheduled.
 *   Decision Tracking    — interview_decisions (append-only operator decision log).
 *
 * Design contract (mirrors the program):
 *   - Additive + flag-gated (`interviewIntelligence`). Net-new tables are created by a
 *     lazy ensureInterviewSchema() that runs ONLY on a POST/write path. GET reads use a
 *     to_regclass probe and degrade — they NEVER run DDL.
 *   - compose-never-recompute: the engine RECORDS operator decisions/scheduling. It does
 *     NOT compute, predict, or recommend a hire/reject verdict.
 *   - super-admin gated + IDOR-safe: a candidate is only actionable within its own job
 *     (candidateInJob, STRICT equality); cross-job / unbound candidates are refused.
 *   - never-throws: every op returns a typed EngineResult; absent data degrades to honest
 *     empty/zeroed, never fabricated. Operator inputs are GROUND TRUTH (provenance), not
 *     predictions — Coverage is the reported axis.
 */

import type { Pool, PoolClient } from 'pg';

export const INTERVIEW_ENGINE_VERSION = '5.10.0';

export const INTERVIEW_DISCLAIMER =
  'Operator-recorded interview scheduling and hiring decisions. The engine records and ' +
  'tracks human interview-workflow actions and enforces valid lifecycle transitions — it ' +
  'does NOT generate any algorithmic interview, scoring, or suitability verdict.';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input' | 'conflict', message: string): EngineResult =>
  ({ ok: false, code, message });

// ── vocabularies + interview lifecycle FSM ──────────────────────────────────
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
export const INTERVIEW_STATUSES: InterviewStatus[] =
  ['scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled'];

// Lifecycle transitions; completed/cancelled are terminal.
const INTERVIEW_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  scheduled:   ['completed', 'cancelled', 'no_show', 'rescheduled'],
  rescheduled: ['scheduled', 'completed', 'cancelled', 'no_show'],
  no_show:     ['rescheduled'],
  completed:   [],
  cancelled:   [],
};

export type InterviewMode = 'onsite' | 'remote' | 'phone';
export const INTERVIEW_MODES: InterviewMode[] = ['onsite', 'remote', 'phone'];

export type DecisionType = 'advance' | 'hold' | 'reject' | 'hire';
export const DECISION_TYPES: DecisionType[] = ['advance', 'hold', 'reject', 'hire'];

export function isValidInterviewStatus(s: unknown): s is InterviewStatus {
  return typeof s === 'string' && (INTERVIEW_STATUSES as string[]).includes(s);
}
export function isValidMode(m: unknown): m is InterviewMode {
  return typeof m === 'string' && (INTERVIEW_MODES as string[]).includes(m);
}
export function isValidDecision(d: unknown): d is DecisionType {
  return typeof d === 'string' && (DECISION_TYPES as string[]).includes(d);
}

/** Pure FSM check for an interview lifecycle transition. */
export function canTransitionInterview(from: InterviewStatus, to: InterviewStatus): boolean {
  if (!isValidInterviewStatus(from) || !isValidInterviewStatus(to)) return false;
  if (from === to) return false; // same-status is a no-op conflict, not a transition
  return INTERVIEW_TRANSITIONS[from].includes(to);
}

export function getInterviewWorkflow() {
  return {
    statuses: INTERVIEW_STATUSES.map((s) => ({
      status: s,
      is_terminal: INTERVIEW_TRANSITIONS[s].length === 0,
      allowed_next: INTERVIEW_TRANSITIONS[s],
    })),
    entry_status: 'scheduled',
    modes: INTERVIEW_MODES,
    decision_types: DECISION_TYPES,
    disclaimer: INTERVIEW_DISCLAIMER,
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
export async function ensureInterviewSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_schedules (
      id            BIGSERIAL PRIMARY KEY,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      candidate_id  TEXT NOT NULL,
      round_name    TEXT,
      round_seq     INT,
      mode          TEXT,
      scheduled_at  TIMESTAMPTZ,
      duration_mins INT,
      location      TEXT,
      panelists     JSONB NOT NULL DEFAULT '[]'::jsonb,
      status        TEXT NOT NULL DEFAULT 'scheduled',
      note          TEXT,
      created_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_schedules_job  ON interview_schedules (job_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_schedules_cand ON interview_schedules (job_id, candidate_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_schedules_stat ON interview_schedules (job_id, status);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_decisions (
      id            BIGSERIAL PRIMARY KEY,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      candidate_id  TEXT NOT NULL,
      interview_id  BIGINT,
      decision      TEXT NOT NULL,
      stage         TEXT,
      rationale     TEXT,
      decided_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_interview_decisions_cand ON interview_decisions (job_id, candidate_id);`);
  schemaReady = true;
}

// ── substrate reads (read-only, never-throws) ───────────────────────────────
interface JobRow { id: string; employer_id: string | null; title: string | null; status: string | null; }
interface CandidateRow { id: string; employer_id: string | null; job_id: string | null; name: string | null; email: string | null; }

async function readJob(pool: Pool, id: string): Promise<JobRow | null> {
  if (!(await relExists(pool, 'employer_jobs'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id, employer_id, title, status FROM employer_jobs WHERE id = $1`, [id],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
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

// IDOR/job-scoping: a candidate is actionable for a job ONLY when its job_id strictly
// matches. Cross-job OR unbound (null job_id) candidates are NEVER actionable.
function candidateInJob(c: CandidateRow, jobId: string): boolean {
  return c.job_id != null && String(c.job_id) === String(jobId);
}

// ── interview row read (exported for sibling engines; read-only, degrade) ────
export interface InterviewRow {
  id: string;
  employer_id: string | null;
  job_id: string;
  candidate_id: string;
  round_name: string | null;
  round_seq: number | null;
  mode: string | null;
  scheduled_at: any;
  duration_mins: number | null;
  location: string | null;
  panelists: any[];
  status: InterviewStatus;
  note: string | null;
  created_by: string | null;
  created_at: any;
  updated_at: any;
}

function shapeInterview(row: any): InterviewRow {
  return {
    id: String(row.id),
    employer_id: row.employer_id ?? null,
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    round_name: row.round_name ?? null,
    round_seq: row.round_seq ?? null,
    mode: row.mode ?? null,
    scheduled_at: row.scheduled_at ?? null,
    duration_mins: row.duration_mins ?? null,
    location: row.location ?? null,
    panelists: Array.isArray(row.panelists) ? row.panelists : [],
    status: row.status as InterviewStatus,
    note: row.note ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function readInterview(pool: Pool, interviewId: string): Promise<InterviewRow | null> {
  const id = String(interviewId ?? '').trim();
  if (!id || !(await relExists(pool, 'interview_schedules'))) return null;
  try {
    const { rows } = await pool.query(`SELECT * FROM interview_schedules WHERE id = $1::bigint`, [id]);
    return rows[0] ? shapeInterview(rows[0]) : null;
  } catch {
    return null;
  }
}

// ── Interview Scheduling (WRITE) ────────────────────────────────────────────
export async function scheduleInterview(
  pool: Pool,
  input: {
    jobId: string; candidateId: string;
    roundName?: string | null; roundSeq?: number | null; mode?: string | null;
    scheduledAt?: string | null; durationMins?: number | null; location?: string | null;
    panelists?: any; note?: string | null; actor?: string | null;
  },
): Promise<EngineResult> {
  const jobId = String(input?.jobId ?? '').trim();
  const candidateId = String(input?.candidateId ?? '').trim();
  if (!jobId || !candidateId) return err('invalid_input', 'jobId and candidateId are required');
  if (input.mode != null && !isValidMode(input.mode)) {
    return err('invalid_input', `unknown mode "${input.mode}" — valid: ${INTERVIEW_MODES.join(', ')}`);
  }

  const job = await readJob(pool, jobId);
  if (!job) return err('not_found', `job ${jobId} not found`);
  const cand = await readCandidate(pool, candidateId);
  if (!cand) return err('not_found', `candidate ${candidateId} not found`);
  if (!candidateInJob(cand, jobId)) {
    return err('invalid_input', `candidate ${candidateId} does not belong to job ${jobId}`);
  }

  try {
    await ensureInterviewSchema(pool);
  } catch (e: any) {
    return err('invalid_input', `could not ensure schema: ${e?.message ?? 'error'}`);
  }

  const panelists = Array.isArray(input.panelists) ? input.panelists : [];
  const employerId = cand.employer_id ?? job.employer_id ?? null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO interview_schedules
         (employer_id, job_id, candidate_id, round_name, round_seq, mode, scheduled_at,
          duration_mins, location, panelists, status, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'scheduled',$11,$12)
       RETURNING *`,
      [
        employerId, jobId, candidateId,
        input.roundName != null ? String(input.roundName) : null,
        input.roundSeq != null ? Number(input.roundSeq) : null,
        input.mode ?? null,
        input.scheduledAt != null ? String(input.scheduledAt) : null,
        input.durationMins != null ? Number(input.durationMins) : null,
        input.location != null ? String(input.location) : null,
        JSON.stringify(panelists),
        input.note != null ? String(input.note) : null,
        input.actor != null ? String(input.actor) : null,
      ],
    );
    return ok({ ...shapeInterview(rows[0]), disclaimer: INTERVIEW_DISCLAIMER });
  } catch (e: any) {
    return err('invalid_input', `could not schedule interview: ${e?.message ?? 'error'}`);
  }
}

// ── Interview lifecycle status (WRITE — atomic) ─────────────────────────────
export async function updateInterviewStatus(
  pool: Pool,
  input: { interviewId: string; status: string; note?: string | null; actor?: string | null },
): Promise<EngineResult> {
  const interviewId = String(input?.interviewId ?? '').trim();
  if (!interviewId) return err('invalid_input', 'interviewId is required');
  if (!isValidInterviewStatus(input?.status)) {
    return err('invalid_input', `unknown status "${input?.status}" — valid: ${INTERVIEW_STATUSES.join(', ')}`);
  }
  const to = input.status as InterviewStatus;

  if (!(await relExists(pool, 'interview_schedules'))) {
    return err('not_found', `interview ${interviewId} not found`);
  }
  try {
    await ensureInterviewSchema(pool);
  } catch (e: any) {
    return err('invalid_input', `could not ensure schema: ${e?.message ?? 'error'}`);
  }

  const note = input.note != null ? String(input.note) : null;

  // Atomic read-validate-write: lock the interview row so concurrent status changes
  // serialize (no two valid moves from the same prior status).
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (e: any) {
    return err('invalid_input', `could not acquire connection: ${e?.message ?? 'error'}`);
  }
  try {
    await client.query('BEGIN');
    const lock = await client.query(`SELECT * FROM interview_schedules WHERE id = $1::bigint FOR UPDATE`, [interviewId]);
    const existing = lock.rows[0] ?? null;
    if (!existing) {
      await client.query('ROLLBACK');
      return err('not_found', `interview ${interviewId} not found`);
    }
    const from = existing.status as InterviewStatus;
    if (from === to) {
      await client.query('ROLLBACK');
      return err('conflict', `interview ${interviewId} is already "${to}"`);
    }
    if (!canTransitionInterview(from, to)) {
      await client.query('ROLLBACK');
      return err('conflict', `invalid transition ${from} → ${to}; allowed: ${INTERVIEW_TRANSITIONS[from].join(', ') || '(none)'}`);
    }
    const { rows } = await client.query(
      `UPDATE interview_schedules
          SET status = $2, note = COALESCE($3, note), updated_at = now()
        WHERE id = $1::bigint
      RETURNING *`,
      [interviewId, to, note],
    );
    await client.query('COMMIT');
    return ok({ ...shapeInterview(rows[0]), previous_status: from, disclaimer: INTERVIEW_DISCLAIMER });
  } catch (e: any) {
    try { await client.query('ROLLBACK'); } catch { /* already aborted */ }
    return err('invalid_input', `could not update status: ${e?.message ?? 'error'}`);
  } finally {
    client.release();
  }
}

// ── Decision Tracking (WRITE — append-only) ─────────────────────────────────
export async function recordDecision(
  pool: Pool,
  input: {
    jobId: string; candidateId: string; decision: string;
    interviewId?: string | null; stage?: string | null; rationale?: string | null; actor?: string | null;
  },
): Promise<EngineResult> {
  const jobId = String(input?.jobId ?? '').trim();
  const candidateId = String(input?.candidateId ?? '').trim();
  if (!jobId || !candidateId) return err('invalid_input', 'jobId and candidateId are required');
  if (!isValidDecision(input?.decision)) {
    return err('invalid_input', `unknown decision "${input?.decision}" — valid: ${DECISION_TYPES.join(', ')}`);
  }

  const job = await readJob(pool, jobId);
  if (!job) return err('not_found', `job ${jobId} not found`);
  const cand = await readCandidate(pool, candidateId);
  if (!cand) return err('not_found', `candidate ${candidateId} not found`);
  if (!candidateInJob(cand, jobId)) {
    return err('invalid_input', `candidate ${candidateId} does not belong to job ${jobId}`);
  }

  // If an interview is referenced, it must belong to this job + candidate (IDOR).
  let interviewId: string | null = null;
  if (input.interviewId != null && String(input.interviewId).trim() !== '') {
    const iv = await readInterview(pool, String(input.interviewId));
    if (!iv) return err('not_found', `interview ${input.interviewId} not found`);
    if (String(iv.job_id) !== jobId || String(iv.candidate_id) !== candidateId) {
      return err('invalid_input', `interview ${input.interviewId} does not belong to candidate ${candidateId} in job ${jobId}`);
    }
    interviewId = iv.id;
  }

  try {
    await ensureInterviewSchema(pool);
  } catch (e: any) {
    return err('invalid_input', `could not ensure schema: ${e?.message ?? 'error'}`);
  }

  const employerId = cand.employer_id ?? job.employer_id ?? null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO interview_decisions
         (employer_id, job_id, candidate_id, interview_id, decision, stage, rationale, decided_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        employerId, jobId, candidateId,
        interviewId,
        input.decision,
        input.stage != null ? String(input.stage) : null,
        input.rationale != null ? String(input.rationale) : null,
        input.actor != null ? String(input.actor) : null,
      ],
    );
    return ok({ ...shapeDecision(rows[0]), disclaimer: INTERVIEW_DISCLAIMER });
  } catch (e: any) {
    return err('invalid_input', `could not record decision: ${e?.message ?? 'error'}`);
  }
}

function shapeDecision(row: any) {
  return {
    id: String(row.id),
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    interview_id: row.interview_id != null ? String(row.interview_id) : null,
    decision: row.decision as DecisionType,
    stage: row.stage ?? null,
    rationale: row.rationale ?? null,
    decided_by: row.decided_by ?? null,
    created_at: row.created_at,
  };
}

// ── reads (GET, degrade — never run DDL) ────────────────────────────────────
export async function getInterview(pool: Pool, interviewId: string): Promise<EngineResult> {
  const row = await readInterview(pool, interviewId);
  if (!row) return err('not_found', `interview ${interviewId} not found`);
  return ok({ ...row, disclaimer: INTERVIEW_DISCLAIMER });
}

export async function listInterviews(
  pool: Pool,
  jobId: string,
  opts?: { status?: string | null; candidateId?: string | null },
): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  if (!(await relExists(pool, 'interview_schedules'))) {
    return ok({ job_id: job, count: 0, interviews: [], disclaimer: INTERVIEW_DISCLAIMER });
  }
  const status = opts?.status && isValidInterviewStatus(opts.status) ? opts.status : null;
  const cand = opts?.candidateId ? String(opts.candidateId).trim() : null;
  try {
    const params: any[] = [job];
    let sql = `SELECT * FROM interview_schedules WHERE job_id = $1`;
    if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
    if (cand) { params.push(cand); sql += ` AND candidate_id = $${params.length}`; }
    sql += ` ORDER BY scheduled_at NULLS LAST, id DESC`;
    const { rows } = await pool.query(sql, params);
    return ok({
      job_id: job,
      count: rows.length,
      status_filter: status,
      candidate_filter: cand,
      interviews: rows.map(shapeInterview),
      disclaimer: INTERVIEW_DISCLAIMER,
    });
  } catch {
    return ok({ job_id: job, count: 0, interviews: [], disclaimer: INTERVIEW_DISCLAIMER });
  }
}

export async function getDecisionHistory(pool: Pool, jobId: string, candidateId: string): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();
  const cand = String(candidateId ?? '').trim();
  if (!(await relExists(pool, 'interview_decisions'))) {
    return ok({ job_id: job, candidate_id: cand, count: 0, decisions: [], disclaimer: INTERVIEW_DISCLAIMER });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interview_decisions WHERE job_id = $1 AND candidate_id = $2 ORDER BY created_at ASC, id ASC`,
      [job, cand],
    );
    return ok({
      job_id: job,
      candidate_id: cand,
      count: rows.length,
      decisions: rows.map(shapeDecision),
      disclaimer: INTERVIEW_DISCLAIMER,
    });
  } catch {
    return ok({ job_id: job, candidate_id: cand, count: 0, decisions: [], disclaimer: INTERVIEW_DISCLAIMER });
  }
}

export async function interviewSummary(pool: Pool, jobId: string): Promise<EngineResult> {
  const job = String(jobId ?? '').trim();

  let totalCandidates: number | null = null;
  if (await relExists(pool, 'employer_candidates')) {
    try {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM employer_candidates WHERE job_id = $1`, [job]);
      totalCandidates = Number(rows[0]?.n ?? 0);
    } catch { totalCandidates = null; }
  }

  const byStatus: Record<string, number> = {};
  INTERVIEW_STATUSES.forEach((s) => { byStatus[s] = 0; });
  let totalInterviews = 0;
  let candidatesInterviewed = 0;
  if (await relExists(pool, 'interview_schedules')) {
    try {
      const { rows } = await pool.query(
        `SELECT status, count(*)::int AS n FROM interview_schedules WHERE job_id = $1 GROUP BY status`, [job],
      );
      for (const r of rows) {
        const n = Number(r.n ?? 0);
        if (isValidInterviewStatus(r.status)) byStatus[r.status] = n;
        totalInterviews += n;
      }
      const dc = await pool.query(
        `SELECT count(DISTINCT candidate_id)::int AS n FROM interview_schedules WHERE job_id = $1`, [job],
      );
      candidatesInterviewed = Number(dc.rows[0]?.n ?? 0);
    } catch { /* degrade to zeros */ }
  }

  const byDecision: Record<string, number> = {};
  DECISION_TYPES.forEach((d) => { byDecision[d] = 0; });
  if (await relExists(pool, 'interview_decisions')) {
    try {
      const { rows } = await pool.query(
        `SELECT decision, count(*)::int AS n FROM interview_decisions WHERE job_id = $1 GROUP BY decision`, [job],
      );
      for (const r of rows) {
        if (isValidDecision(r.decision)) byDecision[r.decision] = Number(r.n ?? 0);
      }
    } catch { /* degrade */ }
  }

  // Coverage = share of the job's candidate pool that has at least one interview.
  // Empty/absent pool ⇒ unmeasured ⇒ null (honesty axis: unmeasured is NOT 0).
  const coveragePct = totalCandidates && totalCandidates > 0
    ? Math.round((candidatesInterviewed / totalCandidates) * 1000) / 10
    : null;

  return ok({
    job_id: job,
    total_candidates: totalCandidates,
    candidates_interviewed: candidatesInterviewed,
    total_interviews: totalInterviews,
    coverage_pct: coveragePct,
    by_status: byStatus,
    by_decision: byDecision,
    provenance: 'operator_recorded',
    disclaimer: INTERVIEW_DISCLAIMER,
  });
}
