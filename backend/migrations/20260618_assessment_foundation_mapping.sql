-- Phase 1.6 — Assessment Foundation Mapping.
--
-- ADDITIVE foundational mapping layer that connects the canonical genome to the
-- assessment surface WITHOUT redesigning any assessment workflow. Three maps:
--
--   Competency  -> Question        (onto_competency_question_map)
--   Role        -> Assessment      (onto_role_assessment_map -> onto_assessment_blueprints)
--   Competency Profile -> Blueprint (onto_assessment_blueprints + onto_blueprint_competency_map)
--
-- Every row references EXISTING rows only (onto_competencies / onto_roles /
-- competency_question_templates). Nothing in the genome or the question bank is
-- mutated. Reversible: drop these four tables -> unchanged behaviour.

-- 1. Assessment Blueprint entity. A blueprint is the assessment-facing projection
--    of a role's competency profile (Phase 1.5). source_role_id records which
--    role profile it was derived from (nullable for standalone blueprints).
CREATE TABLE IF NOT EXISTS onto_assessment_blueprints (
  id              VARCHAR(120) PRIMARY KEY,
  blueprint_key   VARCHAR(120) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  source_role_id  VARCHAR(120) REFERENCES onto_roles(id) ON DELETE SET NULL,
  source          VARCHAR(30)  NOT NULL DEFAULT 'derived',
  active          BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_blueprint_key ON onto_assessment_blueprints (blueprint_key);
CREATE INDEX IF NOT EXISTS idx_blueprint_role ON onto_assessment_blueprints (source_role_id);

-- 2. Assessment Blueprint relationships (Competency Profile -> Blueprint). Each
--    row carries the required level / weight / criticality inherited from the
--    competency profile the blueprint was built from.
CREATE TABLE IF NOT EXISTS onto_blueprint_competency_map (
  id              SERIAL PRIMARY KEY,
  blueprint_id    VARCHAR(120) NOT NULL REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
  competency_id   VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id)          ON DELETE CASCADE,
  required_level  INT          NOT NULL DEFAULT 3,
  weight          NUMERIC(6,2) NOT NULL DEFAULT 0,
  criticality     VARCHAR(20)  NOT NULL DEFAULT 'important',
  source          VARCHAR(30)  NOT NULL DEFAULT 'derived',
  active          BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_bcm_level  CHECK (required_level BETWEEN 1 AND 5),
  CONSTRAINT chk_bcm_weight CHECK (weight >= 0 AND weight <= 100),
  CONSTRAINT chk_bcm_crit   CHECK (criticality IN ('critical','important','desirable','optional'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bcm_blueprint_comp ON onto_blueprint_competency_map (blueprint_id, competency_id);
CREATE INDEX IF NOT EXISTS idx_bcm_blueprint ON onto_blueprint_competency_map (blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bcm_comp      ON onto_blueprint_competency_map (competency_id);

-- 3. Role -> Assessment mapping. Connects a role to one or more blueprints.
CREATE TABLE IF NOT EXISTS onto_role_assessment_map (
  id              SERIAL PRIMARY KEY,
  role_id         VARCHAR(120) NOT NULL REFERENCES onto_roles(id)               ON DELETE CASCADE,
  blueprint_id    VARCHAR(120) NOT NULL REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
  is_primary      BOOLEAN      NOT NULL DEFAULT true,
  source          VARCHAR(30)  NOT NULL DEFAULT 'derived',
  active          BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ram_role_blueprint ON onto_role_assessment_map (role_id, blueprint_id);
CREATE INDEX IF NOT EXISTS idx_ram_role      ON onto_role_assessment_map (role_id);
CREATE INDEX IF NOT EXISTS idx_ram_blueprint ON onto_role_assessment_map (blueprint_id);

-- 4. Competency -> Question mapping. Resolves a question's free-text
--    competency_code to the canonical onto_competencies.id, establishing the
--    formal foundation link. question_id references the canonical curation table.
CREATE TABLE IF NOT EXISTS onto_competency_question_map (
  id              SERIAL PRIMARY KEY,
  competency_id   VARCHAR(80) NOT NULL REFERENCES onto_competencies(id)             ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES competency_question_templates(id) ON DELETE CASCADE,
  source          VARCHAR(30) NOT NULL DEFAULT 'derived',
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cqm_comp_question ON onto_competency_question_map (competency_id, question_id);
CREATE INDEX IF NOT EXISTS idx_cqm_comp     ON onto_competency_question_map (competency_id);
CREATE INDEX IF NOT EXISTS idx_cqm_question ON onto_competency_question_map (question_id);
