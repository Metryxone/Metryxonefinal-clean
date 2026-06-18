/**
 * Explainability Graph Engine — assembles a typed node/edge graph that
 * traces a score / readiness / recommendation back to its source signals.
 * Pure function on inputs; caller decides what to feed.
 */
import type { Pool } from 'pg';
export const EXPLAINABILITY_GRAPH_VERSION = '7.0.0';

export type GraphNode = {
  id: string;
  type: 'source' | 'signal' | 'competency' | 'score' | 'recommendation' | 'intervention';
  label: string;
  value?: number;
  meta?: Record<string, unknown>;
};
export type GraphEdge = { from: string; to: string; relation: string; weight?: number };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type LineageInput = {
  userId: string; decisionKey: string;
  sources?: Array<{ source: string; signal: string; weight: number }>;
  competencyScores?: Array<{ competency: string; level: number; confidence: number }>;
  recommendations?: Array<{ key: string; rationale: string }>;
};

/** Build a score-lineage graph from an inference / scoring envelope. */
export function buildScoreLineageGraph(input: LineageInput): Graph {
  const nodes: GraphNode[] = []; const edges: GraphEdge[] = [];
  const sourceIds = new Map<string, string>();

  // Layer 1: sources
  for (const s of input.sources ?? []) {
    const sid = `src:${s.source}`;
    if (!sourceIds.has(sid)) { nodes.push({ id: sid, type: 'source', label: s.source }); sourceIds.set(sid, sid); }
    const signalId = `sig:${s.source}:${s.signal}`;
    nodes.push({ id: signalId, type: 'signal', label: s.signal, value: s.weight });
    edges.push({ from: sid, to: signalId, relation: 'emits', weight: s.weight });
  }

  // Layer 2: competencies (linked from all signals as evidence)
  for (const c of input.competencyScores ?? []) {
    const cid = `comp:${c.competency}`;
    nodes.push({ id: cid, type: 'competency', label: c.competency, value: c.level, meta: { confidence: c.confidence } });
    for (const s of input.sources ?? []) {
      edges.push({ from: `sig:${s.source}:${s.signal}`, to: cid, relation: 'supports', weight: s.weight });
    }
    const scoreId = `score:${c.competency}`;
    nodes.push({ id: scoreId, type: 'score', label: `${c.competency} level`, value: c.level });
    edges.push({ from: cid, to: scoreId, relation: 'scored_as', weight: c.confidence });
  }

  // Layer 3: recommendations
  for (const r of input.recommendations ?? []) {
    const rid = `rec:${r.key}`;
    nodes.push({ id: rid, type: 'recommendation', label: r.key, meta: { rationale: r.rationale } });
    for (const c of input.competencyScores ?? []) edges.push({ from: `score:${c.competency}`, to: rid, relation: 'triggers' });
  }

  return { nodes, edges };
}

export function graphSummary(g: Graph): string {
  const counts: Record<string, number> = {};
  for (const n of g.nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
  return `Graph spans ${g.nodes.length} nodes (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}) connected by ${g.edges.length} edges.`;
}

export async function persistExplainability(pool: Pool, userId: string, decisionKey: string, graph: Graph) {
  try {
    await pool.query(
      `INSERT INTO explainability_chains (user_id, decision_key, graph, summary) VALUES ($1,$2,$3::jsonb,$4)`,
      [userId, decisionKey, JSON.stringify(graph), graphSummary(graph)],
    );
  } catch (e) { console.warn('[explain] persist failed:', (e as Error).message); }
}
