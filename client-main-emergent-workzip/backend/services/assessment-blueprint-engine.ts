/**
 * Assessment Blueprint Engine (Phase 2 V2, additive).
 *
 * Pure-function blueprint generator + DB upserter. Consumes a Role DNA
 * envelope (output of role-dna-generator / competency-resolution-engine)
 * and produces a runtime-ready assessment blueprint: per-competency
 * question counts, depth bands, pool selections, branching rule attachments.
 *
 * Does NOT mutate competency-runtime-v2 tables or any legacy tables.
 */
import type { Pool } from 'pg';

export const ASSESSMENT_BLUEPRINT_VERSION = '2.0.0';

export type CompetencyWeights = Record<string, number>;
export type CompetencyLevels  = Record<string, number>;

export type BlueprintInput = {
  roleDnaId?: string | null;
  runtimeContextId?: string | null;
  weights: CompetencyWeights;
  expectedLevels: CompetencyLevels;
  intensity?: number;
  industry?: string | null;
  layer?: string | null;
};

export type BlueprintCompetencyPlan = {
  competency_code: string;
  importance_weight: number;
  expected_level: number;
  depth_band: 'shallow' | 'standard' | 'deep';
  question_count_planned: number;
  pool_keys: string[];
  branching_rule_keys: string[];
};

export type BlueprintEnvelope = {
  blueprint_name: string;
  blueprint_version: string;
  total_competencies: number;
  total_questions_planned: number;
  estimated_duration_min: number;
  intensity: number;
  difficulty_band: 'easy' | 'medium' | 'hard';
  branching_enabled: boolean;
  simulation_required: boolean;
  behavioral_probes_enabled: boolean;
  competencies: BlueprintCompetencyPlan[];
  spec: Record<string, unknown>;
  explainability: {
    why_blueprint: string;
    why_question_counts: string;
    why_depth: string;
    why_branching: string;
    methodology_version: string;
  };
};

const BASE_QUESTIONS = 6;
const MAX_QUESTIONS = 14;

export function generateBlueprint(input: BlueprintInput): BlueprintEnvelope {
  const intensity = Math.max(0.3, Math.min(1.0, input.intensity ?? 0.55));
  const codes = Object.keys(input.weights);
  const layer = (input.layer ?? '').toLowerCase();
  const industry = (input.industry ?? '').toLowerCase();

  const overallDifficulty: BlueprintEnvelope['difficulty_band'] =
    intensity >= 0.75 ? 'hard' : intensity >= 0.5 ? 'medium' : 'easy';

  const simulationRequired = layer.includes('exec') || layer.includes('leadership') || industry === 'ai_ml';

  const competencies: BlueprintCompetencyPlan[] = codes.map((code) => {
    const w = input.weights[code] ?? 0;
    const lvl = input.expectedLevels[code] ?? 60;
    // Question budget = base + scaled weight; intensity multiplies. L1 sum constraints not enforced — additive.
    const planned = Math.round(
      Math.min(
        MAX_QUESTIONS,
        Math.max(2, BASE_QUESTIONS * (0.6 + w * 4) * (0.7 + intensity * 0.6)),
      ),
    );
    const depth: BlueprintCompetencyPlan['depth_band'] =
      lvl >= 75 ? 'deep' : lvl >= 55 ? 'standard' : 'shallow';
    const poolKey = pickPoolKey(code, overallDifficulty, depth);
    const branchKeys: string[] = [];
    branchKeys.push('low_conf_global', 'contradict_global', 'escalate_high_conf');
    if (code === 'LEA') branchKeys.push('expand_depth_lea');
    if (code === 'EIQ') branchKeys.push('behav_probe_eiq');
    return {
      competency_code: code,
      importance_weight: +w.toFixed(4),
      expected_level: +lvl.toFixed(2),
      depth_band: depth,
      question_count_planned: planned,
      pool_keys: [poolKey],
      branching_rule_keys: branchKeys,
    };
  });

  const totalQs = competencies.reduce((s, c) => s + c.question_count_planned, 0);
  const estDurationMin = Math.round(totalQs * 1.2);

  return {
    blueprint_name: `bp:${layer || 'any'}:${industry || 'any'}:${overallDifficulty}`,
    blueprint_version: ASSESSMENT_BLUEPRINT_VERSION,
    total_competencies: competencies.length,
    total_questions_planned: totalQs,
    estimated_duration_min: estDurationMin,
    intensity: +intensity.toFixed(2),
    difficulty_band: overallDifficulty,
    branching_enabled: true,
    simulation_required: simulationRequired,
    behavioral_probes_enabled: true,
    competencies,
    spec: { generator: 'assessment-blueprint-engine', generator_version: ASSESSMENT_BLUEPRINT_VERSION },
    explainability: {
      why_blueprint: `Generated for layer=${layer || 'any'} industry=${industry || 'any'} intensity=${intensity.toFixed(2)} → difficulty=${overallDifficulty}.`,
      why_question_counts: `Per-competency counts scale with importance weight (base ${BASE_QUESTIONS}, capped at ${MAX_QUESTIONS}) and runtime intensity.`,
      why_depth: `Depth band: deep if expected_level ≥ 75, shallow if < 55, otherwise standard.`,
      why_branching: `Global low-confidence / contradiction / escalation rules attached to every competency. LEA gains depth-expand, EIQ gains behavioural probe.`,
      methodology_version: ASSESSMENT_BLUEPRINT_VERSION,
    },
  };
}

function pickPoolKey(code: string, diff: string, depth: string): string {
  const c = code.toLowerCase();
  if (c === 'lea' && depth === 'deep') return 'lea_scen_hi';
  const candidates: Record<string, string> = {
    cog: 'cog_mcq_med',
    com: 'com_sjt_med',
    lea: 'lea_scen_hi',
    exe: 'exe_case_med',
    adp: 'adp_sjt_med',
    tec: 'tec_mcq_med',
    eiq: 'eiq_behav_med',
  };
  void diff;
  return candidates[c] ?? `${c}_mcq_med`;
}

export async function persistBlueprint(
  pool: Pool,
  bp: BlueprintEnvelope,
  ctx: { roleDnaId?: string | null; runtimeContextId?: string | null },
): Promise<string> {
  const ins = await pool.query<{ id: string }>(
    `
    INSERT INTO assessment_blueprints_v2
      (role_dna_id, runtime_context_id, blueprint_name, blueprint_version,
       total_competencies, total_questions_planned, estimated_duration_min,
       intensity, difficulty_band, branching_enabled, simulation_required,
       behavioral_probes_enabled, blueprint_spec, explainability)
    VALUES
      ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13::jsonb, $14::jsonb)
    RETURNING id
    `,
    [
      ctx.roleDnaId ?? null, ctx.runtimeContextId ?? null,
      bp.blueprint_name, bp.blueprint_version,
      bp.total_competencies, bp.total_questions_planned, bp.estimated_duration_min,
      bp.intensity, bp.difficulty_band, bp.branching_enabled, bp.simulation_required,
      bp.behavioral_probes_enabled, JSON.stringify(bp.spec), JSON.stringify(bp.explainability),
    ],
  );
  const blueprintId = ins.rows[0].id;

  for (const c of bp.competencies) {
    await pool.query(
      `
      INSERT INTO assessment_blueprint_competencies
        (blueprint_id, competency_code, importance_weight, expected_level,
         depth_band, question_count_planned, pool_ids, branching_rule_ids)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      `,
      [
        blueprintId, c.competency_code, c.importance_weight, c.expected_level,
        c.depth_band, c.question_count_planned,
        JSON.stringify(c.pool_keys), JSON.stringify(c.branching_rule_keys),
      ],
    );
  }
  return blueprintId;
}
