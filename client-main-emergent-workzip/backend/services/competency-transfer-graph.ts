/**
 * Phase 4 — Competency Transfer Graph.
 *
 * Directed weighted graph of how growth in one competency cascades into others.
 * Example: structured_communication → leadership → stakeholder_influence.
 *
 * Pure graph algorithms (BFS with weight-decay propagation) operate on an
 * in-memory adjacency list. DB loader is separate so tests don't need DB.
 *
 * Language policy: capability proximity · downstream alignment opportunity.
 * Never asserts certainty of cascade.
 */

import type { Pool } from 'pg';

export const TRANSFER_GRAPH_VERSION = '4.0.0';

export interface TransferEdge {
  source_competency_id: string;
  target_competency_id: string;
  transfer_strength: number;        // 0..1
  transfer_type: 'foundational' | 'adjacent' | 'reinforces' | 'enables' | 'unlocks' | string;
  evidence_basis?: string;
  n_supporting_observations?: number;
}

export interface CascadeNode {
  competency_id: string;
  depth: number;                    // 0 = source, 1 = direct neighbour, ...
  propagated_strength: number;      // 0..1 — product of edges along best path
  path: string[];                   // competency ids from source → this
  edge_types: string[];             // edge types along the best path
}

// ── pure graph algorithms ──────────────────────────────────────────────────

export interface Graph {
  /** outgoing edges keyed by source */
  out: Map<string, TransferEdge[]>;
  /** incoming edges keyed by target */
  in:  Map<string, TransferEdge[]>;
}

export function buildGraph(edges: TransferEdge[]): Graph {
  const out = new Map<string, TransferEdge[]>();
  const inn = new Map<string, TransferEdge[]>();
  for (const e of edges) {
    const a = out.get(e.source_competency_id) ?? [];
    a.push(e); out.set(e.source_competency_id, a);
    const b = inn.get(e.target_competency_id) ?? [];
    b.push(e); inn.set(e.target_competency_id, b);
  }
  return { out, in: inn };
}

/**
 * BFS from a source, propagating cascade strength as the product of edge
 * weights along the best (max-strength) path. Stops at maxDepth.
 * Cycle-safe — once a node is visited with a stronger path it's not re-queued.
 */
export function cascadeFrom(
  graph: Graph,
  sourceId: string,
  opts: { maxDepth?: number; minStrength?: number } = {},
): CascadeNode[] {
  const maxDepth = opts.maxDepth ?? 3;
  const minStrength = opts.minStrength ?? 0.2;
  const best = new Map<string, CascadeNode>();
  best.set(sourceId, { competency_id: sourceId, depth: 0, propagated_strength: 1,
                       path: [sourceId], edge_types: [] });
  const queue: string[] = [sourceId];
  while (queue.length) {
    const cur = queue.shift()!;
    const curNode = best.get(cur)!;
    if (curNode.depth >= maxDepth) continue;
    const outEdges = graph.out.get(cur) ?? [];
    for (const e of outEdges) {
      if (e.target_competency_id === sourceId) continue;
      const propagated = curNode.propagated_strength * e.transfer_strength;
      if (propagated < minStrength) continue;
      const prev = best.get(e.target_competency_id);
      if (!prev || propagated > prev.propagated_strength) {
        best.set(e.target_competency_id, {
          competency_id: e.target_competency_id,
          depth: curNode.depth + 1,
          propagated_strength: propagated,
          path: [...curNode.path, e.target_competency_id],
          edge_types: [...curNode.edge_types, e.transfer_type],
        });
        queue.push(e.target_competency_id);
      }
    }
  }
  best.delete(sourceId);
  return Array.from(best.values()).sort((a, b) => b.propagated_strength - a.propagated_strength);
}

/** Reverse cascade: which upstream competencies most enable this target? */
export function precursorsOf(
  graph: Graph,
  targetId: string,
  opts: { maxDepth?: number; minStrength?: number } = {},
): CascadeNode[] {
  // Build a truly-inverted graph: each edge's source/target swapped, so that
  // BFS via `out` correctly walks toward predecessors.
  const inverted: TransferEdge[] = [];
  for (const arr of graph.out.values()) {
    for (const e of arr) {
      inverted.push({
        source_competency_id: e.target_competency_id,
        target_competency_id: e.source_competency_id,
        transfer_strength: e.transfer_strength,
        transfer_type: e.transfer_type,
        evidence_basis: e.evidence_basis,
        n_supporting_observations: e.n_supporting_observations,
      });
    }
  }
  return cascadeFrom(buildGraph(inverted), targetId, opts);
}

// ── DB loader ──────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
let graphCache: { at: number; graph: Graph } | null = null;

export async function loadGraph(pool: Pool, force = false): Promise<Graph> {
  if (!force && graphCache && Date.now() - graphCache.at < CACHE_TTL_MS) {
    return graphCache.graph;
  }
  const { rows } = await pool.query<TransferEdge>(`
    SELECT source_competency_id, target_competency_id,
           transfer_strength::float AS transfer_strength,
           transfer_type, evidence_basis, n_supporting_observations
      FROM learn_transfer_edges
  `);
  const graph = buildGraph(rows);
  graphCache = { at: Date.now(), graph };
  return graph;
}

export async function listEdges(
  pool: Pool, filter: { source?: string; target?: string; limit?: number } = {},
): Promise<TransferEdge[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filter.source) { params.push(filter.source); conds.push(`source_competency_id = $${params.length}`); }
  if (filter.target) { params.push(filter.target); conds.push(`target_competency_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(filter.limit ?? 200, 500);
  const { rows } = await pool.query<TransferEdge>(`
    SELECT source_competency_id, target_competency_id,
           transfer_strength::float AS transfer_strength,
           transfer_type, evidence_basis, n_supporting_observations
      FROM learn_transfer_edges
      ${where}
     ORDER BY transfer_strength DESC
     LIMIT ${limit}
  `, params);
  return rows;
}

export function invalidateGraphCache() { graphCache = null; }
