-- Phase 2 — Competency Runtime.
--
-- Operationalizes the live competency chain:
--   Role -> Assessment Blueprint -> Assessment Generation -> Competency Scoring
--        -> Competency Profile -> Competency Gap Analysis
--
-- Strictly ADDITIVE + flag-gated (`competencyRuntime`, default OFF). These four
-- onto_* tables ONLY hold runtime assessment state; dropping them returns the
-- platform to byte-identical legacy behaviour. Mirrored by the lazy
-- `ensureCompetencyRuntimeSchema()` in services/competency-runtime.ts (no
-- migration runner in this repo).
--
-- Measurement grain is the genome's 5 onto-domains. The question bank
-- (competency_question_templates) is keyed by 7 domain codes
-- (COG/COM/LEA/EXE/ADP/TEC/EIQ) which crosswalk DOWN to the 5 onto-domains, so a
-- per-competency score is a domain-PROXY (honest, lower confidence) until
-- onto_competency_question_map is populated. dom_strategic has no bank code and
-- is honestly reported UNMEASURABLE. Nothing is fabricated.

-- 1. Assessment instances — one generated assessment for a subject -------------
CREATE TABLE IF NOT EXISTS onto_assessment_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id    TEXT NOT NULL,
  role_id         TEXT,
  subject_id      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'generated',  -- generated | scored
  total_questions INTEGER NOT NULL DEFAULT 0,
  questions       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- self-contained items w/ options+scores
  coverage        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- measurable vs unmeasurable competencies
  source          TEXT NOT NULL DEFAULT 'runtime',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oai_subject   ON onto_assessment_instances (subject_id);
CREATE INDEX IF NOT EXISTS idx_oai_blueprint ON onto_assessment_instances (blueprint_id);

-- 2. Per-question responses (append; scoring is self-contained) ----------------
CREATE TABLE IF NOT EXISTS onto_assessment_responses (
  id             SERIAL PRIMARY KEY,
  instance_id    UUID NOT NULL REFERENCES onto_assessment_instances(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  template_id    TEXT,
  code           TEXT NOT NULL,             -- bank domain code (COG/COM/...)
  onto_domain    TEXT,                      -- crosswalked onto-domain id
  selected_index INTEGER NOT NULL,
  score          NUMERIC NOT NULL,          -- chosen option's authored score 0..100
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_oar_instance_q ON onto_assessment_responses (instance_id, question_index);
CREATE INDEX IF NOT EXISTS idx_oar_instance ON onto_assessment_responses (instance_id);

-- 3. Per onto-domain competency scores ----------------------------------------
CREATE TABLE IF NOT EXISTS onto_competency_scores (
  id             SERIAL PRIMARY KEY,
  instance_id    UUID NOT NULL REFERENCES onto_assessment_instances(id) ON DELETE CASCADE,
  subject_id     TEXT NOT NULL,
  onto_domain    TEXT NOT NULL,
  domain_label   TEXT,
  scaled_score   NUMERIC NOT NULL,          -- 0..100 (mean of answered option scores)
  level          INTEGER NOT NULL,          -- 1..5 derived band
  question_count INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ocs_instance ON onto_competency_scores (instance_id);
CREATE INDEX IF NOT EXISTS idx_ocs_subject  ON onto_competency_scores (subject_id);

-- 4. Competency profile snapshot (APPEND-ONLY history) ------------------------
CREATE TABLE IF NOT EXISTS onto_competency_profiles (
  id            SERIAL PRIMARY KEY,
  subject_id    TEXT NOT NULL,
  instance_id   UUID NOT NULL REFERENCES onto_assessment_instances(id) ON DELETE CASCADE,
  blueprint_id  TEXT,
  role_id       TEXT,
  overall_score NUMERIC,                    -- mean of measured domain scores (null if none)
  overall_level INTEGER,
  profile       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{onto_domain,label,scaled_score,level,question_count}]
  coverage      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ocp_subject ON onto_competency_profiles (subject_id);
CREATE INDEX IF NOT EXISTS idx_ocp_instance ON onto_competency_profiles (instance_id);
