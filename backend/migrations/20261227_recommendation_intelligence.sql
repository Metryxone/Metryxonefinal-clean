-- MX-800 Phase 2.8 — Recommendation Intelligence Engine
-- Canonical migration for the TWO tables this read-only intelligence tier OWNS. It mirrors the lazy
-- ensureRecommendationSchema() in backend/services/recommendation-intelligence-engine.ts (no migration
-- runner — the lazy ensure-schema is the live path). The tier is flag-gated by
-- `recommendationIntelligenceEngine` (default OFF): with the flag OFF no write path runs and these tables
-- are NEVER created → byte-identical legacy behaviour incl. schema. It NEVER creates or alters any
-- EXISTING recommendation / opportunity / intervention / optimization table — those are read-only
-- (COUNT-only). It NEVER invokes a recommendation engine, never generates a recommendation, never
-- decides, never executes and never automates.
--
-- Honesty contract: Recommendation ≠ Decision; Recommendation ≠ Automation; Recommendation ≠ Execution;
-- Priority ≠ Approval; Opportunity ≠ Requirement; Confidence ≠ Accuracy; Evidence ≠ Confidence; Coverage
-- ⟂ Confidence ⟂ Evidence. present is DERIVED (substrate exists), NOT a quality verdict; table_count is
-- exact COUNT(*) (never n_live_tup) and honest-NULL when unmeasured (≠ 0); owner/lifecycle_uid/
-- intelligence_uid are MANAGED soft-links, honest-NULL when unassigned; recommendation_confidence is
-- STRUCTURAL only; acceptance_rate + effectiveness are unmeasurable → honest-NULL.

CREATE TABLE IF NOT EXISTS recommendation_registry (
  id                  BIGSERIAL PRIMARY KEY,
  recommendation_uid  TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  recommendation_kind TEXT NOT NULL,            -- recommendation|opportunity|intervention|optimization|prioritization|prescription|action
  domain              TEXT,                     -- behaviour|career|runtime|future_readiness|employability|organizational|risk|...
  physical_table      TEXT,                     -- the EXISTING persisted recommendation trail (read-only) or NULL (compute-on-read)
  engine_path         TEXT,                     -- the EXISTING engine source file (existence read-only) or NULL
  governing_flag      TEXT,                     -- governing feature flag key or NULL (unverified gate — honest)
  present             BOOLEAN,                  -- DERIVED: substrate (table OR engine) exists — NOT a quality verdict
  table_count         INTEGER,                  -- exact COUNT(*) of the trail at discovery; honest-NULL when unmeasured (≠ 0)
  flag_state          BOOLEAN,                  -- DERIVED governing-flag state (Built ≠ Activated); NULL when no/unverified flag
  owner               TEXT,                     -- MANAGED, honest-NULL when unassigned (never fabricated)
  lifecycle_uid       TEXT,                     -- SOFT reference into platform_lifecycle_catalog (no FK; may be null)
  intelligence_uid    TEXT,                     -- SOFT reference into platform_intelligence_registry (no FK; may be null)
  metadata            JSONB NOT NULL DEFAULT '{}',
  source              TEXT NOT NULL DEFAULT 'discovered',  -- discovered|manual
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_recommendation_kind ON recommendation_registry (recommendation_kind);
CREATE INDEX IF NOT EXISTS idx_rr_domain              ON recommendation_registry (domain);

CREATE TABLE IF NOT EXISTS recommendation_intelligence_audit_snapshots (
  id                            BIGSERIAL PRIMARY KEY,
  snapshot_uid                  TEXT UNIQUE NOT NULL,
  registry_total                INTEGER,
  capabilities_present          INTEGER,
  recommendations_recorded      INTEGER,
  recommendation_quality_pct    NUMERIC,
  recommendation_confidence_pct NUMERIC,        -- STRUCTURAL only (substrate verifiability), NOT outcome accuracy
  acceptance_rate_pct           NUMERIC,        -- honest-NULL (adoption unmeasurable — no acceptance telemetry)
  recommendation_coverage_pct   NUMERIC,
  explainability_pct            NUMERIC,
  effectiveness_pct             NUMERIC,         -- honest-NULL (outcome unmeasurable — no labelled outcomes)
  metrics                       JSONB NOT NULL DEFAULT '{}',
  validation                    JSONB NOT NULL DEFAULT '{}',
  summary                       JSONB NOT NULL DEFAULT '{}',
  captured_by                   TEXT,
  captured_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rias_captured_at ON recommendation_intelligence_audit_snapshots (captured_at DESC);
