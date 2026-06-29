-- ============================================================================
-- MX-800 Phase 2.4 — Runtime Intelligence Engine.
--
-- Canonical, additive, flag-gated (runtimeIntelligenceEngine, default OFF).
-- This is the RUNTIME-semantics knowledge registry (runtime components: the
-- backend process / datastores / external services / stores + their MEASURED
-- live signals and honest-NULL ownership/metadata). It does NOT duplicate the
-- MX-700 platform_lifecycle registry (lifecycle states), the MX-800 2.1
-- platform_intelligence_registry (intelligence engines) nor the MX-800 2.3
-- engineering_knowledge_registry (code artifacts) — it SOFT-REFERENCES the
-- lifecycle catalog via lifecycle_uid and COMPOSES the EXISTING health-aggregator
-- runtime checks + live process/OS/pg measurements for its health / performance /
-- service / observability / resource / metrics reads. No business logic is
-- modified; no dormant capability is activated; owner is MANAGED (human) and
-- NEVER overwritten by re-discovery.
--
-- The lazy ensure-schema in services/runtime-intelligence.ts mirrors this file
-- and runs ONLY on flag-ON write paths (discover / register / audit-capture) so
-- with the flag OFF this phase is byte-identical incl. schema (0 tables).
-- ============================================================================

CREATE TABLE IF NOT EXISTS runtime_component_registry (
  id                  BIGSERIAL PRIMARY KEY,
  runtime_uid         TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  component_type      TEXT NOT NULL,            -- process|datastore|service|store|monitor
  category            TEXT,                     -- backend|external|infrastructure (honest-NULL when unknown)
  owner               TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
  present             BOOLEAN,                  -- DERIVED: in-process or configured (env present) — NOT a health verdict
  endpoint_ref        TEXT,                     -- 'in-process' or the env var / table that locates it
  metadata            JSONB NOT NULL DEFAULT '{}',
  lifecycle_uid       TEXT,                     -- SOFT reference into platform_lifecycle (no FK; may be null)
  source              TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rcr_component_type ON runtime_component_registry (component_type);
CREATE INDEX IF NOT EXISTS idx_rcr_category       ON runtime_component_registry (category);

-- Append-only runtime audit snapshots (drift / runtime-stability-trend detection).
CREATE TABLE IF NOT EXISTS runtime_intelligence_audit_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  snapshot_uid                TEXT UNIQUE NOT NULL,
  registry_total              INTEGER,
  application_health_score    INTEGER,
  db_latency_avg_ms           NUMERIC,
  event_loop_lag_ms           NUMERIC,
  process_rss_mb              INTEGER,
  memory_headroom_pct         NUMERIC,
  service_availability_pct    NUMERIC,
  observability_coverage_pct  NUMERIC,
  metrics                     JSONB NOT NULL DEFAULT '{}',
  validation                  JSONB NOT NULL DEFAULT '{}',
  summary                     JSONB NOT NULL DEFAULT '{}',
  captured_by                 TEXT,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rias_captured_at
  ON runtime_intelligence_audit_snapshots (captured_at DESC);
