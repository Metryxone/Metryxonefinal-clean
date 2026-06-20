-- PHASE 4.10 — Career Signal Engine config-as-data tables.
--
-- Additive & flag-gated (careerSignal / FF_CAREER_SIGNAL, default OFF). These
-- tables OVERRIDE the in-code signal defaults when present; the read path falls
-- back to defaults via a to_regclass probe and NEVER creates them on a GET. The
-- only write/DDL path is the admin CRUD (ensureCareerSignalConfigSchema mirrors
-- this file exactly). Flag OFF => this DDL never runs (byte-identical legacy).

CREATE TABLE IF NOT EXISTS career_signal_library (
  id            BIGSERIAL PRIMARY KEY,
  signal_key    TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('potential','risk')),
  description   TEXT NOT NULL DEFAULT '',
  inputs        JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_signal_library_order
  ON career_signal_library (display_order ASC, signal_key ASC);

CREATE TABLE IF NOT EXISTS career_signal_rules (
  id             BIGSERIAL PRIMARY KEY,
  rule_key       TEXT NOT NULL UNIQUE,
  version        TEXT NOT NULL DEFAULT '4.10.0',
  bands          JSONB NOT NULL DEFAULT '{}'::jsonb,
  interpretation JSONB NOT NULL DEFAULT '{}'::jsonb,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
