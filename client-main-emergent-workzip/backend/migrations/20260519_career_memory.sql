-- Career Memory: Persistent transformation intelligence storage
-- Phase 3 — Transformation Intelligence Layer

-- Competency snapshots (point-in-time profile captures)
CREATE TABLE IF NOT EXISTS career_memory_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  snapshot_label   TEXT,
  competency_levels JSONB NOT NULL DEFAULT '{}',
  ei_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  percentile       NUMERIC(5,2),
  source           TEXT DEFAULT 'system',
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_snapshots_user_id     ON career_memory_snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_career_snapshots_captured_at ON career_memory_snapshots (captured_at DESC);

-- Completed learning interventions with actual outcomes
CREATE TABLE IF NOT EXISTS career_interventions_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  competency_id    TEXT NOT NULL,
  competency_label TEXT NOT NULL,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'course',
  ei_lift_actual   NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_spent      NUMERIC(6,2) NOT NULL DEFAULT 0,
  rating           SMALLINT CHECK (rating BETWEEN 1 AND 5),
  note             TEXT,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_interventions_user_id      ON career_interventions_log (user_id);
CREATE INDEX IF NOT EXISTS idx_career_interventions_competency_id ON career_interventions_log (competency_id);
CREATE INDEX IF NOT EXISTS idx_career_interventions_completed_at  ON career_interventions_log (completed_at DESC);

-- Career trajectory history (predicted vs actual role progression)
CREATE TABLE IF NOT EXISTS career_trajectory_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  snapshot_id       UUID REFERENCES career_memory_snapshots(id) ON DELETE SET NULL,
  predicted_role_id TEXT,
  predicted_role    TEXT,
  actual_role       TEXT,
  confidence        NUMERIC(5,2),
  ei_at_prediction  NUMERIC(5,2),
  horizon_months    SMALLINT,
  predicted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at       TIMESTAMPTZ,
  accurate          BOOLEAN,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_trajectory_user_id ON career_trajectory_history (user_id);

-- Benchmark evolution (EI + percentile over time vs peer)
CREATE TABLE IF NOT EXISTS career_benchmarks_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  snapshot_id      UUID REFERENCES career_memory_snapshots(id) ON DELETE SET NULL,
  ei_score         NUMERIC(5,2) NOT NULL,
  percentile       NUMERIC(5,2),
  peer_median_ei   NUMERIC(5,2),
  peer_p75_ei      NUMERIC(5,2),
  delta_from_peer  NUMERIC(5,2),
  period_label     TEXT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_benchmarks_user_id    ON career_benchmarks_history (user_id);
CREATE INDEX IF NOT EXISTS idx_career_benchmarks_recorded_at ON career_benchmarks_history (recorded_at DESC);

-- Detected growth patterns per user
CREATE TABLE IF NOT EXISTS career_growth_patterns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  pattern_id       TEXT NOT NULL,
  pattern_label    TEXT NOT NULL,
  frequency        SMALLINT NOT NULL DEFAULT 1,
  strength         TEXT NOT NULL DEFAULT 'moderate',
  first_detected   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_confirmed   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_career_patterns_user_id ON career_growth_patterns (user_id);
