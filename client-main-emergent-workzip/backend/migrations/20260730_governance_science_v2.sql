-- Governance Science V2 — additive; flag: governanceScienceV2.
-- Namespace: psycho_* / fairness_* / explainability_chains / model_governance_* / *_validity_models / ai_decision_audits / human_override_workflows / *_entropy_models / reliability_*
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS psychometric_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key TEXT NOT NULL UNIQUE,
  competency_key TEXT NOT NULL,
  irt_a NUMERIC(6,3),       -- discrimination
  irt_b NUMERIC(6,3),       -- difficulty
  irt_c NUMERIC(6,3),       -- guessing
  cronbach_alpha NUMERIC(4,3),
  factor_loading NUMERIC(4,3),
  sample_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fairness_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key TEXT NOT NULL,
  metric TEXT NOT NULL,           -- 'demographic_parity'|'equal_opportunity'|'disparate_impact'
  protected_group TEXT NOT NULL,
  reference_group TEXT NOT NULL,
  score NUMERIC(5,3) NOT NULL,
  threshold NUMERIC(5,3),
  status TEXT NOT NULL,           -- 'pass'|'warn'|'fail'
  details JSONB DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fe_cohort ON fairness_evaluations(cohort_key, metric);

CREATE TABLE IF NOT EXISTS explainability_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  decision_key TEXT NOT NULL,
  graph JSONB NOT NULL,           -- {nodes:[], edges:[]}
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ec_user ON explainability_chains(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS model_governance_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active'|'deprecated'|'retired'
  metadata JSONB DEFAULT '{}'::jsonb,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competency_validity_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_key TEXT NOT NULL,
  validity_type TEXT NOT NULL,     -- 'construct'|'criterion'|'content'|'convergent'|'discriminant'
  coefficient NUMERIC(5,3) NOT NULL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_decision_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_key TEXT NOT NULL,
  user_id TEXT,
  inputs JSONB NOT NULL,
  outputs JSONB NOT NULL,
  reasoning JSONB DEFAULT '{}'::jsonb,
  policy_check JSONB DEFAULT '{}'::jsonb,
  flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ada_key ON ai_decision_audits(decision_key, created_at DESC);

CREATE TABLE IF NOT EXISTS human_override_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_key TEXT NOT NULL,
  user_id TEXT NOT NULL,              -- user the override applies to
  requested_by TEXT NOT NULL,         -- reviewer
  original_value JSONB,
  override_value JSONB NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competency_entropy_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_key TEXT NOT NULL,
  entropy NUMERIC(6,4) NOT NULL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reliability_validation_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_key TEXT NOT NULL,
  reliability_type TEXT NOT NULL,      -- 'test_retest'|'internal_consistency'|'inter_rater'
  coefficient NUMERIC(5,3) NOT NULL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeds: register the heuristic models for governance visibility
INSERT INTO model_governance_registry (model_key, version, owner, status, metadata) VALUES
  ('ai_inference_v2',         '5.0.0', 'platform', 'active', '{"type":"heuristic"}'::jsonb),
  ('adaptive_orchestration_v2','4.0.0','platform', 'active', '{"type":"event-driven"}'::jsonb),
  ('predictive_v2',           '6.0.0', 'platform', 'active', '{"type":"heuristic-forecast"}'::jsonb),
  ('psychometric_v2',         '7.0.0', 'platform', 'active', '{"type":"irt-3pl-simplified"}'::jsonb),
  ('fairness_v2',             '7.0.0', 'platform', 'active', '{"type":"parity-metrics"}'::jsonb)
ON CONFLICT (model_key) DO NOTHING;
