-- Phase 5: Enterprise Workforce Intelligence + AI Coaching + Executive Decision Intelligence
-- Enhancement-only. Namespaced m5_* to avoid collision with existing p5_*/gov_*/wos_*.

-- ============================================================================
-- 1. ENTERPRISE WORKFORCE INTELLIGENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_organizational_capabilities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  competency_id TEXT,
  capability_name TEXT NOT NULL,
  current_level NUMERIC(5,2) DEFAULT 0,
  target_level NUMERIC(5,2) DEFAULT 80,
  coverage_pct NUMERIC(5,2) DEFAULT 0,
  criticality TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_organizational_capability_maps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  department TEXT,
  competency_id TEXT,
  mean_score NUMERIC(5,2),
  median_score NUMERIC(5,2),
  p25 NUMERIC(5,2), p75 NUMERIC(5,2),
  sample_n INT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_workforce_capability_heatmaps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  department TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  intensity NUMERIC(5,2),
  risk_tier TEXT DEFAULT 'green',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, department, competency_id)
);

CREATE TABLE IF NOT EXISTS m5_workforce_maturity_scores (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scope TEXT NOT NULL, scope_id TEXT,
  maturity_level INT,
  maturity_score NUMERIC(5,2),
  consistency NUMERIC(4,3),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_organizational_skill_gaps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  current NUMERIC(5,2),
  target NUMERIC(5,2),
  gap NUMERIC(5,2),
  affected_population INT,
  severity TEXT DEFAULT 'medium',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_department_capability_scores (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  department TEXT NOT NULL,
  capability_score NUMERIC(5,2),
  leadership_score NUMERIC(5,2),
  readiness_score NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_enterprise_capability_indices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  index_type TEXT NOT NULL,
  index_value NUMERIC(5,2),
  contributors JSONB DEFAULT '{}'::jsonb,
  confidence_tier TEXT DEFAULT 'B',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_workforce_readiness_scores (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scope TEXT NOT NULL, scope_id TEXT,
  readiness_score NUMERIC(5,2),
  band_low NUMERIC(5,2), band_high NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. SUCCESSION PLANNING
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_succession_candidates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  target_role_id TEXT NOT NULL,
  leadership_capability NUMERIC(5,2),
  strategic_readiness NUMERIC(5,2),
  mobility_alignment NUMERIC(5,2),
  future_potential NUMERIC(5,2),
  reliability_confidence NUMERIC(4,3),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_succession_readiness (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES m5_succession_candidates(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5,2),
  readiness_band TEXT,
  time_to_ready_months INT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_leadership_successor_paths (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  target_role_id TEXT NOT NULL,
  candidate_user_id TEXT NOT NULL,
  path_steps JSONB DEFAULT '[]'::jsonb,
  estimated_months INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_critical_role_successors (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  criticality TEXT DEFAULT 'high',
  successor_count INT DEFAULT 0,
  bench_depth TEXT DEFAULT 'low',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_leadership_gap_risks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  layer TEXT NOT NULL,
  open_positions INT DEFAULT 0,
  ready_now INT DEFAULT 0,
  ready_12m INT DEFAULT 0,
  ready_24m INT DEFAULT 0,
  risk_level TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_bench_strength_scores (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  layer TEXT NOT NULL,
  strength_score NUMERIC(5,2),
  depth INT,
  diversity_index NUMERIC(4,3),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. AI CAREER COACHING
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_career_growth_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT,
  target_role_id TEXT,
  horizon_months INT DEFAULT 12,
  plan JSONB DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_learning_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  competency_id TEXT,
  resource_type TEXT,
  resource_title TEXT,
  expected_uplift NUMERIC(5,2),
  priority INT DEFAULT 5,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_coaching_interventions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  intervention_type TEXT NOT NULL,
  competency_id TEXT,
  description TEXT,
  expected_outcome TEXT,
  status TEXT DEFAULT 'recommended',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_mentor_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mentor_user_id TEXT,
  mentor_profile JSONB DEFAULT '{}'::jsonb,
  match_score NUMERIC(4,3),
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_career_transition_guidance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_role_id TEXT,
  to_role_id TEXT,
  guidance JSONB DEFAULT '{}'::jsonb,
  feasibility NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_development_journeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  journey_name TEXT,
  milestones JSONB DEFAULT '[]'::jsonb,
  current_milestone INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_capability_growth_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  competency_id TEXT,
  baseline NUMERIC(5,2),
  target NUMERIC(5,2),
  horizon_months INT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. WORKFORCE SIMULATION 2.0
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_organizational_simulations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scenario_code TEXT NOT NULL,
  scenario_name TEXT,
  inputs JSONB DEFAULT '{}'::jsonb,
  horizon_months INT DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_capability_uplift_models (
  id TEXT PRIMARY KEY,
  simulation_id TEXT REFERENCES m5_organizational_simulations(id) ON DELETE CASCADE,
  competency_id TEXT,
  baseline NUMERIC(5,2),
  uplift_pct NUMERIC(5,2),
  projected NUMERIC(5,2),
  band_low NUMERIC(5,2), band_high NUMERIC(5,2)
);

CREATE TABLE IF NOT EXISTS m5_learning_impact_models (
  id TEXT PRIMARY KEY,
  simulation_id TEXT REFERENCES m5_organizational_simulations(id) ON DELETE CASCADE,
  investment NUMERIC(12,2),
  expected_roi NUMERIC(6,3),
  capability_lift NUMERIC(5,2),
  payback_months INT
);

CREATE TABLE IF NOT EXISTS m5_leadership_pipeline_simulations (
  id TEXT PRIMARY KEY,
  simulation_id TEXT REFERENCES m5_organizational_simulations(id) ON DELETE CASCADE,
  layer TEXT,
  baseline_ready INT,
  projected_ready INT,
  improvement_pct NUMERIC(5,2)
);

CREATE TABLE IF NOT EXISTS m5_future_workforce_forecasts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  horizon_months INT,
  projected_capability NUMERIC(5,2),
  projected_leadership NUMERIC(5,2),
  projected_resilience NUMERIC(5,2),
  band_low NUMERIC(5,2), band_high NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_workforce_transformation_scenarios (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scenario_code TEXT NOT NULL,
  description TEXT,
  inputs JSONB DEFAULT '{}'::jsonb,
  expected_outcomes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. EXECUTIVE DECISION INTELLIGENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_executive_workforce_insights (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  headline TEXT,
  detail TEXT,
  severity TEXT DEFAULT 'medium',
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_strategic_workforce_risks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  risk_type TEXT NOT NULL,
  description TEXT,
  likelihood NUMERIC(4,3),
  impact NUMERIC(4,3),
  composite_risk NUMERIC(5,2),
  mitigation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_future_capability_forecasts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  competency_id TEXT,
  horizon_months INT,
  projected NUMERIC(5,2),
  band_low NUMERIC(5,2), band_high NUMERIC(5,2),
  shortage_risk TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_enterprise_transformation_readiness (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  readiness_score NUMERIC(5,2),
  pillars JSONB DEFAULT '{}'::jsonb,
  band TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_workforce_strategy_recommendations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  priority INT DEFAULT 5,
  recommendation TEXT,
  rationale TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  expected_impact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. ORGANIZATIONAL BENCHMARKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_organizational_benchmarks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  peer_cohort TEXT,
  metric TEXT NOT NULL,
  org_value NUMERIC(6,2),
  cohort_p50 NUMERIC(6,2),
  cohort_p90 NUMERIC(6,2),
  percentile NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_industry_workforce_benchmarks (
  id TEXT PRIMARY KEY,
  industry TEXT NOT NULL,
  metric TEXT NOT NULL,
  p25 NUMERIC(6,2), p50 NUMERIC(6,2), p75 NUMERIC(6,2), p90 NUMERIC(6,2),
  sample_n INT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_enterprise_maturity_benchmarks (
  id TEXT PRIMARY KEY,
  industry TEXT,
  maturity_dimension TEXT,
  level_1 NUMERIC(5,2), level_2 NUMERIC(5,2),
  level_3 NUMERIC(5,2), level_4 NUMERIC(5,2), level_5 NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_leadership_benchmarks (
  id TEXT PRIMARY KEY,
  industry TEXT,
  layer TEXT,
  capability_p50 NUMERIC(5,2),
  bench_depth_p50 NUMERIC(4,2),
  succession_p50 NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. ORGANIZATIONAL GRAPH INTELLIGENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_organizational_graph_nodes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_id TEXT NOT NULL,
  label TEXT,
  attributes JSONB DEFAULT '{}'::jsonb,
  UNIQUE(org_id, node_type, node_id)
);

CREATE TABLE IF NOT EXISTS m5_organizational_relationships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  source_node_id TEXT,
  target_node_id TEXT,
  relation_type TEXT,
  weight NUMERIC(5,3) DEFAULT 1,
  attributes JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS m5_department_relationship_graph (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  dept_a TEXT,
  dept_b TEXT,
  collaboration_strength NUMERIC(4,3),
  shared_capabilities INT
);

CREATE TABLE IF NOT EXISTS m5_leadership_influence_graph (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  leader_user_id TEXT,
  influence_score NUMERIC(5,2),
  influence_radius INT,
  centrality NUMERIC(4,3)
);

-- ============================================================================
-- 8. AI DECISION SUPPORT
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_executive_recommendations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INT DEFAULT 5,
  recommendation TEXT,
  rationale TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  expected_impact JSONB DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_strategy_recommendation_logs (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT REFERENCES m5_executive_recommendations(id) ON DELETE CASCADE,
  action TEXT,
  actor TEXT,
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_organizational_intervention_recommendations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scope TEXT,
  intervention TEXT,
  rationale TEXT,
  expected_outcome TEXT,
  status TEXT DEFAULT 'recommended',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. ENTERPRISE OBSERVABILITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS m5_enterprise_observability_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_simulation_accuracy_tracking (
  id TEXT PRIMARY KEY,
  simulation_id TEXT,
  predicted NUMERIC(6,2),
  actual NUMERIC(6,2),
  mape NUMERIC(6,3),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_organizational_forecast_accuracy (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  forecast_type TEXT,
  mape NUMERIC(6,3),
  brier NUMERIC(6,3),
  psi NUMERIC(6,3),
  drift_status TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS m5_executive_decision_audits (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  recommendation_id TEXT,
  decision TEXT,
  decided_by TEXT,
  rationale TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (engine writes)
CREATE TABLE IF NOT EXISTS m5_audit_logs (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  org_id TEXT,
  subject_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SEED DATA
-- ============================================================================
INSERT INTO m5_organizational_capabilities(id, org_id, competency_id, capability_name, current_level, target_level, coverage_pct, criticality) VALUES
('m5oc_a','demo_org','strategic_thinking','Strategic Thinking',62,85,71,'high'),
('m5oc_b','demo_org','leadership','Leadership',58,80,66,'high'),
('m5oc_c','demo_org','digital_fluency','Digital Fluency',74,85,82,'medium'),
('m5oc_d','demo_org','change_management','Change Management',54,80,58,'high'),
('m5oc_e','demo_org','analytical_reasoning','Analytical Reasoning',68,80,77,'medium')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_workforce_capability_heatmaps(id, org_id, department, competency_id, intensity, risk_tier) VALUES
('m5hm_1','demo_org','Engineering','strategic_thinking',58,'amber'),
('m5hm_2','demo_org','Engineering','leadership',55,'amber'),
('m5hm_3','demo_org','Engineering','digital_fluency',82,'green'),
('m5hm_4','demo_org','Sales','strategic_thinking',66,'amber'),
('m5hm_5','demo_org','Sales','leadership',61,'amber'),
('m5hm_6','demo_org','Sales','digital_fluency',70,'green'),
('m5hm_7','demo_org','Operations','strategic_thinking',52,'red'),
('m5hm_8','demo_org','Operations','leadership',50,'red'),
('m5hm_9','demo_org','Operations','digital_fluency',64,'amber'),
('m5hm_10','demo_org','Product','strategic_thinking',74,'green'),
('m5hm_11','demo_org','Product','leadership',69,'amber'),
('m5hm_12','demo_org','Product','digital_fluency',81,'green')
ON CONFLICT (org_id, department, competency_id) DO NOTHING;

INSERT INTO m5_department_capability_scores(id, org_id, department, capability_score, leadership_score, readiness_score) VALUES
('m5dc_1','demo_org','Engineering',71,62,68),
('m5dc_2','demo_org','Sales',66,64,65),
('m5dc_3','demo_org','Operations',58,55,57),
('m5dc_4','demo_org','Product',76,71,74)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_organizational_skill_gaps(id, org_id, competency_id, current, target, gap, affected_population, severity) VALUES
('m5sg_1','demo_org','strategic_thinking',62,85,23,420,'high'),
('m5sg_2','demo_org','leadership',58,80,22,540,'high'),
('m5sg_3','demo_org','change_management',54,80,26,380,'critical'),
('m5sg_4','demo_org','digital_fluency',74,85,11,210,'medium'),
('m5sg_5','demo_org','analytical_reasoning',68,80,12,290,'medium')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_enterprise_capability_indices(id, org_id, index_type, index_value, contributors, confidence_tier) VALUES
('m5eci_1','demo_org','workforce_capability',68.5,'{"workforce":68.5,"coverage":0.71}'::jsonb,'B'),
('m5eci_2','demo_org','leadership_strength',62.0,'{"layers":[58,61,65,68]}'::jsonb,'B'),
('m5eci_3','demo_org','future_readiness',64.2,'{"trajectory":"stable","velocity":0.42}'::jsonb,'B'),
('m5eci_4','demo_org','workforce_agility',66.8,'{"mobility":0.62,"redundancy":0.71}'::jsonb,'B'),
('m5eci_5','demo_org','strategic_resilience',61.5,'{"redundancy":0.65,"mobility":0.58,"velocity":0.62}'::jsonb,'B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_succession_candidates(id, org_id, user_id, target_role_id, leadership_capability, strategic_readiness, mobility_alignment, future_potential, reliability_confidence) VALUES
('m5sc_1','demo_org','user_001','role_director_engineering',72,68,75,78,0.82),
('m5sc_2','demo_org','user_002','role_director_engineering',64,61,68,71,0.78),
('m5sc_3','demo_org','user_003','role_vp_sales',78,74,72,75,0.85),
('m5sc_4','demo_org','user_004','role_chief_product',69,72,70,80,0.80),
('m5sc_5','demo_org','user_005','role_vp_sales',55,58,62,65,0.72)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_critical_role_successors(id, org_id, role_id, criticality, successor_count, bench_depth) VALUES
('m5crs_1','demo_org','role_director_engineering','high',2,'medium'),
('m5crs_2','demo_org','role_vp_sales','high',2,'medium'),
('m5crs_3','demo_org','role_chief_product','critical',1,'low'),
('m5crs_4','demo_org','role_cto','critical',0,'none'),
('m5crs_5','demo_org','role_cfo','critical',1,'low')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_leadership_gap_risks(id, org_id, layer, open_positions, ready_now, ready_12m, ready_24m, risk_level) VALUES
('m5lgr_1','demo_org','executive',3,0,1,2,'high'),
('m5lgr_2','demo_org','senior_management',8,2,4,6,'medium'),
('m5lgr_3','demo_org','middle_management',15,5,9,12,'low')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_bench_strength_scores(id, org_id, layer, strength_score, depth, diversity_index) VALUES
('m5bss_1','demo_org','executive',48,3,0.42),
('m5bss_2','demo_org','senior_management',62,8,0.55),
('m5bss_3','demo_org','middle_management',71,15,0.61)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_organizational_simulations(id, org_id, scenario_code, scenario_name, inputs, horizon_months) VALUES
('m5sim_1','demo_org','LEADERSHIP_UPLIFT_12','Leadership Capability +12%','{"competencies":["leadership","strategic_thinking"],"uplift_pct":12}'::jsonb,12),
('m5sim_2','demo_org','LEARNING_INVEST_500K','Learning Investment $500K','{"investment":500000,"focus":["digital_fluency","change_management"]}'::jsonb,18),
('m5sim_3','demo_org','TRANSFORMATION_DIGITAL','Digital Transformation Push','{"capabilities":["digital_fluency","analytical_reasoning"],"uplift_pct":18}'::jsonb,24)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_executive_workforce_insights(id, org_id, insight_type, headline, detail, severity, metrics) VALUES
('m5ei_1','demo_org','capability_shortage','Leadership bench is thin at executive layer','Only 3 successors across 3 critical executive roles; 0 ready now.','high','{"layer":"executive","ready_now":0}'::jsonb),
('m5ei_2','demo_org','transformation_risk','Change management capability lags strategic intent','Coverage at 58%; gap of 26 points against target.','high','{"gap":26,"affected":380}'::jsonb),
('m5ei_3','demo_org','positive_signal','Product organization shows strongest workforce maturity','Capability 76, leadership 71, readiness 74 — leading all departments.','low','{"dept":"Product"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_strategic_workforce_risks(id, org_id, risk_type, description, likelihood, impact, composite_risk, mitigation) VALUES
('m5swr_1','demo_org','succession_gap','Executive layer succession gap',0.72,0.85,73.4,'Accelerate executive-development pipeline; identify external candidates for CTO.'),
('m5swr_2','demo_org','capability_obsolescence','Analytical capability not keeping pace with AI exposure',0.65,0.70,61.5,'Targeted upskilling in analytical reasoning + digital fluency.'),
('m5swr_3','demo_org','transformation_drag','Change management capability constrains transformation',0.78,0.75,73.8,'Embed change-management coaching in middle-management programs.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_enterprise_transformation_readiness(id, org_id, readiness_score, pillars, band) VALUES
('m5etr_1','demo_org',63.5,'{"capability":68,"leadership":62,"agility":67,"resilience":61,"change_capacity":60}'::jsonb,'developing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_workforce_strategy_recommendations(id, org_id, priority, recommendation, rationale, evidence, expected_impact) VALUES
('m5wsr_1','demo_org',1,'Launch executive bench acceleration program','Bench depth at executive layer is critical risk (3 successors / 3 critical roles)','{"bench_strength":48,"open_positions":3,"ready_now":0}'::jsonb,'Reduce executive succession risk by ~30% over 18 months'),
('m5wsr_2','demo_org',2,'Establish change-management academy','Change-management gap of 26 points blocks transformation','{"gap":26,"affected":380}'::jsonb,'Lift change-management capability by 15–20 points over 12 months'),
('m5wsr_3','demo_org',3,'Targeted analytical-AI upskilling','Analytical reasoning lags AI exposure trajectory','{"gap":12,"trajectory":"stable"}'::jsonb,'Reduce capability obsolescence risk by ~25%')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_organizational_benchmarks(id, org_id, peer_cohort, metric, org_value, cohort_p50, cohort_p90, percentile) VALUES
('m5ob_1','demo_org','tech_mid_market','workforce_capability_index',68.5,65.2,78.5,62),
('m5ob_2','demo_org','tech_mid_market','leadership_strength_index',62.0,64.8,76.2,38),
('m5ob_3','demo_org','tech_mid_market','future_readiness_index',64.2,62.5,74.0,58),
('m5ob_4','demo_org','tech_mid_market','workforce_agility_index',66.8,63.0,75.5,68),
('m5ob_5','demo_org','tech_mid_market','strategic_resilience_index',61.5,60.8,72.0,52)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_industry_workforce_benchmarks(id, industry, metric, p25, p50, p75, p90, sample_n) VALUES
('m5iwb_1','technology','workforce_capability_index',58,65.2,72,78.5,240),
('m5iwb_2','technology','leadership_strength_index',55,64.8,71,76.2,240),
('m5iwb_3','financial_services','workforce_capability_index',60,67.5,74,80,180),
('m5iwb_4','manufacturing','workforce_capability_index',55,62.0,68,74,150)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_leadership_benchmarks(id, industry, layer, capability_p50, bench_depth_p50, succession_p50) VALUES
('m5lb_1','technology','executive',68,2.5,55),
('m5lb_2','technology','senior_management',65,4.8,62),
('m5lb_3','technology','middle_management',62,7.5,68)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_organizational_graph_nodes(id, org_id, node_type, node_id, label, attributes) VALUES
('m5gn_1','demo_org','department','Engineering','Engineering','{"headcount":420}'::jsonb),
('m5gn_2','demo_org','department','Sales','Sales','{"headcount":280}'::jsonb),
('m5gn_3','demo_org','department','Operations','Operations','{"headcount":190}'::jsonb),
('m5gn_4','demo_org','department','Product','Product','{"headcount":140}'::jsonb)
ON CONFLICT (org_id, node_type, node_id) DO NOTHING;

INSERT INTO m5_department_relationship_graph(id, org_id, dept_a, dept_b, collaboration_strength, shared_capabilities) VALUES
('m5drg_1','demo_org','Engineering','Product',0.82,5),
('m5drg_2','demo_org','Sales','Product',0.71,3),
('m5drg_3','demo_org','Engineering','Operations',0.58,4),
('m5drg_4','demo_org','Sales','Operations',0.45,2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_leadership_influence_graph(id, org_id, leader_user_id, influence_score, influence_radius, centrality) VALUES
('m5lig_1','demo_org','user_001',78,4,0.72),
('m5lig_2','demo_org','user_003',82,5,0.81),
('m5lig_3','demo_org','user_004',74,3,0.65)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_executive_recommendations(id, org_id, category, priority, recommendation, rationale, evidence, expected_impact, confidence) VALUES
('m5er_1','demo_org','succession',1,'Build CTO and Chief Product successor pool','0 ready-now successors for CTO; 1 for Chief Product','{"bench_strength_executive":48}'::jsonb,'{"succession_risk_reduction":0.30,"horizon_months":18}'::jsonb,0.82),
('m5er_2','demo_org','capability_investment',2,'Invest $500K in change-management capability','Largest organizational gap (26 points); affects 380 employees','{"gap":26,"roi_estimate":2.4}'::jsonb,'{"capability_lift":18,"horizon_months":12}'::jsonb,0.78),
('m5er_3','demo_org','transformation',3,'Sequence digital transformation behind capability uplift','Current capability 74 against target 85; sequencing reduces execution risk','{"capability":74,"target":85}'::jsonb,'{"execution_risk_reduction":0.22}'::jsonb,0.74)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_organizational_intervention_recommendations(id, org_id, scope, intervention, rationale, expected_outcome) VALUES
('m5oir_1','demo_org','department:Operations','Leadership coaching cohort','Operations has lowest leadership score (50)','Lift leadership score by 10–12 points over 9 months'),
('m5oir_2','demo_org','layer:executive','External executive bench-build','Bench depth at executive layer is critical','Add 2–3 external-candidate successors'),
('m5oir_3','demo_org','dept:Engineering','Strategic-thinking workshop series','Engineering strategic-thinking score 58 vs target 85','Lift by 12–15 points over 12 months')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_organizational_forecast_accuracy(id, org_id, forecast_type, mape, brier, psi, drift_status) VALUES
('m5ofa_1','demo_org','workforce_capability',0.082,0.124,0.045,'stable'),
('m5ofa_2','demo_org','leadership_strength',0.105,0.142,0.078,'stable'),
('m5ofa_3','demo_org','succession_readiness',0.137,0.168,0.142,'warning')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m5_enterprise_observability_logs(id, org_id, event_type, payload) VALUES
('m5eol_1','demo_org','simulation_run','{"simulation_id":"m5sim_1","duration_ms":48}'::jsonb),
('m5eol_2','demo_org','recommendation_generated','{"recommendation_id":"m5er_1","confidence":0.82}'::jsonb),
('m5eol_3','demo_org','forecast_recorded','{"forecast_type":"workforce_capability","mape":0.082}'::jsonb)
ON CONFLICT (id) DO NOTHING;
