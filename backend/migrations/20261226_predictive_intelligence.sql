-- MX-800 Phase 2.7 — Predictive Intelligence Engine
-- Canonical migration for the TWO tables this read-only intelligence tier OWNS. It mirrors the lazy
-- ensurePredictiveSchema() in backend/services/predictive-intelligence-engine.ts (no migration runner — the lazy
-- ensure-schema is the live path). The tier is flag-gated by `predictiveIntelligenceEngine` (default OFF):
-- with the flag OFF no write path runs and these tables are NEVER created → byte-identical legacy
-- behaviour incl. schema. It NEVER creates or alters any EXISTING prediction/forecast/trend/risk table —
-- those are read-only (COUNT-only). Simulation is SIMULATION ONLY — production is never modified.
--
-- Honesty contract: Prediction ≠ Decision; Forecast ≠ Fact; Probability ≠ Certainty; Simulation ≠
-- Reality; Trend ≠ Future; Confidence ≠ Accuracy; Evidence ≠ Confidence; Coverage ⟂ Confidence ⟂
-- Evidence. present is DERIVED (substrate exists), NOT a quality verdict; table_count is exact COUNT(*)
-- (never n_live_tup) and honest-NULL when unmeasured (≠ 0); owner/lifecycle_uid/intelligence_uid are
-- MANAGED soft-links, honest-NULL when unassigned; forecast accuracy is unmeasurable → honest-NULL.

CREATE TABLE IF NOT EXISTS prediction_registry (
  id                BIGSERIAL PRIMARY KEY,
  prediction_uid    TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  prediction_kind   TEXT NOT NULL,            -- forecast|trend|risk|simulation|scenario|readiness|projection
  domain            TEXT,                     -- competency|behaviour|workforce|organizational|future_readiness|platform|risk|simulation
  physical_table    TEXT,                     -- the EXISTING persisted prediction trail (read-only) or NULL (compute-on-read)
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
CREATE INDEX IF NOT EXISTS idx_pr_prediction_kind ON prediction_registry (prediction_kind);
CREATE INDEX IF NOT EXISTS idx_pr_domain          ON prediction_registry (domain);

CREATE TABLE IF NOT EXISTS predictive_intelligence_audit_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  snapshot_uid                TEXT UNIQUE NOT NULL,
  registry_total              INTEGER,
  capabilities_present        INTEGER,
  predictions_recorded        INTEGER,
  forecast_confidence_pct     NUMERIC,        -- STRUCTURAL only (substrate verifiability), NOT outcome accuracy
  prediction_quality_pct      NUMERIC,
  trend_accuracy_pct          NUMERIC,        -- honest-NULL (accuracy unmeasurable — no labelled outcomes)
  risk_prediction_coverage_pct NUMERIC,
  explainability_pct          NUMERIC,
  metrics                     JSONB NOT NULL DEFAULT '{}',
  validation                  JSONB NOT NULL DEFAULT '{}',
  summary                     JSONB NOT NULL DEFAULT '{}',
  captured_by                 TEXT,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pias_captured_at ON predictive_intelligence_audit_snapshots (captured_at DESC);
