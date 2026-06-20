-- PHASE 4.8 — Career Simulation Engine ("What-If Analysis").
-- Append-only persistence for simulation runs. Mirrors the lazy
-- ensureCareerSimulationSchema() in services/scenario-engine.ts.
--
-- Additive & flag-gated: this DDL is reached ONLY behind the careerSimulation
-- flag (env FF_CAREER_SIMULATION). With the flag OFF the route returns 503 and
-- this schema is never created (byte-identical legacy behaviour). There is no
-- migration runner; this file documents the canonical shape.
--
-- Append-only: rows are INSERTed once and never mutated in place (history).

CREATE TABLE IF NOT EXISTS career_simulation_runs (
  id                   BIGSERIAL PRIMARY KEY,
  subject_id           TEXT NOT NULL,
  kind                 TEXT NOT NULL,          -- 'what_if' | 'scenario_set' | 'projection'
  scenario_key         TEXT,
  roles_evaluated      INTEGER NOT NULL DEFAULT 0,
  unlocked_count       INTEGER NOT NULL DEFAULT 0,
  improved_count       INTEGER NOT NULL DEFAULT 0,
  regressed_count      INTEGER NOT NULL DEFAULT 0,
  mean_readiness_delta NUMERIC,
  max_readiness_delta  NUMERIC,
  measurable           BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot             JSONB NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_simulation_runs_subject
  ON career_simulation_runs (subject_id, created_at DESC);
