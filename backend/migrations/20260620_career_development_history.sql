-- Phase 4.6 — Career Development append-only history.
--
-- ADDITIVE snapshot table for the Career Development engine. Mirrored by a lazy
-- ensureCareerDevelopmentHistorySchema() in services/career-development-engine.ts
-- (there is no migration runner). The DDL is only executed behind the
-- `careerDevelopment` flag gate (byte-identical-OFF includes the schema) or when
-- this file is applied manually.
--
-- Append-only: each POST /api/career-development/:subject/snapshot inserts ONE row;
-- rows are never updated in place. The full envelope (development streams + plan +
-- tracking + timeline + progression) is preserved in `snapshot` JSONB; the
-- flattened columns are denormalised summaries for cheap history charting and for
-- the per-stream tracking baseline (read back out of `snapshot`).

CREATE TABLE IF NOT EXISTS career_development_history (
  id                    BIGSERIAL PRIMARY KEY,
  subject_id            TEXT NOT NULL,
  role_id               TEXT,
  role_title            TEXT,
  measurable            BOOLEAN NOT NULL DEFAULT FALSE,
  total_competencies    INTEGER NOT NULL DEFAULT 0,
  active_streams        INTEGER NOT NULL DEFAULT 0,
  total_estimated_weeks INTEGER,
  snapshot              JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_development_history_subject
  ON career_development_history (subject_id, created_at DESC);
