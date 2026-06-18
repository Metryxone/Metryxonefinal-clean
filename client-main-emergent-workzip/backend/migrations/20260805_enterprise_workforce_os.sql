-- Enterprise Workforce OS (Phase 8) — additive; flag: enterpriseWorkforceOSV2.
-- Renamed from spec ('workforce_os_v2.sql' would collide with 20260715_workforce_os_v2.sql).
-- Namespace: enterprise_* / organizational_readiness_* / executive_* / tenant_capability_* / workforce_observability_* / intelligence_performance_* / orchestration_performance_* / ai_runtime_* / rollout_feature_flags.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS enterprise_capability_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  graph JSONB NOT NULL,                 -- {nodes:[], edges:[]}
  node_count INTEGER,
  edge_count INTEGER,
  built_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ecg_tenant ON enterprise_capability_graphs(tenant_id, built_at DESC);

CREATE TABLE IF NOT EXISTS organizational_readiness_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  readiness_score NUMERIC(5,2) NOT NULL,
  drivers JSONB DEFAULT '[]'::jsonb,
  bottlenecks JSONB DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS executive_decision_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  decision_key TEXT NOT NULL,
  options JSONB NOT NULL,
  recommended JSONB,
  scores JSONB,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_capability_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  competency_key TEXT NOT NULL,
  mean_level NUMERIC(5,2),
  median_level NUMERIC(5,2),
  p25 NUMERIC(5,2),
  p75 NUMERIC(5,2),
  population_size INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tcp_tenant ON tenant_capability_profiles(tenant_id, competency_key);

CREATE TABLE IF NOT EXISTS workforce_observability_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  metric TEXT NOT NULL,
  value NUMERIC(14,4) NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wol_component ON workforce_observability_logs(component, recorded_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  latency_ms NUMERIC(10,2),
  throughput_per_min NUMERIC(10,2),
  error_rate NUMERIC(5,3),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orchestration_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  step TEXT NOT NULL,
  duration_ms NUMERIC(10,2),
  status TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opl_run ON orchestration_performance_logs(run_id);

CREATE TABLE IF NOT EXISTS ai_runtime_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  error_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS rollout_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  cohort TEXT NOT NULL DEFAULT 'all',
  percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: register the V2 flags currently in code so rollout config is queryable
INSERT INTO rollout_feature_flags (flag_key, cohort, percentage, enabled, notes) VALUES
  ('aiInferenceV2',           'all', 100, true,  'Phase 5 — heuristic competency inference'),
  ('adaptiveOrchestrationV2', 'all', 100, true,  'Phase 4 — event bus + orchestration'),
  ('predictiveIntelligenceV2','all', 100, true,  'Phase 6 — forecasting + risk'),
  ('governanceScienceV2',     'all', 100, true,  'Phase 7 — psychometrics + fairness + explainability'),
  ('enterpriseWorkforceOSV2', 'all', 100, true,  'Phase 8 — enterprise OS')
ON CONFLICT (flag_key) DO NOTHING;
