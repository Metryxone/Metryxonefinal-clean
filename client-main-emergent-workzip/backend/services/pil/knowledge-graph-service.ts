/**
 * CAPADEX PIL — Phase 8: Knowledge Graph service (orchestrator, read-only).
 *
 *   Thin orchestration over the builder + pure query layer:
 *     - getGraph(pool): build once, cache (TTL) with an in-flight guard so a cold
 *       request never builds the (large) graph twice concurrently.
 *     - stats / nodeDetail / findPath: composed query surfaces.
 *     - sessionSubgraph: anchors the global graph on a session's resolved concern
 *       (reusing the existing pipeline-resolver) and returns the real induced
 *       neighbourhood + the pipeline lineage — every edge already provenance-stamped.
 *     - export helpers (Cytoscape JSON / GraphML) for an induced subgraph.
 *
 * CANON: never throws; degrades to an empty graph / null. No fabrication.
 */
import type { Pool } from 'pg';
import {
  buildKnowledgeGraph,
  materializeKnowledgeGraph,
} from './knowledge-graph-builder';
import {
  buildIndex,
  graphStats,
  neighbors,
  shortestPath,
  neighborhood,
  connectedComponents,
  orphans,
  hubs,
  type GraphIndex,
  type GraphStats,
} from './knowledge-graph-query';
import {
  type KnowledgeGraph,
  type KGNode,
  type KGEdge,
  nodeId,
} from './knowledge-graph-schema';
import { buildPipelineForSession, type PipelineHop } from './pipeline-resolver';

// ── Cache (module-level; the graph is deterministic for a given DB) ───────────
const TTL_MS = 60_000;
let cached: { graph: KnowledgeGraph; index: GraphIndex; at: number } | null = null;
let inflight: Promise<{ graph: KnowledgeGraph; index: GraphIndex }> | null = null;

export async function getGraph(
  pool: Pool,
  opts: { refresh?: boolean } = {},
): Promise<{ graph: KnowledgeGraph; index: GraphIndex }> {
  const now = Date.now();
  if (!opts.refresh && cached && now - cached.at < TTL_MS) {
    return { graph: cached.graph, index: cached.index };
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const graph = await buildKnowledgeGraph(pool);
    const index = buildIndex(graph);
    cached = { graph, index, at: Date.now() };
    return { graph, index };
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Force a rebuild + best-effort snapshot into pil_kg_nodes/pil_kg_edges. */
export async function rebuildAndMaterialize(pool: Pool): Promise<{ nodes: number; edges: number }> {
  const { graph } = await getGraph(pool, { refresh: true });
  return materializeKnowledgeGraph(pool, graph);
}

// ── Composed read surfaces ───────────────────────────────────────────────────
export async function getStats(pool: Pool, opts: { refresh?: boolean } = {}): Promise<GraphStats & {
  built_at: string;
  components: ReturnType<typeof connectedComponents>;
  orphans: ReturnType<typeof orphans>;
  top_hubs: ReturnType<typeof hubs>;
}> {
  const { graph, index } = await getGraph(pool, opts);
  return {
    ...graphStats(graph, index),
    built_at: graph.built_at,
    components: connectedComponents(graph, index).slice(0, 25),
    orphans: orphans(graph, index),
    top_hubs: hubs(graph, index, { limit: 25 }),
  };
}

export interface NodeDetail {
  node: KGNode | null;
  degree: number;
  neighbors: ReturnType<typeof neighbors>;
}

export async function getNodeDetail(pool: Pool, id: string, limit = 100): Promise<NodeDetail> {
  const { index } = await getGraph(pool);
  const node = index.byId.get(id) ?? null;
  if (!node) return { node: null, degree: 0, neighbors: [] };
  return { node, degree: index.adj.get(id)?.length ?? 0, neighbors: neighbors(index, id, { limit }) };
}

export async function findPath(pool: Pool, source: string, target: string) {
  const { index } = await getGraph(pool);
  const path = shortestPath(index, source, target);
  return { source, target, reachable: path.length > 0, hops: Math.max(0, path.length - 1), path };
}

// ── Session subgraph: anchor the global graph on the session's concern ────────
export interface SessionSubgraph {
  enabled: boolean;
  session_id: string;
  degraded: boolean;
  reason: string | null;
  anchor: string | null;
  concern_id: string | null;
  generated_at: string;
  lineage: PipelineHop[];
  nodes: (KGNode & { hop_role?: string })[];
  edges: KGEdge[];
}

/**
 * PURE: induce the per-session subgraph from the RESOLVED 8-hop lineage — the
 * instance-level slice of the static graph (NOT a blind k-hop ball, which would
 * pull in topically-unrelated neighbours and miss the lineage's specific chain).
 *
 * Each resolved hop contributes the graph node(s) it actually landed on, keyed
 * exactly as the builder keys them (concern/capability/problem_framing by the
 * concern id; archetype by key; signals/behaviours/interventions by their library
 * id when the runtime payload carries one). We then induce the real,
 * provenance-stamped edges that already connect those nodes in the static graph.
 * Reuses the existing lineage (`pipeline.hops`) — no duplicate lineage logic.
 */
export function lineageInducedSubgraph(
  index: GraphIndex,
  hops: PipelineHop[],
  concernId: string | null,
): { nodes: (KGNode & { hop_role?: string })[]; edges: KGEdge[]; anchor: string | null } {
  const wanted = new Map<string, string>(); // graph nodeId → originating hop key
  const want = (id: string | null, role: string) => {
    if (id && index.byId.has(id) && !wanted.has(id)) wanted.set(id, role);
  };

  const anchor = concernId ? nodeId('concern', concernId) : null;
  want(anchor, 'signal_to_concern');

  for (const hop of hops) {
    if (!hop.resolved) continue;
    const d = (hop.data ?? {}) as Record<string, unknown>;
    switch (hop.key) {
      case 'response_to_signal':
        for (const s of (d.signals as Array<Record<string, unknown>>) ?? []) {
          want(nodeId('signal', String(s.signal_key ?? s.signal_type ?? '')), hop.key);
        }
        break;
      case 'signal_to_concern':
        want(d.concern_id ? nodeId('concern', String(d.concern_id)) : anchor, hop.key);
        break;
      case 'concern_to_capability':
        // capability framing is keyed by the concern id (capability_problem_map)
        want(concernId ? nodeId('capability', concernId) : null, hop.key);
        break;
      case 'capability_to_problem':
        // problem framing of the same concern shares the concern id
        want(concernId ? nodeId('problem_framing', concernId) : null, hop.key);
        break;
      case 'problem_to_behavior':
        for (const b of (d.behaviours as Array<Record<string, unknown>>) ?? []) {
          const bid = b.behavior_id ?? b.id;
          if (bid != null) want(nodeId('behavior', bid as string | number), hop.key);
        }
        break;
      case 'behavior_to_archetype':
        want(d.archetype_key ? nodeId('archetype', String(d.archetype_key)) : null, hop.key);
        break;
      case 'archetype_to_intervention':
        for (const v of (d.interventions as Array<Record<string, unknown>>) ?? []) {
          const vid = v.intervention_id ?? v.id;
          if (vid != null) want(nodeId('intervention', vid as string | number), hop.key);
        }
        break;
    }
  }

  const keep = new Set(wanted.keys());
  const nodes = Array.from(keep).map((id) => ({ ...index.byId.get(id)!, hop_role: wanted.get(id) }));
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
  return { nodes, edges, anchor: anchor && index.byId.has(anchor) ? anchor : null };
}

export async function getSessionSubgraph(
  pool: Pool,
  sessionId: string,
): Promise<SessionSubgraph> {
  const generated_at = new Date().toISOString();
  let pipeline: Awaited<ReturnType<typeof buildPipelineForSession>>;
  try {
    pipeline = await buildPipelineForSession(pool, sessionId);
  } catch {
    return { enabled: true, session_id: sessionId, degraded: true, reason: 'pipeline_error', anchor: null, concern_id: null, generated_at, lineage: [], nodes: [], edges: [] };
  }
  const concernId = pipeline.resolution.concern_id;
  if (!concernId) {
    return { enabled: true, session_id: sessionId, degraded: true, reason: pipeline.reason ?? 'concern_not_resolved', anchor: null, concern_id: null, generated_at, lineage: pipeline.hops, nodes: [], edges: [] };
  }
  const { index } = await getGraph(pool);
  const { nodes, edges, anchor } = lineageInducedSubgraph(index, pipeline.hops, concernId);
  return {
    enabled: true,
    session_id: sessionId,
    degraded: pipeline.degraded,
    reason: pipeline.reason,
    anchor,
    concern_id: concernId,
    generated_at,
    lineage: pipeline.hops,
    nodes,
    edges,
  };
}

// ── Export helpers (operate on an induced subgraph; bounded) ──────────────────
export async function exportSubgraph(
  pool: Pool,
  anchor: string,
  depth: number,
  format: 'cytoscape' | 'graphml',
): Promise<{ format: string; anchor: string; node_count: number; edge_count: number; data: unknown }> {
  const { index } = await getGraph(pool);
  const { nodes, edges } = neighborhood(index, anchor, depth, { maxNodes: 600 });
  const data = format === 'graphml' ? toGraphML(nodes, edges) : toCytoscape(nodes, edges);
  return { format, anchor, node_count: nodes.length, edge_count: edges.length, data };
}

export function toCytoscape(nodes: KGNode[], edges: KGEdge[]) {
  return {
    elements: {
      nodes: nodes.map((n) => ({ data: { id: n.id, type: n.type, label: n.label } })),
      edges: edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, relation: e.relation, provenance_table: e.provenance.table } })),
    },
  };
}

const xmlEscape = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string));

export function toGraphML(nodes: KGNode[], edges: KGEdge[]): string {
  const nodeXml = nodes.map((n) =>
    `    <node id="${xmlEscape(n.id)}"><data key="type">${xmlEscape(n.type)}</data><data key="label">${xmlEscape(n.label ?? '')}</data></node>`).join('\n');
  const edgeXml = edges.map((e) =>
    `    <edge source="${xmlEscape(e.source)}" target="${xmlEscape(e.target)}"><data key="relation">${xmlEscape(e.relation)}</data></edge>`).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <key id="type" for="node" attr.name="type" attr.type="string"/>',
    '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
    '  <key id="relation" for="edge" attr.name="relation" attr.type="string"/>',
    '  <graph edgedefault="directed">',
    nodeXml,
    edgeXml,
    '  </graph>',
    '</graphml>',
  ].join('\n');
}
