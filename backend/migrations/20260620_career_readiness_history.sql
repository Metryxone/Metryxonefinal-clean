-- PHASE 4.3 — Career Readiness Engine.
-- Append-only snapshot of the composed career-readiness envelope (Current /
-- Future / Role / Growth) per subject. Mirrors the lazy ensureCareerReadinessHistorySchema()
-- in services/career-readiness-aggregator.ts (no migration runner — lazy ensure
-- is the canonical path; this file is the documented mirror). Rows are NEVER
-- updated in place (append-only history, like cg_readiness_history).
--
-- Strictly additive + flag-gated: the DDL is reached ONLY behind the
-- `careerReadiness` flag (POST snapshot path). Flag OFF => never created.

CREATE TABLE IF NOT EXISTS career_readiness_history (
  id              BIGSERIAL PRIMARY KEY,
  subject_id      TEXT NOT NULL,
  overall_score   NUMERIC,
  overall_band    TEXT,
  current_score   NUMERIC,
  current_band    TEXT,
  future_score    NUMERIC,
  future_band     TEXT,
  role_score      NUMERIC,
  role_band       TEXT,
  growth_score    NUMERIC,
  growth_level    TEXT,
  measurable      BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot        JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_readiness_history_subject
  ON career_readiness_history (subject_id, created_at DESC);
