-- CAPADEX WC-3 Phase B — L2 Outcome Intelligence (additive, reversible).
-- Canonical mirror of ensureWc3OutcomeSchema() in backend/services/wc3/wc3-schema.ts
-- (no migration runner in this repo — the lazy ensure*Schema() functions create
-- these at runtime). Every table is wc3_* namespaced and additive; no existing
-- table is mutated and no ontology / signal / concern data is touched.
--
-- Layer:
--   L2 Outcome Intelligence — wc3_outcome_models (catalog, seeded framework
--                             constants), wc3_outcome_state (per session/model;
--                             current/desired/gap composed from L1 Stage), and
--                             wc3_outcome_actions (LIBRARY-BACKED only — hard FK
--                             into intervention_library; never generic text).
--
-- Primary dependency: L1 Stage Intelligence (wc3_stage_state / wc3_stage_*).
-- Actions reference intervention_library(id) (migration 20260509). construct_keys
-- are grounded in the live intervention_library construct vocabulary.
--
-- Reversal (full): DROP TABLE IF EXISTS
--   wc3_outcome_actions, wc3_outcome_state, wc3_outcome_models CASCADE;

-- ── L2: Outcome Intelligence ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wc3_outcome_models (
  model_key        text PRIMARY KEY,
  display_label    text NOT NULL,
  anchor           text NOT NULL DEFAULT 'l1_stage',
  construct_keys   text[] NOT NULL DEFAULT '{}',
  gated            boolean NOT NULL DEFAULT false,
  description      text,
  composition_spec jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wc3_outcome_state (
  id                 bigserial PRIMARY KEY,
  session_id         uuid NOT NULL,
  user_email         text,
  user_id            uuid,
  model_key          text NOT NULL REFERENCES wc3_outcome_models(model_key),
  current_stage      text,
  current_order      integer NOT NULL DEFAULT 0,
  desired_stage      text,
  desired_order      integer NOT NULL DEFAULT 0,
  gap                integer NOT NULL DEFAULT 0,
  gap_normalized     numeric NOT NULL DEFAULT 0,
  confidence         numeric NOT NULL DEFAULT 0,
  action_count       integer NOT NULL DEFAULT 0,
  explainable        boolean NOT NULL DEFAULT false,
  matched_constructs text[] NOT NULL DEFAULT '{}',
  status             text NOT NULL DEFAULT 'resolved',
  resolved_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, model_key)
);

-- Actions are LIBRARY-BACKED ONLY: a hard FK into intervention_library guarantees
-- an action can never be generic/fabricated text.
CREATE TABLE IF NOT EXISTS wc3_outcome_actions (
  id               bigserial PRIMARY KEY,
  outcome_state_id bigint NOT NULL REFERENCES wc3_outcome_state(id) ON DELETE CASCADE,
  session_id       uuid NOT NULL,
  model_key        text NOT NULL,
  intervention_id  uuid NOT NULL REFERENCES intervention_library(id) ON DELETE CASCADE,
  construct_key    text NOT NULL,
  safety_level     text,
  rank             integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_outcome_state_session ON wc3_outcome_state(session_id);
CREATE INDEX IF NOT EXISTS idx_wc3_outcome_state_email   ON wc3_outcome_state(user_email);
CREATE INDEX IF NOT EXISTS idx_wc3_outcome_actions_state ON wc3_outcome_actions(outcome_state_id);
CREATE INDEX IF NOT EXISTS idx_wc3_outcome_actions_sess  ON wc3_outcome_actions(session_id);

-- Seed the 6 framework outcome models (idempotent). construct_keys are grounded in
-- the live intervention_library construct vocabulary so activation + library-backed
-- actions are real, never fabricated. `gated` flags an outcome whose corpus is not
-- yet broad enough to assert readiness (Exam Readiness).
INSERT INTO wc3_outcome_models (model_key, display_label, anchor, construct_keys, gated, description, composition_spec) VALUES
  ('career_clarity', 'Career Clarity', 'l1_stage',
    ARRAY['CAREER_CLARITY','CAREER_READINESS','SKILL_AWARENESS','GOAL_ORIENTATION','COLLEGE_ADAPT'],
    false, 'Clarity of career direction and next-step orientation.',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
  ('learning_effectiveness', 'Learning Effectiveness', 'l1_stage',
    ARRAY['LEARNING_APPROACH','LEARNING_DRIVE','ACADEMIC_RECOVERY','CRITICAL_THINKING','WORKING_MEMORY','PROCESSING_SPEED','ATTENTION_REGULATION','EXECUTIVE_FUNCTION'],
    false, 'Effectiveness of the learning approach and cognitive supports.',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
  ('employability_readiness', 'Employability Readiness', 'l1_stage',
    ARRAY['SKILL_AWARENESS','COMMUNICATION','SOCIAL_CONFIDENCE','CAREER_READINESS','CREATIVITY'],
    false, 'Readiness of employability-facing skills and self-presentation.',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
  ('exam_readiness', 'Exam Readiness', 'l1_stage',
    ARRAY['EXAM_READINESS','EXAM_PERFORMANCE','EXAM_STRESS','STRESS_MANAGEMENT','ACADEMIC_RECOVERY'],
    true, 'Readiness for exam performance under load (corpus-gated).',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key","note":"gated: exam corpus not yet broad enough to assert readiness"}'),
  ('confidence_stability', 'Confidence Stability', 'l1_stage',
    ARRAY['SELF_ESTEEM','SOCIAL_CONFIDENCE','RESILIENCE','EMOTIONAL_REGULATION','ANXIETY','MENTAL_HEALTH','STRESS_MANAGEMENT'],
    false, 'Stability of confidence and emotional regulation.',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
  ('decision_quality', 'Decision Quality', 'l1_stage',
    ARRAY['CRITICAL_THINKING','IMPULSE_CONTROL','GOAL_ORIENTATION','INTRINSIC_MOTIVATION','EXECUTIVE_FUNCTION','HABIT_FORMATION'],
    false, 'Quality of decision-making and follow-through.',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}')
ON CONFLICT (model_key) DO NOTHING;
