/**
 * PHASE 5.3 — Job Posting Engine (services).
 *
 * Three deliverable engines over the EXISTING lifecycle spine
 * (`job_postings` + `job_approval_logs` + `job_distributions`):
 *   - job_posting_engine     : Create / Edit / Publish a posting
 *   - job_management_engine   : Pause / Close / Archive + Visibility controls
 *                               (scope via job_postings.visibility AND external
 *                                channel distribution via job_distributions)
 *   - job_workflows           : HR -> Legal -> Leadership approval state machine
 *
 * Design contract:
 *   - Additive: NO new tables (one additive `visibility` column on job_postings).
 *   - Writes only via explicit operations (POST/PUT routes). GET stays read-only.
 *   - State transitions are VALIDATED against a single source-of-truth transition
 *     map; an illegal transition returns { ok:false, code:'invalid_transition' }
 *     (the route maps that to 409) — it NEVER throws and NEVER mutates.
 *   - A state mutation and its audit row are written in ONE transaction, so the
 *     job_approval_logs history can never silently drift from job state.
 *   - Actor/creator ids are the authenticated principal (valid FK to users.id),
 *     never client-supplied — IDOR-safe.
 */

import type { Pool, PoolClient } from 'pg';

export const JOB_POSTING_ENGINE_VERSION = '5.3.0';

// Canonical lifecycle statuses (status column is free-text; these are the values
// the engine emits/accepts).
export const JOB_STATUS = {
  DRAFT: 'draft',
  HR_REVIEW: 'hr_review',
  LEGAL_REVIEW: 'legal_review',
  LEADERSHIP_APPROVAL: 'leadership_approval',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
  REJECTED: 'rejected',
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const VISIBILITY = ['private', 'internal', 'public'] as const;
export type Visibility = (typeof VISIBILITY)[number];

// Distribution channels (mirrors the schema comment on job_distributions.channel).
export const CHANNELS = ['linkedin', 'indeed', 'naukri', 'internshala', 'google_jobs', 'metryx_careers'] as const;
export type Channel = (typeof CHANNELS)[number];

const REVIEW_STAGES = ['hr', 'legal', 'leadership'] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export interface Actor {
  id: string;
  role: string;
}

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_transition' | 'invalid_input'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_transition' | 'invalid_input', message: string): EngineResult =>
  ({ ok: false, code, message });

type Executor = Pool | PoolClient;

// ── lazy additive schema (write-path only) ──────────────────────────────────
let schemaReady = false;
export async function ensureJobPostingSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  try {
    await pool.query(
      `ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings (status)`);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_job_approval_logs_job_id ON job_approval_logs (job_id, created_at)`,
    );
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_job_distributions_job_channel ON job_distributions (job_id, channel)`,
    );
    schemaReady = true;
  } catch {
    // never throw — degrade; a write may still succeed if the objects already exist.
  }
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

async function getJobRow(exec: Executor, id: string): Promise<any | null> {
  try {
    const r = await exec.query(`SELECT * FROM job_postings WHERE id = $1`, [id]);
    return r.rows?.[0] ?? null;
  } catch {
    return null;
  }
}

// Append ONE audit row. Runs inside the caller's transaction (no swallow) so a
// failed log rolls back the whole transition — history can't drift from state.
async function logTransition(
  exec: Executor,
  jobId: string,
  fromStatus: string | null,
  toStatus: string,
  action: string,
  actor: Actor,
  comments: string | null,
): Promise<void> {
  await exec.query(
    `INSERT INTO job_approval_logs (job_id, from_status, to_status, action, comments, actor_id, actor_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    // from_status is NOT NULL in the DB; the initial 'create' transition has no
    // prior status, so coerce null -> '' (honest "no prior state") rather than violate it.
    [jobId, fromStatus ?? '', toStatus, action, comments ?? null, actor.id, actor.role],
  );
}

// Run fn inside a single transaction; ROLLBACK on any error.
async function withTxn<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

// ── job_posting_engine: Create / Edit / Publish ─────────────────────────────

const EDITABLE_COLUMNS: Record<string, string> = {
  title: 'title',
  roleCategory: 'role_category',
  employmentType: 'employment_type',
  workMode: 'work_mode',
  eligibility: 'eligibility',
  qualifications: 'qualifications',
  responsibilities: 'responsibilities',
  kpis: 'kpis',
  compensationModel: 'compensation_model',
  legalClauses: 'legal_clauses',
  hiringQuota: 'hiring_quota',
};

export async function createJob(pool: Pool, actor: Actor, body: any): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  if (!actor?.id) return err('invalid_input', 'authenticated actor required');
  const vals = {
    title: body.title ?? '',
    role_category: body.roleCategory ?? body.role_category ?? '',
    employment_type: body.employmentType ?? body.employment_type ?? '',
    work_mode: body.workMode ?? body.work_mode ?? '',
    eligibility: body.eligibility ?? '',
    qualifications: body.qualifications ?? '',
    responsibilities: body.responsibilities ?? '',
    kpis: body.kpis ?? '',
    compensation_model: body.compensationModel ?? body.compensation_model ?? '',
    legal_clauses: body.legalClauses ?? body.legal_clauses ?? null,
    hiring_quota: Number.isFinite(Number(body.hiringQuota)) ? Number(body.hiringQuota) : 0,
    visibility: VISIBILITY.includes(body.visibility) ? body.visibility : 'private',
  };
  if (!String(vals.title).trim()) return err('invalid_input', 'title is required');
  try {
    const job = await withTxn(pool, async (c) => {
      const r = await c.query(
        `INSERT INTO job_postings
           (title, role_category, employment_type, work_mode, eligibility, qualifications,
            responsibilities, kpis, compensation_model, legal_clauses, hiring_quota,
            visibility, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          vals.title, vals.role_category, vals.employment_type, vals.work_mode, vals.eligibility,
          vals.qualifications, vals.responsibilities, vals.kpis, vals.compensation_model,
          vals.legal_clauses, vals.hiring_quota, vals.visibility, JOB_STATUS.DRAFT, actor.id,
        ],
      );
      await logTransition(c, r.rows[0].id, null, JOB_STATUS.DRAFT, 'create', actor, body.comments ?? null);
      return r.rows[0];
    });
    return ok(job);
  } catch (e: any) {
    return err('invalid_input', `could not create job: ${e?.message ?? 'db error'}`);
  }
}

export async function editJob(pool: Pool, actor: Actor, id: string, body: any): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  if (![JOB_STATUS.DRAFT, JOB_STATUS.REJECTED].includes(job.status)) {
    return err('invalid_transition', `cannot edit a job in status '${job.status}' (edit only in draft/rejected)`);
  }
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [k, col] of Object.entries(EDITABLE_COLUMNS)) {
    if (k in body) {
      const v = col === 'hiring_quota' ? (Number.isFinite(Number(body[k])) ? Number(body[k]) : 0) : body[k];
      sets.push(`${col} = $${i++}`);
      params.push(v);
    }
  }
  if (!sets.length) return ok(job);
  sets.push(`updated_at = now()`);
  params.push(id);
  try {
    const updated = await withTxn(pool, async (c) => {
      const r = await c.query(`UPDATE job_postings SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params);
      await logTransition(c, id, job.status, job.status, 'edit', actor, body.comments ?? null);
      return r.rows[0];
    });
    return ok(updated);
  } catch (e: any) {
    return err('invalid_input', `could not edit job: ${e?.message ?? 'db error'}`);
  }
}

// ── job_workflows: HR -> Legal -> Leadership approval state machine ──────────

const STAGE_FLOW: Record<ReviewStage, { from: JobStatus; to: JobStatus; cols: string }> = {
  hr: { from: JOB_STATUS.HR_REVIEW, to: JOB_STATUS.LEGAL_REVIEW, cols: 'hr_review' },
  legal: { from: JOB_STATUS.LEGAL_REVIEW, to: JOB_STATUS.LEADERSHIP_APPROVAL, cols: 'legal_review' },
  leadership: { from: JOB_STATUS.LEADERSHIP_APPROVAL, to: JOB_STATUS.APPROVED, cols: 'leadership_approval' },
};

export async function submitForReview(pool: Pool, actor: Actor, id: string, comments?: string): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  if (![JOB_STATUS.DRAFT, JOB_STATUS.REJECTED].includes(job.status)) {
    return err('invalid_transition', `cannot submit a job in status '${job.status}' (submit from draft/rejected)`);
  }
  try {
    const updated = await withTxn(pool, async (c) => {
      const r = await c.query(
        `UPDATE job_postings SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [JOB_STATUS.HR_REVIEW, id],
      );
      await logTransition(c, id, job.status, JOB_STATUS.HR_REVIEW, 'submit_for_review', actor, comments ?? null);
      return r.rows[0];
    });
    return ok(updated);
  } catch (e: any) {
    return err('invalid_input', `could not submit job: ${e?.message ?? 'db error'}`);
  }
}

export async function decideStage(
  pool: Pool,
  actor: Actor,
  id: string,
  stage: string,
  decision: string,
  notes?: string,
): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  if (!REVIEW_STAGES.includes(stage as ReviewStage)) {
    return err('invalid_input', `unknown stage '${stage}' (expected hr|legal|leadership)`);
  }
  if (!['approve', 'reject'].includes(decision)) {
    return err('invalid_input', `unknown decision '${decision}' (expected approve|reject)`);
  }
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  const flow = STAGE_FLOW[stage as ReviewStage];
  if (job.status !== flow.from) {
    return err('invalid_transition', `stage '${stage}' expects status '${flow.from}' but job is '${job.status}'`);
  }
  const toStatus = decision === 'approve' ? flow.to : JOB_STATUS.REJECTED;
  try {
    const updated = await withTxn(pool, async (c) => {
      const r = await c.query(
        `UPDATE job_postings
            SET status = $1, ${flow.cols}_by = $2, ${flow.cols}_at = now(), ${flow.cols}_notes = $3, updated_at = now()
          WHERE id = $4 RETURNING *`,
        [toStatus, actor.id, notes ?? null, id],
      );
      await logTransition(c, id, job.status, toStatus, `${stage}_${decision}`, actor, notes ?? null);
      return r.rows[0];
    });
    return ok(updated);
  } catch (e: any) {
    return err('invalid_input', `could not record decision: ${e?.message ?? 'db error'}`);
  }
}

export async function getWorkflow(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'job_approval_logs'))) {
    return ok({ job_id: id, transitions: [], note: 'job_approval_logs not provisioned' });
  }
  try {
    const r = await pool.query(
      `SELECT from_status, to_status, action, comments, actor_id, actor_role, created_at
         FROM job_approval_logs WHERE job_id = $1 ORDER BY created_at ASC, id ASC`,
      [id],
    );
    return ok({ job_id: id, transitions: r.rows });
  } catch {
    return ok({ job_id: id, transitions: [], note: 'workflow log unreadable' });
  }
}

// ── job_management_engine: Publish / Pause / Close / Archive / Visibility ────

async function transition(
  pool: Pool,
  actor: Actor,
  id: string,
  allowedFrom: JobStatus[],
  toStatus: JobStatus,
  action: string,
  extraSet: string,
  comments?: string,
): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  if (!allowedFrom.includes(job.status)) {
    return err('invalid_transition', `cannot ${action} a job in status '${job.status}' (allowed from: ${allowedFrom.join(', ')})`);
  }
  try {
    const updated = await withTxn(pool, async (c) => {
      const r = await c.query(
        `UPDATE job_postings SET status = $1${extraSet ? `, ${extraSet}` : ''}, updated_at = now() WHERE id = $2 RETURNING *`,
        [toStatus, id],
      );
      await logTransition(c, id, job.status, toStatus, action, actor, comments ?? null);
      return r.rows[0];
    });
    return ok(updated);
  } catch (e: any) {
    return err('invalid_input', `could not ${action} job: ${e?.message ?? 'db error'}`);
  }
}

export const publishJob = (pool: Pool, actor: Actor, id: string, comments?: string) =>
  // approved -> published (initial) OR paused -> published (resume)
  transition(pool, actor, id, [JOB_STATUS.APPROVED, JOB_STATUS.PAUSED], JOB_STATUS.PUBLISHED, 'publish', 'published_at = COALESCE(published_at, now())', comments);

export const pauseJob = (pool: Pool, actor: Actor, id: string, comments?: string) =>
  transition(pool, actor, id, [JOB_STATUS.PUBLISHED], JOB_STATUS.PAUSED, 'pause', '', comments);

export const closeJob = (pool: Pool, actor: Actor, id: string, comments?: string) =>
  transition(pool, actor, id, [JOB_STATUS.PUBLISHED, JOB_STATUS.PAUSED], JOB_STATUS.CLOSED, 'close', 'closed_at = now()', comments);

export const archiveJob = (pool: Pool, actor: Actor, id: string, comments?: string) =>
  transition(pool, actor, id, [JOB_STATUS.CLOSED, JOB_STATUS.REJECTED, JOB_STATUS.DRAFT], JOB_STATUS.ARCHIVED, 'archive', '', comments);

export async function setVisibility(pool: Pool, actor: Actor, id: string, visibility: string): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  if (!VISIBILITY.includes(visibility as Visibility)) {
    return err('invalid_input', `unknown visibility '${visibility}' (expected ${VISIBILITY.join('|')})`);
  }
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  if (job.status === JOB_STATUS.ARCHIVED) {
    return err('invalid_transition', 'cannot change visibility of an archived job');
  }
  try {
    const updated = await withTxn(pool, async (c) => {
      const r = await c.query(
        `UPDATE job_postings SET visibility = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [visibility, id],
      );
      await logTransition(c, id, job.status, job.status, `visibility_${visibility}`, actor, null);
      return r.rows[0];
    });
    return ok(updated);
  } catch (e: any) {
    return err('invalid_input', `could not set visibility: ${e?.message ?? 'db error'}`);
  }
}

// ── job_management_engine: distribution channels (job_distributions) ─────────
// External-channel visibility: a published job is distributed to channels; each
// channel row tracks posted/unpublished state. Distinct from job_postings.visibility
// (access scope). Consumes the previously-unused job_distributions table.

export async function distributeJob(pool: Pool, actor: Actor, id: string, channels: any): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  const list: string[] = Array.isArray(channels) ? channels : [];
  if (!list.length) return err('invalid_input', 'channels[] required');
  const invalid = list.filter((c) => !CHANNELS.includes(c as Channel));
  if (invalid.length) return err('invalid_input', `unknown channel(s): ${invalid.join(', ')} (allowed: ${CHANNELS.join('|')})`);
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  if (job.status !== JOB_STATUS.PUBLISHED) {
    return err('invalid_transition', `can only distribute a published job (status is '${job.status}')`);
  }
  try {
    const rows = await withTxn(pool, async (c) => {
      for (const ch of list) {
        await c.query(
          `INSERT INTO job_distributions (job_id, channel, status, posted_at, unpublished_at)
           VALUES ($1, $2, 'posted', now(), NULL)
           ON CONFLICT (job_id, channel)
           DO UPDATE SET status = 'posted', posted_at = now(), unpublished_at = NULL`,
          [id, ch],
        );
      }
      await logTransition(c, id, job.status, job.status, 'distribute', actor, list.join(','));
      const d = await c.query(`SELECT * FROM job_distributions WHERE job_id = $1 ORDER BY channel`, [id]);
      return d.rows;
    });
    return ok({ job_id: id, distributions: rows });
  } catch (e: any) {
    return err('invalid_input', `could not distribute job: ${e?.message ?? 'db error'}`);
  }
}

export async function unpublishChannel(pool: Pool, actor: Actor, id: string, channel: string): Promise<EngineResult> {
  await ensureJobPostingSchema(pool);
  if (!CHANNELS.includes(channel as Channel)) {
    return err('invalid_input', `unknown channel '${channel}' (allowed: ${CHANNELS.join('|')})`);
  }
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  try {
    const row = await withTxn(pool, async (c) => {
      const r = await c.query(
        `UPDATE job_distributions SET status = 'unpublished', unpublished_at = now()
          WHERE job_id = $1 AND channel = $2 RETURNING *`,
        [id, channel],
      );
      if (!r.rows[0]) return null;
      await logTransition(c, id, job.status, job.status, 'unpublish_channel', actor, channel);
      return r.rows[0];
    });
    if (!row) return err('not_found', `no distribution for channel '${channel}' on this job`);
    return ok(row);
  } catch (e: any) {
    return err('invalid_input', `could not unpublish channel: ${e?.message ?? 'db error'}`);
  }
}

export async function getDistributions(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'job_distributions'))) {
    return ok({ job_id: id, distributions: [], note: 'job_distributions not provisioned' });
  }
  try {
    const r = await pool.query(`SELECT * FROM job_distributions WHERE job_id = $1 ORDER BY channel`, [id]);
    return ok({ job_id: id, distributions: r.rows });
  } catch {
    return ok({ job_id: id, distributions: [], note: 'job_distributions unreadable' });
  }
}

// ── reads (read-only; no DDL) ────────────────────────────────────────────────

export async function listJobs(pool: Pool, filters: { status?: string; visibility?: string }): Promise<EngineResult> {
  if (!(await relExists(pool, 'job_postings'))) {
    return ok({ jobs: [], note: 'job_postings not provisioned' });
  }
  const where: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (filters.status) { where.push(`status = $${i++}`); params.push(filters.status); }
  if (filters.visibility) { where.push(`visibility = $${i++}`); params.push(filters.visibility); }
  try {
    const r = await pool.query(
      `SELECT * FROM job_postings ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 500`,
      params,
    );
    return ok({ jobs: r.rows });
  } catch {
    return ok({ jobs: [], note: 'job_postings unreadable' });
  }
}

export async function getJob(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'job_postings'))) return err('not_found', 'job_postings not provisioned');
  const job = await getJobRow(pool, id);
  if (!job) return err('not_found', 'job not found');
  let distributions: any[] = [];
  try {
    const d = await pool.query(`SELECT * FROM job_distributions WHERE job_id = $1 ORDER BY channel`, [id]);
    distributions = d.rows;
  } catch { /* read-only degrade */ }
  return ok({ ...job, distributions });
}
