-- ============================================================
-- Competency Assessment Factory (CAF) — Full Schema
-- Migration: 20260613_competency_assessment_factory.sql
-- Prefix: caf_*   Feature flag: FF_COMPETENCY_ASSESSMENT_FACTORY
-- All tables CREATE IF NOT EXISTS — fully idempotent
-- ============================================================

-- ── 1. Assessment Type Registry ──────────────────────────────

CREATE TABLE IF NOT EXISTS caf_assessment_types (
  id             SERIAL PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL,
  description    TEXT,
  scoring_model  TEXT NOT NULL,
  default_config JSONB NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO caf_assessment_types (code, label, description, scoring_model) VALUES
  ('behavioral',      'Behavioural Assessment',      'Measures observable behaviours against BARS anchors across 7 domains', 'BARS_RUBRIC'),
  ('functional',      'Functional Assessment',        'Tests role-specific knowledge via MCQ and scenario questions',         'WEIGHTED_CTT'),
  ('cognitive',       'Cognitive Ability Assessment', 'Measures reasoning ability via IRT-calibrated adaptive testing',      'IRT_3PL'),
  ('leadership',      'Leadership Assessment',        'Assesses leadership judgment via SJT expert-keyed items and BARS',    'SJT_EXPERT'),
  ('future_readiness','Future Readiness Assessment',  'Measures readiness across AI fluency, digital and learning dimensions','DIMENSIONAL')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Domain Codebook ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_domains (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  description     TEXT,
  assessment_type TEXT NOT NULL REFERENCES caf_assessment_types(code),
  maps_to_onto_code TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO caf_domains (code, label, assessment_type, sort_order) VALUES
  -- Behavioral (maps to existing 7 domains)
  ('COG', 'Cognitive & Analytical',         'behavioral', 1),
  ('COM', 'Communication & Influence',       'behavioral', 2),
  ('LEA', 'Leadership & People',             'behavioral', 3),
  ('EXE', 'Execution & Delivery',            'behavioral', 4),
  ('ADP', 'Adaptability & Growth',           'behavioral', 5),
  ('TEC', 'Technical & Domain',              'behavioral', 6),
  ('EIQ', 'Emotional & Social Intelligence', 'behavioral', 7),
  -- Cognitive (new)
  ('COG_VRB', 'Verbal Reasoning',     'cognitive', 1),
  ('COG_NUM', 'Numerical Reasoning',  'cognitive', 2),
  ('COG_ABS', 'Abstract Reasoning',   'cognitive', 3),
  ('COG_SPA', 'Spatial Reasoning',    'cognitive', 4),
  ('COG_WMM', 'Working Memory',       'cognitive', 5),
  -- Leadership (new)
  ('LEA_VIS', 'Strategic Vision',           'leadership', 1),
  ('LEA_PEO', 'People Development',          'leadership', 2),
  ('LEA_DEC', 'Decision Making',             'leadership', 3),
  ('LEA_CHG', 'Change Leadership',           'leadership', 4),
  ('LEA_EXE', 'Execution Excellence',        'leadership', 5),
  ('LEA_INF', 'Stakeholder Influence',       'leadership', 6),
  -- Future Readiness (new)
  ('FR_AIF', 'AI Fluency',           'future_readiness', 1),
  ('FR_DGA', 'Digital Adaptability', 'future_readiness', 2),
  ('FR_LAG', 'Learning Agility',     'future_readiness', 3),
  ('FR_SYS', 'Systemic Thinking',    'future_readiness', 4),
  ('FR_FUT', 'Future Orientation',   'future_readiness', 5)
ON CONFLICT (code) DO NOTHING;

-- ── 3. Scenario Framework ──────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_scenarios (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  assessment_type TEXT NOT NULL REFERENCES caf_assessment_types(code),
  title           TEXT NOT NULL,
  context         TEXT NOT NULL,
  context_type    TEXT NOT NULL CHECK (context_type IN (
                    'situational_judgment','case_study','roleplay','incident','data_prompt')),
  character_personas     JSONB,
  domain_codes    TEXT[] NOT NULL DEFAULT '{}',
  difficulty_tier TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty_tier IN ('easy','medium','hard')),
  industry_tags   TEXT[] NOT NULL DEFAULT '{}',
  role_tags       TEXT[] NOT NULL DEFAULT '{}',
  media_refs      JSONB NOT NULL DEFAULT '{}',
  word_count      INTEGER,
  reading_time_seconds INTEGER GENERATED ALWAYS AS (
    CASE WHEN word_count IS NOT NULL THEN ceil(word_count::float / 2.5)::integer ELSE NULL END
  ) STORED,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caf_scenario_branches (
  id              BIGSERIAL PRIMARY KEY,
  scenario_id     BIGINT NOT NULL REFERENCES caf_scenarios(id),
  source_question_id BIGINT,
  response_value_matches JSONB NOT NULL,
  next_question_id BIGINT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_caf_scenarios_type ON caf_scenarios(assessment_type);

-- ── 4. Question Bank ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_question_bank (
  id                  BIGSERIAL PRIMARY KEY,
  assessment_type     TEXT NOT NULL REFERENCES caf_assessment_types(code),
  question_type       TEXT NOT NULL CHECK (question_type IN (
                        'MCQ','MULTI_SELECT','LIKERT','BARS_RATING','SITUATIONAL_JUDGMENT',
                        'SCENARIO_MCQ','PRIORITIZATION','DATA_INTERPRETATION',
                        'OPEN_RUBRIC','COMPARATIVE_JUDGMENT','KNOWLEDGE_PROBE')),
  stem                TEXT NOT NULL,
  domain_code         TEXT NOT NULL,
  competency_id       INTEGER,
  indicator_id        INTEGER,
  scenario_id         BIGINT REFERENCES caf_scenarios(id),
  level_code          TEXT NOT NULL DEFAULT 'L3' CHECK (level_code IN ('L1','L2','L3','L4','L5')),
  difficulty_tier     TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty_tier IN ('easy','medium','hard')),
  cognitive_level     TEXT CHECK (cognitive_level IN (
                        'RECALL','COMPREHENSION','APPLICATION','ANALYSIS','SYNTHESIS','EVALUATION')),
  polarity            TEXT NOT NULL DEFAULT 'positive' CHECK (polarity IN ('positive','negative')),
  reverse_score       BOOLEAN NOT NULL DEFAULT false,
  is_anchor_item      BOOLEAN NOT NULL DEFAULT false,
  rubric              JSONB,
  expert_key          JSONB,
  importance_weight   FLOAT NOT NULL DEFAULT 1.0,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  language_policy     JSONB NOT NULL DEFAULT '{}',
  -- IRT parameters (null until calibrated)
  irt_a               FLOAT,
  irt_b               FLOAT,
  irt_c               FLOAT DEFAULT 0.0,
  calibration_status  TEXT NOT NULL DEFAULT 'uncalibrated' CHECK (calibration_status IN (
                        'uncalibrated','pilot','calibrated','stable')),
  calibration_n       INTEGER NOT NULL DEFAULT 0,
  calibration_rmsea   FLOAT,
  last_calibrated_at  TIMESTAMPTZ,
  -- Lifecycle
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','deprecated')),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  version             INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caf_qb_type_domain  ON caf_question_bank(assessment_type, domain_code);
CREATE INDEX IF NOT EXISTS idx_caf_qb_status       ON caf_question_bank(status, is_active);
CREATE INDEX IF NOT EXISTS idx_caf_qb_scenario     ON caf_question_bank(scenario_id) WHERE scenario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_caf_qb_calibration  ON caf_question_bank(calibration_status);

-- Question options (MCQ, SJT, MULTI_SELECT, COMPARATIVE_JUDGMENT)
CREATE TABLE IF NOT EXISTS caf_question_options (
  id              BIGSERIAL PRIMARY KEY,
  question_id     BIGINT NOT NULL REFERENCES caf_question_bank(id) ON DELETE CASCADE,
  option_key      TEXT NOT NULL,
  text            TEXT NOT NULL,
  score_value     FLOAT NOT NULL DEFAULT 0,
  is_correct      BOOLEAN,
  distractor_type TEXT CHECK (distractor_type IN ('plausible','common_error','partial')),
  feedback        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(question_id, option_key)
);

CREATE INDEX IF NOT EXISTS idx_caf_options_question ON caf_question_options(question_id);

-- ── 5. Difficulty Calibrations ────────────────────────────

CREATE TABLE IF NOT EXISTS caf_difficulty_calibrations (
  id                  SERIAL PRIMARY KEY,
  assessment_type     TEXT NOT NULL UNIQUE REFERENCES caf_assessment_types(code),
  label               TEXT NOT NULL,
  irt_model           TEXT NOT NULL DEFAULT '3PL' CHECK (irt_model IN ('1PL','2PL','3PL')),
  tier_definitions    JSONB NOT NULL DEFAULT '{
    "easy":   {"irt_b_min": -3.0, "irt_b_max": -0.5, "p_value_min": 0.70, "p_value_max": 1.00},
    "medium": {"irt_b_min": -0.5, "irt_b_max":  0.5, "p_value_min": 0.40, "p_value_max": 0.69},
    "hard":   {"irt_b_min":  0.5, "irt_b_max":  3.0, "p_value_min": 0.10, "p_value_max": 0.39}
  }',
  passing_thresholds  JSONB NOT NULL DEFAULT '{
    "L1": 0.40, "L2": 0.55, "L3": 0.70, "L4": 0.82, "L5": 0.92
  }',
  default_difficulty_dist JSONB NOT NULL DEFAULT '{
    "easy": 0.25, "medium": 0.50, "hard": 0.25
  }',
  calibration_method  TEXT NOT NULL DEFAULT 'CTT',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO caf_difficulty_calibrations (assessment_type, label, irt_model, default_difficulty_dist) VALUES
  ('behavioral',      'Behavioral Difficulty Calibration',      '1PL', '{"easy":0.15,"medium":0.50,"hard":0.35}'),
  ('functional',      'Functional Difficulty Calibration',      '2PL', '{"easy":0.30,"medium":0.45,"hard":0.25}'),
  ('cognitive',       'Cognitive Difficulty Calibration',       '3PL', '{"easy":0.25,"medium":0.40,"hard":0.35}'),
  ('leadership',      'Leadership Difficulty Calibration',      '1PL', '{"easy":0.10,"medium":0.40,"hard":0.50}'),
  ('future_readiness','Future Readiness Difficulty Calibration','1PL', '{"easy":0.40,"medium":0.45,"hard":0.15}')
ON CONFLICT (assessment_type) DO NOTHING;

-- ── 6. Level Framework ────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_level_frameworks (
  id               SERIAL PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  label            TEXT NOT NULL,
  description      TEXT,
  band_thresholds  JSONB NOT NULL DEFAULT '{
    "L1": {"min": 0,  "max": 39},
    "L2": {"min": 40, "max": 59},
    "L3": {"min": 60, "max": 74},
    "L4": {"min": 75, "max": 89},
    "L5": {"min": 90, "max": 100}
  }',
  level_labels     JSONB NOT NULL DEFAULT '{
    "L1": "Foundation",
    "L2": "Developing",
    "L3": "Proficient",
    "L4": "Advanced",
    "L5": "Expert"
  }',
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO caf_level_frameworks (code, label, is_default) VALUES
  ('DEFAULT_5L',     'Standard Five-Level Framework', true),
  ('LEADERSHIP_5L',  'Leadership Five-Level Framework', false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS caf_level_anchors (
  id               SERIAL PRIMARY KEY,
  framework_id     INTEGER NOT NULL REFERENCES caf_level_frameworks(id),
  assessment_type  TEXT NOT NULL,
  level_code       TEXT NOT NULL CHECK (level_code IN ('L1','L2','L3','L4','L5')),
  domain_code      TEXT NOT NULL,
  level_label      TEXT NOT NULL,
  anchor_text      TEXT NOT NULL,
  behavioral_indicators JSONB NOT NULL DEFAULT '[]',
  evidence_examples     JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(framework_id, assessment_type, level_code, domain_code)
);

CREATE INDEX IF NOT EXISTS idx_caf_level_anchors_type ON caf_level_anchors(assessment_type, domain_code);

-- ── 7. Assessment Builder Tables ──────────────────────────

CREATE TABLE IF NOT EXISTS caf_assessments (
  id                  BIGSERIAL PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  assessment_type     TEXT NOT NULL REFERENCES caf_assessment_types(code),
  level_framework_id  INTEGER NOT NULL REFERENCES caf_level_frameworks(id),
  difficulty_cal_id   INTEGER REFERENCES caf_difficulty_calibrations(id),
  label               TEXT NOT NULL,
  description         TEXT,
  instructions        TEXT,
  total_questions     INTEGER NOT NULL DEFAULT 20,
  time_limit_seconds  INTEGER,
  adaptive            BOOLEAN NOT NULL DEFAULT false,
  allow_review        BOOLEAN NOT NULL DEFAULT true,
  randomize_options   BOOLEAN NOT NULL DEFAULT true,
  domain_weights      JSONB NOT NULL DEFAULT '{}',
  scoring_config      JSONB NOT NULL DEFAULT '{}',
  language_policy     JSONB NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  version             INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caf_assessments_type   ON caf_assessments(assessment_type, status);

CREATE TABLE IF NOT EXISTS caf_assessment_sections (
  id              BIGSERIAL PRIMARY KEY,
  assessment_id   BIGINT NOT NULL REFERENCES caf_assessments(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  instructions    TEXT,
  domain_codes    TEXT[] NOT NULL DEFAULT '{}',
  scoring_method  TEXT NOT NULL DEFAULT 'weighted_sum' CHECK (scoring_method IN (
                    'weighted_sum','irt_theta','mean','max_score')),
  question_count  INTEGER NOT NULL DEFAULT 5,
  time_limit_seconds INTEGER,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_required     BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_caf_sections_assessment ON caf_assessment_sections(assessment_id);

CREATE TABLE IF NOT EXISTS caf_section_questions (
  id              BIGSERIAL PRIMARY KEY,
  section_id      BIGINT NOT NULL REFERENCES caf_assessment_sections(id) ON DELETE CASCADE,
  question_id     BIGINT REFERENCES caf_question_bank(id),
  is_fixed        BOOLEAN NOT NULL DEFAULT false,
  pool_group      TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(section_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_caf_sq_section ON caf_section_questions(section_id);

-- ── 8. Randomization Rules ────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_randomization_rules (
  id                    BIGSERIAL PRIMARY KEY,
  assessment_id         BIGINT NOT NULL UNIQUE REFERENCES caf_assessments(id),
  strategy              TEXT NOT NULL DEFAULT 'stratified' CHECK (strategy IN (
                          'fixed','stratified','purely_random','adaptive','fixed_parallel')),
  difficulty_distribution JSONB NOT NULL DEFAULT '{"easy":0.25,"medium":0.50,"hard":0.25}',
  ensure_coverage       TEXT[] NOT NULL DEFAULT '{}',
  seed_mode             TEXT NOT NULL DEFAULT 'session' CHECK (seed_mode IN ('session','daily','global')),
  max_daily_exposure    INTEGER NOT NULL DEFAULT 50,
  user_cooldown_days    INTEGER NOT NULL DEFAULT 90,
  n_parallel_forms      INTEGER NOT NULL DEFAULT 1,
  pool_groups           JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 9. Score Rules ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_score_rules (
  id              BIGSERIAL PRIMARY KEY,
  assessment_id   BIGINT NOT NULL REFERENCES caf_assessments(id),
  section_id      BIGINT REFERENCES caf_assessment_sections(id),
  dimension_code  TEXT,
  label           TEXT NOT NULL,
  scoring_method  TEXT NOT NULL CHECK (scoring_method IN (
                    'BARS_RUBRIC','WEIGHTED_CTT','IRT_3PL','SJT_EXPERT','DIMENSIONAL','MEAN','SUM')),
  weight          FLOAT NOT NULL DEFAULT 1.0,
  config          JSONB NOT NULL DEFAULT '{}',
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caf_score_rules_assessment ON caf_score_rules(assessment_id);

-- ── 10. Session Tables ────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id      BIGINT NOT NULL REFERENCES caf_assessments(id),
  user_id            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                       'draft','in_progress','paused','completed',
                       'abandoned','expired','invalidated')),
  context            JSONB NOT NULL DEFAULT '{}',
  question_order     JSONB NOT NULL DEFAULT '[]',
  current_position   INTEGER NOT NULL DEFAULT 0,
  adaptive_state     JSONB NOT NULL DEFAULT '{"theta":0.0,"se":1.0,"history":[]}',
  pause_count        INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ,
  paused_at          TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  ip_address         TEXT,
  user_agent         TEXT,
  proctoring_events  JSONB NOT NULL DEFAULT '[]',
  flagged            BOOLEAN NOT NULL DEFAULT false,
  flag_reason        TEXT,
  invalidated_by     TEXT,
  invalidated_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caf_sessions_user       ON caf_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_caf_sessions_assessment ON caf_sessions(assessment_id, status);
CREATE INDEX IF NOT EXISTS idx_caf_sessions_expires    ON caf_sessions(expires_at) WHERE status IN ('draft','in_progress','paused');

-- ── 11. Response Table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_responses (
  id                   BIGSERIAL PRIMARY KEY,
  session_id           UUID NOT NULL REFERENCES caf_sessions(id),
  question_id          BIGINT NOT NULL REFERENCES caf_question_bank(id),
  sequence_position    INTEGER NOT NULL,
  response_value       JSONB NOT NULL,
  raw_score            FLOAT,
  is_correct           BOOLEAN,
  is_skipped           BOOLEAN NOT NULL DEFAULT false,
  is_revised           BOOLEAN NOT NULL DEFAULT false,
  first_response_value JSONB,
  time_taken_secs      FLOAT,
  confidence_level     INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  flagged_for_review   BOOLEAN NOT NULL DEFAULT false,
  scored_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_caf_responses_session  ON caf_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_caf_responses_question ON caf_responses(question_id);

-- ── 12. Score Tables ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_scores (
  id                   BIGSERIAL PRIMARY KEY,
  session_id           UUID NOT NULL REFERENCES caf_sessions(id),
  score_rule_id        INTEGER REFERENCES caf_score_rules(id),
  dimension_code       TEXT NOT NULL,
  raw_score            FLOAT NOT NULL,
  scaled_score         FLOAT NOT NULL,
  theta_estimate       FLOAT,
  theta_se             FLOAT,
  percentile           FLOAT,
  confidence_tier      TEXT CHECK (confidence_tier IN ('A','B','C','D','provisional')),
  level_code           TEXT CHECK (level_code IN ('L1','L2','L3','L4','L5')),
  is_primary           BOOLEAN NOT NULL DEFAULT false,
  scoring_version      INTEGER NOT NULL DEFAULT 1,
  scored_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, dimension_code)
);

CREATE INDEX IF NOT EXISTS idx_caf_scores_session ON caf_scores(session_id);

-- ── 13. Item Analytics ────────────────────────────────────

CREATE TABLE IF NOT EXISTS caf_item_stats (
  id                   BIGSERIAL PRIMARY KEY,
  question_id          BIGINT NOT NULL REFERENCES caf_question_bank(id) UNIQUE,
  n_administered       INTEGER NOT NULL DEFAULT 0,
  n_correct            INTEGER,
  p_value              FLOAT,
  point_biserial       FLOAT,
  discrimination_index FLOAT,
  distractor_analysis  JSONB NOT NULL DEFAULT '{}',
  mean_time_secs       FLOAT,
  std_time_secs        FLOAT,
  skip_rate            FLOAT NOT NULL DEFAULT 0,
  revision_rate        FLOAT NOT NULL DEFAULT 0,
  irt_fit_rmsea        FLOAT,
  drift_detected       BOOLEAN NOT NULL DEFAULT false,
  drift_baseline_p     FLOAT,
  drift_at_n           INTEGER,
  quality_flag         TEXT NOT NULL DEFAULT 'good' CHECK (quality_flag IN ('good','review','retire')),
  quality_override     BOOLEAN NOT NULL DEFAULT false,
  last_computed_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 14. Psychometric Calibration Reports ─────────────────

CREATE TABLE IF NOT EXISTS caf_psychometric_calibrations (
  id                      BIGSERIAL PRIMARY KEY,
  assessment_id           BIGINT NOT NULL REFERENCES caf_assessments(id),
  report_date             DATE NOT NULL,
  n_sessions              INTEGER NOT NULL,
  cronbachs_alpha         FLOAT,
  mcdonalds_omega         FLOAT,
  sem                     FLOAT,
  split_half_reliability  FLOAT,
  domain_alphas           JSONB NOT NULL DEFAULT '{}',
  inter_item_correlations JSONB NOT NULL DEFAULT '{}',
  kmo_measure             FLOAT,
  n_factors_suggested     INTEGER,
  factor_loadings         JSONB NOT NULL DEFAULT '{}',
  floor_pct               FLOAT,
  ceiling_pct             FLOAT,
  theta_mean              FLOAT,
  theta_sd                FLOAT,
  theta_min               FLOAT,
  theta_max               FLOAT,
  dif_results             JSONB NOT NULL DEFAULT '{}',
  quality_advisory        JSONB NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_caf_psycho_assessment ON caf_psychometric_calibrations(assessment_id, report_date DESC);

-- ── Utility function: bump assessment version ─────────────

CREATE OR REPLACE FUNCTION caf_bump_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER caf_assessments_version
  BEFORE UPDATE OF status ON caf_assessments
  FOR EACH ROW
  WHEN (OLD.status = 'draft' AND NEW.status = 'active')
  EXECUTE FUNCTION caf_bump_version();

-- ── End of migration ──────────────────────────────────────
