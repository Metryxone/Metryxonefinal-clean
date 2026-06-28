-- ============================================================================
-- MX-700 Phase 1.37 — Platform Lifecycle Foundation
-- Capability Catalog + Lifecycle Registry + Ownership + Lifecycle Metadata +
-- Lifecycle State Engine + Relationships.
--
-- Flag-gated by `platformLifecycleFoundation` (default OFF). With the flag OFF
-- the lazy ensure-schema in services/platform-lifecycle.ts never runs, so these
-- tables are NEVER created at runtime -> byte-identical legacy behaviour incl.
-- schema. This file is the canonical mirror of that ensure-schema.
--
-- `platform_*` prefix is deliberate: it AVOIDS collision with the existing
-- competency/career-graph capability layer (capability_master /
-- capability_cluster_master ...), which is a DIFFERENT domain concept.
-- Additive only. Reuse-before-build: discovery REFERENCES the existing feature
-- flag registry, migrations, routes, services and docs — it never duplicates them.
-- ============================================================================

-- Capability Catalog (Part 2) — formal catalog of platform capabilities/modules.
CREATE TABLE IF NOT EXISTS platform_capability_catalog (
  id                   SERIAL PRIMARY KEY,
  capability_key       TEXT UNIQUE NOT NULL,            -- canonical id, e.g. capability:questionFactory / module:routes/foo.ts
  canonical_name       TEXT NOT NULL,
  description          TEXT,
  business_domain      TEXT,
  technical_domain     TEXT,
  source_kind          TEXT NOT NULL,                   -- flag | module | service | model
  repository_reference TEXT,                            -- file path (MEASURED)
  feature_flags        TEXT[] DEFAULT '{}',
  dependencies         TEXT[] DEFAULT '{}',
  consumers            TEXT[] DEFAULT '{}',
  activation_status    TEXT,                            -- active | dormant | unknown (DERIVED; built<>activated)
  compatibility_status TEXT DEFAULT 'compatible',
  lifecycle_state      TEXT,                            -- mirror of registry state
  discovered_at        TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ DEFAULT NOW(),
  metadata             JSONB DEFAULT '{}'
);

-- Capability Ownership (Part 3) — owners are NULL when unassigned (honest, never fabricated).
CREATE TABLE IF NOT EXISTS platform_capability_ownership (
  id                      SERIAL PRIMARY KEY,
  capability_key          TEXT UNIQUE NOT NULL REFERENCES platform_capability_catalog(capability_key) ON DELETE CASCADE,
  business_owner          TEXT,
  engineering_owner       TEXT,
  architect_owner         TEXT,
  repository_location     TEXT,
  documentation_location  TEXT,
  migration_references    TEXT[] DEFAULT '{}',
  feature_flag_references TEXT[] DEFAULT '{}',
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Lifecycle Registry (Part 1) — one row per managed entity. Lifecycle Metadata (Part 4) folded in.
CREATE TABLE IF NOT EXISTS platform_lifecycle_registry (
  id                    SERIAL PRIMARY KEY,
  lifecycle_uid         TEXT UNIQUE NOT NULL,            -- entity_type:entity_identifier
  entity_type           TEXT NOT NULL,                   -- capability | feature | module | service | api | model | migration | documentation | flag
  entity_identifier     TEXT NOT NULL,
  lifecycle_state       TEXT NOT NULL DEFAULT 'implemented',
  lifecycle_stage       TEXT,
  lifecycle_version     TEXT,
  owner                 TEXT,
  dependencies          TEXT[] DEFAULT '{}',
  activation_state      TEXT,                            -- active | dormant | unknown
  feature_flag          TEXT,
  retirement_status     TEXT DEFAULT 'none',             -- none | candidate | retired
  deprecation_status    TEXT DEFAULT 'none',             -- none | deprecated
  compatibility_status  TEXT DEFAULT 'compatible',
  documentation_reference TEXT,
  migration_reference   TEXT,                            -- migration origin file
  migration_version     TEXT,                            -- YYYYMMDD prefix
  migration_date        TEXT,
  repository_reference   TEXT,
  introduced_phase      TEXT,
  current_version       TEXT,
  compatibility_version TEXT,
  last_validation       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_modified         TIMESTAMPTZ DEFAULT NOW(),
  metadata             JSONB DEFAULT '{}'
);

-- Lifecycle State Engine history (Part 5) — APPEND-ONLY. State transitions preserve history; never delete.
CREATE TABLE IF NOT EXISTS platform_lifecycle_state_history (
  id            SERIAL PRIMARY KEY,
  lifecycle_uid TEXT NOT NULL,
  from_state    TEXT,
  to_state      TEXT NOT NULL,
  reason        TEXT,
  evidence      TEXT,
  changed_by    TEXT,
  changed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Lifecycle Relationships (Part 6) — measured edges between entities.
CREATE TABLE IF NOT EXISTS platform_lifecycle_relationships (
  id                SERIAL PRIMARY KEY,
  from_uid          TEXT NOT NULL,
  to_uid            TEXT NOT NULL,
  relationship_type TEXT NOT NULL,                       -- gated_by | depends_on | documented_by | introduced_by | consumes
  evidence          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_uid, to_uid, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_plc_registry_state   ON platform_lifecycle_registry(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_plc_registry_type    ON platform_lifecycle_registry(entity_type);
CREATE INDEX IF NOT EXISTS idx_plc_catalog_domain   ON platform_capability_catalog(business_domain);
CREATE INDEX IF NOT EXISTS idx_plc_catalog_source   ON platform_capability_catalog(source_kind);
CREATE INDEX IF NOT EXISTS idx_plc_state_hist_uid   ON platform_lifecycle_state_history(lifecycle_uid);
CREATE INDEX IF NOT EXISTS idx_plc_rel_from         ON platform_lifecycle_relationships(from_uid);
CREATE INDEX IF NOT EXISTS idx_plc_rel_to           ON platform_lifecycle_relationships(to_uid);
