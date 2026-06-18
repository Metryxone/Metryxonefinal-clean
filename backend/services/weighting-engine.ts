/**
 * Phase 2 — Dynamic Weighting Engine.
 *
 * Computes context-aware competency weights for an AlignmentScore:
 *     AlignmentScore = Σ (CompetencyScore × Weight)
 *
 * Base weights come from `onto_role_weights` (Phase 1 Role DNA). The engine
 * applies multiplicative modifiers based on industry, function, role,
 * organisational layer, seniority, organisation maturity, team scale, and
 * geography. Final vector is L1-normalised so weights sum to 1.0.
 *
 * Read-only against ontology tables. Pure deterministic logic + small policy
 * snapshot for auditability.
 */

import { Pool } from 'pg';

export const WEIGHTING_VERSION = '2.0.0';

export interface ContextFactors {
  industry_id?: string | null;
  function_id?: string | null;
  layer_id?: string | null;
  seniority?: 'junior' | 'mid' | 'senior' | 'lead' | 'executive' | null;
  org_maturity?: 'startup' | 'scaleup' | 'established' | 'enterprise' | null;
  team_scale?: 'small' | 'medium' | 'large' | 'massive' | null;
  geography?: 'apac' | 'emea' | 'amer' | 'global' | null;
}

export interface WeightedCompetency {
  competency_id: string;
  canonical_name: string;
  base_weight: number;
  modifiers_applied: Array<{ factor: string; multiplier: number; reason: string }>;
  final_weight: number;
  expected_level: number;
}

export interface WeightingResult {
  role_id: string;
  context: ContextFactors;
  weights: WeightedCompetency[];
  weight_sum_pre_norm: number;
  weight_sum_post_norm: number;
  policy_snapshot: Record<string, unknown>;
  version: string;
}

/**
 * Static policy table — versioned via WEIGHTING_VERSION. Each policy line is
 * (matcher → multiplier) and is stamped onto the result for auditability.
 */
const POLICY = {
  layer: {
    layer_strategic:  { leadership_relevance_gte_0_7: 1.30, complexity_lte_2: 0.80 },
    layer_leadership: { leadership_relevance_gte_0_7: 1.25, complexity_lte_2: 0.85 },
    layer_executive:  { leadership_relevance_gte_0_7: 1.20, complexity_lte_2: 0.90 },
    layer_managerial: { leadership_relevance_gte_0_5: 1.10 },
  } as Record<string, Record<string, number>>,
  seniority: {
    junior:    { trait_like: 0.95, state_like: 1.05 },
    mid:       {},
    senior:    { complexity_gte_4: 1.15 },
    lead:      { complexity_gte_4: 1.20, leadership_relevance_gte_0_5: 1.10 },
    executive: { complexity_gte_4: 1.20, leadership_relevance_gte_0_7: 1.20 },
  } as Record<string, Record<string, number>>,
  org_maturity: {
    startup:     { trainability_high: 1.10, complexity_gte_4: 0.90 },
    scaleup:     { complexity_gte_4: 1.05 },
    established: {},
    enterprise:  { leadership_relevance_gte_0_5: 1.08 },
  } as Record<string, Record<string, number>>,
  team_scale: {
    small:   {},
    medium:  { leadership_relevance_gte_0_5: 1.05 },
    large:   { leadership_relevance_gte_0_5: 1.10 },
    massive: { leadership_relevance_gte_0_7: 1.15 },
  } as Record<string, Record<string, number>>,
  industry: {
    ind_financial: { domain_strategic: 1.10 },
    ind_it:        { domain_cognitive: 1.05 },
  } as Record<string, Record<string, number>>,
  geography: {
    apac:   {},
    emea:   {},
    amer:   {},
    global: { leadership_relevance_gte_0_5: 1.05 },
  } as Record<string, Record<string, number>>,
};

interface CompetencyContext {
  competency_id: string;
  canonical_name: string;
  base_weight: number;
  expected_level: number;
  leadership_relevance: number;
  stability_level: string;
  complexity_level: number;
  trainability: string;
  domain_id: string;
  family_id: string;
}

/**
 * Compute final weights for a role under given context.
 */
export async function computeWeights(
  pool: Pool,
  roleId: string,
  context: ContextFactors,
): Promise<WeightingResult> {
  const { rows } = await pool.query<CompetencyContext>(`
    SELECT
      w.competency_id, c.canonical_name,
      w.weight::float        AS base_weight,
      w.expected_level,
      c.leadership_relevance::float AS leadership_relevance,
      c.stability_level, c.complexity_level::int AS complexity_level,
      c.trainability, c.domain_id, c.family_id
    FROM onto_role_weights w
    JOIN onto_dna_profiles p ON p.id = w.dna_profile_id AND p.is_current
    JOIN onto_competencies c ON c.id = w.competency_id
    WHERE p.role_id = $1
    ORDER BY w.weight DESC
  `, [roleId]);

  const weighted: WeightedCompetency[] = rows.map(r => {
    const mods: WeightedCompetency['modifiers_applied'] = [];
    let mult = 1.0;

    const apply = (factor: string, ruleSet: Record<string, number>) => {
      for (const [rule, m] of Object.entries(ruleSet)) {
        if (matchRule(rule, r)) {
          mods.push({ factor, multiplier: m, reason: rule });
          mult *= m;
        }
      }
    };

    if (context.layer_id     && POLICY.layer[context.layer_id])             apply(`layer:${context.layer_id}`,     POLICY.layer[context.layer_id]);
    if (context.seniority    && POLICY.seniority[context.seniority])        apply(`seniority:${context.seniority}`, POLICY.seniority[context.seniority]);
    if (context.org_maturity && POLICY.org_maturity[context.org_maturity])  apply(`maturity:${context.org_maturity}`, POLICY.org_maturity[context.org_maturity]);
    if (context.team_scale   && POLICY.team_scale[context.team_scale])      apply(`scale:${context.team_scale}`,   POLICY.team_scale[context.team_scale]);
    if (context.industry_id  && POLICY.industry[context.industry_id])       apply(`industry:${context.industry_id}`, POLICY.industry[context.industry_id]);
    if (context.geography    && POLICY.geography[context.geography])        apply(`geo:${context.geography}`,      POLICY.geography[context.geography]);

    return {
      competency_id: r.competency_id,
      canonical_name: r.canonical_name,
      base_weight: round(r.base_weight, 5),
      modifiers_applied: mods,
      final_weight: round(r.base_weight * mult, 5),  // pre-norm
      expected_level: r.expected_level,
    };
  });

  const sumPre = weighted.reduce((s, w) => s + w.final_weight, 0) || 1;
  for (const w of weighted) w.final_weight = round(w.final_weight / sumPre, 5);
  const sumPost = weighted.reduce((s, w) => s + w.final_weight, 0);

  return {
    role_id: roleId,
    context,
    weights: weighted,
    weight_sum_pre_norm:  round(sumPre, 5),
    weight_sum_post_norm: round(sumPost, 5),
    policy_snapshot: POLICY,
    version: WEIGHTING_VERSION,
  };
}

/**
 * Compute the AlignmentScore given user competency scores (0..100) and a
 * weighted role vector. Result is on the same 0..100 scale.
 */
export function alignmentScore(
  weighted: WeightedCompetency[],
  scoresByCompetency: Record<string, number>,
): { alignment: number; breakdown: Array<{ competency_id: string; score: number; weight: number; contribution: number }>; coverage: number } {
  const breakdown: Array<{ competency_id: string; score: number; weight: number; contribution: number }> = [];
  let totalContribution = 0;
  let coveredWeight = 0;

  for (const w of weighted) {
    const s = scoresByCompetency[w.competency_id];
    if (typeof s === 'number') {
      const contribution = s * w.final_weight;
      totalContribution += contribution;
      coveredWeight += w.final_weight;
      breakdown.push({ competency_id: w.competency_id, score: s,
                       weight: w.final_weight, contribution: round(contribution, 3) });
    }
  }

  // Rescale by covered weight so missing competencies don't drag alignment to 0.
  const alignment = coveredWeight > 0 ? totalContribution / coveredWeight : 0;
  return { alignment: round(alignment, 2), breakdown, coverage: round(coveredWeight, 3) };
}

export function fitBand(alignment: number): 'high' | 'moderate' | 'developing' | 'low' {
  if (alignment >= 80) return 'high';
  if (alignment >= 65) return 'moderate';
  if (alignment >= 50) return 'developing';
  return 'low';
}

// ---- rule matchers ---------------------------------------------------------
function matchRule(rule: string, c: CompetencyContext): boolean {
  switch (rule) {
    case 'leadership_relevance_gte_0_7': return c.leadership_relevance >= 0.7;
    case 'leadership_relevance_gte_0_5': return c.leadership_relevance >= 0.5;
    case 'complexity_gte_4':             return c.complexity_level     >= 4;
    case 'complexity_lte_2':             return c.complexity_level     <= 2;
    case 'trait_like':                   return c.stability_level === 'trait_like';
    case 'state_like':                   return c.stability_level === 'state_like';
    case 'trainability_high':            return c.trainability    === 'high';
    case 'domain_strategic':             return c.domain_id       === 'dom_strategic';
    case 'domain_cognitive':             return c.domain_id       === 'dom_cognitive';
    default: return false;
  }
}

const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;
