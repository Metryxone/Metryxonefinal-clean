/**
 * Trajectory Engine — Phase 5
 *
 * Projects an employability trajectory toward a target occupation. Pure,
 * deterministic, evidence-backed:
 *   - current_ei_score from existing snapshot (or supplied input)
 *   - projected_ei_score from role-fit recommendations' expected_delta sums
 *   - milestones built from the sorted recommendations + typical_years from
 *     occupation_pathways when a progression edge exists
 *   - blocker_skills enumerated from missing_essential
 *
 * No randomness. No ML. The math used for projection is exactly the math
 * used for current scoring — same ruleset, same dimensions.
 */

import type { Pool } from 'pg';
import { computeRoleFit, type RoleFitOutput } from './role-fit-engine';
import type { ResolverOutput } from './ei-resolver';

export interface TrajectoryInput {
  user_id:           string;
  current_ei_score:  number;
  target_occupation_id: string;
  resolution:        ResolverOutput;
  experience_count?: number;
  time_horizon_months: number;        // 1..60
  region?:           string;
  ruleset_version?:  string | null;
}

export interface TrajectoryMilestone {
  month:           number;
  action:          string;
  target:          string;
  expected_delta:  number;
  evidence_ref:    Record<string, unknown>;
}

export interface TrajectoryOutput {
  user_id:                   string;
  target_occupation_id:      string;
  target_occupation_title:   string;
  current_ei_score:          number;
  projected_ei_score:        number;
  time_horizon_months:       number;
  milestones:                TrajectoryMilestone[];
  blocker_skills:            Array<{ skill_id: string; canonical_name: string; importance: 'essential' | 'important'; impact_score: number }>;
  high_impact_recommendations: RoleFitOutput['recommendations'];
  current_fit:               RoleFitOutput;
  pathway_context:           Array<{ from: string; to: string; typical_years_min: number | null; typical_years_max: number | null; common_gaps: unknown }>;
  trace:                     Array<{ key: string; formula: string; inputs: any; contribution: number }>;
  ei_version:                string;
  ruleset_version:           string | null;
  occupation_dataset_version: string;
}

export async function forecastTrajectory(pool: Pool, input: TrajectoryInput): Promise<TrajectoryOutput> {
  if (!input.ruleset_version) {
    throw new Error('forecastTrajectory: ruleset_version is required for reproducibility');
  }
  const horizon = Math.min(Math.max(input.time_horizon_months || 12, 1), 60);

  // 1) Current role-fit (this is the engine that knows the gaps)
  const current = await computeRoleFit(pool, {
    user_id: input.user_id,
    occupation_id: input.target_occupation_id,
    resolution: input.resolution,
    experience_count: input.experience_count,
    region: input.region,
    ruleset_version: input.ruleset_version,
  });

  // 2) Pathway context (any progression edges that land at the target)
  const pathways = await pool.query(
    `SELECT f.canonical_title AS "from", t.canonical_title AS "to",
            op.typical_years_min::float, op.typical_years_max::float, op.common_gaps
       FROM occupation_pathways op
       JOIN occupations f ON f.id = op.from_occupation_id
       JOIN occupations t ON t.id = op.to_occupation_id
      WHERE op.is_active AND op.to_occupation_id = $1
      ORDER BY op.typical_years_min ASC NULLS LAST`,
    [input.target_occupation_id],
  );

  // 3) Sort recommendations by impact, schedule into the horizon.
  // Stable tiebreaker on target name so milestone order is deterministic.
  const recs = [...current.recommendations].sort((a, b) =>
    b.expected_delta - a.expected_delta || a.target.localeCompare(b.target));
  // schedule one milestone every (horizon / count) months, rounded.
  const slot = Math.max(1, Math.floor(horizon / Math.max(recs.length, 1)));
  const milestones: TrajectoryMilestone[] = recs.map((r, i) => ({
    month: Math.min(horizon, (i + 1) * slot),
    action: r.type === 'add_skill' ? `Add skill: ${r.target}` :
            r.type === 'add_certification' ? `Earn certification: ${r.target}` :
            `Gain experience: ${r.target}`,
    target: r.target,
    expected_delta: r.expected_delta,
    evidence_ref: r.evidence_ref,
  }));

  // 4) Projected score — capped at 100. Recs are additive on top of the
  // current capability dimension contribution (skill/cert/qual).
  const totalDelta = recs.reduce((a, r) => a + r.expected_delta, 0);
  // Convert role-fit deltas (out of 100 fit) into EI delta — scaled by ratio
  // of current_ei_score / current.fit_score (so a 1pt fit gain ≈ ratio pts EI).
  const ratio = current.fit_score > 0 ? input.current_ei_score / current.fit_score : 1;
  const projectedDelta = totalDelta * ratio;
  const projected = Math.max(input.current_ei_score, Math.min(100, Math.round((input.current_ei_score + projectedDelta) * 100) / 100));

  // 5) Blocker skills = missing essentials (weighted by impact)
  const blockers = current.missing_essential.map(m => ({
    skill_id: m.skill_id, canonical_name: m.canonical_name,
    importance: 'essential' as const,
    impact_score: Number(((m.weight / Math.max(current.matched_skills.length + current.missing_essential.length + current.missing_important.length, 1)) * 100).toFixed(2)),
  }));

  // 6) Trace
  const trace = [
    { key: 'role_fit_basis',
      formula: 'computeRoleFit(target)',
      inputs: { occupation_id: input.target_occupation_id, current_fit_score: current.fit_score },
      contribution: current.fit_score },
    { key: 'recommendation_aggregate',
      formula: 'sum(expected_delta) * (current_ei / current_fit)',
      inputs: { rec_count: recs.length, total_delta: Number(totalDelta.toFixed(2)), ratio: Number(ratio.toFixed(3)) },
      contribution: Number(projectedDelta.toFixed(2)) },
    { key: 'horizon_schedule',
      formula: 'milestone_month = (index+1) * floor(horizon/count)',
      inputs: { horizon, count: recs.length, slot },
      contribution: milestones.length },
  ];

  const out: TrajectoryOutput = {
    user_id: input.user_id,
    target_occupation_id: input.target_occupation_id,
    target_occupation_title: current.occupation_title,
    current_ei_score: input.current_ei_score,
    projected_ei_score: projected,
    time_horizon_months: horizon,
    milestones, blocker_skills: blockers,
    high_impact_recommendations: recs,
    current_fit: current,
    pathway_context: pathways.rows,
    trace,
    ei_version: current.ei_version,
    ruleset_version: input.ruleset_version || null,
    occupation_dataset_version: current.occupation_dataset_version,
  };

  // 7) Persist non-blocking
  pool.query(
    `INSERT INTO trajectory_forecasts
       (user_id, target_occupation_id, current_ei_score, projected_ei_score,
        time_horizon_months, milestones, blocker_skills, high_impact_recommendations,
        trace, ei_version, ruleset_version, occupation_dataset_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'4.0',$10,$11)`,
    [
      input.user_id, input.target_occupation_id, input.current_ei_score, projected, horizon,
      JSON.stringify(milestones), JSON.stringify(blockers), JSON.stringify(recs),
      JSON.stringify(trace), input.ruleset_version || null, current.occupation_dataset_version,
    ],
  ).catch(err => console.warn('[trajectory] persist failed (non-blocking)', err.message));

  return out;
}
