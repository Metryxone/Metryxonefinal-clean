/**
 * MX-302E — Canonical schema owner for the Campus Placement & Company
 * Intelligence substrate.
 *
 * The DDL lives in migrations/20260627_campus_placement.sql and is executed
 * lazily by `ensureCampusPlacementSchema(pool)` — but ONLY from the flag-gated
 * (campusPlacement) write/read paths AFTER the flag check passes. With the flag
 * OFF these functions are never reached, so the database is byte-identical to
 * legacy (no new tables).
 *
 * `campusPlacementTablesReady(pool)` is a read-only to_regclass probe used by
 * GET handlers that must NEVER write (GET-never-writes): when the substrate is
 * absent they degrade to an honest empty result instead of creating tables.
 */
import type { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

let ensured = false;

const MIGRATION = path.join(__dirname, '../migrations/20260627_campus_placement.sql');

/** All tables owned by this phase. */
export const CAMPUS_PLACEMENT_TABLES = [
  'companies',
  'campus_drives',
  'internships',
  'graduate_programs',
  'placement_calendar',
  'campus_applications',
  'offers',
  'campus_student_profiles',
] as const;

/**
 * Create / reconcile the campus-placement substrate. Idempotent (CREATE ... IF
 * NOT EXISTS throughout) and cached per-process after the first success. Pass
 * `{ force: true }` to re-run (e.g. tests).
 */
export async function ensureCampusPlacementSchema(
  pool: Pool,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (ensured && !opts.force) return;
  const sql = fs.readFileSync(MIGRATION, 'utf-8');
  await pool.query(sql);
  ensured = true;
}

/**
 * Read-only probe — true only when every campus-placement table exists. GET
 * handlers call this before reading so they never trigger DDL on the read path.
 */
export async function campusPlacementTablesReady(pool: Pool): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n
         FROM unnest($1::text[]) t(name)
        WHERE to_regclass('public.' || t.name) IS NOT NULL`,
      [CAMPUS_PLACEMENT_TABLES as unknown as string[]],
    );
    return (rows[0]?.n ?? 0) === CAMPUS_PLACEMENT_TABLES.length;
  } catch {
    return false;
  }
}
