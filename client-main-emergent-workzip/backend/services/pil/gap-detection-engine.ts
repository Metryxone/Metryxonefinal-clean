/**
 * CAPADEX PIL — Phase 8D: Gap Detection Engine (GraphGapEngine).
 *
 * Audits completeness of the CANONICAL PIL graph (pil_kg_nodes / pil_kg_edges) and
 * surfaces weak intelligence areas. Detects five gap classes:
 *
 *   1. Orphan Nodes          — undirected degree 0 (connected to nothing).
 *   2. Weakly Connected      — undirected degree 1, restricted to CORE node_types
 *                              (leaf node_types like clarity_question are excluded —
 *                              degree 1 is their by-design shape, not a gap).
 *   3. Unused Constructs     — node_type 'construct' with no INCOMING edge (nothing
 *                              anchored on / referencing it).
 *   4. Missing Relationships — a node missing an EXPECTED outgoing relation for its
 *                              node_type (declarative rules — e.g. a recommendation
 *                              with no recommendation_anchored_on_construct edge).
 *   5. Dead-End Traversals   — a node whose node_type IS source-capable (appears as
 *                              an edge source somewhere) yet this node has 0 outgoing
 *                              edges → a broken spine continuation. Source-capable is
 *                              DERIVED from the live edge set, never hardcoded, so
 *                              intended terminals (bridge_tag, construct, …) are not
 *                              false-flagged.
 *
 * CANON (strict):
 *   - READ-ONLY of the graph: consumes only the cached read-only traversal index
 *     (Phase 8B). The ONLY write is the DERIVED table pil_kg_gap_analysis — never a
 *     graph node/edge.
 *   - DETERMINISTIC: stable sort keys → same graph, same result.
 *   - EXPLAINABLE: every gap row carries the structural fact that produced it
 *     (degree / missing relation / sink) — no opaque flags, no fabricated links.
 *   - HONEST: real gaps are reported as-is (the known competency orphan class, the
 *     by-design single-anchor recommendations) — never massaged away.
 *   - NEVER throws past the orchestrator boundary; degrades to whatever it could read.
 */
import type { Pool } from 'pg';
import {
  getTraversalIndex,
  type TraversalIndex,
} from './graph-traversal-engine';
import { ensureGraphMaturationSchema, recordGraphAudit } from './knowledge-graph-maturation';

// ── Gap taxonomy ─────────────────────────────────────────────────────────────
export const GAP_TYPES = [
  'orphan_node',
  'weakly_connected',
  'unused_construct',
  'missing_relationship',
  'dead_end',
] as const;
export type GapType = (typeof GAP_TYPES)[number];

export type GapSeverity = 'high' | 'medium' | 'low';

export interface GapRow {
  gap_type: GapType;
  node_id: string;
  node_type: string;
  category: string;
  severity: GapSeverity;
  detail: Record<string, unknown>;
}

/**
 * CORE node_types whose natural shape is richly connected — a degree-1 member is a
 * genuine "weakly connected" finding. Leaf node_types (clarity_question, atomic_signal,
 * bridge_tag, domain, family, emotion, search_intent, capability, signal) are excluded:
 * degree 1 is their by-design terminal shape, so flagging them would be noise.
 */
export const CORE_NODE_TYPES = new Set<string>([
  'concern',
  'behavior',
  'problem',
  'problem_framing',
  'archetype',
  'intervention',
  'recommendation',
  'construct',
]);

/**
 * Expected OUTGOING relations per node_type. A node of the keyed node_type that does
 * not satisfy the rule is a missing-relationship gap. `mode:'any'` = at least one of
 * `required` present; `mode:'all'` = every relation in `required` present.
 * Grounded in the live relation catalog — no speculative relations.
 */
export interface MissingRelationshipRule {
  node_type: string;
  required: string[];
  mode: 'all' | 'any';
  severity: GapSeverity;
}
export const MISSING_RELATIONSHIP_RULES: MissingRelationshipRule[] = [
  { node_type: 'recommendation', required: ['recommendation_anchored_on_construct'], mode: 'all', severity: 'high' },
  { node_type: 'intervention', required: ['intervention_for_problem', 'intervention_for_archetype'], mode: 'any', severity: 'high' },
  { node_type: 'archetype', required: ['archetype_covers_concern'], mode: 'all', severity: 'high' },
  { node_type: 'concern', required: ['concern_activates_signal'], mode: 'all', severity: 'medium' },
  { node_type: 'behavior', required: ['behavior_indicates_concern'], mode: 'all', severity: 'medium' },
];

// ── Pure degree helpers over the read-only traversal index ───────────────────
/** Undirected degree (total neighbour links, counting parallel edges). */
export function degreeOf(index: TraversalIndex, id: string): number {
  return index.undirected.get(id)?.length ?? 0;
}
export function outCountOf(index: TraversalIndex, id: string): number {
  return index.out.get(id)?.length ?? 0;
}
export function inCountOf(index: TraversalIndex, id: string): number {
  return index.in.get(id)?.length ?? 0;
}

/**
 * Node_types that appear as the SOURCE of at least one edge — i.e. types expected to
 * have outgoing edges. Derived from the live edge set so target-only "intended
 * terminal" types (bridge_tag, construct, problem_framing, …) are never false-flagged
 * as dead-ends. Deterministic.
 */
export function deriveSourceCapableTypes(index: TraversalIndex): Set<string> {
  const types = new Set<string>();
  for (const [id, links] of index.out) {
    if (links.length === 0) continue;
    const n = index.byId.get(id);
    if (n) types.add(n.node_type);
  }
  return types;
}

/** Outgoing relation set for a node (deterministic). */
function outRelations(index: TraversalIndex, id: string): Set<string> {
  const s = new Set<string>();
  for (const { edge } of index.out.get(id) ?? []) s.add(edge.relation);
  return s;
}

const byNodeId = (a: GapRow, b: GapRow) =>
  a.gap_type.localeCompare(b.gap_type) || a.node_id.localeCompare(b.node_id);

// ── 1) Detectors (pure) ──────────────────────────────────────────────────────
/** Orphan = undirected degree 0. */
export function detectOrphanNodes(index: TraversalIndex): GapRow[] {
  const rows: GapRow[] = [];
  for (const [id, n] of index.byId) {
    if (degreeOf(index, id) === 0) {
      rows.push({
        gap_type: 'orphan_node',
        node_id: id,
        node_type: n.node_type,
        category: n.category,
        severity: 'high',
        detail: { degree: 0 },
      });
    }
  }
  return rows.sort(byNodeId);
}

/** Weakly connected = undirected degree 1, restricted to CORE node_types. */
export function detectWeaklyConnectedNodes(index: TraversalIndex): GapRow[] {
  const rows: GapRow[] = [];
  for (const [id, n] of index.byId) {
    if (!CORE_NODE_TYPES.has(n.node_type)) continue;
    if (degreeOf(index, id) !== 1) continue;
    const link = index.undirected.get(id)?.[0];
    rows.push({
      gap_type: 'weakly_connected',
      node_id: id,
      node_type: n.node_type,
      category: n.category,
      severity: 'medium',
      detail: {
        degree: 1,
        only_neighbor: link?.neighbor ?? null,
        via_relation: link?.edge.relation ?? null,
        direction: link?.direction ?? null,
      },
    });
  }
  return rows.sort(byNodeId);
}

/** Unused construct = node_type 'construct' with no incoming edge. */
export function detectUnusedConstructs(index: TraversalIndex): GapRow[] {
  const rows: GapRow[] = [];
  for (const [id, n] of index.byId) {
    if (n.node_type !== 'construct') continue;
    if (inCountOf(index, id) === 0) {
      rows.push({
        gap_type: 'unused_construct',
        node_id: id,
        node_type: n.node_type,
        category: n.category,
        severity: 'high',
        detail: { incoming: 0, outgoing: outCountOf(index, id) },
      });
    }
  }
  return rows.sort(byNodeId);
}

/** Missing relationship = node misses an EXPECTED outgoing relation for its node_type. */
export function detectMissingRelationships(index: TraversalIndex): GapRow[] {
  const rules = new Map(MISSING_RELATIONSHIP_RULES.map((r) => [r.node_type, r]));
  const rows: GapRow[] = [];
  for (const [id, n] of index.byId) {
    const rule = rules.get(n.node_type);
    if (!rule) continue;
    const present = outRelations(index, id);
    const have = rule.required.filter((r) => present.has(r));
    const satisfied = rule.mode === 'any' ? have.length > 0 : have.length === rule.required.length;
    if (satisfied) continue;
    rows.push({
      gap_type: 'missing_relationship',
      node_id: id,
      node_type: n.node_type,
      category: n.category,
      severity: rule.severity,
      detail: {
        mode: rule.mode,
        expected: rule.required,
        present: rule.required.filter((r) => present.has(r)),
        missing: rule.required.filter((r) => !present.has(r)),
      },
    });
  }
  return rows.sort(byNodeId);
}

/** Dead-end = source-capable node_type with degree > 0 but 0 outgoing edges. */
export function detectDeadEndTraversals(index: TraversalIndex): GapRow[] {
  const sourceCapable = deriveSourceCapableTypes(index);
  const rows: GapRow[] = [];
  for (const [id, n] of index.byId) {
    if (!sourceCapable.has(n.node_type)) continue; // intended terminal → not a dead-end
    if (degreeOf(index, id) === 0) continue; // pure orphan, reported elsewhere
    if (outCountOf(index, id) !== 0) continue;
    rows.push({
      gap_type: 'dead_end',
      node_id: id,
      node_type: n.node_type,
      category: n.category,
      severity: 'high',
      detail: { incoming: inCountOf(index, id), outgoing: 0 },
    });
  }
  return rows.sort(byNodeId);
}

// ── 2) Aggregate (pure) ──────────────────────────────────────────────────────
export interface GapSummary {
  total_nodes: number;
  total_edges: number;
  orphan_nodes: number;
  weakly_connected: number;
  unused_constructs: number;
  missing_relationships: number;
  dead_ends: number;
  source_capable_types: string[];
  orphan_by_node_type: Record<string, number>;
}

export interface GapAnalysis {
  rows: GapRow[];
  by_type: Record<GapType, number>;
  summary: GapSummary;
}

/** Run every detector and assemble a deterministic, bounded gap analysis. */
export function computeGapAnalysis(index: TraversalIndex): GapAnalysis {
  const orphans = detectOrphanNodes(index);
  const weak = detectWeaklyConnectedNodes(index);
  const unusedConstructs = detectUnusedConstructs(index);
  const missing = detectMissingRelationships(index);
  const deadEnds = detectDeadEndTraversals(index);

  const rows = [...orphans, ...weak, ...unusedConstructs, ...missing, ...deadEnds].sort(byNodeId);

  let edges = 0;
  for (const links of index.out.values()) edges += links.length;

  const orphanByType: Record<string, number> = {};
  for (const o of orphans) orphanByType[o.node_type] = (orphanByType[o.node_type] ?? 0) + 1;

  return {
    rows,
    by_type: {
      orphan_node: orphans.length,
      weakly_connected: weak.length,
      unused_construct: unusedConstructs.length,
      missing_relationship: missing.length,
      dead_end: deadEnds.length,
    },
    summary: {
      total_nodes: index.byId.size,
      total_edges: edges,
      orphan_nodes: orphans.length,
      weakly_connected: weak.length,
      unused_constructs: unusedConstructs.length,
      missing_relationships: missing.length,
      dead_ends: deadEnds.length,
      source_capable_types: [...deriveSourceCapableTypes(index)].sort(),
      orphan_by_node_type: orphanByType,
    },
  };
}

// ── 3) Schema (lazy mirror of migration 20261204) ────────────────────────────
let gapSchemaReady = false;
export async function ensureGapSchema(pool: Pool): Promise<void> {
  if (gapSchemaReady) return;
  await ensureGraphMaturationSchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pil_kg_gap_analysis (
      id          BIGSERIAL PRIMARY KEY,
      run_id      TEXT NOT NULL,
      gap_type    TEXT NOT NULL,
      node_id     TEXT NOT NULL,
      node_type   TEXT NOT NULL DEFAULT '',
      category    TEXT NOT NULL DEFAULT '',
      severity    TEXT NOT NULL DEFAULT 'low',
      detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_run  ON pil_kg_gap_analysis (run_id);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_type ON pil_kg_gap_analysis (gap_type);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_node ON pil_kg_gap_analysis (node_id);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_gap_sev  ON pil_kg_gap_analysis (severity);
  `);
  gapSchemaReady = true;
}

// ── 4) Persistence — populate the derived pil_kg_gap_analysis ─────────────────
/** Hard ceiling per run so a pathological graph can never blow up the table. */
export const MAX_GAP_ROWS = 100000;

/** Chunked multi-row insert (8 cols/row; safe param budget). */
async function bulkInsertGapRows(pool: Pool, runId: string, rows: GapRow[]): Promise<number> {
  const CHUNK = 1000; // 1000 × 8 = 8000 params « 65535 limit
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 0;
    for (const row of slice) {
      values.push(`($${++p},$${++p},$${++p},$${++p},$${++p},$${++p},$${++p}::jsonb, now())`);
      params.push(runId, row.gap_type, row.node_id, row.node_type, row.category, row.severity, JSON.stringify(row.detail));
    }
    await pool.query(
      `INSERT INTO pil_kg_gap_analysis (run_id, gap_type, node_id, node_type, category, severity, detail, detected_at)
       VALUES ${values.join(',')}`,
      params,
    );
    written += slice.length;
  }
  return written;
}

export interface RunGapResult {
  run_id: string;
  analysis: GapAnalysis;
  rows_written: number;
  truncated: boolean;
}

/**
 * Recompute the gap analysis over the canonical graph and replace pil_kg_gap_analysis
 * with a fresh full snapshot (single run_id). Best-effort: never throws; degrades to
 * whatever it could persist. The graph itself is untouched.
 */
export async function runGapAnalysis(
  pool: Pool,
  opts: { runId?: string; refresh?: boolean } = {},
): Promise<RunGapResult> {
  const started = Date.now();
  const runId = opts.runId ?? `gap_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  let written = 0;
  let truncated = false;
  let analysis: GapAnalysis = {
    rows: [],
    by_type: { orphan_node: 0, weakly_connected: 0, unused_construct: 0, missing_relationship: 0, dead_end: 0 },
    summary: {
      total_nodes: 0, total_edges: 0, orphan_nodes: 0, weakly_connected: 0, unused_constructs: 0,
      missing_relationships: 0, dead_ends: 0, source_capable_types: [], orphan_by_node_type: {},
    },
  };
  try {
    await ensureGapSchema(pool);
    const index = await getTraversalIndex(pool, { refresh: opts.refresh ?? true });
    analysis = computeGapAnalysis(index);

    let rows = analysis.rows;
    if (rows.length > MAX_GAP_ROWS) {
      rows = rows.slice(0, MAX_GAP_ROWS);
      truncated = true;
    }
    try {
      await pool.query(`DELETE FROM pil_kg_gap_analysis`);
      written = await bulkInsertGapRows(pool, runId, rows);
    } catch (err) {
      console.warn('[pil-gap] persist degraded:', err instanceof Error ? err.message : String(err));
    }

    await recordGraphAudit(pool, {
      event_type: 'gap_analysis',
      node_count: analysis.summary.total_nodes,
      edge_count: analysis.summary.total_edges,
      affected_rows: written,
      duration_ms: Date.now() - started,
      details: { phase: '8d', run_id: runId, by_type: analysis.by_type, truncated },
    });
  } catch (err) {
    console.warn('[pil-gap] runGapAnalysis degraded:', err instanceof Error ? err.message : String(err));
  }
  return { run_id: runId, analysis, rows_written: written, truncated };
}

// ── Orchestrator (cached read-only index; never throws) ──────────────────────
/** Read-only gap analysis from the CACHED traversal index (no writes). */
export async function gapReport(pool: Pool): Promise<GapAnalysis> {
  try {
    const index = await getTraversalIndex(pool);
    return computeGapAnalysis(index);
  } catch (err) {
    console.warn('[pil-gap] gapReport degraded:', err instanceof Error ? err.message : String(err));
    return {
      rows: [],
      by_type: { orphan_node: 0, weakly_connected: 0, unused_construct: 0, missing_relationship: 0, dead_end: 0 },
      summary: {
        total_nodes: 0, total_edges: 0, orphan_nodes: 0, weakly_connected: 0, unused_constructs: 0,
        missing_relationships: 0, dead_ends: 0, source_capable_types: [], orphan_by_node_type: {},
      },
    };
  }
}
