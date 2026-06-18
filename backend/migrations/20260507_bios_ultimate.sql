-- BIOS Ultimate Intelligence Layer Migration
-- 8 new engines: Cognitive, Meta-Learning, Digital Twin, Psychometrics,
--                Semantic Reasoning, Memory, Ethics/Governance, Fairness

-- 1. COGNITIVE INTELLIGENCE ENGINE
CREATE TABLE IF NOT EXISTS cognitive_profiles (
  id SERIAL PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  working_memory_score NUMERIC(5,1) DEFAULT 50,
  attention_stability NUMERIC(5,1) DEFAULT 50,
  cognitive_flexibility NUMERIC(5,1) DEFAULT 50,
  processing_depth NUMERIC(5,1) DEFAULT 50,
  metacognition_score NUMERIC(5,1) DEFAULT 50,
  reasoning_style TEXT DEFAULT 'analytical',
  cognitive_fatigue_level NUMERIC(5,1) DEFAULT 20,
  overload_risk TEXT DEFAULT 'low',
  composite_cognitive_score NUMERIC(5,1) DEFAULT 50,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS human_state_snapshots (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  session_id TEXT,
  state_type TEXT NOT NULL,
  confidence NUMERIC(4,2) DEFAULT 0.70,
  trigger_signals JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_human_state_email ON human_state_snapshots(user_email);

-- 2. META-LEARNING ENGINE
CREATE TABLE IF NOT EXISTS meta_learning_profiles (
  id SERIAL PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  primary_style TEXT DEFAULT 'exploratory',
  secondary_style TEXT,
  optimal_session_length_min NUMERIC(5,1) DEFAULT 15,
  optimal_difficulty TEXT DEFAULT 'moderate',
  feedback_preference TEXT DEFAULT 'immediate',
  pacing TEXT DEFAULT 'self_paced',
  learning_velocity NUMERIC(5,1) DEFAULT 50,
  adaptation_responsiveness NUMERIC(4,2) DEFAULT 0.70,
  style_evidence JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HUMAN DIGITAL TWIN ENGINE
CREATE TABLE IF NOT EXISTS human_digital_twins (
  id SERIAL PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  csi_score NUMERIC(5,1) DEFAULT 0,
  lbi_score NUMERIC(5,1) DEFAULT 0,
  cognitive_score NUMERIC(5,1) DEFAULT 50,
  emotional_score NUMERIC(5,1) DEFAULT 50,
  behavioural_score NUMERIC(5,1) DEFAULT 50,
  developmental_stage TEXT DEFAULT 'forming',
  human_intelligence_score NUMERIC(5,1) DEFAULT 0,
  state_vector JSONB DEFAULT '{}',
  adaptation_profile JSONB DEFAULT '{}',
  intervention_responsiveness NUMERIC(4,2) DEFAULT 0.60,
  twin_version INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS twin_state_history (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  state_snapshot JSONB NOT NULL,
  trigger_event TEXT,
  human_intelligence_score NUMERIC(5,1),
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_twin_history_email ON twin_state_history(user_email);

-- 4. PSYCHOMETRICS ENGINE
CREATE TABLE IF NOT EXISTS psychometric_reports (
  id SERIAL PRIMARY KEY,
  assessment_type TEXT NOT NULL,
  concern_name TEXT,
  stage_code TEXT,
  sample_size INTEGER DEFAULT 0,
  cronbach_alpha NUMERIC(5,3),
  reliability_grade TEXT,
  validity_score NUMERIC(5,3),
  avg_difficulty NUMERIC(5,3),
  avg_discrimination NUMERIC(5,3),
  bias_risk TEXT DEFAULT 'low',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_irt_params (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_source TEXT NOT NULL,
  difficulty_param NUMERIC(6,3) DEFAULT 0,
  discrimination_param NUMERIC(6,3) DEFAULT 1,
  guessing_param NUMERIC(6,3) DEFAULT 0.25,
  confidence_level NUMERIC(4,2) DEFAULT 0.70,
  response_count INTEGER DEFAULT 0,
  calibrated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, item_source)
);

-- 5. SEMANTIC REASONING ENGINE
CREATE TABLE IF NOT EXISTS semantic_chains (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  root_signal TEXT NOT NULL,
  causal_chain JSONB NOT NULL DEFAULT '[]',
  outcome_prediction TEXT,
  outcome_confidence NUMERIC(4,2) DEFAULT 0.60,
  severity TEXT DEFAULT 'medium',
  pattern_name TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_semantic_chains_email ON semantic_chains(user_email);

CREATE TABLE IF NOT EXISTS causal_pattern_library (
  id SERIAL PRIMARY KEY,
  pattern_name TEXT UNIQUE NOT NULL,
  chain_template JSONB NOT NULL DEFAULT '[]',
  trigger_signals JSONB DEFAULT '[]',
  predicted_outcome TEXT,
  severity TEXT DEFAULT 'medium',
  recommended_intervention TEXT,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEMORY ARCHITECTURE
CREATE TABLE IF NOT EXISTS episodic_memory (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  episode_type TEXT NOT NULL,
  episode_summary JSONB NOT NULL DEFAULT '{}',
  emotional_valence TEXT DEFAULT 'neutral',
  significance_score NUMERIC(4,2) DEFAULT 0.50,
  concern_name TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_episodic_email ON episodic_memory(user_email);

CREATE TABLE IF NOT EXISTS behavioural_memory (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL DEFAULT '{}',
  decay_factor NUMERIC(4,2) DEFAULT 1.0,
  reinforcement_count INTEGER DEFAULT 1,
  last_reinforced TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, memory_key)
);

CREATE TABLE IF NOT EXISTS intervention_memory (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  intervention_type TEXT NOT NULL,
  intervention_detail TEXT,
  effectiveness_rating NUMERIC(4,2),
  outcome_notes TEXT,
  administered_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intervention_memory_email ON intervention_memory(user_email);

-- 7. ETHICS & GOVERNANCE ENGINE
CREATE TABLE IF NOT EXISTS governance_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_email TEXT,
  actor_email TEXT,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  severity TEXT DEFAULT 'info',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_governance_events_user ON governance_events(user_email);

CREATE TABLE IF NOT EXISTS intervention_approvals (
  id SERIAL PRIMARY KEY,
  intervention_type TEXT NOT NULL,
  user_email TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  approver_email TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  notes TEXT,
  approver_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 8. FAIRNESS & BIAS ENGINE
CREATE TABLE IF NOT EXISTS fairness_reports (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  group_label TEXT,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC(8,3),
  global_baseline NUMERIC(8,3),
  deviation_pct NUMERIC(8,3),
  drift_detected BOOLEAN DEFAULT FALSE,
  severity TEXT DEFAULT 'none',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bias_detections (
  id SERIAL PRIMARY KEY,
  model_type TEXT NOT NULL,
  bias_type TEXT NOT NULL,
  affected_group TEXT,
  severity TEXT DEFAULT 'low',
  z_score NUMERIC(8,3),
  evidence JSONB DEFAULT '{}',
  recommendation TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed causal pattern library
INSERT INTO causal_pattern_library (pattern_name, chain_template, trigger_signals, predicted_outcome, severity, recommended_intervention) VALUES
('digital_overload_chain',
 '["digital_signal_detected","attention_fragmentation","persistence_decline","engagement_dropout"]',
 '["digital","cognitive"]',
 'dropout_risk', 'high',
 'Reduce session length, introduce micro-breaks, digital detox recommendations'),
('burnout_trajectory',
 '["emotional_high_severity","cognitive_overload","disengagement","score_decline","burnout"]',
 '["emotional","cognitive","engagement"]',
 'burnout', 'critical',
 'Counsellor escalation, pacing reduction, emotional support intervention'),
('anxiety_performance_loop',
 '["anxiety_markers_detected","hesitation_pattern","low_score","avoidance_behaviour"]',
 '["emotional","linguistic"]',
 'performance_anxiety', 'high',
 'Anxiety-aware UX adaptations, confidence-building exercises'),
('growth_momentum',
 '["high_score_pattern","persistence_signal","stage_advancement","engagement_increase"]',
 '["motivational","engagement"]',
 'growth_acceleration', 'low',
 'Increase challenge level, introduce advanced content, peer mentorship'),
('resilience_pattern',
 '["score_recovery","revisit_concern","improvement_detected","adaptive_engagement"]',
 '["motivational","developmental"]',
 'resilience_building', 'low',
 'Positive reinforcement, challenge-based progression'),
('stagnation_risk',
 '["score_plateau","low_velocity","no_new_concerns","declining_engagement"]',
 '["engagement","motivational"]',
 'stagnation', 'medium',
 'Goal re-setting, new concern exploration, motivational nudges'),
('cognitive_overload_spiral',
 '["prolonged_hesitation","high_error_rate","fatigue_indicators","withdrawal"]',
 '["cognitive","executive_function"]',
 'cognitive_overload', 'high',
 'Cognitive load reduction, chunked delivery, pacing adjustment'),
('social_isolation_chain',
 '["social_signal_decline","reduced_peer_interaction","emotional_suppression","disengagement"]',
 '["social","emotional"]',
 'social_isolation', 'medium',
 'Social engagement activities, peer connection facilitation')
ON CONFLICT (pattern_name) DO NOTHING;
