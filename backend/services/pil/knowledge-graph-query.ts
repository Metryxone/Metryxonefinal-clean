/**
 * CAPADEX PIL — Phase 8: Knowledge Graph query/traversal (pure, no DB, no IO).
 *
 *   Read-only analytics over an assembled KnowledgeGraph: indexing, neighbours,
 *   shortest path (undirected reachability), connected components, orphans, and
 *   degree-based hubs + per-type / per-relation stats. All deterministic.
 */
import type { KnowledgeGraph, KGNode, KGEdge, NodeType, EdgeRelation } from './knowledge-graph-schema';

export interface GraphIndex {
  byId: Map<string, KGNode>;
  /** undirected adjacency: nodeId → [{ edge, neighborId }] */
  adj: Map<string, { edge: KGEdge; neighborId: string }[]>;
}

/** Build an undirected adjacency index once; reuse across queries. */
export function buildIndex(graph: KnowledgeGraph): GraphIndex {
  const byId = new Map<string, KGNode>();
  for (const n of graph.nodes) byId.set(n.id, n);
  const adj = new Map<string, { edge: KGEdge; neighborId: string }[]>();
  const push = (from: string, edge: KGEdge, neighborId: string) => {
    let list = adj.get(from);
    if (!list) { list = []; adj.set(from, list); }
    list.push({ edge, neighborId });
  };
  for (const e of graph.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    push(e.source, e, e.target);
    push(e.target, e, e.source);
  }
  return { byId, adj };
}

export interface Neighbor {
  node: KGNode;
  via: { relation: EdgeRelation; direction: 'out' | 'in'; provenance: KGEdge['provenance'] };
}

/** Direct neighbours of a node, optionally filtered by neighbour type / relation. */
export function neighbors(
  index: GraphIndex,
  id: string,
  opts: { types?: NodeType[]; relations?: EdgeRelation[]; limit?: number } = {},
): Neighbor[] {
  const list = index.adj.get(id) ?? [];
  const typeSet = opts.types ? new Set(opts.types) : null;
  const relSet = opts.relations ? new Set(opts.relations) : null;
  const out: Neighbor[] = [];
  for (const { edge, neighborId } of list) {
    const node = index.byId.get(neighborId);
    if (!node) continue;
    if (typeSet && !typeSet.has(node.type)) continue;
    if (relSet && !relSet.has(edge.relation)) continue;
    out.push({
      node,
      via: { relation: edge.relation, direction: edge.source === id ? 'out' : 'in', provenance: edge.provenance },
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

export interface PathNode { id: string; type: NodeType; label: string; relation: EdgeRelation | null; }

/** Shortest undirected path between two nodes (BFS). Empty if unreachable. */
export function shortestPath(index: GraphIndex, source: string, target: string): PathNode[] {
  if (!index.byId.has(source) || !index.byId.has(target)) return [];
  if (source === target) {
    const n = index.byId.get(source)!;
    return [{ id: n.id, type: n.type, label: n.label, relation: null }];
  }
  const prev = new Map<string, { from: string; relation: EdgeRelation }>();
  const seen = new Set<string>([source]);
  const queue: string[] = [source];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const { edge, neighborId } of index.adj.get(cur) ?? []) {
      if (seen.has(neighborId)) continue;
      seen.add(neighborId);
      prev.set(neighborId, { from: cur, relation: edge.relation });
      if (neighborId === target) {
        const chain: PathNode[] = [];
        let at = target;
        while (at !== source) {
          const step = prev.get(at)!;
          const n = index.byId.get(at)!;
          chain.unshift({ id: n.id, type: n.type, label: n.label, relation: step.relation });
          at = step.from;
        }
        const s = index.byId.get(source)!;
        chain.unshift({ id: s.id, type: s.type, label: s.label, relation: null });
        return chain;
      }
      queue.push(neighborId);
    }
  }
  return [];
}

/** Induced k-hop neighbourhood around an anchor (BFS to `depth`). */
export function neighborhood(
  index: GraphIndex,
  anchor: string,
  depth: number,
  opts: { maxNodes?: number } = {},
): { nodes: KGNode[]; edges: KGEdge[] } {
  const maxNodes = opts.maxNodes ?? 400;
  if (!index.byId.has(anchor)) return { nodes: [], edges: [] };
  const keep = new Set<string>([anchor]);
  let frontier = [anchor];
  for (let d = 0; d < depth && keep.size < maxNodes; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const { neighborId } of index.adj.get(cur) ?? []) {
        if (!keep.has(neighborId)) {
          keep.add(neighborId);
          next.push(neighborId);
          if (keep.size >= maxNodes) break;
        }
      }
      if (keep.size >= maxNodes) break;
    }
    frontier = next;
  }
  const nodes = Array.from(keep).map((id) => index.byId.get(id)!).filter(Boolean);
  const edges: KGEdge[] = [];
  const emitted = new Set<string>();
  for (const id of keep) {
    for (const { edge, neighborId } of index.adj.get(id) ?? []) {
      if (keep.has(neighborId) && !emitted.has(edge.id)) {
        emitted.add(edge.id);
        edges.push(edge);
      }
    }
  }
  return { nodes, edges };
}

export interface ComponentSummary {
  id: number;
  size: number;
  by_type: Record<string, number>;
  sample: { id: string; type: NodeType; label: string }[];
}

/** Connected components (undirected), summarised + size-sorted. */
export function connectedComponents(graph: KnowledgeGraph, index: GraphIndex): ComponentSummary[] {
  const seen = new Set<string>();
  const comps: ComponentSummary[] = [];
  let cid = 0;
  for (const start of graph.nodes) {
    if (seen.has(start.id)) continue;
    const members: KGNode[] = [];
    const queue = [start.id];
    seen.add(start.id);
    while (queue.length) {
      const cur = queue.shift()!;
      const node = index.byId.get(cur);
      if (node) members.push(node);
      for (const { neighborId } of index.adj.get(cur) ?? []) {
        if (!seen.has(neighborId)) { seen.add(neighborId); queue.push(neighborId); }
      }
    }
    const by_type: Record<string, number> = {};
    for (const m of members) by_type[m.type] = (by_type[m.type] ?? 0) + 1;
    comps.push({
      id: cid++,
      size: members.length,
      by_type,
      sample: members.slice(0, 5).map((m) => ({ id: m.id, type: m.type, label: m.label })),
    });
  }
  return comps.sort((a, b) => b.size - a.size).map((c, i) => ({ ...c, id: i }));
}

/** Nodes with no edges at all (statically unlinked assets). */
export function orphans(graph: KnowledgeGraph, index: GraphIndex): { total: number; by_type: Record<string, number>; sample: KGNode[] } {
  const orphanNodes = graph.nodes.filter((n) => !(index.adj.get(n.id)?.length));
  const by_type: Record<string, number> = {};
  for (const n of orphanNodes) by_type[n.type] = (by_type[n.type] ?? 0) + 1;
  return { total: orphanNodes.length, by_type, sample: orphanNodes.slice(0, 20) };
}

export interface Hub { id: string; type: NodeType; label: string; degree: number; }

/** Top-N highest-degree nodes, optionally restricted to a node type. */
export function hubs(graph: KnowledgeGraph, index: GraphIndex, opts: { limit?: number; type?: NodeType } = {}): Hub[] {
  const limit = opts.limit ?? 20;
  const scored = graph.nodes
    .filter((n) => !opts.type || n.type === opts.type)
    .map((n) => ({ id: n.id, type: n.type, label: n.label, degree: index.adj.get(n.id)?.length ?? 0 }))
    .filter((h) => h.degree > 0);
  scored.sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
  return scored.slice(0, limit);
}

export interface GraphStats {
  node_count: number;
  edge_count: number;
  nodes_by_type: Record<string, number>;
  edges_by_relation: Record<string, number>;
  edges_by_provenance_table: Record<string, number>;
  component_count: number;
  largest_component_size: number;
  orphan_count: number;
}

/** Whole-graph summary stats. */
export function graphStats(graph: KnowledgeGraph, index: GraphIndex): GraphStats {
  const nodes_by_type: Record<string, number> = {};
  for (const n of graph.nodes) nodes_by_type[n.type] = (nodes_by_type[n.type] ?? 0) + 1;
  const edges_by_relation: Record<string, number> = {};
  const edges_by_provenance_table: Record<string, number> = {};
  for (const e of graph.edges) {
    edges_by_relation[e.relation] = (edges_by_relation[e.relation] ?? 0) + 1;
    const t = e.provenance?.table ?? '(unknown)';
    edges_by_provenance_table[t] = (edges_by_provenance_table[t] ?? 0) + 1;
  }
  const comps = connectedComponents(graph, index);
  const orph = orphans(graph, index);
  return {
    node_count: graph.nodes.length,
    edge_count: graph.edges.length,
    nodes_by_type,
    edges_by_relation,
    edges_by_provenance_table,
    component_count: comps.length,
    largest_component_size: comps[0]?.size ?? 0,
    orphan_count: orph.total,
  };
}
