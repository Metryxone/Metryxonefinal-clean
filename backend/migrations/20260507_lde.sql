-- METRYXONE BIOS — LDE (Longitudinal Development Engine)
-- Migration: 20260507_lde.sql

-- Section 1: Event Sourcing (append-only)
CREATE TABLE IF NOT EXISTS lde_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- SIGNAL_CAPTURED|TRAJECTORY_UPDATED|INTERVENTION_COMPLETED|DRIFT_DETECTED|BREAKTHROUGH_DETECTED|IDENTITY_SHIFT|FRACTURE_DETECTED|HIDDEN_TRANSFORMATION|TRUST_CHANGE|MOMENTUM_UPDATE
  event_payload JSONB DEFAULT '{}',
  source TEXT DEFAULT 'system',
  processed BOOLEAN DEFAULT FALSE,
  downstream_triggered JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 2: Feature Store (temporal feature vectors)
CREATE TABLE IF NOT EXISTS lde_feature_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  feature_version INT DEFAULT 1,
  behavioural_features JSONB DEFAULT '{}',
  resilience_features JSONB DEFAULT '{}',
  emotional_features JSONB DEFAULT '{}',
  developmental_features JSONB DEFAULT '{}',
  cognitive_features JSONB DEFAULT '{}',
  biomarkers JSONB DEFAULT '{}',
  entropy_score FLOAT DEFAULT 0,
  anomaly_flag BOOLEAN DEFAULT FALSE,
  coverage_pct FLOAT DEFAULT 0,
  computed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Section 3: Embedding Engine
CREATE TABLE IF NOT EXISTS lde_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  embedding_type TEXT NOT NULL, -- behavioural|emotional|resilience|developmental|cognitive|composite
  vector JSONB DEFAULT '[]',
  dimension_count INT DEFAULT 32,
  source_scores JSONB DEFAULT '{}',
  similarity_cache JSONB DEFAULT '{}',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 4: Signal Aggregation Log
CREATE TABLE IF NOT EXISTS lde_signal_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  raw_signal_count INT DEFAULT 0,
  amplified_signals JSONB DEFAULT '[]',
  entropy_score FLOAT DEFAULT 0,
  anomaly_count INT DEFAULT 0,
  anomaly_details JSONB DEFAULT '[]',
  weak_signal_amplification_factor FLOAT DEFAULT 1.0,
  aggregated_at TIMESTAMP DEFAULT NOW()
);

-- Section 5: Digital Twin
CREATE TABLE IF NOT EXISTS lde_digital_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  twin_state JSONB DEFAULT '{}',
  last_simulation_results JSONB DEFAULT '{}',
  projected_delta JSONB DEFAULT '{}',
  simulation_count INT DEFAULT 0,
  accuracy_score FLOAT DEFAULT 0.8,
  last_simulated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Section 6: Developmental Ontology
CREATE TABLE IF NOT EXISTS lde_ontology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  node_type TEXT NOT NULL, -- state|hierarchy|taxonomy|ontology|construct|capability|stage
  node_key TEXT NOT NULL UNIQUE,
  label TEXT,
  description TEXT,
  properties JSONB DEFAULT '{}',
  depth_level INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lde_ontology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  relationship TEXT NOT NULL, -- is_a|has_a|leads_to|enables|blocks|transitions_to|prerequisite
  weight FLOAT DEFAULT 1.0,
  bidirectional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 7: Multi-Dimension Timeline
CREATE TABLE IF NOT EXISTS lde_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  checkpoint_date DATE DEFAULT CURRENT_DATE,
  behavioural_score FLOAT,
  emotional_score FLOAT,
  resilience_score FLOAT,
  employability_score FLOAT,
  leadership_score FLOAT,
  intervention_count INT DEFAULT 0,
  milestone_flags JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 9: Identity Evolution
CREATE TABLE IF NOT EXISTS lde_identity_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  checkpoint_date DATE DEFAULT CURRENT_DATE,
  confidence_score FLOAT DEFAULT 0.5,
  self_efficacy_score FLOAT DEFAULT 0.5,
  aspiration_score FLOAT DEFAULT 0.5,
  motivation_score FLOAT DEFAULT 0.5,
  identity_coherence FLOAT DEFAULT 0.5,
  breakthrough_flag BOOLEAN DEFAULT FALSE,
  shift_detected BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 10: Narrative Engine
CREATE TABLE IF NOT EXISTS lde_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  narrative_type TEXT DEFAULT 'developmental', -- developmental|intervention|breakthrough|trajectory|summary
  title TEXT,
  content TEXT,
  tone TEXT DEFAULT 'supportive', -- supportive|analytical|urgent|celebratory
  key_themes JSONB DEFAULT '[]',
  data_sources JSONB DEFAULT '[]',
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Section 11: Momentum Engine
CREATE TABLE IF NOT EXISTS lde_momentum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  growth_velocity FLOAT DEFAULT 0,
  stability_score FLOAT DEFAULT 0,
  sustainability_score FLOAT DEFAULT 0,
  momentum_score FLOAT DEFAULT 0,
  momentum_state TEXT DEFAULT 'stable', -- acceleration|stagnation|breakthrough|collapse|recovery|stable
  trend_direction TEXT DEFAULT 'stable',
  forecast_30d FLOAT,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 12: Fracture Detection
CREATE TABLE IF NOT EXISTS lde_fractures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  fracture_type TEXT NOT NULL, -- behavioural|emotional|cognitive|resilience|identity
  severity TEXT DEFAULT 'medium', -- critical|high|medium|low
  severity_score FLOAT DEFAULT 0,
  stabilization_forecast_days INT,
  recovery_probability FLOAT DEFAULT 0.5,
  contributing_factors JSONB DEFAULT '[]',
  intervention_recommended TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Section 13: Hidden Transformation Detection
CREATE TABLE IF NOT EXISTS lde_hidden_transformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  transformation_type TEXT NOT NULL, -- latent_capability|leadership_emergence|silent_acceleration|hidden_resilience|breakthrough_potential
  confidence FLOAT DEFAULT 0.5,
  magnitude FLOAT DEFAULT 0,
  evidence JSONB DEFAULT '[]',
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Section 14: Trust Evolution
CREATE TABLE IF NOT EXISTS lde_trust_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  checkpoint_date DATE DEFAULT CURRENT_DATE,
  intervention_trust FLOAT DEFAULT 0.5,
  mentor_trust FLOAT DEFAULT 0.5,
  institutional_trust FLOAT DEFAULT 0.5,
  overall_trust FLOAT DEFAULT 0.5,
  trust_state TEXT DEFAULT 'stable', -- collapse|recovering|stabilizing|stable|growing
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 15: Emotional Memory
CREATE TABLE IF NOT EXISTS lde_emotional_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  trigger_event TEXT,
  emotional_peak TEXT, -- joy|anxiety|frustration|hope|despair|confusion|determination
  peak_intensity FLOAT DEFAULT 0.5,
  recovery_pattern TEXT, -- rapid|gradual|stalled|cyclical
  recovery_days INT,
  burnout_flag BOOLEAN DEFAULT FALSE,
  cycle_pattern JSONB DEFAULT '{}',
  stored_at TIMESTAMP DEFAULT NOW()
);

-- Section 16: Drift Detection
CREATE TABLE IF NOT EXISTS lde_drift (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  drift_type TEXT NOT NULL, -- behavioural|cognitive|resilience|emotional|motivational
  drift_severity TEXT DEFAULT 'low', -- critical|high|medium|low
  drift_magnitude FLOAT DEFAULT 0,
  baseline_value FLOAT,
  current_value FLOAT,
  silent_deterioration_flag BOOLEAN DEFAULT FALSE,
  days_drifting INT DEFAULT 0,
  intervention_urgency TEXT DEFAULT 'monitor',
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Section 18: Knowledge Graph
CREATE TABLE IF NOT EXISTS lde_knowledge_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  node_type TEXT NOT NULL, -- Time|Behaviour|Emotion|Cognition|Intervention|Outcome|Trajectory|Signal
  node_key TEXT NOT NULL,
  label TEXT,
  temporal_marker TIMESTAMP,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lde_knowledge_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  source_id UUID REFERENCES lde_knowledge_graph_nodes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES lde_knowledge_graph_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- causes|predicts|enables|blocks|amplifies|inhibits|precedes|follows
  weight FLOAT DEFAULT 1.0,
  temporal_lag_days INT DEFAULT 0,
  confidence FLOAT DEFAULT 0.7,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section 19: Semantic Causal Reasoning
CREATE TABLE IF NOT EXISTS lde_semantic_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  chain_name TEXT NOT NULL,
  reasoning_steps JSONB DEFAULT '[]',
  causal_inputs JSONB DEFAULT '[]',
  causal_outputs JSONB DEFAULT '[]',
  inference_type TEXT DEFAULT 'temporal', -- temporal|counterfactual|longitudinal|intervention
  confidence FLOAT DEFAULT 0.7,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Section 20: Benchmarking
CREATE TABLE IF NOT EXISTS lde_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  benchmark_type TEXT NOT NULL, -- cohort|institution|age_band|csi_group|employability|global
  percentile_overall FLOAT,
  percentile_behavioural FLOAT,
  percentile_resilience FLOAT,
  percentile_emotional FLOAT,
  percentile_developmental FLOAT,
  cohort_size INT DEFAULT 0,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 21: Cohort Profiles
CREATE TABLE IF NOT EXISTS lde_cohort_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  cohort_id TEXT NOT NULL,
  cohort_name TEXT,
  cohort_type TEXT, -- school|campus|enterprise|region|age_band
  member_count INT DEFAULT 0,
  avg_resilience_score FLOAT DEFAULT 0,
  avg_engagement_score FLOAT DEFAULT 0,
  systemic_deterioration_flag BOOLEAN DEFAULT FALSE,
  trajectory_distribution JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cohort_id)
);

-- Section 22: Multi-Generational Intelligence
CREATE TABLE IF NOT EXISTS lde_multigenerational (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  generation_label TEXT NOT NULL, -- Gen-Z|Millennial|Gen-Alpha|Gen-X
  cohort_year INT,
  population_size INT DEFAULT 0,
  avg_capability_score FLOAT DEFAULT 0,
  workforce_readiness_score FLOAT DEFAULT 0,
  resilience_shift FLOAT DEFAULT 0,
  digital_adaptation_score FLOAT DEFAULT 0,
  trend_summary JSONB DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Section 23: Federated Nodes (simulated)
CREATE TABLE IF NOT EXISTS lde_federated_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  node_name TEXT NOT NULL,
  institution_type TEXT, -- school|university|enterprise|government|ngo
  privacy_noise_level FLOAT DEFAULT 0.1,
  last_sync_at TIMESTAMP,
  aggregated_intelligence JSONB DEFAULT '{}',
  sync_status TEXT DEFAULT 'pending', -- pending|synced|error
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(node_name)
);

-- Section 24: Longitudinal Simulations
CREATE TABLE IF NOT EXISTS lde_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  simulation_name TEXT NOT NULL,
  simulation_type TEXT NOT NULL, -- developmental_trajectory|burnout_resilience|intervention_outcomes|breakthrough_transformation|custom
  input_params JSONB DEFAULT '{}',
  population_size INT DEFAULT 100,
  scenario_outcomes JSONB DEFAULT '{}',
  trajectory_distribution JSONB DEFAULT '{}',
  robustness_score FLOAT DEFAULT 0.7,
  fairness_score FLOAT DEFAULT 0.8,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Section 25: Meta-Longitudinal Health
CREATE TABLE IF NOT EXISTS lde_meta_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  model_name TEXT NOT NULL,
  temporal_drift FLOAT DEFAULT 0,
  trajectory_instability FLOAT DEFAULT 0,
  calibration_degradation FLOAT DEFAULT 0,
  self_healing_triggered BOOLEAN DEFAULT FALSE,
  health_score FLOAT DEFAULT 0.8,
  correction_applied JSONB DEFAULT '{}',
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Section 26: Co-Evolution Records
CREATE TABLE IF NOT EXISTS lde_coevolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT,
  feedback_event TEXT NOT NULL,
  intervention_outcome JSONB DEFAULT '{}',
  adaptive_signal JSONB DEFAULT '{}',
  adaptation_velocity FLOAT DEFAULT 0,
  recursive_improvement_rate FLOAT DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Section 27: Explainability Audit Trail
CREATE TABLE IF NOT EXISTS lde_explainability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL, -- trajectory_change|intervention_impact|breakthrough|drift|fracture
  why_explanation TEXT,
  causal_contributors JSONB DEFAULT '[]',
  intervention_influence FLOAT DEFAULT 0,
  confidence FLOAT DEFAULT 0.7,
  future_impact_forecast TEXT,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Section 28: Constitutional AI Checks
CREATE TABLE IF NOT EXISTS lde_constitutional_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  check_type TEXT NOT NULL, -- ethical_boundary|developmental_fairness|emotional_safety|child_protection|human_dignity
  subject_id TEXT,
  passed BOOLEAN DEFAULT TRUE,
  violation_details TEXT,
  severity TEXT DEFAULT 'none',
  remediation_applied TEXT,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Section 29: Research Experiments
CREATE TABLE IF NOT EXISTS lde_research_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  experiment_name TEXT NOT NULL,
  experiment_type TEXT NOT NULL, -- psychometric_validation|intervention_effectiveness|resilience_study|trajectory_study
  hypothesis TEXT,
  methodology JSONB DEFAULT '{}',
  results JSONB DEFAULT '[]',
  result_count INT DEFAULT 0,
  status TEXT DEFAULT 'active', -- active|completed|archived
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Section 30: Recursive AI Evolution
CREATE TABLE IF NOT EXISTS lde_recursive_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  model_name TEXT NOT NULL,
  version INT DEFAULT 1,
  trigger TEXT, -- autonomous|manual|drift|performance_failure
  parameter_delta JSONB DEFAULT '{}',
  performance_before FLOAT DEFAULT 0,
  performance_after FLOAT DEFAULT 0,
  improvement_pct FLOAT DEFAULT 0,
  evolved_at TIMESTAMP DEFAULT NOW()
);

-- Section 31: Observability
CREATE TABLE IF NOT EXISTS lde_observability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  metric_name TEXT NOT NULL,
  metric_type TEXT DEFAULT 'gauge',
  metric_value FLOAT NOT NULL,
  labels JSONB DEFAULT '{}',
  anomaly_flag BOOLEAN DEFAULT FALSE,
  drift_flag BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lde_events_user ON lde_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_lde_events_type ON lde_events(event_type, processed);
CREATE INDEX IF NOT EXISTS idx_lde_feature_user ON lde_feature_store(user_id);
CREATE INDEX IF NOT EXISTS idx_lde_embeddings_user ON lde_embeddings(user_id, embedding_type);
CREATE INDEX IF NOT EXISTS idx_lde_twins_user ON lde_digital_twins(user_id);
CREATE INDEX IF NOT EXISTS idx_lde_timelines_user ON lde_timelines(user_id, checkpoint_date);
CREATE INDEX IF NOT EXISTS idx_lde_identity_user ON lde_identity_evolution(user_id, checkpoint_date);
CREATE INDEX IF NOT EXISTS idx_lde_momentum_user ON lde_momentum(user_id);
CREATE INDEX IF NOT EXISTS idx_lde_fractures_user ON lde_fractures(user_id, fracture_type);
CREATE INDEX IF NOT EXISTS idx_lde_hidden_user ON lde_hidden_transformations(user_id);
CREATE INDEX IF NOT EXISTS idx_lde_trust_user ON lde_trust_evolution(user_id, checkpoint_date);
CREATE INDEX IF NOT EXISTS idx_lde_drift_user ON lde_drift(user_id, drift_type);
CREATE INDEX IF NOT EXISTS idx_lde_kg_nodes_type ON lde_knowledge_graph_nodes(node_type, node_key);
CREATE INDEX IF NOT EXISTS idx_lde_benchmarks_user ON lde_benchmarks(user_id, benchmark_type);
CREATE INDEX IF NOT EXISTS idx_lde_cohorts_id ON lde_cohort_profiles(cohort_id);
CREATE INDEX IF NOT EXISTS idx_lde_federated_name ON lde_federated_nodes(node_name);
CREATE INDEX IF NOT EXISTS idx_lde_obs_name ON lde_observability(metric_name, recorded_at);
CREATE INDEX IF NOT EXISTS idx_lde_constitutional ON lde_constitutional_checks(check_type, passed);
CREATE INDEX IF NOT EXISTS idx_lde_research ON lde_research_experiments(status);
