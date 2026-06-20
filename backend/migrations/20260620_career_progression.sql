-- PHASE 4.11 — Career Progression Tracking append-only tables.
--
-- Additive & flag-gated (careerProgression / FF_CAREER_PROGRESSION, default OFF).
-- These tables hold longitudinal growth snapshots (growth_tracking) and detected
-- career-movement events (career_history). The read path probes them with
-- to_regclass and NEVER creates them on a GET; the ONLY write/DDL path is the
-- POST snapshot (ensureCareerProgressionSchema mirrors this file exactly).
-- Flag OFF => this DDL never runs (byte-identical legacy).

-- Append-only longitudinal growth snapshots (one row per captured point in time).
CREATE TABLE IF NOT EXISTS growth_tracking (
  id               BIGSERIAL PRIMARY KEY,
  subject_id       TEXT NOT NULL,
  career_index     NUMERIC,
  readiness_score  NUMERIC,
  competency_score NUMERIC,
  role_score       NUMERIC,
  future_score     NUMERIC,
  growth_headroom  NUMERIC,
  overall_band     TEXT,
  role_id          TEXT,
  role_title       TEXT,
  measurable       BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot         JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_tracking_subject
  ON growth_tracking (subject_id, created_at DESC);

-- Append-only career-movement / role-evolution event log (diffed at snapshot time).
CREATE TABLE IF NOT EXISTS career_history (
  id          BIGSERIAL PRIMARY KEY,
  subject_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  from_value  TEXT,
  to_value    TEXT,
  from_score  NUMERIC,
  to_score    NUMERIC,
  delta       NUMERIC,
  direction   TEXT,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_history_subject
  ON career_history (subject_id, detected_at DESC);
