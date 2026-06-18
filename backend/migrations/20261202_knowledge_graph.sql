-- CAPADEX PIL — Phase 8: Knowledge Graph Intelligence Layer.
--
-- A materialised snapshot of the unified intelligence graph: typed nodes + edges
-- that ONLY ever come from a real linkage row (each edge carries provenance).
-- Canonical schema; mirrored exactly by lazy ensureKnowledgeGraphSchema() so the
-- engine bootstraps even where no migration runner is wired. Idempotent.

CREATE TABLE IF NOT EXISTS pil_kg_nodes (
  node_id    TEXT PRIMARY KEY,
  node_type  TEXT NOT NULL,
  node_key   TEXT NOT NULL,
  label      TEXT,
  attrs      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pil_kg_edges (
  edge_id    TEXT PRIMARY KEY,
  source_id  TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  relation   TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pil_kg_nodes_type   ON pil_kg_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_pil_kg_edges_source ON pil_kg_edges (source_id);
CREATE INDEX IF NOT EXISTS idx_pil_kg_edges_target ON pil_kg_edges (target_id);
CREATE INDEX IF NOT EXISTS idx_pil_kg_edges_rel    ON pil_kg_edges (relation);
