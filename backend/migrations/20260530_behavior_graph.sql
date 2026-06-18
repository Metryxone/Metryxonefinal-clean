-- CAPADEX Unified Behavior Graph (canonical migration).
-- One graph per session: a single stitched view of every existing intelligence
-- system's per-session output (signals → patterns → risks → interventions →
-- growth indicators → CSI contribution). NO new ontology / signals are created
-- here — this table only persists the aggregated graph produced by
-- backend/services/behavior-graph-service.ts (which mirrors this DDL via a lazy
-- ensureBehaviorGraphSchema() bootstrap — no migration runner in this project).

CREATE TABLE IF NOT EXISTS capadex_behavior_graph (
  session_id          UUID PRIMARY KEY,
  concern             TEXT,
  signal_count        INTEGER NOT NULL DEFAULT 0,
  pattern_count       INTEGER NOT NULL DEFAULT 0,
  risk_count          INTEGER NOT NULL DEFAULT 0,
  intervention_count  INTEGER NOT NULL DEFAULT 0,
  growth_count        INTEGER NOT NULL DEFAULT 0,
  csi_factor_count    INTEGER NOT NULL DEFAULT 0,
  confidence          NUMERIC(6,4) NOT NULL DEFAULT 0,
  contributors        JSONB NOT NULL DEFAULT '[]',
  graph               JSONB NOT NULL DEFAULT '{}',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbg_generated ON capadex_behavior_graph (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbg_concern   ON capadex_behavior_graph (concern);
