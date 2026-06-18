/**
 * Contextual Scoring Engine (Phase 3 V2, additive).
 *
 * Replaces *generic* scoring with role-DNA-, layer-, industry-relative
 * scoring. Pure-function core + thin DB helpers. Does NOT touch any
 * existing scoring code paths.
 */
import type { Pool } from 'pg';

export const CONTEXTUAL_SCORING_VERSION = '3.0.0';

export type ContextualScoreInput = {
  rawScore: number;             // 0–100 raw competency signal
  dnaExpectedLevel: number;     // 0–100 expected by Role DNA for this comp
  cohortMean?: number;          // optional cohort centring
  cohortStd?: number;           // optional cohort sigma
  evidenceCount?: number;       // # observations contributing
  growthVelocity?: number;      // delta/week, may be negative
};

export type ContextualScoreResult = {
  raw_score: number;
  contextual_score: number;        // 0–100, anchored vs DNA expected level
  z_vs_cohort: number;             // standardized vs cohort (0 if no cohort)
  confidence: number;              // 0–1, stabilised
  reliability: number;             // 0–1, evidence-weighted
  growth_adjusted_score: number;
  rationale: string[];
};

/**
 * Normalise a raw score so that DNA expected level = 50 (neutral),
 * 100 = double the expected, 0 = zero — sigmoid-blended.
 */
export function normalizeAgainstRoleDNA(raw: number, dnaExpected: number): number {
  const expected = Math.max(20, Math.min(95, dnaExpected));
  // map raw → contextual using piecewise-linear anchored at (0,0), (expected,50), (100,100)
  if (raw <= expected) {
    return +((raw / expected) * 50).toFixed(2);
  }
  return +(50 + ((raw - expected) / (100 - expected)) * 50).toFixed(2);
}

export function computeConfidence(evidenceCount: number, variance = 0.08): number {
  // logistic stabilisation: low evidence → near 0.5; high evidence → near 1
  const n = Math.max(0, evidenceCount);
  const base = 1 - 1 / (1 + n / 6);
  const penalty = Math.min(0.25, variance * 2);
  return +Math.max(0, Math.min(1, base - penalty)).toFixed(3);
}

export function computeReliability(evidenceCount: number, standardError: number): number {
  const n = Math.max(0, evidenceCount);
  const seClamp = Math.max(0.01, standardError);
  // classical-test-theory style: rel = sigma_true^2 / sigma_obs^2 proxied
  const rel = n / (n + seClamp * 20);
  return +Math.max(0, Math.min(1, rel)).toFixed(3);
}

export function computeContextualScore(i: ContextualScoreInput): ContextualScoreResult {
  const contextual = normalizeAgainstRoleDNA(i.rawScore, i.dnaExpectedLevel);
  const std = i.cohortStd ?? 0;
  const z = std > 0 && i.cohortMean != null
    ? +(((i.rawScore - i.cohortMean) / std)).toFixed(3)
    : 0;
  const confidence = computeConfidence(i.evidenceCount ?? 0, 0.08);
  const reliability = computeReliability(i.evidenceCount ?? 0, 0.12);
  const growth = i.growthVelocity ?? 0;
  // small longitudinal nudge: ±5 points capped
  const growthAdj = +Math.max(0, Math.min(100, contextual + Math.max(-5, Math.min(5, growth * 12)))).toFixed(2);
  const rationale: string[] = [
    `Raw ${i.rawScore.toFixed(1)} anchored against DNA expected ${i.dnaExpectedLevel.toFixed(1)} → contextual ${contextual}.`,
  ];
  if (std > 0) rationale.push(`Cohort z=${z} (mean=${i.cohortMean?.toFixed(1)}, std=${std.toFixed(2)}).`);
  rationale.push(`Confidence ${(confidence * 100).toFixed(0)}% from ${i.evidenceCount ?? 0} observations.`);
  rationale.push(`Reliability ${(reliability * 100).toFixed(0)}%; growth-adjusted ${growthAdj}.`);
  return {
    raw_score: +i.rawScore.toFixed(2),
    contextual_score: contextual,
    z_vs_cohort: z,
    confidence,
    reliability,
    growth_adjusted_score: growthAdj,
    rationale,
  };
}

export type ReadinessBand = 'emerging' | 'developing' | 'proficient' | 'expert';

export function computeReadiness(
  contextualScore: number,
  thresholds: { emerging: number; developing: number; proficient: number; expert: number },
  confidence: number,
): { band: ReadinessBand; probability: number; rationale: string } {
  let band: ReadinessBand = 'emerging';
  if (contextualScore >= thresholds.expert)          band = 'expert';
  else if (contextualScore >= thresholds.proficient) band = 'proficient';
  else if (contextualScore >= thresholds.developing) band = 'developing';
  // Probability = distance into band × confidence floor
  const thr = thresholds[band === 'emerging' ? 'developing' : band];
  const probability = +Math.max(0.05, Math.min(0.99, (contextualScore / 100) * (0.4 + confidence * 0.6))).toFixed(3);
  return {
    band,
    probability,
    rationale: `Contextual ${contextualScore.toFixed(1)} ≥ ${band} threshold (${thr.toFixed(1)}); confidence ${(confidence * 100).toFixed(0)}% gates probability ${probability}.`,
  };
}

/**
 * Fire-and-forget explainability log. Never throws — failures must not
 * block the primary response. Errors are logged to stderr only.
 */
export function logExplainability(
  pool: Pool,
  args: { userId?: number | null; competencyCode?: string | null; endpoint?: string; logType: string; rationale: string; payload?: object },
): void {
  pool.query(
    `INSERT INTO scoring_explainability_v2 (user_id, competency_code, endpoint, log_type, rationale, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [args.userId ?? null, args.competencyCode ?? null, args.endpoint ?? null, args.logType, args.rationale, JSON.stringify(args.payload ?? {})],
  ).catch((e: Error) => {
    // eslint-disable-next-line no-console
    console.warn('[contextual-scoring] explainability log failed:', e.message);
  });
}

export function clampScore(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
