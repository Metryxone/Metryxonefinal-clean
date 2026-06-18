// ============================================================
// Competency Assessment Factory — Scoring Engine
// backend/services/caf/scoring-engine.ts
//
// Implements all five type-specific scoring models:
//   BEHAVIORAL    → BARS_RUBRIC
//   FUNCTIONAL    → WEIGHTED_CTT (CTT with Bloom multipliers)
//   COGNITIVE     → IRT_3PL with EAP theta estimation
//   LEADERSHIP    → SJT_EXPERT + BARS hybrid
//   FUTURE_READINESS → DIMENSIONAL composite
// ============================================================

import {
  AssessmentTypeCode,
  CAFQuestion,
  CAFResponse,
  CAFAssessment,
  ScoringConfig,
  DomainScore,
  SessionScoreResult,
  EAPResult,
  IRTItem,
  LevelCode,
  AdaptiveState,
} from './types.js';

// ── Constants ────────────────────────────────────────────────

const IRT_D = 1.702;  // scaling constant for normal metric

const BLOOM_MULTIPLIERS: Record<string, number> = {
  RECALL:        1.0,
  COMPREHENSION: 1.2,
  APPLICATION:   1.5,
  ANALYSIS:      1.8,
  SYNTHESIS:     2.0,
  EVALUATION:    2.0,
};

const DEFAULT_SJT_BEST_WEIGHT  = 0.60;
const DEFAULT_SJT_WORST_WEIGHT = 0.40;

const DEFAULT_FR_WEIGHTS: Record<string, number> = {
  FR_AIF: 0.25,
  FR_DGA: 0.20,
  FR_LAG: 0.25,
  FR_SYS: 0.15,
  FR_FUT: 0.15,
};

const THETA_GRID_MIN   = -4.0;
const THETA_GRID_MAX   = +4.0;
const THETA_GRID_STEPS = 81;   // step 0.1

// ── IRT 3PL Core ─────────────────────────────────────────────

/**
 * 3PL probability of correct response given theta and item parameters.
 */
export function irt3PLProbability(theta: number, a: number, b: number, c: number): number {
  const exponent = -IRT_D * a * (theta - b);
  return c + (1 - c) / (1 + Math.exp(exponent));
}

/**
 * Item information function at theta.
 * Higher = this item is more precise at this ability level.
 */
export function irtItemInformation(theta: number, a: number, b: number, c: number): number {
  const p = irt3PLProbability(theta, a, b, c);
  if (p <= 0 || p >= 1) return 0;
  const numerator   = IRT_D * IRT_D * a * a * (p - c) * (p - c) * (1 - p);
  const denominator = (1 - c) * (1 - c) * p;
  return numerator / denominator;
}

/**
 * EAP (Expected A Posteriori) theta estimation.
 * Uses a normal N(prior_mean, prior_sd²) prior and updates with item likelihoods.
 */
export function eapThetaEstimate(
  history: Array<{ a: number; b: number; c: number; raw_score: number }>,
  priorMean: number = 0.0,
  priorSd:   number = 1.0,
): EAPResult {
  const step = (THETA_GRID_MAX - THETA_GRID_MIN) / (THETA_GRID_STEPS - 1);
  const grid = Array.from({ length: THETA_GRID_STEPS }, (_, i) => THETA_GRID_MIN + i * step);

  const logPosterior = grid.map(theta => {
    // log prior
    const logPrior = -0.5 * Math.pow((theta - priorMean) / priorSd, 2);

    // log likelihood across all items
    let logL = 0;
    for (const item of history) {
      const p = irt3PLProbability(theta, item.a, item.b, item.c);
      const clampedP = Math.max(1e-9, Math.min(1 - 1e-9, p));
      // raw_score is 0 or 1 for dichotomous items
      const responded = item.raw_score > 0.5 ? 1 : 0;
      logL += responded * Math.log(clampedP) + (1 - responded) * Math.log(1 - clampedP);
    }
    return logPrior + logL;
  });

  // softmax for numerical stability
  const maxLog = Math.max(...logPosterior);
  const posterior = logPosterior.map(lp => Math.exp(lp - maxLog));
  const posteriorSum = posterior.reduce((s, v) => s + v, 0);
  const normalised = posterior.map(p => p / posteriorSum);

  const thetaHat = grid.reduce((sum, th, i) => sum + th * normalised[i], 0);
  const variance  = grid.reduce((sum, th, i) => sum + normalised[i] * Math.pow(th - thetaHat, 2), 0);
  const se = Math.sqrt(variance);

  return { theta: thetaHat, se };
}

/**
 * Map IRT theta estimate to a 0–100 scaled score.
 * Maps N(0,1) trait → mean=50, SD=15 (like a T-score).
 */
export function thetaToScaledScore(theta: number): number {
  return Math.max(0, Math.min(100, 50 + theta * 15));
}

// ── Per-Response Immediate Scoring ──────────────────────────

export function scoreResponse(
  question: CAFQuestion,
  responseValue: Record<string, unknown>,
  cfg?: ScoringConfig,
): number | null {
  const type = question.question_type;

  switch (type) {
    case 'MCQ':
    case 'SCENARIO_MCQ':
    case 'DATA_INTERPRETATION': {
      const optionId = responseValue['selected_option_id'] as string;
      const option = question.options?.find(o => o.id === optionId);
      if (!option) return 0;
      let score = option.is_correct ? 1.0 : 0.0;
      // polarity flip
      if (question.reverse_score) score = 1.0 - score;
      return score;
    }

    case 'MULTI_SELECT': {
      const selected = (responseValue['selected_ids'] as string[]) ?? [];
      const correct  = question.options?.filter(o => o.is_correct).map(o => o.id) ?? [];
      if (correct.length === 0) return 0;
      const truePos  = selected.filter(id => correct.includes(id)).length;
      const falsePos = selected.filter(id => !correct.includes(id)).length;
      // Jaccard similarity
      const union = correct.length + falsePos;
      return union === 0 ? 0 : truePos / union;
    }

    case 'LIKERT': {
      const rating = responseValue['rating'] as number;
      let score = (rating - 1) / 4;       // [0,1]
      if (question.reverse_score) score = 1.0 - score;
      return score;
    }

    case 'BARS_RATING': {
      const level = responseValue['level'] as number;
      const rubric = question.rubric;
      if (!rubric) return (level - 1) / 4;
      const entry = rubric.levels.find(l => l.level === level);
      return entry ? entry.score / 100 : (level - 1) / 4;
    }

    case 'SITUATIONAL_JUDGMENT': {
      const bestId  = responseValue['best_id'] as string;
      const worstId = responseValue['worst_id'] as string;
      if (!question.expert_key) return null;
      const bestScores  = question.expert_key.best_option_scores;
      const worstScores = question.expert_key.worst_option_scores;
      const maxKey      = Math.max(...Object.values(bestScores));
      const bestW  = cfg?.sjt_best_weight  ?? DEFAULT_SJT_BEST_WEIGHT;
      const worstW = cfg?.sjt_worst_weight ?? DEFAULT_SJT_WORST_WEIGHT;
      const bestScore  = (bestScores[bestId]  ?? 0) * bestW;
      const worstScore = ((maxKey - (worstScores[worstId] ?? 0)) * worstW);
      return (bestScore + worstScore) / ((maxKey * bestW) + (maxKey * worstW));
    }

    case 'PRIORITIZATION': {
      const rankings   = responseValue['rankings'] as Array<{ id: string; rank: number }>;
      const expertKey  = question.expert_key;
      if (!expertKey || !rankings.length) return null;
      const expertRanks: Record<string, number> = expertKey.best_option_scores;
      const rho = spearmanRho(rankings, expertRanks);
      return (rho + 1) / 2;               // normalise to [0,1]
    }

    case 'KNOWLEDGE_PROBE': {
      const answer     = responseValue['answer'] as boolean;
      const confidence = responseValue['confidence'] as number;  // 1–5
      // Map confidence to probability: 1→0.50, 2→0.60, 3→0.70, 4→0.80, 5→0.95
      const confMap: Record<number, number> = { 1: 0.50, 2: 0.60, 3: 0.70, 4: 0.80, 5: 0.95 };
      const p = confMap[confidence] ?? 0.60;
      const outcome = answer ? 1 : 0;
      const brier = Math.pow(p - outcome, 2);
      return 1 - brier;
    }

    case 'COMPARATIVE_JUDGMENT': {
      // Requires aggregate Bradley-Terry model; return null for immediate scoring,
      // computed in batch analytics pass
      return null;
    }

    case 'OPEN_RUBRIC': {
      // Requires human/AI rubric grading; null until external grader scores it
      return null;
    }

    default:
      return null;
  }
}

// ── Spearman Rank Correlation ────────────────────────────────

function spearmanRho(
  userRankings: Array<{ id: string; rank: number }>,
  expertRanks:  Record<string, number>,
): number {
  const n = userRankings.length;
  if (n < 2) return 1;
  let sumD2 = 0;
  for (const { id, rank } of userRankings) {
    const expertRank = expertRanks[id] ?? n;
    sumD2 += Math.pow(rank - expertRank, 2);
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

// ── Domain Score Aggregators ─────────────────────────────────

function groupByDomain(
  responses: CAFResponse[],
  questions: CAFQuestion[],
): Record<string, Array<{ response: CAFResponse; question: CAFQuestion }>> {
  const qMap = new Map(questions.map(q => [q.id, q]));
  const out: Record<string, Array<{ response: CAFResponse; question: CAFQuestion }>> = {};
  for (const r of responses) {
    const q = qMap.get(r.question_id);
    if (!q) continue;
    const d = q.domain_code;
    if (!out[d]) out[d] = [];
    out[d].push({ response: r, question: q });
  }
  return out;
}

function weightedMean(items: Array<{ score: number; weight: number }>): number {
  const sumW = items.reduce((s, i) => s + i.weight, 0);
  if (sumW === 0) return 0;
  return items.reduce((s, i) => s + i.score * i.weight, 0) / sumW;
}

// ── BEHAVIORAL: BARS Rubric ──────────────────────────────────

function scoreBehavioral(
  responses: CAFResponse[],
  questions: CAFQuestion[],
  cfg: ScoringConfig,
): Record<string, number> {
  const grouped = groupByDomain(responses, questions);
  const scores: Record<string, number> = {};
  for (const [domain, items] of Object.entries(grouped)) {
    const weighted = items
      .filter(({ response }) => response.raw_score !== null)
      .map(({ response, question }) => ({
        score:  (response.raw_score as number) * 100,   // raw is [0,1]
        weight: question.importance_weight,
      }));
    scores[domain] = weighted.length ? weightedMean(weighted) : 0;
  }
  return scores;
}

// ── FUNCTIONAL: Weighted CTT with Bloom multipliers ──────────

function scoreFunctional(
  responses: CAFResponse[],
  questions: CAFQuestion[],
  cfg: ScoringConfig,
): Record<string, number> {
  const grouped = groupByDomain(responses, questions);
  const scores: Record<string, number> = {};
  for (const [domain, items] of Object.entries(grouped)) {
    const weighted = items
      .filter(({ response }) => response.raw_score !== null)
      .map(({ response, question }) => {
        const bloom = BLOOM_MULTIPLIERS[question.cognitive_level ?? 'APPLICATION'] ?? 1.0;
        return {
          score:  (response.raw_score as number) * 100,
          weight: question.importance_weight * bloom,
        };
      });
    scores[domain] = weighted.length ? weightedMean(weighted) : 0;
  }
  return scores;
}

// ── COGNITIVE: IRT 3PL with EAP ─────────────────────────────

function scoreCognitive(
  responses: CAFResponse[],
  questions: CAFQuestion[],
  cfg: ScoringConfig,
  adaptiveState: AdaptiveState,
): Record<string, number> {
  const priorMean = cfg.theta_prior_mean ?? 0.0;
  const priorSd   = cfg.theta_prior_sd   ?? 1.0;

  // Build IRT history from calibrated items only
  const qMap = new Map(questions.map(q => [q.id, q]));
  const calibratedHistory = responses
    .filter(r => {
      const q = qMap.get(r.question_id);
      return q && q.irt_a !== null && r.raw_score !== null;
    })
    .map(r => {
      const q = qMap.get(r.question_id)!;
      return { a: q.irt_a!, b: q.irt_b!, c: q.irt_c, raw_score: r.raw_score as number };
    });

  // Overall theta
  const overallEAP = calibratedHistory.length > 0
    ? eapThetaEstimate(calibratedHistory, priorMean, priorSd)
    : { theta: adaptiveState.theta, se: adaptiveState.se };

  // Per-domain thetas
  const grouped = groupByDomain(responses, questions);
  const scores: Record<string, number> = {};

  for (const [domain, items] of Object.entries(grouped)) {
    const domainHistory = items
      .filter(({ response, question }) => question.irt_a !== null && response.raw_score !== null)
      .map(({ response, question }) => ({
        a: question.irt_a!, b: question.irt_b!, c: question.irt_c, raw_score: response.raw_score as number,
      }));

    const domainEAP = domainHistory.length >= 3
      ? eapThetaEstimate(domainHistory, priorMean, priorSd)
      : overallEAP;

    scores[domain] = thetaToScaledScore(domainEAP.theta);
  }

  return scores;
}

// ── LEADERSHIP: SJT Expert Key + BARS Hybrid ─────────────────

function scoreLeadership(
  responses: CAFResponse[],
  questions: CAFQuestion[],
  cfg: ScoringConfig,
): Record<string, number> {
  const grouped = groupByDomain(responses, questions);
  const scores: Record<string, number> = {};

  for (const [domain, items] of Object.entries(grouped)) {
    const sjtItems  = items.filter(({ question }) => question.question_type === 'SITUATIONAL_JUDGMENT');
    const barsItems = items.filter(({ question }) => question.question_type === 'BARS_RATING');
    const otherItems = items.filter(({ question }) =>
      question.question_type !== 'SITUATIONAL_JUDGMENT' && question.question_type !== 'BARS_RATING'
    );

    const sjtW  = cfg.sjt_best_weight  ?? DEFAULT_SJT_BEST_WEIGHT;
    const barsW = 1 - sjtW;

    const validSJT  = sjtItems.filter(({ response }) => response.raw_score !== null);
    const validBARS = barsItems.filter(({ response }) => response.raw_score !== null);

    const sjtScore  = validSJT.length  ? validSJT.reduce((s, { response }) => s + (response.raw_score as number) * 100, 0)  / validSJT.length  : null;
    const barsScore = validBARS.length ? validBARS.reduce((s, { response }) => s + (response.raw_score as number) * 100, 0) / validBARS.length : null;

    if (sjtScore !== null && barsScore !== null) {
      scores[domain] = sjtW * sjtScore + barsW * barsScore;
    } else if (sjtScore !== null) {
      scores[domain] = sjtScore;
    } else if (barsScore !== null) {
      scores[domain] = barsScore;
    } else {
      // fallback to other scored items
      const fallback = otherItems.filter(({ response }) => response.raw_score !== null)
        .map(({ response }) => (response.raw_score as number) * 100);
      scores[domain] = fallback.length ? fallback.reduce((a, b) => a + b, 0) / fallback.length : 0;
    }
  }

  return scores;
}

// ── FUTURE_READINESS: Dimensional ────────────────────────────

function scoreFutureReadiness(
  responses: CAFResponse[],
  questions: CAFQuestion[],
  cfg: ScoringConfig,
): Record<string, number> {
  const dimWeights = cfg.dimension_weights ?? DEFAULT_FR_WEIGHTS;
  const grouped = groupByDomain(responses, questions);
  const scores: Record<string, number> = {};

  for (const [dim, items] of Object.entries(grouped)) {
    const valid = items.filter(({ response }) => response.raw_score !== null);
    scores[dim] = valid.length
      ? valid.reduce((s, { response }) => s + (response.raw_score as number) * 100, 0) / valid.length
      : 0;
  }

  // Future Readiness Index (FRI)
  const domainsList = Object.keys(scores);
  if (domainsList.length) {
    const fri = domainsList.reduce((sum, dim) => {
      const w = dimWeights[dim] ?? (1 / domainsList.length);
      return sum + (scores[dim] ?? 0) * w;
    }, 0);
    scores['__FRI__'] = fri;
  }

  return scores;
}

// ── Level Code Assignment ────────────────────────────────────

export function assignLevelCode(score: number, bandThresholds: Record<LevelCode, { min: number; max: number }>): LevelCode {
  const levels: LevelCode[] = ['L5', 'L4', 'L3', 'L2', 'L1'];
  for (const level of levels) {
    const band = bandThresholds[level];
    if (band && score >= band.min) return level;
  }
  return 'L1';
}

// ── Main Finalization Pipeline ────────────────────────────────

export interface ScoreFinalizationInput {
  session_id:        string;
  assessment:        CAFAssessment;
  responses:         CAFResponse[];
  questions:         CAFQuestion[];
  adaptive_state:    AdaptiveState;
  band_thresholds:   Record<LevelCode, { min: number; max: number }>;
  domain_weights:    Record<string, number>;
}

export interface FinalizationResult {
  domain_scores:  DomainScore[];
  overall_score:  number;
  level_code:     LevelCode;
  completeness:   number;
  is_complete:    boolean;
  theta_estimate?: number;
  theta_se?:       number;
}

export function finalizeScores(input: ScoreFinalizationInput): FinalizationResult {
  const { assessment, responses, questions, adaptive_state, band_thresholds, domain_weights } = input;

  // 1. Completeness check
  const n_total    = assessment.total_questions;
  const n_answered = responses.filter(r => !r.is_skipped && r.raw_score !== null).length;
  const completeness = n_total > 0 ? n_answered / n_total : 0;
  const is_complete  = completeness >= 0.60;

  // 2. Apply polarity reversal (already done at response capture; double-check)
  const processed = responses.map(r => {
    const q = questions.find(q => q.id === r.question_id);
    if (q?.reverse_score && r.raw_score !== null) {
      return { ...r, raw_score: 1.0 - r.raw_score };
    }
    return r;
  });

  // 3. Type-specific domain scoring
  const cfg = assessment.scoring_config;
  let rawDomainScores: Record<string, number>;

  switch (assessment.assessment_type) {
    case 'behavioral':
      rawDomainScores = scoreBehavioral(processed, questions, cfg);
      break;
    case 'functional':
      rawDomainScores = scoreFunctional(processed, questions, cfg);
      break;
    case 'cognitive':
      rawDomainScores = scoreCognitive(processed, questions, cfg, adaptive_state);
      break;
    case 'leadership':
      rawDomainScores = scoreLeadership(processed, questions, cfg);
      break;
    case 'future_readiness':
      rawDomainScores = scoreFutureReadiness(processed, questions, cfg);
      break;
    default:
      rawDomainScores = {};
  }

  // 4. Build domain score objects
  const domainScores: DomainScore[] = Object.entries(rawDomainScores)
    .filter(([code]) => code !== '__FRI__')
    .map(([domain_code, scaled_score]) => ({
      domain_code,
      raw_score:    scaled_score,
      scaled_score: Math.round(scaled_score * 10) / 10,
      level_code:   assignLevelCode(scaled_score, band_thresholds),
      is_primary:   true,
    }));

  // 5. Overall composite score (weighted domain mean)
  const allDomains = domainScores.map(d => d.domain_code);
  const totalWeight = allDomains.reduce((s, d) => s + (domain_weights[d] ?? 1), 0);
  const overallScore = totalWeight > 0
    ? allDomains.reduce((s, d) => {
        const ds = domainScores.find(x => x.domain_code === d);
        return s + (ds?.scaled_score ?? 0) * (domain_weights[d] ?? 1);
      }, 0) / totalWeight
    : domainScores.length > 0
      ? domainScores.reduce((s, d) => s + d.scaled_score, 0) / domainScores.length
      : 0;

  const overallLevel = assignLevelCode(overallScore, band_thresholds);

  // 6. IRT overall theta (cognitive only, from adaptive_state if available)
  const thetaEstimate = assessment.assessment_type === 'cognitive' ? adaptive_state.theta   : undefined;
  const thetaSe       = assessment.assessment_type === 'cognitive' ? adaptive_state.se      : undefined;

  return {
    domain_scores:   domainScores,
    overall_score:   Math.round(overallScore * 10) / 10,
    level_code:      overallLevel,
    completeness,
    is_complete,
    theta_estimate:  thetaEstimate,
    theta_se:        thetaSe,
  };
}
