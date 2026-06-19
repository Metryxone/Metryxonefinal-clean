-- Phase 2.2 — Question Blueprint Engine
-- Additive · flag-gated (competencyRuntime). Mirrored exactly by
-- services/question-blueprint.ts ensureQuestionBlueprintSchema(). Reachable ONLY
-- behind the flag-gated routes, so flag-OFF = no DDL = byte-identical legacy.
--
-- Maps the user-facing deliverables onto the existing competency framework:
--   question_difficulty_framework  -> onto_question_difficulty_framework (reference ladder)
--   question_competency_mapping    -> onto_question_competency_mapping
--        (Question -> Competency + Micro Competency + Difficulty + Type)
--   question_blueprints            -> onto_question_blueprints
--        (Competency -> Question Pool: target composition + honest actual coverage)

-- 1. Difficulty framework (reference / config data, legitimately seeded) ---------
CREATE TABLE IF NOT EXISTS onto_question_difficulty_framework (
  level_key    VARCHAR(40)  PRIMARY KEY,
  label        VARCHAR(80)  NOT NULL,
  ordinal      INTEGER      NOT NULL UNIQUE,
  description  TEXT         NOT NULL DEFAULT '',
  irt_b_min    NUMERIC(6,3),
  irt_b_max    NUMERIC(6,3),
  active       BOOLEAN      NOT NULL DEFAULT true,
  source       VARCHAR(30)  NOT NULL DEFAULT 'seed',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO onto_question_difficulty_framework (level_key, label, ordinal, description, irt_b_min, irt_b_max) VALUES
  ('foundational', 'Foundational', 1, 'Recall / recognition of basic concepts.',                 -3.0, -1.5),
  ('easy',         'Easy',         2, 'Straightforward application in a familiar context.',        -1.5, -0.5),
  ('medium',       'Medium',       3, 'Application requiring some analysis.',                       -0.5,  0.5),
  ('hard',         'Hard',         4, 'Multi-step analysis or evaluation.',                         0.5,  1.5),
  ('expert',       'Expert',       5, 'Synthesis in novel or ambiguous situations.',               1.5,  3.0)
ON CONFLICT (level_key) DO NOTHING;

-- 2. Question -> {Competency, Micro Competency, Difficulty, Type} mapping --------
CREATE TABLE IF NOT EXISTS onto_question_competency_mapping (
  id                  SERIAL PRIMARY KEY,
  question_id         UUID         NOT NULL REFERENCES competency_question_templates(id) ON DELETE CASCADE,
  competency_id       VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  micro_competency_id INTEGER      REFERENCES onto_competency_hierarchy(id) ON DELETE SET NULL,
  difficulty_level    VARCHAR(40)  NOT NULL DEFAULT 'medium',
  question_type       VARCHAR(40)  NOT NULL,
  source              VARCHAR(30)  NOT NULL DEFAULT 'derived',
  active              BOOLEAN      NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_qcm_question_competency UNIQUE (question_id, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_qcm_competency ON onto_question_competency_mapping (competency_id);
CREATE INDEX IF NOT EXISTS idx_qcm_question   ON onto_question_competency_mapping (question_id);
CREATE INDEX IF NOT EXISTS idx_qcm_micro      ON onto_question_competency_mapping (micro_competency_id);

-- 3. Competency -> Question Pool blueprint (target + honest actual coverage) -----
CREATE TABLE IF NOT EXISTS onto_question_blueprints (
  competency_id           VARCHAR(80) PRIMARY KEY REFERENCES onto_competencies(id) ON DELETE CASCADE,
  pool_target             INTEGER     NOT NULL DEFAULT 0,
  difficulty_distribution JSONB       NOT NULL DEFAULT '{}'::jsonb,
  type_distribution       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  coverage                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  source                  VARCHAR(30) NOT NULL DEFAULT 'derived',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_qb_pool_target CHECK (pool_target >= 0)
);
