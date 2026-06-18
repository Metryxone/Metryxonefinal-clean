-- MetryxOne Competency Assessment Factory (CAF) — Migration
-- Created: 2026-06-10
-- Prefix: caf_*  Base path: /api/caf/*

-- ── Question Bank ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_question_bank (
  id                  SERIAL      PRIMARY KEY,
  code                VARCHAR(40) NOT NULL UNIQUE,
  assessment_type     VARCHAR(30) NOT NULL CHECK (assessment_type IN ('behavioral','functional','cognitive','leadership','future_readiness')),
  stem                TEXT        NOT NULL,
  response_format     VARCHAR(30) NOT NULL DEFAULT 'likert_5'
                        CHECK (response_format IN ('likert_5','likert_7','mcq','free_text','ranking','situational_judgment','scenario_choice','multi_select')),
  competency_id       INTEGER,
  indicator_id        INTEGER,
  level_code          VARCHAR(20),
  domain              VARCHAR(80),
  sub_domain          VARCHAR(80),
  scenario_id         INTEGER,
  difficulty_tier     VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (difficulty_tier IN ('easy','medium','hard')),
  irt_a               NUMERIC(6,4),
  irt_b               NUMERIC(6,4),
  irt_c               NUMERIC(6,4),
  p_value             NUMERIC(5,4),
  point_biserial      NUMERIC(5,4),
  time_estimate_secs  SMALLINT    NOT NULL DEFAULT 90,
  instructions        TEXT,
  media_url           TEXT,
  tags                TEXT[],
  persona_filter      TEXT[],
  age_band_min        SMALLINT,
  age_band_max        SMALLINT,
  polarity            VARCHAR(10) NOT NULL DEFAULT 'positive' CHECK (polarity IN ('positive','negative','neutral')),
  reverse_score       BOOLEAN     NOT NULL DEFAULT false,
  is_anchor_item      BOOLEAN     NOT NULL DEFAULT false,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','deprecated')),
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caf_question_options (
  id                  SERIAL      PRIMARY KEY,
  question_id         INTEGER     NOT NULL REFERENCES caf_question_bank(id) ON DELETE CASCADE,
  option_key          VARCHAR(10) NOT NULL,
  option_text         TEXT        NOT NULL,
  score_value         NUMERIC(6,3) NOT NULL DEFAULT 0,
  is_correct          BOOLEAN     NOT NULL DEFAULT false,
  distractor_quality  VARCHAR(10) CHECK (distractor_quality IN ('good','fair','poor')),
  sort_order          SMALLINT    NOT NULL DEFAULT 0,
  UNIQUE(question_id, option_key)
);

-- ── Scenario Framework ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_scenarios (
  id                    SERIAL      PRIMARY KEY,
  code                  VARCHAR(40) NOT NULL UNIQUE,
  title                 VARCHAR(180) NOT NULL,
  scenario_type         VARCHAR(30) NOT NULL DEFAULT 'situational_judgment'
                          CHECK (scenario_type IN ('situational_judgment','case_study','roleplay','incident')),
  assessment_type       VARCHAR(30) NOT NULL,
  context_narrative     TEXT        NOT NULL,
  situation_prompt      TEXT        NOT NULL,
  character_personas    JSONB,
  constraints           JSONB,
  difficulty_tier       VARCHAR(10) NOT NULL DEFAULT 'medium',
  estimated_duration_mins SMALLINT  NOT NULL DEFAULT 15,
  competency_tags       TEXT[],
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caf_scenario_branches (
  id                SERIAL      PRIMARY KEY,
  scenario_id       INTEGER     NOT NULL REFERENCES caf_scenarios(id) ON DELETE CASCADE,
  branch_key        VARCHAR(30) NOT NULL,
  condition_logic   JSONB       NOT NULL,
  next_scenario_id  INTEGER     REFERENCES caf_scenarios(id),
  next_question_code VARCHAR(40),
  outcome_label     TEXT,
  score_modifier    NUMERIC(5,3) NOT NULL DEFAULT 0,
  sort_order        SMALLINT    NOT NULL DEFAULT 0
);

-- ── Difficulty Framework ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_difficulty_calibrations (
  id                  SERIAL      PRIMARY KEY,
  calibration_set_code VARCHAR(40) NOT NULL UNIQUE,
  name                VARCHAR(180) NOT NULL,
  assessment_type     VARCHAR(30) NOT NULL,
  tier_definitions    JSONB       NOT NULL,
  passing_thresholds  JSONB       NOT NULL,
  calibration_method  VARCHAR(30) NOT NULL DEFAULT 'classical'
                        CHECK (calibration_method IN ('classical','irt_1pl','irt_2pl','irt_3pl','rasch')),
  sample_size         INTEGER,
  calibration_date    DATE,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Level Framework ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_level_frameworks (
  id              SERIAL      PRIMARY KEY,
  code            VARCHAR(30) NOT NULL UNIQUE,
  name            VARCHAR(120) NOT NULL,
  assessment_type VARCHAR(30) NOT NULL,
  description     TEXT,
  levels          JSONB       NOT NULL,
  is_default      BOOLEAN     NOT NULL DEFAULT false,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caf_level_anchors (
  id                  SERIAL      PRIMARY KEY,
  framework_id        INTEGER     NOT NULL REFERENCES caf_level_frameworks(id) ON DELETE CASCADE,
  level_code          VARCHAR(20) NOT NULL,
  competency_domain   VARCHAR(80) NOT NULL,
  anchor_statement    TEXT        NOT NULL,
  observable_behaviors TEXT[],
  typical_examples    TEXT[],
  sort_order          SMALLINT    NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Assessment Builder ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_assessments (
  id                        SERIAL      PRIMARY KEY,
  code                      VARCHAR(40) NOT NULL UNIQUE,
  title                     VARCHAR(220) NOT NULL,
  assessment_type           VARCHAR(30) NOT NULL,
  description               TEXT,
  instructions              TEXT,
  level_framework_id        INTEGER     REFERENCES caf_level_frameworks(id),
  difficulty_calibration_id INTEGER     REFERENCES caf_difficulty_calibrations(id),
  time_limit_mins           SMALLINT,
  max_attempts              SMALLINT    NOT NULL DEFAULT 1,
  passing_score             NUMERIC(5,2) NOT NULL DEFAULT 60.0,
  randomize_sections        BOOLEAN     NOT NULL DEFAULT false,
  randomize_questions       BOOLEAN     NOT NULL DEFAULT false,
  show_score_immediately    BOOLEAN     NOT NULL DEFAULT false,
  show_feedback             BOOLEAN     NOT NULL DEFAULT true,
  allow_review              BOOLEAN     NOT NULL DEFAULT false,
  proctoring_level          VARCHAR(20) NOT NULL DEFAULT 'none'
                              CHECK (proctoring_level IN ('none','basic','full')),
  target_persona            TEXT[],
  target_roles              INTEGER[],
  target_level_codes        TEXT[],
  tags                      TEXT[],
  published_at              TIMESTAMPTZ,
  version                   SMALLINT    NOT NULL DEFAULT 1,
  is_active                 BOOLEAN     NOT NULL DEFAULT true,
  status                    VARCHAR(20) NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','review','published','archived')),
  created_by                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caf_assessment_sections (
  id              SERIAL      PRIMARY KEY,
  assessment_id   INTEGER     NOT NULL REFERENCES caf_assessments(id) ON DELETE CASCADE,
  code            VARCHAR(40) NOT NULL,
  title           VARCHAR(180) NOT NULL,
  instructions    TEXT,
  section_type    VARCHAR(30) NOT NULL DEFAULT 'standard'
                    CHECK (section_type IN ('standard','scenario','adaptive')),
  time_limit_mins SMALLINT,
  question_count  SMALLINT    NOT NULL DEFAULT 10,
  randomize       BOOLEAN     NOT NULL DEFAULT false,
  weight          NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  scoring_method  VARCHAR(20) NOT NULL DEFAULT 'sum'
                    CHECK (scoring_method IN ('sum','weighted_sum','irt','percentage')),
  sort_order      SMALLINT    NOT NULL DEFAULT 0,
  UNIQUE(assessment_id, code)
);

CREATE TABLE IF NOT EXISTS caf_section_questions (
  id          SERIAL  PRIMARY KEY,
  section_id  INTEGER NOT NULL REFERENCES caf_assessment_sections(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES caf_question_bank(id) ON DELETE CASCADE,
  is_fixed    BOOLEAN NOT NULL DEFAULT true,
  pool_group  VARCHAR(40),
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  UNIQUE(section_id, question_id)
);

-- ── Randomization Engine ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_randomization_rules (
  id                      SERIAL  PRIMARY KEY,
  assessment_id           INTEGER NOT NULL REFERENCES caf_assessments(id) ON DELETE CASCADE UNIQUE,
  strategy                VARCHAR(30) NOT NULL DEFAULT 'stratified'
                            CHECK (strategy IN ('fixed','stratified','purely_random','adaptive','fixed_parallel')),
  stratify_by             TEXT[],
  difficulty_distribution JSONB,
  ensure_coverage         TEXT[],
  seed_mode               VARCHAR(20) NOT NULL DEFAULT 'session'
                            CHECK (seed_mode IN ('session','daily','global')),
  parallel_forms          SMALLINT NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Session Management ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id           INTEGER     REFERENCES caf_assessments(id),
  user_id                 TEXT        NOT NULL,
  user_email              TEXT,
  attempt_number          SMALLINT    NOT NULL DEFAULT 1,
  status                  VARCHAR(20) NOT NULL DEFAULT 'started'
                            CHECK (status IN ('started','in_progress','paused','completed','abandoned','timed_out')),
  randomization_seed      BIGINT,
  question_order          JSONB,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at               TIMESTAMPTZ,
  resumed_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  time_elapsed_secs       INTEGER     NOT NULL DEFAULT 0,
  current_section_id      INTEGER     REFERENCES caf_assessment_sections(id),
  current_question_index  SMALLINT    NOT NULL DEFAULT 0,
  flagged_question_ids    INTEGER[],
  proctoring_events       JSONB,
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Response Management ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_responses (
  id                SERIAL      PRIMARY KEY,
  session_id        UUID        NOT NULL REFERENCES caf_sessions(id) ON DELETE CASCADE,
  question_id       INTEGER     REFERENCES caf_question_bank(id),
  section_id        INTEGER     REFERENCES caf_assessment_sections(id),
  response_value    TEXT,
  response_data     JSONB,
  is_skipped        BOOLEAN     NOT NULL DEFAULT false,
  is_flagged        BOOLEAN     NOT NULL DEFAULT false,
  is_revised        BOOLEAN     NOT NULL DEFAULT false,
  time_taken_secs   SMALLINT,
  confidence_level  SMALLINT    CHECK (confidence_level BETWEEN 1 AND 5),
  attempt_number    SMALLINT    NOT NULL DEFAULT 1,
  responded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, question_id, attempt_number)
);

-- ── Scoring Engine ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_score_rules (
  id              SERIAL      PRIMARY KEY,
  assessment_id   INTEGER     NOT NULL REFERENCES caf_assessments(id) ON DELETE CASCADE,
  rule_name       VARCHAR(120) NOT NULL,
  dimension       VARCHAR(80) NOT NULL DEFAULT 'overall',
  scoring_method  VARCHAR(30) NOT NULL DEFAULT 'weighted_sum'
                    CHECK (scoring_method IN ('weighted_sum','irt_theta','percentage','bands','sum')),
  weights         JSONB,
  normalization   VARCHAR(20) NOT NULL DEFAULT 'raw'
                    CHECK (normalization IN ('raw','percentile','stanine','t_score','z_score')),
  band_thresholds JSONB,
  is_primary      BOOLEAN     NOT NULL DEFAULT false,
  sort_order      SMALLINT    NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caf_scores (
  id                  SERIAL      PRIMARY KEY,
  session_id          UUID        NOT NULL REFERENCES caf_sessions(id) ON DELETE CASCADE,
  assessment_id       INTEGER     REFERENCES caf_assessments(id),
  user_id             TEXT        NOT NULL,
  overall_raw         NUMERIC(8,3),
  overall_scaled      NUMERIC(8,3),
  overall_percentile  NUMERIC(5,2),
  overall_band        VARCHAR(30),
  irt_theta           NUMERIC(8,5),
  irt_se              NUMERIC(8,5),
  dimension_scores    JSONB,
  section_scores      JSONB,
  competency_scores   JSONB,
  strengths           TEXT[],
  development_areas   TEXT[],
  scoring_rule_id     INTEGER     REFERENCES caf_score_rules(id),
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version             SMALLINT    NOT NULL DEFAULT 1
);

-- ── Item Analytics ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_item_stats (
  id              SERIAL      PRIMARY KEY,
  question_id     INTEGER     NOT NULL REFERENCES caf_question_bank(id) ON DELETE CASCADE,
  assessment_id   INTEGER     REFERENCES caf_assessments(id),
  sample_size     INTEGER     NOT NULL DEFAULT 0,
  p_value         NUMERIC(5,4),
  point_biserial  NUMERIC(5,4),
  cronbach_alpha  NUMERIC(5,4),
  option_frequency JSONB,
  mean_time_secs  NUMERIC(6,1),
  skip_rate       NUMERIC(5,4),
  revision_rate   NUMERIC(5,4),
  flag_rate       NUMERIC(5,4),
  irt_a           NUMERIC(6,4),
  irt_b           NUMERIC(6,4),
  irt_c           NUMERIC(6,4),
  irt_fit_rmse    NUMERIC(6,4),
  quality_flag    VARCHAR(20) NOT NULL DEFAULT 'good' CHECK (quality_flag IN ('good','review','retire')),
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, assessment_id)
);

-- ── Psychometric Calibrations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caf_psychometric_calibrations (
  id                  SERIAL      PRIMARY KEY,
  calibration_code    VARCHAR(40) NOT NULL UNIQUE,
  assessment_id       INTEGER     REFERENCES caf_assessments(id),
  calibration_type    VARCHAR(30) NOT NULL
                        CHECK (calibration_type IN ('irt_1pl','irt_2pl','irt_3pl','ctt','rasch')),
  sample_size         INTEGER     NOT NULL,
  calibration_date    DATE        NOT NULL,
  reliability_alpha   NUMERIC(5,4),
  reliability_omega   NUMERIC(5,4),
  sem                 NUMERIC(6,3),
  model_fit           JSONB,
  theta_range         JSONB,
  item_parameters     JSONB,
  dif_results         JSONB,
  notes               TEXT,
  is_current          BOOLEAN     NOT NULL DEFAULT false,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_caf_qb_type        ON caf_question_bank(assessment_type);
CREATE INDEX IF NOT EXISTS idx_caf_qb_status       ON caf_question_bank(status);
CREATE INDEX IF NOT EXISTS idx_caf_qb_domain       ON caf_question_bank(domain);
CREATE INDEX IF NOT EXISTS idx_caf_qb_difficulty   ON caf_question_bank(difficulty_tier);
CREATE INDEX IF NOT EXISTS idx_caf_qb_scenario     ON caf_question_bank(scenario_id);
CREATE INDEX IF NOT EXISTS idx_caf_sessions_user   ON caf_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_caf_sessions_asmnt  ON caf_sessions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_caf_sessions_status ON caf_sessions(status);
CREATE INDEX IF NOT EXISTS idx_caf_responses_sess  ON caf_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_caf_scores_sess     ON caf_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_caf_scores_user     ON caf_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_caf_item_stats_q    ON caf_item_stats(question_id);
