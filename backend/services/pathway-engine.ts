/**
 * Phase 3 — Pathway & Maturity Engine.
 *
 * Reads `mobility_development_pathways`, `mobility_learning_sequences`,
 * `mobility_capability_maturity` and projects a sequenced developmental plan
 * personalised to the user's current competency scores.
 *
 * Never asserts hiring outcomes. Output is developmental progression only.
 */

import type { Pool } from 'pg';

export const PATHWAY_VERSION = '3.0.0';

interface PathwayRow {
  id: string; name: string; description: string|null;
  terminal_competency_id: string; total_weeks: number;
  difficulty: string|null; category: string|null;
}
interface SequenceRow {
  position: number; competency_id: string; canonical_name: string;
  action: string; est_weeks: number; resource_type: string|null;
  target_level: number|null;
}
interface MaturityRow {
  level: number; level_name: string; score_anchor: number;
  behavioural_anchors: string[]; est_weeks_from_prior: number;
}

export async function listPathways(pool: Pool) {
  const { rows } = await pool.query<PathwayRow>(
    `SELECT id, name, description, terminal_competency_id, total_weeks, difficulty, category
       FROM mobility_development_pathways ORDER BY category, name`);
  return rows;
}

export async function getMaturity(pool: Pool, competencyId: string): Promise<MaturityRow[]> {
  const { rows } = await pool.query<MaturityRow>(
    `SELECT level, level_name, score_anchor::float AS score_anchor,
            behavioural_anchors, est_weeks_from_prior
       FROM mobility_capability_maturity
      WHERE competency_id = $1
      ORDER BY level`, [competencyId]);
  return rows;
}

function maturityFromScore(levels: MaturityRow[], score: number): { current_level: number; next_level: number|null; progress_to_next: number; level_name: string; gap_to_next: number; } {
  let current = 1;
  for (const l of levels) if (score >= l.score_anchor) current = l.level;
  const cur = levels.find(l => l.level === current);
  const nxt = levels.find(l => l.level === current + 1);
  const progress = nxt && cur
    ? Math.max(0, Math.min(1, (score - cur.score_anchor) / Math.max(0.01, nxt.score_anchor - cur.score_anchor)))
    : 1;
  return {
    current_level: current,
    next_level: nxt?.level ?? null,
    progress_to_next: Math.round(progress * 100) / 100,
    level_name: cur?.level_name ?? 'Foundational',
    gap_to_next: nxt ? Math.round((nxt.score_anchor - score) * 10) / 10 : 0,
  };
}

/**
 * Personalised pathway projection — for a single canonical pathway, project
 * each step against the user's current score for that competency.
 */
export async function personalisedPathway(pool: Pool, params: {
  pathway_id: string; user_scores: Record<string, number>;
}) {
  const { rows: pathRows } = await pool.query<PathwayRow>(
    `SELECT id, name, description, terminal_competency_id, total_weeks, difficulty, category
       FROM mobility_development_pathways WHERE id = $1`, [params.pathway_id]);
  if (!pathRows.length) return null;
  const path = pathRows[0];

  const { rows: seq } = await pool.query<SequenceRow>(
    `SELECT s.position, s.competency_id, c.canonical_name, s.action, s.est_weeks,
            s.resource_type, s.target_level
       FROM mobility_learning_sequences s
       JOIN onto_competencies c ON c.id = s.competency_id
      WHERE s.pathway_id = $1 ORDER BY s.position`, [params.pathway_id]);

  const steps = await Promise.all(seq.map(async s => {
    const score = params.user_scores[s.competency_id];
    const levels = await getMaturity(pool, s.competency_id);
    const mat = typeof score === 'number'
      ? maturityFromScore(levels, score)
      : { current_level: 0, next_level: 1, progress_to_next: 0, level_name: 'Unknown', gap_to_next: 0 };
    const reaches = s.target_level != null && mat.current_level >= s.target_level;
    return {
      position: s.position, competency_id: s.competency_id, canonical_name: s.canonical_name,
      action: s.action, est_weeks: s.est_weeks, resource_type: s.resource_type,
      target_level: s.target_level, user_score: score ?? null,
      current_level: mat.current_level, progress_to_target: reaches ? 1
         : (s.target_level && mat.current_level)
            ? Math.round((mat.current_level / s.target_level) * 100) / 100 : 0,
      status: reaches ? 'achieved' : mat.current_level >= 2 ? 'in_progress' : 'not_started',
    };
  }));

  // Remaining weeks excludes steps already achieved
  const remainingWeeks = steps.filter(s => s.status !== 'achieved').reduce((a, b) => a + b.est_weeks, 0);
  const completedSteps = steps.filter(s => s.status === 'achieved').length;

  return {
    pathway: path,
    steps,
    summary: {
      total_steps: steps.length,
      completed_steps: completedSteps,
      remaining_weeks: remainingWeeks,
      total_weeks: path.total_weeks,
      progress: Math.round((completedSteps / Math.max(1, steps.length)) * 100) / 100,
    },
    version: PATHWAY_VERSION,
  };
}

/** Suggest the best pathways given a user's gap profile. */
export async function suggestPathways(pool: Pool, params: {
  competency_priorities: string[];  // competency_ids ordered by priority
  user_scores: Record<string, number>;
  limit?: number;
}) {
  if (!params.competency_priorities.length) return [];
  const all = await listPathways(pool);
  const ranked = await Promise.all(all.map(async p => {
    const personal = await personalisedPathway(pool, {
      pathway_id: p.id, user_scores: params.user_scores });
    // relevance: how many priorities appear in this pathway
    const compsInPath = new Set(personal?.steps.map(s => s.competency_id) ?? []);
    const matches = params.competency_priorities.filter(c => compsInPath.has(c));
    const score = matches.length / params.competency_priorities.length;
    return { pathway: p, relevance: Math.round(score * 100) / 100,
             matched_priorities: matches, summary: personal?.summary };
  }));
  return ranked.sort((a, b) => b.relevance - a.relevance).slice(0, params.limit ?? 5);
}
