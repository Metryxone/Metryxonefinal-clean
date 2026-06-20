-- Phase 4.4 — Career Gap append-only history.
--
-- ADDITIVE snapshot table for the Career Gap engine. Mirrored by a lazy
-- ensureCareerGapHistorySchema() in services/career-gap-engine.ts (there is no
-- migration runner). The DDL is only executed behind the `careerGap` flag gate
-- (byte-identical-OFF includes the schema) or when this file is applied manually.
--
-- Append-only: each POST /api/career-gap/:subject/snapshot inserts ONE row; rows
-- are never updated in place. The full envelope is preserved in `snapshot` JSONB;
-- the flattened columns are denormalised counts for cheap history charting.

CREATE TABLE IF NOT EXISTS career_gap_history (
  id                BIGSERIAL PRIMARY KEY,
  subject_id        TEXT NOT NULL,
  role_id           TEXT,
  role_title        TEXT,
  total_gaps        INTEGER NOT NULL DEFAULT 0,
  total_critical    INTEGER NOT NULL DEFAULT 0,
  total_blocking    INTEGER NOT NULL DEFAULT 0,
  classified_pct    NUMERIC,
  technical_gaps    INTEGER NOT NULL DEFAULT 0,
  behavioral_gaps   INTEGER NOT NULL DEFAULT 0,
  cognitive_gaps    INTEGER NOT NULL DEFAULT 0,
  functional_gaps   INTEGER NOT NULL DEFAULT 0,
  future_skill_gaps INTEGER NOT NULL DEFAULT 0,
  unclassified_gaps INTEGER NOT NULL DEFAULT 0,
  measurable        BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_gap_history_subject
  ON career_gap_history (subject_id, created_at DESC);
