/**
 * Competency Graph Traversal Engine — Phase 3.
 *
 * Read-only dependency-graph traversal over `competency_dependency_edges`.
 * Pure-function helpers + DB loader. Never mutates upstream tables.
 *
 * Returns:
 *   - directed neighbourhoods (upstream / downstream)
 *   - BFS-bounded subgraphs
 *   - confidence propagation paths
 *   - gap clusters (connected weak nodes)
 */
import type { Pool } from 'pg';

export const COMPETENCY_GRAPH_TRAVERSAL_VERSION = '1.0.0';

export type Relationship = 'parent' | 'child' | 'adjacent' | 'dependent' | 'enabling' | 'blocking';

export type GraphEdge = {
  upstreamId: string;
  downstreamId: string;
  relationship: Relationship;
  weight: number;
  propagationFactor: number;
};

export type GraphSubview = {
  rootId: string;
  nodes: string[];
  edges: GraphEdge[];
  hops: number;
};

const PROPAGATING: ReadonlySet<Relationship> = new Set(['parent', 'enabling', 'dependent']);

async function safeRows<T>(pool: Pool, sql: string, params: unknown[]): Promise<{ ok: boolean; rows: T[] }> {
  try { const r = await pool.query(sql, params); return { ok: true, rows: r.rows as T[] }; }
  catch { return { ok: false, rows: [] }; }
}

export async function loadEdgesForCompetencies(pool: Pool, ids: string[]): Promise<GraphEdge[]> {
  if (ids.length === 0) return [];
  const r = await safeRows<any>(pool,
    `SELECT upstream_id, downstream_id, relationship, weight, propagation_factor
       FROM competency_dependency_edges
       WHERE active = TRUE AND (upstream_id = ANY($1::text[]) OR downstream_id = ANY($1::text[]))`,
    [ids]);
  return r.rows.map((e) => ({
    upstreamId: String(e.upstream_id), downstreamId: String(e.downstream_id),
    relationship: e.relationship as Relationship,
    weight: Number(e.weight ?? 1), propagationFactor: Number(e.propagation_factor ?? 0.5),
  }));
}

/** BFS-bounded traversal from a root. direction: 'down' = follow upstream→downstream,
 *  'up' = follow downstream→upstream, 'both' = either. */
export async function traverse(
  pool: Pool, rootId: string,
  opts: { maxHops?: number; maxNodes?: number; direction?: 'up' | 'down' | 'both' } = {},
): Promise<GraphSubview> {
  const maxHops = opts.maxHops ?? 3;
  const maxNodes = opts.maxNodes ?? 64;
  const dir = opts.direction ?? 'both';

  const visited = new Set<string>([rootId]);
  const collectedEdges: GraphEdge[] = [];
  let frontier: string[] = [rootId];
  let hops = 0;

  while (frontier.length > 0 && hops < maxHops && visited.size < maxNodes) {
    hops++;
    const r = await safeRows<any>(pool,
      `SELECT upstream_id, downstream_id, relationship, weight, propagation_factor
         FROM competency_dependency_edges
         WHERE active = TRUE
           AND ( ( upstream_id   = ANY($1::text[]) AND $2 IN ('down','both') )
              OR ( downstream_id = ANY($1::text[]) AND $2 IN ('up','both') ) )`,
      [frontier, dir]);
    const next: string[] = [];
    for (const e of r.rows) {
      const edge: GraphEdge = {
        upstreamId: String(e.upstream_id), downstreamId: String(e.downstream_id),
        relationship: e.relationship as Relationship,
        weight: Number(e.weight ?? 1), propagationFactor: Number(e.propagation_factor ?? 0.5),
      };
      collectedEdges.push(edge);
      const candidate = frontier.includes(edge.upstreamId) ? edge.downstreamId : edge.upstreamId;
      if (!visited.has(candidate) && visited.size < maxNodes) {
        visited.add(candidate); next.push(candidate);
      }
    }
    frontier = next;
  }

  return { rootId, nodes: Array.from(visited), edges: collectedEdges, hops };
}

/** Propagate a confidence delta over upstream→downstream edges. Pure. */
export function propagateConfidence(
  source: { competencyId: string; delta: number },
  edges: GraphEdge[],
  opts: { maxHops?: number; decayPerHop?: number } = {},
): Array<{ competencyId: string; delta: number; hops: number }> {
  const maxHops = opts.maxHops ?? 3;
  const decay = opts.decayPerHop ?? 0.6;
  const out: Array<{ competencyId: string; delta: number; hops: number }> = [];
  const byUp = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (!PROPAGATING.has(e.relationship)) continue;
    if (!byUp.has(e.upstreamId)) byUp.set(e.upstreamId, []);
    byUp.get(e.upstreamId)!.push(e);
  }
  const seen = new Set<string>([source.competencyId]);
  let frontier: Array<{ id: string; delta: number; hops: number }> = [
    { id: source.competencyId, delta: source.delta, hops: 0 },
  ];
  while (frontier.length > 0) {
    const next: Array<{ id: string; delta: number; hops: number }> = [];
    for (const node of frontier) {
      if (node.hops >= maxHops) continue;
      const outs = byUp.get(node.id) ?? [];
      for (const e of outs) {
        if (seen.has(e.downstreamId)) continue;
        seen.add(e.downstreamId);
        const propDelta = node.delta * e.propagationFactor * Math.pow(decay, node.hops);
        if (Math.abs(propDelta) < 0.001) continue;
        out.push({ competencyId: e.downstreamId, delta: propDelta, hops: node.hops + 1 });
        next.push({ id: e.downstreamId, delta: propDelta, hops: node.hops + 1 });
      }
    }
    frontier = next;
  }
  return out;
}

/** Group weak competencies into connected clusters via shared edges. */
export function clusterGaps(weakIds: string[], edges: GraphEdge[]): string[][] {
  if (weakIds.length === 0) return [];
  const set = new Set(weakIds);
  const adj = new Map<string, Set<string>>();
  for (const id of weakIds) adj.set(id, new Set());
  for (const e of edges) {
    if (set.has(e.upstreamId) && set.has(e.downstreamId)) {
      adj.get(e.upstreamId)!.add(e.downstreamId);
      adj.get(e.downstreamId)!.add(e.upstreamId);
    }
  }
  const visited = new Set<string>();
  const clusters: string[][] = [];
  for (const id of weakIds) {
    if (visited.has(id)) continue;
    const cluster: string[] = [];
    const stack = [id];
    while (stack.length) {
      const n = stack.pop()!;
      if (visited.has(n)) continue;
      visited.add(n); cluster.push(n);
      for (const nb of adj.get(n) ?? []) if (!visited.has(nb)) stack.push(nb);
    }
    clusters.push(cluster);
  }
  return clusters;
}
