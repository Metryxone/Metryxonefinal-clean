-- Phase 1.1 — Competency Classification (Competency Type Master).
--
-- ADDITIVE classification axis layered over the canonical competency genome
-- (onto_competencies). Classifies every canonical competency into exactly ONE of
-- five competency TYPES: behavioral · cognitive · functional · technical ·
-- future_skills.
--
-- This is a NEW axis. It does NOT mutate onto_competencies.scientific_type or
-- domain_id (those stay byte-identical). It does NOT recreate competencies or
-- redesign the hierarchy. The mapping is reversible (drop these two tables and
-- the genome is unchanged).
--
-- Mirrored by a lazy ensureCompetencyTypeSchema() in
-- services/competency-type-classification.ts (there is no migration runner). The
-- DDL is only executed when the competencyFrameworkIntelligence flag is ON
-- (byte-identical-OFF includes the schema), or when the idempotent seed script is
-- run manually.

-- 5-row reference: the Competency Type Master.
CREATE TABLE IF NOT EXISTS onto_competency_types (
  type_key      VARCHAR(40) PRIMARY KEY,
  label         TEXT NOT NULL,
  definition    TEXT NOT NULL,
  examples      TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mapping: every canonical competency → exactly one type, with provenance.
-- competency_id FK → onto_competencies.id (TEXT, e.g. 'comp_accountability').
CREATE TABLE IF NOT EXISTS onto_competency_type_map (
  competency_id VARCHAR(80) PRIMARY KEY REFERENCES onto_competencies(id) ON DELETE CASCADE,
  type_key      VARCHAR(40) NOT NULL REFERENCES onto_competency_types(type_key),
  confidence    VARCHAR(10) NOT NULL DEFAULT 'high',   -- high | medium | low
  needs_review  BOOLEAN NOT NULL DEFAULT false,
  provenance    VARCHAR(60) NOT NULL,                  -- which classification rule fired
  evidence      TEXT NOT NULL DEFAULT '',              -- matched keyword / source signal
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onto_competency_type_map_type ON onto_competency_type_map(type_key);
CREATE INDEX IF NOT EXISTS idx_onto_competency_type_map_review ON onto_competency_type_map(needs_review);
