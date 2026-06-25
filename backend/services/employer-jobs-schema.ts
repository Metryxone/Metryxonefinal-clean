/**
 * Canonical schema owner for the shared `employer_jobs` table.
 *
 * `employer_jobs` is the platform's HIRING-FUNNEL entity. Historically it was
 * created and altered by THREE separate modules with DIVERGENT column
 * expectations:
 *   - employer-portal authoring (POST /api/employer/jobs + toJob mapping),
 *   - recruiter-postings candidate read (GET /api/career/recruiter-postings),
 *   - the MX-103W projection (job_postings -> employer_jobs).
 * Each independently `ADD COLUMN IF NOT EXISTS`'d the descriptive columns to
 * avoid silently breaking when another module happened to CREATE the table
 * first (a `CREATE TABLE IF NOT EXISTS` is a no-op against a pre-existing
 * divergent table — see .agents/memory/employer-job-store-projection.md). Tasks
 * #173 / #174 patched two of those independently; the drift kept recurring.
 *
 * This module is the SINGLE owner of that schema. Every reader/writer calls
 * `ensureEmployerJobsSchema(pool)` instead of maintaining its own CREATE/ALTER,
 * so the next module to touch the table inherits the full canonical column set
 * and cannot reintroduce the same drift.
 *
 * Scope note — the projection feature (MX-103W) has an explicit byte-identical
 * flag-OFF SCHEMA contract: its projection-tracking columns (source_posting_id /
 * source_status / projected_at / projected_by) + their unique index + the
 * job_projection_audit table are created ONLY on the flag-gated write path.
 * Those are therefore deliberately NOT created here (this function runs on
 * always-on read/write paths). The projection service calls this function for
 * the canonical base, then adds its own gated columns. Everything in here is the
 * union of columns the table needs unconditionally (additive, nullable / safe
 * defaults — pre-existing rows are unaffected, and re-running is idempotent).
 */
import type { Pool } from 'pg';

let ensured = false;

/**
 * Create / reconcile the canonical `employer_jobs` table. Idempotent and
 * additive: CREATE TABLE IF NOT EXISTS for a cold DB, then ADD COLUMN IF NOT
 * EXISTS for every descriptive column so a table created by any other module is
 * brought up to the full shape. Caches per-process after the first successful
 * run (pass `{ force: true }` to re-run, e.g. in tests).
 */
export async function ensureEmployerJobsSchema(
  pool: Pool,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (ensured && !opts.force) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employer_jobs (
      id            TEXT PRIMARY KEY,
      employer_id   TEXT,
      title         TEXT NOT NULL,
      department    TEXT,
      location      TEXT,
      type          TEXT,
      work_mode     TEXT,
      experience    TEXT,
      salary        TEXT,
      description   TEXT,
      skills        JSONB DEFAULT '[]'::jsonb,
      requirements  JSONB DEFAULT '[]'::jsonb,
      ei_min_score  INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'active',
      created_at    TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_employer_jobs_status ON employer_jobs(status);

    -- Descriptive columns shared across writers/readers. When the table already
    -- exists from another module the CREATE above is a no-op, so these ALTERs are
    -- what actually reconcile a divergent table. All additive / nullable or
    -- safe-default, so pre-existing rows are unaffected.
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS department        TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS location          TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS type              TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS work_mode         TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS experience        TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS salary            TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS description       TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS skills            JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS requirements      JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS responsibilities  JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS perks             JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS ei_min_score      INTEGER DEFAULT 0;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS deadline          TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS hiring_manager    TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS quota             INTEGER DEFAULT 1;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS application_count INTEGER DEFAULT 0;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT now();
    -- Employer-confirmed curated role for talent matching (Task #102).
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS matched_role_id     TEXT;
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS matched_role_source TEXT;
    -- Public job share links.
    ALTER TABLE employer_jobs ADD COLUMN IF NOT EXISTS share_token       TEXT;
  `);
  // Backfill share tokens for any row missing one (idempotent — only NULLs).
  await pool.query(
    `UPDATE employer_jobs SET share_token = gen_random_uuid()::text WHERE share_token IS NULL`,
  );
  ensured = true;
}
