/**
 * MX-103W Phase 1 — Job Store Projection layer.
 *
 * The platform keeps TWO bounded job contexts (by founder decision they are NOT
 * merged):
 *   - `job_postings`  — canonical AUTHORING / publishing entity (job-posting
 *                       engine: draft -> hr -> legal -> leadership -> approved ->
 *                       published). varchar uuid id; posting actor in `created_by`.
 *   - `employer_jobs` — canonical HIRING-FUNNEL entity (recruiter-postings +
 *                       employer-portal; downstream assessment / interview /
 *                       comparison / shortlisting read THIS table). TEXT id,
 *                       `employer_id`.
 *
 * #98 (`resolveJob`) closed the gap at READ time (employer_jobs -> job_postings
 * fallback). This module closes it at WRITE time: a ONE-DIRECTIONAL projection
 * that, when a posting is PUBLISHED (or leadership-approved), upserts a linked
 * `employer_jobs` row so the posted job gains full funnel citizenship (it appears
 * in employer_jobs lists, feeds and dashboards — not only via the read fallback).
 *
 * Founder contract (honoured here):
 *   - Additive          — no table merged; only new columns + one audit table.
 *   - Reversible        — `unprojectJob` marks the projected row inactive
 *                         (row + audit preserved); no DELETE, no data loss.
 *   - Flag-gated        — callers MUST gate on isEmployerJobStoreSyncEnabled().
 *   - Idempotent        — upsert keyed on the posting id (re-publish re-syncs,
 *                         never duplicates).
 *   - Audit-logged      — every project/reproject/unproject -> job_projection_audit.
 *   - Byte-identical OFF — the projection columns + audit table are created ONLY on
 *                         this write path (which only runs when the flag is ON), so
 *                         flag-OFF touches no schema. GET health uses to_regclass /
 *                         column probes (never DDL).
 *   - Never throws       — projection failure returns a result object; it must never
 *                         break the publish/approve transition that triggered it.
 */
import type { Pool } from 'pg';
import { ensureEmployerJobsSchema } from './employer-jobs-schema';

export const JOB_STORE_PROJECTION_VERSION = '1.0.0';

export type ProjectionAction = 'project' | 'reproject' | 'unproject';

export interface ProjectionResult {
  ok: boolean;
  projected: boolean;
  action: ProjectionAction | null;
  posting_id: string;
  employer_job_id: string | null;
  source_status: string | null;
  projected_status: string | null;
  reason?: string;
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
      [table, column],
    );
    return (r.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Create the projection substrate. WRITE-PATH ONLY — never call from a GET.
 * Ensures the base employer_jobs table (so projection is self-contained even if
 * recruiter-postings/employer-portal ensure-schema has not run yet), the
 * additive projection-tracking columns, and the audit table. All IF NOT EXISTS
 * (idempotent, additive — never drops or alters existing columns).
 */
export async function ensureProjectionSchema(pool: Pool): Promise<void> {
  // Canonical employer_jobs base table + descriptive columns are owned by
  // services/employer-jobs-schema.ts (the single schema owner shared with
  // recruiter-postings / employer-portal) — call it so projection is
  // self-contained even if neither of those ensure-schemas has run yet, and so
  // the base shape can never drift away from what those modules expect.
  await ensureEmployerJobsSchema(pool);
  // Projection-SPECIFIC columns + the audit table below stay here, gated to this
  // WRITE path (which only runs flag-ON), preserving the MX-103W byte-identical
  // flag-OFF SCHEMA contract: these never exist until the projection feature is
  // actually exercised. All IF NOT EXISTS (idempotent, additive).
  await pool.query(`
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS source_posting_id TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS source_status     TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS projected_at      TIMESTAMPTZ;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS projected_by      TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_employer_jobs_source_posting
      ON employer_jobs (source_posting_id) WHERE source_posting_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS job_projection_audit (
      id               BIGSERIAL PRIMARY KEY,
      posting_id       TEXT NOT NULL,
      employer_job_id  TEXT,
      action           TEXT NOT NULL,
      actor_id         TEXT,
      source_status    TEXT,
      projected_status TEXT,
      detail           JSONB DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_job_projection_audit_posting
      ON job_projection_audit (posting_id);
  `);
}

function toLines(text: unknown): string[] {
  if (text == null) return [];
  return String(text)
    .split(/\r?\n|;|•|\u2022/)
    .map(s => s.trim())
    .filter(Boolean);
}

function composeDescription(p: Record<string, any>): string {
  const parts: string[] = [];
  if (p.qualifications) parts.push(`Qualifications:\n${String(p.qualifications).trim()}`);
  if (p.responsibilities) parts.push(`Responsibilities:\n${String(p.responsibilities).trim()}`);
  if (p.kpis) parts.push(`KPIs:\n${String(p.kpis).trim()}`);
  return parts.join('\n\n');
}

async function audit(
  pool: Pool,
  action: ProjectionAction,
  postingId: string,
  employerJobId: string | null,
  actorId: string | null,
  sourceStatus: string | null,
  projectedStatus: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO job_projection_audit
         (posting_id, employer_job_id, action, actor_id, source_status, projected_status, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [postingId, employerJobId, action, actorId, sourceStatus, projectedStatus, JSON.stringify(detail)],
    );
  } catch {
    // Audit is best-effort; a logging failure must never break the projection.
  }
}

/**
 * Project a single published/approved job_postings row into employer_jobs.
 * Idempotent (upsert on id == posting id). Never throws — returns a result.
 * Caller MUST have already checked isEmployerJobStoreSyncEnabled().
 */
export async function projectPublishedJob(
  pool: Pool,
  actorId: string | null,
  postingId: string,
): Promise<ProjectionResult> {
  const pid = String(postingId ?? '').trim();
  const base: ProjectionResult = {
    ok: false,
    projected: false,
    action: null,
    posting_id: pid,
    employer_job_id: null,
    source_status: null,
    projected_status: null,
  };
  if (!pid) return { ...base, reason: 'missing posting id' };

  try {
    if (!(await relExists(pool, 'job_postings'))) {
      return { ...base, ok: true, reason: 'job_postings not provisioned' };
    }
    const { rows } = await pool.query(`SELECT * FROM job_postings WHERE id = $1`, [pid]);
    const p = rows[0];
    if (!p) return { ...base, ok: true, reason: 'posting not found' };

    await ensureProjectionSchema(pool);

    // Does a linked projection already exist? (reproject vs first project)
    const existing = await pool.query(
      `SELECT id FROM employer_jobs WHERE source_posting_id = $1 OR id = $1 LIMIT 1`,
      [pid],
    );
    const action: ProjectionAction = (existing.rowCount ?? 0) > 0 ? 'reproject' : 'project';

    const projectedStatus = 'active';
    const employerJobId = pid; // 1:1 link — reuse the posting id as the funnel id.

    // Map to the columns guaranteed present in BOTH the canonical (recruiter-
    // postings / employer-portal) shape and the fallback shape. The canonical
    // employer_jobs has NO work_mode / experience / salary columns (it uses
    // `type` and salary_min/max), so we intentionally drop those source fields
    // (honest omission, not fabrication — work_mode is folded into the
    // description). job_postings.work_mode is preserved in the description.
    const workModeNote = p.work_mode ? `Work mode: ${String(p.work_mode).trim()}` : '';
    const description = [composeDescription(p), workModeNote].filter(Boolean).join('\n\n');
    await pool.query(
      `INSERT INTO employer_jobs
         (id, employer_id, title, department, location, type,
          description, requirements, responsibilities, skills, ei_min_score, status,
          source_posting_id, source_status, projected_at, projected_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15,
               COALESCE($16, now()), now())
       ON CONFLICT (id) DO UPDATE SET
         employer_id       = EXCLUDED.employer_id,
         title             = EXCLUDED.title,
         department        = EXCLUDED.department,
         type              = EXCLUDED.type,
         description       = EXCLUDED.description,
         requirements      = EXCLUDED.requirements,
         responsibilities  = EXCLUDED.responsibilities,
         status            = EXCLUDED.status,
         source_posting_id = EXCLUDED.source_posting_id,
         source_status     = EXCLUDED.source_status,
         projected_at      = now(),
         projected_by      = EXCLUDED.projected_by,
         updated_at        = now()`,
      [
        employerJobId,
        p.created_by ?? null,
        p.title ?? '',
        p.role_category ?? null,
        null, // location — no source field on job_postings (honest empty, not fabricated)
        p.employment_type ?? null,
        description,
        JSON.stringify(toLines(p.eligibility).concat(toLines(p.qualifications))),
        JSON.stringify(toLines(p.responsibilities)),
        JSON.stringify([]), // skills — job_postings has no structured skills (honest empty)
        0, // ei_min_score — no source field
        projectedStatus,
        pid,
        p.status ?? null,
        actorId,
        p.created_at ?? null,
      ],
    );

    await audit(pool, action, pid, employerJobId, actorId, p.status ?? null, projectedStatus, {
      title: p.title ?? null,
      visibility: p.visibility ?? null,
    });

    return {
      ok: true,
      projected: true,
      action,
      posting_id: pid,
      employer_job_id: employerJobId,
      source_status: p.status ?? null,
      projected_status: projectedStatus,
    };
  } catch (e: any) {
    return { ...base, reason: `projection error: ${e?.message ?? 'db error'}` };
  }
}

/**
 * Reverse a projection: mark the projected employer_jobs row inactive (no DELETE,
 * no data loss). Idempotent, audit-logged, never throws.
 */
export async function unprojectJob(
  pool: Pool,
  actorId: string | null,
  postingId: string,
): Promise<ProjectionResult> {
  const pid = String(postingId ?? '').trim();
  const base: ProjectionResult = {
    ok: false,
    projected: false,
    action: 'unproject',
    posting_id: pid,
    employer_job_id: null,
    source_status: null,
    projected_status: null,
  };
  if (!pid) return { ...base, reason: 'missing posting id' };

  try {
    if (!(await relExists(pool, 'employer_jobs')) || !(await columnExists(pool, 'employer_jobs', 'source_posting_id'))) {
      return { ...base, ok: true, reason: 'no projection substrate' };
    }
    const r = await pool.query(
      `UPDATE employer_jobs
          SET status = 'inactive', updated_at = now()
        WHERE (source_posting_id = $1 OR id = $1) AND source_posting_id IS NOT NULL
        RETURNING id`,
      [pid],
    );
    const employerJobId = r.rows?.[0]?.id ?? null;
    if (!employerJobId) return { ...base, ok: true, reason: 'no projected row to reverse' };

    await audit(pool, 'unproject', pid, employerJobId, actorId, null, 'inactive', {});
    return {
      ok: true,
      projected: true,
      action: 'unproject',
      posting_id: pid,
      employer_job_id: employerJobId,
      source_status: null,
      projected_status: 'inactive',
    };
  } catch (e: any) {
    return { ...base, reason: `unproject error: ${e?.message ?? 'db error'}` };
  }
}

export interface ProjectionHealth {
  substrate_present: boolean;
  projection_active: boolean; // are projection-tracking columns present?
  published_postings: number | null;
  projected_jobs: number | null;
  active_projected_jobs: number | null;
  inactive_projected_jobs: number | null;
  unprojected_published: number | null; // published postings with no linked employer_jobs row
  last_projected_at: string | null;
  audit_events: number | null;
  notes: string[];
}

/**
 * Read-only projection health for the super-admin console (Phase 3 composes this).
 * to_regclass / column probes only — NEVER runs DDL, NEVER throws.
 * Coverage axis only; values are null (not 0) when a substrate is absent.
 */
export async function getProjectionHealth(pool: Pool): Promise<ProjectionHealth> {
  const notes: string[] = [];
  const out: ProjectionHealth = {
    substrate_present: false,
    projection_active: false,
    published_postings: null,
    projected_jobs: null,
    active_projected_jobs: null,
    inactive_projected_jobs: null,
    unprojected_published: null,
    last_projected_at: null,
    audit_events: null,
    notes,
  };

  const hasEmployerJobs = await relExists(pool, 'employer_jobs');
  const hasPostings = await relExists(pool, 'job_postings');
  out.substrate_present = hasEmployerJobs;

  if (hasPostings) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM job_postings WHERE status = 'published'`);
      out.published_postings = r.rows[0]?.n ?? 0;
    } catch { notes.push('published_postings unreadable'); }
  } else {
    notes.push('job_postings not provisioned');
  }

  if (hasEmployerJobs && (await columnExists(pool, 'employer_jobs', 'source_posting_id'))) {
    out.projection_active = true;
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE source_posting_id IS NOT NULL)::int AS projected,
          COUNT(*) FILTER (WHERE source_posting_id IS NOT NULL AND status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE source_posting_id IS NOT NULL AND status <> 'active')::int AS inactive,
          MAX(projected_at) AS last_projected_at
        FROM employer_jobs`);
      out.projected_jobs = r.rows[0]?.projected ?? 0;
      out.active_projected_jobs = r.rows[0]?.active ?? 0;
      out.inactive_projected_jobs = r.rows[0]?.inactive ?? 0;
      out.last_projected_at = r.rows[0]?.last_projected_at
        ? new Date(r.rows[0].last_projected_at).toISOString()
        : null;
    } catch { notes.push('projection counts unreadable'); }

    if (hasPostings) {
      try {
        const r = await pool.query(`
          SELECT COUNT(*)::int AS n
            FROM job_postings jp
           WHERE jp.status = 'published'
             AND NOT EXISTS (
               SELECT 1 FROM employer_jobs ej WHERE ej.source_posting_id = jp.id
             )`);
        out.unprojected_published = r.rows[0]?.n ?? 0;
      } catch { notes.push('unprojected_published unreadable'); }
    }
  } else if (hasEmployerJobs) {
    notes.push('projection columns absent (flag never activated) — projected counts not measurable');
  }

  if (await relExists(pool, 'job_projection_audit')) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM job_projection_audit`);
      out.audit_events = r.rows[0]?.n ?? 0;
    } catch { notes.push('audit count unreadable'); }
  }

  return out;
}
