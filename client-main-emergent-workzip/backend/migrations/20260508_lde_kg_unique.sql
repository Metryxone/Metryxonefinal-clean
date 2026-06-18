-- Enrich lde_knowledge_graph_nodes with properties column if missing
ALTER TABLE lde_knowledge_graph_nodes ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}';

-- Deduplicate nodes: keep the row with the latest created_at for each node_key.
-- When created_at ties (same timestamp), keep the row with the greater id to be deterministic.
-- This is safe to run multiple times (idempotent DELETE).
DELETE FROM lde_knowledge_graph_nodes a
USING lde_knowledge_graph_nodes b
WHERE a.node_key = b.node_key
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.id < b.id)
  );

-- After deduplication, add UNIQUE index on node_key (global canonical nodes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lde_kg_nodes_key_unique ON lde_knowledge_graph_nodes(node_key);

-- Deduplicate edges: keep latest per (source_id, target_id, relationship)
DELETE FROM lde_knowledge_graph_edges a
USING lde_knowledge_graph_edges b
WHERE a.source_id = b.source_id
  AND a.target_id = b.target_id
  AND a.relationship = b.relationship
  AND a.id < b.id;

-- Drop any prior version of the edge unique index (which may have used a COALESCE expression)
-- then recreate with just the 3 columns that the ON CONFLICT clause references.
DROP INDEX IF EXISTS idx_lde_kg_edges_unique;
CREATE UNIQUE INDEX idx_lde_kg_edges_unique
  ON lde_knowledge_graph_edges(source_id, target_id, relationship);
