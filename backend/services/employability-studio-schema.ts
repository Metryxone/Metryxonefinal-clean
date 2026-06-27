/**
 * MX-302F — Canonical schema owner for the Employability Studio substrate
 * (resume versions, structured portfolio entries, interview attempts).
 *
 * The DDL lives in migrations/20261215_employability_studio.sql and is executed
 * lazily by `ensureEmployabilityStudioSchema(pool)` — but ONLY from the flag-gated
 * (employabilityStudio) write/read paths AFTER the flag check passes. With the
 * flag OFF these functions are never reached, so the database is byte-identical to
 * legacy (no new tables).
 *
 * `employabilityStudioTablesReady(pool)` is a read-only to_regclass probe used by
 * GET handlers that must NEVER write (GET-never-writes): when the substrate is
 * absent they degrade to an honest empty result instead of creating tables.
 */
import type { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

let ensured = false;

const MIGRATION = path.join(__dirname, '../migrations/20261215_employability_studio.sql');

/** All tables owned by this phase. */
export const EMPLOYABILITY_STUDIO_TABLES = [
  'career_resume_versions',
  'career_portfolio_entries',
  'employability_interview_attempts',
] as const;

/**
 * Create / reconcile the employability-studio substrate. Idempotent (CREATE ...
 * IF NOT EXISTS throughout) and cached per-process after the first success. Pass
 * `{ force: true }` to re-run (e.g. tests).
 */
export async function ensureEmployabilityStudioSchema(
  pool: Pool,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (ensured && !opts.force) return;
  const sql = fs.readFileSync(MIGRATION, 'utf-8');
  await pool.query(sql);
  ensured = true;
}

/**
 * Read-only probe — true only when every employability-studio table exists. GET
 * handlers call this before reading so they never trigger DDL on the read path.
 */
export async function employabilityStudioTablesReady(pool: Pool): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n
         FROM unnest($1::text[]) t(name)
        WHERE to_regclass('public.' || t.name) IS NOT NULL`,
      [EMPLOYABILITY_STUDIO_TABLES as unknown as string[]],
    );
    return (rows[0]?.n ?? 0) === EMPLOYABILITY_STUDIO_TABLES.length;
  } catch {
    return false;
  }
}
