-- ═══════════════════════════════════════════════════════════════════
-- METRYXONE BIOS — ROIE: Risk & Opportunity Intelligence Engine
-- Sections 1-28 database schema
--
-- RESERVED: Tables defined here are schema-only placeholders for the
-- ROIE engine (Phase 1+). Backend routes and ingestion pipelines are
-- NOT YET IMPLEMENTED. Do not reference these tables in application
-- code until the ROIE engine milestone is delivered.
-- ═══════════════════════════════════════════════════════════════════

-- ── SECTION 1: Signal Aggregation Engine ─────────────────────────
CREATE TABLE IF NOT EXISTS roie_signal_aggregates ( -- RESERVED: no active write path
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  session_id TEXT,
  signal_type TEXT NOT NULL, -- behavioural|emotional|cognitive|executive|developmental|social|environmental|institutional|motivational|meta
  signal_name TEXT NOT NULL,
  signal_value NUMERIC(6,3),
  raw_payload JSONB DEFAULT '{}',
  entropy_score NUMERIC(5,3) DEFAULT 0,     -- behavioural entropy
  pacing_drift NUMERIC(5,3) DEFAULT 0,      -- pacing drift index
  anomaly_flag BOOLEAN DEFAULT false,
  weak_signal BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'assessment',         -- assessment|conversation|journal|clickstream|navigation
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 2: Risk Intelligence Engine ──────────────────────────
CREATE TABLE IF NOT EXISTS roie_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  overall_risk_score NUMERIC(5,2) DEFAULT 0, -- 0-100
  risk_tier TEXT DEFAULT 'low',              -- low|moderate|high|critical
  present_risks JSONB DEFAULT '[]',
  emerging_risks JSONB DEFAULT '[]',
  latent_risks JSONB DEFAULT '[]',
  cascading_risks JSONB DEFAULT '[]',
  compound_risks JSONB DEFAULT '[]',
  ecosystem_risks JSONB DEFAULT '[]',
  risk_velocity NUMERIC(5,3) DEFAULT 0,      -- rate of risk escalation
  reversibility_index NUMERIC(5,3) DEFAULT 1, -- 0=irreversible,1=fully reversible
  intervention_complexity NUMERIC(5,3) DEFAULT 0,
  confidence_score NUMERIC(5,3) DEFAULT 0.8,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 2a: Cascading Risk Chains ────────────────────────────
CREATE TABLE IF NOT EXISTS roie_cascading_risks ( -- RESERVED: no active write path
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  root_risk TEXT NOT NULL,
  chain JSONB NOT NULL DEFAULT '[]',         -- [{step, risk, severity, probability}]
  terminal_risk TEXT NOT NULL,
  chain_length INT DEFAULT 0,
  escalation_probability NUMERIC(5,3) DEFAULT 0,
  time_to_terminal_days INT,
  severity TEXT DEFAULT 'moderate',
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 2b: Compound Risk Combinations ───────────────────────
CREATE TABLE IF NOT EXISTS roie_compound_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  risk_components JSONB NOT NULL DEFAULT '[]', -- [risk1, risk2, risk3]
  interaction_type TEXT DEFAULT 'additive',    -- additive|multiplicative|nonlinear
  compound_severity NUMERIC(5,3) DEFAULT 0,
  amplification_factor NUMERIC(5,3) DEFAULT 1,
  compound_label TEXT,
  example_pattern TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 3: Behavioural Risk Engine ───────────────────────────
CREATE TABLE IF NOT EXISTS roie_behavioural_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  disengagement_score NUMERIC(5,2) DEFAULT 0,
  persistence_collapse NUMERIC(5,2) DEFAULT 0,
  impulsivity_index NUMERIC(5,2) DEFAULT 0,
  frustration_loop_count INT DEFAULT 0,
  avoidance_score NUMERIC(5,2) DEFAULT 0,
  inconsistency_index NUMERIC(5,2) DEFAULT 0,
  volatility_score NUMERIC(5,2) DEFAULT 0,
  biomarkers JSONB DEFAULT '[]',
  drift_detected BOOLEAN DEFAULT false,
  drift_direction TEXT,                       -- improving|worsening|stable
  contagion_risk NUMERIC(5,3) DEFAULT 0,
  peer_influence_exposure NUMERIC(5,3) DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 4: Cognitive Risk Engine ─────────────────────────────
CREATE TABLE IF NOT EXISTS roie_cognitive_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  overload_score NUMERIC(5,2) DEFAULT 0,
  reasoning_instability NUMERIC(5,2) DEFAULT 0,
  fragmentation_index NUMERIC(5,2) DEFAULT 0,
  executive_dysfunction NUMERIC(5,2) DEFAULT 0,
  cognitive_fatigue NUMERIC(5,2) DEFAULT 0,
  temporal_forecast JSONB DEFAULT '{}',       -- {7d, 30d, 90d} overload predictions
  recovery_eta_days INT,
  overload_escalation_prob NUMERIC(5,3) DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 5: Emotional Risk Engine ─────────────────────────────
CREATE TABLE IF NOT EXISTS roie_emotional_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  burnout_score NUMERIC(5,2) DEFAULT 0,
  hopelessness_index NUMERIC(5,2) DEFAULT 0,
  emotional_fatigue NUMERIC(5,2) DEFAULT 0,
  resilience_depletion NUMERIC(5,2) DEFAULT 0,
  emotional_suppression NUMERIC(5,2) DEFAULT 0,
  anxiety_escalation NUMERIC(5,2) DEFAULT 0,
  emotional_trajectory TEXT DEFAULT 'stable', -- declining|stable|recovering|escalating
  recovery_forecast JSONB DEFAULT '{}',
  resilience_collapse_prob NUMERIC(5,3) DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 6: Opportunity Intelligence Engine ────────────────────
CREATE TABLE IF NOT EXISTS roie_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  leadership_emergence NUMERIC(5,2) DEFAULT 0,
  employability_acceleration NUMERIC(5,2) DEFAULT 0,
  resilience_growth NUMERIC(5,2) DEFAULT 0,
  rapid_learning_potential NUMERIC(5,2) DEFAULT 0,
  innovation_potential NUMERIC(5,2) DEFAULT 0,
  specialization_readiness NUMERIC(5,2) DEFAULT 0,
  mentorship_readiness NUMERIC(5,2) DEFAULT 0,
  top_opportunity TEXT,
  opportunity_tier TEXT DEFAULT 'emerging',  -- emerging|growing|accelerating|breakthrough
  compounding_factors JSONB DEFAULT '[]',
  acceleration_loop TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 7: Human Potential Emergence Engine ───────────────────
CREATE TABLE IF NOT EXISTS roie_potential_emergence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  emergence_type TEXT NOT NULL,              -- capability|breakthrough|resilience|cognitive|leadership
  emergence_signal TEXT NOT NULL,
  confidence NUMERIC(5,3) DEFAULT 0,
  phase_transition TEXT,                     -- pre-emerging|emerging|developing|proficient|mastery
  regression_detected BOOLEAN DEFAULT false,
  latent_growth_forecast JSONB DEFAULT '{}',
  breakthrough_probability NUMERIC(5,3) DEFAULT 0,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 8: Recovery Intelligence Engine ──────────────────────
CREATE TABLE IF NOT EXISTS roie_recovery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  recovery_velocity NUMERIC(5,3) DEFAULT 0,
  emotional_stabilization NUMERIC(5,2) DEFAULT 0,
  resilience_rebuilding NUMERIC(5,2) DEFAULT 0,
  cognitive_recovery NUMERIC(5,2) DEFAULT 0,
  engagement_recovery NUMERIC(5,2) DEFAULT 0,
  recovery_momentum NUMERIC(5,3) DEFAULT 0,  -- velocity × stability × sustainability
  stability_index NUMERIC(5,3) DEFAULT 0,
  sustainability_index NUMERIC(5,3) DEFAULT 0,
  recovery_stage TEXT DEFAULT 'initiating',  -- initiating|stabilizing|rebuilding|sustaining|complete
  recovery_eta_days INT,
  adaptive_sequence JSONB DEFAULT '[]',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 9: Longitudinal Trajectory Engine ────────────────────
CREATE TABLE IF NOT EXISTS roie_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  trajectory_type TEXT NOT NULL,             -- growth|stagnation|regression|volatility|recovery|resilience_evolution
  growth_acceleration NUMERIC(5,3) DEFAULT 0,
  stagnation_duration_days INT DEFAULT 0,
  regression_severity NUMERIC(5,3) DEFAULT 0,
  volatility_index NUMERIC(5,3) DEFAULT 0,
  phase_transition TEXT,
  instability_detected BOOLEAN DEFAULT false,
  collapse_risk NUMERIC(5,3) DEFAULT 0,
  trajectory_snapshot JSONB DEFAULT '{}',    -- historical datapoints
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 10: Predictive Forecasting Engine ────────────────────
CREATE TABLE IF NOT EXISTS roie_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  forecast_horizon TEXT NOT NULL,            -- 7d|30d|90d|6m|1y
  burnout_probability NUMERIC(5,3) DEFAULT 0,
  dropout_probability NUMERIC(5,3) DEFAULT 0,
  employability_readiness NUMERIC(5,3) DEFAULT 0,
  emotional_collapse_prob NUMERIC(5,3) DEFAULT 0,
  leadership_emergence_prob NUMERIC(5,3) DEFAULT 0,
  intervention_responsiveness NUMERIC(5,3) DEFAULT 0,
  resilience_trajectory TEXT DEFAULT 'stable',
  confidence_interval JSONB DEFAULT '{}',    -- {lower, upper, mean}
  forecast_method TEXT DEFAULT 'ensemble',
  forecasted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 11: Early Warning Intelligence Engine ────────────────
CREATE TABLE IF NOT EXISTS roie_early_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  warning_type TEXT NOT NULL,               -- weak_signal|hidden_decline|silent_disengagement|latent_deterioration|black_swan|anomaly
  warning_label TEXT NOT NULL,
  severity TEXT DEFAULT 'low',              -- low|medium|high|critical
  detected_signals JSONB DEFAULT '[]',
  confidence NUMERIC(5,3) DEFAULT 0,
  recommended_action TEXT,
  acknowledged BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 12: Intervention Intelligence Engine ──────────────────
CREATE TABLE IF NOT EXISTS roie_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  intervention_type TEXT NOT NULL,          -- mentor_escalation|pacing|emotional_support|resilience_recovery|behavioural_coaching|opportunity_amplification
  trigger_reason TEXT,
  sequence_step INT DEFAULT 1,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',            -- pending|active|completed|failed|bypassed
  effectiveness_score NUMERIC(5,3),
  causal_attribution TEXT,
  reinforcement_signal TEXT,
  optimized_timing TEXT,
  outcome JSONB DEFAULT '{}',
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── SECTION 13: Human State Engine ───────────────────────────────
CREATE TABLE IF NOT EXISTS roie_human_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  emotional_state TEXT DEFAULT 'neutral',   -- positive|neutral|stressed|anxious|depleted|resilient
  cognitive_state TEXT DEFAULT 'normal',    -- optimal|normal|overloaded|fragmented|fatigued
  resilience_state TEXT DEFAULT 'moderate', -- strong|moderate|depleted|collapsed
  overload_state TEXT DEFAULT 'none',       -- none|mild|moderate|severe|critical
  motivational_state TEXT DEFAULT 'engaged',-- engaged|neutral|disengaged|resistant
  engagement_state TEXT DEFAULT 'active',   -- active|passive|withdrawn|disconnected
  stabilization_likelihood NUMERIC(5,3) DEFAULT 0.5,
  recovery_likelihood NUMERIC(5,3) DEFAULT 0.5,
  escalation_likelihood NUMERIC(5,3) DEFAULT 0.2,
  composite_state_score NUMERIC(5,2) DEFAULT 50,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 14: Semantic Risk Reasoning Engine ────────────────────
CREATE TABLE IF NOT EXISTS roie_semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  temporal_context JSONB DEFAULT '[]',      -- [{timestamp, behaviour, signal, state}]
  causal_chains JSONB DEFAULT '[]',         -- [{cause, effect, strength, temporal_lag}]
  hidden_patterns JSONB DEFAULT '[]',
  dependency_map JSONB DEFAULT '{}',        -- semantic dependency graph
  reasoning_output TEXT,
  semantic_cluster TEXT,
  memory_horizon_days INT DEFAULT 90,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 16: Socioeconomic Context Engine ─────────────────────
CREATE TABLE IF NOT EXISTS roie_socioeconomic_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID,
  financial_stress_index NUMERIC(5,2) DEFAULT 0,
  access_inequality_index NUMERIC(5,2) DEFAULT 0,
  contextual_disadvantage_score NUMERIC(5,2) DEFAULT 0,
  learning_constraint_score NUMERIC(5,2) DEFAULT 0,
  environmental_risk_adjusted BOOLEAN DEFAULT false,
  contextualized_risk_delta NUMERIC(5,3) DEFAULT 0,  -- risk adjustment
  contextualized_opportunity_delta NUMERIC(5,3) DEFAULT 0,
  socioeconomic_tier TEXT DEFAULT 'unknown', -- advantaged|average|disadvantaged|severely_constrained
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 17: Environmental Risk Engine ────────────────────────
CREATE TABLE IF NOT EXISTS roie_environmental_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  tenant_id UUID,
  scope TEXT DEFAULT 'individual',          -- individual|cohort|institution|ecosystem
  toxic_environment_score NUMERIC(5,2) DEFAULT 0,
  institutional_stress_index NUMERIC(5,2) DEFAULT 0,
  ecosystem_instability NUMERIC(5,2) DEFAULT 0,
  learning_collapse_risk NUMERIC(5,2) DEFAULT 0,
  environmental_resilience NUMERIC(5,2) DEFAULT 50,
  detected_risks JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  assessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 18: Population & Institutional Intelligence ───────────
CREATE TABLE IF NOT EXISTS roie_population_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  cohort_id TEXT,
  cohort_label TEXT,
  cohort_size INT DEFAULT 0,
  avg_risk_score NUMERIC(5,2) DEFAULT 0,
  avg_opportunity_score NUMERIC(5,2) DEFAULT 0,
  disengagement_spread NUMERIC(5,3) DEFAULT 0,  -- contagion spread
  resilience_ecosystem_score NUMERIC(5,2) DEFAULT 0,
  institutional_fragility NUMERIC(5,2) DEFAULT 0,
  workforce_readiness NUMERIC(5,2) DEFAULT 0,
  engagement_ecosystem TEXT DEFAULT 'stable',    -- thriving|stable|declining|at_risk|critical
  regional_intelligence JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 19: Trust & Confidence Engine ────────────────────────
CREATE TABLE IF NOT EXISTS roie_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  tenant_id UUID,
  scope TEXT DEFAULT 'user',                -- user|cohort|institution|system
  prediction_confidence NUMERIC(5,3) DEFAULT 0.8,
  intervention_confidence NUMERIC(5,3) DEFAULT 0.8,
  risk_confidence NUMERIC(5,3) DEFAULT 0.8,
  opportunity_confidence NUMERIC(5,3) DEFAULT 0.8,
  uncertainty_propagation JSONB DEFAULT '{}',
  contradictory_signals INT DEFAULT 0,
  overall_trust NUMERIC(5,3) DEFAULT 0.8,
  trust_trend TEXT DEFAULT 'stable',        -- improving|stable|degrading
  assessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 20: Fairness & Ethical Intelligence ───────────────────
CREATE TABLE IF NOT EXISTS roie_fairness_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  audit_type TEXT NOT NULL,                 -- demographic|intervention|predictive|opportunity|emotional_safety|child_protection
  scope TEXT DEFAULT 'global',
  passed BOOLEAN DEFAULT true,
  bias_detected JSONB DEFAULT '[]',
  fairness_score NUMERIC(5,3) DEFAULT 1.0,
  dignity_violations INT DEFAULT 0,
  child_protection_flags INT DEFAULT 0,
  ethical_escalations JSONB DEFAULT '[]',
  remediation_required BOOLEAN DEFAULT false,
  auto_remediated BOOLEAN DEFAULT false,
  audited_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 21: Multi-Agent State ────────────────────────────────
CREATE TABLE IF NOT EXISTS roie_agent_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,                 -- risk|opportunity|resilience|intervention|governance|explainability|recovery
  tenant_id UUID,
  status TEXT DEFAULT 'idle',              -- idle|processing|completed|failed
  last_reasoning JSONB DEFAULT '{}',
  shared_memory JSONB DEFAULT '{}',
  last_invoked_at TIMESTAMPTZ DEFAULT NOW(),
  invocation_count INT DEFAULT 0,
  avg_latency_ms NUMERIC DEFAULT 0
);

-- ── SECTION 22: Recursive Self-Evolving Intelligence ─────────────
CREATE TABLE IF NOT EXISTS roie_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  evolution_type TEXT NOT NULL,             -- recalibration|forecast_correction|intervention_learning|resilience_update|prediction_failure
  trigger_event TEXT,
  before_state JSONB DEFAULT '{}',
  after_state JSONB DEFAULT '{}',
  improvement_delta NUMERIC(5,3) DEFAULT 0,
  autonomous BOOLEAN DEFAULT true,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 24: Event-Driven Orchestration ───────────────────────
CREATE TABLE IF NOT EXISTS roie_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,                 -- SIGNAL_CAPTURED|RISK_DETECTED|OPPORTUNITY_DETECTED|RECOVERY_DETECTED|TRAJECTORY_UPDATED|INTERVENTION_TRIGGERED|DRIFT_DETECTED
  user_id TEXT,
  tenant_id UUID,
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  processing_latency_ms NUMERIC,
  emitted_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ── SECTION 25: Observability ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS roie_observability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  metric_type TEXT NOT NULL,               -- risk_escalation|opportunity_acceleration|trust_degradation|intervention|anomaly
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 26: Governance & Audit ───────────────────────────────
CREATE TABLE IF NOT EXISTS roie_governance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT,
  tenant_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  rbac_role TEXT,
  decision TEXT DEFAULT 'allow',           -- allow|deny|escalate
  reason TEXT,
  ip_address TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_roie_signals_user ON roie_signal_aggregates(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_risk_user ON roie_risk_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_cascade_user ON roie_cascading_risks(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_compound_user ON roie_compound_risks(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_beh_user ON roie_behavioural_risks(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_cog_user ON roie_cognitive_risks(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_emo_user ON roie_emotional_risks(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_opp_user ON roie_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_potential_user ON roie_potential_emergence(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_recovery_user ON roie_recovery_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_traj_user ON roie_trajectories(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_forecast_user ON roie_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_warn_user ON roie_early_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_interv_user ON roie_interventions(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_state_user ON roie_human_states(user_id);
CREATE INDEX IF NOT EXISTS idx_roie_events_type ON roie_events(event_type);

-- ── Seed agent states ─────────────────────────────────────────────
INSERT INTO roie_agent_states (agent_name, status, invocation_count)
VALUES
  ('risk', 'idle', 0),
  ('opportunity', 'idle', 0),
  ('resilience', 'idle', 0),
  ('intervention', 'idle', 0),
  ('governance', 'idle', 0),
  ('explainability', 'idle', 0),
  ('recovery', 'idle', 0)
ON CONFLICT DO NOTHING;
