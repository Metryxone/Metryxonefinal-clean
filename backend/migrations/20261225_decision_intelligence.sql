-- MX-800 Phase 2.6 — Decision Intelligence Engine
-- Canonical migration for the TWO tables this read-only intelligence tier OWNS. It mirrors the lazy
-- ensureDecisionSchema() in backend/services/decision-intelligence.ts (no migration runner — the lazy
-- ensure-schema is the live path). The tier is flag-gated by `decisionIntelligenceEngine` (default OFF):
-- with the flag OFF no write path runs and these tables are NEVER created → byte-identical legacy
-- behaviour incl. schema. It NEVER creates or alters any EXISTING decision table — those are read-only.
--
-- Honesty contract: Recommendation ≠ Decision ≠ Automation ≠ Approval; Evidence ≠ Confidence ≠
-- Accuracy; Coverage ⟂ Confidence ⟂ Evidence. present is DERIVED (substrate exists), NOT a quality
-- verdict; table_count is exact COUNT(*) (never n_live_tup) and honest-NULL when unmeasured (≠ 0);
-- owner/lifecycle_uid/intelligence_uid are MANAGED soft-links, honest-NULL when unassigned.

CREATE TABLE IF NOT EXISTS decision_registry (
  id                BIGSERIAL PRIMARY KEY,
  decision_uid      TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  decision_kind     TEXT NOT NULL,            -- orchestrated|persisted|derived|logged|audited|model|governance
  domain            TEXT,                     -- career|personalization|hiring|role_resolution|governance|executive|ai
  physical_table    TEXT,                     -- the EXISTING persisted decision trail (read-only) or NULL (compute-on-read)
  engine_path       TEXT,                     -- the EXISTING engine source file (existence read-only) or NULL
  governing_flag    TEXT,                     -- governing feature flag key or NULL (unverified gate — honest)
  present           BOOLEAN,                  -- DERIVED: substrate (table OR engine) exists — NOT a quality verdict
  table_count       INTEGER,                  -- exact COUNT(*) of the trail at discovery; honest-NULL when unmeasured (≠ 0)
  flag_state        BOOLEAN,                  -- DERIVED governing-flag state (Built ≠ Activated); NULL when no/unverified flag
  owner             TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
  lifecycle_uid     TEXT,                     -- SOFT reference into platform_lifecycle_catalog (no FK; may be null)
  intelligence_uid  TEXT,                     -- SOFT reference into platform_intelligence_registry (no FK; may be null)
  metadata          JSONB NOT NULL DEFAULT '{}',
  source            TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dr_decision_kind ON decision_registry (decision_kind);
CREATE INDEX IF NOT EXISTS idx_dr_domain        ON decision_registry (domain);

CREATE TABLE IF NOT EXISTS decision_intelligence_audit_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  snapshot_uid                TEXT UNIQUE NOT NULL,
  registry_total              INTEGER,
  capabilities_present        INTEGER,
  decisions_recorded          INTEGER,
  decision_quality_pct        NUMERIC,
  decision_confidence_pct     NUMERIC,
  decision_coverage_pct       NUMERIC,
  recommendation_quality_pct  NUMERIC,        -- honest-NULL (accuracy unmeasurable — no labelled outcomes)
  governance_compliance_pct   NUMERIC,
  explainability_pct          NUMERIC,
  metrics                     JSONB NOT NULL DEFAULT '{}',
  validation                  JSONB NOT NULL DEFAULT '{}',
  summary                     JSONB NOT NULL DEFAULT '{}',
  captured_by                 TEXT,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dias_captured_at ON decision_intelligence_audit_snapshots (captured_at DESC);
