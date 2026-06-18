-- =====================================================================
-- Phase 2 — Adaptive Assessment Runtime V2 (additive, feature-flagged)
-- Flag: adaptiveAssessmentRuntimeV2
--
-- 9 net-new tables. ALL namespaced under `*_v2` or `assessment_*` /
-- `adaptive_*` / `competency_*` patterns that do NOT collide with any
-- existing `cra_*`, `onto_*`, `bench_*`, `mobility_*`, `m3_*`/`m4_*`/`m5_*`
-- table. Safe to re-run (all CREATEs use IF NOT EXISTS).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Blueprint per resolved DNA -------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_blueprints_v2 (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_dna_id               UUID,
  runtime_context_id        UUID,
  blueprint_name            TEXT         NOT NULL,
  blueprint_version         TEXT         NOT NULL DEFAULT '2.0.0',
  total_competencies        INTEGER      NOT NULL DEFAULT 0,
  total_questions_planned   INTEGER      NOT NULL DEFAULT 0,
  estimated_duration_min    INTEGER,
  intensity                 NUMERIC(3,2),
  difficulty_band           TEXT,
  branching_enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  simulation_required       BOOLEAN      NOT NULL DEFAULT FALSE,
  behavioral_probes_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
  blueprint_spec            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  explainability            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blueprints_v2_dna ON assessment_blueprints_v2(role_dna_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_v2_ctx ON assessment_blueprints_v2(runtime_context_id);

-- 2) Competencies inside a blueprint -------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_blueprint_competencies (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id              UUID         NOT NULL REFERENCES assessment_blueprints_v2(id) ON DELETE CASCADE,
  competency_code           TEXT         NOT NULL,
  importance_weight         NUMERIC(5,4) NOT NULL,
  expected_level            NUMERIC(5,2),
  depth_band                TEXT         NOT NULL DEFAULT 'standard',
  question_count_planned    INTEGER      NOT NULL DEFAULT 0,
  pool_ids                  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  branching_rule_ids        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blueprint_comps ON assessment_blueprint_competencies(blueprint_id, competency_code);

-- 3) Adaptive question pools (registry; question bodies live in catalog files) --
CREATE TABLE IF NOT EXISTS adaptive_question_pools (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_key                  TEXT         NOT NULL UNIQUE,
  competency_code           TEXT         NOT NULL,
  question_type             TEXT         NOT NULL,
  difficulty_band            TEXT         NOT NULL,
  depth_band                TEXT         NOT NULL DEFAULT 'standard',
  catalog_size              INTEGER      NOT NULL DEFAULT 0,
  metadata                  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pools_comp_diff ON adaptive_question_pools(competency_code, difficulty_band);

-- 4) Question templates (when no static catalog match — used by generator) ------
CREATE TABLE IF NOT EXISTS competency_question_templates (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key              TEXT         NOT NULL UNIQUE,
  competency_code           TEXT         NOT NULL,
  question_type             TEXT         NOT NULL,
  template_body             JSONB        NOT NULL,
  difficulty_band            TEXT         NOT NULL DEFAULT 'medium',
  language_policy           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 5) Branching rules -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_branching_rules (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key                  TEXT         NOT NULL UNIQUE,
  competency_code           TEXT,
  trigger_type              TEXT         NOT NULL,   -- 'low_confidence' | 'contradiction' | 'high_difficulty' | 'depth_expand' | 'behavioral_probe'
  trigger_condition         JSONB        NOT NULL,
  next_action               TEXT         NOT NULL,   -- 'escalate' | 'deescalate' | 'inject_probe' | 'expand_depth' | 'stop_competency'
  action_params             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  priority                  INTEGER      NOT NULL DEFAULT 50,
  is_active                 BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_branching_active ON assessment_branching_rules(is_active, priority);

-- 6) Runtime sessions ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_runtime_sessions_v2 (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   BIGINT       NOT NULL,
  blueprint_id              UUID         NOT NULL REFERENCES assessment_blueprints_v2(id) ON DELETE CASCADE,
  runtime_context_id        UUID,
  role_dna_id               UUID,
  state                     TEXT         NOT NULL DEFAULT 'in_progress', -- in_progress|paused|complete|abandoned
  current_competency        TEXT,
  questions_served          INTEGER      NOT NULL DEFAULT 0,
  responses_count           INTEGER      NOT NULL DEFAULT 0,
  confidence_score          NUMERIC(5,2),
  runtime_state             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  started_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_activity_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_v2_user ON assessment_runtime_sessions_v2(user_id, state);
CREATE INDEX IF NOT EXISTS idx_sessions_v2_bp   ON assessment_runtime_sessions_v2(blueprint_id);

-- 7) Competency signal capture (per response, per competency) ------------------
CREATE TABLE IF NOT EXISTS competency_signal_capture (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                UUID         NOT NULL REFERENCES assessment_runtime_sessions_v2(id) ON DELETE CASCADE,
  user_id                   BIGINT       NOT NULL,
  competency_code           TEXT         NOT NULL,
  question_id               TEXT,
  question_type             TEXT,
  response_payload          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  response_time_ms          INTEGER,
  confidence_self_report    NUMERIC(3,2),
  confidence_inferred       NUMERIC(3,2),
  difficulty_band            TEXT,
  signal_score              NUMERIC(5,2),
  captured_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_session ON competency_signal_capture(session_id, competency_code);

-- 8) Behavioral assessment signals (consistency, contradiction, hesitation) ----
CREATE TABLE IF NOT EXISTS behavioral_assessment_signals (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                UUID         NOT NULL REFERENCES assessment_runtime_sessions_v2(id) ON DELETE CASCADE,
  user_id                   BIGINT       NOT NULL,
  signal_type               TEXT         NOT NULL,   -- 'consistency' | 'contradiction' | 'hesitation' | 'depth' | 'leadership' | 'communication'
  signal_value              NUMERIC(5,2),
  signal_band                TEXT,                   -- 'low' | 'medium' | 'high'
  evidence                  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  captured_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_behav_signals_session ON behavioral_assessment_signals(session_id, signal_type);

-- 9) Explainability logs ------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_explainability_logs (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                UUID         REFERENCES assessment_runtime_sessions_v2(id) ON DELETE CASCADE,
  blueprint_id              UUID         REFERENCES assessment_blueprints_v2(id) ON DELETE CASCADE,
  log_type                  TEXT         NOT NULL,   -- 'question_selected'|'difficulty_changed'|'depth_expanded'|'branching_fired'|'confidence_rationale'
  rationale                 TEXT         NOT NULL,
  payload                   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_explain_session ON assessment_explainability_logs(session_id, log_type);

-- ── Seed: a baseline branching rule set + minimal pool registry ─────────────
INSERT INTO assessment_branching_rules (rule_key, competency_code, trigger_type, trigger_condition, next_action, action_params, priority)
VALUES
  ('low_conf_global',     NULL, 'low_confidence',  '{"threshold":0.45}'::jsonb, 'deescalate',   '{"step":1}'::jsonb,            90),
  ('contradict_global',   NULL, 'contradiction',   '{"min_pairs":2}'::jsonb,    'inject_probe', '{"probe":"consistency"}'::jsonb, 80),
  ('expand_depth_lea',    'LEA','depth_expand',    '{"min_score":75}'::jsonb,   'expand_depth', '{"levels":1}'::jsonb,          60),
  ('escalate_high_conf',  NULL, 'high_difficulty', '{"streak":3,"min_score":80}'::jsonb, 'escalate', '{"step":1}'::jsonb,       70),
  ('behav_probe_eiq',     'EIQ','behavioral_probe','{"trigger":"low_signal"}'::jsonb,  'inject_probe','{"probe":"scenario"}'::jsonb, 50)
ON CONFLICT (rule_key) DO NOTHING;

INSERT INTO adaptive_question_pools (pool_key, competency_code, question_type, difficulty_band, depth_band, catalog_size, metadata)
VALUES
  ('cog_mcq_med',  'COG', 'mcq',          'medium', 'standard', 0, '{"source":"catalog"}'::jsonb),
  ('com_sjt_med',  'COM', 'sjt',          'medium', 'standard', 0, '{"source":"catalog"}'::jsonb),
  ('lea_scen_hi',  'LEA', 'scenario',     'hard',   'deep',     0, '{"source":"catalog"}'::jsonb),
  ('exe_case_med', 'EXE', 'case',         'medium', 'standard', 0, '{"source":"catalog"}'::jsonb),
  ('adp_sjt_med',  'ADP', 'sjt',          'medium', 'standard', 0, '{"source":"catalog"}'::jsonb),
  ('tec_mcq_med',  'TEC', 'mcq',          'medium', 'standard', 0, '{"source":"catalog"}'::jsonb),
  ('eiq_behav_med','EIQ', 'behavioral',   'medium', 'standard', 0, '{"source":"catalog"}'::jsonb)
ON CONFLICT (pool_key) DO NOTHING;
