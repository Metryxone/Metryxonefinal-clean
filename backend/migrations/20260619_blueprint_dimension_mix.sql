-- Phase 2.1 — Assessment Blueprint Engine: role-blueprint dimension mix.
-- The `assessment_blueprints` deliverable: one row per existing
-- onto_assessment_blueprints, storing the 5-dimension % allocation
-- (= Phase 1 onto_competency_types). Additive, idempotent. Mirrored by the lazy
-- ensureBlueprintDimensionSchema() in services/blueprint-builder.ts.

CREATE TABLE IF NOT EXISTS onto_blueprint_dimension_mix (
  blueprint_id       VARCHAR(120) PRIMARY KEY
                       REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
  behavioral_pct     NUMERIC(6,2) NOT NULL DEFAULT 0,
  cognitive_pct      NUMERIC(6,2) NOT NULL DEFAULT 0,
  functional_pct     NUMERIC(6,2) NOT NULL DEFAULT 0,
  technical_pct      NUMERIC(6,2) NOT NULL DEFAULT 0,
  future_skills_pct  NUMERIC(6,2) NOT NULL DEFAULT 0,
  source             VARCHAR(30)  NOT NULL DEFAULT 'derived',  -- derived | authored
  coverage           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_bdm_ranges CHECK (
    behavioral_pct    BETWEEN 0 AND 100 AND
    cognitive_pct     BETWEEN 0 AND 100 AND
    functional_pct    BETWEEN 0 AND 100 AND
    technical_pct     BETWEEN 0 AND 100 AND
    future_skills_pct BETWEEN 0 AND 100
  ),
  CONSTRAINT chk_bdm_sum CHECK (
    (behavioral_pct + cognitive_pct + functional_pct + technical_pct + future_skills_pct)
      BETWEEN 99.5 AND 100.5
  )
);
