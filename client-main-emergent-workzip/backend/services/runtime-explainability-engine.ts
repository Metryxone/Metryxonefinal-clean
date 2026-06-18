/**
 * Runtime Explainability Engine (V2)
 *
 * Produces a uniform explainability envelope for the V2 competency
 * runtime. The envelope is consumed by the V2 routes and surfaced
 * directly to the UI (AssessmentTab preview, dashboards, audit logs).
 *
 * Pure: takes the resolution inputs/outputs and returns a structured
 * "why" payload. No IO.
 */

export const RUNTIME_EXPLAINABILITY_VERSION = '2.0.0';

export interface ExplainabilityInput {
  context: {
    role_id?: string | null;
    layer_id?: string | null;
    industry_id?: string | null;
    complexity_model_id?: string | null;
    org_maturity?: string | null;
    seniority_band?: string | null;
    geography?: string | null;
  };
  dna: {
    dna_name?: string;
    default_weightings: Record<string, number>;
    expected_levels: Record<string, number>;
    confidence_model: { coverage: number; provenance: string };
  };
  appliedModifiers: Array<{
    modifier_type: string;
    modifier_name: string;
    adjustment_weight: number;
    affected_competencies: string[];
  }>;
  finalWeights: Record<string, number>;
  finalLevels: Record<string, number>;
}

export interface ExplainabilityOutput {
  version: string;
  why_competencies_selected: string;
  why_weights_assigned: Array<{
    competency_code: string;
    base_weight: number;
    final_weight: number;
    delta: number;
    reasons: string[];
  }>;
  why_readiness_level: Array<{
    competency_code: string;
    expected_level: number;
    rationale: string;
  }>;
  why_cohort: string;
  applied_modifiers: ExplainabilityInput['appliedModifiers'];
  confidence: { score: number; coverage: number; provenance: string; rationale: string };
  language_policy: {
    allowed: string[];
    disallowed: string[];
  };
}

const LANGUAGE_POLICY = {
  allowed: [
    'developmental signal',
    'capability indicator',
    'readiness band',
    'growth priority',
    'contextual expectation',
  ],
  disallowed: [
    'hiring decision',
    'promotion prediction',
    'candidate suitability',
    'job offer indicator',
  ],
};

export function buildExplainability(input: ExplainabilityInput): ExplainabilityOutput {
  const { context, dna, appliedModifiers, finalWeights, finalLevels } = input;

  const codes = new Set<string>([
    ...Object.keys(dna.default_weightings),
    ...Object.keys(finalWeights),
  ]);

  const why_weights_assigned = Array.from(codes).map((code) => {
    const base = +(dna.default_weightings[code] ?? 0).toFixed(4);
    const final = +(finalWeights[code] ?? 0).toFixed(4);
    const delta = +(final - base).toFixed(4);
    const reasons: string[] = [];
    if (base === 0) reasons.push('Not present in base DNA; introduced by context modifier.');
    if (delta > 0) reasons.push(`Boosted by ${(delta * 100).toFixed(1)}pp due to context modifiers.`);
    if (delta < 0) reasons.push(`Reduced by ${(Math.abs(delta) * 100).toFixed(1)}pp after L1 renormalisation.`);
    if (delta === 0 && base > 0) reasons.push('Base DNA weight preserved (no applicable modifier).');
    appliedModifiers
      .filter((m) => m.affected_competencies.includes(code))
      .forEach((m) => reasons.push(`Modifier ${m.modifier_type}:${m.modifier_name} (×${m.adjustment_weight.toFixed(2)})`));
    return { competency_code: code, base_weight: base, final_weight: final, delta, reasons };
  });

  const why_readiness_level = Object.entries(finalLevels).map(([code, lvl]) => {
    const base = dna.expected_levels[code] ?? 0;
    const delta = +(lvl - base).toFixed(2);
    const parts: string[] = [`Base expected level ${base} from ${dna.dna_name ?? 'DNA'}.`];
    if (delta !== 0) parts.push(`Adjusted by ${delta > 0 ? '+' : ''}${delta} from active context modifiers.`);
    return { competency_code: code, expected_level: +Number(lvl).toFixed(2), rationale: parts.join(' ') };
  });

  const cohortBits: string[] = [];
  if (context.role_id) cohortBits.push(`role=${context.role_id}`);
  if (context.layer_id) cohortBits.push(`layer=${context.layer_id}`);
  if (context.industry_id) cohortBits.push(`industry=${context.industry_id}`);
  if (context.seniority_band) cohortBits.push(`seniority=${context.seniority_band}`);
  if (context.geography) cohortBits.push(`geo=${context.geography}`);
  const why_cohort = cohortBits.length
    ? `Benchmark cohort selected by: ${cohortBits.join(', ')}. Falls back to broader cohorts when k < 30.`
    : 'No cohort filters provided — global cohort used (subject to k-anonymity floor).';

  const provenance = dna.confidence_model.provenance;
  const coverage = dna.confidence_model.coverage;
  const modifierBonus = Math.min(0.10, appliedModifiers.length * 0.02);
  const confidenceScore = +Math.min(1, Math.max(0.4, coverage * 0.8 + (provenance === 'ontology' ? 0.15 : 0) + modifierBonus)).toFixed(2);

  return {
    version: RUNTIME_EXPLAINABILITY_VERSION,
    why_competencies_selected: provenance === 'ontology'
      ? `Competencies selected from onto_role_competency_weights for role ${context.role_id}.`
      : `Ontology weights unavailable for role ${context.role_id ?? '(none)'} — using canonical 7-domain fallback (COG/COM/LEA/EXE/ADP/TEC/EIQ).`,
    why_weights_assigned,
    why_readiness_level,
    why_cohort,
    applied_modifiers: appliedModifiers,
    confidence: {
      score: confidenceScore,
      coverage,
      provenance,
      rationale: `Coverage ${(coverage * 100).toFixed(0)}% × provenance(${provenance}) + ${appliedModifiers.length} modifier(s).`,
    },
    language_policy: LANGUAGE_POLICY,
  };
}
