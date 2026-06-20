-- Phase 4.5 — Career Roadmap append-only history.
--
-- ADDITIVE snapshot table for the Career Roadmap engine. Mirrored by a lazy
-- ensureCareerRoadmapHistorySchema() in services/career-roadmap-engine.ts (there
-- is no migration runner). The DDL is only executed behind the `careerRoadmap`
-- flag gate (byte-identical-OFF includes the schema) or when this file is applied
-- manually.
--
-- Append-only: each POST /api/career-roadmap/:subject/snapshot inserts ONE row;
-- rows are never updated in place. The full envelope (milestones + development
-- plan + timeline + progression) is preserved in `snapshot` JSONB; the flattened
-- columns are denormalised summaries for cheap history charting.

CREATE TABLE IF NOT EXISTS career_roadmap_history (
  id                    BIGSERIAL PRIMARY KEY,
  subject_id            TEXT NOT NULL,
  role_id               TEXT,
  role_title            TEXT,
  measurable            BOOLEAN NOT NULL DEFAULT FALSE,
  progression_pct       NUMERIC,
  total_competencies    INTEGER NOT NULL DEFAULT 0,
  milestone_count       INTEGER NOT NULL DEFAULT 0,
  immediate_count       INTEGER NOT NULL DEFAULT 0,
  total_estimated_weeks INTEGER,
  snapshot              JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_roadmap_history_subject
  ON career_roadmap_history (subject_id, created_at DESC);
