-- METRYXONE BIOS — NHDA: National Human Development Analytics Migration
-- 25 tables covering all 31 sections of the NHDA specification

-- ── Sovereign Regions (multi-tenant sovereign architecture) ──────────────────
CREATE TABLE IF NOT EXISTS nhda_regions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_name     TEXT NOT NULL,
  region_type     TEXT DEFAULT 'national' CHECK (region_type IN ('national','state','district','city','zone')),
  parent_id       UUID REFERENCES nhda_regions(id),
  country         TEXT DEFAULT 'IN',
  population      BIGINT DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 2: Population Signal Aggregation ──────────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_population_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL CHECK (signal_type IN (
    'behavioural','emotional','cognitive','workforce','educational',
    'institutional','economic','demographic','resilience','environmental'
  )),
  cohort_segment  TEXT, -- youth/working_age/senior/student/employed/unemployed
  signal_data     JSONB DEFAULT '{}',
  anomaly_score   NUMERIC(5,4) DEFAULT 0,
  confidence      NUMERIC(5,4) DEFAULT 0.8,
  weak_signal     BOOLEAN DEFAULT FALSE,
  is_systemic     BOOLEAN DEFAULT FALSE,
  population_size BIGINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nhda_signals_region ON nhda_population_signals(region_id);
CREATE INDEX IF NOT EXISTS idx_nhda_signals_type ON nhda_population_signals(signal_type);

-- ── Section 3: National Human Capital Genome Engine ──────────────────────────
CREATE TABLE IF NOT EXISTS nhda_genome_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE UNIQUE,
  workforce_dna   JSONB DEFAULT '{}', -- {productivity, adaptability, specialization, collaboration}
  resilience_dna  NUMERIC(5,2) DEFAULT 50,
  innovation_dna  NUMERIC(5,2) DEFAULT 50,
  leadership_dna  JSONB DEFAULT '{}',
  learning_adaptability NUMERIC(5,2) DEFAULT 50,
  hidden_capability_clusters JSONB DEFAULT '[]',
  skill_mutations  JSONB DEFAULT '[]',
  innovation_emergence BOOLEAN DEFAULT FALSE,
  genome_version  INTEGER DEFAULT 1,
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 4: National Behavioural Climate Engine ───────────────────────────
CREATE TABLE IF NOT EXISTS nhda_behavioural_climate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  engagement_climate    NUMERIC(5,2) DEFAULT 50,
  productivity_climate  NUMERIC(5,2) DEFAULT 50,
  innovation_climate    NUMERIC(5,2) DEFAULT 50,
  collaboration_climate NUMERIC(5,2) DEFAULT 50,
  resilience_climate    NUMERIC(5,2) DEFAULT 50,
  composite_climate     NUMERIC(5,2) DEFAULT 50,
  disengagement_risk    NUMERIC(5,4) DEFAULT 0,
  instability_risk      NUMERIC(5,4) DEFAULT 0,
  productivity_decline  NUMERIC(5,4) DEFAULT 0,
  hidden_deterioration  BOOLEAN DEFAULT FALSE,
  calculated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date)
);

-- ── Section 5: National Emotional Climate Engine ─────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_emotional_climate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  ecosystem_stability   NUMERIC(5,2) DEFAULT 50,
  societal_anxiety      NUMERIC(5,2) DEFAULT 25,
  burnout_propagation   NUMERIC(5,2) DEFAULT 20,
  ecosystem_morale      NUMERIC(5,2) DEFAULT 55,
  resilience_sustainability NUMERIC(5,2) DEFAULT 55,
  emotional_contagion_risk  NUMERIC(5,4) DEFAULT 0,
  societal_fatigue      NUMERIC(5,2) DEFAULT 20,
  collapse_risk         NUMERIC(5,4) DEFAULT 0,
  hidden_instability    BOOLEAN DEFAULT FALSE,
  calculated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date)
);

-- ── Section 6: National Cognitive Capacity Engine ────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_cognitive_capacity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  learning_capacity       NUMERIC(5,2) DEFAULT 55,
  innovation_capability   NUMERIC(5,2) DEFAULT 50,
  strategic_adaptability  NUMERIC(5,2) DEFAULT 50,
  abstraction_capability  NUMERIC(5,2) DEFAULT 50,
  problem_solving_maturity NUMERIC(5,2) DEFAULT 50,
  cognitive_fragmentation  NUMERIC(5,4) DEFAULT 0,
  learning_overload        NUMERIC(5,4) DEFAULT 0,
  innovation_stagnation    BOOLEAN DEFAULT FALSE,
  capability_collapse_risk NUMERIC(5,4) DEFAULT 0,
  calculated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date)
);

-- ── Section 7: National Human Development Index Engine ───────────────────────
CREATE TABLE IF NOT EXISTS nhda_hdi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  education_score         NUMERIC(5,2) DEFAULT 50,
  employability_score     NUMERIC(5,2) DEFAULT 50,
  resilience_score        NUMERIC(5,2) DEFAULT 50,
  innovation_score        NUMERIC(5,2) DEFAULT 50,
  emotional_stability     NUMERIC(5,2) DEFAULT 50,
  leadership_capacity     NUMERIC(5,2) DEFAULT 50,
  cognitive_capability    NUMERIC(5,2) DEFAULT 50,
  nhdi_score              NUMERIC(5,2) DEFAULT 50,
  nhdi_grade              TEXT DEFAULT 'Developing' CHECK (nhdi_grade IN ('Critical','Fragile','Developing','Stable','Thriving')),
  percentile_rank         NUMERIC(5,2),
  calculated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date)
);

CREATE TABLE IF NOT EXISTS nhda_hdi_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id       UUID,
  nhdi_score      NUMERIC(5,2),
  nhdi_grade      TEXT,
  snapshot        JSONB,
  captured_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 8: National Stability & Collapse Forecasting ─────────────────────
CREATE TABLE IF NOT EXISTS nhda_collapse_forecasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  forecast_type   TEXT CHECK (forecast_type IN (
    'workforce_instability','educational_collapse','institutional_deterioration',
    'emotional_collapse','resilience_collapse','societal_instability'
  )),
  probability     NUMERIC(5,4) DEFAULT 0,
  severity        TEXT CHECK (severity IN ('low','moderate','high','critical')),
  time_horizon_days INTEGER DEFAULT 90,
  early_warning_signals JSONB DEFAULT '[]',
  fragility_indicators  JSONB DEFAULT '[]',
  policy_recommendation TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  forecasted_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 9: National Recovery Intelligence ─────────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_recovery_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  recovery_type   TEXT,
  recovery_velocity    NUMERIC(8,4) DEFAULT 0,
  stability_score      NUMERIC(5,2) DEFAULT 50,
  sustainability_score NUMERIC(5,2) DEFAULT 50,
  recovery_momentum    NUMERIC(8,4) DEFAULT 0,
  phase           TEXT DEFAULT 'initial' CHECK (phase IN ('initial','accelerating','stabilizing','sustained','complete')),
  policy_intervention TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── Section 10: National Opportunity & Innovation Engine ─────────────────────
CREATE TABLE IF NOT EXISTS nhda_opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  opportunity_type TEXT CHECK (opportunity_type IN (
    'workforce_strength','innovation_ecosystem','leadership_ecosystem',
    'capability_cluster','resilience_breakthrough','talent_acceleration'
  )),
  title           TEXT NOT NULL,
  description     TEXT,
  strength_score  NUMERIC(5,2) DEFAULT 50,
  amplification_potential NUMERIC(5,4) DEFAULT 0,
  population_segment TEXT,
  status          TEXT DEFAULT 'detected' CHECK (status IN ('detected','acknowledged','actioned','realised')),
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 11: National Identity & Cohesion Engine ──────────────────────────
CREATE TABLE IF NOT EXISTS nhda_identity_cohesion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  societal_cohesion    NUMERIC(5,2) DEFAULT 60,
  institutional_trust  NUMERIC(5,2) DEFAULT 60,
  collective_resilience NUMERIC(5,2) DEFAULT 55,
  civic_engagement     NUMERIC(5,2) DEFAULT 55,
  collaboration_index  NUMERIC(5,2) DEFAULT 55,
  cohesion_composite   NUMERIC(5,2) DEFAULT 57,
  fragmentation_risk   NUMERIC(5,4) DEFAULT 0,
  polarization_risk    NUMERIC(5,4) DEFAULT 0,
  trust_collapse_risk  NUMERIC(5,4) DEFAULT 0,
  UNIQUE(region_id, period_date)
);

-- ── Section 12: Strategic Talent Mobility Engine ─────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_talent_mobility (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  talent_migration_rate NUMERIC(5,4) DEFAULT 0,
  capability_flow_score NUMERIC(5,2) DEFAULT 50,
  workforce_transitions INTEGER DEFAULT 0,
  leadership_mobility   NUMERIC(5,2) DEFAULT 50,
  innovation_mobility   NUMERIC(5,2) DEFAULT 50,
  talent_drain_risk     NUMERIC(5,4) DEFAULT 0,
  capability_concentration NUMERIC(5,4) DEFAULT 0,
  workforce_asymmetry   NUMERIC(5,4) DEFAULT 0,
  UNIQUE(region_id, period_date)
);

-- ── Section 13: National Drift & Entropy Engine ───────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_drift_entropy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  workforce_drift     NUMERIC(5,4) DEFAULT 0,
  educational_drift   NUMERIC(5,4) DEFAULT 0,
  behavioural_drift   NUMERIC(5,4) DEFAULT 0,
  emotional_drift     NUMERIC(5,4) DEFAULT 0,
  societal_fragmentation NUMERIC(5,4) DEFAULT 0,
  entropy_score       NUMERIC(5,2) DEFAULT 0,
  instability         NUMERIC(5,2) DEFAULT 0,
  fragmentation       NUMERIC(5,2) DEFAULT 0,
  unpredictability    NUMERIC(5,2) DEFAULT 0,
  alert_level         TEXT DEFAULT 'normal' CHECK (alert_level IN ('normal','elevated','warning','critical')),
  UNIQUE(region_id, period_date)
);

-- ── Section 14: Population Behavioural Contagion Engine ──────────────────────
CREATE TABLE IF NOT EXISTS nhda_contagion_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  contagion_type  TEXT CHECK (contagion_type IN ('engagement','burnout','innovation','resilience','emotional')),
  population_segment TEXT,
  spread_velocity NUMERIC(8,4) DEFAULT 0,
  affected_population BIGINT DEFAULT 0,
  affected_ratio  NUMERIC(5,4) DEFAULT 0,
  severity        TEXT DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  containment_status TEXT DEFAULT 'spreading' CHECK (containment_status IN ('spreading','contained','resolved')),
  policy_response TEXT,
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 15: National Knowledge & Memory Graph ────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_knowledge_graph (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID,
  node_type       TEXT CHECK (node_type IN ('Citizen','Institution','Workforce','Behaviour','Outcome','Policy','Risk','Opportunity')),
  node_key        TEXT NOT NULL UNIQUE,
  node_label      TEXT,
  properties      JSONB DEFAULT '{}',
  embedding_vector JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nhda_graph_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  from_node_id    UUID REFERENCES nhda_knowledge_graph(id),
  to_node_id      UUID REFERENCES nhda_knowledge_graph(id),
  edge_type       TEXT,
  weight          NUMERIC(5,4) DEFAULT 1.0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 17: National Digital Twin Engine ──────────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_digital_twins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE UNIQUE,
  twin_type       TEXT DEFAULT 'population' CHECK (twin_type IN ('population','workforce','resilience','policy','civilization')),
  twin_state      JSONB DEFAULT '{}',
  twin_version    INTEGER DEFAULT 1,
  last_sync_at    TIMESTAMPTZ DEFAULT NOW(),
  simulation_ready BOOLEAN DEFAULT FALSE,
  experiments     JSONB DEFAULT '[]',
  stress_results  JSONB DEFAULT '[]',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 18: Civilization Intelligence Engine ──────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_civilization_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  period_date     DATE DEFAULT CURRENT_DATE,
  long_term_resilience    NUMERIC(5,2) DEFAULT 50,
  innovation_sustainability NUMERIC(5,2) DEFAULT 50,
  collective_intelligence  NUMERIC(5,2) DEFAULT 50,
  national_adaptability    NUMERIC(5,2) DEFAULT 50,
  societal_evolution_score NUMERIC(5,2) DEFAULT 50,
  civilization_stagnation  BOOLEAN DEFAULT FALSE,
  capability_decline_risk  NUMERIC(5,4) DEFAULT 0,
  resilience_sustainability NUMERIC(5,4) DEFAULT 0,
  projection_50yr         JSONB DEFAULT '{}',
  calculated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date)
);

-- ── Section 19: Synthetic National Simulation Engine ─────────────────────────
CREATE TABLE IF NOT EXISTS nhda_simulations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  simulation_type TEXT CHECK (simulation_type IN (
    'workforce_evolution','resilience_recovery','innovation_acceleration',
    'educational_reform_impact','societal_collapse_prevention','policy_optimization'
  )),
  parameters      JSONB DEFAULT '{}',
  results         JSONB DEFAULT '{}',
  confidence      NUMERIC(5,4) DEFAULT 0.8,
  iterations      INTEGER DEFAULT 100,
  status          TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── Section 20: National Forecast Market Engine ───────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_forecast_market (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  forecast_horizon TEXT CHECK (forecast_horizon IN ('30d','90d','1y','5y','10y')),
  outcome_type    TEXT,
  probability     NUMERIC(5,4) DEFAULT 0,
  confidence_interval_low  NUMERIC(5,2),
  confidence_interval_high NUMERIC(5,2),
  scenarios       JSONB DEFAULT '[]',
  policy_levers   JSONB DEFAULT '[]',
  generated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 21: National Fairness & AI Safety Engine ─────────────────────────
CREATE TABLE IF NOT EXISTS nhda_fairness_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID REFERENCES nhda_regions(id) ON DELETE CASCADE,
  audit_type      TEXT CHECK (audit_type IN ('regional','cohort','educational','workforce','policy')),
  dimension       TEXT,
  bias_score      NUMERIC(5,4) DEFAULT 0,
  affected_segment TEXT,
  severity        TEXT DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  remediation     TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  audited_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 22: National Governance & Human Override Engine ──────────────────
CREATE TABLE IF NOT EXISTS nhda_governance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID,
  record_type     TEXT CHECK (record_type IN ('audit','compliance','escalation','override','policy_action','sovereign_review')),
  action          TEXT NOT NULL,
  actor           TEXT,
  actor_role      TEXT,
  target_entity   TEXT,
  metadata        JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_review','approved','rejected','resolved')),
  escalation_level INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ── Section 24: National Research Cloud ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_research_studies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID,
  study_name      TEXT NOT NULL,
  study_type      TEXT CHECK (study_type IN (
    'longitudinal','workforce_readiness','psychometric_validation',
    'policy_experimentation','resilience_study','innovation_study'
  )),
  hypothesis      TEXT,
  parameters      JSONB DEFAULT '{}',
  results         JSONB DEFAULT '{}',
  dataset_size    BIGINT DEFAULT 0,
  reproducible    BOOLEAN DEFAULT TRUE,
  status          TEXT DEFAULT 'designing' CHECK (status IN ('designing','running','analyzing','complete','published')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 25: Self-Healing National Intelligence Engine ─────────────────────
CREATE TABLE IF NOT EXISTS nhda_self_healing_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  model_component TEXT NOT NULL,
  healing_type    TEXT CHECK (healing_type IN (
    'weight_recalibration','anomaly_correction','norm_update',
    'pattern_discovery','threshold_adjustment','autonomous_reoptimization'
  )),
  before_state    JSONB DEFAULT '{}',
  after_state     JSONB DEFAULT '{}',
  trigger_event   TEXT,
  performance_delta NUMERIC(8,4) DEFAULT 0,
  population_impact BIGINT DEFAULT 0,
  approved        BOOLEAN DEFAULT FALSE,
  healed_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 27: Event-Driven National Orchestration ──────────────────────────
CREATE TABLE IF NOT EXISTS nhda_events_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID,
  event_type      TEXT CHECK (event_type IN (
    'POPULATION_SIGNAL_CAPTURED','NATIONAL_HEALTH_UPDATED','POLICY_IMPACT_FORECASTED',
    'RISK_ESCALATED','DRIFT_DETECTED','TRAJECTORY_UPDATED','TRUST_CHANGED'
  )),
  payload         JSONB DEFAULT '{}',
  processed       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Section 29: Sovereign Audit Trail ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nhda_audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  region_id       UUID,
  actor           TEXT,
  actor_role      TEXT,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed default regions ──────────────────────────────────────────────────────
INSERT INTO nhda_regions (region_name, region_type, country, population) VALUES
  ('India', 'national', 'IN', 1400000000),
  ('Maharashtra', 'state', 'IN', 120000000),
  ('Tamil Nadu', 'state', 'IN', 80000000),
  ('Karnataka', 'state', 'IN', 67000000),
  ('Delhi', 'state', 'IN', 32000000)
ON CONFLICT DO NOTHING;
