-- MX-800 Phase 2.9 — Continuous Learning Intelligence Engine.
--
-- ENHANCEMENT-ONLY, flag-gated by `continuousLearningIntelligenceEngine` (default OFF). This migration is
-- the CANONICAL mirror of the lazy ensureLearningSchema() in
-- backend/services/continuous-learning-intelligence-engine.ts. With the flag OFF the engine NEVER calls
-- ensure-schema (every route 503s before any DB touch), so this DDL is the only way the two owned tables
-- come into existence → flag OFF is byte-identical legacy behaviour INCLUDING schema (0 new tables).
--
-- The tier is READ-ONLY over the EXISTING learning / feedback / experience / adaptive / improvement /
-- organizational-learning tables and the prior intelligence-tier summaries. It owns ONLY these two tables;
-- it NEVER writes to, alters, or invokes any existing learning/adaptive engine. CREATE ... IF NOT EXISTS
-- is idempotent and additive.

-- Catalog of the platform's EXISTING learning CAPABILITIES (not a new engine; a registry of what exists).
CREATE TABLE IF NOT EXISTS learning_registry (
  id                  BIGSERIAL PRIMARY KEY,
  learning_uid        TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  learning_kind       TEXT NOT NULL,           -- learning|feedback|experience|adaptive|improvement|organizational
  domain              TEXT,                    -- behaviour|career|learning|meta|hiring|predictive|competency|runtime|assessment|platform|innovation|organizational
  physical_table      TEXT,                    -- the EXISTING persisted learning trail (read-only) or NULL (compute-on-read)
  engine_path         TEXT,                    -- the EXISTING engine source file (existence read-only) or NULL
  governing_flag      TEXT,                    -- governing feature flag key or NULL (unverified gate — honest)
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
CREATE INDEX IF NOT EXISTS idx_lr_learning_kind ON learning_registry (learning_kind);
CREATE INDEX IF NOT EXISTS idx_lr_domain        ON learning_registry (domain);

-- Append-only measured audit snapshots (drift over time). Metrics stored as SEPARATE columns — there is
-- deliberately NO composite/overall. improvement_rate_pct + effectiveness_pct are honest-NULL (unmeasurable).
CREATE TABLE IF NOT EXISTS continuous_learning_intelligence_audit_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  snapshot_uid                TEXT UNIQUE NOT NULL,
  registry_total              INTEGER,
  capabilities_present        INTEGER,
  learning_events_recorded    INTEGER,
  learning_quality_pct        NUMERIC,
  learning_confidence_pct     NUMERIC,
  improvement_rate_pct        NUMERIC,         -- honest-NULL (longitudinal improvement unmeasurable)
  learning_coverage_pct       NUMERIC,
  explainability_pct          NUMERIC,
  effectiveness_pct           NUMERIC,         -- honest-NULL (outcome unmeasurable)
  metrics                     JSONB NOT NULL DEFAULT '{}',
  validation                  JSONB NOT NULL DEFAULT '{}',
  summary                     JSONB NOT NULL DEFAULT '{}',
  captured_by                 TEXT,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clias_captured_at ON continuous_learning_intelligence_audit_snapshots (captured_at DESC);
