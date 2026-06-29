-- ============================================================================
-- MX-800 Phase 2.3 — Engineering Intelligence Engine.
--
-- Canonical, additive, flag-gated (engineeringIntelligence, default OFF).
-- This is the ENGINEERING-semantics knowledge registry (code artifacts: modules /
-- services / routes-APIs / libraries / dependencies + their MEASURED size and
-- honest-NULL ownership/metadata). It does NOT duplicate the MX-700
-- platform_lifecycle capability/lifecycle registry (lifecycle states) nor the
-- MX-800 2.1 platform_intelligence_registry (intelligence engines) — it
-- SOFT-REFERENCES the lifecycle catalog via lifecycle_uid and COMPOSES the
-- existing 1.39/1.40 repository-health / debt-marker / metrics getters for its
-- code/architecture/dependency/quality/metrics reads. No business logic is
-- modified; no dormant capability is activated; owner is MANAGED (human) and
-- NEVER overwritten by re-discovery.
--
-- The lazy ensure-schema in services/engineering-intelligence.ts mirrors this
-- file and runs ONLY on flag-ON write paths (discover / register / audit-capture)
-- so with the flag OFF this phase is byte-identical incl. schema (0 tables).
-- ============================================================================

CREATE TABLE IF NOT EXISTS engineering_knowledge_registry (
  id                  BIGSERIAL PRIMARY KEY,
  engineering_uid     TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  entity_type         TEXT NOT NULL,            -- module|service|route|api|library|dependency|component
  category            TEXT,                     -- backend|frontend|shared|external (honest-NULL when unknown)
  owner               TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
  present             BOOLEAN,                  -- DERIVED: repository file existence verified
  size_lines          INTEGER,                  -- MEASURED line count (NULL for non-file libraries)
  size_bytes          INTEGER,                  -- MEASURED byte size (NULL for non-file libraries)
  version             TEXT,                     -- library version (from manifest) when applicable
  dependency_type     TEXT,                     -- runtime|build (libraries); NULL otherwise
  repository_ref      TEXT,                     -- repo path or manifest key
  documentation_ref   TEXT,                     -- honest-NULL when undocumented
  metadata            JSONB NOT NULL DEFAULT '{}',
  lifecycle_uid       TEXT,                     -- SOFT reference into platform_lifecycle (no FK; may be null)
  source              TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ekr_entity_type ON engineering_knowledge_registry (entity_type);
CREATE INDEX IF NOT EXISTS idx_ekr_category    ON engineering_knowledge_registry (category);

-- Append-only engineering audit snapshots (drift / technical-debt-trend detection).
CREATE TABLE IF NOT EXISTS engineering_intelligence_audit_snapshots (
  id                       BIGSERIAL PRIMARY KEY,
  snapshot_uid             TEXT UNIQUE NOT NULL,
  registry_total           INTEGER,
  code_size_total_lines    INTEGER,
  debt_markers_total       INTEGER,
  large_files              INTEGER,
  circular_dependencies    INTEGER,
  documentation_coverage   NUMERIC,
  metrics                  JSONB NOT NULL DEFAULT '{}',
  validation               JSONB NOT NULL DEFAULT '{}',
  summary                  JSONB NOT NULL DEFAULT '{}',
  captured_by              TEXT,
  captured_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eias_captured_at
  ON engineering_intelligence_audit_snapshots (captured_at DESC);
