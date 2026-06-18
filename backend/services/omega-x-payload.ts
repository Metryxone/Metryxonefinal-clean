/**
 * OMEGA-X Composite Payload — single source of truth.
 *
 * Defines the canonical 8-layer schema used by:
 *   - WRITER: backend/routes/capadex.ts /api/capadex/session/:id/complete
 *   - READER: backend/routes/capadex.ts GET /api/capadex/session/:id/omega-x
 *             + alias /api/assessment/session/:id/omega-x
 *   - FRONTEND consumer mirror: frontend/src/components/assessment/phases/CapadexReportPhase.tsx
 *
 * Both writer and reader call `buildOmegaXSkeleton()` so layer keys cannot
 * drift between the two paths (eliminates the manual-duplication hazard
 * called out by the architect review on 2026-05-25).
 *
 * Today only `behavioural.{overthinking, indecisiveness, perfectionism}` are
 * telemetry-driven; every other layer is default-initialised. New fields
 * MUST be added here first, then consumed wherever needed.
 *
 * Note: `indecisiveness` is NOT in the original consolidation-pass spec but
 * is required by the F1 telemetry target (avg_hesitation>8000ms OR backtracks>=3).
 */

export interface OmegaXPayload {
  demographic:  { early_career: boolean; college_student: boolean };
  identity:     { professional: boolean; student: boolean };
  behavioural:  {
    overthinking:            number;
    avoidance_loop:          number;
    perfectionism:           number;
    procrastination_pattern: number;
    indecisiveness:          number;
  };
  cognitive:    { analytical: number; structured: number };
  emotional:    { anxious_achiever: number; emotionally_balanced: number };
  capability:   { leadership_potential: number; adaptive_problem_solver: number };
  risk:         {
    burnout_risk:             number;
    disengagement_risk:       number;
    crisis_risk:              number; // Module 2 — Channel B telemetry-derived
    emotional_breakdown_risk: number; // Module 2 — Channel B telemetry-derived
  };
  longitudinal: { growth_oriented: boolean };
}

/**
 * Fresh skeleton with spec defaults. Returns a NEW object on every call so
 * callers can safely mutate (the /complete writer adds telemetry modifiers
 * in-place before the UPDATE).
 */
export function buildOmegaXSkeleton(): OmegaXPayload {
  return {
    demographic:  { early_career: false, college_student: false },
    identity:     { professional: false, student: false },
    behavioural:  {
      overthinking:            0.00,
      avoidance_loop:          0.00,
      perfectionism:           0.00,
      procrastination_pattern: 0.00,
      indecisiveness:          0.00,
    },
    cognitive:    { analytical: 0.00, structured: 0.00 },
    emotional:    { anxious_achiever: 0.00, emotionally_balanced: 0.00 },
    capability:   { leadership_potential: 0.00, adaptive_problem_solver: 0.00 },
    risk:         {
      burnout_risk:             0.00,
      disengagement_risk:       0.00,
      crisis_risk:              0.00,
      emotional_breakdown_risk: 0.00,
    },
    longitudinal: { growth_oriented: true },
  };
}

/**
 * Shape guard used by the reader to distinguish a populated payload from
 * a never-written empty `{}`. Stricter than the previous `raw.behavioural`
 * truthy-check — also rejects `{behavioural:{}}` which has the key present
 * but zero canonical sub-fields, so the `is_skeleton` UI badge is accurate.
 *
 * Returns true only when EVERY required top-level layer key is present
 * AND `behavioural` carries the canonical sub-fields the writer always emits.
 */
/**
 * Module 3 — Bayesian posterior updater.
 *
 * Given a prior probability and the conditional likelihood of observing the
 * evidence under the hypothesis being true, returns the posterior probability
 * using the normalised odds form of Bayes' theorem:
 *
 *     P(H|E) = P(E|H) · P(H) / [ P(E|H) · P(H) + P(E|¬H) · P(¬H) ]
 *
 * Here `likelihood` is taken as both P(E|H) AND (1 - P(E|¬H)) — i.e. the
 * likelihood ratio collapses to a single normalised "evidence weight" in
 * [0,1]. 0.50 = neutral evidence (posterior == prior); >0.50 = confirms;
 * <0.50 = disconfirms. This is the standard simplification used when you
 * have a single calibrated signal rather than separate P(E|H), P(E|¬H).
 *
 * Safeguards: returns the prior unchanged on a degenerate denominator
 * (prior ∈ {0,1} AND likelihood ∈ {0,1} of the opposite extreme) so the
 * updater never throws or returns NaN. Output is clamped to [0.00, 1.00].
 *
 * Designed to be called SEQUENTIALLY — posterior of update N becomes the
 * prior for update N+1. The CAPADEX /complete writer uses this pattern for
 * burnout_risk (hesitation evidence → backtrack evidence).
 */
export function calculateBayesianUpdate(prior: number, likelihood: number): number {
  const numerator = prior * likelihood;
  const denominator = (prior * likelihood) + ((1 - prior) * (1 - likelihood));
  if (denominator === 0) return prior;
  return Math.min(Math.max(numerator / denominator, 0.00), 1.00);
}

export function isPopulatedOmegaXPayload(raw: unknown): raw is OmegaXPayload {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, any>;
  const required = ['demographic','identity','behavioural','cognitive','emotional','capability','risk','longitudinal'];
  if (!required.every(k => r[k] && typeof r[k] === 'object')) return false;
  // Writer always emits `overthinking` numeric on behavioural — use as canary.
  return typeof r.behavioural?.overthinking === 'number';
}
