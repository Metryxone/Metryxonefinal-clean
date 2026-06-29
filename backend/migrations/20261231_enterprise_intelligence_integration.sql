-- MX-800 Phase 2.13 — Enterprise Intelligence Integration Platform
--
-- ENHANCEMENT-ONLY. Two ADDITIVE tables owned exclusively by the enterprise-integration tier. This file is
-- the canonical schema; the service mirrors it in a lazy ensure-schema that runs ONLY on flag-ON write
-- paths (discover / register / audit-capture). With the feature flag OFF the routes 503 before any DB touch
-- and the lazy ensure-schema is never reached → flag OFF is byte-identical legacy behaviour INCLUDING schema
-- (these tables are never created). Nothing here changes business logic or activates any engine.
--
-- enterprise_integration_registry: the canonical registry of the EXISTING intelligence/enterprise/platform/
--   automation/reporting SERVICES integrated by this tier. `lifecycle_state` + `owner` are MANAGED (human)
--   and preserved across re-discovery; `activation_state`/`flag_state`/`present`/`table_count` are DERIVED
--   from the live runtime and refreshed on re-discovery. `summary_key` records which read-only summary getter
--   (if any) this tier composes for the service (null = honest non-getter, registered by existence only).
-- enterprise_integration_audit_snapshots: append-only point-in-time integration metrics for drift (the ONLY
--   write path besides discover/register). Six SEPARATE measured scores are stored as separate columns
--   (NEVER a composite); enterprise_readiness is honest-NULL (DEFERRED — Integrated ≠ Operational).

CREATE TABLE IF NOT EXISTS enterprise_integration_registry (
  id               SERIAL PRIMARY KEY,
  integration_uid  TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  service_kind     TEXT NOT NULL,                 -- intelligence | enterprise | platform | automation | reporting
  domain           TEXT,
  physical_table   TEXT,                          -- canonical/audit table name (may be ABSENT in this DB)
  engine_path      TEXT,                          -- source file whose EXISTENCE is read (never invoked)
  governing_flag   TEXT,                          -- governing feature flag whose STATE is read (Built ≠ Activated)
  summary_key      TEXT,                          -- composed read-only summary getter key (null = non-getter)
  tier             TEXT,                           -- originating program phase (e.g. MX-800 2.10, MX-700 1.41)
  intelligence_uid TEXT,                          -- SOFT link to the MX-800 2.1 registry (no FK)
  lifecycle_uid    TEXT,                          -- SOFT link to MX-700 1.37 lifecycle catalog (no FK)
  present          BOOLEAN,                        -- DERIVED: substrate (table OR engine) present
  table_count      INTEGER,                        -- DERIVED: exact COUNT(*) (NEVER n_live_tup); null = unmeasured
  flag_state       BOOLEAN,                        -- DERIVED: governing flag state; null = no/unverified flag
  lifecycle_state  TEXT NOT NULL DEFAULT 'registered', -- MANAGED (human); preserved across re-discovery
  owner            TEXT,                          -- MANAGED (human); honest-null when unassigned; never overwritten
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  source           TEXT NOT NULL DEFAULT 'curated', -- curated | discovered | manual
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eii_registry_kind   ON enterprise_integration_registry (service_kind);
CREATE INDEX IF NOT EXISTS idx_eii_registry_domain ON enterprise_integration_registry (domain);
CREATE INDEX IF NOT EXISTS idx_eii_registry_tier   ON enterprise_integration_registry (tier);

CREATE TABLE IF NOT EXISTS enterprise_integration_audit_snapshots (
  id                                  SERIAL PRIMARY KEY,
  snapshot_uid                        TEXT NOT NULL UNIQUE,
  registry_total                      INTEGER,
  services_present                    INTEGER,
  integration_records                 INTEGER,
  services_reachable                  INTEGER,
  platform_integration_health_pct     NUMERIC,
  enterprise_service_health_pct       NUMERIC,
  api_health_pct                      NUMERIC,
  workflow_health_pct                 NUMERIC,
  intelligence_integration_coverage_pct NUMERIC,
  enterprise_readiness_pct            NUMERIC,        -- honest-NULL (DEFERRED — Integrated ≠ Operational)
  metrics                             JSONB,
  validation                          JSONB,
  summary                             JSONB,
  captured_by                         TEXT,
  captured_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eii_snapshots_captured_at ON enterprise_integration_audit_snapshots (captured_at DESC);
