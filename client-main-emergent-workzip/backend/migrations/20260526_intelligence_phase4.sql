-- Phase 4 — Longitudinal Intelligence + Workforce Analytics
-- READ-ONLY against onto_*, bench_*, mobility_*. New namespace: p4_*
-- Idempotent. No existing functionality is altered.

BEGIN;

-- 1) competency history — append-only longitudinal capture
CREATE TABLE IF NOT EXISTS p4_competency_history (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  session_id      TEXT,
  competency_id   TEXT NOT NULL,
  score           NUMERIC(5,2) NOT NULL,
  source          TEXT NOT NULL,                  -- capadex | benchmark | pragati | mobility | manual
  methodology_version TEXT NOT NULL DEFAULT '4.0.0',
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS p4_hist_user_comp_time ON p4_competency_history(user_id, competency_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS p4_hist_session ON p4_competency_history(session_id) WHERE session_id IS NOT NULL;

-- 2) development velocity — rate of change per competency over windows
CREATE TABLE IF NOT EXISTS p4_development_velocity (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  start_score     NUMERIC(5,2) NOT NULL,
  end_score       NUMERIC(5,2) NOT NULL,
  delta_score     NUMERIC(6,2) NOT NULL,
  velocity_pts_per_30d NUMERIC(7,3) NOT NULL,
  trend           TEXT NOT NULL,                  -- accelerating | steady | plateau | declining
  momentum_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  consistency     NUMERIC(5,2) NOT NULL DEFAULT 0,
  sample_count    INTEGER NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_vel_user_comp ON p4_development_velocity(user_id, competency_id, period_end DESC);

-- 3) growth trajectories — projected ranges (developmental, not predictive)
CREATE TABLE IF NOT EXISTS p4_growth_trajectories (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  baseline        NUMERIC(5,2) NOT NULL,
  current         NUMERIC(5,2) NOT NULL,
  projection_lower NUMERIC(5,2) NOT NULL,
  projection_upper NUMERIC(5,2) NOT NULL,
  horizon_months  INTEGER NOT NULL,
  trajectory_type TEXT NOT NULL,                  -- accelerating | steady | plateau | declining | volatile
  confidence_band TEXT NOT NULL,                  -- A | B | C | D | provisional
  observation_count INTEGER NOT NULL,
  methodology_version TEXT NOT NULL DEFAULT '4.0.0',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_traj_user_comp ON p4_growth_trajectories(user_id, competency_id, computed_at DESC);

-- 4) recommendation history — audit + outcome tracking
CREATE TABLE IF NOT EXISTS p4_recommendation_history (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  session_id      TEXT,
  category        TEXT NOT NULL,
  priority        TEXT NOT NULL,
  payload         JSONB NOT NULL,
  basis           JSONB NOT NULL DEFAULT '{}'::jsonb,
  methodology_version TEXT NOT NULL DEFAULT '4.0.0',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  outcome_signal  TEXT
);
CREATE INDEX IF NOT EXISTS p4_recs_user_time ON p4_recommendation_history(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS p4_recs_category ON p4_recommendation_history(category);

-- 5) capability maturity tracking — maturity transitions over time
CREATE TABLE IF NOT EXISTS p4_capability_maturity_tracking (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  current_level   INTEGER NOT NULL CHECK (current_level BETWEEN 1 AND 5),
  previous_level  INTEGER CHECK (previous_level BETWEEN 1 AND 5),
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stability_index NUMERIC(5,2) NOT NULL DEFAULT 0,
  consistency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  evidence        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS p4_mat_user_comp ON p4_capability_maturity_tracking(user_id, competency_id, transitioned_at DESC);

-- 6) benchmark trends — cohort distribution snapshots over time
CREATE TABLE IF NOT EXISTS p4_benchmark_trends (
  id              TEXT PRIMARY KEY,
  cohort_id       TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  period          DATE NOT NULL,
  mean_score      NUMERIC(5,2) NOT NULL,
  median_score    NUMERIC(5,2) NOT NULL,
  p25             NUMERIC(5,2) NOT NULL,
  p75             NUMERIC(5,2) NOT NULL,
  p90             NUMERIC(5,2) NOT NULL,
  sample_size     INTEGER NOT NULL,
  delta_vs_prior  NUMERIC(6,2),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, competency_id, period)
);
CREATE INDEX IF NOT EXISTS p4_trend_cohort ON p4_benchmark_trends(cohort_id, period DESC);

-- 7) workforce analytics — aggregate metrics per tenant/dimension
CREATE TABLE IF NOT EXISTS p4_workforce_analytics (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'global',
  metric_name     TEXT NOT NULL,
  metric_value    NUMERIC(12,3) NOT NULL,
  dimensions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  sample_size     INTEGER NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_wa_tenant_metric ON p4_workforce_analytics(tenant_id, metric_name, period_end DESC);

-- 8) organizational heatmaps — capability matrix cells
CREATE TABLE IF NOT EXISTS p4_organizational_heatmaps (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'global',
  layer_id        TEXT NOT NULL,
  function_id     TEXT,
  competency_id   TEXT NOT NULL,
  mean_score      NUMERIC(5,2) NOT NULL,
  sample_size     INTEGER NOT NULL,
  maturity_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  intensity       NUMERIC(5,2) NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_heat_tenant ON p4_organizational_heatmaps(tenant_id, layer_id, competency_id);

-- 9) learning progression — pathway step completion + momentum
CREATE TABLE IF NOT EXISTS p4_learning_progression (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  pathway_id      TEXT NOT NULL,
  step_id         TEXT NOT NULL,
  status          TEXT NOT NULL,                  -- not_started | in_progress | complete | skipped
  momentum_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS p4_lp_user_pathway ON p4_learning_progression(user_id, pathway_id);

-- 10) trajectory models — model metadata + parameter registry
CREATE TABLE IF NOT EXISTS p4_trajectory_models (
  id              TEXT PRIMARY KEY,
  model_type      TEXT NOT NULL,                  -- linear | exponential_decay | ewma | conservative_band
  version         TEXT NOT NULL,
  parameters      JSONB NOT NULL DEFAULT '{}'::jsonb,
  description     TEXT,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  is_current      BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS p4_models_current ON p4_trajectory_models(model_type) WHERE is_current;

-- audit log (mirrors mobility pattern)
CREATE TABLE IF NOT EXISTS p4_audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  event_type   TEXT NOT NULL,
  endpoint     TEXT,
  actor        TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p4_audit_event_time ON p4_audit_logs(event_type, created_at DESC);

COMMIT;
