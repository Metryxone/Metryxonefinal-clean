-- Phase 2.3 — Assessment Assembly Engine
-- Additive · flag-gated (competencyRuntime). Mirrored exactly by
-- services/assessment-assembly.ts ensureAssessmentAssemblySchema(). Reachable ONLY
-- behind the flag-gated routes, so flag-OFF = no DDL = byte-identical legacy.
--
-- Persists an ASSEMBLED assessment (Role → Blueprint → Question Selection →
-- Assessment Generation). DISTINCT from Phase 2's onto_assessment_instances
-- (the domain-proxy generator) — Phase 2 is left byte-identical.
--
-- questions  : ordered [{ position, question_id, competency_id, micro_competency_id,
--                          difficulty_level, question_type }]
-- coverage   : per-competency allocation/selection + achieved difficulty/type distributions
-- validation : duplicate / competency-coverage / blueprint-coverage / difficulty-balance result

CREATE TABLE IF NOT EXISTS onto_assembled_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id    VARCHAR(120) NOT NULL REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
  role_id         VARCHAR(120),
  total_questions INTEGER      NOT NULL DEFAULT 0,
  seed            BIGINT       NOT NULL DEFAULT 0,
  questions       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  coverage        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  validation      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  valid           BOOLEAN      NOT NULL DEFAULT false,
  source          VARCHAR(30)  NOT NULL DEFAULT 'assembled',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_aa_total CHECK (total_questions >= 0)
);
CREATE INDEX IF NOT EXISTS idx_aa_blueprint ON onto_assembled_assessments (blueprint_id);
CREATE INDEX IF NOT EXISTS idx_aa_role      ON onto_assembled_assessments (role_id);
