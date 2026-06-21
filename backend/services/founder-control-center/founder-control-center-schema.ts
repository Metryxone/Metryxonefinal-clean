/**
 * Phase 6.15 — Founder Control Center lazy schema. WRITE-PATH ONLY.
 * Mirrors migrations/20260623_founder_control_center.sql. Called ONLY from the POST snapshot
 * handler so GET routes never trigger DDL (read paths stay byte-identical / side-effect free).
 * Append-only: founder snapshots are an audit trail, never mutated in place.
 */
import pg from 'pg';

let ensured = false;

export async function ensureFounderControlCenterSchema(pool: pg.Pool): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS founder_control_center_snapshots (
      id           BIGSERIAL PRIMARY KEY,
      captured_by  TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      degraded     BOOLEAN NOT NULL DEFAULT false,
      dashboard    JSONB NOT NULL DEFAULT '{}'::jsonb,
      executive    JSONB NOT NULL DEFAULT '{}'::jsonb,
      strategic    JSONB NOT NULL DEFAULT '{}'::jsonb,
      validation   JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fcc_snapshots_generated_at ON founder_control_center_snapshots (generated_at DESC);`);
  ensured = true;
}
