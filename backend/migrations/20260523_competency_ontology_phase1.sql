-- ============================================================================
-- Phase 1 — Adaptive Career Intelligence: Competency Ontology + Workforce
-- Taxonomy foundation. Migration-safe (CREATE IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS). Preserves all existing tables. Methodology version: 1.0.0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Capability Domains (5 scientific super-categories)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_domains (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  scientific_type     TEXT NOT NULL,
  description         TEXT NOT NULL,
  display_order       INT  NOT NULL DEFAULT 0,
  deprecated          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Competency Families
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_families (
  id                  TEXT PRIMARY KEY,
  domain_id           TEXT NOT NULL REFERENCES onto_domains(id),
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  display_order       INT  NOT NULL DEFAULT 0,
  deprecated          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (domain_id, name)
);
CREATE INDEX IF NOT EXISTS idx_competency_families_domain ON onto_families(domain_id);

-- ----------------------------------------------------------------------------
-- 3. Competencies (canonical)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_competencies (
  id                          TEXT PRIMARY KEY,
  canonical_name              TEXT NOT NULL UNIQUE,
  slug                        TEXT NOT NULL UNIQUE,
  domain_id                   TEXT NOT NULL REFERENCES onto_domains(id),
  family_id                   TEXT NOT NULL REFERENCES onto_families(id),
  scientific_type             TEXT NOT NULL,
  definition                  TEXT NOT NULL,
  trainability                TEXT NOT NULL CHECK (trainability IN ('low','moderate','high')),
  stability_level             TEXT NOT NULL CHECK (stability_level IN ('trait_like','state_like','dynamic')),
  complexity_level            INT  NOT NULL CHECK (complexity_level BETWEEN 1 AND 5),
  leadership_relevance        NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (leadership_relevance BETWEEN 0 AND 1),
  role_relevance              JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring_metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  benchmark_metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  legal_classification        TEXT NOT NULL DEFAULT 'developmental_aggregate',
  version                     TEXT NOT NULL DEFAULT '1.0.0',
  deprecated                  BOOLEAN NOT NULL DEFAULT FALSE,
  deprecated_replacement_id   TEXT REFERENCES onto_competencies(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competencies_domain ON onto_competencies(domain_id);
CREATE INDEX IF NOT EXISTS idx_competencies_family ON onto_competencies(family_id);
CREATE INDEX IF NOT EXISTS idx_competencies_slug   ON onto_competencies(slug);

-- ----------------------------------------------------------------------------
-- 4. Competency Aliases (normalisation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_aliases (
  id                  BIGSERIAL PRIMARY KEY,
  competency_id       TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  alias               TEXT NOT NULL,
  alias_normalized    TEXT NOT NULL,
  source              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competency_id, alias_normalized)
);
CREATE INDEX IF NOT EXISTS idx_competency_aliases_norm ON onto_aliases(alias_normalized);

-- ----------------------------------------------------------------------------
-- 5. Behavioral Indicators (observable behaviors per competency)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_indicators (
  id                  BIGSERIAL PRIMARY KEY,
  competency_id       TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  indicator           TEXT NOT NULL,
  proficiency_level   INT  NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
  display_order       INT  NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_behavioral_indicators_comp ON onto_indicators(competency_id, proficiency_level);

-- ----------------------------------------------------------------------------
-- 6. Proficiency Levels (5-level model — global definitions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_proficiency_levels (
  level                       INT  PRIMARY KEY CHECK (level BETWEEN 1 AND 5),
  label                       TEXT NOT NULL,
  description                 TEXT NOT NULL,
  behavioral_indicators_hint  TEXT NOT NULL,
  complexity_expectation      TEXT NOT NULL,
  role_applicability          TEXT NOT NULL,
  developmental_expectation   TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. Organizational Layers (defined early so onto_complexity_models can FK it)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_layers (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL UNIQUE,
  display_order               INT  NOT NULL DEFAULT 0,
  capability_expectations     TEXT NOT NULL,
  cognitive_complexity        TEXT NOT NULL,
  behavioral_expectations     TEXT NOT NULL,
  strategic_expectations      TEXT NOT NULL,
  decision_scope              TEXT NOT NULL,
  ambiguity_tolerance         TEXT NOT NULL,
  leadership_accountability   TEXT NOT NULL,
  minimum_score               INT  NOT NULL,
  median_score                INT  NOT NULL,
  high_performer_score        INT  NOT NULL,
  exceptional_score           INT  NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7b. Complexity Calibration (same competency, different layer expectations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_complexity_models (
  id                  BIGSERIAL PRIMARY KEY,
  competency_id       TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  layer_id            TEXT NOT NULL REFERENCES onto_layers(id),
  expectation_summary TEXT NOT NULL,
  expected_min_level  INT  NOT NULL CHECK (expected_min_level BETWEEN 1 AND 5),
  expected_target     INT  NOT NULL CHECK (expected_target    BETWEEN 1 AND 5),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competency_id, layer_id)
);

-- ----------------------------------------------------------------------------
-- 8. Competency Relationships (dependency graph)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_relationships (
  id                  BIGSERIAL PRIMARY KEY,
  source_id           TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  target_id           TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  relationship_type   TEXT NOT NULL CHECK (relationship_type IN ('depends_on','prerequisite_of','related_to','reinforces','contrasts_with')),
  strength            NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, target_id, relationship_type),
  CHECK (source_id <> target_id)
);
CREATE INDEX IF NOT EXISTS idx_competency_relationships_src ON onto_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_competency_relationships_tgt ON onto_relationships(target_id);

-- ----------------------------------------------------------------------------
-- 9-13. Workforce Taxonomy (Industry → Function → Subfunction → RoleFamily → Role)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_industries (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  display_order   INT  NOT NULL DEFAULT 0,
  deprecated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onto_functions (
  id              TEXT PRIMARY KEY,
  industry_id     TEXT NOT NULL REFERENCES onto_industries(id),
  name            TEXT NOT NULL,
  description     TEXT,
  display_order   INT  NOT NULL DEFAULT 0,
  deprecated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (industry_id, name)
);
CREATE INDEX IF NOT EXISTS idx_workforce_functions_industry ON onto_functions(industry_id);

CREATE TABLE IF NOT EXISTS onto_subfunctions (
  id              TEXT PRIMARY KEY,
  function_id     TEXT NOT NULL REFERENCES onto_functions(id),
  name            TEXT NOT NULL,
  description     TEXT,
  display_order   INT  NOT NULL DEFAULT 0,
  deprecated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (function_id, name)
);
CREATE INDEX IF NOT EXISTS idx_workforce_subfunctions_fn ON onto_subfunctions(function_id);

CREATE TABLE IF NOT EXISTS onto_role_families (
  id              TEXT PRIMARY KEY,
  subfunction_id  TEXT NOT NULL REFERENCES onto_subfunctions(id),
  name            TEXT NOT NULL,
  description     TEXT,
  display_order   INT  NOT NULL DEFAULT 0,
  deprecated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subfunction_id, name)
);
CREATE INDEX IF NOT EXISTS idx_role_families_subfn ON onto_role_families(subfunction_id);

-- ----------------------------------------------------------------------------
-- 15. Job Roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_roles (
  id                  TEXT PRIMARY KEY,
  role_family_id      TEXT NOT NULL REFERENCES onto_role_families(id),
  layer_id            TEXT NOT NULL REFERENCES onto_layers(id),
  title               TEXT NOT NULL,
  seniority           TEXT,
  description         TEXT,
  display_order       INT  NOT NULL DEFAULT 0,
  deprecated          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_family_id, title, seniority)
);
CREATE INDEX IF NOT EXISTS idx_job_roles_family ON onto_roles(role_family_id);
CREATE INDEX IF NOT EXISTS idx_job_roles_layer  ON onto_roles(layer_id);

-- ----------------------------------------------------------------------------
-- 16. Role DNA Profiles (one canonical DNA per role + version)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_dna_profiles (
  id              TEXT PRIMARY KEY,
  role_id         TEXT NOT NULL REFERENCES onto_roles(id) ON DELETE CASCADE,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, version)
);
CREATE INDEX IF NOT EXISTS idx_role_dna_role ON onto_dna_profiles(role_id, is_current);

-- ----------------------------------------------------------------------------
-- 17. Role Competency Weights
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_role_weights (
  id              BIGSERIAL PRIMARY KEY,
  dna_profile_id  TEXT NOT NULL REFERENCES onto_dna_profiles(id) ON DELETE CASCADE,
  competency_id   TEXT NOT NULL REFERENCES onto_competencies(id),
  weight          NUMERIC(4,3) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  expected_level  INT  NOT NULL CHECK (expected_level BETWEEN 1 AND 5),
  rationale       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dna_profile_id, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_role_comp_weights_dna ON onto_role_weights(dna_profile_id);

-- ----------------------------------------------------------------------------
-- 18. Capability Models (named bundles e.g. "Engineering Leadership Model")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_capability_models (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  domain_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
  family_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
  competency_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  deprecated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 19. Competency Versions (immutable snapshots for reproducibility)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_competency_versions (
  id              BIGSERIAL PRIMARY KEY,
  competency_id   TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  snapshot        JSONB NOT NULL,
  changed_by      TEXT,
  change_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competency_id, version)
);
CREATE INDEX IF NOT EXISTS idx_competency_versions_comp ON onto_competency_versions(competency_id);

-- ----------------------------------------------------------------------------
-- 20. Ontology Audit Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onto_audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  action          TEXT NOT NULL,
  actor           TEXT,
  before_state    JSONB,
  after_state     JSONB,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ontology_audit_entity ON onto_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ontology_audit_time   ON onto_audit_logs(created_at DESC);
