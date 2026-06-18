-- CAPADEX Problem Intelligence Layer (PIL) — Phase 2: Archetype Intelligence Engine
-- Strictly ADDITIVE. Creates ONLY new Phase-2 tables; never alters existing CAPADEX /
-- Phase-1 / 1.5 / 1.6 tables or data. Deterministic, rule-based (no external AI).
-- This DDL is canonical and mirrors the lazy ensure*Schema bootstrap in the runner
-- (backend/scripts/pil/run-archetype-intelligence.ts). No migration runner is used.

-- 2.1 archetype_library — the discovered archetype set (smallest meaningful set).
CREATE TABLE IF NOT EXISTS archetype_library (
  archetype_id            SERIAL PRIMARY KEY,
  archetype_key           TEXT NOT NULL UNIQUE,
  archetype_name          TEXT NOT NULL,
  definition              TEXT NOT NULL DEFAULT '',
  primary_behavior_category TEXT NOT NULL,
  stage_note              TEXT NOT NULL DEFAULT '',
  signature_tokens        JSONB NOT NULL DEFAULT '[]'::jsonb,
  member_count            INTEGER NOT NULL DEFAULT 0,
  capability_count        INTEGER NOT NULL DEFAULT 0,
  problem_count           INTEGER NOT NULL DEFAULT 0,
  behavior_grounded_count INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT archetype_library_primary_cat_chk CHECK (
    primary_behavior_category IN
    ('Academic','Career','Social','Emotional','Cognitive','Leadership','Self-Management','Learning')
  )
);

-- 2.2 archetype_concern_map — each concern's single primary archetype (a partition of
-- the ecosystem). UNIQUE(concern_id) → one primary archetype per concern.
CREATE TABLE IF NOT EXISTS archetype_concern_map (
  map_id            SERIAL PRIMARY KEY,
  archetype_id      INTEGER NOT NULL REFERENCES archetype_library(archetype_id) ON DELETE CASCADE,
  archetype_key     TEXT NOT NULL,
  concern_id        TEXT NOT NULL UNIQUE,
  concern_name      TEXT NOT NULL DEFAULT '',
  canonical_type    TEXT NOT NULL DEFAULT '',
  assignment_score  NUMERIC(6,4) NOT NULL DEFAULT 0,
  token_matches     INTEGER NOT NULL DEFAULT 0,
  assignment_method TEXT NOT NULL DEFAULT 'signature',
  grounding_source  TEXT NOT NULL DEFAULT 'name_only',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT archetype_concern_method_chk CHECK (
    assignment_method IN ('signature','signature+behavior')
  ),
  CONSTRAINT archetype_concern_grounding_chk CHECK (
    grounding_source IN ('direct_cpb','propagated','name_only')
  ),
  CONSTRAINT archetype_concern_score_chk CHECK (assignment_score >= 0 AND assignment_score <= 1)
);
CREATE INDEX IF NOT EXISTS archetype_concern_map_arch_idx ON archetype_concern_map(archetype_id);

-- 2.3 archetype_behavior_profile — behavior-category distribution per archetype
-- (aggregated from capability_problem_behavior_map across the archetype's members).
CREATE TABLE IF NOT EXISTS archetype_behavior_profile (
  profile_id        SERIAL PRIMARY KEY,
  archetype_id      INTEGER NOT NULL REFERENCES archetype_library(archetype_id) ON DELETE CASCADE,
  archetype_key     TEXT NOT NULL,
  behavior_category TEXT NOT NULL,
  behavior_count    INTEGER NOT NULL DEFAULT 0,
  pct               NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT archetype_profile_cat_chk CHECK (
    behavior_category IN
    ('Academic','Career','Social','Emotional','Cognitive','Leadership','Self-Management','Learning')
  ),
  CONSTRAINT archetype_profile_uniq UNIQUE (archetype_id, behavior_category)
);

-- 2.4 archetype_validation — per-archetype quality / coherence / distinctiveness.
CREATE TABLE IF NOT EXISTS archetype_validation (
  validation_id     SERIAL PRIMARY KEY,
  archetype_id      INTEGER NOT NULL REFERENCES archetype_library(archetype_id) ON DELETE CASCADE,
  archetype_key     TEXT NOT NULL UNIQUE,
  member_count      INTEGER NOT NULL DEFAULT 0,
  capability_count  INTEGER NOT NULL DEFAULT 0,
  problem_count     INTEGER NOT NULL DEFAULT 0,
  behavior_grounded_count INTEGER NOT NULL DEFAULT 0,
  coherence         NUMERIC(5,4) NOT NULL DEFAULT 0,
  distinctiveness   NUMERIC(5,4) NOT NULL DEFAULT 0,
  validation_status TEXT NOT NULL DEFAULT 'weak',
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT archetype_validation_status_chk CHECK (validation_status IN ('strong','moderate','weak')),
  CONSTRAINT archetype_validation_coherence_chk CHECK (coherence >= 0 AND coherence <= 1),
  CONSTRAINT archetype_validation_distinct_chk CHECK (distinctiveness >= 0 AND distinctiveness <= 1)
);

-- 2.5 archetype_unmatched_review — concerns with no token anchor in any archetype.
-- Flagged for human review, NEVER force-fit.
CREATE TABLE IF NOT EXISTS archetype_unmatched_review (
  review_id          SERIAL PRIMARY KEY,
  concern_id         TEXT NOT NULL UNIQUE,
  concern_name       TEXT NOT NULL DEFAULT '',
  canonical_type     TEXT NOT NULL DEFAULT '',
  best_archetype_key TEXT NOT NULL DEFAULT '',
  best_score         NUMERIC(6,4) NOT NULL DEFAULT 0,
  reason             TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 archetype_family_map — roll-up of Phase-1.5 concern_families into archetypes
-- (which archetypes a curated family's concerns land in). Honors the concern_families
-- + family_behavior_coverage inputs and surfaces fragmented families.
CREATE TABLE IF NOT EXISTS archetype_family_map (
  id              SERIAL PRIMARY KEY,
  family_name     TEXT NOT NULL,
  archetype_key   TEXT NOT NULL,
  concern_count   INTEGER NOT NULL DEFAULT 0,
  family_total    INTEGER NOT NULL DEFAULT 0,
  share_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT archetype_family_uniq UNIQUE (family_name, archetype_key)
);
