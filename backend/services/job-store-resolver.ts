/**
 * Unified, read-only, never-throws job resolver bridging the SPLIT job store.
 *
 * The platform has two job tables that grew independently:
 *   - `job_postings`  — written by the job-posting engine (POST /api/job-posting-engine/jobs).
 *                       varchar uuid id; NO `employer_id` column (the posting
 *                       actor is captured as `created_by`).
 *   - `employer_jobs` — owned by recruiter-postings (TEXT id, has `employer_id`).
 *
 * The downstream hiring stages (assessment, interview, candidate comparison,
 * shortlisting) historically read ONLY `employer_jobs`, so a job posted the
 * normal way was invisible to them (404 / readJob -> null), and the end-to-end
 * smoke had to manually bridge the row across. This resolver removes that gap:
 * it reads `employer_jobs` first (preserving prior behaviour and any
 * employer_jobs-only rows), then falls back to `job_postings`, mapping
 * `created_by -> employer_id` so ownership / job-scoping checks still hold.
 *
 * Discipline preserved: read-only (no DDL, no writes), never throws (degrades
 * to null on any absence/error), and probes each table with to_regclass so a
 * missing table is honest-absent rather than an exception.
 */
import type { Pool } from 'pg';

export interface ResolvedJob {
  id: string;
  employer_id: string | null;
  title: string | null;
  status: string | null;
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

export async function resolveJob(pool: Pool, id: string): Promise<ResolvedJob | null> {
  const jid = String(id ?? '').trim();
  if (!jid) return null;

  if (await relExists(pool, 'employer_jobs')) {
    try {
      const { rows } = await pool.query(
        `SELECT id, employer_id, title, status FROM employer_jobs WHERE id = $1`,
        [jid],
      );
      if (rows[0]) return rows[0] as ResolvedJob;
    } catch {
      // fall through to job_postings
    }
  }

  if (await relExists(pool, 'job_postings')) {
    try {
      const { rows } = await pool.query(
        `SELECT id, created_by AS employer_id, title, status FROM job_postings WHERE id = $1`,
        [jid],
      );
      if (rows[0]) return rows[0] as ResolvedJob;
    } catch {
      // fall through to null
    }
  }

  return null;
}
