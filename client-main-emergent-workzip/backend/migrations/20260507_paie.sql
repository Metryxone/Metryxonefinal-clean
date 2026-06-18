-- METRYXONE BIOS — PAIE (Predictive AI Engine)
-- Migration: 20260507_paie.sql
--
-- RESERVED: Tables defined here are schema-only placeholders for the
-- PAIE engine (Phase 1+). Backend routes and ingestion pipelines are
-- NOT YET IMPLEMENTED. Do not reference these tables in application
-- code until the PAIE engine milestone is delivered.

-- Section 1: Signal Aggregation
CREATE TABLE IF NOT EXISTS paie_signals ( -- RESERVED: no active write path
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- explicit|implicit|behavioural|emotional|cognitive|executive_function|developmental|social|environmental|institutional|meta
  signal_category TEXT,
  signal_payload JSONB DEFAULT '{}',
  source TEXT, -- assessment|clickstream|journal|conversation|interaction
  pacing_drift FLOAT DEFAULT 0,
  hesitation_score FLOAT DEFAULT 0,
  retry_count INT DEFAULT 0,
  entropy_score FLOAT DEFAULT 0,
  anomaly_flag BOOLEAN DEFAULT FALSE,
  confidence FLOAT DEFAULT 0.8,
  contextual_weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 2: Temporal Intelligence
CREATE TABLE IF NOT EXISTS paie_temporal_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  forecast_window TEXT NOT NULL, -- realtime|7d|30d|90d|6m|1y|multi-year
  dimension TEXT NOT NULL, -- behavioural|cognitive|emotional|resilience|engagement
  trend_direction TEXT, -- accelerating|decelerating|stable|volatile|collapsing
  trend_acceleration FLOAT DEFAULT 0,
  volatility_score FLOAT DEFAULT 0,
  silent_deterioration_risk FLOAT DEFAULT 0,
  hidden_transition_probability FLOAT DEFAULT 0,
  predicted_value FLOAT,
  lower_bound FLOAT,
  upper_bound FLOAT,
  confidence FLOAT DEFAULT 0.75,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 3: Behavioural Forecasting
CREATE TABLE IF NOT EXISTS paie_behavioural_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  disengagement_probability FLOAT DEFAULT 0,
  persistence_collapse_risk FLOAT DEFAULT 0,
  motivational_collapse_risk FLOAT DEFAULT 0,
  frustration_escalation_risk FLOAT DEFAULT 0,
  behavioural_volatility_score FLOAT DEFAULT 0,
  contagion_susceptibility FLOAT DEFAULT 0,
  persistence_biomarker FLOAT DEFAULT 0,
  overload_biomarker FLOAT DEFAULT 0,
  resilience_biomarker FLOAT DEFAULT 0,
  disengagement_biomarker FLOAT DEFAULT 0,
  impulsivity_biomarker FLOAT DEFAULT 0,
  forecast_window TEXT DEFAULT '30d',
  dominant_risk TEXT,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 4: Cognitive Forecasting
CREATE TABLE IF NOT EXISTS paie_cognitive_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  overload_probability FLOAT DEFAULT 0,
  executive_dysfunction_risk FLOAT DEFAULT 0,
  reasoning_instability_risk FLOAT DEFAULT 0,
  attention_fragmentation_risk FLOAT DEFAULT 0,
  cognitive_fatigue_score FLOAT DEFAULT 0,
  overload_escalation_probability FLOAT DEFAULT 0,
  recovery_probability FLOAT DEFAULT 0,
  stabilization_forecast FLOAT DEFAULT 0,
  cognitive_trajectory TEXT, -- overloaded|stable|recovering|accelerating
  forecast_window TEXT DEFAULT '30d',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 5: Emotional Forecasting
CREATE TABLE IF NOT EXISTS paie_emotional_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  burnout_probability FLOAT DEFAULT 0,
  emotional_fatigue_score FLOAT DEFAULT 0,
  anxiety_escalation_risk FLOAT DEFAULT 0,
  hopelessness_probability FLOAT DEFAULT 0,
  resilience_depletion_risk FLOAT DEFAULT 0,
  emotional_collapse_risk FLOAT DEFAULT 0,
  resilience_index FLOAT DEFAULT 0.5,
  engagement_trajectory FLOAT DEFAULT 0.5,
  emotional_trajectory TEXT, -- escalating|stable|recovering|collapsing
  burnout_escalation_flag BOOLEAN DEFAULT FALSE,
  forecast_window TEXT DEFAULT '30d',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 6: Opportunity Forecasting
CREATE TABLE IF NOT EXISTS paie_opportunity_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  leadership_emergence_probability FLOAT DEFAULT 0,
  employability_acceleration FLOAT DEFAULT 0,
  resilience_acceleration FLOAT DEFAULT 0,
  innovation_potential FLOAT DEFAULT 0,
  specialization_readiness FLOAT DEFAULT 0,
  learning_acceleration FLOAT DEFAULT 0,
  opportunity_cascade JSONB DEFAULT '{}',
  top_opportunity TEXT,
  opportunity_tier TEXT, -- high|medium|emerging|latent
  forecast_window TEXT DEFAULT '90d',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 7: Human Potential Emergence
CREATE TABLE IF NOT EXISTS paie_potential_emergence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  hidden_capability_score FLOAT DEFAULT 0,
  breakthrough_probability FLOAT DEFAULT 0,
  resilience_transformation_score FLOAT DEFAULT 0,
  leadership_transformation_probability FLOAT DEFAULT 0,
  developmental_acceleration_rate FLOAT DEFAULT 0,
  latent_growth_score FLOAT DEFAULT 0,
  developmental_phase TEXT, -- forming|emerging|developing|proficient|advanced
  phase_transition_probability FLOAT DEFAULT 0,
  detected_capabilities JSONB DEFAULT '[]',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 8: Trajectory Intelligence
CREATE TABLE IF NOT EXISTS paie_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  trajectory_type TEXT NOT NULL, -- behavioural|emotional|cognitive|resilience|employability
  trend_direction TEXT NOT NULL, -- accelerating|decelerating|stagnant|volatile|collapsing|recovering
  magnitude FLOAT DEFAULT 0,
  confidence FLOAT DEFAULT 0.75,
  forecast_window TEXT DEFAULT '90d',
  stagnation_flag BOOLEAN DEFAULT FALSE,
  collapse_risk FLOAT DEFAULT 0,
  recovery_probability FLOAT DEFAULT 0,
  snapshot_data JSONB DEFAULT '{}',
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Section 9: Counterfactual Prediction
CREATE TABLE IF NOT EXISTS paie_counterfactuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL, -- delay_intervention|optimize_pacing|add_mentorship|reduce_overload|custom
  scenario_params JSONB DEFAULT '{}',
  baseline_outcome JSONB DEFAULT '{}',
  simulated_outcome JSONB DEFAULT '{}',
  delta_score FLOAT DEFAULT 0,
  delta_risk FLOAT DEFAULT 0,
  delta_opportunity FLOAT DEFAULT 0,
  recommendation TEXT,
  confidence FLOAT DEFAULT 0.7,
  simulated_at TIMESTAMP DEFAULT NOW()
);

-- Section 10: Intervention Prediction
CREATE TABLE IF NOT EXISTS paie_intervention_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  intervention_type TEXT NOT NULL,
  success_probability FLOAT DEFAULT 0,
  recovery_speed_estimate FLOAT DEFAULT 0,
  resilience_improvement FLOAT DEFAULT 0,
  stabilization_probability FLOAT DEFAULT 0,
  fatigue_risk FLOAT DEFAULT 0,
  optimal_sequence JSONB DEFAULT '[]',
  reinforcement_score FLOAT DEFAULT 0,
  adaptive_recommendation TEXT,
  status TEXT DEFAULT 'pending', -- pending|active|completed|abandoned
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 11: Black Swan Prediction
CREATE TABLE IF NOT EXISTS paie_black_swan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- hidden_collapse|rare_behavioural_failure|silent_disengagement|sudden_emotional_deterioration|resilience_collapse
  probability FLOAT DEFAULT 0,
  severity TEXT DEFAULT 'medium', -- critical|high|medium|low
  anomaly_score FLOAT DEFAULT 0,
  silent_collapse_flag BOOLEAN DEFAULT FALSE,
  low_frequency_risk FLOAT DEFAULT 0,
  detection_signals JSONB DEFAULT '[]',
  intervention_urgency TEXT DEFAULT 'monitor', -- immediate|urgent|monitor|watch
  resolved BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Section 12: Early Warning Intelligence
CREATE TABLE IF NOT EXISTS paie_early_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  warning_type TEXT NOT NULL, -- weak_signal|latent_deterioration|hidden_instability|silent_decline
  signal_strength FLOAT DEFAULT 0, -- 0-1
  amplification_factor FLOAT DEFAULT 1.0,
  silent_collapse_probability FLOAT DEFAULT 0,
  latent_risk_score FLOAT DEFAULT 0,
  contributing_signals JSONB DEFAULT '[]',
  recommended_action TEXT,
  urgency TEXT DEFAULT 'watch', -- critical|urgent|watch|monitor
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 13: Trust & Confidence Forecasting
CREATE TABLE IF NOT EXISTS paie_trust_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  overall_confidence FLOAT DEFAULT 0.8,
  prediction_confidence FLOAT DEFAULT 0.8,
  reliability_score FLOAT DEFAULT 0.8,
  uncertainty_level FLOAT DEFAULT 0.2,
  trust_score FLOAT DEFAULT 0.8,
  sparse_data_flag BOOLEAN DEFAULT FALSE,
  contradictory_signals_flag BOOLEAN DEFAULT FALSE,
  behavioural_volatility_flag BOOLEAN DEFAULT FALSE,
  confidence_trend TEXT DEFAULT 'stable', -- rising|stable|declining|degrading
  trust_degradation_flag BOOLEAN DEFAULT FALSE,
  last_computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 14: Semantic Causal Intelligence
CREATE TABLE IF NOT EXISTS paie_causal_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  chain_name TEXT NOT NULL,
  cause TEXT NOT NULL,
  effect TEXT NOT NULL,
  causal_strength FLOAT DEFAULT 0.5,
  temporal_lag_days INT DEFAULT 0,
  hidden_pattern_flag BOOLEAN DEFAULT FALSE,
  recursive_depth INT DEFAULT 1,
  chain_steps JSONB DEFAULT '[]',
  confidence FLOAT DEFAULT 0.7,
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Section 15: Knowledge Graph
CREATE TABLE IF NOT EXISTS paie_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  node_type TEXT NOT NULL, -- concern|behaviour|prediction|opportunity|intervention|outcome
  node_key TEXT NOT NULL,
  label TEXT,
  properties JSONB DEFAULT '{}',
  embedding JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paie_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  source_id UUID REFERENCES paie_graph_nodes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES paie_graph_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- causes|predicts|enables|blocks|amplifies|inhibits
  weight FLOAT DEFAULT 1.0,
  temporal_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 16: Population & Ecosystem Forecasting
CREATE TABLE IF NOT EXISTS paie_population_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  cohort_id TEXT,
  cohort_type TEXT, -- school|campus|enterprise|region|workforce
  cohort_size INT DEFAULT 0,
  avg_behavioural_score FLOAT DEFAULT 0,
  avg_emotional_score FLOAT DEFAULT 0,
  avg_cognitive_score FLOAT DEFAULT 0,
  engagement_ecosystem_score FLOAT DEFAULT 0,
  workforce_burnout_probability FLOAT DEFAULT 0,
  institutional_burnout_flag BOOLEAN DEFAULT FALSE,
  ecosystem_fragility_score FLOAT DEFAULT 0,
  cohort_trajectory TEXT, -- growing|stable|declining|at_risk|collapsing
  regional_forecast JSONB DEFAULT '{}',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 17: Institutional Collapse Forecasting
CREATE TABLE IF NOT EXISTS paie_institutional_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  institution_id TEXT,
  institution_name TEXT,
  disengagement_probability FLOAT DEFAULT 0,
  cohort_burnout_risk FLOAT DEFAULT 0,
  resilience_ecosystem_collapse_risk FLOAT DEFAULT 0,
  engagement_degradation_score FLOAT DEFAULT 0,
  stabilization_probability FLOAT DEFAULT 0.5,
  collapse_timeline_days INT,
  warning_flags JSONB DEFAULT '[]',
  intervention_recommendations JSONB DEFAULT '[]',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 18: Socioeconomic Predictive Adaptation
CREATE TABLE IF NOT EXISTS paie_socioeconomic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  financial_stress_index FLOAT DEFAULT 0,
  contextual_inequality_score FLOAT DEFAULT 0,
  environmental_learning_barriers JSONB DEFAULT '[]',
  opportunity_deprivation_score FLOAT DEFAULT 0,
  socioeconomic_tier TEXT DEFAULT 'middle', -- high|upper_middle|middle|lower_middle|low
  contextualized_forecast_adjustment FLOAT DEFAULT 1.0,
  socioeconomic_aware_risk_delta FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 19: Synthetic Future Simulation
CREATE TABLE IF NOT EXISTS paie_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  simulation_name TEXT NOT NULL,
  simulation_type TEXT NOT NULL, -- resilience_collapse|burnout_escalation|intervention_outcomes|cohort_instability|behavioural_contagion|stress_test|fairness_validation|custom
  input_params JSONB DEFAULT '{}',
  simulated_population_size INT DEFAULT 100,
  scenario_outcomes JSONB DEFAULT '{}',
  risk_distribution JSONB DEFAULT '{}',
  opportunity_distribution JSONB DEFAULT '{}',
  intervention_effectiveness JSONB DEFAULT '{}',
  forecast_robustness_score FLOAT DEFAULT 0.7,
  fairness_validation_score FLOAT DEFAULT 0.8,
  status TEXT DEFAULT 'pending', -- pending|running|completed|failed
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Section 20: Multi-Agent Predictive Orchestration
CREATE TABLE IF NOT EXISTS paie_agents ( -- RESERVED: no active write path
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  agent_name TEXT NOT NULL, -- risk|opportunity|resilience|intervention|governance|explainability|recovery|meta|temporal|behavioural|cognitive|emotional
  status TEXT DEFAULT 'idle', -- idle|running|completed|error
  last_reasoning JSONB DEFAULT '{}',
  shared_memory JSONB DEFAULT '{}',
  confidence FLOAT DEFAULT 0.8,
  last_invoked_at TIMESTAMP DEFAULT NOW(),
  invocation_count INT DEFAULT 0,
  avg_latency_ms FLOAT DEFAULT 0
);

-- Section 21: Recursive Self-Evolving AI
CREATE TABLE IF NOT EXISTS paie_model_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  model_name TEXT NOT NULL,
  version INT DEFAULT 1,
  prediction_failure_count INT DEFAULT 0,
  recalibration_trigger TEXT, -- prediction_failure|behavioural_drift|intervention_outcome|forecasting_drift|manual
  parameter_delta JSONB DEFAULT '{}',
  performance_before FLOAT DEFAULT 0,
  performance_after FLOAT DEFAULT 0,
  autonomous_flag BOOLEAN DEFAULT TRUE,
  evolved_at TIMESTAMP DEFAULT NOW()
);

-- Section 22: Meta-Prediction Intelligence
CREATE TABLE IF NOT EXISTS paie_meta_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  model_name TEXT NOT NULL,
  drift_probability FLOAT DEFAULT 0,
  degradation_risk FLOAT DEFAULT 0,
  calibration_instability FLOAT DEFAULT 0,
  trust_deterioration_risk FLOAT DEFAULT 0,
  self_healing_triggered BOOLEAN DEFAULT FALSE,
  correction_applied JSONB DEFAULT '{}',
  meta_confidence FLOAT DEFAULT 0.8,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 23: Fairness & Ethical AI
CREATE TABLE IF NOT EXISTS paie_fairness_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  audit_type TEXT NOT NULL, -- predictive|intervention|opportunity|demographic|emotional_safety|child_protection|constitutional
  dimension TEXT,
  fairness_score FLOAT DEFAULT 1.0,
  bias_detected BOOLEAN DEFAULT FALSE,
  bias_type TEXT,
  bias_severity TEXT DEFAULT 'none', -- critical|high|medium|low|none
  affected_group TEXT,
  constitutional_violation BOOLEAN DEFAULT FALSE,
  child_protection_flag BOOLEAN DEFAULT FALSE,
  remediation_applied TEXT,
  ethical_escalation_required BOOLEAN DEFAULT FALSE,
  audited_at TIMESTAMP DEFAULT NOW()
);

-- Section 25: Event-Driven Orchestration
CREATE TABLE IF NOT EXISTS paie_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT,
  event_type TEXT NOT NULL, -- SIGNAL_CAPTURED|PREDICTION_GENERATED|TRAJECTORY_UPDATED|OPPORTUNITY_DETECTED|INTERVENTION_TRIGGERED|DRIFT_DETECTED|TRUST_DEGRADED|BLACK_SWAN_DETECTED|WARNING_RAISED
  event_payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  downstream_triggered JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 26: Observability & Operations
CREATE TABLE IF NOT EXISTS paie_observability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  metric_name TEXT NOT NULL,
  metric_type TEXT DEFAULT 'gauge', -- gauge|counter|histogram
  metric_value FLOAT NOT NULL,
  labels JSONB DEFAULT '{}',
  anomaly_flag BOOLEAN DEFAULT FALSE,
  drift_flag BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Seed 12 PAIE agents
INSERT INTO paie_agents (agent_name, status) VALUES
  ('risk', 'idle'),
  ('opportunity', 'idle'),
  ('resilience', 'idle'),
  ('intervention', 'idle'),
  ('governance', 'idle'),
  ('explainability', 'idle'),
  ('recovery', 'idle'),
  ('meta', 'idle'),
  ('temporal', 'idle'),
  ('behavioural', 'idle'),
  ('cognitive', 'idle'),
  ('emotional', 'idle')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_paie_signals_user ON paie_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_paie_signals_type ON paie_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_paie_temporal_user ON paie_temporal_forecasts(user_id, forecast_window);
CREATE INDEX IF NOT EXISTS idx_paie_beh_user ON paie_behavioural_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_paie_cog_user ON paie_cognitive_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_paie_emo_user ON paie_emotional_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_paie_opp_user ON paie_opportunity_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_paie_traj_user ON paie_trajectories(user_id, trajectory_type);
CREATE INDEX IF NOT EXISTS idx_paie_warnings_user ON paie_early_warnings(user_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_paie_events_type ON paie_events(event_type, processed);
CREATE INDEX IF NOT EXISTS idx_paie_graph_nodes_type ON paie_graph_nodes(node_type, node_key);
