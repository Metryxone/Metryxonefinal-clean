/**
 * Phase 3 — Career Mobility Graph Engine (v3.0.0)
 *
 * Mobility Score = Capability Similarity
 *                + Market Adjacency
 *                + Experience Alignment
 *                + Learning Velocity
 * Each term 0..1; composite 0..1.
 *
 * Reads m3_role_adjacency, m3_transition_probability, m3_career_paths,
 * m3_capability_adjacency_scores. Does NOT overwrite mobility_* (Phase 3 of ACI).
 */
import type { Pool } from 'pg';
export const CAREER_MOBILITY_VERSION = '3.0.0';

const W = { capability: 0.40, market: 0.25, experience: 0.20, learning: 0.15 };
const clip01 = (x: number) => Math.max(0, Math.min(1, x));

export function scoreMobility(c: { capability_similarity: number; market_adjacency: number; experience_alignment?: number; learning_velocity?: number }) {
  const exp = c.experience_alignment ?? 0.6;
  const lv  = c.learning_velocity ?? 0.55;
  const m = W.capability * c.capability_similarity
          + W.market * c.market_adjacency
          + W.experience * exp
          + W.learning * lv;
  return +clip01(m).toFixed(4);
}

export function createCareerMobility(pool: Pool) {
  async function adjacent(roleId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM m3_role_adjacency WHERE from_ontology_role_id = $1 ORDER BY adjacency_score DESC`, [roleId]);
    return rows.map((r: any) => ({
      ...r,
      mobility_score: scoreMobility({
        capability_similarity: Number(r.capability_similarity ?? 0),
        market_adjacency: Number(r.market_adjacency ?? 0),
      }),
    }));
  }

  async function pathsTo(targetRoleId: string, depth = 3) {
    // BFS over adjacency graph, depth-capped, cycle-safe
    const { rows: edges } = await pool.query(`SELECT * FROM m3_role_adjacency`);
    const out: Array<{ path: string[]; score: number; from: string }> = [];
    const sources = Array.from(new Set(edges.map((e: any) => e.from_ontology_role_id)));
    // Per-walk visited set (not per-start) so alternate paths through shared nodes aren't pruned
    for (const start of sources) {
      const queue: Array<{ node: string; path: string[]; visited: Set<string>; score: number }> =
        [{ node: start, path: [start], visited: new Set([start]), score: 1 }];
      while (queue.length) {
        const cur = queue.shift()!;
        if (cur.node === targetRoleId && cur.path.length > 1) {
          out.push({ from: start, path: cur.path, score: +cur.score.toFixed(4) });
          continue;
        }
        if (cur.path.length >= depth + 1) continue;
        for (const e of edges as any[]) {
          if (e.from_ontology_role_id !== cur.node) continue;
          if (cur.visited.has(e.to_ontology_role_id)) continue; // cycle guard per walk
          const adj = Number(e.adjacency_score ?? 0);
          const nextVisited = new Set(cur.visited); nextVisited.add(e.to_ontology_role_id);
          queue.push({ node: e.to_ontology_role_id, path: [...cur.path, e.to_ontology_role_id], visited: nextVisited, score: cur.score * adj });
        }
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 25);
  }

  async function transitions() {
    return (await pool.query(`SELECT * FROM m3_transition_probability ORDER BY probability DESC`)).rows;
  }

  async function careerPaths() {
    return (await pool.query(`SELECT * FROM m3_career_paths ORDER BY popularity DESC`)).rows;
  }

  async function capabilityAdjacency() {
    return (await pool.query(`SELECT * FROM m3_capability_adjacency_scores ORDER BY adjacency DESC`)).rows;
  }

  /** Recommend next moves for a user given current role + capability map. */
  async function recommend(currentRoleId: string, scores: Record<string, number>) {
    const adj = await adjacent(currentRoleId);
    return adj.map(a => {
      const sim = Number(a.capability_similarity ?? 0);
      const userAvg = Object.values(scores).reduce((s, v) => s + v, 0) / Math.max(1, Object.values(scores).length) / 100;
      const composite = scoreMobility({
        capability_similarity: sim,
        market_adjacency: Number(a.market_adjacency ?? 0),
        experience_alignment: clip01(userAvg),
        learning_velocity: 0.55,
      });
      return {
        target_role_id: a.to_ontology_role_id,
        adjacency_score: Number(a.adjacency_score ?? 0),
        mobility_score: composite,
        rationale: a.rationale,
        readiness_label: composite >= 0.75 ? 'ready' : composite >= 0.55 ? 'developing' : 'aspirational',
      };
    }).sort((x, y) => y.mobility_score - x.mobility_score);
  }

  return { adjacent, pathsTo, transitions, careerPaths, capabilityAdjacency, recommend };
}
