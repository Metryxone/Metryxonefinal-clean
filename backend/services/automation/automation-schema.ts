/**
 * Phase 6.13 — Automation Engine lazy schema (mirrors migrations/20260621_automation_engine.sql).
 *
 * Five additive tables, all `automation_*` namespaced. CREATE IF NOT EXISTS only — never mutates
 * existing rows, never touches legacy tables. Called ONLY from the explicit POST /console/setup
 * write path (GET-never-writes). Flag-OFF the route 503s before this is ever reached.
 */
import pg from 'pg';

export async function ensureAutomationSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_definitions (
      id              SERIAL PRIMARY KEY,
      automation_key  TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      automation_type TEXT NOT NULL,
      trigger_type    TEXT NOT NULL DEFAULT 'manual',
      trigger_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
      conditions      JSONB NOT NULL DEFAULT '{}'::jsonb,
      action_type     TEXT NOT NULL DEFAULT 'notify',
      action_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_enabled      BOOLEAN NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id              SERIAL PRIMARY KEY,
      automation_key  TEXT NOT NULL,
      automation_type TEXT,
      status          TEXT NOT NULL DEFAULT 'queued',
      eligible_count  INTEGER,
      executed_count  INTEGER NOT NULL DEFAULT 0,
      dry_run         BOOLEAN NOT NULL DEFAULT true,
      summary         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_automation_runs_key ON automation_runs(automation_key)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_definitions (
      id           SERIAL PRIMARY KEY,
      workflow_key TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      description  TEXT,
      steps        JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_enabled   BOOLEAN NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id           SERIAL PRIMARY KEY,
      workflow_key TEXT NOT NULL,
      subject_ref  TEXT,
      current_step INTEGER NOT NULL DEFAULT 0,
      total_steps  INTEGER NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'active',
      state        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_instances_key ON workflow_instances(workflow_key)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_definitions (
      id            SERIAL PRIMARY KEY,
      campaign_key  TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      campaign_type TEXT NOT NULL,
      audience_type TEXT,
      channel       TEXT NOT NULL DEFAULT 'email',
      schedule      JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'draft',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

export const AUTOMATION_TABLES = [
  'automation_definitions',
  'automation_runs',
  'workflow_definitions',
  'workflow_instances',
  'campaign_definitions',
] as const;
