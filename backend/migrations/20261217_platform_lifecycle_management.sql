-- ============================================================================
-- MX-700 Phase 1.38 — Platform Lifecycle Management Engine
-- ----------------------------------------------------------------------------
-- ADDITIVE on the Phase 1.37 Foundation. These tables hold the management-tier
-- metadata that the Foundation registry does not model in dedicated columns
-- (deprecation policy/reason/replacement, retirement approval/archive, an
-- append-only version ledger, and an append-only evolution log).
--
-- The authoritative lifecycle_state remains in platform_lifecycle_registry and
-- is mutated ONLY through the Foundation's transitionState() (append-only
-- platform_lifecycle_state_history). This phase COMPOSES that engine — it does
-- NOT create a parallel registry or state machine.
--
-- Flag-gated: backend never runs this DDL unless `platformLifecycleManagement`
-- is ON (ensureManagementSchema runs only on flag-ON write paths). Flag-OFF is
-- byte-identical incl. schema. lifecycle_uid is a soft reference to
-- platform_lifecycle_registry.lifecycle_uid (no hard FK — registry rows are
-- re-derived by discovery and must not block management metadata).
-- ============================================================================

-- PART 7 — Deprecation Engine (current authoritative deprecation metadata per entity)
CREATE TABLE IF NOT EXISTS platform_lifecycle_deprecation (
  lifecycle_uid          TEXT PRIMARY KEY,
  deprecation_policy     TEXT,
  deprecation_reason     TEXT,
  replacement_reference  TEXT,
  migration_target       TEXT,
  compatibility_status   TEXT,
  deprecation_timeline   TEXT,
  effective_at           TIMESTAMPTZ,
  deprecated_by          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PART 8 — Retirement Engine (current authoritative retirement metadata per entity)
CREATE TABLE IF NOT EXISTS platform_lifecycle_retirement (
  lifecycle_uid          TEXT PRIMARY KEY,
  approval_status        TEXT,
  approved_by            TEXT,
  archive_reference      TEXT,
  knowledge_preservation TEXT,
  dependency_validation  JSONB,
  retired_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PART 6 — Version Management (append-only version ledger)
CREATE TABLE IF NOT EXISTS platform_lifecycle_version_ledger (
  id                   BIGSERIAL PRIMARY KEY,
  lifecycle_uid        TEXT NOT NULL,
  current_version      TEXT,
  previous_version     TEXT,
  migration_version    TEXT,
  rollback_version     TEXT,
  release_status       TEXT,
  compatibility        TEXT,
  recorded_by          TEXT,
  recorded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plm_version_uid ON platform_lifecycle_version_ledger (lifecycle_uid, recorded_at DESC);

-- PART 9 — Evolution Engine (append-only evolution / enhancement log)
CREATE TABLE IF NOT EXISTS platform_lifecycle_evolution (
  id              BIGSERIAL PRIMARY KEY,
  lifecycle_uid   TEXT NOT NULL,
  evolution_type  TEXT NOT NULL,
  summary         TEXT,
  from_value      TEXT,
  to_value        TEXT,
  evidence        TEXT,
  recorded_by     TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plm_evolution_uid ON platform_lifecycle_evolution (lifecycle_uid, recorded_at DESC);
