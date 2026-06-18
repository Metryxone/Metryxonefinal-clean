-- CAPADEX PIL — Phase 1.5: Concern Ontology Normalization (ADDITIVE).
-- Canonical DDL; mirrors the lazy ensure*Schema() bootstrap in
-- backend/scripts/pil/run-ontology-normalization.ts (no migration runner).
-- Extension tables only — never modifies existing CAPADEX tables/data.

-- 1.5C — canonical concern model (also carries the 1.5A reclassification).
CREATE TABLE IF NOT EXISTS normalized_concern_ontology (
  ontology_id      SERIAL PRIMARY KEY,
  concern_id       TEXT NOT NULL UNIQUE,
  concern_name     TEXT NOT NULL,
  canonical_type   TEXT NOT NULL CHECK (canonical_type IN
                     ('Capability','Problem','Behavior','Trait','Outcome','Risk')),
  canonical_entity TEXT NOT NULL,
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS normalized_concern_ontology_type_idx ON normalized_concern_ontology (canonical_type);

-- 1.5B — capability ↔ problem-state separation.
CREATE TABLE IF NOT EXISTS capability_problem_map (
  mapping_id            SERIAL PRIMARY KEY,
  capability_concern_id TEXT NOT NULL,
  capability_name       TEXT NOT NULL,
  problem_concern_id    TEXT NOT NULL,
  problem_name          TEXT NOT NULL,
  confidence_score      NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  mapping_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capability_concern_id, problem_concern_id)
);

-- 1.5D — duplicate / near-synonym construct pairs.
CREATE TABLE IF NOT EXISTS construct_similarity_map (
  id                SERIAL PRIMARY KEY,
  concern_a         TEXT NOT NULL,
  concern_b         TEXT NOT NULL,
  similarity_score  NUMERIC(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  recommended_group TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (concern_a, concern_b)
);

-- 1.5E — concern families (construct-similarity clusters).
CREATE TABLE IF NOT EXISTS concern_families (
  family_id          SERIAL PRIMARY KEY,
  family_name        TEXT NOT NULL UNIQUE,
  concern_count      INTEGER NOT NULL,
  primary_concern_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
