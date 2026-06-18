/**
 * Stage Guidance Orchestrator — Phase 1.
 *
 * Aggregates existing Career Builder intelligence into a single, evidence-
 * driven payload that powers the "Gap to next stage" guidance panel.
 *
 * Reads (no writes, no new business logic):
 *   - benchmarkRole          (Phase 2)  → role alignment, per-competency weight, expected level, percentile
 *   - getBenchmark           (Phase 2)  → cohort p50 enrichment
 *   - getUserVelocity        (Phase 4)  → velocity, momentum, consistency, trend per competency
 *   - computeReliability     (Phase 2)  → composite reliability + quality tier
 *   - adjacentRoles          (Phase 3)  → adjacency offramp candidates
 *
 * Ranking formula (PHASE 1 SPEC — implement exactly):
 *   score = (projected_ei_lift / max(effort_hours, 0.5))
 *         × velocity_multiplier × confidence_multiplier × weight_multiplier
 *
 *   velocity_multiplier:   accelerating 1.4 · stabilizing 1.1 · flat 1.0 · declining 1.6
 *   confidence_multiplier: A 1.0 · B 0.9 · C 0.7 · D 0.4
 *   weight_multiplier:     role competency weight (already L1-normalised)
 *
 * Language policy: developmental only — never asserts hiring or promotion.
 */

import type { Pool } from 'pg';
import { benchmarkRole, getBenchmark, demoUserScores,
         BENCH_METHODOLOGY_VERSION, resolveCohort } from './adaptive-benchmark.js';
import { computeReliability, computeQuality, demoResponses } from './reliability-engine.js';
import { getUserVelocity, type VelocityResult } from './longitudinal-engine.js';
import { adjacentRoles } from './mobility-engine.js';
import { WEIGHTING_VERSION, type ContextFactors } from './weighting-engine.js';
import { computeRoleRequirementGaps, ROLE_REQUIREMENTS_VERSION,
         type ProfileSnapshot, type RequirementBundle,
         type RequirementGap, type Dimension } from './role-requirements-engine.js';

export const STAGE_GUIDANCE_VERSION = '2.0.0';

// LEVEL_ANCHORS mirrors the Phase 3 mobility engine so anchors are consistent.
const LEVEL_ANCHORS = [0, 30, 50, 65, 80, 92] as const;

type VelocityTrend = 'accelerating' | 'stabilizing' | 'flat' | 'declining';

function normaliseTrend(t: VelocityResult['trend'] | undefined): VelocityTrend {
  // Phase 4 emits: accelerating | steady | plateau | declining | insufficient_data
  if (t === 'accelerating') return 'accelerating';
  if (t === 'declining')    return 'declining';
  if (t === 'steady')       return 'stabilizing';
  return 'flat';
}

const VELOCITY_MULT: Record<VelocityTrend, number> = {
  accelerating: 1.4,
  stabilizing:  1.1,
  flat:         1.0,
  declining:    1.6,
};

const CONFIDENCE_MULT: Record<'A'|'B'|'C'|'D', number> = {
  A: 1.0, B: 0.9, C: 0.7, D: 0.4,
};

export interface StageGuidanceInput {
  session_id: string;
  target_role_id: string;
  user_id?: string;                              // for longitudinal velocity
  scores?: Record<string, number>;               // explicit user scores
  demo?: boolean;                                // opt-in: synthesise demo scores + reliability
  context?: ContextFactors;                      // industry, function, layer, seniority, …
  profile?: ProfileSnapshot | null;              // user profile snapshot for non-competency dimensions
}

export interface StageGuidancePayload {
  target_role: { id: string; name: string; family: string | null };
  overall_gap: {
    current_ei: number;
    target_ei: number;
    gap_points: number;
    confidence_interval: { min: number; max: number };
  };
  reliability: {
    composite_reliability: number;
    quality_tier: 'A'|'B'|'C'|'D';
    contradictions_pct: number;
    completion_pct: number;
  };
  gap_decomposition: Array<{
    competency_id: string;
    competency_name: string;
    user_score: number;
    cohort_p50: number | null;
    target_anchor: number;
    gap_pts: number;
    weighted_gap: number;
    percentile: number | null;
    weight: number;
    confidence_tier: 'A'|'B'|'C'|'D'|'provisional';
    trend: VelocityTrend;
    velocity_30d: number;
  }>;
  ranked_steps: Array<{
    id: string;
    title: string;
    category: 'competency_development' | 'leadership_growth' |
              'execution_strengthening' | 'strategic_growth' |
              'interpersonal_growth' | 'cognitive_growth' |
              'technical_skill' | 'certification' | 'education' |
              'functional_skill' | 'tool' | 'domain_expertise';
    dimension: 'competency' | 'technical_skill' | 'certification' | 'education' |
               'functional_skill' | 'tool' | 'domain_expertise';
    competency_id: string;
    projected_ei_lift: number;
    confidence_interval: { min: number; max: number };
    confidence_tier: 'A'|'B'|'C'|'D';
    effort_hours: number;
    roi_score: number;
    rationale: string;
    why_recommended: string[];
    behavioural_indicators: string[];
    importance?: 'critical' | 'required' | 'preferred' | 'nice_to_have';
    cta: { label: string; route: string };
  }>;
  requirement_summary?: RequirementBundle['summary'] & { total_missing_ei?: number };
  requirements_by_dimension?: RequirementBundle['by_dimension'];
  adjacent_offramp: {
    role_id: string;
    role_name: string;
    current_gap: number;
    projected_gap: number;
    switchability: number;
  } | null;
  static_fallback_used: boolean;
  explainability: {
    methodology_version: string;
    weighting_policy: string;
    cohort_size: number;
    cohort_tier: string;
    data_sources: string[];
    ranking_formula: string;
    language_policy: {
      allowed: string[];
      disallowed: string[];
    };
    generated_at: string;
  };
}

// ---- helpers ---------------------------------------------------------------

async function listRoleCompetencyIds(pool: Pool, roleId: string): Promise<string[]> {
  const { rows } = await pool.query<{ competency_id: string }>(
    `SELECT w.competency_id
       FROM onto_role_weights w
       JOIN onto_dna_profiles p ON p.id = w.dna_profile_id AND p.is_current
      WHERE p.role_id = $1`,
    [roleId]);
  return rows.map(r => r.competency_id);
}

async function getRoleMeta(pool: Pool, roleId: string): Promise<{ id: string; name: string; family: string | null } | null> {
  const { rows } = await pool.query<{ id: string; title: string; family_id: string | null }>(
    `SELECT id, title, role_family_id AS family_id
       FROM onto_roles WHERE id = $1 LIMIT 1`, [roleId]);
  if (!rows[0]) return null;
  return { id: rows[0].id, name: rows[0].title, family: rows[0].family_id };
}

async function batchP50ForCohort(pool: Pool, cohortId: string, competencyIds: string[]): Promise<Map<string, number>> {
  if (!competencyIds.length) return new Map();
  const { rows } = await pool.query<{ competency_id: string; p50: number }>(
    `SELECT competency_id, p50::float AS p50
       FROM bench_competency_benchmarks
      WHERE cohort_id = $1 AND competency_id = ANY($2::text[])`,
    [cohortId, competencyIds]);
  return new Map(rows.map(r => [r.competency_id, r.p50]));
}

async function batchBehaviouralIndicators(pool: Pool, competencyIds: string[]): Promise<Map<string, string[]>> {
  if (!competencyIds.length) return new Map();
  const { rows } = await pool.query<{ competency_id: string; indicator: string }>(
    `SELECT competency_id, indicator
       FROM onto_indicators
      WHERE competency_id = ANY($1::text[])
      ORDER BY competency_id, proficiency_level`,
    [competencyIds]);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const arr = map.get(r.competency_id) ?? [];
    if (arr.length < 3) arr.push(r.indicator);
    map.set(r.competency_id, arr);
  }
  return map;
}

/** Map a competency to a step category using family/domain conventions. */
function categoriseStep(familyId: string | null, domainId: string | null):
  'competency_development' | 'leadership_growth' | 'execution_strengthening' |
  'strategic_growth' | 'interpersonal_growth' | 'cognitive_growth' {
  if (familyId === 'fam_leadership')           return 'leadership_growth';
  if (familyId === 'fam_execution')            return 'execution_strengthening';
  if (familyId === 'fam_strategic_reasoning' || domainId === 'dom_strategic') return 'strategic_growth';
  if (domainId === 'dom_interpersonal')        return 'interpersonal_growth';
  if (domainId === 'dom_cognitive')            return 'cognitive_growth';
  return 'competency_development';
}

/** Map quality_tier to confidence tier (A/B/C/D); reliability index is bounded 0..1. */
function reliabilityToConfidenceTier(tier: 'A'|'B'|'C'|'D'): 'A'|'B'|'C'|'D' { return tier; }

/** Effort in hours, derived from gap magnitude. Mirrors Phase 3 weeks estimate (×4h/wk). */
function effortHoursForGap(gapPts: number): number {
  const g = Math.abs(gapPts);
  if (g <= 8)  return 2;
  if (g <= 15) return 4;
  if (g <= 25) return 6;
  if (g <= 40) return 10;
  return 16;
}

// ---- main orchestrator -----------------------------------------------------

export async function buildStageGuidance(pool: Pool, input: StageGuidanceInput): Promise<StageGuidancePayload> {
  const ctx: ContextFactors = input.context ?? {};
  const roleMeta = await getRoleMeta(pool, input.target_role_id);
  if (!roleMeta) throw new Error('target_role_not_found');

  // Resolve scores — demo path is strictly opt-in
  let scores = input.scores;
  if (!scores || Object.keys(scores).length === 0) {
    if (!input.demo) {
      // No real scores available and demo not requested → caller (route) wraps as static fallback
      throw new Error('no_user_scores_available');
    }
    const compIds = await listRoleCompetencyIds(pool, input.target_role_id);
    scores = demoUserScores(input.session_id, compIds);
  }

  // Fan out — required sources: benchResult, indicatorMap, reliability.
  // Optional sources: velocity (only when user_id supplied), adjacent (graceful empty).
  // Required failures bubble up and route returns static fallback envelope.
  const [
    benchResult,
    velocityRowsRaw,
    reliabilityRaw,
    adjacentRows,
    indicatorMap,
  ] = await Promise.all([
    benchmarkRole(pool, { role_id: input.target_role_id, user_scores: scores, context: ctx }),
    input.user_id
      ? getUserVelocity(pool, input.user_id)            // required when user_id supplied
      : Promise.resolve([] as VelocityResult[]),         // no user_id → genuinely empty, not a failure
    Promise.resolve().then(() => {
      // Reliability requires per-response data. Without real responses we fall back to
      // demo responses (only when demo mode opted-in); otherwise refuse and throw.
      if (!input.demo) throw new Error('no_response_data_for_reliability');
      const resp = demoResponses(input.session_id);
      const reliability = computeReliability(input.session_id, resp);
      const quality     = computeQuality(input.session_id, resp);
      return { reliability, quality };
    }),
    adjacentRoles(pool, input.target_role_id),           // required — DB read; failure → fallback
    batchBehaviouralIndicators(pool, Object.keys(scores)),
  ]);

  // Enrich with cohort p50 in one batch
  const p50Map = await batchP50ForCohort(pool, benchResult.cohort.id,
    benchResult.competencies.map(c => c.competency_id));

  // Pull family/domain for categorisation in one batch
  const { rows: famRows } = await pool.query<{ id: string; family_id: string | null; domain_id: string | null }>(
    `SELECT id, family_id, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`,
    [benchResult.competencies.map(c => c.competency_id)]);
  const famMap = new Map(famRows.map(r => [r.id, { family: r.family_id, domain: r.domain_id }]));

  // Velocity map
  const velocityByComp = new Map<string, VelocityResult>();
  for (const v of velocityRowsRaw) velocityByComp.set(v.competency_id, v);

  // ---- reliability layer ----
  const reliability = {
    composite_reliability: round(reliabilityRaw.reliability.reliability_index, 3),
    quality_tier: reliabilityRaw.quality.quality_tier,
    contradictions_pct: round(
      reliabilityRaw.reliability.contradiction_count /
        Math.max(1, reliabilityRaw.reliability.contradictions.length + 5), 3),
    completion_pct: round(reliabilityRaw.quality.completion_rate, 3),
  };
  const confTier = reliabilityToConfidenceTier(reliability.quality_tier);
  const confMult = CONFIDENCE_MULT[confTier];

  // ---- gap decomposition ----
  const gap_decomposition = benchResult.competencies.map(c => {
    const targetAnchor = LEVEL_ANCHORS[Math.min(5, Math.max(0, c.expected_level))];
    const gapPts = round(targetAnchor - c.user_score, 1);
    const weightedGap = round(Math.max(0, gapPts) * c.weight, 3);
    const vel = velocityByComp.get(c.competency_id);
    return {
      competency_id: c.competency_id,
      competency_name: c.canonical_name,
      user_score: c.user_score,
      cohort_p50: p50Map.has(c.competency_id) ? round(p50Map.get(c.competency_id)!, 1) : null,
      target_anchor: targetAnchor,
      gap_pts: gapPts,
      weighted_gap: weightedGap,
      percentile: c.percentile ?? null,
      weight: round(c.weight, 4),
      confidence_tier: (benchResult.cohort.tier ?? 'provisional') as 'A'|'B'|'C'|'D'|'provisional',
      trend: normaliseTrend(vel?.trend),
      velocity_30d: vel ? round(vel.velocity_pts_per_30d, 2) : 0,
    };
  });

  // ---- ranked steps (apply formula) ----
  // Each gap → projected_ei_lift = weighted_gap (already gap × normalised weight)
  // Closing the full weighted gap lifts the alignment composite by exactly that amount.
  const candidates = gap_decomposition
    .filter(g => g.gap_pts > 0)
    .map((g, i) => {
      const fam = famMap.get(g.competency_id) ?? { family: null, domain: null };
      const category = categoriseStep(fam.family, fam.domain);
      // projected_ei_lift is the actual composite EI delta from closing this gap.
      // Since composite alignment is the weight-summed score, closing one
      // competency's full gap lifts the composite by `gap × weight` — that IS
      // the weighted gap. The weight effect is therefore already embedded in
      // projected_ei_lift; multiplying again would double-weight ranking.
      const projectedLift = round(g.weighted_gap, 2);
      const effortHours = effortHoursForGap(g.gap_pts);
      const velMult = VELOCITY_MULT[g.trend];
      const score = (projectedLift / Math.max(effortHours, 0.5)) * velMult * confMult;

      // ±20% confidence interval narrowing/widening with confidence tier
      const ciSpread = projectedLift * (confTier === 'A' ? 0.10 :
                                        confTier === 'B' ? 0.20 :
                                        confTier === 'C' ? 0.35 : 0.55);

      const trendRationale = g.trend === 'accelerating' ? 'already trending up — preserve momentum'
                           : g.trend === 'declining'    ? 'recently declining — intervene now'
                           : g.trend === 'stabilizing'  ? 'steady progress — keep building'
                           : '30-day flat trajectory — break the plateau';

      return {
        id: `step_${i + 1}_${g.competency_id}`,
        title: `Develop ${g.competency_name}`,
        category,
        dimension: 'competency' as const,
        competency_id: g.competency_id,
        projected_ei_lift: projectedLift,
        confidence_interval: {
          min: round(Math.max(0, projectedLift - ciSpread), 2),
          max: round(projectedLift + ciSpread, 2),
        },
        confidence_tier: confTier,
        effort_hours: effortHours,
        roi_score: round(score, 4),
        rationale: `${g.competency_name}: you ${g.user_score} · cohort p50 ${g.cohort_p50 != null ? g.cohort_p50.toFixed(1) : '—'} · target anchor ${g.target_anchor} (gap ${g.gap_pts} pts, weight ${(g.weight*100).toFixed(1)}%). ${trendRationale}.`,
        why_recommended: [
          `Largest weighted gap contribution: ${g.weighted_gap.toFixed(2)} pts off composite`,
          g.cohort_p50 != null
            ? `${g.user_score - g.cohort_p50 >= 0 ? 'Above' : 'Below'} cohort median by ${Math.abs(g.user_score - g.cohort_p50).toFixed(1)} pts`
            : `Cohort median unavailable for this competency`,
          trendRationale[0].toUpperCase() + trendRationale.slice(1),
        ],
        behavioural_indicators: (indicatorMap.get(g.competency_id) ?? []).slice(0, 3),
        cta: {
          label: 'Open Skills Lab',
          route: `/career-builder?tab=skills&competency=${encodeURIComponent(g.competency_id)}`,
        },
      };
    });

  // ---- Phase 6: role-requirement gaps (technical/cert/edu/functional/tool/domain) ----
  let requirementBundle: RequirementBundle | null = null;
  try {
    requirementBundle = await computeRoleRequirementGaps(pool, input.target_role_id, input.profile ?? null);
  } catch {
    requirementBundle = null;
  }
  const requirementSteps = (requirementBundle?.ranked_recommendations ?? []).map((g, i) =>
    requirementGapToStep(g, i, confTier));

  // Merge & rank — top 12 across all dimensions
  const allSteps = [...candidates, ...requirementSteps]
    .sort((a, b) => b.roi_score - a.roi_score)
    .slice(0, 12);

  // ---- adjacent offramp ----
  // Trigger when primary composite gap is large AND an adjacent role exists.
  const totalGapPoints = round(
    gap_decomposition.reduce((s, g) => s + Math.max(0, g.gap_pts) * g.weight, 0), 1);

  let adjacent_offramp: StageGuidancePayload['adjacent_offramp'] = null;
  if (totalGapPoints > 12 && adjacentRows.length > 0) {
    const top = adjacentRows[0] as { role_id: string; title: string; adjacency_score: number };
    // Projected gap reduction proportional to adjacency_score (0..1)
    const projected = round(totalGapPoints * Math.max(0.3, 1 - top.adjacency_score), 1);
    if (projected < totalGapPoints - 3) {
      adjacent_offramp = {
        role_id: top.role_id,
        role_name: top.title,
        current_gap: totalGapPoints,
        projected_gap: projected,
        switchability: round(top.adjacency_score, 2),
      };
    }
  }

  // ---- overall gap ----
  // current_ei mirrors alignment_score; target_ei is by definition 100 for full role-DNA match.
  // Confidence interval widens with low reliability + low cohort tier.
  const ciWidth = (1 - reliability.composite_reliability) * 6 +
                  (confTier === 'C' || confTier === 'D' ? 3 : 1);

  return {
    target_role: roleMeta,
    overall_gap: {
      current_ei: round(benchResult.alignment_score, 1),
      target_ei: 100,
      gap_points: round(100 - benchResult.alignment_score, 1),
      confidence_interval: {
        min: round(Math.max(0, benchResult.alignment_score - ciWidth), 1),
        max: round(Math.min(100, benchResult.alignment_score + ciWidth), 1),
      },
    },
    reliability,
    gap_decomposition: gap_decomposition.sort((a, b) => b.weighted_gap - a.weighted_gap),
    ranked_steps: allSteps,
    requirement_summary: requirementBundle
      ? { ...requirementBundle.summary, total_missing_ei: requirementBundle.total_missing_ei }
      : undefined,
    requirements_by_dimension: requirementBundle?.by_dimension,
    adjacent_offramp,
    static_fallback_used: false,
    explainability: {
      methodology_version: STAGE_GUIDANCE_VERSION,
      weighting_policy: `weighting v${WEIGHTING_VERSION} · benchmark v${BENCH_METHODOLOGY_VERSION} · requirements v${ROLE_REQUIREMENTS_VERSION}`,
      cohort_size: benchResult.cohort.n ?? 0,
      cohort_tier: benchResult.cohort.tier ?? 'provisional',
      data_sources: [
        '/api/benchmark/role (per-competency gap + weight + percentile)',
        '/api/longitudinal/velocity (EWMA momentum α=0.30)',
        '/api/benchmark/reliability (composite reliability)',
        '/api/mobility/adjacent (offramp candidates)',
        'onto_behavioral_indicators (developmental cues)',
        'rr_technical_skills / rr_certifications / rr_education / rr_functional_skills / rr_tools / rr_domain_expertise (role requirement gaps)',
      ],
      ranking_formula: '(projected_ei_lift / max(effort_h, 0.5)) × velocity_mult × confidence_mult  [projected_ei_lift = gap × weight; role-DNA weight embedded once, not multiplied again]',
      language_policy: {
        allowed:    ['developmental readiness', 'capability proximity',
                     'alignment indicator', 'development opportunity'],
        disallowed: ['hiring prediction', 'promotion guarantee',
                     'suitable candidate', 'likely to get hired'],
      },
      generated_at: new Date().toISOString(),
    },
  };
}

// ---- ranking formula (exported for tests) ---------------------------------

/**
 * Ranking score formula (exported for tests):
 *   (projected_ei_lift / max(effort_h, 0.5)) × velocity_mult × confidence_mult
 *
 * NOTE: `projected_ei_lift` must already be the composite-weighted EI delta
 * (i.e. gap × competency_weight). The role-DNA weight is therefore embedded
 * in `projected_ei_lift` and is NOT applied again here to avoid double-weighting.
 */
export function rankingScore(params: {
  projected_ei_lift: number;
  effort_hours: number;
  trend: VelocityTrend;
  confidence_tier: 'A'|'B'|'C'|'D';
}): number {
  return (params.projected_ei_lift / Math.max(params.effort_hours, 0.5))
       * VELOCITY_MULT[params.trend]
       * CONFIDENCE_MULT[params.confidence_tier];
}

function round(n: number, dp: number): number {
  const m = 10 ** dp;
  return Math.round(n * m) / m;
}

// ---- Phase 6 helpers: requirement gap → ranked step --------------------------

const DIM_TAB: Record<Dimension, string> = {
  technical_skill:  'skills',
  certification:    'learning',
  education:        'profile',
  functional_skill: 'skills',
  tool:             'skills',
  domain_expertise: 'jobs',
};
const DIM_CTA_LABEL: Record<Dimension, string> = {
  technical_skill:  'Open Skills Lab',
  certification:    'Open Learning Hub',
  education:        'Update Profile',
  functional_skill: 'Open Skills Lab',
  tool:             'Open Skills Lab',
  domain_expertise: 'Browse roles in this domain',
};
const DIM_TITLE_PREFIX: Record<Dimension, string> = {
  technical_skill:  'Learn',
  certification:    'Earn certification',
  education:        'Complete',
  functional_skill: 'Build expertise in',
  tool:             'Get hands-on with',
  domain_expertise: 'Gain exposure to',
};
const IMP_RATIONALE: Record<RequirementGap['importance'], string> = {
  critical:     'Marked critical for this role — closes a hard blocker.',
  required:     'Required baseline for this role.',
  preferred:    'Preferred by recruiters for this role.',
  nice_to_have: 'Nice-to-have signal that differentiates candidates.',
};

function requirementGapToStep(g: RequirementGap, i: number, confTier: 'A'|'B'|'C'|'D') {
  const lift = round(g.ei_impact, 2);
  const eff  = Math.max(0.5, g.effort_hours);
  // Importance multiplier mirrors role-requirements engine's IMP table
  const impMult = g.importance === 'critical' ? 1.5
                : g.importance === 'required' ? 1.2
                : g.importance === 'preferred' ? 1.0 : 0.6;
  const score = (lift * impMult * g.weight / eff) * CONFIDENCE_MULT[confTier];
  const ciSpread = lift * (confTier === 'A' ? 0.10 : confTier === 'B' ? 0.20 : confTier === 'C' ? 0.35 : 0.55);
  const tab = DIM_TAB[g.dimension];
  const queryItem = encodeURIComponent(g.item_name);
  const why: string[] = [IMP_RATIONALE[g.importance]];
  if (g.item_meta?.category)        why.push(`Category: ${String(g.item_meta.category)}`);
  if (g.item_meta?.provider)        why.push(`Provider: ${String(g.item_meta.provider)}`);
  if (g.item_meta?.years_typical)   why.push(`Typical exposure: ${g.item_meta.years_typical}+ years`);
  if (g.item_meta?.preferred_fields) why.push(`Preferred fields: ${g.item_meta.preferred_fields}`);
  return {
    id: `req_${g.dimension}_${i}_${g.item_name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
    title: `${DIM_TITLE_PREFIX[g.dimension]} ${g.item_name}`,
    category: g.dimension,
    dimension: g.dimension,
    competency_id: '',
    projected_ei_lift: lift,
    confidence_interval: {
      min: round(Math.max(0, lift - ciSpread), 2),
      max: round(lift + ciSpread, 2),
    },
    confidence_tier: confTier,
    effort_hours: g.effort_hours,
    roi_score: round(score, 4),
    rationale: g.rationale + (g.evidence_hint ? ` Evidence: ${g.evidence_hint}.` : ''),
    why_recommended: why,
    behavioural_indicators: g.evidence_hint ? [g.evidence_hint] : [],
    importance: g.importance,
    cta: {
      label: DIM_CTA_LABEL[g.dimension],
      route: `/career-builder?tab=${tab}&dimension=${g.dimension}&item=${queryItem}`,
    },
  };
}

// Re-exported so the route layer can resolve a target_role default without
// reintroducing a hardcoded fallback. Returns null if no roles exist yet.
export async function suggestDefaultTargetRole(pool: Pool): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM onto_roles WHERE deprecated = false ORDER BY id LIMIT 1`);
  return rows[0]?.id ?? null;
}
