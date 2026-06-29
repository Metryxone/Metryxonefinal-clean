-- MX-800 Phase 2.10 — Enterprise Intelligence Platform.
--
-- ENHANCEMENT-ONLY, flag-gated by `enterpriseIntelligencePlatform` (default OFF). This migration is the
-- CANONICAL mirror of the lazy ensureEnterpriseSchema() in
-- backend/services/enterprise-intelligence-platform.ts. With the flag OFF the engine NEVER calls
-- ensure-schema (every route 503s before any DB touch), so this DDL is the only way the two owned tables
-- come into existence → flag OFF is byte-identical legacy behaviour INCLUDING schema (0 new tables).
--
-- The tier is READ-ONLY over the EXISTING intelligence registries / audit-snapshot trails (the eight
-- MX-800 intelligence tiers) + the existing enterprise / executive / analytics / governance / reporting
-- engines (existence read-only) + the prior intelligence-tier read-only summaries. It owns ONLY these two
-- tables; it NEVER writes to, alters, or invokes any existing intelligence/enterprise engine.
-- CREATE ... IF NOT EXISTS is idempotent and additive. Integration ≠ Duplication; Insight ≠ Decision;
-- Connected ≠ Orchestrated; Correlation ≠ Causation.

-- Canonical registry of the platform's EXISTING intelligence domains/services (not a new engine; a
-- registry of what exists). owner is MANAGED (human, honest-NULL when unassigned, never clobbered on
-- re-discover); intelligence_uid SOFT-references platform_intelligence_registry (no FK).
CREATE TABLE IF NOT EXISTS enterprise_intelligence_registry (
  id                  BIGSERIAL PRIMARY KEY,
  enterprise_uid      TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  enterprise_kind     TEXT NOT NULL,           -- intelligence|organizational|executive|analytics
  domain              TEXT,                    -- platform|engineering|runtime|knowledge|decision|predictive|recommendation|learning|organizational|governance|executive|reporting|analytics
  physical_table      TEXT,                    -- the EXISTING persisted intelligence trail (read-only) or NULL (compute-on-read / engine-only)
  engine_path         TEXT,                    -- the EXISTING engine source file (existence read-only) or NULL
  governing_flag      TEXT,                    -- governing feature flag key or NULL (unverified gate — honest)
  tier                TEXT,                    -- source tier label (e.g. 'MX-800 2.4') or NULL
  present             BOOLEAN,                 -- DERIVED: substrate (table OR engine) exists — NOT a quality verdict
  table_count         INTEGER,                 -- exact COUNT(*) of the trail at discovery; honest-NULL when unmeasured (≠ 0)
  flag_state          BOOLEAN,                 -- DERIVED governing-flag state (Built ≠ Activated); NULL when no/unverified flag
  owner               TEXT,                    -- MANAGED, honest-NULL when unassigned (never fabricated, never clobbered on re-discover)
  lifecycle_uid       TEXT,                    -- SOFT reference into platform_lifecycle_catalog (no FK; may be null)
  intelligence_uid    TEXT,                    -- SOFT reference into platform_intelligence_registry (no FK; may be null)
  metadata            JSONB NOT NULL DEFAULT '{}',
  source              TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eir_enterprise_kind ON enterprise_intelligence_registry (enterprise_kind);
CREATE INDEX IF NOT EXISTS idx_eir_domain          ON enterprise_intelligence_registry (domain);

-- Append-only measured audit snapshots (drift over time). Metrics stored as SEPARATE columns — there is
-- deliberately NO composite/overall. intelligence_effectiveness_pct + enterprise_optimization_pct are
-- honest-NULL (outcome / longitudinal improvement unmeasurable here).
CREATE TABLE IF NOT EXISTS enterprise_intelligence_audit_snapshots (
  id                              BIGSERIAL PRIMARY KEY,
  snapshot_uid                    TEXT UNIQUE NOT NULL,
  registry_total                  INTEGER,
  capabilities_present            INTEGER,
  intelligence_records            INTEGER,
  tiers_reachable                 INTEGER,
  enterprise_health_pct           NUMERIC,
  intelligence_maturity_pct       NUMERIC,
  intelligence_coverage_pct       NUMERIC,
  explainability_pct              NUMERIC,
  intelligence_effectiveness_pct  NUMERIC,     -- honest-NULL (outcome unmeasurable)
  enterprise_optimization_pct     NUMERIC,     -- honest-NULL (longitudinal improvement unmeasurable)
  metrics                         JSONB NOT NULL DEFAULT '{}',
  validation                      JSONB NOT NULL DEFAULT '{}',
  summary                         JSONB NOT NULL DEFAULT '{}',
  captured_by                     TEXT,
  captured_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eias_captured_at ON enterprise_intelligence_audit_snapshots (captured_at DESC);
