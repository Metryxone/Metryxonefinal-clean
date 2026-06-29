-- ============================================================================
-- MX-800 Phase 2.1 — Platform Intelligence Operating System (PIOS)
-- Constitution & Foundation: Platform Intelligence REGISTRY + GOVERNANCE.
--
-- Canonical, additive, flag-gated (platformIntelligenceRegistry, default OFF).
-- This is the INTELLIGENCE-semantics registry (engines + inputs/outputs/evidence/
-- confidence/explainability/dependencies/compatibility). It does NOT duplicate the
-- MX-700 platform_lifecycle capability/lifecycle registry — it SOFT-REFERENCES it
-- via lifecycle_uid. No business logic is modified; no dormant capability is
-- activated; lifecycle_state is MANAGED (human), activation_state/present are
-- DERIVED from the live flag + filesystem (re-discovery refreshes derived fields
-- and NEVER clobbers a managed lifecycle_state).
--
-- The lazy ensure-schema in services/platform-intelligence-registry.ts mirrors
-- this file and runs ONLY on flag-ON write paths (discover/register/audit-capture)
-- so with the flag OFF this phase is byte-identical incl. schema (0 tables).
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_intelligence_registry (
  id                  BIGSERIAL PRIMARY KEY,
  intelligence_uid    TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  intelligence_type   TEXT NOT NULL,            -- repository|engineering|runtime|knowledge|decision|ai|analytics|enterprise|platform
  domain              TEXT NOT NULL,            -- constitutional domain
  owner               TEXT,                     -- honest-NULL when unknown (never fabricated)
  lifecycle_state     TEXT NOT NULL DEFAULT 'registered',  -- MANAGED (human transitions)
  activation_state    TEXT,                     -- DERIVED from live flag (built_off|built_on|n/a)
  present             BOOLEAN,                  -- DERIVED: repository file existence verified
  inputs              JSONB NOT NULL DEFAULT '[]',
  outputs             JSONB NOT NULL DEFAULT '[]',
  dependencies        JSONB NOT NULL DEFAULT '[]',
  evidence            JSONB NOT NULL DEFAULT '{}',
  confidence          JSONB NOT NULL DEFAULT '{}',   -- structural-only confidence descriptor (no runtime/outcome claim)
  explainability      JSONB NOT NULL DEFAULT '{}',
  repository_refs     JSONB NOT NULL DEFAULT '[]',
  documentation_refs  JSONB NOT NULL DEFAULT '[]',
  compatibility       JSONB NOT NULL DEFAULT '{}',
  version             TEXT,
  flag_key            TEXT,                     -- gating feature flag, when applicable
  lifecycle_uid       TEXT,                     -- SOFT reference into platform_lifecycle (no FK; may be null)
  source              TEXT NOT NULL DEFAULT 'catalog',  -- catalog|discovered|manual
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pir_domain ON platform_intelligence_registry (domain);
CREATE INDEX IF NOT EXISTS idx_pir_type   ON platform_intelligence_registry (intelligence_type);

-- Append-only governance/validation audit snapshots (drift detection).
CREATE TABLE IF NOT EXISTS platform_intelligence_audit_snapshots (
  id                       BIGSERIAL PRIMARY KEY,
  snapshot_uid             TEXT UNIQUE NOT NULL,
  registry_total           INTEGER,
  domains_covered          INTEGER,
  metadata_completeness    NUMERIC,
  governance_completeness  NUMERIC,
  duplicate_registries     INTEGER,
  validation               JSONB NOT NULL DEFAULT '{}',
  summary                  JSONB NOT NULL DEFAULT '{}',
  captured_by              TEXT,
  captured_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pir_snapshots_captured_at
  ON platform_intelligence_audit_snapshots (captured_at DESC);
