-- =====================================================================
-- Adaptive Orchestration V2 — additive intelligence orchestration layer
-- Flag: adaptiveOrchestrationV2 (default ON; FF_ADAPTIVE_ORCHESTRATION_V2=false)
-- Namespace: adaptive_*, intelligence_*, competency_graph_*, orchestration_*
-- All NEW tables; no existing table touched.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Event log -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS adaptive_intelligence_events (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT         NOT NULL,
  user_id       BIGINT,
  tenant_id     INTEGER,
  payload       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID,
  occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aie_user_time ON adaptive_intelligence_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_aie_type_time ON adaptive_intelligence_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_aie_corr ON adaptive_intelligence_events(correlation_id);

-- 2) Orchestration logs --------------------------------------------------
CREATE TABLE IF NOT EXISTS intelligence_orchestration_logs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  operation     TEXT         NOT NULL,
  user_id       BIGINT,
  correlation_id UUID,
  status        TEXT         NOT NULL,          -- 'started' | 'success' | 'partial' | 'failed'
  duration_ms   INTEGER,
  inputs        JSONB        DEFAULT '{}'::jsonb,
  outputs       JSONB        DEFAULT '{}'::jsonb,
  started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_iol_op_time ON intelligence_orchestration_logs(operation, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_iol_user ON intelligence_orchestration_logs(user_id, started_at DESC);

-- 3) Unified intelligence profile (latest) -------------------------------
CREATE TABLE IF NOT EXISTS competency_intelligence_profiles (
  user_id       BIGINT       PRIMARY KEY,
  profile       JSONB        NOT NULL,
  lineage       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  version       INTEGER      NOT NULL DEFAULT 1,
  computed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4) Dependency graph between intelligence modules -----------------------
CREATE TABLE IF NOT EXISTS intelligence_dependency_graph (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module TEXT         NOT NULL,
  target_module TEXT         NOT NULL,
  dependency_kind TEXT       NOT NULL,           -- 'consumes' | 'invalidates' | 'enriches'
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  UNIQUE(source_module, target_module, dependency_kind)
);

-- 5) Append-only snapshots of profile state ------------------------------
CREATE TABLE IF NOT EXISTS intelligence_snapshots_v2 (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT       NOT NULL,
  snapshot      JSONB        NOT NULL,
  trigger_event TEXT,
  snapshot_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_isv2_user_time ON intelligence_snapshots_v2(user_id, snapshot_at DESC);

-- 6) Execution history (per orchestration step) --------------------------
CREATE TABLE IF NOT EXISTS intelligence_execution_history (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id  UUID         NOT NULL,
  step_name       TEXT         NOT NULL,
  status          TEXT         NOT NULL,        -- 'ok' | 'skipped' | 'failed'
  duration_ms     INTEGER,
  error_message   TEXT,
  output_summary  JSONB        DEFAULT '{}'::jsonb,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ieh_corr ON intelligence_execution_history(correlation_id, recorded_at);

-- 7) Competency graph — nodes -------------------------------------------
CREATE TABLE IF NOT EXISTS competency_graph_nodes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  node_kind     TEXT         NOT NULL,         -- 'competency' | 'role' | 'pathway' | 'readiness' | 'capability'
  node_key      TEXT         NOT NULL,
  label         TEXT,
  attrs         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(node_kind, node_key)
);

-- 8) Competency graph — edges -------------------------------------------
CREATE TABLE IF NOT EXISTS competency_graph_edges (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node     UUID         NOT NULL REFERENCES competency_graph_nodes(id) ON DELETE CASCADE,
  to_node       UUID         NOT NULL REFERENCES competency_graph_nodes(id) ON DELETE CASCADE,
  edge_kind     TEXT         NOT NULL,         -- 'requires' | 'enables' | 'adjacent' | 'develops_into' | 'gap_for'
  weight        NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  attrs         JSONB        DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(from_node, to_node, edge_kind)
);
CREATE INDEX IF NOT EXISTS idx_cge_from ON competency_graph_edges(from_node, edge_kind);
CREATE INDEX IF NOT EXISTS idx_cge_to ON competency_graph_edges(to_node, edge_kind);

-- 9) Failure log (for partial / failed orchestration) -------------------
CREATE TABLE IF NOT EXISTS orchestration_failures (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id  UUID,
  user_id         BIGINT,
  step_name       TEXT         NOT NULL,
  error_message   TEXT         NOT NULL,
  stack_trace     TEXT,
  context         JSONB        DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_of_time ON orchestration_failures(occurred_at DESC);

-- 10) Per-user runtime state cache --------------------------------------
CREATE TABLE IF NOT EXISTS adaptive_runtime_state (
  user_id       BIGINT       PRIMARY KEY,
  runtime_state JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed: dependency graph (how modules consume/invalidate each other)
INSERT INTO intelligence_dependency_graph (source_module, target_module, dependency_kind) VALUES
  ('assessment',   'competency_dna',  'invalidates'),
  ('competency_dna','benchmark',      'invalidates'),
  ('competency_dna','mobility',       'invalidates'),
  ('benchmark',    'coaching',        'enriches'),
  ('mobility',     'trajectory',      'enriches'),
  ('competency_dna','workforce',      'enriches'),
  ('competency_dna','simulation',     'enriches'),
  ('competency_dna','intelligence_profile', 'consumes'),
  ('benchmark',    'intelligence_profile', 'consumes'),
  ('mobility',     'intelligence_profile', 'consumes')
ON CONFLICT (source_module, target_module, dependency_kind) DO NOTHING;
