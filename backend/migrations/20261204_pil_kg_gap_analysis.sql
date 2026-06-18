-- CAPADEX PIL Phase 8D — Gap Detection Engine
-- Canonical definition of pil_kg_gap_analysis. Mirrors the lazy ensureGapSchema()
-- bootstrap in backend/services/pil/gap-detection-engine.ts (no migration runner).
-- Derived, read-only-of-structure: rows are recomputed snapshots of graph gaps over
-- the canonical pil_kg_nodes / pil_kg_edges graph. Additive — never mutates the graph.

CREATE TABLE IF NOT EXISTS pil_kg_gap_analysis (
  id          BIGSERIAL PRIMARY KEY,
  run_id      TEXT NOT NULL,
  gap_type    TEXT NOT NULL,            -- orphan_node | weakly_connected | unused_construct | missing_relationship | dead_end
  node_id     TEXT NOT NULL,
  node_type   TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL DEFAULT 'low',  -- high | medium | low
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_run     ON pil_kg_gap_analysis (run_id);
CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_type    ON pil_kg_gap_analysis (gap_type);
CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_node    ON pil_kg_gap_analysis (node_id);
CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_sev     ON pil_kg_gap_analysis (severity);
