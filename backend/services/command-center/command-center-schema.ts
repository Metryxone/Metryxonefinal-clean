/**
 * Phase 6.14 — Command Center lazy schema (mirrors migrations/20260622_command_center.sql).
 *
 * One additive table, `command_center_*` namespaced. CREATE IF NOT EXISTS only — never mutates
 * existing rows, never touches legacy tables. Called ONLY from the explicit POST /console/setup
 * write path (GET-never-writes). Flag-OFF the route 503s before this is ever reached.
 *
 * command_center_snapshots persists an optional point-in-time capture of the unified overview so
 * operators can keep a historical posture trail. The console itself never writes here on a GET.
 */
import pg from 'pg';

export async function ensureCommandCenterSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS command_center_snapshots (
      id           SERIAL PRIMARY KEY,
      snapshot_key TEXT NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      domains      JSONB NOT NULL DEFAULT '[]'::jsonb,
      totals       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_command_center_snapshots_created ON command_center_snapshots(created_at DESC)`);
}

export const COMMAND_CENTER_TABLES = [
  'command_center_snapshots',
] as const;
