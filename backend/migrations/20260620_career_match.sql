-- PHASE 4.2 — Career Match Engine (additive, flag-gated by `careerMatch`).
--
-- Canonical migration mirrored by the lazy ensureCareerMatchSchema() in
-- services/career-match-engine.ts (no migration runner in this project). Both are
-- reached ONLY behind the careerMatch flag gate (admin rules CRUD / seed, or the
-- explicit POST snapshot). Flag OFF => zero DDL (byte-identical legacy behaviour).
--
-- career_matching_rules : OPTIONAL admin-editable override of the inline
--   DEFAULT_MATCHING_RULES (single active 'default' row). When absent, the engine
--   uses the inline defaults — a read NEVER creates this table (to_regclass probe).
-- career_match_history  : append-only snapshot ledger (the POST snapshot path).

CREATE TABLE IF NOT EXISTS career_matching_rules (
  id          BIGSERIAL PRIMARY KEY,
  rule_key    TEXT NOT NULL UNIQUE,
  version     TEXT NOT NULL DEFAULT '4.2.0',
  weights     JSONB NOT NULL DEFAULT '{}'::jsonb,
  caps        JSONB NOT NULL DEFAULT '{}'::jsonb,
  thresholds  JSONB NOT NULL DEFAULT '{}'::jsonb,
  templates   JSONB NOT NULL DEFAULT '{}'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_match_history (
  id                BIGSERIAL PRIMARY KEY,
  subject_id        TEXT NOT NULL,
  role_id           TEXT,
  role_title        TEXT,
  measurable        BOOLEAN NOT NULL DEFAULT FALSE,
  matches_returned  INTEGER NOT NULL DEFAULT 0,
  top_match         TEXT,
  top_match_pct     NUMERIC,
  snapshot          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_match_history_subject
  ON career_match_history (subject_id, created_at DESC);
