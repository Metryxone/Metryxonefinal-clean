-- ============================================================================
-- MX-800 Phase 2.5 — Knowledge Intelligence Engine.
--
-- Canonical, additive, flag-gated (knowledgeIntelligenceEngine, default OFF).
-- This is the KNOWLEDGE-source registry + audit-snapshot store for the engine
-- that CONNECTS the EXISTING ontology / knowledge assets into ONE Enterprise
-- Knowledge Graph COMPUTED ON READ. It does NOT materialize a parallel knowledge
-- graph (the live kg_edges / pil_kg_* / tig_* graphs remain the sole materialized
-- graphs, read COUNT-ONLY and never written), does NOT duplicate an ontology
-- (it SOFT-REFERENCES the ont_*/onto_*/map_*/sci_* tables read-only) and does NOT
-- duplicate the MX-700 platform_lifecycle catalog nor the MX-800 2.1/2.3/2.4
-- intelligence registries — it COMPOSES them. No business logic is modified;
-- no dormant capability is activated; owner is MANAGED (human) and NEVER
-- overwritten by re-discovery.
--
-- The lazy ensure-schema in services/knowledge-intelligence.ts mirrors this file
-- and runs ONLY on flag-ON write paths (discover / register / audit-capture) so
-- with the flag OFF this phase is byte-identical incl. schema (0 tables).
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_source_registry (
  id              BIGSERIAL PRIMARY KEY,
  knowledge_uid   TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  source_type     TEXT NOT NULL,            -- entity|relation|graph|registry|version
  domain          TEXT,                     -- taxonomy|competency_genome|ontology_edges|cross_ontology|semantic|knowledge_graph|career_graph|versioning|intelligence_registry
  graph_role      TEXT,                     -- node|edge|meta (projection onto the computed-on-read graph)
  physical_table  TEXT NOT NULL,            -- the EXISTING source table (read-only, never written)
  present         BOOLEAN,                  -- DERIVED: to_regclass existence — NOT a quality verdict
  measured_count  INTEGER,                  -- exact COUNT(*) at discovery; honest-NULL when unmeasured (≠ 0)
  owner           TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
  lifecycle_uid   TEXT,                     -- SOFT reference into platform_lifecycle (no FK; may be null)
  metadata        JSONB NOT NULL DEFAULT '{}',
  source          TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ksr_source_type ON knowledge_source_registry (source_type);
CREATE INDEX IF NOT EXISTS idx_ksr_domain      ON knowledge_source_registry (domain);

-- Append-only knowledge audit snapshots (drift / knowledge-growth-trend detection).
CREATE TABLE IF NOT EXISTS knowledge_intelligence_audit_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  snapshot_uid                TEXT UNIQUE NOT NULL,
  registry_total              INTEGER,
  sources_present             INTEGER,
  graph_nodes                 INTEGER,
  graph_edges                 INTEGER,
  knowledge_completeness_pct  NUMERIC,
  relationship_coverage_pct   NUMERIC,
  ontology_health_pct         NUMERIC,
  semantic_consistency_pct    NUMERIC,
  knowledge_confidence_pct    NUMERIC,
  context_quality_pct         NUMERIC,
  metrics                     JSONB NOT NULL DEFAULT '{}',
  validation                  JSONB NOT NULL DEFAULT '{}',
  summary                     JSONB NOT NULL DEFAULT '{}',
  captured_by                 TEXT,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kias_captured_at
  ON knowledge_intelligence_audit_snapshots (captured_at DESC);
