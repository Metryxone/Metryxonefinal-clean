-- ============================================================================
-- Enterprise Adaptive Intelligence — Phase 3 gap-fill migration (additive)
-- ============================================================================
-- 7 of 10 spec tables already exist:
--   ai_inferred_competencies        — 20260720_ai_inference_v2.sql
--   explainability_chains           — 20260730_governance_science_v2.sql
--   workforce_observability_logs    — 20260805_enterprise_workforce_os.sql
--   predictive_readiness_models     ≈ readiness_predictions (20260725)
--   workforce_simulation_runs       ≈ simulation_forecast_history (20260725)
--                                   + wos_v2_scenarios (20260715)
--   governance_audit_logs           ≈ ai_decision_audits (20260730)
--   fairness_audits_v2              ≈ fairness_evaluations (20260730)
--                                   + wos_v2_fairness_drift (20260715)
--                                   + wos_fairness_results (20260529)
--
-- This migration adds the THREE tables with no existing equivalent:
--   1. workforce_capability_graphs       — org-level competency graph snapshots
--   2. organizational_readiness_profiles — org/tenant-aggregate readiness rollups
--   3. intelligence_refresh_state        — orchestrator cascade refresh tracker
--
-- All idempotent and append-only (intelligence_refresh_state uses upserts).
-- ============================================================================

-- 1) Workforce capability graph — point-in-time snapshot of the org's competency
--    graph (nodes = competencies, edges = co-occurrence / dependency / uplift).
--    One snapshot per (tenant_id, snapshot_key); allows time-series comparison.
CREATE TABLE IF NOT EXISTS workforce_capability_graphs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NULL,
  snapshot_key        TEXT NOT NULL,          -- e.g. '2026-09-05_weekly'
  scope               TEXT NOT NULL DEFAULT 'tenant',  -- 'tenant' | 'department' | 'role'
  scope_id            TEXT NULL,
  -- graph payload: { nodes: [{code, level_avg, coverage, importance}], edges: [{from, to, weight, type}] }
  graph_payload       JSONB NOT NULL,
  node_count          INTEGER NULL,
  edge_count          INTEGER NULL,
  source_user_count   INTEGER NULL,
  methodology_version TEXT NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, snapshot_key, scope, scope_id)
);

-- NULL-safe uniqueness: the column-list UNIQUE above lets duplicate logical
-- rows slip through when tenant_id or scope_id is NULL (Postgres treats NULLs
-- as distinct). This expression index uses sentinels so tenant-wide /
-- scope-wide snapshots are still uniquely keyed by (snapshot_key, scope).
CREATE UNIQUE INDEX IF NOT EXISTS uq_wcg_null_safe
  ON workforce_capability_graphs (
    COALESCE(tenant_id, '__global__'),
    snapshot_key,
    scope,
    COALESCE(scope_id, '__all__')
  );

CREATE INDEX IF NOT EXISTS idx_wcg_tenant_generated
  ON workforce_capability_graphs (tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wcg_scope
  ON workforce_capability_graphs (scope, scope_id);


-- 2) Organizational readiness profile — aggregate of individual readiness rolled
--    up to a scope (tenant / department / role). One row per (scope, scope_id,
--    competency_code) per as_of_date; backs heatmaps and executive briefs.
CREATE TABLE IF NOT EXISTS organizational_readiness_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   TEXT NULL,
  scope                       TEXT NOT NULL,           -- 'tenant' | 'department' | 'role' | 'team'
  scope_id                    TEXT NULL,
  competency_code             TEXT NULL,               -- NULL = overall org readiness
  as_of_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  population_size             INTEGER NOT NULL DEFAULT 0,
  ready_count                 INTEGER NOT NULL DEFAULT 0,
  near_ready_count            INTEGER NOT NULL DEFAULT 0,
  gap_count                   INTEGER NOT NULL DEFAULT 0,
  readiness_index             NUMERIC(5,2) NULL,       -- 0..100
  capability_uplift_30d       NUMERIC(5,2) NULL,
  succession_coverage         NUMERIC(5,2) NULL,
  resilience_score            NUMERIC(5,2) NULL,
  burnout_risk_index          NUMERIC(5,2) NULL,
  source_data_points          JSONB NULL,              -- lineage: which tables/rows contributed
  methodology_version         TEXT NULL,
  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, scope, scope_id, competency_code, as_of_date)
);

-- NULL-safe uniqueness for tenant-wide / scope-wide / "overall" (competency
-- NULL) readiness rows. Without sentinels, multiple "overall org readiness"
-- rows for the same date could coexist.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orp_null_safe
  ON organizational_readiness_profiles (
    COALESCE(tenant_id, '__global__'),
    scope,
    COALESCE(scope_id, '__all__'),
    COALESCE(competency_code, '__overall__'),
    as_of_date
  );

CREATE INDEX IF NOT EXISTS idx_orp_tenant_date
  ON organizational_readiness_profiles (tenant_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_orp_scope
  ON organizational_readiness_profiles (scope, scope_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_orp_competency
  ON organizational_readiness_profiles (competency_code, as_of_date DESC);


-- 3) Intelligence refresh state — per-(scope, target) tracker of when downstream
--    intelligence systems were last refreshed by orchestrator cascades. Supports
--    "is this stale?" checks and gates re-emission when cascades thrash.
CREATE TABLE IF NOT EXISTS intelligence_refresh_state (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                    TEXT NOT NULL,         -- 'user' | 'tenant' | 'role_dna' | 'session'
  scope_id                 TEXT NOT NULL,
  intelligence_target      TEXT NOT NULL,         -- 'benchmark' | 'mobility' | 'coaching' | 'trajectory' | 'workforce' | 'simulation' | 'governance'
  last_event_type          TEXT NULL,
  last_event_id            TEXT NULL,
  last_refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_refresh_due_at      TIMESTAMPTZ NULL,
  refresh_count            INTEGER NOT NULL DEFAULT 1,
  last_latency_ms          INTEGER NULL,
  last_status              TEXT NULL,             -- 'ok' | 'degraded' | 'failed'
  last_error               TEXT NULL,
  methodology_versions     JSONB NULL,
  UNIQUE (scope, scope_id, intelligence_target)
);

CREATE INDEX IF NOT EXISTS idx_irs_target_refreshed
  ON intelligence_refresh_state (intelligence_target, last_refreshed_at DESC);
CREATE INDEX IF NOT EXISTS idx_irs_due
  ON intelligence_refresh_state (next_refresh_due_at)
  WHERE next_refresh_due_at IS NOT NULL;
