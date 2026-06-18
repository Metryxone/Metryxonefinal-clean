-- Phase 1.2 — Competency Master Enhancement.
--
-- ADDITIVE governance/eligibility extension over the canonical competency genome
-- (onto_competencies). Adds the Status + six module-eligibility fields the
-- competency entity requires WITHOUT mutating onto_competencies and WITHOUT
-- creating any new competency rows.
--
-- The "required fields" of the enhanced competency entity resolve as:
--   Code                    -> onto_competencies.id        (existing, e.g. comp_accountability)
--   Name                    -> onto_competencies.canonical_name (existing)
--   Competency Type         -> onto_competency_type_map.type_key (Phase 1.1)
--   Description             -> onto_competencies.definition (existing)
--   Status                  -> onto_competency_master_ext.status            (NEW)
--   Assessment Eligible     -> onto_competency_master_ext.assessment_eligible     (NEW)
--   EI Eligible             -> onto_competency_master_ext.ei_eligible             (NEW)
--   Career Builder Eligible -> onto_competency_master_ext.career_builder_eligible (NEW)
--   Employer Eligible       -> onto_competency_master_ext.employer_eligible       (NEW)
--   Learning Eligible       -> onto_competency_master_ext.learning_eligible       (NEW)
--   Future Ready Eligible   -> onto_competency_master_ext.future_ready_eligible   (NEW)
--
-- One row per EXISTING competency (PK = competency_id FK), so the enhancement can
-- never duplicate a competency. The extension is reversible (drop this table and
-- the genome is unchanged). Mirrored by a lazy ensureCompetencyMasterSchema() in
-- services/competency-master.ts (there is no migration runner). The DDL only runs
-- when the competencyFrameworkIntelligence flag is ON (byte-identical-OFF includes
-- the schema), or when the idempotent seed script is run manually.

CREATE TABLE IF NOT EXISTS onto_competency_master_ext (
  competency_id           VARCHAR(80) PRIMARY KEY REFERENCES onto_competencies(id) ON DELETE CASCADE,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'active',   -- active | inactive | deprecated
  assessment_eligible     BOOLEAN      NOT NULL DEFAULT true,
  ei_eligible             BOOLEAN      NOT NULL DEFAULT true,
  career_builder_eligible BOOLEAN      NOT NULL DEFAULT true,
  employer_eligible       BOOLEAN      NOT NULL DEFAULT true,
  learning_eligible       BOOLEAN      NOT NULL DEFAULT true,
  future_ready_eligible   BOOLEAN      NOT NULL DEFAULT true,
  source                  VARCHAR(30)  NOT NULL DEFAULT 'default',  -- default (platform baseline) | curated (admin-edited)
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onto_competency_master_ext_status ON onto_competency_master_ext(status);
CREATE INDEX IF NOT EXISTS idx_onto_competency_master_ext_source ON onto_competency_master_ext(source);
