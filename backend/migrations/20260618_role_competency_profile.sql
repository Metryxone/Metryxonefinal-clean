-- Phase 1.5 — Role Competency Profile Engine.
--
-- ADDITIVE role -> competency requirement layer over the canonical genome. Each
-- row declares, for one EXISTING role (onto_roles), one EXISTING competency
-- (onto_competencies):
--   - required_level  (1..5, references onto_proficiency_levels.level)
--   - weight          (relative importance, percentage 0..100)
--   - criticality     (critical | important | desirable | optional)
--
-- This powers three deliverables, all read-only / never-fabricating:
--   1. Role Competency Profile Engine — CRUD + per-role requirement profile.
--   2. Role Competency Matrix          — roles x competencies grid.
--   3. Role Readiness Framework        — weighted gap of actual vs required.
--
-- Honesty contract (mirrors the rest of Competency Framework Intelligence):
--   - Strictly ADDITIVE: never mutates onto_roles / onto_competencies. Dropping
--     this table restores byte-identical prior behaviour.
--   - NEVER fabricates roles or competencies: both FKs MUST reference existing
--     rows; the seed skips (and honestly reports) any missing id.
--   - Weights are NOT auto-normalised: per-role weight sums are reported as a
--     finding when they deviate from 100 — never silently rescaled.
--   - Reversible + idempotent: the seed only inserts missing rows
--     (ON CONFLICT DO NOTHING) and never overwrites admin-curated rows.

CREATE TABLE IF NOT EXISTS onto_role_competency_profiles (
  id              SERIAL PRIMARY KEY,
  role_id         VARCHAR(120) NOT NULL REFERENCES onto_roles(id)        ON DELETE CASCADE,
  competency_id   VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  required_level  INT          NOT NULL,
  weight          NUMERIC(6,2) NOT NULL DEFAULT 0,
  criticality     VARCHAR(20)  NOT NULL DEFAULT 'important',
  rationale       TEXT,
  source          VARCHAR(30)  NOT NULL DEFAULT 'default',
  active          BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_rcp_level     CHECK (required_level BETWEEN 1 AND 5),
  CONSTRAINT chk_rcp_weight    CHECK (weight >= 0 AND weight <= 100),
  CONSTRAINT chk_rcp_crit      CHECK (criticality IN ('critical','important','desirable','optional'))
);

-- One requirement per (role, competency).
CREATE UNIQUE INDEX IF NOT EXISTS uq_rcp_role_comp
  ON onto_role_competency_profiles (role_id, competency_id);

CREATE INDEX IF NOT EXISTS idx_rcp_role   ON onto_role_competency_profiles (role_id);
CREATE INDEX IF NOT EXISTS idx_rcp_comp   ON onto_role_competency_profiles (competency_id);
CREATE INDEX IF NOT EXISTS idx_rcp_source ON onto_role_competency_profiles (source);
