-- Phase 6.13 — Automation Engine (additive, flag-gated `automationEngine`/`automationExecution`).
-- Canonical migration; mirrored by services/automation/automation-schema.ts ensureAutomationSchema().
-- CREATE IF NOT EXISTS only — never mutates legacy tables. No migration runner; applied lazily via
-- POST /api/admin/automation/console/setup or directly with psql.

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
);

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
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_key ON automation_runs(automation_key);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id           SERIAL PRIMARY KEY,
  workflow_key TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  steps        JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_key ON workflow_instances(workflow_key);

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
);
