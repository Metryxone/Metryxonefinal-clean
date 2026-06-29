-- ============================================================================
-- MX-700 Phase 1.41 — Platform Lifecycle Automation & Continuous Governance Engine
-- ----------------------------------------------------------------------------
-- ENHANCEMENT-ONLY. This phase COMPOSES the Phase 1.37 Foundation
-- (platform_lifecycle_registry / capability_catalog / ownership / relationships /
-- state_history), the Phase 1.38 Management ledgers (platform_lifecycle_
-- {deprecation,retirement,version_ledger,evolution}), the Phase 1.39 Intelligence
-- layer (lifecycle validation / metrics / compatibility / repository health) and
-- the Phase 1.40 Evolution layer (evolution validation / metrics / technical-debt
-- / knowledge). It introduces NO duplicate automation/governance/policy/compliance/
-- validation registry and NO parallel engine — the automation, governance,
-- compliance, orchestration, continuous-validation and quality-gate views READ the
-- existing getters and MEASURE compliance against the live registry on demand.
--
-- It adds only the two GENUINELY-NEW persistence surfaces that no prior phase models:
--   1. platform_governance_policies        — a curated lifecycle/governance policy
--      registry. A deterministic BUILT-IN policy set lives in code (the honesty
--      contract expressed as machine-checkable rules); this table holds the
--      human-authored CUSTOM policies. Compliance is MEASURED at request time by
--      evaluating each policy against the live registry — results are NOT persisted
--      here (compliance ≠ runtime usage; a policy existing ≠ a system being compliant).
--   2. platform_governance_audit_snapshots — append-only continuous-governance audit
--      snapshots (point-in-time MEASURED automation/compliance/governance metrics for
--      drift detection).
--
-- Flag-gated: the backend NEVER runs this DDL unless `platformLifecycleAutomation`
-- (FF_PLATFORM_LIFECYCLE_AUTOMATION) is ON. Each table is mirrored by a lazy
-- ensure-schema in backend/services/platform-lifecycle-automation.ts that runs ONLY
-- on a flag-ON WRITE path, so with the flag OFF none of these tables are ever created
-- -> byte-identical legacy behaviour incl. schema. lifecycle_uid / target are SOFT
-- references to platform_lifecycle_registry (no hard FK — registry rows are re-derived
-- by discovery and must not block governance metadata).
--
-- HONESTY CONTRACT: Automation ≠ Activation · Validation ≠ Modification · Governance ≠
-- BusinessLogic · Compliance ≠ RuntimeUsage · Policy-Exists ≠ Compliant · Gate-Pass ≠
-- Production-Ready · Coverage ≠ Confidence ≠ Evidence. Counts are MEASURED, never
-- estimated; metrics are SIX SEPARATE scores (NEVER composited); null ≠ zero.
-- ============================================================================

-- PART 3 — Governance Policy Registry (curated/custom policies; built-ins live in code)
CREATE TABLE IF NOT EXISTS platform_governance_policies (
  policy_uid             TEXT PRIMARY KEY,
  policy_key             TEXT UNIQUE NOT NULL,        -- stable machine key (e.g. custom.capability_owner_required)
  title                  TEXT NOT NULL,
  description            TEXT,
  policy_domain          TEXT NOT NULL,               -- lifecycle / repository / architecture / migration / feature_flag / documentation / ownership / version / deprecation / retirement
  scope_entity_type      TEXT,                         -- capability / module / api / model / migration / NULL (all)
  rule_kind              TEXT NOT NULL,               -- field_present / field_absent / value_in / count_threshold (deterministic, evaluated read-only vs live registry)
  rule_field             TEXT,                         -- registry column the rule inspects (honest-NULL when rule_kind is structural)
  rule_params            JSONB NOT NULL DEFAULT '{}', -- e.g. {"allowed":["compatible"]} / {"max":0}
  severity               TEXT NOT NULL DEFAULT 'warn',-- info / warn / blocking
  enabled                BOOLEAN NOT NULL DEFAULT true,
  evidence               TEXT,
  documentation_reference TEXT,
  lifecycle_uid          TEXT,                         -- soft ref (nullable)
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pga_policy_domain ON platform_governance_policies (policy_domain, enabled);

-- PART 8 — Continuous Governance Audit (append-only point-in-time MEASURED metrics for drift)
CREATE TABLE IF NOT EXISTS platform_governance_audit_snapshots (
  id                     BIGSERIAL PRIMARY KEY,
  snapshot_uid           TEXT UNIQUE NOT NULL,
  -- Six SEPARATE measured scores (each independent; NEVER composited into one verdict). NULL when not measurable.
  automation_health      NUMERIC,
  compliance_health      NUMERIC,
  governance_health      NUMERIC,
  validation_success     NUMERIC,
  repository_stability   NUMERIC,
  lifecycle_stability    NUMERIC,
  metrics                JSONB NOT NULL DEFAULT '{}', -- full measured payload captured verbatim for drift
  compliance_indicators  JSONB NOT NULL DEFAULT '{}', -- measured policy-violation + governance counts
  captured_by            TEXT,
  captured_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pga_audit_captured_at ON platform_governance_audit_snapshots (captured_at DESC);
