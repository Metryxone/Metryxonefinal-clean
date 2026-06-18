/**
 * CAPADEX PIL — Phase 8A: Graph Maturation service.
 *
 * MATURATION, NOT REPLACEMENT. Every function here READS FROM or DESCRIBES the
 * canonical Phase-8 graph (pil_kg_nodes / pil_kg_edges). It never creates a parallel
 * node/edge store. The only writes are into the five descriptive maturation
 * tables (catalogs, metadata, similarity, audit).
 *
 * CANON (strict):
 *   - Catalogs are seeded deterministically from the pure taxonomy
 *     (knowledge-graph-maturation-schema); live counts are GROUP-BYs over kg_*.
 *   - Similarity is computed FROM pil_kg_edges adjacency (no fabricated links) and is
 *     bounded (per-anchor top-K within a node-type / id list) — never O(n²) full.
 *   - Every operation appends one pil_kg_audit row.
 *   - NEVER throws past a public boundary; missing/empty kg_* degrades to zeros.
 */
import type { Pool } from 'pg';
import { ensureKnowledgeGraphSchema } from './knowledge-graph-builder';
import {
  NODE_CATEGORIES,
  RELATIONSHIP_TYPES,
  categorySourceTables,
  buildCoverageReport,
} from './knowledge-graph-maturation-schema';

// ── Lazy schema (mirrors migration 20261203) ─────────────────────────────────
let schemaReady = false;
export async function ensureGraphMaturationSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  // The maturation layer describes the canonical graph, so make sure it exists.
  await ensureKnowledgeGraphSchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pil_kg_node_types (
      category_key      TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      description       TEXT,
      member_node_types TEXT[] NOT NULL DEFAULT '{}',
      source_tables     TEXT[] NOT NULL DEFAULT '{}',
      display_order     INT NOT NULL DEFAULT 0,
      node_count        INT NOT NULL DEFAULT 0,
      counts_refreshed_at TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pil_kg_relationship_types (
      relationship_type TEXT PRIMARY KEY,
      label             TEXT NOT NULL,
      description       TEXT,
      directed          BOOLEAN NOT NULL DEFAULT true,
      member_relations  TEXT[] NOT NULL DEFAULT '{}',
      display_order     INT NOT NULL DEFAULT 0,
      edge_count        INT NOT NULL DEFAULT 0,
      counts_refreshed_at TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pil_kg_metadata (
      meta_key   TEXT PRIMARY KEY,
      meta_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pil_kg_similarity_index (
      source_id    TEXT NOT NULL,
      target_id    TEXT NOT NULL,
      method       TEXT NOT NULL,
      score        NUMERIC(7,6) NOT NULL,
      shared_count INT NOT NULL DEFAULT 0,
      computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (source_id, target_id, method)
    );
    CREATE TABLE IF NOT EXISTS pil_kg_audit (
      id            BIGSERIAL PRIMARY KEY,
      event_type    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'ok',
      node_count    INT,
      edge_count    INT,
      affected_rows INT,
      duration_ms   INT,
      details       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pil_kg_similarity_index_source ON pil_kg_similarity_index (source_id);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_similarity_index_score  ON pil_kg_similarity_index (score DESC);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_audit_event      ON pil_kg_audit (event_type, created_at DESC);
  `);
  schemaReady = true;
}

// ── Audit (append-only) ──────────────────────────────────────────────────────
export interface GraphAuditEvent {
  event_type: 'seed_catalogs' | 'refresh_counts' | 'refresh_metadata' | 'compute_similarity' | 'materialize' | 'gap_analysis' | 'integrity_audit' | 'explainability_audit' | 'readiness_audit';
  status?: 'ok' | 'degraded' | 'error';
  node_count?: number | null;
  edge_count?: number | null;
  affected_rows?: number | null;
  duration_ms?: number | null;
  details?: Record<string, unknown>;
}

/** Append one audit row. Best-effort: never throws, returns the new id or null. */
export async function recordGraphAudit(pool: Pool, ev: GraphAuditEvent): Promise<number | null> {
  try {
    await ensureGraphMaturationSchema(pool);
    const { rows } = await pool.query(
      `INSERT INTO pil_kg_audit (event_type, status, node_count, edge_count, affected_rows, duration_ms, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [
        ev.event_type,
        ev.status ?? 'ok',
        ev.node_count ?? null,
        ev.edge_count ?? null,
        ev.affected_rows ?? null,
        ev.duration_ms ?? null,
        JSON.stringify(ev.details ?? {}),
      ],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ── Catalog seeding (deterministic, idempotent upsert) ───────────────────────
export async function seedCatalogs(pool: Pool): Promise<{ node_categories: number; relationship_types: number }> {
  const started = Date.now();
  await ensureGraphMaturationSchema(pool);

  for (const cat of NODE_CATEGORIES) {
    await pool.query(
      `INSERT INTO pil_kg_node_types
         (category_key, label, description, member_node_types, source_tables, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (category_key) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         member_node_types = EXCLUDED.member_node_types,
         source_tables = EXCLUDED.source_tables,
         display_order = EXCLUDED.display_order,
         updated_at = now()`,
      [cat.key, cat.label, cat.description, cat.member_node_types, categorySourceTables(cat), cat.display_order],
    );
  }

  for (const rt of RELATIONSHIP_TYPES) {
    await pool.query(
      `INSERT INTO pil_kg_relationship_types
         (relationship_type, label, description, directed, member_relations, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (relationship_type) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         directed = EXCLUDED.directed,
         member_relations = EXCLUDED.member_relations,
         display_order = EXCLUDED.display_order,
         updated_at = now()`,
      [rt.key, rt.label, rt.description, rt.directed, rt.member_relations, rt.display_order],
    );
  }

  await recordGraphAudit(pool, {
    event_type: 'seed_catalogs',
    affected_rows: NODE_CATEGORIES.length + RELATIONSHIP_TYPES.length,
    duration_ms: Date.now() - started,
    details: { node_categories: NODE_CATEGORIES.length, relationship_types: RELATIONSHIP_TYPES.length },
  });
  return { node_categories: NODE_CATEGORIES.length, relationship_types: RELATIONSHIP_TYPES.length };
}

// ── Live counts (GROUP BY over the canonical graph) ──────────────────────────
async function groupCounts(pool: Pool, sql: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const { rows } = await pool.query(sql);
    for (const r of rows) out.set(String(r.k), Number(r.n));
  } catch {
    /* kg_* absent/empty → no counts */
  }
  return out;
}

export async function refreshCatalogCounts(pool: Pool): Promise<{ node_total: number; edge_total: number }> {
  const started = Date.now();
  await ensureGraphMaturationSchema(pool);

  const nodeByType = await groupCounts(pool, `SELECT node_type AS k, count(*) AS n FROM pil_kg_nodes GROUP BY node_type`);
  const edgeByRel = await groupCounts(pool, `SELECT relation AS k, count(*) AS n FROM pil_kg_edges GROUP BY relation`);

  let nodeTotal = 0;
  for (const cat of NODE_CATEGORIES) {
    const count = cat.member_node_types.reduce((s, t) => s + (nodeByType.get(t) ?? 0), 0);
    nodeTotal += count;
    await pool.query(
      `UPDATE pil_kg_node_types SET node_count = $2, counts_refreshed_at = now(), updated_at = now() WHERE category_key = $1`,
      [cat.key, count],
    );
  }

  let edgeTotal = 0;
  for (const rt of RELATIONSHIP_TYPES) {
    const count = rt.member_relations.reduce((s, r) => s + (edgeByRel.get(r) ?? 0), 0);
    edgeTotal += count;
    await pool.query(
      `UPDATE pil_kg_relationship_types SET edge_count = $2, counts_refreshed_at = now(), updated_at = now() WHERE relationship_type = $1`,
      [rt.key, count],
    );
  }

  await recordGraphAudit(pool, {
    event_type: 'refresh_counts',
    node_count: nodeTotal,
    edge_count: edgeTotal,
    affected_rows: NODE_CATEGORIES.length + RELATIONSHIP_TYPES.length,
    duration_ms: Date.now() - started,
  });
  return { node_total: nodeTotal, edge_total: edgeTotal };
}

// ── Graph metadata (key/value facts computed from the canonical graph) ───────
async function scalar(pool: Pool, sql: string): Promise<number> {
  try {
    const { rows } = await pool.query(sql);
    return Number(rows[0]?.v ?? 0);
  } catch {
    return 0;
  }
}

async function setMeta(pool: Pool, key: string, value: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO pil_kg_metadata (meta_key, meta_value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (meta_key) DO UPDATE SET meta_value = EXCLUDED.meta_value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function refreshGraphMetadata(pool: Pool): Promise<Record<string, unknown>> {
  const started = Date.now();
  await ensureGraphMaturationSchema(pool);

  const nodeCount = await scalar(pool, `SELECT count(*) AS v FROM pil_kg_nodes`);
  const edgeCount = await scalar(pool, `SELECT count(*) AS v FROM pil_kg_edges`);
  const distinctNodeTypes = await scalar(pool, `SELECT count(DISTINCT node_type) AS v FROM pil_kg_nodes`);
  const distinctRelations = await scalar(pool, `SELECT count(DISTINCT relation) AS v FROM pil_kg_edges`);
  const cov = buildCoverageReport();

  const meta: Record<string, unknown> = {
    node_count: nodeCount,
    edge_count: edgeCount,
    node_types_present: distinctNodeTypes,
    edge_relations_present: distinctRelations,
    node_types_declared: cov.node_types_total,
    edge_relations_declared: cov.relations_total,
    node_categories: NODE_CATEGORIES.length,
    relationship_types: RELATIONSHIP_TYPES.length,
    taxonomy_is_bijective: cov.is_bijective,
    canonical_tables: ['pil_kg_nodes', 'pil_kg_edges'],
    maturation_tables: ['pil_kg_node_types', 'pil_kg_relationship_types', 'pil_kg_metadata', 'pil_kg_similarity_index', 'pil_kg_audit'],
    last_refreshed_at: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(meta)) await setMeta(pool, k, v);

  await recordGraphAudit(pool, {
    event_type: 'refresh_metadata',
    node_count: nodeCount,
    edge_count: edgeCount,
    affected_rows: Object.keys(meta).length,
    duration_ms: Date.now() - started,
  });
  return meta;
}

// ── Similarity (pure core + bounded DB-backed compute over pil_kg_edges) ──────────
/** Jaccard of two neighbour sets: |A∩B| / |A∪B| (0 when both empty). */
export function jaccard(a: Set<string>, b: Set<string>): { score: number; shared: number } {
  if (a.size === 0 && b.size === 0) return { score: 0, shared: 0 };
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  const union = a.size + b.size - inter;
  return { score: union === 0 ? 0 : inter / union, shared: inter };
}

export interface SimilarityPair { source_id: string; target_id: string; score: number; shared_count: number; }

/**
 * Pure: top-K Jaccard similarity among `ids`, using `adj` (undirected neighbour
 * sets). Candidate pairs are restricted to nodes that share ≥1 neighbour, so this
 * is bounded by real adjacency — never a blind O(n²) over the whole graph.
 */
export function computeSimilarityFromAdjacency(
  adj: Map<string, Set<string>>,
  ids: string[],
  opts: { topK?: number; minScore?: number } = {},
): SimilarityPair[] {
  const topK = opts.topK ?? 10;
  const minScore = opts.minScore ?? 0.05;
  const idSet = new Set(ids);

  // Inverted index: neighbour → the in-scope nodes that touch it.
  const byNeighbour = new Map<string, string[]>();
  for (const id of ids) {
    for (const nb of adj.get(id) ?? []) {
      const arr = byNeighbour.get(nb) ?? [];
      arr.push(id);
      byNeighbour.set(nb, arr);
    }
  }
  // Candidate pairs = nodes co-occurring on some neighbour.
  const candidates = new Map<string, Set<string>>();
  for (const members of byNeighbour.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const [x, y] = members[i] < members[j] ? [members[i], members[j]] : [members[j], members[i]];
        if (!candidates.has(x)) candidates.set(x, new Set());
        candidates.get(x)!.add(y);
      }
    }
  }

  const perAnchor = new Map<string, SimilarityPair[]>();
  for (const [x, ys] of candidates) {
    for (const y of ys) {
      if (!idSet.has(x) || !idSet.has(y)) continue;
      const { score, shared } = jaccard(adj.get(x) ?? new Set(), adj.get(y) ?? new Set());
      if (score < minScore) continue;
      for (const [a, b] of [[x, y], [y, x]] as const) {
        const arr = perAnchor.get(a) ?? [];
        arr.push({ source_id: a, target_id: b, score, shared_count: shared });
        perAnchor.set(a, arr);
      }
    }
  }

  const out: SimilarityPair[] = [];
  for (const arr of perAnchor.values()) {
    arr.sort((p, q) => q.score - p.score || p.target_id.localeCompare(q.target_id));
    out.push(...arr.slice(0, topK));
  }
  out.sort((p, q) => p.source_id.localeCompare(q.source_id) || q.score - p.score || p.target_id.localeCompare(q.target_id));
  return out;
}

/**
 * Bounded similarity over the canonical graph for ONE node type (default cap
 * 2000 nodes). Loads adjacency from pil_kg_edges, computes top-K Jaccard, persists
 * into pil_kg_similarity_index (replace-for-method-and-scope). Degrades to no-op if
 * kg_* is empty. Returns the number of similarity rows written.
 */
export async function computeNodeSimilarity(
  pool: Pool,
  opts: { nodeType: string; topK?: number; minScore?: number; maxNodes?: number; method?: string } ,
): Promise<number> {
  const started = Date.now();
  const method = opts.method ?? 'jaccard_neighbors';
  const maxNodes = opts.maxNodes ?? 2000;
  await ensureGraphMaturationSchema(pool);

  let ids: string[] = [];
  let adj = new Map<string, Set<string>>();
  try {
    const nodeRes = await pool.query(
      `SELECT node_id FROM pil_kg_nodes WHERE node_type = $1 ORDER BY node_id LIMIT $2`,
      [opts.nodeType, maxNodes],
    );
    ids = nodeRes.rows.map((r) => String(r.node_id));
    if (ids.length > 0) {
      const edgeRes = await pool.query(
        `SELECT source_id, target_id FROM pil_kg_edges WHERE source_id = ANY($1) OR target_id = ANY($1)`,
        [ids],
      );
      const idSet = new Set(ids);
      for (const e of edgeRes.rows) {
        const s = String(e.source_id), t = String(e.target_id);
        if (idSet.has(s)) { (adj.get(s) ?? adj.set(s, new Set()).get(s)!).add(t); }
        if (idSet.has(t)) { (adj.get(t) ?? adj.set(t, new Set()).get(t)!).add(s); }
      }
    }
  } catch {
    ids = []; adj = new Map();
  }

  const pairs = computeSimilarityFromAdjacency(adj, ids, { topK: opts.topK, minScore: opts.minScore });

  let written = 0;
  if (pairs.length > 0) {
    await pool.query(`DELETE FROM pil_kg_similarity_index WHERE method = $1 AND source_id = ANY($2)`, [method, ids]);
    for (const p of pairs) {
      await pool.query(
        `INSERT INTO pil_kg_similarity_index (source_id, target_id, method, score, shared_count, computed_at)
         VALUES ($1,$2,$3,$4,$5, now())
         ON CONFLICT (source_id, target_id, method) DO UPDATE SET
           score = EXCLUDED.score, shared_count = EXCLUDED.shared_count, computed_at = now()`,
        [p.source_id, p.target_id, method, p.score.toFixed(6), p.shared_count],
      );
      written++;
    }
  }

  await recordGraphAudit(pool, {
    event_type: 'compute_similarity',
    affected_rows: written,
    duration_ms: Date.now() - started,
    status: ids.length === 0 ? 'degraded' : 'ok',
    details: { node_type: opts.nodeType, method, candidates: ids.length, pairs: pairs.length },
  });
  return written;
}

// ── Read-only snapshot (for audit/verify + any future surface) ───────────────
export interface MaturationSnapshot {
  node_type_catalog: Record<string, unknown>[];
  relationship_type_catalog: Record<string, unknown>[];
  graph_metadata: Record<string, unknown>;
  similarity_sample: Record<string, unknown>[];
  recent_audit: Record<string, unknown>[];
}

export async function getMaturationSnapshot(pool: Pool): Promise<MaturationSnapshot> {
  await ensureGraphMaturationSchema(pool);
  const nodeCat = await pool.query(`SELECT * FROM pil_kg_node_types ORDER BY display_order`);
  const relCat = await pool.query(`SELECT * FROM pil_kg_relationship_types ORDER BY display_order`);
  const meta = await pool.query(`SELECT meta_key, meta_value FROM pil_kg_metadata ORDER BY meta_key`);
  const sim = await pool.query(`SELECT * FROM pil_kg_similarity_index ORDER BY score DESC LIMIT 25`);
  const audit = await pool.query(`SELECT * FROM pil_kg_audit ORDER BY id DESC LIMIT 20`);

  const metaObj: Record<string, unknown> = {};
  for (const r of meta.rows) metaObj[r.meta_key] = r.meta_value;

  return {
    node_type_catalog: nodeCat.rows,
    relationship_type_catalog: relCat.rows,
    graph_metadata: metaObj,
    similarity_sample: sim.rows,
    recent_audit: audit.rows,
  };
}
