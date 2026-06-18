-- ============================================================
-- Phase 4 — AI Governance + Localization + Predictive + Simulation
--          + Org Risk + Observability
-- Enhancement-only. All tables namespaced m4_*. Soft FK via TEXT
-- columns to onto_*, bench_*, sci_*, m3_*. No destructive changes.
-- ============================================================

-- 1. AI GOVERNANCE ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_ai_governance_policies (
  id            TEXT PRIMARY KEY,
  policy_code   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,           -- fairness|explainability|safety|risk|language
  scope         TEXT NOT NULL,           -- global|tenant|model
  enforcement   TEXT NOT NULL DEFAULT 'enforce', -- enforce|warn|monitor
  rules         JSONB NOT NULL DEFAULT '{}'::jsonb,
  version       TEXT DEFAULT '1.0.0',
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_model_registry (
  id            TEXT PRIMARY KEY,
  model_code    TEXT NOT NULL UNIQUE,
  family        TEXT NOT NULL,           -- predictive|fairness|forecast|simulation
  purpose       TEXT NOT NULL,
  current_version TEXT,
  risk_tier     TEXT DEFAULT 'medium',   -- low|medium|high
  owner         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_model_versions (
  id            TEXT PRIMARY KEY,
  model_id      TEXT NOT NULL REFERENCES m4_ai_model_registry(id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  released_at   TIMESTAMPTZ DEFAULT now(),
  changelog     TEXT,
  rollback_to   TEXT,
  artefact_ref  TEXT,
  status        TEXT DEFAULT 'active',   -- active|deprecated|rolled_back
  UNIQUE (model_id, version)
);

CREATE TABLE IF NOT EXISTS m4_ai_decision_logs (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  decision_type TEXT NOT NULL,
  subject_id    TEXT,
  input_hash    TEXT,
  output_summary JSONB DEFAULT '{}'::jsonb,
  confidence    NUMERIC(4,3),
  fairness_status TEXT,                  -- pass|warn|fail|unknown
  explainability_ref TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS m4_dec_subj_idx ON m4_ai_decision_logs(subject_id);
CREATE INDEX IF NOT EXISTS m4_dec_model_idx ON m4_ai_decision_logs(model_id);

CREATE TABLE IF NOT EXISTS m4_ai_explainability_logs (
  id            TEXT PRIMARY KEY,
  decision_id   TEXT REFERENCES m4_ai_decision_logs(id) ON DELETE CASCADE,
  envelope      JSONB NOT NULL,
  rationale     TEXT,
  language_check JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_fairness_scores (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  metric        TEXT NOT NULL,           -- demographic_parity|equal_opportunity|disparate_impact
  value         NUMERIC(6,4) NOT NULL,
  threshold     NUMERIC(6,4),
  status        TEXT NOT NULL,           -- pass|warn|fail
  cohort        TEXT,
  evaluated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_bias_detection_results (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  protected_attr TEXT NOT NULL,
  bias_score    NUMERIC(6,4),
  drift_delta   NUMERIC(6,4),
  status        TEXT NOT NULL,           -- pass|warn|fail
  detail        JSONB DEFAULT '{}'::jsonb,
  detected_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_risk_classifications (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  risk_tier     TEXT NOT NULL,           -- low|medium|high|critical
  drivers       JSONB DEFAULT '{}'::jsonb,
  controls      JSONB DEFAULT '{}'::jsonb,
  classified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_hallucination_flags (
  id            TEXT PRIMARY KEY,
  decision_id   TEXT REFERENCES m4_ai_decision_logs(id) ON DELETE CASCADE,
  flag_type     TEXT NOT NULL,           -- unsupported_claim|fabricated_metric|missing_evidence|policy_violation
  severity      TEXT NOT NULL,           -- low|medium|high
  detail        TEXT,
  flagged_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_audit_events (
  id            TEXT PRIMARY KEY,
  domain        TEXT NOT NULL,
  action        TEXT NOT NULL,
  actor         TEXT,
  subject_id    TEXT,
  payload       JSONB DEFAULT '{}'::jsonb,
  request_id    TEXT,
  ip            TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS m4_audit_domain_idx ON m4_ai_audit_events(domain);

-- 2. FAIRNESS / BIAS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_fairness_evaluations (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  cohort        TEXT,
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_status TEXT,
  evaluated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_bias_detection_runs (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  protected_attr TEXT NOT NULL,
  sample_n      INT,
  bias_score    NUMERIC(6,4),
  status        TEXT,
  detail        JSONB DEFAULT '{}'::jsonb,
  run_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_demographic_impact_analysis (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  attr          TEXT NOT NULL,
  group_label   TEXT NOT NULL,
  positive_rate NUMERIC(5,4),
  reference_rate NUMERIC(5,4),
  disparate_impact NUMERIC(6,4),
  status        TEXT,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_protected_attribute_checks (
  id            TEXT PRIMARY KEY,
  attr          TEXT NOT NULL UNIQUE,
  policy        TEXT NOT NULL,           -- excluded|controlled|monitored
  rationale     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_model_fairness_thresholds (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  metric        TEXT NOT NULL,
  warn_at       NUMERIC(6,4),
  fail_at       NUMERIC(6,4),
  UNIQUE (model_id, metric)
);

-- 3. LOCALIZATION -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_countries (
  id            TEXT PRIMARY KEY,
  iso2          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  region        TEXT,
  language      TEXT,
  labor_regime  TEXT
);

CREATE TABLE IF NOT EXISTS m4_country_workforce_profiles (
  id            TEXT PRIMARY KEY,
  country_id    TEXT NOT NULL REFERENCES m4_countries(id) ON DELETE CASCADE,
  market_maturity NUMERIC(4,3),         -- 0..1
  remote_norm   NUMERIC(4,3),
  formality     NUMERIC(4,3),
  notes         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_cultural_behavioral_norms (
  id            TEXT PRIMARY KEY,
  country_id    TEXT REFERENCES m4_countries(id) ON DELETE CASCADE,
  dimension     TEXT NOT NULL,           -- assertiveness|hierarchy|individualism|uncertainty|long_term|indulgence
  score         NUMERIC(5,2),            -- 0..100 Hofstede-style
  source        TEXT
);

CREATE TABLE IF NOT EXISTS m4_regional_competency_expectations (
  id            TEXT PRIMARY KEY,
  country_id    TEXT REFERENCES m4_countries(id) ON DELETE CASCADE,
  ontology_competency_id TEXT NOT NULL,  -- soft FK → onto_competencies
  expected_level NUMERIC(3,2),           -- 1..5
  weight_modifier NUMERIC(4,3) DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS m4_regional_leadership_models (
  id            TEXT PRIMARY KEY,
  country_id    TEXT REFERENCES m4_countries(id) ON DELETE CASCADE,
  model_name    TEXT NOT NULL,
  emphasis      JSONB DEFAULT '{}'::jsonb -- {strategic:1.1, empathy:1.2, ...}
);

CREATE TABLE IF NOT EXISTS m4_localization_weights (
  id            TEXT PRIMARY KEY,
  country_id    TEXT REFERENCES m4_countries(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL,
  weight        NUMERIC(4,3) DEFAULT 1.0,
  UNIQUE (country_id, competency_id)
);

CREATE TABLE IF NOT EXISTS m4_regional_language_policies (
  id            TEXT PRIMARY KEY,
  country_id    TEXT REFERENCES m4_countries(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  policy        JSONB DEFAULT '{}'::jsonb,
  sensitivities TEXT[]
);

-- 4. PREDICTIVE -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_capability_trajectories (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  baseline      NUMERIC(5,2),
  current       NUMERIC(5,2),
  velocity      NUMERIC(6,3),            -- pts/month, can be negative
  acceleration  NUMERIC(6,3),
  trajectory    TEXT,                    -- accelerating|stable|plateauing|declining|high_potential|leadership_emerging
  computed_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS m4_traj_subj_idx ON m4_capability_trajectories(subject_id);

CREATE TABLE IF NOT EXISTS m4_future_readiness_scores (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  horizon_months INT NOT NULL,
  readiness     NUMERIC(5,2),            -- 0..100
  contributors  JSONB DEFAULT '{}'::jsonb,
  confidence    NUMERIC(4,3),
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_promotion_readiness_predictions (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  target_role_id TEXT,                   -- soft FK → onto_roles
  readiness     NUMERIC(5,2),
  horizon_months INT,
  confidence    NUMERIC(4,3),
  band          TEXT,                    -- ready|developing|aspirational
  rationale     TEXT,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_leadership_potential_predictions (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  potential     NUMERIC(5,2),
  emergence_horizon_months INT,
  band          TEXT,                    -- emerging|established|aspirational
  drivers       JSONB DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_skill_decay_forecasts (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  decay_rate    NUMERIC(6,4),            -- pts/month
  half_life_months NUMERIC(6,2),
  obsolescence_horizon_months INT,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_burnout_risk_scores (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  risk          NUMERIC(5,2),            -- 0..100
  band          TEXT,                    -- low|moderate|elevated|high
  drivers       JSONB DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_future_capability_gaps (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  current       NUMERIC(5,2),
  required      NUMERIC(5,2),
  gap           NUMERIC(5,2),
  horizon_months INT,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_trajectory_classifications (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  description   TEXT
);

-- 5. LONGITUDINAL (enhancement, additive) ---------------------------------
CREATE TABLE IF NOT EXISTS m4_trajectory_events (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT,
  event_type    TEXT NOT NULL,           -- inflection|regression|breakthrough|plateau_entry|plateau_exit
  magnitude     NUMERIC(6,3),
  occurred_at   TIMESTAMPTZ DEFAULT now(),
  detail        JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS m4_capability_acceleration (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  window_months INT NOT NULL,
  acceleration  NUMERIC(6,3),
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_capability_stagnation (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  stagnant_months INT NOT NULL,
  severity      TEXT,                    -- mild|moderate|severe
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_longitudinal_forecasts (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  horizon_months INT NOT NULL,
  projection    NUMERIC(5,2),
  band_low      NUMERIC(5,2),
  band_high     NUMERIC(5,2),
  confidence    NUMERIC(4,3),
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_workforce_evolution_history (
  id            TEXT PRIMARY KEY,
  cohort        TEXT NOT NULL,
  snapshot_at   TIMESTAMPTZ DEFAULT now(),
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 6. SIMULATION -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_simulation_scenarios (
  id            TEXT PRIMARY KEY,
  scenario_code TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,           -- promotion|uplift|pipeline|intervention
  parameters    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_simulation_capability_models (
  id            TEXT PRIMARY KEY,
  scenario_id   TEXT REFERENCES m4_simulation_scenarios(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL,
  delta         NUMERIC(5,2) NOT NULL,
  weight        NUMERIC(4,3) DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS m4_simulation_results (
  id            TEXT PRIMARY KEY,
  scenario_id   TEXT REFERENCES m4_simulation_scenarios(id) ON DELETE CASCADE,
  subject_id    TEXT,
  baseline_readiness NUMERIC(5,2),
  projected_readiness NUMERIC(5,2),
  delta         NUMERIC(5,2),
  detail        JSONB DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_simulation_forecasts (
  id            TEXT PRIMARY KEY,
  scenario_id   TEXT REFERENCES m4_simulation_scenarios(id) ON DELETE CASCADE,
  horizon_months INT,
  projection    JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

-- 7. ORGANIZATIONAL RISK ----------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_organizational_capability_risks (
  id            TEXT PRIMARY KEY,
  org_unit      TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  risk          NUMERIC(5,2),
  band          TEXT,                    -- low|moderate|elevated|high|critical
  drivers       JSONB DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_succession_risk_scores (
  id            TEXT PRIMARY KEY,
  role_id       TEXT NOT NULL,
  successors_n  INT DEFAULT 0,
  ready_now     INT DEFAULT 0,
  ready_12m     INT DEFAULT 0,
  ready_24m     INT DEFAULT 0,
  risk          NUMERIC(5,2),
  band          TEXT,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_leadership_gap_predictions (
  id            TEXT PRIMARY KEY,
  org_unit      TEXT NOT NULL,
  horizon_months INT,
  gap_pct       NUMERIC(5,2),
  detail        JSONB DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_workforce_resilience_scores (
  id            TEXT PRIMARY KEY,
  org_unit      TEXT NOT NULL,
  resilience    NUMERIC(5,2),
  contributors  JSONB DEFAULT '{}'::jsonb,
  computed_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_critical_capability_risks (
  id            TEXT PRIMARY KEY,
  competency_id TEXT NOT NULL,
  org_unit      TEXT,
  criticality   NUMERIC(5,2),
  coverage      NUMERIC(5,2),
  risk          NUMERIC(5,2),
  computed_at   TIMESTAMPTZ DEFAULT now()
);

-- 8. OBSERVABILITY ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS m4_prediction_monitoring (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  metric        TEXT NOT NULL,
  value         NUMERIC(8,4),
  window_start  TIMESTAMPTZ,
  window_end    TIMESTAMPTZ,
  status        TEXT,                    -- pass|warn|fail
  recorded_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_forecast_accuracy_tracking (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  horizon_months INT,
  mape          NUMERIC(6,3),            -- mean absolute percentage error
  brier         NUMERIC(6,4),
  sample_n      INT,
  evaluated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_model_drift_detection (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES m4_ai_model_registry(id),
  drift_metric  TEXT NOT NULL,           -- psi|kl|js|wasserstein
  value         NUMERIC(6,4),
  threshold     NUMERIC(6,4),
  status        TEXT NOT NULL,
  detected_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m4_ai_observability_logs (
  id            TEXT PRIMARY KEY,
  level         TEXT NOT NULL,           -- info|warn|error
  source        TEXT,                    -- engine name
  event         TEXT NOT NULL,
  detail        JSONB DEFAULT '{}'::jsonb,
  recorded_at   TIMESTAMPTZ DEFAULT now()
);

-- 9. M4 AUDIT (engine-level, separate from ai_audit) ------------------------
CREATE TABLE IF NOT EXISTS m4_audit_logs (
  id            TEXT PRIMARY KEY,
  domain        TEXT NOT NULL,
  action        TEXT NOT NULL,
  subject_id    TEXT,
  payload       JSONB DEFAULT '{}'::jsonb,
  request_id    TEXT,
  ip            TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEED
-- ============================================================

-- Governance policies
INSERT INTO m4_ai_governance_policies(id, policy_code, name, category, scope, enforcement, rules) VALUES
  ('m4p_lang',  'LANG_SAFE',          'Safe Language Policy',           'language',       'global','enforce', '{"forbidden":["will fail","not suitable","poor candidate","cannot succeed","guaranteed promotion"],"allowed":["capability alignment","developmental readiness","leadership proximity","role readiness"]}'),
  ('m4p_fair',  'FAIRNESS_DEFAULT',   'Default Fairness Thresholds',    'fairness',       'global','enforce', '{"disparate_impact":{"warn":0.85,"fail":0.80},"demographic_parity":{"warn":0.10,"fail":0.20}}'),
  ('m4p_expl',  'EXPLAINABILITY_REQ', 'Explainability Required',        'explainability', 'global','enforce', '{"min_contributors":1,"must_include":["methodology","rationale","language_policy"]}'),
  ('m4p_safe',  'SAFETY_NEVER',       'Never Predict Hiring/Promotion', 'safety',         'global','enforce', '{"forbidden_outputs":["hiring_prediction","promotion_guarantee","psychological_diagnosis"]}'),
  ('m4p_risk',  'RISK_TIERING',       'Risk Tiering Policy',            'risk',           'global','enforce', '{"tiers":["low","medium","high","critical"]}')
ON CONFLICT (policy_code) DO NOTHING;

-- Model registry + versions
INSERT INTO m4_ai_model_registry(id, model_code, family, purpose, current_version, risk_tier, owner) VALUES
  ('m4m_pred', 'PRED_INTEL',  'predictive',  'Predictive workforce intelligence', '4.0.0', 'high',   'metryxone'),
  ('m4m_traj', 'TRAJECTORY',  'predictive',  'Capability trajectory classification', '4.0.0','medium','metryxone'),
  ('m4m_burn', 'BURNOUT',     'predictive',  'Burnout risk indicator',             '4.0.0','high',   'metryxone'),
  ('m4m_sim',  'SIM_WORKFORCE','simulation', 'Workforce what-if simulation',       '4.0.0','medium','metryxone'),
  ('m4m_fair', 'FAIRNESS_AUDIT','fairness',  'Fairness audit + bias detection',    '4.0.0','high',   'metryxone'),
  ('m4m_loc',  'LOCALIZATION','forecast',    'Regional benchmark calibration',     '4.0.0','low',    'metryxone'),
  ('m4m_obs',  'AI_OBS',      'forecast',    'Forecast accuracy + drift monitor',  '4.0.0','medium','metryxone')
ON CONFLICT (model_code) DO NOTHING;

INSERT INTO m4_ai_model_versions(id, model_id, version, changelog, status) VALUES
  ('m4mv_pred_400','m4m_pred','4.0.0','Phase 4 initial release','active'),
  ('m4mv_traj_400','m4m_traj','4.0.0','Phase 4 initial release','active'),
  ('m4mv_burn_400','m4m_burn','4.0.0','Phase 4 initial release','active'),
  ('m4mv_sim_400', 'm4m_sim', '4.0.0','Phase 4 initial release','active'),
  ('m4mv_fair_400','m4m_fair','4.0.0','Phase 4 initial release','active'),
  ('m4mv_loc_400', 'm4m_loc', '4.0.0','Phase 4 initial release','active'),
  ('m4mv_obs_400', 'm4m_obs', '4.0.0','Phase 4 initial release','active')
ON CONFLICT (model_id, version) DO NOTHING;

-- Protected attributes
INSERT INTO m4_protected_attribute_checks(id, attr, policy, rationale) VALUES
  ('m4pa_gender',    'gender',    'excluded',  'Not used as feature; monitored only for parity checks'),
  ('m4pa_age',       'age',       'monitored', 'Used only via experience proxy; bias monitored'),
  ('m4pa_ethnicity', 'ethnicity', 'excluded',  'Never used as feature; monitored externally'),
  ('m4pa_region',    'region',    'controlled','Used for localization weighting only')
ON CONFLICT (attr) DO NOTHING;

-- Fairness thresholds
INSERT INTO m4_model_fairness_thresholds(id, model_id, metric, warn_at, fail_at) VALUES
  ('m4ft_pred_di','m4m_pred','disparate_impact',    0.85, 0.80),
  ('m4ft_pred_dp','m4m_pred','demographic_parity',  0.10, 0.20),
  ('m4ft_pred_eo','m4m_pred','equal_opportunity',   0.10, 0.20),
  ('m4ft_traj_di','m4m_traj','disparate_impact',    0.85, 0.80),
  ('m4ft_burn_di','m4m_burn','disparate_impact',    0.85, 0.80)
ON CONFLICT (model_id, metric) DO NOTHING;

-- Sample fairness scores
INSERT INTO m4_ai_fairness_scores(id, model_id, metric, value, threshold, status, cohort) VALUES
  ('m4fs_001','m4m_pred','disparate_impact',  0.92, 0.85, 'pass','global'),
  ('m4fs_002','m4m_pred','demographic_parity',0.04, 0.10, 'pass','global'),
  ('m4fs_003','m4m_pred','equal_opportunity', 0.06, 0.10, 'pass','global'),
  ('m4fs_004','m4m_traj','disparate_impact',  0.88, 0.85, 'pass','global'),
  ('m4fs_005','m4m_burn','disparate_impact',  0.83, 0.85, 'warn','global')
ON CONFLICT DO NOTHING;

INSERT INTO m4_ai_bias_detection_results(id, model_id, protected_attr, bias_score, drift_delta, status) VALUES
  ('m4bd_001','m4m_pred','gender', 0.03, 0.005, 'pass'),
  ('m4bd_002','m4m_pred','age',    0.05, 0.012, 'pass'),
  ('m4bd_003','m4m_traj','gender', 0.04, 0.008, 'pass'),
  ('m4bd_004','m4m_burn','gender', 0.07, 0.018, 'warn')
ON CONFLICT DO NOTHING;

INSERT INTO m4_ai_risk_classifications(id, model_id, risk_tier, drivers, controls) VALUES
  ('m4rc_pred','m4m_pred','high',  '{"impact":"workforce decisions","reach":"enterprise"}','{"human_in_loop":true,"audit":true,"explainability":true}'),
  ('m4rc_traj','m4m_traj','medium','{"impact":"developmental"}','{"audit":true}'),
  ('m4rc_burn','m4m_burn','high',  '{"impact":"well-being signal"}','{"human_in_loop":true,"non_diagnostic":true}'),
  ('m4rc_sim', 'm4m_sim', 'medium','{"impact":"planning"}','{"sandbox":true}'),
  ('m4rc_fair','m4m_fair','high',  '{"impact":"compliance"}','{"audit":true}'),
  ('m4rc_loc', 'm4m_loc', 'low',   '{"impact":"calibration"}','{"audit":true}'),
  ('m4rc_obs', 'm4m_obs', 'medium','{"impact":"reliability"}','{"audit":true}')
ON CONFLICT DO NOTHING;

-- Countries + cultural norms
INSERT INTO m4_countries(id, iso2, name, region, language, labor_regime) VALUES
  ('m4c_us','US','United States','Americas','en','at-will'),
  ('m4c_in','IN','India',        'APAC',    'en','statutory'),
  ('m4c_jp','JP','Japan',        'APAC',    'ja','statutory'),
  ('m4c_de','DE','Germany',      'EMEA',    'de','codetermination'),
  ('m4c_ae','AE','United Arab Emirates','EMEA','ar','statutory')
ON CONFLICT (iso2) DO NOTHING;

INSERT INTO m4_country_workforce_profiles(id, country_id, market_maturity, remote_norm, formality) VALUES
  ('m4cwp_us','m4c_us',0.92,0.70,0.40),
  ('m4cwp_in','m4c_in',0.74,0.55,0.55),
  ('m4cwp_jp','m4c_jp',0.90,0.30,0.85),
  ('m4cwp_de','m4c_de',0.91,0.60,0.75),
  ('m4cwp_ae','m4c_ae',0.78,0.45,0.70)
ON CONFLICT DO NOTHING;

-- Hofstede-style dimensions for "assertiveness" + a few more
INSERT INTO m4_cultural_behavioral_norms(id, country_id, dimension, score, source) VALUES
  ('m4cbn_us_a','m4c_us','assertiveness',62,'hofstede'),
  ('m4cbn_in_a','m4c_in','assertiveness',56,'hofstede'),
  ('m4cbn_jp_a','m4c_jp','assertiveness',95,'hofstede'),
  ('m4cbn_de_a','m4c_de','assertiveness',66,'hofstede'),
  ('m4cbn_ae_a','m4c_ae','assertiveness',52,'hofstede'),
  ('m4cbn_us_h','m4c_us','hierarchy',     40,'hofstede'),
  ('m4cbn_in_h','m4c_in','hierarchy',     77,'hofstede'),
  ('m4cbn_jp_h','m4c_jp','hierarchy',     54,'hofstede'),
  ('m4cbn_de_h','m4c_de','hierarchy',     35,'hofstede'),
  ('m4cbn_ae_h','m4c_ae','hierarchy',     80,'hofstede')
ON CONFLICT DO NOTHING;

-- Regional competency expectations
INSERT INTO m4_regional_competency_expectations(id, country_id, ontology_competency_id, expected_level, weight_modifier) VALUES
  ('m4rce_us_lea','m4c_us','LEA',4.0,1.10),
  ('m4rce_us_str','m4c_us','STR',4.2,1.05),
  ('m4rce_jp_com','m4c_jp','COM',4.5,1.20),
  ('m4rce_jp_lea','m4c_jp','LEA',3.6,0.90),
  ('m4rce_de_str','m4c_de','STR',4.4,1.15),
  ('m4rce_in_adp','m4c_in','ADP',4.1,1.10),
  ('m4rce_ae_lea','m4c_ae','LEA',3.8,1.00)
ON CONFLICT DO NOTHING;

INSERT INTO m4_regional_leadership_models(id, country_id, model_name, emphasis) VALUES
  ('m4rlm_us','m4c_us','Visionary-Empowering','{"strategic":1.15,"empathy":1.05,"assertiveness":1.10}'),
  ('m4rlm_jp','m4c_jp','Consensus-Stewardship','{"empathy":1.20,"hierarchy_respect":1.20,"assertiveness":0.85}'),
  ('m4rlm_de','m4c_de','Systematic-Expert','{"strategic":1.20,"rigor":1.20}'),
  ('m4rlm_in','m4c_in','Mentor-Achiever','{"empathy":1.10,"adaptability":1.15}'),
  ('m4rlm_ae','m4c_ae','Authoritative-Relational','{"hierarchy_respect":1.20,"relational":1.15}')
ON CONFLICT DO NOTHING;

INSERT INTO m4_localization_weights(id, country_id, competency_id, weight) VALUES
  ('m4lw_us_lea','m4c_us','LEA',1.10),
  ('m4lw_jp_com','m4c_jp','COM',1.20),
  ('m4lw_de_str','m4c_de','STR',1.15),
  ('m4lw_in_adp','m4c_in','ADP',1.10),
  ('m4lw_ae_lea','m4c_ae','LEA',1.00)
ON CONFLICT (country_id, competency_id) DO NOTHING;

INSERT INTO m4_regional_language_policies(id, country_id, language_code, policy, sensitivities) VALUES
  ('m4rlp_us','m4c_us','en','{"register":"direct","explicit_feedback":true}',  ARRAY['legal_protected_classes']),
  ('m4rlp_jp','m4c_jp','ja','{"register":"indirect","face_preserving":true}',  ARRAY['public_critique','direct_negation']),
  ('m4rlp_de','m4c_de','de','{"register":"precise","factual":true}',           ARRAY['informal_address']),
  ('m4rlp_in','m4c_in','en','{"register":"relational","contextual":true}',     ARRAY['caste','religion']),
  ('m4rlp_ae','m4c_ae','ar','{"register":"formal","hierarchy_aware":true}',    ARRAY['religious_references','gender_specific'])
ON CONFLICT DO NOTHING;

-- Trajectory classifications
INSERT INTO m4_trajectory_classifications(id, code, label, description) VALUES
  ('m4tc_acc','accelerating','Accelerating','Positive acceleration > +0.5 pts/mo²; widening lead'),
  ('m4tc_sta','stable','Stable','Velocity within ±0.2 pts/mo; steady-state'),
  ('m4tc_pla','plateauing','Plateauing','Velocity ≤ 0.05 pts/mo for ≥3 months'),
  ('m4tc_dec','declining','Declining','Velocity negative; capability erosion'),
  ('m4tc_hip','high_potential','High Potential','Composite velocity > +1.5 pts/mo across leadership cluster'),
  ('m4tc_lem','leadership_emerging','Leadership Emerging','Inflection in LEA + STR + COM within 6 months')
ON CONFLICT (code) DO NOTHING;

-- Demo predictive seed for demo_user
INSERT INTO m4_capability_trajectories(id, subject_id, competency_id, baseline, current, velocity, acceleration, trajectory) VALUES
  ('m4ct_du_tec','demo_user','TEC',62.0,78.0,1.20,0.15,'accelerating'),
  ('m4ct_du_lea','demo_user','LEA',58.0,69.0,0.85,0.05,'stable'),
  ('m4ct_du_str','demo_user','STR',55.0,67.0,0.95,0.20,'accelerating'),
  ('m4ct_du_com','demo_user','COM',64.0,70.0,0.30,-0.10,'plateauing'),
  ('m4ct_du_eiq','demo_user','EIQ',60.0,71.0,0.80,0.10,'stable'),
  ('m4ct_du_adp','demo_user','ADP',57.0,68.0,0.85,0.05,'stable')
ON CONFLICT DO NOTHING;

INSERT INTO m4_future_readiness_scores(id, subject_id, horizon_months, readiness, contributors, confidence) VALUES
  ('m4frs_du_6', 'demo_user', 6, 71.5,'{"velocity":0.82,"learning_exposure":0.71,"market_alignment":0.74}',0.78),
  ('m4frs_du_12','demo_user',12, 76.8,'{"velocity":0.82,"learning_exposure":0.74,"market_alignment":0.76}',0.71),
  ('m4frs_du_24','demo_user',24, 80.2,'{"velocity":0.82,"learning_exposure":0.77,"market_alignment":0.79}',0.62)
ON CONFLICT DO NOTHING;

INSERT INTO m4_promotion_readiness_predictions(id, subject_id, target_role_id, readiness, horizon_months, confidence, band, rationale) VALUES
  ('m4prp_du_pm','demo_user','role_pm_sr',  72.0, 12, 0.74,'developing','Capability proximity to senior product role within 12 months given current velocity'),
  ('m4prp_du_em','demo_user','role_eng_mgr',64.0, 18, 0.66,'aspirational','Developmental opportunity exists with sustained leadership growth')
ON CONFLICT DO NOTHING;

INSERT INTO m4_leadership_potential_predictions(id, subject_id, potential, emergence_horizon_months, band, drivers) VALUES
  ('m4lpp_du','demo_user', 71.0, 12, 'emerging','{"LEA":0.69,"STR":0.67,"COM":0.70,"EIQ":0.71}')
ON CONFLICT DO NOTHING;

INSERT INTO m4_skill_decay_forecasts(id, subject_id, competency_id, decay_rate, half_life_months, obsolescence_horizon_months) VALUES
  ('m4sdf_du_tec','demo_user','TEC',0.25, 36, 60),
  ('m4sdf_du_com','demo_user','COM',0.10, 84, 120)
ON CONFLICT DO NOTHING;

INSERT INTO m4_burnout_risk_scores(id, subject_id, risk, band, drivers) VALUES
  ('m4brs_du','demo_user', 28.0, 'low','{"workload":0.30,"recovery":0.75,"variance":0.20,"signals":["balanced cadence"]}')
ON CONFLICT DO NOTHING;

INSERT INTO m4_future_capability_gaps(id, subject_id, competency_id, current, required, gap, horizon_months) VALUES
  ('m4fcg_du_lea','demo_user','LEA',69.0, 78.0,  9.0, 12),
  ('m4fcg_du_str','demo_user','STR',67.0, 75.0,  8.0, 12)
ON CONFLICT DO NOTHING;

-- Simulation seed
INSERT INTO m4_simulation_scenarios(id, scenario_code, name, kind, parameters) VALUES
  ('m4ss_str15','SCN_STR_UPLIFT_15','Strategic Thinking +15%','uplift','{"target":"STR","delta_pct":15}'),
  ('m4ss_lea10','SCN_LEA_UPLIFT_10','Leadership +10%',        'uplift','{"target":"LEA","delta_pct":10}'),
  ('m4ss_promo','SCN_PROMO_SIM',    'Promotion Readiness Sim','promotion','{"target_role":"role_pm_sr"}'),
  ('m4ss_pipe', 'SCN_PIPELINE',     'Leadership Pipeline 12m','pipeline','{"horizon":12}')
ON CONFLICT (scenario_code) DO NOTHING;

INSERT INTO m4_simulation_capability_models(id, scenario_id, competency_id, delta, weight) VALUES
  ('m4scm_str15_str','m4ss_str15','STR',15.0,1.0),
  ('m4scm_lea10_lea','m4ss_lea10','LEA',10.0,1.0)
ON CONFLICT DO NOTHING;

-- Org risk seed
INSERT INTO m4_organizational_capability_risks(id, org_unit, competency_id, risk, band, drivers) VALUES
  ('m4ocr_eng_tec','engineering','TEC',32.0,'moderate','{"coverage":0.76,"velocity":0.65}'),
  ('m4ocr_eng_lea','engineering','LEA',58.0,'elevated','{"coverage":0.48,"successor_gap":0.55}'),
  ('m4ocr_pm_str', 'product',    'STR',44.0,'moderate','{"coverage":0.62}'),
  ('m4ocr_hr_eiq', 'people',     'EIQ',22.0,'low',     '{"coverage":0.84}')
ON CONFLICT DO NOTHING;

INSERT INTO m4_succession_risk_scores(id, role_id, successors_n, ready_now, ready_12m, ready_24m, risk, band) VALUES
  ('m4srs_pm_sr','role_pm_sr',  6, 1, 2, 3, 38.0, 'moderate'),
  ('m4srs_em',   'role_eng_mgr',4, 0, 1, 2, 62.0, 'elevated'),
  ('m4srs_cto',  'role_cto',    2, 0, 0, 1, 78.0, 'high')
ON CONFLICT DO NOTHING;

INSERT INTO m4_leadership_gap_predictions(id, org_unit, horizon_months, gap_pct, detail) VALUES
  ('m4lgp_eng_12','engineering',12, 22.0,'{"open_seats":4,"pipeline_ready":1}'),
  ('m4lgp_pm_12', 'product',    12, 14.0,'{"open_seats":2,"pipeline_ready":1}')
ON CONFLICT DO NOTHING;

INSERT INTO m4_workforce_resilience_scores(id, org_unit, resilience, contributors) VALUES
  ('m4wrs_eng','engineering',62.0,'{"redundancy":0.55,"mobility":0.70,"learning_velocity":0.62}'),
  ('m4wrs_pm', 'product',    71.0,'{"redundancy":0.66,"mobility":0.74,"learning_velocity":0.74}'),
  ('m4wrs_hr', 'people',     78.0,'{"redundancy":0.80,"mobility":0.71,"learning_velocity":0.84}')
ON CONFLICT DO NOTHING;

INSERT INTO m4_critical_capability_risks(id, competency_id, org_unit, criticality, coverage, risk) VALUES
  ('m4ccr_eng_tec','TEC','engineering',92.0,76.0,22.0),
  ('m4ccr_eng_lea','LEA','engineering',88.0,48.0,52.0),
  ('m4ccr_pm_str', 'STR','product',    85.0,62.0,38.0)
ON CONFLICT DO NOTHING;

-- Observability seed (last 7d sample)
INSERT INTO m4_forecast_accuracy_tracking(id, model_id, horizon_months, mape, brier, sample_n) VALUES
  ('m4fat_pred_6', 'm4m_pred', 6,  8.4, 0.115, 250),
  ('m4fat_pred_12','m4m_pred',12, 12.7, 0.142, 220),
  ('m4fat_traj_6', 'm4m_traj', 6, 10.1, 0.131, 180)
ON CONFLICT DO NOTHING;

INSERT INTO m4_model_drift_detection(id, model_id, drift_metric, value, threshold, status) VALUES
  ('m4mdd_pred_psi','m4m_pred','psi',0.06,0.20,'pass'),
  ('m4mdd_traj_psi','m4m_traj','psi',0.11,0.20,'pass'),
  ('m4mdd_burn_psi','m4m_burn','psi',0.18,0.20,'warn')
ON CONFLICT DO NOTHING;
