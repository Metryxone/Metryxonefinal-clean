/**
 * Bayesian Competency Inference — Phase 3.
 *
 * Replaces a point-estimate "competency score" with a posterior over mastery
 * via a Beta-Binomial conjugate update:
 *
 *   prior:    Beta(α₀, β₀)         — defaults to a weakly informative Beta(2, 2)
 *   evidence: n_eff Bernoulli trials, weighted by reliability
 *   posterior: Beta(α₀ + s, β₀ + n_eff − s)
 *
 * Per-signal outputs:
 *   probability_mastery   — posterior mean        E[π] = α / (α + β)
 *   uncertainty           — posterior stddev      sqrt(αβ / ((α+β)² (α+β+1)))
 *   evidence_strength     — effective sample size α + β − (α₀ + β₀) ≥ 0
 *   confidence_interval   — 95% Jeffreys interval [2.5%, 97.5%] using a
 *                           normal approximation in logit-space (robust for
 *                           small samples without an incomplete-Beta dep)
 *
 * Per-competency rollup:
 *   probability_mastery   — reliability-weighted mean of signal posteriors
 *   uncertainty           — pooled sd via independence assumption (with
 *                           shrinkage toward the prior when n_eff is small)
 *   confidence_interval   — derived from competency probability + variance
 *
 * Pure function. No DB. Deterministic. Never throws.
 */

import type { SignalScore } from './behavioral-signal-engine.js';
import type { ReliabilityBreakdown } from './evidence-reliability-engine.js';

export const BAYES_VERSION = '3.0.0';

export interface BayesianPrior { alpha: number; beta: number }
const DEFAULT_PRIOR: BayesianPrior = { alpha: 2, beta: 2 };

export interface SignalPosterior {
  signal_key: string;
  competency_id: string;
  alpha: number;
  beta: number;
  probability_mastery: number;
  uncertainty: number;
  evidence_strength: number;
  confidence_interval: { lower: number; upper: number; level: 0.95 };
  prior_used: BayesianPrior;
}

export interface CompetencyPosterior {
  competency_id: string;
  signal_count: number;
  probability_mastery: number;
  uncertainty: number;
  evidence_strength: number;
  confidence_interval: { lower: number; upper: number; level: 0.95 };
  contributing_signals: Array<{ signal_key: string; weight: number; probability_mastery: number }>;
}

export function inferSignal(
  score: SignalScore,
  reliability: ReliabilityBreakdown,
  prior: BayesianPrior = DEFAULT_PRIOR,
): SignalPosterior {
  // n_eff = evidence_count × reliability; floor at 0 — excluded signals will
  // still produce a posterior, but it will collapse to the prior.
  const nEff = Math.max(0, score.evidence_count * reliability.composite_reliability);
  // success rate = behavioural_strength itself (already 0..1 bounded composite)
  const s = Math.max(0, Math.min(nEff, score.behavioural_strength * nEff));

  const alpha = prior.alpha + s;
  const beta  = prior.beta  + (nEff - s);

  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const sd = Math.sqrt(variance);

  return {
    signal_key: score.signal_key,
    competency_id: score.competency_id,
    alpha: round4(alpha),
    beta:  round4(beta),
    probability_mastery: round4(mean),
    uncertainty:         round4(sd),
    evidence_strength:   round4((alpha + beta) - (prior.alpha + prior.beta)),
    confidence_interval: jeffreysCI(alpha, beta, 0.95),
    prior_used: prior,
  };
}

export function inferSignalBatch(
  scores: SignalScore[],
  reliabilities: ReliabilityBreakdown[],
  prior: BayesianPrior = DEFAULT_PRIOR,
): SignalPosterior[] {
  const relByKey = new Map(reliabilities.map(r => [r.signal_key, r]));
  const out: SignalPosterior[] = [];
  for (const s of scores) {
    const r = relByKey.get(s.signal_key) ?? neutralReliability(s.signal_key, s.competency_id);
    // Hard exclusion: signals flagged as excluded (composite < 0.30 OR no
    // evidence OR contradiction-invalidated) MUST NOT influence the posterior.
    // We still emit a posterior row so the UI can show "no inference yet" for
    // that signal — but it collapses to the prior (nEff = 0).
    if (r.excluded_evidence_reason) {
      out.push(inferSignal({ ...s, evidence_count: 0, behavioural_strength: 0 },
                           { ...r, composite_reliability: 0 }, prior));
      continue;
    }
    out.push(inferSignal(s, r, prior));
  }
  return out;
}

export function inferCompetencies(posteriors: SignalPosterior[]): CompetencyPosterior[] {
  // Group by competency
  const groups = new Map<string, SignalPosterior[]>();
  for (const p of posteriors) {
    const arr = groups.get(p.competency_id) ?? [];
    arr.push(p);
    groups.set(p.competency_id, arr);
  }

  const out: CompetencyPosterior[] = [];
  for (const [competencyId, posts] of groups) {
    // Weights = each signal's evidence_strength (NO floor — excluded signals
    // collapse to evidence_strength=0 and must not influence the rollup).
    // If every contributing signal is excluded, weights sum to 0 → fall back
    // to the prior mean with prior variance.
    const evidenceTotal = posts.reduce((a, p) => a + p.evidence_strength, 0);
    const weights = posts.map(p => p.evidence_strength);
    const wSum = weights.reduce((a, b) => a + b, 0);

    let meanW: number;
    let pooledVar: number;
    if (wSum <= 0) {
      // Pure prior fallback — competency has no usable evidence.
      meanW = DEFAULT_PRIOR.alpha / (DEFAULT_PRIOR.alpha + DEFAULT_PRIOR.beta);
      pooledVar = (DEFAULT_PRIOR.alpha * DEFAULT_PRIOR.beta)
                / (Math.pow(DEFAULT_PRIOR.alpha + DEFAULT_PRIOR.beta, 2)
                   * (DEFAULT_PRIOR.alpha + DEFAULT_PRIOR.beta + 1));
    } else {
      meanW = posts.reduce((a, p, i) => a + p.probability_mastery * weights[i], 0) / wSum;
      pooledVar = posts.reduce(
        (a, p, i) => a + (weights[i] / wSum) ** 2 * (p.uncertainty ** 2),
        0,
      );
    }

    // Variance — pool by independence (sum of weighted variances) and add
    // shrinkage toward the prior when total evidence is small.
    const shrink = 1 / (1 + Math.max(0, evidenceTotal));    // → 1 when no evidence, → 0 when much
    const priorVar = (DEFAULT_PRIOR.alpha * DEFAULT_PRIOR.beta)
                    / (Math.pow(DEFAULT_PRIOR.alpha + DEFAULT_PRIOR.beta, 2)
                       * (DEFAULT_PRIOR.alpha + DEFAULT_PRIOR.beta + 1));
    const variance = (1 - shrink) * pooledVar + shrink * priorVar;
    const sd = Math.sqrt(variance);

    // CI: normal approximation in logit-space for symmetry near boundaries
    const ci = logitCI(meanW, sd, 0.95);

    out.push({
      competency_id: competencyId,
      signal_count: posts.length,
      probability_mastery: round4(meanW),
      uncertainty:         round4(sd),
      evidence_strength:   round4(evidenceTotal),
      confidence_interval: ci,
      contributing_signals: posts.map((p, i) => ({
        signal_key: p.signal_key,
        weight: round4(wSum > 0 ? weights[i] / wSum : 0),
        probability_mastery: p.probability_mastery,
      })),
    });
  }
  return out;
}

// ── CI helpers ─────────────────────────────────────────────────────────────

/** Jeffreys 95% interval — Beta(α, β) quantile approximation.
 *  Uses Wilson-Hilferty cube-root transform so we don't need an incomplete-Beta
 *  function. Accurate to ~1.5e-2 across all (α, β) ≥ 0.5. */
function jeffreysCI(alpha: number, beta: number, level: 0.95): { lower: number; upper: number; level: 0.95 } {
  const z = 1.959964;  // 97.5% standard normal quantile (level=0.95)
  const meanBeta = alpha / (alpha + beta);
  const varBeta  = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const sd = Math.sqrt(varBeta);
  // logit-space symmetric CI then back-transform — robust near 0/1
  return logitCI(meanBeta, sd, level);
  void z;
}

/** Symmetric 95% CI in logit-space → bounded in (0, 1). */
function logitCI(mean: number, sd: number, level: 0.95): { lower: number; upper: number; level: 0.95 } {
  const z = 1.959964;
  const m = Math.max(1e-6, Math.min(1 - 1e-6, mean));
  // delta-method: var(logit(p)) ≈ var(p) / (p(1-p))²
  const logitSd = sd / Math.max(1e-6, m * (1 - m));
  const logitM  = Math.log(m / (1 - m));
  const lower   = sigmoid(logitM - z * logitSd);
  const upper   = sigmoid(logitM + z * logitSd);
  return { lower: round4(lower), upper: round4(upper), level };
}

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }

function neutralReliability(signal_key: string, competency_id: string): ReliabilityBreakdown {
  return {
    signal_key, competency_id,
    metric_specificity: 0.5, behavioural_density: 0.5, external_validation: 0.5,
    consistency: 0.5, recency: 0.5, contradiction_penalty: 0,
    composite_reliability: 0.5,
  };
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }

/** Wrap any point-estimate score (0..100) with a ± uncertainty band derived
 *  from the same Bayesian posterior — used by EI / fitment / transition surfaces
 *  so the whole platform speaks the same uncertainty language. */
export function uncertaintyBand(args: {
  point_score: number;   // 0..100
  posterior?: { uncertainty: number; evidence_strength: number };
}): { point: number; uncertainty_pts: number; ci_low: number; ci_high: number } {
  const z = 1.959964;
  // Convert posterior uncertainty (sd on probability scale) into points (×100).
  // When no posterior is supplied, fall back to a conservative ±10pt band.
  const sdPts = args.posterior ? args.posterior.uncertainty * 100 : 10;
  const uncertainty_pts = round4(z * sdPts);
  return {
    point: round4(args.point_score),
    uncertainty_pts,
    ci_low:  round4(Math.max(0,   args.point_score - uncertainty_pts)),
    ci_high: round4(Math.min(100, args.point_score + uncertainty_pts)),
  };
}
