-- CAPADEX Simulation & Validation Environment (0C).
-- Canonical schema for persisted simulation runs. Mirrors the lazy
-- ensureSimulationSchema() bootstrap in routes/capadex-simulation.ts (no
-- migration runner in this project — both must stay in sync).

CREATE TABLE IF NOT EXISTS capadex_simulation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  profile_count   INTEGER     NOT NULL DEFAULT 0,
  sample_size     INTEGER     NOT NULL DEFAULT 0,
  seed            BIGINT      NOT NULL DEFAULT 0,
  duration_ms     INTEGER     NOT NULL DEFAULT 0,
  verdict         TEXT        NOT NULL DEFAULT 'pass',
  metrics         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  conditions      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  per_persona     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  failed_conditions JSONB     NOT NULL DEFAULT '[]'::jsonb,
  trigger_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_capadex_simulation_runs_created
  ON capadex_simulation_runs (created_at DESC);
