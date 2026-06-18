/**
 * CAPADEX PIL — Phase 8B: Relationship Traversal Engine (read-only over the
 * CANONICAL materialized graph).
 *
 *   Enables traversal across the ONE existing PIL Knowledge Graph. It reads ONLY:
 *     - pil_kg_nodes            (canonical nodes)
 *     - pil_kg_edges            (canonical edges)
 *     - pil_kg_node_types       (granular node_type → product category)
 *     - pil_kg_relationship_types (granular relation → semantic verb)
 *
 *   It NEVER creates graph nodes, NEVER mutates graph structure — every traversal
 *   is a pure read over the materialized graph + a directed/undirected index. The
 *   four resolvers are pure functions over that index (testable without a DB):
 *
 *     - resolveShortestPath  (ShortestPathResolver)
 *     - resolveRelated       (RelatedNodeResolver)
 *     - resolveLineage       (LineageResolver — the canonical concept spine)
 *     - resolveDependencies  (DependencyResolver — directed transitive closure)
 *
 * CANON (strict):
 *   - READ-ONLY of the graph: only SELECTs against pil_kg_*; zero writes.
 *   - NO fabrication: a path/edge is returned only if it is a REAL row in
 *     pil_kg_edges. Edges whose endpoints are absent from pil_kg_nodes are dropped
 *     at index build → there are NEVER broken paths.
 *   - BOUNDED + CYCLE-SAFE: every traversal carries a visited set + depth/size
 *     caps → it ALWAYS terminates (no infinite loops), even on a cyclic graph.
 *   - DETERMINISTIC: stable sort keys → same graph, same result.
 *   - NEVER throws past the orchestrator boundary; degrades to empty.
 */
import type { Pool } from 'pg';
import { NODE_CATEGORIES, RELATIONSHIP_TYPES } from './knowledge-graph-maturation-schema';

// ── The canonical concept spine (Phase 8B mandated order) ────────────────────
export const LINEAGE_SPINE = [
  'concern',
  'capability',
  'problem',
  'behavior',
  'archetype',
  'intervention',
  'recommendation',
] as const;
export type SpineCategory = (typeof LINEAGE_SPINE)[number];

// ── Index types ──────────────────────────────────────────────────────────────
export interface TravNode {
  id: string;
  node_type: string;
  category: string;
  label: string;
}
export interface TravEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  verb: string;
}
export interface TraversalIndex {
  byId: Map<string, TravNode>;
  /** directed outgoing: nodeId → [{edge, to}] */
  out: Map<string, { edge: TravEdge; to: string }[]>;
  /** directed incoming: nodeId → [{edge, from}] */
  in: Map<string, { edge: TravEdge; from: string }[]>;
  /** undirected: nodeId → [{edge, neighbor, direction}] */
  undirected: Map<string, { edge: TravEdge; neighbor: string; direction: 'out' | 'in' }[]>;
  /** category → node ids (deterministic order) */
  byCategory: Map<string, string[]>;
  typeToCategory: Map<string, string>;
  relationToVerb: Map<string, string>;
}

export interface CatalogMaps {
  typeToCategory: Map<string, string>;
  relationToVerb: Map<string, string>;
}

// ── Fallback catalog maps from the pure maturation schema ─────────────────────
function schemaCatalogMaps(): CatalogMaps {
  const typeToCategory = new Map<string, string>();
  for (const cat of NODE_CATEGORIES) {
    for (const t of cat.member_node_types) typeToCategory.set(t, cat.key);
  }
  const relationToVerb = new Map<string, string>();
  for (const rt of RELATIONSHIP_TYPES) {
    for (const r of rt.member_relations) relationToVerb.set(r, rt.key);
  }
  return { typeToCategory, relationToVerb };
}

// ── DB loaders (read-only; each degrades) ────────────────────────────────────
function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

/**
 * Load the granular→category / granular→verb maps from the materialized catalog
 * tables (pil_kg_node_types / pil_kg_relationship_types). Falls back to the pure
 * schema for any granular value the catalogs do not cover (or if the tables are
 * empty / absent) so the engine is robust before the catalogs are seeded.
 */
export async function loadCatalogMaps(pool: Pool): Promise<CatalogMaps> {
  const fallback = schemaCatalogMaps();
  const typeToCategory = new Map(fallback.typeToCategory);
  const relationToVerb = new Map(fallback.relationToVerb);
  try {
    const nt = await pool.query(`SELECT category_key, member_node_types FROM pil_kg_node_types`);
    for (const r of nt.rows) {
      for (const t of asArr(r.member_node_types)) typeToCategory.set(t, String(r.category_key));
    }
  } catch (err) {
    console.warn('[pil-traversal] node-type catalog degraded:', err instanceof Error ? err.message : String(err));
  }
  try {
    const rt = await pool.query(`SELECT relationship_type, member_relations FROM pil_kg_relationship_types`);
    for (const r of rt.rows) {
      for (const rel of asArr(r.member_relations)) relationToVerb.set(rel, String(r.relationship_type));
    }
  } catch (err) {
    console.warn('[pil-traversal] relationship-type catalog degraded:', err instanceof Error ? err.message : String(err));
  }
  return { typeToCategory, relationToVerb };
}

export interface RawGraph {
  nodes: { id: string; node_type: string; label: string }[];
  edges: { id: string; source: string; target: string; relation: string }[];
}

/** Read the canonical materialized graph from pil_kg_nodes / pil_kg_edges. */
export async function loadMaterializedGraph(pool: Pool): Promise<RawGraph> {
  try {
    const [n, e] = await Promise.all([
      // Stable load order → deterministic index (the engine's traversals are capped,
      // so tie-broken/capped results must not depend on DB row order).
      pool.query(`SELECT node_id, node_type, COALESCE(label, node_key) AS label FROM pil_kg_nodes ORDER BY node_id`),
      pool.query(`SELECT edge_id, source_id, target_id, relation FROM pil_kg_edges ORDER BY edge_id`),
    ]);
    return {
      nodes: n.rows.map((r) => ({ id: String(r.node_id), node_type: String(r.node_type), label: String(r.label ?? r.node_id) })),
      edges: e.rows.map((r) => ({ id: String(r.edge_id), source: String(r.source_id), target: String(r.target_id), relation: String(r.relation) })),
    };
  } catch (err) {
    console.warn('[pil-traversal] materialized graph load degraded:', err instanceof Error ? err.message : String(err));
    return { nodes: [], edges: [] };
  }
}

// ── Pure index build (no DB; fully testable) ─────────────────────────────────
export function buildTraversalIndex(raw: RawGraph, maps: CatalogMaps): TraversalIndex {
  const byId = new Map<string, TravNode>();
  for (const n of raw.nodes) {
    byId.set(n.id, {
      id: n.id,
      node_type: n.node_type,
      category: maps.typeToCategory.get(n.node_type) ?? n.node_type,
      label: n.label,
    });
  }
  const out = new Map<string, { edge: TravEdge; to: string }[]>();
  const inn = new Map<string, { edge: TravEdge; from: string }[]>();
  const undirected = new Map<string, { edge: TravEdge; neighbor: string; direction: 'out' | 'in' }[]>();
  const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
    let l = m.get(k);
    if (!l) { l = []; m.set(k, l); }
    l.push(v);
  };
  for (const e of raw.edges) {
    // Drop any edge whose endpoints are not real nodes → no broken paths, ever.
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    const edge: TravEdge = {
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
      verb: maps.relationToVerb.get(e.relation) ?? e.relation,
    };
    push(out, e.source, { edge, to: e.target });
    push(inn, e.target, { edge, from: e.source });
    push(undirected, e.source, { edge, neighbor: e.target, direction: 'out' });
    push(undirected, e.target, { edge, neighbor: e.source, direction: 'in' });
  }
  // Sort every adjacency list by stable keys so capped/tie-broken traversals are
  // deterministic regardless of edge load order.
  for (const l of out.values()) l.sort((a, b) => a.to.localeCompare(b.to) || a.edge.id.localeCompare(b.edge.id));
  for (const l of inn.values()) l.sort((a, b) => a.from.localeCompare(b.from) || a.edge.id.localeCompare(b.edge.id));
  for (const l of undirected.values()) l.sort((a, b) => a.neighbor.localeCompare(b.neighbor) || a.edge.id.localeCompare(b.edge.id));
  const byCategory = new Map<string, string[]>();
  for (const n of byId.values()) push(byCategory, n.category, n.id);
  for (const ids of byCategory.values()) ids.sort();
  return { byId, out, in: inn, undirected, byCategory, typeToCategory: maps.typeToCategory, relationToVerb: maps.relationToVerb };
}

// ── Path-step shape shared by the resolvers ──────────────────────────────────
export interface PathStep {
  id: string;
  node_type: string;
  category: string;
  label: string;
  /** how we arrived at this node from the previous step (null for the first node) */
  relation: string | null;
  verb: string | null;
  direction: 'out' | 'in' | null;
}

function nodeStep(index: TraversalIndex, id: string, rel: TravEdge | null, dir: 'out' | 'in' | null): PathStep {
  const n = index.byId.get(id)!;
  return {
    id: n.id,
    node_type: n.node_type,
    category: n.category,
    label: n.label,
    relation: rel ? rel.relation : null,
    verb: rel ? rel.verb : null,
    direction: dir,
  };
}

// ── 1) ShortestPathResolver ──────────────────────────────────────────────────
export interface ShortestPathResult {
  source: string;
  target: string;
  directed: boolean;
  reachable: boolean;
  hops: number;
  truncated: boolean;
  path: PathStep[];
}

/**
 * BFS shortest path between two nodes. `directed` follows pil_kg_edges direction
 * (out edges only); otherwise reachability is undirected. Cycle-safe (visited
 * set) and bounded by maxHops → always terminates.
 */
export function resolveShortestPath(
  index: TraversalIndex,
  source: string,
  target: string,
  opts: { directed?: boolean; maxHops?: number } = {},
): ShortestPathResult {
  const directed = opts.directed ?? false;
  const maxHops = Math.max(1, Math.min(opts.maxHops ?? 12, 64));
  const base = { source, target, directed, reachable: false, hops: 0, truncated: false, path: [] as PathStep[] };
  if (!index.byId.has(source) || !index.byId.has(target)) return base;
  if (source === target) {
    return { ...base, reachable: true, hops: 0, path: [nodeStep(index, source, null, null)] };
  }
  const prev = new Map<string, { from: string; edge: TravEdge; direction: 'out' | 'in' }>();
  const depth = new Map<string, number>([[source, 0]]);
  const seen = new Set<string>([source]);
  const queue: string[] = [source];
  let truncated = false;
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    if (d >= maxHops) { truncated = true; continue; }
    const links = directed
      ? (index.out.get(cur) ?? []).map((l) => ({ edge: l.edge, neighbor: l.to, direction: 'out' as const }))
      : (index.undirected.get(cur) ?? []);
    for (const { edge, neighbor, direction } of links) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      depth.set(neighbor, d + 1);
      prev.set(neighbor, { from: cur, edge, direction });
      if (neighbor === target) {
        const chain: PathStep[] = [];
        let at = target;
        while (at !== source) {
          const step = prev.get(at)!;
          chain.unshift(nodeStep(index, at, step.edge, step.direction));
          at = step.from;
        }
        chain.unshift(nodeStep(index, source, null, null));
        return { source, target, directed, reachable: true, hops: chain.length - 1, truncated, path: chain };
      }
      queue.push(neighbor);
    }
  }
  return { ...base, truncated };
}

// ── 2) RelatedNodeResolver ───────────────────────────────────────────────────
export interface RelatedLink { id: string; relation: string; verb: string; direction: 'out' | 'in'; }
export interface RelatedNode {
  id: string;
  node_type: string;
  category: string;
  label: string;
  shared_count: number;
  score: number;
  via_sample: string[];
}
export interface RelatedResult {
  node: PathStep;
  direct: { id: string; node_type: string; category: string; label: string; links: RelatedLink[] }[];
  related: RelatedNode[];
  truncated: boolean;
}

/**
 * Related nodes = direct neighbours PLUS co-citation siblings: distinct nodes
 * that share ≥1 intermediary neighbour with the anchor (ranked by shared count,
 * cosine-normalised by degree). Bounded expansion (maxExpand) so a hub never
 * blows up. Read-only over real edges — no precomputed similarity table needed.
 */
export function resolveRelated(
  index: TraversalIndex,
  id: string,
  opts: { limit?: number; sameCategory?: boolean; maxExpand?: number; perNeighborCap?: number } = {},
): RelatedResult | null {
  const node = index.byId.get(id);
  if (!node) return null;
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 200));
  const maxExpand = Math.max(100, Math.min(opts.maxExpand ?? 5000, 50000));
  const perNeighborCap = Math.max(10, Math.min(opts.perNeighborCap ?? 300, 2000));

  const directLinks = new Map<string, RelatedLink[]>();
  for (const { edge, neighbor, direction } of index.undirected.get(id) ?? []) {
    if (neighbor === id) continue;
    let l = directLinks.get(neighbor);
    if (!l) { l = []; directLinks.set(neighbor, l); }
    l.push({ id: neighbor, relation: edge.relation, verb: edge.verb, direction });
  }
  const directSet = new Set(directLinks.keys());

  const shared = new Map<string, { count: number; via: string[] }>();
  let expanded = 0;
  let truncated = false;
  const degOf = (x: string) => index.undirected.get(x)?.length ?? 0;
  for (const mid of directSet) {
    let perN = 0;
    for (const { neighbor: k } of index.undirected.get(mid) ?? []) {
      if (k === id || directSet.has(k)) continue;
      const cur = shared.get(k) ?? { count: 0, via: [] };
      cur.count += 1;
      if (cur.via.length < 3) cur.via.push(mid);
      shared.set(k, cur);
      perN += 1;
      expanded += 1;
      if (perN >= perNeighborCap) break;
      if (expanded >= maxExpand) { truncated = true; break; }
    }
    if (expanded >= maxExpand) { truncated = true; break; }
  }

  const degId = Math.max(1, degOf(id));
  let related: RelatedNode[] = [];
  for (const [k, { count, via }] of shared) {
    const n = index.byId.get(k);
    if (!n) continue;
    if (opts.sameCategory && n.category !== node.category) continue;
    const score = count / Math.sqrt(degId * Math.max(1, degOf(k)));
    related.push({ id: n.id, node_type: n.node_type, category: n.category, label: n.label, shared_count: count, score: Number(score.toFixed(6)), via_sample: via });
  }
  related.sort((a, b) => b.shared_count - a.shared_count || b.score - a.score || a.id.localeCompare(b.id));
  related = related.slice(0, limit);

  const direct = Array.from(directLinks.entries())
    .map(([nid, links]) => {
      const n = index.byId.get(nid)!;
      return { id: n.id, node_type: n.node_type, category: n.category, label: n.label, links };
    })
    .sort((a, b) => b.links.length - a.links.length || a.id.localeCompare(b.id))
    .slice(0, limit);

  return { node: nodeStep(index, id, null, null), direct, related, truncated };
}

// ── 3) LineageResolver (the canonical concept spine) ─────────────────────────
export interface LineageStageNode {
  id: string;
  node_type: string;
  category: string;
  label: string;
  hops_from_prev_stage: number;
  path_from_prev_stage: PathStep[];
}
export interface LineageStage {
  index: number;
  category: string;
  reached: boolean;
  nodes: LineageStageNode[];
}
export interface LineageResult {
  anchor: string;
  anchor_category: string;
  spine: string[];
  start_index: number;
  stages: LineageStage[];
  stages_reached: number;
  spine_length: number;
  complete: boolean;
}

/**
 * Multi-source BFS from a frontier to the NEAREST nodes of a target category,
 * within maxHops. Returns each found node + the shortest path from its nearest
 * frontier source. Cycle-safe + capped. Never crosses back into the frontier.
 */
function bfsToCategory(
  index: TraversalIndex,
  frontier: Set<string>,
  targetCategory: string,
  maxHops: number,
  cap: number,
): Map<string, PathStep[]> {
  const found = new Map<string, PathStep[]>();
  const prev = new Map<string, { from: string; edge: TravEdge; direction: 'out' | 'in' }>();
  const depth = new Map<string, number>();
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const f of frontier) { seen.add(f); depth.set(f, 0); queue.push(f); }
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    const curNode = index.byId.get(cur);
    if (curNode && !frontier.has(cur) && curNode.category === targetCategory) {
      // reconstruct path from nearest frontier source
      const chain: PathStep[] = [];
      let at = cur;
      while (!frontier.has(at)) {
        const step = prev.get(at)!;
        chain.unshift(nodeStep(index, at, step.edge, step.direction));
        at = step.from;
      }
      chain.unshift(nodeStep(index, at, null, null)); // the source frontier node
      found.set(cur, chain);
      if (found.size >= cap) break;
      continue; // do not expand past a found target node
    }
    if (d >= maxHops) continue;
    for (const { edge, neighbor, direction } of index.undirected.get(cur) ?? []) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      depth.set(neighbor, d + 1);
      prev.set(neighbor, { from: cur, edge, direction });
      queue.push(neighbor);
    }
  }
  return found;
}

/**
 * Walk the canonical spine from the anchor: at each successive spine category,
 * find the nearest reachable nodes (real edges only) and make them the next
 * frontier. A stage with no reachable member is honestly `reached:false` and the
 * walk stops there — never a fabricated link, never a broken path.
 */
export function resolveLineage(
  index: TraversalIndex,
  anchorId: string,
  opts: { maxHopsPerStage?: number; maxPerStage?: number } = {},
): LineageResult | null {
  const anchor = index.byId.get(anchorId);
  if (!anchor) return null;
  const maxHops = Math.max(1, Math.min(opts.maxHopsPerStage ?? 3, 8));
  const maxPerStage = Math.max(1, Math.min(opts.maxPerStage ?? 8, 50));
  const spine = LINEAGE_SPINE as readonly string[];

  const spinePos = spine.indexOf(anchor.category);
  const startIndex = spinePos >= 0 ? spinePos : 0;
  const stages: LineageStage[] = [];

  let frontier = new Set<string>([anchorId]);
  // Seed the start stage. If the anchor sits on the spine, that stage IS the anchor.
  if (spinePos >= 0) {
    stages.push({
      index: startIndex,
      category: spine[startIndex],
      reached: true,
      nodes: [{ id: anchor.id, node_type: anchor.node_type, category: anchor.category, label: anchor.label, hops_from_prev_stage: 0, path_from_prev_stage: [nodeStep(index, anchorId, null, null)] }],
    });
  }

  let stopped = false;
  for (let i = startIndex + (spinePos >= 0 ? 1 : 0); i < spine.length; i++) {
    if (stopped) {
      stages.push({ index: i, category: spine[i], reached: false, nodes: [] });
      continue;
    }
    const found = bfsToCategory(index, frontier, spine[i], maxHops, maxPerStage);
    if (found.size === 0) {
      stages.push({ index: i, category: spine[i], reached: false, nodes: [] });
      stopped = true;
      continue;
    }
    const nodes: LineageStageNode[] = [];
    for (const [fid, path] of found) {
      const n = index.byId.get(fid)!;
      nodes.push({ id: n.id, node_type: n.node_type, category: n.category, label: n.label, hops_from_prev_stage: path.length - 1, path_from_prev_stage: path });
    }
    nodes.sort((a, b) => a.hops_from_prev_stage - b.hops_from_prev_stage || a.id.localeCompare(b.id));
    stages.push({ index: i, category: spine[i], reached: true, nodes });
    frontier = new Set(nodes.map((n) => n.id));
  }

  const stages_reached = stages.filter((s) => s.reached).length;
  return {
    anchor: anchorId,
    anchor_category: anchor.category,
    spine: [...spine],
    start_index: startIndex,
    stages,
    stages_reached,
    spine_length: spine.length,
    complete: stages.length > 0 && stages.every((s) => s.reached),
  };
}

// ── 4) DependencyResolver (directed transitive closure) ──────────────────────
export interface DependencyNode { id: string; node_type: string; category: string; label: string; depth: number; }
export interface DependencyEdge { id: string; source: string; target: string; relation: string; verb: string; }
export interface DependencyResult {
  root: string;
  direction: 'downstream' | 'upstream' | 'both';
  depth_reached: number;
  node_count: number;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  truncated: boolean;
  cycle_safe: true;
}

/**
 * Transitive closure following pil_kg_edges direction:
 *   - downstream → outgoing edges (what this node points to / depends on)
 *   - upstream   → incoming edges (what depends on this node)
 *   - both       → undirected closure
 * Visited set ⇒ a cycle is traversed once and the walk terminates (no infinite
 * loop). Bounded by maxDepth + maxNodes (truncated flag set when capped).
 */
export function resolveDependencies(
  index: TraversalIndex,
  rootId: string,
  opts: { direction?: 'downstream' | 'upstream' | 'both'; maxDepth?: number; maxNodes?: number } = {},
): DependencyResult | null {
  const root = index.byId.get(rootId);
  if (!root) return null;
  const direction = opts.direction ?? 'downstream';
  const maxDepth = Math.max(1, Math.min(opts.maxDepth ?? 6, 32));
  const maxNodes = Math.max(1, Math.min(opts.maxNodes ?? 500, 5000));

  const depth = new Map<string, number>([[rootId, 0]]);
  const visited = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  const edgesOut: DependencyEdge[] = [];
  const emittedEdge = new Set<string>();
  let depthReached = 0;
  let truncated = false;

  const linksOf = (id: string): { edge: TravEdge; next: string }[] => {
    if (direction === 'downstream') return (index.out.get(id) ?? []).map((l) => ({ edge: l.edge, next: l.to }));
    if (direction === 'upstream') return (index.in.get(id) ?? []).map((l) => ({ edge: l.edge, next: l.from }));
    return (index.undirected.get(id) ?? []).map((l) => ({ edge: l.edge, next: l.neighbor }));
  };

  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    depthReached = Math.max(depthReached, d);
    if (d >= maxDepth) continue;
    for (const { edge, next } of linksOf(cur)) {
      if (!emittedEdge.has(edge.id)) {
        emittedEdge.add(edge.id);
        edgesOut.push({ id: edge.id, source: edge.source, target: edge.target, relation: edge.relation, verb: edge.verb });
      }
      if (visited.has(next)) continue; // cycle / re-convergence → traversed once
      if (visited.size >= maxNodes) { truncated = true; continue; }
      visited.add(next);
      depth.set(next, d + 1);
      queue.push(next);
    }
    if (visited.size >= maxNodes) truncated = true;
  }

  const nodes: DependencyNode[] = Array.from(visited)
    .filter((id) => id !== rootId)
    .map((id) => { const n = index.byId.get(id)!; return { id: n.id, node_type: n.node_type, category: n.category, label: n.label, depth: depth.get(id)! }; })
    .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));

  return {
    root: rootId,
    direction,
    depth_reached: depthReached,
    node_count: nodes.length,
    nodes,
    edges: edgesOut,
    truncated,
    cycle_safe: true,
  };
}

// ── Index summary (for audit/coverage) ───────────────────────────────────────
export interface IndexSummary {
  node_count: number;
  edge_count: number;
  category_counts: Record<string, number>;
  verb_counts: Record<string, number>;
}
export function indexSummary(index: TraversalIndex): IndexSummary {
  const category_counts: Record<string, number> = {};
  for (const [cat, ids] of index.byCategory) category_counts[cat] = ids.length;
  const verb_counts: Record<string, number> = {};
  let edge_count = 0;
  const seen = new Set<string>();
  for (const links of index.out.values()) {
    for (const { edge } of links) {
      if (seen.has(edge.id)) continue;
      seen.add(edge.id);
      edge_count += 1;
      verb_counts[edge.verb] = (verb_counts[edge.verb] ?? 0) + 1;
    }
  }
  return { node_count: index.byId.size, edge_count, category_counts, verb_counts };
}

// ── Orchestrator (cached; never throws) ──────────────────────────────────────
const TTL_MS = 60_000;
let cached: { index: TraversalIndex; at: number } | null = null;
let inflight: Promise<TraversalIndex> | null = null;

export async function getTraversalIndex(pool: Pool, opts: { refresh?: boolean } = {}): Promise<TraversalIndex> {
  const now = Date.now();
  if (!opts.refresh && cached && now - cached.at < TTL_MS) return cached.index;
  if (inflight) return inflight;
  inflight = (async () => {
    const [raw, maps] = await Promise.all([loadMaterializedGraph(pool), loadCatalogMaps(pool)]);
    const index = buildTraversalIndex(raw, maps);
    cached = { index, at: Date.now() };
    return index;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function traversePath(
  pool: Pool, source: string, target: string, opts: { directed?: boolean; maxHops?: number } = {},
): Promise<ShortestPathResult & { found: boolean }> {
  const index = await getTraversalIndex(pool);
  const found = index.byId.has(source) && index.byId.has(target);
  return { ...resolveShortestPath(index, source, target, opts), found };
}

export async function traverseRelated(
  pool: Pool, id: string, opts: { limit?: number; sameCategory?: boolean } = {},
): Promise<(RelatedResult & { found: true }) | { found: false }> {
  const index = await getTraversalIndex(pool);
  const r = resolveRelated(index, id, opts);
  return r ? { ...r, found: true } : { found: false };
}

export async function traverseLineage(
  pool: Pool, anchor: string, opts: { maxHopsPerStage?: number; maxPerStage?: number } = {},
): Promise<(LineageResult & { found: true }) | { found: false }> {
  const index = await getTraversalIndex(pool);
  const r = resolveLineage(index, anchor, opts);
  return r ? { ...r, found: true } : { found: false };
}

export async function traverseDependencies(
  pool: Pool, id: string, opts: { direction?: 'downstream' | 'upstream' | 'both'; maxDepth?: number; maxNodes?: number } = {},
): Promise<(DependencyResult & { found: true }) | { found: false }> {
  const index = await getTraversalIndex(pool);
  const r = resolveDependencies(index, id, opts);
  return r ? { ...r, found: true } : { found: false };
}
