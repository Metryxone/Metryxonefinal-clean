-- Predictive Intelligence V2 — additive; flag: predictiveIntelligenceV2.
-- Namespace: predictive_* / *_forecasts / *_predictions / *_models.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS competency_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  competency_key TEXT NOT NULL,
  horizon_months INTEGER NOT NULL,
  predicted_level NUMERIC(5,2) NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  method TEXT NOT NULL DEFAULT 'linear_extrapolation',
  inputs JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_user ON competency_forecasts(user_id, competency_key, horizon_months);

CREATE TABLE IF NOT EXISTS readiness_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  probability NUMERIC(4,3) NOT NULL,
  eta_months INTEGER,
  drivers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rp_user ON readiness_predictions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workforce_capability_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  competency_key TEXT NOT NULL,
  horizon_months INTEGER NOT NULL,
  projected_mean NUMERIC(5,2),
  projected_gap NUMERIC(5,2),
  cohort_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS burnout_risk_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  risk_score NUMERIC(5,2) NOT NULL,
  risk_band TEXT NOT NULL,
  drivers JSONB DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brm_user ON burnout_risk_models(user_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS skill_decay_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  competency_key TEXT NOT NULL,
  decay_rate_per_month NUMERIC(5,4) NOT NULL,
  last_practised_at TIMESTAMPTZ,
  projected_loss_3mo NUMERIC(5,2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_proximity_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  current_stage TEXT,
  next_stage TEXT,
  proximity NUMERIC(4,3) NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ppm_user ON promotion_proximity_models(user_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS leadership_emergence_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  emergence_score NUMERIC(5,2) NOT NULL,
  signals JSONB DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_forecast_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key TEXT NOT NULL,
  inputs JSONB NOT NULL,
  outputs JSONB NOT NULL,
  ran_by TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sfh_scenario ON simulation_forecast_history(scenario_key, ran_at DESC);

CREATE TABLE IF NOT EXISTS organizational_capability_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  competency_key TEXT NOT NULL,
  maturity_score NUMERIC(5,2),
  bench_strength INTEGER,
  risk_band TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
