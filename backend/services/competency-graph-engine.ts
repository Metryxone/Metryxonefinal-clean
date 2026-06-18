/**
 * Competency Graph Engine — Dependency Intelligence
 * Phase 2 Scientific Competency Intelligence (v2.0.0)
 * Read-only over sci_competency_relationships + influence_weights + evolution_paths.
 * Iterative BFS with depth cap — never recursive SQL.
 */
import type { Pool } from 'pg';

export const COMPETENCY_GRAPH_VERSION = '2.0.0';

export type RelationshipType =
  | 'prerequisite' | 'amplification' | 'dependency' | 'acceleration'
  | 'leadership_progression' | 'strategic_maturity';

export interface Edge {
  id: string;
  source_competency_id: string;
  target_competency_id: string;
  relationship_type: RelationshipType;
  strength: number;
  evidence_basis: string | null;
  bidirectional: boolean;
}

export function createCompetencyGraphEngine(pool: Pool) {
  // ── Cache adjacency once per request burst (60s)
  let cachedEdges: { rows: Edge[]; t: number } | null = null;
  async function allEdges(): Promise<Edge[]> {
    if (cachedEdges && Date.now() - cachedEdges.t < 60_000) return cachedEdges.rows;
    const { rows } = await pool.query(
      `SELECT id, source_competency_id, target_competency_id, relationship_type,
              strength::float AS strength, evidence_basis, bidirectional
         FROM sci_competency_relationships
        WHERE deleted_at IS NULL`
    );
    cachedEdges = { rows, t: Date.now() };
    return rows;
  }

  async function neighbours(competencyId: string, dir: 'out' | 'in' = 'out') {
    const edges = await allEdges();
    return edges.filter(e =>
      (dir === 'out' && (e.source_competency_id === competencyId || (e.bidirectional && e.target_competency_id === competencyId))) ||
      (dir === 'in'  && (e.target_competency_id === competencyId || (e.bidirectional && e.source_competency_id === competencyId)))
    );
  }

  /**
   * Iterative BFS over the dependency graph, depth-capped.
   * Returns ALL paths up to maxDepth from origin → terminal.
   */
  async function traversePaths(origin: string, terminal: string, maxDepth = 5) {
    const edges = await allEdges();
    const adj = new Map<string, Edge[]>();
    edges.forEach(e => {
      const list = adj.get(e.source_competency_id) || [];
      list.push(e);
      adj.set(e.source_competency_id, list);
      if (e.bidirectional) {
        const rev = adj.get(e.target_competency_id) || [];
        rev.push({ ...e, source_competency_id: e.target_competency_id, target_competency_id: e.source_competency_id });
        adj.set(e.target_competency_id, rev);
      }
    });

    const results: Array<{ path: string[]; edges: Edge[]; cumulative_strength: number }> = [];
    type Frame = { node: string; path: string[]; edges: Edge[]; product: number };
    const queue: Frame[] = [{ node: origin, path: [origin], edges: [], product: 1 }];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.path.length > maxDepth + 1) continue;
      if (cur.node === terminal && cur.path.length > 1) {
        results.push({ path: cur.path, edges: cur.edges, cumulative_strength: +cur.product.toFixed(4) });
        continue;
      }
      const out = adj.get(cur.node) || [];
      for (const e of out) {
        if (cur.path.includes(e.target_competency_id)) continue; // no cycles
        queue.push({
          node: e.target_competency_id,
          path: [...cur.path, e.target_competency_id],
          edges: [...cur.edges, e],
          product: cur.product * e.strength,
        });
      }
    }
    return results.sort((a, b) => b.cumulative_strength - a.cumulative_strength);
  }

  /** Influence-weighted score lift estimate when a source competency is developed. */
  async function influenceLift(scores: Record<string, number>) {
    const { rows } = await pool.query(
      `SELECT competency_id, influences_competency_id, weight::float AS weight
         FROM sci_competency_influence_weights`
    );
    const lifts: Record<string, { from: string; weight: number; contribution: number }[]> = {};
    for (const r of rows) {
      const srcScore = scores[r.competency_id];
      if (typeof srcScore !== 'number') continue;
      const contribution = +(srcScore * r.weight * 0.01).toFixed(3);
      (lifts[r.influences_competency_id] ||= []).push({
        from: r.competency_id, weight: r.weight, contribution,
      });
    }
    return lifts;
  }

  /**
   * Intervention sequencing — given current scores + a target competency,
   * return ranked development order using prerequisites + influence weight.
   */
  async function sequenceInterventions(targetCompetencyId: string, currentScores: Record<string, number>, maxSteps = 5) {
    const edges = await allEdges();
    const incoming = edges.filter(e =>
      e.target_competency_id === targetCompetencyId &&
      ['prerequisite', 'dependency', 'amplification', 'acceleration'].includes(e.relationship_type)
    );
    const ranked = incoming
      .map(e => {
        const cur = currentScores[e.source_competency_id] ?? 0;
        const gap = Math.max(0, 70 - cur); // assume Proficient (70) target
        const priority = +(gap * e.strength).toFixed(2);
        return {
          competency_id: e.source_competency_id,
          relationship_type: e.relationship_type,
          edge_strength: e.strength,
          current_score: cur,
          recommended_target: 70,
          priority,
          rationale: `Develop ${e.source_competency_id} (${e.relationship_type}, strength ${e.strength}) to unlock ${targetCompetencyId}`,
        };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxSteps);
    return ranked;
  }

  async function listEvolutionPaths(targetRoleId?: string) {
    const { rows } = await pool.query(
      `SELECT id, name, description, ordered_competencies, target_role_id
         FROM sci_capability_evolution_paths
        ${targetRoleId ? 'WHERE target_role_id = $1' : ''}
        ORDER BY name`,
      targetRoleId ? [targetRoleId] : []
    );
    return rows;
  }

  /** Adjacent competencies (1-hop neighbours, both directions). */
  async function adjacent(competencyId: string) {
    const [out, inc] = await Promise.all([neighbours(competencyId, 'out'), neighbours(competencyId, 'in')]);
    return {
      outgoing: out.map(e => ({ competency_id: e.target_competency_id, type: e.relationship_type, strength: e.strength })),
      incoming: inc.map(e => ({ competency_id: e.source_competency_id, type: e.relationship_type, strength: e.strength })),
    };
  }

  return { allEdges, neighbours, traversePaths, influenceLift, sequenceInterventions, listEvolutionPaths, adjacent };
}
