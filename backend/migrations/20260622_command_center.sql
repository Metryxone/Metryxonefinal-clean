-- Phase 6.14 — Super Admin Command Center schema (canonical migration).
-- Mirrors backend/services/command-center/command-center-schema.ts (lazy ensureCommandCenterSchema).
-- Additive only: one command_center_* table, CREATE IF NOT EXISTS, never mutates legacy tables.
-- The console reads are GET-never-writes; this DDL runs only via POST /console/setup (flag-gated).

CREATE TABLE IF NOT EXISTS command_center_snapshots (
  id           SERIAL PRIMARY KEY,
  snapshot_key TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  domains      JSONB NOT NULL DEFAULT '[]'::jsonb,
  totals       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_command_center_snapshots_created ON command_center_snapshots(created_at DESC);
