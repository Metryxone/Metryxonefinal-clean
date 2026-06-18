/**
 * CAPADEX PIL — Phase 8C: Similarity Intelligence Engine (read-only of the
 * CANONICAL graph; writes ONLY the derived pil_kg_similarity_index).
 *
 *   Uses graph relationships to detect similarity among the six PIL categories:
 *     concern · behavior · problem · archetype · intervention · recommendation
 *
 *   Two nodes of the SAME category are similar when they share neighbours in the
 *   canonical graph (pil_kg_edges). Similarity is Jaccard over each node's FULL
 *   undirected neighbour set; candidate pairs are restricted to same-category
 *   nodes that co-occur on ≥1 neighbour, so it is bounded by real adjacency —
 *   never a blind O(n²) over the whole graph.
 *
 * CANON (strict):
 *   - READ-ONLY of the graph: only the cached read-only traversal index (Phase 8B)
 *     is consumed. The ONLY write is into the derived maturation table
 *     pil_kg_similarity_index (Phase 8A) — never a graph node/edge.
 *   - EXPLAINABLE: every match carries the shared neighbours that produced it
 *     (id/label/category/degree) — no opaque scores, no fabricated links.
 *   - FALSE-MATCH AWARE: a match whose shared neighbours are ALL high-degree hubs
 *     is flagged `hub_only` for review (weak/coincidental) — flagged, never deleted.
 *   - DETERMINISTIC: stable sort keys → same graph, same result.
 *   - SHARED CORE: the live APIs and the persisted index use the SAME pure
 *     resolver, so they can never drift (cf. bridge-tag-resolver canon).
 *   - NEVER throws past the orchestrator boundary; degrades to empty.
 */
import type { Pool } from 'pg';
import {
  getTraversalIndex,
  type TraversalIndex,
} from './graph-traversal-engine';
import { jaccard, ensureGraphMaturationSchema, recordGraphAudit } from './knowledge-graph-maturation';

// ── The six detect categories (Phase 8C mandated) ────────────────────────────
export const SIMILARITY_CATEGORIES = [
  'concern',
  'behavior',
  'problem',
  'archetype',
  'intervention',
  'recommendation',
] as const;
export type SimilarityCategory = (typeof SIMILARITY_CATEGORIES)[number];

/** Method label persisted into pil_kg_similarity_index (distinct from 8A's `jaccard_neighbors`). */
export const SIMILARITY_METHOD = 'category_jaccard';

/**
 * A shared neighbour with degree ≥ this is a "hub" — connecting through it alone is
 * a weak similarity signal (e.g. a GENERAL_CONCERN catch-all or a domain hub). A
 * match whose shared neighbours are ALL hubs is flagged for false-match review.
 */
export const HUB_DEGREE_THRESHOLD = 50;

// ── Pure adjacency view over the read-only traversal index ────────────────────
/** Undirected neighbour-set adjacency: nodeId → Set(neighbourId). Pure. */
export function adjacencyFromIndex(index: TraversalIndex): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const [id, links] of index.undirected) {
    const s = new Set<string>();
    for (const l of links) if (l.neighbor !== id) s.add(l.neighbor);
    adj.set(id, s);
  }
  return adj;
}

// ── Result shapes ────────────────────────────────────────────────────────────
export interface SharedNeighborRef {
  id: string;
  node_type: string;
  category: string;
  label: string;
  degree: number;
  is_hub: boolean;
}
export interface SimilarMatch {
  id: string;
  node_type: string;
  category: string;
  label: string;
  /** Jaccard of the two full undirected neighbour sets (0..1). */
  score: number;
  /** |shared neighbours| that backs this match. */
  shared_count: number;
  /** EXPLAINABILITY: the actual shared neighbours (bounded sample, hub-annotated). */
  shared_neighbors: SharedNeighborRef[];
  /** FALSE-MATCH REVIEW: every shared neighbour is a high-degree hub → weak/coincidental. */
  hub_only: boolean;
}
export interface SimilarResult {
  node: { id: string; node_type: string; category: string; label: string };
  target_category: string;
  matches: SimilarMatch[];
  candidates_considered: number;
  truncated: boolean;
}

export interface SimilarOpts {
  /** Restrict matches to this category. Default = the anchor's own category (true "similar"). */
  targetCategory?: string;
  limit?: number;
  minScore?: number;
  /** Max distinct candidate nodes to score (bound on hub fan-out). */
  maxExpand?: number;
  /** Per-neighbour cap on how many co-citing nodes to pull (bound on a single hub). */
  perNeighborCap?: number;
  /** Max shared neighbours surfaced per match (explanation sample). */
  explainCap?: number;
  hubDegree?: number;
}

const degreeOf = (adj: Map<string, Set<string>>, id: string): number => adj.get(id)?.size ?? 0;

/** Full intersection of two neighbour sets (the shared neighbours). Bounded by the
 *  smaller set — the same cost jaccard already pays — so `hub_only` can be judged
 *  over EVERY shared neighbour, not a truncated sample. */
function sharedNeighborIds(a: Set<string>, b: Set<string>): string[] {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const out: string[] = [];
  for (const x of small) if (large.has(x)) out.push(x);
  return out;
}

// ── 1) resolveSimilar — per-anchor top-K (pure, bounded by the neighbourhood) ──
/**
 * Top-K nodes of `targetCategory` (default = the anchor's category) most similar to
 * the anchor by Jaccard of their full undirected neighbour sets. Candidates are
 * gathered ONLY from nodes that co-occur with the anchor on ≥1 neighbour, so this
 * is bounded by the anchor's neighbourhood (never a full category scan).
 */
export function resolveSimilar(
  index: TraversalIndex,
  adj: Map<string, Set<string>>,
  anchorId: string,
  opts: SimilarOpts = {},
): SimilarResult | null {
  const anchor = index.byId.get(anchorId);
  if (!anchor) return null;
  const targetCategory = opts.targetCategory ?? anchor.category;
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 200));
  const minScore = Math.max(0, Math.min(opts.minScore ?? 0.05, 1));
  const maxExpand = Math.max(100, Math.min(opts.maxExpand ?? 20000, 200000));
  const perNeighborCap = Math.max(10, Math.min(opts.perNeighborCap ?? 500, 5000));
  const explainCap = Math.max(1, Math.min(opts.explainCap ?? 6, 50));
  const hubDegree = Math.max(2, opts.hubDegree ?? HUB_DEGREE_THRESHOLD);

  const anchorNbrs = adj.get(anchorId) ?? new Set<string>();

  // Gather same-target-category candidates that co-cite a neighbour with the anchor.
  const candidates = new Set<string>();
  let expanded = 0;
  let truncated = false;
  outer: for (const nb of anchorNbrs) {
    let perN = 0;
    for (const co of adj.get(nb) ?? []) {
      if (co === anchorId) continue;
      const cn = index.byId.get(co);
      if (!cn || cn.category !== targetCategory) continue;
      candidates.add(co);
      perN += 1;
      expanded += 1;
      if (perN >= perNeighborCap) break;
      if (expanded >= maxExpand) { truncated = true; break outer; }
    }
  }

  const matches: SimilarMatch[] = [];
  for (const cid of candidates) {
    const cNbrs = adj.get(cid) ?? new Set<string>();
    const { score, shared } = jaccard(anchorNbrs, cNbrs);
    if (shared <= 0 || score < minScore) continue;
    const cn = index.byId.get(cid)!;

    // Build the explanation: shared neighbours, hub-annotated, sorted most-explanatory first.
    const sharedIds = sharedNeighborIds(anchorNbrs, cNbrs);
    const refs: SharedNeighborRef[] = sharedIds.map((sid) => {
      const sn = index.byId.get(sid);
      const deg = degreeOf(adj, sid);
      return {
        id: sid,
        node_type: sn?.node_type ?? 'unknown',
        category: sn?.category ?? 'unknown',
        label: sn?.label ?? sid,
        degree: deg,
        is_hub: deg >= hubDegree,
      };
    });
    refs.sort((a, b) => a.degree - b.degree || a.id.localeCompare(b.id)); // most-specific (lowest-degree) first
    const hub_only = refs.length > 0 && refs.every((r) => r.is_hub);

    matches.push({
      id: cn.id,
      node_type: cn.node_type,
      category: cn.category,
      label: cn.label,
      score: Number(score.toFixed(6)),
      shared_count: shared,
      shared_neighbors: refs.slice(0, explainCap),
      hub_only,
    });
  }

  matches.sort((a, b) => b.score - a.score || b.shared_count - a.shared_count || a.id.localeCompare(b.id));

  return {
    node: { id: anchor.id, node_type: anchor.node_type, category: anchor.category, label: anchor.label },
    target_category: targetCategory,
    matches: matches.slice(0, limit),
    candidates_considered: candidates.size,
    truncated,
  };
}

// ── 2) resolveRecommendationsLikeThis — similar recommendations for any anchor ─
/**
 * "Recommendations like this": the recommendation-category nodes most similar to
 * the anchor's neighbourhood. When the anchor IS a recommendation this is true
 * peer similarity; for any other anchor it surfaces the recommendations that share
 * the most graph context with it. Honest: if the anchor shares no neighbours with
 * any recommendation, the result is empty (never fabricated).
 */
export function resolveRecommendationsLikeThis(
  index: TraversalIndex,
  adj: Map<string, Set<string>>,
  anchorId: string,
  opts: Omit<SimilarOpts, 'targetCategory'> = {},
): SimilarResult | null {
  return resolveSimilar(index, adj, anchorId, { ...opts, targetCategory: 'recommendation' });
}

// ── 3) computeCategoryMatches — batch (persistence + audit coverage) ──────────
export interface CategoryMatchRow { source_id: string; target_id: string; score: number; shared_count: number; hub_only: boolean; }
export interface CategoryMatchResult {
  category: string;
  nodes_total: number;
  nodes_scored: number;
  nodes_with_match: number;
  rows: CategoryMatchRow[];
  hub_only_rows: number;
  /** Explainability tally: shared-neighbour refs surfaced across all matches … */
  total_refs: number;
  /** … and how many resolve to a real, labelled graph node (integrity → no broken reasons). */
  resolved_refs: number;
  coverage: number;
  truncated: boolean;
}

/**
 * Batch top-K similarity for ALL nodes of one category, via the SAME pure
 * resolveSimilar path the live API uses (so the persisted index can never drift
 * from the API). Bounded by `maxNodes` per category. Pure.
 */
export function computeCategoryMatches(
  index: TraversalIndex,
  adj: Map<string, Set<string>>,
  category: string,
  opts: { maxNodes?: number; topK?: number; minScore?: number } = {},
): CategoryMatchResult {
  const maxNodes = Math.max(1, Math.min(opts.maxNodes ?? 3000, 50000));
  const topK = Math.max(1, Math.min(opts.topK ?? 10, 50));
  const ids = (index.byCategory.get(category) ?? []).slice(0, maxNodes);
  const total = (index.byCategory.get(category) ?? []).length;

  const rows: CategoryMatchRow[] = [];
  let nodesWithMatch = 0;
  let hubOnlyRows = 0;
  let totalRefs = 0;
  let resolvedRefs = 0;
  let truncated = total > ids.length;

  for (const id of ids) {
    const r = resolveSimilar(index, adj, id, { targetCategory: category, limit: topK, minScore: opts.minScore });
    if (!r) continue;
    if (r.truncated) truncated = true;
    if (r.matches.length > 0) nodesWithMatch += 1;
    for (const m of r.matches) {
      rows.push({ source_id: id, target_id: m.id, score: m.score, shared_count: m.shared_count, hub_only: m.hub_only });
      if (m.hub_only) hubOnlyRows += 1;
      for (const s of m.shared_neighbors) {
        totalRefs += 1;
        if (s.category !== 'unknown' && !!s.label) resolvedRefs += 1;
      }
    }
  }

  return {
    category,
    nodes_total: total,
    nodes_scored: ids.length,
    nodes_with_match: nodesWithMatch,
    rows,
    hub_only_rows: hubOnlyRows,
    total_refs: totalRefs,
    resolved_refs: resolvedRefs,
    coverage: ids.length > 0 ? Number((nodesWithMatch / ids.length).toFixed(6)) : 0,
    truncated,
  };
}

// ── 4) Persistence — populate the derived pil_kg_similarity_index ─────────────
/**
 * Rebuild pil_kg_similarity_index for the six detect categories (method
 * `category_jaccard`). Replace-for-method-and-scope per category. Best-effort:
 * never throws; degrades to whatever it could write. The graph itself is untouched.
 */
export async function rebuildSimilarityIndex(
  pool: Pool,
  opts: { categories?: readonly string[]; maxNodes?: number; topK?: number; minScore?: number } = {},
): Promise<{ per_category: Record<string, number>; total_written: number; batches: CategoryMatchResult[] }> {
  const started = Date.now();
  const categories = opts.categories ?? SIMILARITY_CATEGORIES;
  const per_category: Record<string, number> = {};
  const batches: CategoryMatchResult[] = [];
  let total = 0;
  try {
    await ensureGraphMaturationSchema(pool);
    const index = await getTraversalIndex(pool, { refresh: true });
    const adj = adjacencyFromIndex(index);

    for (const category of categories) {
      const batch = computeCategoryMatches(index, adj, category, opts);
      batches.push(batch);
      const ids = (index.byCategory.get(category) ?? []).slice(0, batch.nodes_scored);
      try {
        if (ids.length > 0) {
          await pool.query(
            `DELETE FROM pil_kg_similarity_index WHERE method = $1 AND source_id = ANY($2)`,
            [SIMILARITY_METHOD, ids],
          );
        }
        total += await bulkInsertSimilarityRows(pool, batch.rows);
        per_category[category] = batch.rows.length;
      } catch (err) {
        console.warn(`[pil-similarity] persist degraded for ${category}:`, err instanceof Error ? err.message : String(err));
        per_category[category] = per_category[category] ?? 0;
      }
    }

    await recordGraphAudit(pool, {
      event_type: 'compute_similarity',
      affected_rows: total,
      duration_ms: Date.now() - started,
      details: { phase: '8c', method: SIMILARITY_METHOD, per_category },
    });
  } catch (err) {
    console.warn('[pil-similarity] rebuild degraded:', err instanceof Error ? err.message : String(err));
  }
  return { per_category, total_written: total, batches };
}

/** Chunked multi-row upsert into pil_kg_similarity_index (5 cols/row; safe param budget). */
async function bulkInsertSimilarityRows(pool: Pool, rows: CategoryMatchRow[]): Promise<number> {
  const CHUNK = 1000; // 1000 × 5 = 5000 params « 65535 limit
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 0;
    for (const row of slice) {
      values.push(`($${++p},$${++p},$${++p},$${++p},$${++p}, now())`);
      params.push(row.source_id, row.target_id, SIMILARITY_METHOD, row.score.toFixed(6), row.shared_count);
    }
    await pool.query(
      `INSERT INTO pil_kg_similarity_index (source_id, target_id, method, score, shared_count, computed_at)
       VALUES ${values.join(',')}
       ON CONFLICT (source_id, target_id, method) DO UPDATE SET
         score = EXCLUDED.score, shared_count = EXCLUDED.shared_count, computed_at = now()`,
      params,
    );
    written += slice.length;
  }
  return written;
}

// ── Orchestrator (cached read-only index; never throws) ──────────────────────
export async function similarTo(
  pool: Pool, nodeId: string, opts: SimilarOpts = {},
): Promise<(SimilarResult & { found: true }) | { found: false }> {
  const index = await getTraversalIndex(pool);
  const adj = adjacencyFromIndex(index);
  const r = resolveSimilar(index, adj, nodeId, opts);
  return r ? { ...r, found: true } : { found: false };
}

export async function recommendationsLikeThis(
  pool: Pool, nodeId: string, opts: Omit<SimilarOpts, 'targetCategory'> = {},
): Promise<(SimilarResult & { found: true }) | { found: false }> {
  const index = await getTraversalIndex(pool);
  const adj = adjacencyFromIndex(index);
  const r = resolveRecommendationsLikeThis(index, adj, nodeId, opts);
  return r ? { ...r, found: true } : { found: false };
}
