/**
 * CAPADEX PIL — Phase 8E: Graph Explainability Engine (GraphExplainabilityEngine).
 *
 * Makes every STATEMENT the system asserts (a recommendation / intervention node)
 * graph-traceable: it walks the CANONICAL materialized graph (pil_kg_nodes/pil_kg_edges,
 * via the Phase-8B traversal index) from any node back toward its grounding SOURCE
 * (a concern → question) and emits an explainable, real-edge-only lineage.
 *
 *   Three pure resolvers over the TraversalIndex (testable without a DB):
 *     - resolveExplain        — anchors (immediate grounding edges) + path-to-source + sentence
 *     - resolveWhy            — a concise natural-language "why" + support summary
 *     - resolvePathToSource   — the shortest real path to the nearest grounding source
 *
 * CANON (strict, mirrors 8B/8C/8D):
 *   - READ-ONLY of the graph: only SELECTs (via getTraversalIndex). The only write is the
 *     append-only pil_kg_audit summary row (Phase 8A) from runExplainabilityAudit.
 *   - NO fabrication: a hop is returned only if it is a REAL edge in the index. When a
 *     statement cannot chain to a concern/question (e.g. a recommendation anchored on a
 *     `construct`, which is a graph sink), that is reported HONESTLY — never invented.
 *   - BOUNDED + CYCLE-SAFE: every traversal carries a visited set + hop/expansion caps →
 *     always terminates, even on the cyclic concern↔capability↔problem↔behavior loop.
 *   - DETERMINISTIC: stable sort keys → same graph, same result.
 *   - NEVER throws past the orchestrator boundary; degrades to empty / {found:false}.
 *
 * Two honest layers of "explainability coverage":
 *   1. local support     — a statement has ≥1 real grounding edge (out-degree ≥ 1). This is
 *      the "No Unsupported Statements" guarantee and is 100% (no orphan recs/interventions).
 *   2. source-traceable  — the statement chains to a concern/question. Interventions do;
 *      recommendations (construct anchor = sink) do NOT. Reported as-is, never tuned.
 */
import type { Pool } from 'pg';
import {
  getTraversalIndex,
  indexSummary,
  type TraversalIndex,
  type TravEdge,
  type PathStep,
} from './graph-traversal-engine';
import { ensureGraphMaturationSchema, recordGraphAudit } from './knowledge-graph-maturation';

// ── Category contracts ───────────────────────────────────────────────────────
/** The grounding "source" end of an explanation (most fundamental evidence). */
export const SOURCE_CATEGORIES = ['concern', 'question'] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];
const SOURCE_SET = new Set<string>(SOURCE_CATEGORIES);

/** The assertions that must be supported (the "statements" the system makes to a user). */
export const STATEMENT_CATEGORIES = ['recommendation', 'intervention'] as const;
export type StatementCategory = (typeof STATEMENT_CATEGORIES)[number];
const STATEMENT_SET = new Set<string>(STATEMENT_CATEGORIES);

// Default bounds (all clamped at call sites; documented a priori).
const DEFAULT_MAX_HOPS = 8;
const DEFAULT_MAX_EXPAND = 20000;

// ── Readable relation phrasing (fallback to the semantic verb, then the relation) ─
const RELATION_PHRASE: Record<string, string> = {
  recommendation_anchored_on_construct: 'is anchored on construct',
  runtime_intervention_for_construct: 'targets construct',
  intervention_for_problem: 'supports problem',
  intervention_for_archetype: 'supports archetype',
  problem_belongs_to_archetype: 'belongs to archetype',
  problem_manifests_behavior: 'manifests behavior',
  behavior_indicates_concern: 'indicates concern',
  concern_framed_as_capability: 'is framed as capability',
  capability_addresses_problem: 'addresses problem',
  concern_activates_signal: 'activates signal',
  concern_resolves_clarity: 'is resolved by clarity question',
  archetype_covers_concern: 'covers concern',
  problem_belongs_to_archetype_inv: 'is the archetype of',
  intent_for_archetype: 'leads to archetype',
  intent_for_problem: 'leads to problem',
  emotion_belongs_to_archetype: 'belongs to archetype',
  family_belongs_to_domain: 'belongs to domain',
  atomic_belongs_to_family: 'belongs to family',
  atomic_belongs_to_domain: 'belongs to domain',
  tagged_with: 'is tagged with',
};

function phraseFor(edge: TravEdge): string {
  return RELATION_PHRASE[edge.relation] ?? edge.verb ?? edge.relation;
}

// ── PathStep helper (local; mirrors the engine's private nodeStep) ────────────
function step(
  index: TraversalIndex,
  id: string,
  edge: TravEdge | null,
  dir: 'out' | 'in' | null,
): PathStep {
  const n = index.byId.get(id)!;
  return {
    id: n.id,
    node_type: n.node_type,
    category: n.category,
    label: n.label,
    relation: edge ? edge.relation : null,
    verb: edge ? edge.verb : null,
    direction: dir,
  };
}

// ── Shared bounded BFS to the nearest source node(s) ─────────────────────────
export interface SourceHit {
  id: string;
  node_type: string;
  category: string;
  label: string;
  hops: number;
  path: PathStep[];
}
interface NearestSources {
  byCategory: Map<string, SourceHit>;
  nearest: SourceHit | null;
  truncated: boolean;
  self_is_source: boolean;
}

/**
 * Undirected, cycle-safe, bounded BFS from `startId` to the nearest node in any
 * SOURCE category. Records the first (nearest) hit per source category. Bounded by
 * maxHops + maxExpand. `stopOnFirst` short-circuits as soon as ANY source is found
 * (used by the bulk coverage scan so a hub never blows up). Reconstructs the real
 * path from the start node — every step is a real edge.
 */
function nearestSources(
  index: TraversalIndex,
  startId: string,
  opts: { maxHops?: number; maxExpand?: number; stopOnFirst?: boolean } = {},
): NearestSources {
  const empty: NearestSources = { byCategory: new Map(), nearest: null, truncated: false, self_is_source: false };
  const start = index.byId.get(startId);
  if (!start) return empty;
  const maxHops = Math.max(1, Math.min(opts.maxHops ?? DEFAULT_MAX_HOPS, 32));
  const maxExpand = Math.max(100, Math.min(opts.maxExpand ?? DEFAULT_MAX_EXPAND, 200000));
  const stopOnFirst = opts.stopOnFirst ?? false;

  // The start node itself being a source is a degenerate "0-hop" grounding.
  if (SOURCE_SET.has(start.category)) {
    const hit: SourceHit = { id: start.id, node_type: start.node_type, category: start.category, label: start.label, hops: 0, path: [step(index, startId, null, null)] };
    const byCategory = new Map<string, SourceHit>([[start.category, hit]]);
    return { byCategory, nearest: hit, truncated: false, self_is_source: true };
  }

  const prev = new Map<string, { from: string; edge: TravEdge; dir: 'out' | 'in' }>();
  const depth = new Map<string, number>([[startId, 0]]);
  const seen = new Set<string>([startId]);
  const queue: string[] = [startId];
  const byCategory = new Map<string, SourceHit>();
  let truncated = false;
  let expanded = 0;

  const buildPath = (id: string): PathStep[] => {
    const chain: PathStep[] = [];
    let at = id;
    while (at !== startId) {
      const s = prev.get(at)!;
      chain.unshift(step(index, at, s.edge, s.dir));
      at = s.from;
    }
    chain.unshift(step(index, startId, null, null));
    return chain;
  };

  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    const curNode = index.byId.get(cur)!;
    if (cur !== startId && SOURCE_SET.has(curNode.category)) {
      if (!byCategory.has(curNode.category)) {
        byCategory.set(curNode.category, { id: cur, node_type: curNode.node_type, category: curNode.category, label: curNode.label, hops: d, path: buildPath(cur) });
        if (stopOnFirst) break;
        if (byCategory.size >= SOURCE_SET.size) break;
      }
      // keep expanding through it to discover the other source categories
    }
    if (d >= maxHops) { truncated = true; continue; }
    for (const { edge, neighbor, direction } of index.undirected.get(cur) ?? []) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      depth.set(neighbor, d + 1);
      prev.set(neighbor, { from: cur, edge, dir: direction });
      queue.push(neighbor);
      expanded += 1;
      if (expanded >= maxExpand) { truncated = true; break; }
    }
    if (expanded >= maxExpand) { truncated = true; break; }
  }

  let nearest: SourceHit | null = null;
  for (const v of byCategory.values()) if (!nearest || v.hops < nearest.hops || (v.hops === nearest.hops && v.id < nearest.id)) nearest = v;
  return { byCategory, nearest, truncated, self_is_source: false };
}

// ── Anchors: the immediate grounding edges (out-neighbours) of a node ─────────
export interface AnchorLink {
  id: string;
  node_type: string;
  category: string;
  label: string;
  relation: string;
  verb: string;
  phrase: string;
}

/** Direct outgoing neighbours = the nodes this node is grounded on / references. */
function anchorsOf(index: TraversalIndex, id: string): AnchorLink[] {
  const out: AnchorLink[] = [];
  for (const { edge, to } of index.out.get(id) ?? []) {
    const n = index.byId.get(to);
    if (!n) continue;
    out.push({ id: n.id, node_type: n.node_type, category: n.category, label: n.label, relation: edge.relation, verb: edge.verb, phrase: phraseFor(edge) });
  }
  out.sort((a, b) => a.relation.localeCompare(b.relation) || a.id.localeCompare(b.id));
  return out;
}

// ── Natural-language sentence from a real path ───────────────────────────────
function sentenceFromPath(path: PathStep[]): string {
  if (path.length === 0) return '';
  const head = `${labelOf(path[0])}`;
  if (path.length === 1) return `${head} is itself a grounding source.`;
  const clauses: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const s = path[i];
    const ph = s.relation ? (RELATION_PHRASE[s.relation] ?? s.verb ?? s.relation) : 'relates to';
    clauses.push(`${ph} ${labelOf(s)}`);
  }
  return `${head} ${clauses.join(', which ')}.`;
}
function labelOf(s: PathStep): string {
  const lbl = (s.label ?? '').trim();
  return lbl && lbl !== s.id ? `${lbl} [${s.category}]` : `${s.id} [${s.category}]`;
}

// ── 1) resolveExplain ─────────────────────────────────────────────────────────
export interface ExplainResult {
  found: boolean;
  node: PathStep;
  is_statement: boolean;
  /** immediate grounding edges (what this node directly references) */
  anchors: AnchorLink[];
  /** has ≥1 grounding edge → locally supported (the "No Unsupported Statements" guarantee) */
  supported: boolean;
  /** chains to a concern/question */
  reaches_source: boolean;
  nearest_source: SourceHit | null;
  source_by_category: Record<string, SourceHit>;
  path_to_source: PathStep[];
  sentence: string;
  truncated: boolean;
}

export function resolveExplain(
  index: TraversalIndex,
  id: string,
  opts: { maxHops?: number; maxExpand?: number } = {},
): ExplainResult | null {
  const node = index.byId.get(id);
  if (!node) return null;
  const anchors = anchorsOf(index, id);
  const ns = nearestSources(index, id, { maxHops: opts.maxHops, maxExpand: opts.maxExpand });
  const sourceByCat: Record<string, SourceHit> = {};
  for (const [k, v] of ns.byCategory) sourceByCat[k] = v;
  const path = ns.nearest ? ns.nearest.path : [];

  let sentence: string;
  if (ns.self_is_source) {
    sentence = `${labelOf(step(index, id, null, null))} is itself a grounding source.`;
  } else if (ns.nearest) {
    sentence = sentenceFromPath(ns.nearest.path);
  } else if (anchors.length > 0) {
    const a = anchors[0];
    sentence = `${labelOf(step(index, id, null, null))} ${a.phrase} ${a.label || a.id} [${a.category}]; this is its grounding anchor — it does not chain to a concern/question in the current graph.`;
  } else {
    sentence = `${labelOf(step(index, id, null, null))} has no grounding edge in the current graph (unsupported).`;
  }

  return {
    found: true,
    node: step(index, id, null, null),
    is_statement: STATEMENT_SET.has(node.category),
    anchors,
    supported: anchors.length > 0,
    reaches_source: ns.nearest != null,
    nearest_source: ns.nearest,
    source_by_category: sourceByCat,
    path_to_source: path,
    sentence,
    truncated: ns.truncated,
  };
}

// ── 2) resolveWhy (concise) ───────────────────────────────────────────────────
export interface WhyResult {
  found: boolean;
  node: PathStep;
  is_statement: boolean;
  supported: boolean;
  reaches_source: boolean;
  hops_to_source: number | null;
  nearest_source: { id: string; category: string; label: string } | null;
  anchor_summary: { count: number; sample: { id: string; phrase: string; label: string }[] };
  sentence: string;
  truncated: boolean;
}

export function resolveWhy(
  index: TraversalIndex,
  id: string,
  opts: { maxHops?: number; maxExpand?: number } = {},
): WhyResult | null {
  const full = resolveExplain(index, id, opts);
  if (!full) return null;
  return {
    found: true,
    node: full.node,
    is_statement: full.is_statement,
    supported: full.supported,
    reaches_source: full.reaches_source,
    hops_to_source: full.nearest_source ? full.nearest_source.hops : null,
    nearest_source: full.nearest_source
      ? { id: full.nearest_source.id, category: full.nearest_source.category, label: full.nearest_source.label }
      : null,
    anchor_summary: {
      count: full.anchors.length,
      sample: full.anchors.slice(0, 5).map((a) => ({ id: a.id, phrase: a.phrase, label: a.label })),
    },
    sentence: full.sentence,
    truncated: full.truncated,
  };
}

// ── 3) resolvePathToSource ────────────────────────────────────────────────────
export interface PathToSourceResult {
  found: boolean;
  node: PathStep;
  reachable: boolean;
  hops: number;
  nearest_source: SourceHit | null;
  by_category: Record<string, SourceHit>;
  path: PathStep[];
  truncated: boolean;
}

export function resolvePathToSource(
  index: TraversalIndex,
  id: string,
  opts: { maxHops?: number; maxExpand?: number } = {},
): PathToSourceResult | null {
  const node = index.byId.get(id);
  if (!node) return null;
  const ns = nearestSources(index, id, { maxHops: opts.maxHops, maxExpand: opts.maxExpand });
  const byCat: Record<string, SourceHit> = {};
  for (const [k, v] of ns.byCategory) byCat[k] = v;
  return {
    found: true,
    node: step(index, id, null, null),
    reachable: ns.nearest != null,
    hops: ns.nearest ? ns.nearest.hops : 0,
    nearest_source: ns.nearest,
    by_category: byCat,
    path: ns.nearest ? ns.nearest.path : [],
    truncated: ns.truncated,
  };
}

// ── Coverage over the statement layer ────────────────────────────────────────
export interface StatementCoverage {
  category: StatementCategory;
  total: number;
  supported: number;          // out-degree ≥ 1 (has a grounding edge)
  unsupported: number;
  unsupported_ids: string[];  // capped sample
  reaches_source: number;     // chains to a concern/question
  source_trace_rate: number;  // reaches_source / total
  support_rate: number;       // supported / total
}
export interface ExplainabilityCoverage {
  per_category: StatementCoverage[];
  totals: {
    statements: number;
    supported: number;
    unsupported: number;
    reaches_source: number;
    support_rate: number;
    source_trace_rate: number;
  };
}

const COVERAGE_SAMPLE = 25;

/** Per-statement-category support + source-traceability. Bulk BFS uses stopOnFirst. */
export function computeExplainabilityCoverage(
  index: TraversalIndex,
  opts: { maxHops?: number; maxExpand?: number } = {},
): ExplainabilityCoverage {
  const per: StatementCoverage[] = [];
  let tStatements = 0, tSupported = 0, tUnsupported = 0, tReaches = 0;

  for (const cat of STATEMENT_CATEGORIES) {
    const ids = (index.byCategory.get(cat) ?? []).slice().sort();
    let supported = 0, reaches = 0;
    const unsupportedIds: string[] = [];
    for (const id of ids) {
      const outDeg = (index.out.get(id) ?? []).length;
      if (outDeg > 0) supported += 1; else unsupportedIds.push(id);
      const ns = nearestSources(index, id, { maxHops: opts.maxHops, maxExpand: opts.maxExpand, stopOnFirst: true });
      if (ns.nearest != null) reaches += 1;
    }
    const total = ids.length;
    per.push({
      category: cat,
      total,
      supported,
      unsupported: total - supported,
      unsupported_ids: unsupportedIds.slice(0, COVERAGE_SAMPLE),
      reaches_source: reaches,
      source_trace_rate: total > 0 ? Number((reaches / total).toFixed(6)) : 0,
      support_rate: total > 0 ? Number((supported / total).toFixed(6)) : 0,
    });
    tStatements += total; tSupported += supported; tUnsupported += total - supported; tReaches += reaches;
  }

  return {
    per_category: per.sort((a, b) => a.category.localeCompare(b.category)),
    totals: {
      statements: tStatements,
      supported: tSupported,
      unsupported: tUnsupported,
      reaches_source: tReaches,
      support_rate: tStatements > 0 ? Number((tSupported / tStatements).toFixed(6)) : 0,
      source_trace_rate: tStatements > 0 ? Number((tReaches / tStatements).toFixed(6)) : 0,
    },
  };
}

// ── Hard validation: No Unsupported Statements ───────────────────────────────
export interface ExplainabilityValidation {
  name: string;
  total_statements: number;
  unsupported: number;
  unsupported_ids: string[];
  passed: boolean;
}

export function runExplainabilityValidations(coverage: ExplainabilityCoverage): ExplainabilityValidation[] {
  const unsupportedIds: string[] = [];
  for (const c of coverage.per_category) unsupportedIds.push(...c.unsupported_ids);
  unsupportedIds.sort();
  return [{
    name: 'No Unsupported Statements',
    total_statements: coverage.totals.statements,
    unsupported: coverage.totals.unsupported,
    unsupported_ids: unsupportedIds.slice(0, COVERAGE_SAMPLE),
    passed: coverage.totals.unsupported === 0,
  }];
}

// ── Graph Explainability Score ───────────────────────────────────────────────
/**
 * Fixed weights (sum = 1). Documented & a priori — never tuned to a target.
 *   support      — fraction of statements with ≥1 real grounding edge (local support).
 *   source_trace — fraction of statements that chain to a concern/question.
 * Recommendations anchor on a `construct` sink → they depress source_trace honestly.
 */
export const EXPLAINABILITY_WEIGHTS = {
  support: 0.6,
  source_trace: 0.4,
} as const;

export interface ExplainabilityScore {
  score: number;
  band: 'strong' | 'moderate' | 'weak';
  components: { support: number; source_trace: number };
  basis: { statements: number; supported: number; reaches_source: number };
}

function scoreBand(score: number): ExplainabilityScore['band'] {
  if (score > 0.85) return 'strong';
  if (score >= 0.6) return 'moderate';
  return 'weak';
}

export function computeExplainabilityScore(coverage: ExplainabilityCoverage): ExplainabilityScore {
  const support = coverage.totals.support_rate;
  const sourceTrace = coverage.totals.source_trace_rate;
  const score = Number(
    (support * EXPLAINABILITY_WEIGHTS.support + sourceTrace * EXPLAINABILITY_WEIGHTS.source_trace).toFixed(6),
  );
  return {
    score,
    band: scoreBand(score),
    components: { support: Number(support.toFixed(6)), source_trace: Number(sourceTrace.toFixed(6)) },
    basis: { statements: coverage.totals.statements, supported: coverage.totals.supported, reaches_source: coverage.totals.reaches_source },
  };
}

// ── Full explainability report (pure) ────────────────────────────────────────
export interface ExplainabilityReport {
  generated_at: string;
  coverage: ExplainabilityCoverage;
  validations: ExplainabilityValidation[];
  all_validations_passed: boolean;
  score: ExplainabilityScore;
}

export function computeExplainabilityReport(
  index: TraversalIndex,
  opts: { maxHops?: number; maxExpand?: number } = {},
): ExplainabilityReport {
  const coverage = computeExplainabilityCoverage(index, opts);
  const validations = runExplainabilityValidations(coverage);
  const score = computeExplainabilityScore(coverage);
  return {
    generated_at: new Date().toISOString(),
    coverage,
    validations,
    all_validations_passed: validations.every((v) => v.passed),
    score,
  };
}

// ── Async orchestrators (cached read-only index; {found} contract for routes) ─
export async function explainNode(pool: Pool, id: string, opts: { maxHops?: number; maxExpand?: number } = {}): Promise<ExplainResult> {
  const index = await getTraversalIndex(pool);
  const r = resolveExplain(index, id, opts);
  return r ?? emptyExplain(id);
}
export async function whyNode(pool: Pool, id: string, opts: { maxHops?: number; maxExpand?: number } = {}): Promise<WhyResult> {
  const index = await getTraversalIndex(pool);
  const r = resolveWhy(index, id, opts);
  return r ?? { found: false, node: { id, node_type: '', category: '', label: id, relation: null, verb: null, direction: null }, is_statement: false, supported: false, reaches_source: false, hops_to_source: null, nearest_source: null, anchor_summary: { count: 0, sample: [] }, sentence: '', truncated: false };
}
export async function pathToSource(pool: Pool, id: string, opts: { maxHops?: number; maxExpand?: number } = {}): Promise<PathToSourceResult> {
  const index = await getTraversalIndex(pool);
  const r = resolvePathToSource(index, id, opts);
  return r ?? { found: false, node: { id, node_type: '', category: '', label: id, relation: null, verb: null, direction: null }, reachable: false, hops: 0, nearest_source: null, by_category: {}, path: [], truncated: false };
}
function emptyExplain(id: string): ExplainResult {
  return { found: false, node: { id, node_type: '', category: '', label: id, relation: null, verb: null, direction: null }, is_statement: false, anchors: [], supported: false, reaches_source: false, nearest_source: null, source_by_category: {}, path_to_source: [], sentence: '', truncated: false };
}

/** Read-only explainability report from the CACHED traversal index (no writes). */
export async function explainabilityReport(pool: Pool, opts: { maxHops?: number; maxExpand?: number } = {}): Promise<ExplainabilityReport> {
  const index = await getTraversalIndex(pool);
  return computeExplainabilityReport(index, opts);
}

/**
 * Full Phase-8E run: compute the explainability report + append a summary row to
 * pil_kg_audit. Best-effort: never throws; the graph structure is untouched.
 */
export async function runExplainabilityAudit(
  pool: Pool,
  opts: { maxHops?: number; maxExpand?: number; refresh?: boolean } = {},
): Promise<ExplainabilityReport> {
  const started = Date.now();
  let report: ExplainabilityReport;
  try {
    await ensureGraphMaturationSchema(pool);
    const index = await getTraversalIndex(pool, { refresh: opts.refresh });
    report = computeExplainabilityReport(index, opts);
    const graph = indexSummary(index);
    await recordGraphAudit(pool, {
      event_type: 'explainability_audit',
      node_count: graph.node_count,
      edge_count: graph.edge_count,
      affected_rows: report.coverage.totals.unsupported,
      duration_ms: Date.now() - started,
      status: report.all_validations_passed ? 'ok' : 'degraded',
      details: {
        phase: '8e',
        score: report.score.score,
        band: report.score.band,
        all_validations_passed: report.all_validations_passed,
        support_rate: report.coverage.totals.support_rate,
        source_trace_rate: report.coverage.totals.source_trace_rate,
        per_category: report.coverage.per_category.map((c) => ({ category: c.category, total: c.total, support_rate: c.support_rate, source_trace_rate: c.source_trace_rate })),
      },
    });
  } catch (err) {
    console.warn('[pil-explainability] runExplainabilityAudit degraded:', err instanceof Error ? err.message : String(err));
    report = {
      generated_at: new Date().toISOString(),
      coverage: { per_category: [], totals: { statements: 0, supported: 0, unsupported: 0, reaches_source: 0, support_rate: 0, source_trace_rate: 0 } },
      validations: [],
      all_validations_passed: false,
      score: { score: 0, band: 'weak', components: { support: 0, source_trace: 0 }, basis: { statements: 0, supported: 0, reaches_source: 0 } },
    };
  }
  return report;
}
