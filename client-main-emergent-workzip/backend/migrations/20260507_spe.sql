-- METRYXONE BIOS — SCORING & PSYCHOMETRIC ENGINE (SPE)
-- 26-section enterprise implementation
-- All tables prefixed spe_ to avoid conflicts

-- ── SECTION 1: RAW SCORING ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_assessments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  name          TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'standard',
  description   TEXT,
  psychometric_version INT DEFAULT 1,
  status        TEXT DEFAULT 'active',
  config        JSONB DEFAULT '{}',
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spe_questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID,
  assessment_id         UUID REFERENCES spe_assessments(id) ON DELETE SET NULL,
  competency            TEXT,
  domain                TEXT,
  question_text         TEXT NOT NULL,
  question_type         TEXT NOT NULL DEFAULT 'mcq',
  options               JSONB DEFAULT '[]',
  correct_answer        JSONB,
  rubric                JSONB DEFAULT '{}',
  difficulty_level      INT DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
  cognitive_load        INT DEFAULT 3 CHECK (cognitive_load BETWEEN 1 AND 5),
  difficulty_parameter  FLOAT DEFAULT 0.0,
  discrimination_index  FLOAT DEFAULT 1.0,
  guessing_parameter    FLOAT DEFAULT 0.25,
  slipping_parameter    FLOAT DEFAULT 0.05,
  psychometric_confidence FLOAT DEFAULT 0.5,
  calibration_version   INT DEFAULT 0,
  calibrated_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spe_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  assessment_id   UUID,
  user_id         TEXT NOT NULL,
  question_id     UUID REFERENCES spe_questions(id) ON DELETE SET NULL,
  response_payload JSONB NOT NULL DEFAULT '{}',
  response_value  TEXT,
  is_correct      BOOLEAN,
  raw_score       FLOAT DEFAULT 0,
  response_time_ms FLOAT,
  keystroke_count INT DEFAULT 0,
  change_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spe_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  assessment_id     UUID,
  user_id           TEXT NOT NULL,
  raw_score         FLOAT DEFAULT 0,
  normalized_score  FLOAT DEFAULT 0,
  weighted_score    FLOAT DEFAULT 0,
  irt_score         FLOAT,
  bayesian_score    FLOAT,
  confidence        FLOAT DEFAULT 0.5,
  uncertainty       FLOAT DEFAULT 0.5,
  scoring_method    TEXT DEFAULT 'composite',
  score_breakdown   JSONB DEFAULT '{}',
  positive_factors  JSONB DEFAULT '[]',
  negative_factors  JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, user_id)
);

-- ── SECTION 2: BEHAVIOURAL SCORING ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_behavioural_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID,
  user_id               TEXT NOT NULL,
  assessment_id         UUID,
  persistence_score     FLOAT DEFAULT 50,
  focus_score           FLOAT DEFAULT 50,
  impulsivity_penalty   FLOAT DEFAULT 0,
  adaptability_score    FLOAT DEFAULT 50,
  confidence_stability  FLOAT DEFAULT 50,
  pacing_score          FLOAT DEFAULT 50,
  engagement_score      FLOAT DEFAULT 50,
  navigation_entropy    FLOAT DEFAULT 0,
  response_volatility   FLOAT DEFAULT 0,
  overall_score         FLOAT DEFAULT 50,
  signals               JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, user_id)
);

-- ── SECTION 3: COGNITIVE SCORING ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_cognitive_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  user_id           TEXT NOT NULL UNIQUE,
  reasoning_score   FLOAT DEFAULT 50,
  memory_score      FLOAT DEFAULT 50,
  flexibility_score FLOAT DEFAULT 50,
  processing_speed  FLOAT DEFAULT 50,
  abstraction_score FLOAT DEFAULT 50,
  metacognition     FLOAT DEFAULT 50,
  attention_stability FLOAT DEFAULT 50,
  overload_risk     FLOAT DEFAULT 0,
  fatigue_detected  BOOLEAN DEFAULT FALSE,
  fragmentation_risk FLOAT DEFAULT 0,
  overall_cognitive FLOAT DEFAULT 50,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 4 & 5: IRT + BAYESIAN ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_psychometric_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  question_id         UUID REFERENCES spe_questions(id) ON DELETE CASCADE,
  difficulty          FLOAT DEFAULT 0.0,
  discrimination      FLOAT DEFAULT 1.0,
  guessing            FLOAT DEFAULT 0.25,
  slipping            FLOAT DEFAULT 0.05,
  information_value   FLOAT DEFAULT 0,
  calibration_version INT DEFAULT 1,
  sample_size         INT DEFAULT 0,
  response_count      INT DEFAULT 0,
  calibrated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id)
);

CREATE TABLE IF NOT EXISTS spe_ability_estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  user_id         TEXT NOT NULL,
  assessment_id   UUID,
  ability_score   FLOAT DEFAULT 0,
  prior_ability   FLOAT DEFAULT 0,
  posterior_ability FLOAT DEFAULT 0,
  confidence      FLOAT DEFAULT 0.5,
  uncertainty     FLOAT DEFAULT 0.5,
  iteration_count INT DEFAULT 0,
  converged       BOOLEAN DEFAULT FALSE,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, assessment_id)
);

-- ── SECTION 6: NORMALIZATION ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_normalization_params (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  assessment_id   UUID,
  cohort_mean     FLOAT DEFAULT 50,
  cohort_std      FLOAT DEFAULT 15,
  cohort_min      FLOAT DEFAULT 0,
  cohort_max      FLOAT DEFAULT 100,
  percentile_table JSONB DEFAULT '{}',
  norm_version    INT DEFAULT 1,
  sample_size     INT DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id)
);

-- ── SECTION 7 & 16: CONFIDENCE + TRUST ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_confidence_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID,
  user_id                 TEXT NOT NULL,
  assessment_id           UUID,
  behavioural_consistency FLOAT DEFAULT 0.5,
  psychometric_reliability FLOAT DEFAULT 0.5,
  response_stability      FLOAT DEFAULT 0.5,
  longitudinal_consistency FLOAT DEFAULT 0.5,
  signal_completeness     FLOAT DEFAULT 0.5,
  overall_confidence      FLOAT DEFAULT 0.5,
  uncertainty             FLOAT DEFAULT 0.5,
  computed_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, assessment_id)
);

CREATE TABLE IF NOT EXISTS spe_trust_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID,
  user_id                   TEXT NOT NULL UNIQUE,
  trust_score               FLOAT DEFAULT 0.5,
  psychometric_reliability  FLOAT DEFAULT 0.5,
  behavioural_consistency   FLOAT DEFAULT 0.5,
  longitudinal_stability    FLOAT DEFAULT 0.5,
  scoring_consistency       FLOAT DEFAULT 0.5,
  flags                     JSONB DEFAULT '[]',
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 8: RELIABILITY & VALIDITY ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_psychometric_reports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID,
  assessment_id           UUID,
  cronbach_alpha          FLOAT,
  split_half_reliability  FLOAT,
  test_retest_reliability FLOAT,
  internal_consistency    FLOAT,
  construct_validity      FLOAT,
  criterion_validity      FLOAT,
  predictive_validity     FLOAT,
  content_validity        FLOAT,
  reliability_grade       TEXT DEFAULT 'Unrated',
  validity_grade          TEXT DEFAULT 'Unrated',
  psychometric_confidence FLOAT DEFAULT 0.5,
  sample_size             INT DEFAULT 0,
  generated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 9: FAIRNESS & DIF ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_fairness_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  assessment_id       UUID,
  question_id         UUID,
  dif_score           FLOAT DEFAULT 0,
  dif_detected        BOOLEAN DEFAULT FALSE,
  group_a             TEXT,
  group_b             TEXT,
  group_a_mean        FLOAT,
  group_b_mean        FLOAT,
  effect_size         FLOAT DEFAULT 0,
  bias_type           TEXT,
  recommended_action  TEXT,
  resolved            BOOLEAN DEFAULT FALSE,
  generated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 10: EXPLAINABILITY ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_score_explanations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  user_id           TEXT NOT NULL,
  assessment_id     UUID,
  score_id          UUID REFERENCES spe_scores(id) ON DELETE CASCADE,
  csi_score         FLOAT,
  positive_factors  JSONB DEFAULT '[]',
  negative_factors  JSONB DEFAULT '[]',
  contributing_signals JSONB DEFAULT '[]',
  confidence_level  FLOAT DEFAULT 0.5,
  uncertainty_level FLOAT DEFAULT 0.5,
  narrative         TEXT,
  generated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 11: LONGITUDINAL ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_longitudinal_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  user_id           TEXT NOT NULL,
  assessment_id     UUID,
  score_type        TEXT NOT NULL,
  score_value       FLOAT NOT NULL,
  delta             FLOAT DEFAULT 0,
  trend_direction   TEXT DEFAULT 'stable',
  trajectory_type   TEXT DEFAULT 'stable',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spe_trajectory_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  user_id         TEXT NOT NULL,
  snapshot_date   DATE DEFAULT CURRENT_DATE,
  composite_score FLOAT DEFAULT 50,
  cognitive_score FLOAT DEFAULT 50,
  behavioural_score FLOAT DEFAULT 50,
  engagement_score FLOAT DEFAULT 50,
  velocity        FLOAT DEFAULT 0,
  acceleration    FLOAT DEFAULT 0,
  pattern         TEXT DEFAULT 'stable',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 12: PREDICTIVE SCORING ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_predictive_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID,
  user_id                   TEXT NOT NULL UNIQUE,
  burnout_probability       FLOAT DEFAULT 0,
  dropout_probability       FLOAT DEFAULT 0,
  employability_readiness   FLOAT DEFAULT 50,
  leadership_emergence      FLOAT DEFAULT 0,
  resilience_trajectory     TEXT DEFAULT 'stable',
  risk_level                TEXT DEFAULT 'low',
  top_risk_factors          JSONB DEFAULT '[]',
  top_protective_factors    JSONB DEFAULT '[]',
  predicted_csi_30d         FLOAT,
  computed_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 13: INTERVENTION ATTRIBUTION ────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_interventions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  user_id             TEXT NOT NULL,
  intervention_type   TEXT NOT NULL,
  intervention_name   TEXT NOT NULL,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  pre_score           FLOAT,
  post_score          FLOAT,
  effectiveness       FLOAT,
  recovery_rate       FLOAT,
  engagement_change   FLOAT,
  persistence_change  FLOAT,
  resilience_change   FLOAT,
  status              TEXT DEFAULT 'active',
  notes               TEXT
);

-- ── SECTION 14: ADVERSARIAL ROBUSTNESS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_adversarial_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  user_id             TEXT NOT NULL,
  assessment_id       UUID,
  flag_type           TEXT NOT NULL,
  severity            TEXT DEFAULT 'medium',
  evidence            JSONB DEFAULT '{}',
  confidence_score    FLOAT DEFAULT 0.5,
  entropy_score       FLOAT,
  anomaly_score       FLOAT,
  pattern_detected    TEXT,
  resolved            BOOLEAN DEFAULT FALSE,
  reviewed_by         TEXT,
  detected_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 15: HUMAN-AI HYBRID REVIEW ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_human_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID,
  user_id             TEXT NOT NULL,
  assessment_id       UUID,
  score_id            UUID,
  trigger_reason      TEXT NOT NULL,
  uncertainty_level   FLOAT DEFAULT 0.5,
  ai_score            FLOAT,
  human_score         FLOAT,
  reviewer_email      TEXT,
  review_notes        TEXT,
  status              TEXT DEFAULT 'pending',
  priority            TEXT DEFAULT 'medium',
  escalated_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ
);

-- ── SECTION 17: META-SCORING ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_meta_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID,
  assessment_id             UUID,
  scoring_stability         FLOAT DEFAULT 1.0,
  calibration_drift         FLOAT DEFAULT 0,
  psychometric_health       FLOAT DEFAULT 1.0,
  fairness_health           FLOAT DEFAULT 1.0,
  overall_system_health     FLOAT DEFAULT 1.0,
  alerts                    JSONB DEFAULT '[]',
  auto_recalibrate_triggered BOOLEAN DEFAULT FALSE,
  computed_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── SECTION 18: FEDERATED PSYCHOMETRICS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS spe_federated_norms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  assessment_id   UUID,
  norm_type       TEXT DEFAULT 'regional',
  region          TEXT,
  institution_type TEXT,
  mean_score      FLOAT DEFAULT 50,
  std_score       FLOAT DEFAULT 15,
  percentile_p25  FLOAT DEFAULT 35,
  percentile_p50  FLOAT DEFAULT 50,
  percentile_p75  FLOAT DEFAULT 65,
  sample_size     INT DEFAULT 0,
  norm_version    INT DEFAULT 1,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spe_responses_user ON spe_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_spe_responses_assessment ON spe_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_spe_scores_user ON spe_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_spe_longitudinal_user ON spe_longitudinal_scores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spe_adversarial_user ON spe_adversarial_flags(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_spe_human_reviews_status ON spe_human_reviews(status, escalated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spe_predictive_risk ON spe_predictive_scores(risk_level, computed_at DESC);

-- Seed: one demo assessment
INSERT INTO spe_assessments (id, name, assessment_type, description, psychometric_version)
VALUES (
  gen_random_uuid(),
  'BIOS Composite Intelligence Assessment',
  'composite',
  'Multi-domain psychometric assessment covering behavioural, cognitive, and capability intelligence.',
  1
) ON CONFLICT DO NOTHING;
