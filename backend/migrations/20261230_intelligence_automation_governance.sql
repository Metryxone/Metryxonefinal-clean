-- MX-800 Phase 2.12 — Intelligence Automation & Governance Orchestration Platform
-- ENHANCEMENT-ONLY. Two registry tables ONLY. This tier is a READ-ONLY view that COMPOSES the EXISTING
-- automation / governance / workflow / policy / event / approval capabilities (MX-700 1.41
-- platform-lifecycle-automation + workflow-engine + the prior MX-800 intelligence tiers). It introduces
-- NO parallel automation platform, DUPLICATES no engine, INVOKES / ACTIVATES no dormant engine, and
-- changes NO business logic. The canonical mirror of this DDL lives in the service's lazy
-- ensureAutomationGovernanceSchema(), which runs ONLY on flag-ON write paths (discover / register /
-- audit-capture). With the flag OFF nothing here is created → byte-identical legacy behaviour incl. schema.
--
-- Honesty contract: Automation ≠ Autonomy · Orchestration ≠ Decision · Approval ≠ Execution · Workflow ≠
-- Business-Logic · Recommendation ≠ Approval · Built ≠ Activated · Present ≠ Populated · null ≠ 0.

CREATE TABLE IF NOT EXISTS automation_governance_registry (
  id                  BIGSERIAL PRIMARY KEY,
  automation_uid      TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  automation_kind     TEXT NOT NULL,           -- automation|governance|workflow|event|intelligence
  domain              TEXT,                    -- automation|governance|policy|compliance|validation|quality|workflow|event|approval|orchestration|observability|intelligence
  physical_table      TEXT,                    -- the EXISTING persisted trail (read-only, COUNT-only) or NULL
  engine_path         TEXT,                    -- the EXISTING engine source file (existence read-only, never invoked) or NULL
  governing_flag      TEXT,                    -- governing feature flag key or NULL (unverified gate — honest)
  tier                TEXT,                    -- source tier label (e.g. 'MX-700 1.41') or NULL
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
CREATE INDEX IF NOT EXISTS idx_agr_automation_kind ON automation_governance_registry (automation_kind);
CREATE INDEX IF NOT EXISTS idx_agr_domain          ON automation_governance_registry (domain);

CREATE TABLE IF NOT EXISTS automation_governance_audit_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  snapshot_uid                TEXT UNIQUE NOT NULL,
  registry_total              INTEGER,
  capabilities_present        INTEGER,
  automation_records          INTEGER,
  tiers_reachable             INTEGER,
  automation_health_pct       NUMERIC,
  governance_maturity_pct     NUMERIC,
  automation_coverage_pct     NUMERIC,
  explainability_pct          NUMERIC,
  automation_effectiveness_pct NUMERIC,
  governance_optimization_pct NUMERIC,
  metrics                     JSONB,
  validation                  JSONB,
  summary                     JSONB,
  captured_by                 TEXT,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agas_captured_at ON automation_governance_audit_snapshots (captured_at DESC);
