/**
 * Phase 4 — Sequential Dependency Engine.
 *
 * Takes a set of candidate competencies and orders them by prerequisite
 * dependencies before recommendation ranking. Uses Kahn's algorithm
 * (topological sort) over `learn_dependencies` + user current levels.
 *
 * Pure algorithms exported for tests. DB loader fetches edges + user levels.
 *
 * Cycle policy: detected cycles are broken by dropping the weakest edge
 * in the cycle (lowest dependency_strength) and emitting a warning — the
 * sequencer NEVER throws.
 *
 * Language policy: developmental sequencing · capability scaffolding.
 */

import type { Pool } from 'pg';

export const DEPENDENCY_SEQUENCER_VERSION = '4.0.0';

export interface DependencyEdge {
  prereq_competency_id: string;
  unlocks_competency_id: string;
  dependency_strength: number;
  min_prereq_level: number;
}

export interface SequenceItem {
  competency_id: string;
  position: number;                 // 1-indexed
  is_ready_now: boolean;            // true when prereqs already satisfied at user's current level
  blocking_prereqs: string[];       // unmet prereqs (empty when ready)
  scaffold_depth: number;           // how many steps deep in the chain
}

export interface SequenceResult {
  ordered: SequenceItem[];
  cycles_broken: Array<{ dropped_edge: DependencyEdge; cycle: string[] }>;
  warnings: string[];
}

// ── pure algorithm ────────────────────────────────────────────────────────

export function sequenceCompetencies(
  candidateIds: string[],
  edges: DependencyEdge[],
  userLevels: Record<string, number> = {},
): SequenceResult {
  const cand = new Set(candidateIds);
  // Restrict edges to those entirely within the candidate set
  const relevant = edges.filter(e => cand.has(e.prereq_competency_id) && cand.has(e.unlocks_competency_id));

  // Build mutable graph
  const incoming = new Map<string, DependencyEdge[]>();
  const outgoing = new Map<string, DependencyEdge[]>();
  for (const id of candidateIds) { incoming.set(id, []); outgoing.set(id, []); }
  for (const e of relevant) {
    incoming.get(e.unlocks_competency_id)!.push(e);
    outgoing.get(e.prereq_competency_id)!.push(e);
  }

  const cycles_broken: SequenceResult['cycles_broken'] = [];
  const warnings: string[] = [];
  let activeEdges = relevant.slice();

  // Cycle-breaking loop: while a topo sort cannot complete, drop the weakest
  // edge in a discovered cycle and retry. We rebuild incoming/outgoing each
  // iteration from `activeEdges` so kahnSort can mutate freely.
  let attempts = 0;
  let result: SequenceItem[] = [];
  while (attempts++ < 50) {
    const inc = rebuildIncoming(candidateIds, activeEdges);
    const out = rebuildOutgoing(candidateIds, activeEdges);
    // Pass a copy to kahnSort so the mutation doesn't destroy our reference
    const sortResult = kahnSort(candidateIds, cloneEdgeMap(inc));
    if (sortResult.ok) {
      // buildItems needs the UNMUTATED incoming map (rebuilt fresh above)
      result = buildItems(sortResult.order, rebuildIncoming(candidateIds, activeEdges), userLevels);
      break;
    }
    // Cycle detected — find one cycle and remove the weakest edge.
    const cycle = findCycle(sortResult.remaining, rebuildIncoming(candidateIds, activeEdges));
    if (!cycle.length) {
      warnings.push('topological sort failed but no cycle isolable — emitting candidate order');
      result = buildItems(candidateIds.slice(),
        rebuildIncoming(candidateIds, activeEdges), userLevels);
      break;
    }
    // findCycle walks via `incoming`, so cycle is in [target, prereq, prereq2…]
    // order. Reverse it so consecutive pairs match forward edges (prereq→unlocks).
    const fwdCycle = cycle.slice().reverse();
    const cycleEdges: DependencyEdge[] = [];
    for (let i = 0; i < fwdCycle.length; i++) {
      const from = fwdCycle[i]; const to = fwdCycle[(i + 1) % fwdCycle.length];
      const edge = out.get(from)?.find(e => e.unlocks_competency_id === to);
      if (edge) cycleEdges.push(edge);
    }
    if (!cycleEdges.length) break;
    cycleEdges.sort((a, b) => a.dependency_strength - b.dependency_strength);
    const drop = cycleEdges[0];
    cycles_broken.push({ dropped_edge: drop, cycle });
    warnings.push(`Broke cycle by dropping ${drop.prereq_competency_id} → ${drop.unlocks_competency_id}`);
    activeEdges = activeEdges.filter(e => e !== drop);
  }

  return { ordered: result, cycles_broken, warnings };
}

function rebuildIncoming(ids: string[], edges: DependencyEdge[]): Map<string, DependencyEdge[]> {
  const m = new Map<string, DependencyEdge[]>();
  for (const id of ids) m.set(id, []);
  for (const e of edges) m.get(e.unlocks_competency_id)?.push(e);
  return m;
}
function rebuildOutgoing(ids: string[], edges: DependencyEdge[]): Map<string, DependencyEdge[]> {
  const m = new Map<string, DependencyEdge[]>();
  for (const id of ids) m.set(id, []);
  for (const e of edges) m.get(e.prereq_competency_id)?.push(e);
  return m;
}
function cloneEdgeMap(m: Map<string, DependencyEdge[]>): Map<string, DependencyEdge[]> {
  const c = new Map<string, DependencyEdge[]>();
  for (const [k, v] of m) c.set(k, v.slice());
  return c;
}

function kahnSort(
  ids: string[], incoming: Map<string, DependencyEdge[]>,
): { ok: true; order: string[] } | { ok: false; remaining: string[] } {
  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, incoming.get(id)!.length);
  // Stable: pick smallest id among indeg=0 to keep results deterministic
  const ready = ids.filter(id => indeg.get(id) === 0).sort();
  const order: string[] = [];
  const remaining = new Set(ids);
  while (ready.length) {
    const cur = ready.shift()!;
    order.push(cur); remaining.delete(cur);
    for (const id of ids) {
      const inc = incoming.get(id)!;
      const before = inc.length;
      const filtered = inc.filter(e => e.prereq_competency_id !== cur);
      if (filtered.length !== before) {
        incoming.set(id, filtered);
        const d = (indeg.get(id) ?? 0) - (before - filtered.length);
        indeg.set(id, d);
        if (d === 0 && remaining.has(id)) {
          ready.push(id); ready.sort();
        }
      }
    }
  }
  if (order.length === ids.length) return { ok: true, order };
  return { ok: false, remaining: Array.from(remaining) };
}

function findCycle(
  nodes: string[], incoming: Map<string, DependencyEdge[]>,
): string[] {
  // Simple DFS to surface one cycle
  const stack: string[] = [];
  const onStack = new Set<string>();
  const visited = new Set<string>();
  let cycle: string[] = [];
  const dfs = (n: string): boolean => {
    if (onStack.has(n)) {
      const i = stack.indexOf(n);
      cycle = stack.slice(i);
      return true;
    }
    if (visited.has(n)) return false;
    visited.add(n); onStack.add(n); stack.push(n);
    for (const e of (incoming.get(n) ?? [])) {
      if (dfs(e.prereq_competency_id)) return true;
    }
    stack.pop(); onStack.delete(n);
    return false;
  };
  for (const n of nodes) if (dfs(n)) break;
  return cycle;
}

function buildItems(
  order: string[],
  incoming: Map<string, DependencyEdge[]>,
  userLevels: Record<string, number>,
): SequenceItem[] {
  // scaffold_depth = longest path from a root to this node
  const depth = new Map<string, number>();
  for (const id of order) {
    const inc = incoming.get(id) ?? [];
    if (!inc.length) { depth.set(id, 0); continue; }
    let max = 0;
    for (const e of inc) max = Math.max(max, (depth.get(e.prereq_competency_id) ?? 0) + 1);
    depth.set(id, max);
  }
  return order.map((id, i) => {
    const inc = incoming.get(id) ?? [];
    const unmet = inc.filter(e => (userLevels[e.prereq_competency_id] ?? 0) < e.min_prereq_level)
                     .map(e => e.prereq_competency_id);
    return {
      competency_id: id,
      position: i + 1,
      is_ready_now: unmet.length === 0,
      blocking_prereqs: unmet,
      scaffold_depth: depth.get(id) ?? 0,
    };
  });
}

// ── DB loader ──────────────────────────────────────────────────────────────

export async function loadDependencies(
  pool: Pool, competencyIds: string[],
): Promise<DependencyEdge[]> {
  if (!competencyIds.length) return [];
  const { rows } = await pool.query<DependencyEdge>(`
    SELECT prereq_competency_id, unlocks_competency_id,
           dependency_strength::float AS dependency_strength,
           min_prereq_level
      FROM learn_dependencies
     WHERE prereq_competency_id = ANY($1::text[])
        OR unlocks_competency_id = ANY($1::text[])
  `, [competencyIds]);
  return rows;
}

/** Convenience: score-to-level mapping (mirrors longitudinal-engine thresholds). */
export function scoreToLevel(score: number): number {
  if (score >= 92) return 5;
  if (score >= 80) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  return 1;
}
