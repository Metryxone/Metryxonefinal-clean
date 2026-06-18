-- =====================================================================
-- Competency Graph + Adaptive Blueprint Runtime (Phase 3) — additive.
-- Flags: competencyGraphRuntime / adaptiveBlueprintRuntime /
--        competencyPropagation (all default OFF).
-- All NEW tables; no existing table modified. Append-only.
-- Note: existing competency_graph_nodes/edges (Adaptive Orchestration V2)
-- are NOT touched. Phase 3 owns its own *_dependency_* namespace.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Competency dependency edges -------------------------------------
CREATE TABLE IF NOT EXISTS competency_dependency_edges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upstream_id        TEXT NOT NULL,
  downstream_id      TEXT NOT NULL,
  relationship       TEXT NOT NULL,           -- 'parent' | 'child' | 'adjacent' | 'dependent' | 'enabling' | 'blocking'
  weight             NUMERIC(5,3) NOT NULL DEFAULT 1.000,
  propagation_factor NUMERIC(5,3) NOT NULL DEFAULT 0.500,
  rationale          TEXT,
  source             TEXT,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cde_up   ON competency_dependency_edges(upstream_id);
CREATE INDEX IF NOT EXISTS idx_cde_down ON competency_dependency_edges(downstream_id);
CREATE INDEX IF NOT EXISTS idx_cde_rel  ON competency_dependency_edges(relationship);

-- 2) Propagation logs (append-only audit) ----------------------------
CREATE TABLE IF NOT EXISTS competency_propagation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,
  source_id       TEXT NOT NULL,
  affected_id     TEXT NOT NULL,
  delta_confidence NUMERIC(6,3),
  delta_evidence   INTEGER,
  hops            INTEGER,
  correlation_id  UUID,
  shadow_mode     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpl_user_time ON competency_propagation_logs(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpl_corr      ON competency_propagation_logs(correlation_id);

-- 3) Confidence decay state ------------------------------------------
CREATE TABLE IF NOT EXISTS competency_confidence_decay (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  base_confidence NUMERIC(5,3),
  decayed_confidence NUMERIC(5,3),
  half_life_days  INTEGER,
  last_evidence_at TIMESTAMPTZ,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccd_user_time ON competency_confidence_decay(user_id, computed_at DESC);

-- 4) Adaptive blueprint sessions -------------------------------------
CREATE TABLE IF NOT EXISTS adaptive_blueprint_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  blueprint_version TEXT NOT NULL DEFAULT '1.0.0',
  role_id         TEXT,
  inputs          JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs         JSONB NOT NULL DEFAULT '{}'::jsonb,
  shadow_mode     BOOLEAN NOT NULL DEFAULT TRUE,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abs_user_time ON adaptive_blueprint_sessions(user_id, generated_at DESC);

-- 5) Adaptive blueprint targets --------------------------------------
CREATE TABLE IF NOT EXISTS adaptive_blueprint_targets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_session_id UUID NOT NULL,
  competency_id     TEXT NOT NULL,
  target_kind       TEXT NOT NULL,            -- 'target' | 'confidence_gap' | 'contradiction_probe' | 'cognitive' | 'evidence'
  priority          TEXT,                     -- 'critical' | 'high' | 'medium' | 'low'
  score             NUMERIC(6,3),
  rationale         TEXT,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abt_session ON adaptive_blueprint_targets(blueprint_session_id);
CREATE INDEX IF NOT EXISTS idx_abt_comp    ON adaptive_blueprint_targets(competency_id);

-- 6) Adaptive blueprint rules (branching + adaptive depth) -----------
CREATE TABLE IF NOT EXISTS adaptive_blueprint_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_session_id UUID NOT NULL,
  rule_kind         TEXT NOT NULL,            -- 'branching' | 'adaptive_depth'
  rule              JSONB NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abr_session ON adaptive_blueprint_rules(blueprint_session_id);

-- 7) Graph execution logs (append-only audit) ------------------------
CREATE TABLE IF NOT EXISTS competency_graph_execution_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,
  operation       TEXT NOT NULL,             -- 'traverse' | 'propagate' | 'blueprint' | 'graph_load'
  status          TEXT NOT NULL,             -- 'success' | 'partial' | 'failed'
  hops            INTEGER,
  nodes_visited   INTEGER,
  duration_ms     INTEGER,
  correlation_id  UUID,
  shadow_mode     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cgel_user_time ON competency_graph_execution_logs(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cgel_corr      ON competency_graph_execution_logs(correlation_id);
