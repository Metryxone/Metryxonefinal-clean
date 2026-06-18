-- METRYXONE BIOS — IIL: Institutional Intelligence Layer Migration
-- 36 tables covering all 40 sections of the IIL specification

-- ── Institutions registry ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_institutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  name            TEXT NOT NULL,
  institution_type TEXT DEFAULT 'school' CHECK (institution_type IN ('school','university','enterprise','government','ngo','skilling')),
  tier            TEXT DEFAULT 'standard' CHECK (tier IN ('starter','standard','professional','enterprise','flagship')),
  country         TEXT DEFAULT 'IN',
  region          TEXT,
  city            TEXT,
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 2: Signal Aggregation ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL CHECK (signal_type IN (
    'student_behavioural','teacher','emotional_ecosystem','resilience',
    'interaction','workforce_readiness','intervention','environmental','governance'
  )),
  source_entity   TEXT, -- student/teacher/cohort/institution
  source_id       TEXT,
  signal_data     JSONB DEFAULT '{}',
  anomaly_score   NUMERIC(5,4) DEFAULT 0,
  confidence      NUMERIC(5,4) DEFAULT 0.8,
  weak_signal     BOOLEAN DEFAULT FALSE,
  amplification_factor NUMERIC(5,2) DEFAULT 1.0,
  is_systemic     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iil_signals_inst ON iil_signals(institution_id);
CREATE INDEX IF NOT EXISTS idx_iil_signals_type ON iil_signals(signal_type);

-- ── Section 3: Institutional DNA / Genome Engine ──────────────────────────────
CREATE TABLE IF NOT EXISTS iil_dna_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE UNIQUE,
  identity_score  NUMERIC(5,2) DEFAULT 50,
  personality     JSONB DEFAULT '{}', -- openness/conscientiousness/resilience/innovativeness/empathy
  resilience_dna  NUMERIC(5,2) DEFAULT 50,
  culture_dna     JSONB DEFAULT '{}',
  leadership_dna  JSONB DEFAULT '{}',
  mutations       JSONB DEFAULT '[]', -- detected DNA mutations over time
  instability_flags JSONB DEFAULT '[]',
  genome_version  INTEGER DEFAULT 1,
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iil_dna_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID,
  snapshot        JSONB NOT NULL,
  genome_version  INTEGER,
  captured_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 4: Culture Intelligence ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_culture_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE UNIQUE,
  collaboration   NUMERIC(5,2) DEFAULT 50,
  innovation      NUMERIC(5,2) DEFAULT 50,
  resilience      NUMERIC(5,2) DEFAULT 50,
  trust           NUMERIC(5,2) DEFAULT 50,
  learning        NUMERIC(5,2) DEFAULT 50,
  composite_score NUMERIC(5,2) DEFAULT 50,
  toxic_formation_risk NUMERIC(5,4) DEFAULT 0,
  disengagement_risk   NUMERIC(5,4) DEFAULT 0,
  innovation_acceleration NUMERIC(5,4) DEFAULT 0,
  resilience_breakdown    NUMERIC(5,4) DEFAULT 0,
  detected_patterns JSONB DEFAULT '[]',
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 5: Emotional Climate Engine ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_emotional_climate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  ecosystem_stability   NUMERIC(5,2) DEFAULT 50,
  institutional_anxiety NUMERIC(5,2) DEFAULT 20,
  burnout_propagation   NUMERIC(5,2) DEFAULT 10,
  emotional_resilience  NUMERIC(5,2) DEFAULT 60,
  ecosystem_morale      NUMERIC(5,2) DEFAULT 60,
  contagion_risk        NUMERIC(5,4) DEFAULT 0,
  fatigue_index         NUMERIC(5,2) DEFAULT 20,
  collapse_risk         NUMERIC(5,4) DEFAULT 0,
  hidden_instability    BOOLEAN DEFAULT FALSE,
  alerts              JSONB DEFAULT '[]',
  calculated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, period_date)
);

-- ── Section 6: Cognitive Load Engine ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_cognitive_load (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  academic_overload       NUMERIC(5,2) DEFAULT 30,
  teacher_overload        NUMERIC(5,2) DEFAULT 30,
  cognitive_fragmentation NUMERIC(5,2) DEFAULT 20,
  decision_fatigue        NUMERIC(5,2) DEFAULT 25,
  coordination_overload   NUMERIC(5,2) DEFAULT 20,
  overload_cascade_risk   NUMERIC(5,4) DEFAULT 0,
  collapse_risk           NUMERIC(5,4) DEFAULT 0,
  attention_fragmentation NUMERIC(5,4) DEFAULT 0,
  calculated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, period_date)
);

-- ── Section 7: Health Engine ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_health_index (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  engagement_score     NUMERIC(5,2) DEFAULT 50,
  resilience_score     NUMERIC(5,2) DEFAULT 50,
  emotional_stability  NUMERIC(5,2) DEFAULT 50,
  trust_score          NUMERIC(5,2) DEFAULT 50,
  developmental_growth NUMERIC(5,2) DEFAULT 50,
  workforce_readiness  NUMERIC(5,2) DEFAULT 50,
  health_index         NUMERIC(5,2) DEFAULT 50,
  ecosystem_stability  NUMERIC(5,2) DEFAULT 50,
  health_grade         TEXT DEFAULT 'Developing' CHECK (health_grade IN ('Critical','Fragile','Developing','Stable','Thriving')),
  calculated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, period_date)
);

CREATE TABLE IF NOT EXISTS iil_health_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID,
  health_index   NUMERIC(5,2),
  health_grade   TEXT,
  snapshot       JSONB,
  captured_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 8: Resilience Engine ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_resilience_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE UNIQUE,
  recovery_capability  NUMERIC(5,2) DEFAULT 50,
  adaptability         NUMERIC(5,2) DEFAULT 50,
  ecosystem_recovery   NUMERIC(5,2) DEFAULT 50,
  burnout_recovery     NUMERIC(5,2) DEFAULT 50,
  sustainability       NUMERIC(5,2) DEFAULT 50,
  resilience_score     NUMERIC(5,2) DEFAULT 50,
  collapse_risk        NUMERIC(5,4) DEFAULT 0,
  fragility_index      NUMERIC(5,4) DEFAULT 0,
  volatility_index     NUMERIC(5,4) DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 9: Trajectory Engine ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_trajectories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  trajectory_type TEXT CHECK (trajectory_type IN (
    'institutional_evolution','engagement','employability',
    'resilience','workforce_development'
  )),
  period_start    DATE,
  period_end      DATE,
  direction       TEXT CHECK (direction IN ('accelerating','stable','decelerating','stagnating','declining','recovering')),
  velocity        NUMERIC(8,4) DEFAULT 0,
  momentum        NUMERIC(8,4) DEFAULT 0,
  breakthrough_detected BOOLEAN DEFAULT FALSE,
  hidden_decline  BOOLEAN DEFAULT FALSE,
  data_points     JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 10: Collapse Forecasting ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_collapse_forecasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  forecast_type   TEXT CHECK (forecast_type IN (
    'institutional_instability','disengagement_cascade','trust_collapse',
    'burnout_ecosystem','resilience_collapse'
  )),
  probability     NUMERIC(5,4) DEFAULT 0,
  severity        TEXT CHECK (severity IN ('low','moderate','high','critical')),
  time_horizon_days INTEGER DEFAULT 90,
  early_warning_signals JSONB DEFAULT '[]',
  fragility_indicators  JSONB DEFAULT '[]',
  intervention_recommended TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  forecasted_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 11: Recovery Intelligence ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_recovery_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  recovery_event_type TEXT,
  recovery_velocity    NUMERIC(8,4) DEFAULT 0,
  stability_score      NUMERIC(5,2) DEFAULT 50,
  sustainability_score NUMERIC(5,2) DEFAULT 50,
  recovery_momentum    NUMERIC(8,4) DEFAULT 0,
  trust_rebuilding     NUMERIC(5,2) DEFAULT 50,
  intervention_effectiveness NUMERIC(5,2) DEFAULT 50,
  phase               TEXT CHECK (phase IN ('initial','accelerating','stabilizing','sustained','complete')),
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- ── Section 12: Opportunity Engine ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  opportunity_type TEXT CHECK (opportunity_type IN (
    'leadership_ecosystem','innovation_emergence','hidden_strength',
    'employability_acceleration','resilience_breakthrough'
  )),
  title           TEXT NOT NULL,
  description     TEXT,
  strength_score  NUMERIC(5,2) DEFAULT 50,
  amplification_potential NUMERIC(5,4) DEFAULT 0,
  detected_signals JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'detected' CHECK (status IN ('detected','acknowledged','actioned','realised')),
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 13: Drift & Entropy ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_drift_entropy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  behavioural_drift   NUMERIC(5,4) DEFAULT 0,
  resilience_drift    NUMERIC(5,4) DEFAULT 0,
  emotional_drift     NUMERIC(5,4) DEFAULT 0,
  entropy_score       NUMERIC(5,2) DEFAULT 0, -- Instability + Fragmentation + Unpredictability
  instability         NUMERIC(5,2) DEFAULT 0,
  fragmentation       NUMERIC(5,2) DEFAULT 0,
  unpredictability    NUMERIC(5,2) DEFAULT 0,
  ecosystem_fragmentation NUMERIC(5,4) DEFAULT 0,
  alert_level         TEXT DEFAULT 'normal' CHECK (alert_level IN ('normal','elevated','warning','critical')),
  UNIQUE(institution_id, period_date)
);

-- ── Section 14: Trust Propagation ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_trust_propagation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  institutional_trust NUMERIC(5,2) DEFAULT 60,
  leadership_trust    NUMERIC(5,2) DEFAULT 60,
  teacher_trust       NUMERIC(5,2) DEFAULT 60,
  ecosystem_trust     NUMERIC(5,2) DEFAULT 60,
  trust_composite     NUMERIC(5,2) DEFAULT 60,
  collapse_risk       NUMERIC(5,4) DEFAULT 0,
  stabilization_trend NUMERIC(5,4) DEFAULT 0,
  propagation_velocity NUMERIC(8,4) DEFAULT 0,
  trust_events        JSONB DEFAULT '[]',
  UNIQUE(institution_id, period_date)
);

-- ── Section 15: Faculty Evolution ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_faculty_evolution (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  faculty_id      TEXT,
  faculty_name    TEXT,
  growth_score        NUMERIC(5,2) DEFAULT 50,
  adaptability        NUMERIC(5,2) DEFAULT 50,
  emotional_resilience NUMERIC(5,2) DEFAULT 50,
  mentorship_quality  NUMERIC(5,2) DEFAULT 50,
  cognitive_overload  NUMERIC(5,2) DEFAULT 30,
  burnout_risk        NUMERIC(5,4) DEFAULT 0,
  teaching_fatigue    NUMERIC(5,2) DEFAULT 20,
  leadership_emergence BOOLEAN DEFAULT FALSE,
  resilience_acceleration BOOLEAN DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 16: Leadership Intelligence ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_leadership_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  leader_id       TEXT,
  leader_name     TEXT,
  leader_role     TEXT,
  effectiveness   NUMERIC(5,2) DEFAULT 50,
  trust_score     NUMERIC(5,2) DEFAULT 50,
  adaptability    NUMERIC(5,2) DEFAULT 50,
  influence_score NUMERIC(5,2) DEFAULT 50,
  decision_quality NUMERIC(5,2) DEFAULT 50,
  instability_risk NUMERIC(5,4) DEFAULT 0,
  hidden_potential BOOLEAN DEFAULT FALSE,
  governance_fragility BOOLEAN DEFAULT FALSE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 17: Behavioural Contagion ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_contagion_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  contagion_type  TEXT CHECK (contagion_type IN (
    'engagement','burnout','resilience','emotional','innovation'
  )),
  source_entity   TEXT,
  spread_velocity NUMERIC(8,4) DEFAULT 0,
  affected_count  INTEGER DEFAULT 0,
  affected_ratio  NUMERIC(5,4) DEFAULT 0,
  severity        TEXT DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  containment_status TEXT DEFAULT 'spreading' CHECK (containment_status IN ('spreading','contained','resolved')),
  intervention_id TEXT,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 18: Benchmarking ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_benchmarks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  benchmark_type  TEXT CHECK (benchmark_type IN ('institution','campus','cohort','department','workforce')),
  dimension       TEXT,
  score           NUMERIC(5,2),
  percentile      NUMERIC(5,2),
  peer_average    NUMERIC(5,2),
  regional_average NUMERIC(5,2),
  national_average NUMERIC(5,2),
  norm_version    TEXT,
  period          TEXT,
  calculated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 19: Employability Network ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_employability_network (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  readiness_score NUMERIC(5,2) DEFAULT 50,
  capability_evolution NUMERIC(5,2) DEFAULT 50,
  industry_alignment   NUMERIC(5,2) DEFAULT 50,
  placement_health     NUMERIC(5,2) DEFAULT 50,
  adaptability_score   NUMERIC(5,2) DEFAULT 50,
  capability_gaps      JSONB DEFAULT '[]',
  workforce_fragility  NUMERIC(5,4) DEFAULT 0,
  hidden_potential     JSONB DEFAULT '[]',
  UNIQUE(institution_id, period_date)
);

-- ── Section 20: Economic Intelligence ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_economic_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  sustainability_score   NUMERIC(5,2) DEFAULT 50,
  intervention_roi       NUMERIC(8,4) DEFAULT 1.0,
  workforce_roi          NUMERIC(8,4) DEFAULT 1.0,
  learning_investment_efficiency NUMERIC(5,2) DEFAULT 50,
  ecosystem_efficiency   NUMERIC(5,2) DEFAULT 50,
  economic_instability   NUMERIC(5,4) DEFAULT 0,
  intervention_inefficiency NUMERIC(5,4) DEFAULT 0,
  resource_wastage       NUMERIC(5,4) DEFAULT 0,
  UNIQUE(institution_id, period_date)
);

-- ── Section 21: Reputation Engine ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_reputation_index (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  trust_perception     NUMERIC(5,2) DEFAULT 60,
  employer_perception  NUMERIC(5,2) DEFAULT 60,
  ecosystem_reputation NUMERIC(5,2) DEFAULT 60,
  resilience_reputation NUMERIC(5,2) DEFAULT 60,
  innovation_reputation NUMERIC(5,2) DEFAULT 60,
  composite_reputation  NUMERIC(5,2) DEFAULT 60,
  degradation_risk     NUMERIC(5,4) DEFAULT 0,
  trust_instability    NUMERIC(5,4) DEFAULT 0,
  employer_confidence_trend NUMERIC(5,4) DEFAULT 0,
  UNIQUE(institution_id, period_date)
);

-- ── Section 22: Lifecycle Engine ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_lifecycle_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  lifecycle_stage TEXT CHECK (lifecycle_stage IN ('birth','growth','scaling','maturity','transformation','decline','recovery')),
  entered_at      TIMESTAMPTZ DEFAULT NOW(),
  exited_at       TIMESTAMPTZ,
  duration_days   INTEGER,
  transition_trigger TEXT,
  stagnation_detected BOOLEAN DEFAULT FALSE,
  rebirth_initiated   BOOLEAN DEFAULT FALSE,
  stage_score         NUMERIC(5,2) DEFAULT 50,
  notes               TEXT
);

-- ── Section 23: Knowledge Graph ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_knowledge_graph (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  node_type       TEXT CHECK (node_type IN ('Institution','Cohort','Behaviour','Intervention','Outcome','Domain','Risk','Opportunity')),
  node_key        TEXT NOT NULL,
  node_label      TEXT,
  properties      JSONB DEFAULT '{}',
  embedding_vector JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iil_graph_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID,
  from_node_id    UUID REFERENCES iil_knowledge_graph(id),
  to_node_id      UUID REFERENCES iil_knowledge_graph(id),
  edge_type       TEXT,
  weight          NUMERIC(5,4) DEFAULT 1.0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 24: Causal Reasoning ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_causal_chains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  chain_name      TEXT,
  chain_steps     JSONB NOT NULL DEFAULT '[]', -- [{step, factor, confidence, propagation_lag_days}]
  root_cause      TEXT,
  terminal_outcome TEXT,
  probability     NUMERIC(5,4) DEFAULT 0,
  validated       BOOLEAN DEFAULT FALSE,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 25: Federated Intelligence ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_federated_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  source_institution_id UUID,
  data_type       TEXT CHECK (data_type IN ('benchmark','signal_pattern','intervention_outcome','cohort_norm')),
  anonymized_payload JSONB DEFAULT '{}',
  privacy_level   TEXT DEFAULT 'aggregated' CHECK (privacy_level IN ('aggregated','anonymized','pseudonymized')),
  region          TEXT,
  shared_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 26: Digital Twin ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_digital_twins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE UNIQUE,
  twin_state      JSONB DEFAULT '{}',
  twin_version    INTEGER DEFAULT 1,
  last_sync_at    TIMESTAMPTZ DEFAULT NOW(),
  simulation_ready BOOLEAN DEFAULT FALSE,
  policy_experiments JSONB DEFAULT '[]',
  stress_test_results JSONB DEFAULT '[]',
  forecast_states JSONB DEFAULT '[]',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 27: Simulation ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_simulations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  simulation_type TEXT CHECK (simulation_type IN (
    'ecosystem_instability','resilience_recovery','workforce_evolution',
    'collapse','innovation_acceleration','policy_optimization'
  )),
  parameters      JSONB DEFAULT '{}',
  results         JSONB DEFAULT '{}',
  confidence      NUMERIC(5,4) DEFAULT 0.8,
  iterations      INTEGER DEFAULT 100,
  status          TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── Section 28: Forecast Market ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_forecast_market (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  forecast_horizon TEXT CHECK (forecast_horizon IN ('30d','90d','180d','1y','3y')),
  outcome_type    TEXT,
  probability     NUMERIC(5,4) DEFAULT 0,
  confidence_interval_low  NUMERIC(5,2),
  confidence_interval_high NUMERIC(5,2),
  scenarios       JSONB DEFAULT '[]', -- [{label, probability, drivers}]
  model_version   TEXT,
  generated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 29: Fairness Engine ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_fairness_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  audit_type      TEXT CHECK (audit_type IN ('benchmarking','intervention','equity','cohort')),
  dimension       TEXT,
  bias_score      NUMERIC(5,4) DEFAULT 0,
  bias_type       TEXT,
  affected_group  TEXT,
  severity        TEXT DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  remediation     TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  audited_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 30: Governance ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_governance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID REFERENCES iil_institutions(id) ON DELETE CASCADE,
  record_type     TEXT CHECK (record_type IN ('audit','compliance','escalation','override','counsellor_action')),
  action          TEXT NOT NULL,
  actor           TEXT,
  target_entity   TEXT,
  metadata        JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_review','approved','rejected','resolved')),
  escalation_level INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ── Section 31: Explainability ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_explainability_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID,
  insight_type    TEXT NOT NULL,
  institutional_risk TEXT,
  reasons         JSONB DEFAULT '[]',
  contributing_signals JSONB DEFAULT '[]',
  intervention_influence JSONB DEFAULT '[]',
  confidence      NUMERIC(5,4) DEFAULT 0.8,
  future_impact   TEXT,
  generated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 32: AI Safety ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_safety_constraints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  constraint_type TEXT CHECK (constraint_type IN (
    'ethical_boundary','emotional_safeguard','child_protection',
    'anti_manipulation','dignity_preservation'
  )),
  constraint_name TEXT NOT NULL,
  rule_definition TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  triggered_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iil_safety_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  constraint_id   UUID REFERENCES iil_safety_constraints(id),
  institution_id  UUID,
  violation_type  TEXT,
  description     TEXT,
  severity        TEXT,
  blocked         BOOLEAN DEFAULT TRUE,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 33: Research & Experimentation ────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_research_experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID,
  experiment_name TEXT NOT NULL,
  experiment_type TEXT CHECK (experiment_type IN (
    'validation_study','psychometric','workforce_readiness',
    'intervention_effectiveness','longitudinal_ecosystem'
  )),
  hypothesis      TEXT,
  parameters      JSONB DEFAULT '{}',
  results         JSONB DEFAULT '{}',
  dataset_export  JSONB DEFAULT '{}',
  reproducible    BOOLEAN DEFAULT TRUE,
  status          TEXT DEFAULT 'designing' CHECK (status IN ('designing','running','analyzing','complete','published')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 34: Recursive Self-Evolving AI ────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_self_evolution_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  model_component TEXT NOT NULL, -- e.g. 'health_index','trajectory_engine','collapse_forecaster'
  evolution_type  TEXT CHECK (evolution_type IN (
    'weight_recalibration','pattern_discovery','norm_update',
    'threshold_adjustment','model_version_bump'
  )),
  before_state    JSONB DEFAULT '{}',
  after_state     JSONB DEFAULT '{}',
  trigger_event   TEXT,
  performance_delta NUMERIC(8,4) DEFAULT 0,
  approved        BOOLEAN DEFAULT FALSE,
  evolved_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 36: Event-Driven Orchestration ────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_events_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID,
  event_type      TEXT CHECK (event_type IN (
    'INSTITUTION_SIGNAL_CAPTURED','HEALTH_UPDATED','RISK_ESCALATED',
    'DRIFT_DETECTED','INTERVENTION_TRIGGERED','TRAJECTORY_UPDATED','TRUST_CHANGED'
  )),
  payload         JSONB DEFAULT '{}',
  processed       BOOLEAN DEFAULT FALSE,
  retry_count     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iil_events_unprocessed ON iil_events_log(processed, created_at) WHERE processed = FALSE;

-- ── Section 38: Audit Trail ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iil_audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  institution_id  UUID,
  actor           TEXT,
  actor_role      TEXT,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  metadata        JSONB DEFAULT '{}',
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed default AI Safety constraints ────────────────────────────────────────
INSERT INTO iil_safety_constraints (constraint_type, constraint_name, rule_definition) VALUES
  ('child_protection',    'Minor Data Shield',         'No raw behavioural data exposed for users under 18 without consent'),
  ('anti_manipulation',   'Anti-Gamification Guard',   'Intervention CTAs must not exploit emotional vulnerability signals'),
  ('dignity_preservation','Dignity Score Floor',       'No intervention targeting users with dignity_risk > 0.8 without human review'),
  ('ethical_boundary',    'Explainability Mandate',    'Every risk flag must include explainability payload before display'),
  ('emotional_safeguard', 'Burnout Protection Buffer', 'Burnout probability > 0.75 triggers mandatory counsellor escalation')
ON CONFLICT DO NOTHING;
