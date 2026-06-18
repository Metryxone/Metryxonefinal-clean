/**
 * Career Recommendation Engine — ranked next-role list.
 * Formula: (readiness × 0.4) + (market × 0.2) + (salary_delta × 0.15) +
 *          (transition_prob × 0.15) + (behaviour_fit × 0.1)
 * Segments: next_step | quick_win | lateral | stretch | pivot
 * Tables: cg_user_recommendations, cg_roles, cg_role_edges
 * Never throws.
 */

import type { Pool } from 'pg';
import type { CgRole, GraphCache, CgEdge } from './career-graph-engine';
import type { ReadinessResult } from './career-readiness-engine';

export type RecSegment = 'next_step' | 'quick_win' | 'lateral' | 'stretch' | 'pivot';

export interface RoleRec {
  role_id: number;
  role_key: string;
  title: string;
  seniority: string;
  function_area: string;
  avg_salary_inr: number | null;
  demand_score: number;
  growth_30mo: number;
  segment: RecSegment;
  rec_score: number;
  readiness_score: number | null;
  market_score: number;
  salary_delta_pct: number | null;
  transition_probability: number;
  behaviour_fit: number;
  avg_months_transition: number;
  edge_type: string;
  confidence: number;
}

export interface RecBundle {
  user_id: string;
  current_role_id: number | null;
  next_steps: RoleRec[];
  quick_wins: RoleRec[];
  laterals: RoleRec[];
  stretch_goals: RoleRec[];
  pivots: RoleRec[];
  generated_at: string;
  confidence: number;
  data_sources: string[];
}

function computeSegment(
  e: CgEdge,
  readinessScore: number,
  hopsAway: number
): RecSegment {
  if (e.edge_type === 'pivot')   return 'pivot';
  if (e.edge_type === 'lateral') return 'lateral';
  if (hopsAway >= 2 || e.edge_type === 'stretch') return 'stretch';
  if (readinessScore >= 70)      return 'quick_win';
  return 'next_step';
}

function salaryDeltaPct(current: CgRole | null, target: CgRole): number | null {
  if (!current?.avg_salary_inr || !target.avg_salary_inr) return null;
  return Math.round(((target.avg_salary_inr - current.avg_salary_inr) / current.avg_salary_inr) * 100);
}

export async function generateRecommendations(
  pool: Pool,
  userId: string,
  currentRole: CgRole | null,
  g: GraphCache,
  readinessMap: Map<number, ReadinessResult>,
  behaviourFitDefault = 0.5
): Promise<RecBundle> {
  const empty: RecBundle = {
    user_id: userId, current_role_id: currentRole?.id ?? null,
    next_steps: [], quick_wins: [], laterals: [], stretch_goals: [], pivots: [],
    generated_at: new Date().toISOString(), confidence: 0.2, data_sources: [],
  };
  try {
    if (!currentRole) return empty;

    // Collect reachable edges up to 3 hops
    const directEdges = g.adjacency.get(currentRole.id) ?? [];
    const hop1Ids = new Set(directEdges.map(e => e.to_role_id));

    // 2-hop: edges from 1-hop neighbours not already reached
    const hop2Edges: CgEdge[] = [];
    for (const id of hop1Ids) {
      for (const e of g.adjacency.get(id) ?? []) {
        if (!hop1Ids.has(e.to_role_id) && e.to_role_id !== currentRole.id) {
          hop2Edges.push({ ...e });
        }
      }
    }
    const hop2Ids = new Set(hop2Edges.map(e => e.to_role_id));

    // 3-hop: edges from 2-hop neighbours not reached at hops 1 or 2
    const hop3Edges: CgEdge[] = [];
    for (const id of hop2Ids) {
      for (const e of g.adjacency.get(id) ?? []) {
        if (!hop1Ids.has(e.to_role_id) && !hop2Ids.has(e.to_role_id) && e.to_role_id !== currentRole.id) {
          hop3Edges.push({ ...e });
        }
      }
    }

    const allEdges = [...directEdges, ...hop2Edges, ...hop3Edges];
    const seen = new Set<number>();
    const recs: RoleRec[] = [];

    for (const edge of allEdges) {
      const roleId = edge.to_role_id;
      if (seen.has(roleId) || roleId === currentRole.id) continue;
      seen.add(roleId);

      const role = g.roles.get(roleId);
      if (!role || !role.is_active) continue;

      const readiness = readinessMap.get(roleId);
      const readinessScore = readiness?.readiness_score ?? null;
      const normReadiness = (readinessScore ?? 50) / 100;
      const marketScore = role.demand_score;
      const normMarket = marketScore / 100;
      const salaryDelta = salaryDeltaPct(currentRole, role);
      const normSalary = salaryDelta !== null ? Math.min(Math.max(salaryDelta / 100, -0.5), 0.5) + 0.5 : 0.5;
      const transProb = edge.transition_probability;
      const behaviourFit = behaviourFitDefault;

      const recScore =
        (normReadiness  * 0.40) +
        (normMarket     * 0.20) +
        (normSalary     * 0.15) +
        (transProb      * 0.15) +
        (behaviourFit   * 0.10);

      const hopsAway = directEdges.some(e => e.to_role_id === roleId) ? 1
                     : hop2Edges.some(e  => e.to_role_id === roleId)  ? 2
                     : 3;
      const segment = computeSegment(edge, readinessScore ?? 0, hopsAway);

      recs.push({
        role_id: roleId, role_key: role.role_key, title: role.title,
        seniority: role.seniority, function_area: role.function_area,
        avg_salary_inr: role.avg_salary_inr,
        demand_score: role.demand_score, growth_30mo: role.growth_30mo,
        segment, rec_score: Math.round(recScore * 1000) / 1000,
        readiness_score: readinessScore, market_score: marketScore,
        salary_delta_pct: salaryDelta, transition_probability: transProb,
        behaviour_fit: behaviourFit, avg_months_transition: edge.avg_months_transition,
        edge_type: edge.edge_type, confidence: readiness ? readiness.confidence : 0.3,
      });
    }

    // Sort by rec_score desc within each segment, top 5 per segment
    recs.sort((a, b) => b.rec_score - a.rec_score);
    const bySegment = (seg: RecSegment) => recs.filter(r => r.segment === seg).slice(0, 5);

    const bundle: RecBundle = {
      user_id: userId, current_role_id: currentRole.id,
      next_steps:    bySegment('next_step'),
      quick_wins:    bySegment('quick_win'),
      laterals:      bySegment('lateral'),
      stretch_goals: bySegment('stretch'),
      pivots:        bySegment('pivot'),
      generated_at: new Date().toISOString(),
      confidence: recs.length > 0 ? 0.65 : 0.2,
      data_sources: ['cg_roles', 'cg_role_edges', ...(readinessMap.size > 0 ? ['cg_user_role_readiness'] : [])],
    };

    // Persist top recs
    await persistRecs(pool, userId, recs.slice(0, 20)).catch(() => {});
    return bundle;
  } catch { return empty; }
}

async function persistRecs(pool: Pool, userId: string, recs: RoleRec[]): Promise<void> {
  for (const r of recs) {
    await pool.query(
      `INSERT INTO cg_user_recommendations
         (user_id, role_id, segment, rec_score, readiness_score, market_score,
          salary_delta_pct, transition_prob, behaviour_fit, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT(user_id, role_id)
       DO UPDATE SET segment=$3, rec_score=$4, readiness_score=$5, market_score=$6,
         salary_delta_pct=$7, transition_prob=$8, behaviour_fit=$9, generated_at=NOW()`,
      [userId, r.role_id, r.segment, r.rec_score, r.readiness_score,
       r.market_score, r.salary_delta_pct, r.transition_probability, r.behaviour_fit]
    ).catch(() => {});
  }
}
