-- METRYXONE BIOS — FRONTIER INTELLIGENCE LAYERS
-- Sections: Neuro-Symbolic, Causal, Emotional-Cognitive Fusion, Meta-Learning,
-- Latent Traits, Knowledge Graph, Multi-Agent, Population, Simulation,
-- Behavioural Economics, Multi-Modal Fusion, Self-Healing, Ethical Auditing,
-- Phase Transitions, Institutional Intelligence

-- ── SECTION 10: NEURO-SYMBOLIC REASONING ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_neuro_symbolic (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  tenant_id       UUID,
  session_id      TEXT,
  input_signals   JSONB DEFAULT '{}',
  symbolic_rules  JSONB DEFAULT '[]',
  neural_scores   JSONB DEFAULT '{}',
  causal_chain    JSONB DEFAULT '[]',
  hidden_patterns JSONB DEFAULT '[]',
  reasoning_path  TEXT,
  conclusion      TEXT,
  confidence      FLOAT DEFAULT 0.5,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TEMPORAL CAUSAL INTELLIGENCE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_causal_chains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  tenant_id       UUID,
  cause_signal    TEXT NOT NULL,
  effect_signal   TEXT NOT NULL,
  lag_days        INT DEFAULT 0,
  effect_size     FLOAT DEFAULT 0,
  confidence      FLOAT DEFAULT 0.5,
  causal_type     TEXT DEFAULT 'behavioural',
  evidence        JSONB DEFAULT '[]',
  validated       BOOLEAN DEFAULT FALSE,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── EMERGENT BEHAVIOUR DETECTION ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_emergent_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  pattern_name    TEXT NOT NULL,
  pattern_type    TEXT NOT NULL,
  affected_users  INT DEFAULT 0,
  prevalence      FLOAT DEFAULT 0,
  description     TEXT,
  signals         JSONB DEFAULT '[]',
  risk_level      TEXT DEFAULT 'low',
  first_detected  TIMESTAMPTZ DEFAULT NOW(),
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SELF-HEALING / DRIFT RECOVERY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_self_healing_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  drift_type          TEXT NOT NULL,
  drift_magnitude     FLOAT DEFAULT 0,
  affected_component  TEXT NOT NULL,
  healing_action      TEXT NOT NULL,
  before_state        JSONB DEFAULT '{}',
  after_state         JSONB DEFAULT '{}',
  success             BOOLEAN DEFAULT FALSE,
  triggered_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

-- ── SECTION 3: EMOTIONAL-COGNITIVE FUSION ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_emotional_cognitive_fusion (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT NOT NULL UNIQUE,
  tenant_id                 UUID,
  emotional_load            FLOAT DEFAULT 50,
  cognitive_load            FLOAT DEFAULT 50,
  stress_performance_index  FLOAT DEFAULT 50,
  resilience_emotion_score  FLOAT DEFAULT 50,
  anxiety_cognition_penalty FLOAT DEFAULT 0,
  emotional_resonance       FLOAT DEFAULT 50,
  cognitive_sync_score      FLOAT DEFAULT 50,
  emotional_adaptation_rate FLOAT DEFAULT 50,
  fusion_state              TEXT DEFAULT 'balanced',
  dominant_pattern          TEXT DEFAULT 'neutral',
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 6: META-LEARNING ENGINE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_meta_learning (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL UNIQUE,
  tenant_id             UUID,
  preferred_style       TEXT DEFAULT 'exploratory',
  visual_score          FLOAT DEFAULT 50,
  reinforcement_score   FLOAT DEFAULT 50,
  challenge_driven      FLOAT DEFAULT 50,
  reflective_score      FLOAT DEFAULT 50,
  exploratory_score     FLOAT DEFAULT 50,
  neuroadaptive_index   FLOAT DEFAULT 50,
  adaptive_pacing_score FLOAT DEFAULT 50,
  learning_velocity     FLOAT DEFAULT 0,
  style_evolution       JSONB DEFAULT '[]',
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 9: LATENT TRAIT INTELLIGENCE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_latent_traits (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT NOT NULL UNIQUE,
  tenant_id                 UUID,
  resilience_latent         FLOAT DEFAULT 50,
  leadership_latent         FLOAT DEFAULT 50,
  adaptability_latent       FLOAT DEFAULT 50,
  emotional_regulation      FLOAT DEFAULT 50,
  persistence_latent        FLOAT DEFAULT 50,
  curiosity_latent          FLOAT DEFAULT 50,
  executive_function_latent FLOAT DEFAULT 50,
  analytical_reasoning      FLOAT DEFAULT 50,
  trait_vector              JSONB DEFAULT '[]',
  phase_stage               TEXT DEFAULT 'emerging',
  phase_confidence          FLOAT DEFAULT 0.5,
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEVELOPMENTAL PHASE TRANSITIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_phase_transitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  tenant_id       UUID,
  from_phase      TEXT NOT NULL,
  to_phase        TEXT NOT NULL,
  trigger_signals JSONB DEFAULT '[]',
  transition_type TEXT DEFAULT 'progressive',
  confidence      FLOAT DEFAULT 0.5,
  is_regression   BOOLEAN DEFAULT FALSE,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 11: KNOWLEDGE GRAPH ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_knowledge_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  node_type   TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  properties  JSONB DEFAULT '{}',
  embedding   JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bios_knowledge_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  from_node_id    UUID REFERENCES bios_knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id      UUID REFERENCES bios_knowledge_nodes(id) ON DELETE CASCADE,
  relationship    TEXT NOT NULL,
  weight          FLOAT DEFAULT 1.0,
  temporal_lag    INT DEFAULT 0,
  evidence_count  INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 17: MULTI-AGENT ORCHESTRATION ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_agent_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  user_id         TEXT,
  agent_type      TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB DEFAULT '{}',
  output          JSONB DEFAULT '{}',
  confidence      FLOAT DEFAULT 0.5,
  latency_ms      INT DEFAULT 0,
  parent_event_id UUID,
  status          TEXT DEFAULT 'completed',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bios_agent_state (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  agent_type  TEXT NOT NULL UNIQUE,
  state       JSONB DEFAULT '{}',
  last_run    TIMESTAMPTZ DEFAULT NOW(),
  run_count   INT DEFAULT 0,
  health      FLOAT DEFAULT 1.0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 22: POPULATION & INSTITUTIONAL INTELLIGENCE ─────────────────────
CREATE TABLE IF NOT EXISTS bios_population_cohorts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID,
  cohort_name           TEXT NOT NULL,
  cohort_type           TEXT DEFAULT 'school',
  member_count          INT DEFAULT 0,
  avg_csi               FLOAT DEFAULT 50,
  avg_lbi               FLOAT DEFAULT 50,
  avg_resilience        FLOAT DEFAULT 50,
  avg_employability     FLOAT DEFAULT 50,
  burnout_rate          FLOAT DEFAULT 0,
  dropout_risk_rate     FLOAT DEFAULT 0,
  top_concern_areas     JSONB DEFAULT '[]',
  competency_gaps       JSONB DEFAULT '[]',
  trajectory            TEXT DEFAULT 'stable',
  intelligence_report   JSONB DEFAULT '{}',
  computed_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bios_institutional_intelligence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL UNIQUE,
  institution_name    TEXT,
  institution_type    TEXT DEFAULT 'school',
  overall_health      FLOAT DEFAULT 50,
  resilience_score    FLOAT DEFAULT 50,
  engagement_score    FLOAT DEFAULT 50,
  adaptation_rate     FLOAT DEFAULT 50,
  intervention_roi    FLOAT DEFAULT 0,
  workforce_readiness FLOAT DEFAULT 50,
  risk_profile        JSONB DEFAULT '{}',
  recommendations     JSONB DEFAULT '[]',
  computed_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 23: SYNTHETIC SIMULATION ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_synthetic_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  simulation_id       TEXT NOT NULL,
  persona_type        TEXT NOT NULL,
  age_band            TEXT,
  csi_score           FLOAT DEFAULT 50,
  lbi_score           FLOAT DEFAULT 50,
  burnout_prob        FLOAT DEFAULT 0,
  resilience_score    FLOAT DEFAULT 50,
  intervention_taken  BOOLEAN DEFAULT FALSE,
  outcome             TEXT DEFAULT 'stable',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bios_simulation_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  simulation_name     TEXT NOT NULL,
  scenario_type       TEXT NOT NULL,
  population_size     INT DEFAULT 100,
  parameters          JSONB DEFAULT '{}',
  results             JSONB DEFAULT '{}',
  insights            JSONB DEFAULT '[]',
  status              TEXT DEFAULT 'completed',
  ran_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 26: BEHAVIOURAL ECONOMICS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_behavioural_economics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT NOT NULL UNIQUE,
  tenant_id                 UUID,
  motivation_level          FLOAT DEFAULT 50,
  motivation_decay_rate     FLOAT DEFAULT 0,
  reward_sensitivity        FLOAT DEFAULT 50,
  cognitive_effort_capacity FLOAT DEFAULT 50,
  loss_aversion_index       FLOAT DEFAULT 50,
  delayed_gratification     FLOAT DEFAULT 50,
  incentive_response        FLOAT DEFAULT 50,
  optimal_intervention_type TEXT DEFAULT 'encouragement',
  effort_allocation         JSONB DEFAULT '{}',
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 27: MULTI-MODAL FUSION ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_multimodal_fusion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  tenant_id           UUID,
  text_signal_score   FLOAT DEFAULT 50,
  behavioural_score   FLOAT DEFAULT 50,
  cognitive_score     FLOAT DEFAULT 50,
  emotional_score     FLOAT DEFAULT 50,
  interaction_score   FLOAT DEFAULT 50,
  fusion_score        FLOAT DEFAULT 50,
  dominant_modality   TEXT DEFAULT 'behavioural',
  modality_weights    JSONB DEFAULT '{}',
  fusion_confidence   FLOAT DEFAULT 0.5,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTINUOUS ETHICAL AUDITING ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bios_ethical_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  audit_type          TEXT NOT NULL,
  component_audited   TEXT NOT NULL,
  passed              BOOLEAN DEFAULT TRUE,
  violations          JSONB DEFAULT '[]',
  risk_level          TEXT DEFAULT 'low',
  recommendations     JSONB DEFAULT '[]',
  auto_remediated     BOOLEAN DEFAULT FALSE,
  audited_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bios_neuro_user ON bios_neuro_symbolic(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bios_causal_user ON bios_causal_chains(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_bios_emergent_type ON bios_emergent_patterns(pattern_type, risk_level);
CREATE INDEX IF NOT EXISTS idx_bios_agents ON bios_agent_events(agent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bios_phase ON bios_phase_transitions(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_bios_kg_from ON bios_knowledge_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_bios_kg_to ON bios_knowledge_edges(to_node_id);

-- Seed knowledge graph nodes
INSERT INTO bios_knowledge_nodes (node_type, label, description) VALUES
  ('concern', 'Screen Addiction', 'Digital dependency affecting focus and sleep'),
  ('concern', 'Exam Anxiety', 'Performance anxiety during assessments'),
  ('concern', 'Concentration Deficit', 'Inability to sustain focused attention'),
  ('behaviour', 'Impulsivity', 'Rapid responses without reflection'),
  ('behaviour', 'Avoidance', 'Systematically avoiding difficult tasks'),
  ('behaviour', 'Persistence', 'Continuing effort despite setbacks'),
  ('competency', 'Self-Regulation', 'Ability to manage thoughts and emotions'),
  ('competency', 'Cognitive Flexibility', 'Adapting thinking to new situations'),
  ('risk', 'Burnout Risk', 'Risk of emotional and cognitive exhaustion'),
  ('intervention', 'Mindfulness Training', 'Attention and stress-regulation exercises'),
  ('intervention', 'Cognitive Reframing', 'Changing perspective on challenges'),
  ('outcome', 'Academic Resilience', 'Ability to recover from academic setbacks')
ON CONFLICT DO NOTHING;

-- Seed agent state
INSERT INTO bios_agent_state (agent_type, state) VALUES
  ('assessment_agent', '{"status":"ready","last_action":null}'),
  ('cognition_agent', '{"status":"ready","models_loaded":["IRT","Bayesian"]}'),
  ('emotional_agent', '{"status":"ready","fusion_enabled":true}'),
  ('mentor_agent', '{"status":"ready","escalation_threshold":0.7}'),
  ('governance_agent', '{"status":"ready","audit_interval_hours":24}'),
  ('prediction_agent', '{"status":"ready","model_version":1}'),
  ('intervention_agent', '{"status":"ready","active_interventions":0}'),
  ('explainability_agent', '{"status":"ready","verbosity":"standard"}')
ON CONFLICT (agent_type) DO NOTHING;
