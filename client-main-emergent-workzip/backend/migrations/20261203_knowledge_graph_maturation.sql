-- CAPADEX PIL — Phase 8A: Graph Maturation (NOT replacement).
--
-- Descriptive / derived layers that sit ON TOP of the canonical Phase-8 graph
-- (pil_kg_nodes / pil_kg_edges). These tables NEVER store graph nodes or edges — they
-- catalog, measure, relate and audit the ONE existing graph. No duplication,
-- no second source of truth. Canonical schema; mirrored exactly by lazy
-- ensureGraphMaturationSchema(). Idempotent.

-- 1) Node type catalog — 14 product categories grouping the real pil_kg_nodes.node_type values.
CREATE TABLE IF NOT EXISTS pil_kg_node_types (
  category_key      TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  description       TEXT,
  member_node_types TEXT[] NOT NULL DEFAULT '{}',   -- granular pil_kg_nodes.node_type values
  source_tables     TEXT[] NOT NULL DEFAULT '{}',
  display_order     INT NOT NULL DEFAULT 0,
  node_count        INT NOT NULL DEFAULT 0,          -- live count, refreshed from pil_kg_nodes
  counts_refreshed_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Relationship type catalog — 11 semantic verbs grouping the real pil_kg_edges.relation values.
CREATE TABLE IF NOT EXISTS pil_kg_relationship_types (
  relationship_type TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  description       TEXT,
  directed          BOOLEAN NOT NULL DEFAULT true,
  member_relations  TEXT[] NOT NULL DEFAULT '{}',    -- granular pil_kg_edges.relation values
  display_order     INT NOT NULL DEFAULT 0,
  edge_count        INT NOT NULL DEFAULT 0,          -- live count, refreshed from pil_kg_edges
  counts_refreshed_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Graph metadata — key/value graph-level facts computed from the canonical graph.
CREATE TABLE IF NOT EXISTS pil_kg_metadata (
  meta_key   TEXT PRIMARY KEY,
  meta_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Node similarity index — precomputed node↔node similarity over pil_kg_edges adjacency.
--    Both endpoints reference pil_kg_nodes.node_id (the canonical graph). No node storage.
CREATE TABLE IF NOT EXISTS pil_kg_similarity_index (
  source_id    TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  method       TEXT NOT NULL,                        -- e.g. 'jaccard_neighbors'
  score        NUMERIC(7,6) NOT NULL,
  shared_count INT NOT NULL DEFAULT 0,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id, method)
);

-- 5) Graph audit — append-only log of maturation operations against the graph.
CREATE TABLE IF NOT EXISTS pil_kg_audit (
  id              BIGSERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL,                     -- seed_catalogs | refresh_counts | refresh_metadata | compute_similarity | materialize
  status          TEXT NOT NULL DEFAULT 'ok',        -- ok | degraded | error
  node_count      INT,
  edge_count      INT,
  affected_rows   INT,
  duration_ms     INT,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pil_kg_similarity_index_source ON pil_kg_similarity_index (source_id);
CREATE INDEX IF NOT EXISTS idx_pil_kg_similarity_index_score  ON pil_kg_similarity_index (score DESC);
CREATE INDEX IF NOT EXISTS idx_pil_kg_audit_event      ON pil_kg_audit (event_type, created_at DESC);
