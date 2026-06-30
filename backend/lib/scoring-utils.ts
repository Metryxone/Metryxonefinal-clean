/**
 * backend/lib/scoring-utils.ts
 * Shared scoring utilities used by CAPADEX session complete and CSI recalculation.
 * Provides deterministic score normalisation, stage-weighted aggregation,
 * and a structured score_trace JSONB that powers explainability UI.
 */
import { STAGE_CODE_TO_LABEL, normalizeStoredStage, type LifecycleStageCode } from './lifecycle';

/**
 * Normalise a single Likert-scale item response (1–5) to 0–100,
 * applying polarity flip and item weight.
 * Used by CAPADEX /respond handler and any other engine handling 1–5 response scales.
 *
 * polarity '+' (or '(+)'): higher response → higher score
 * polarity '-' (or '(-)'): higher response → lower score (inverted)
 */
export function computeItemScore(
  responseValue: number,
  polarity: string,
  weight: number
): { rawNorm: number; weighted: number } {
  const rawNorm    = ((responseValue - 1) / 4) * 100;
  const isPositive = !polarity.includes('-');
  const weighted   = isPositive ? rawNorm * weight : (100 - rawNorm) * weight;
  return { rawNorm, weighted };
}

export interface SubdomainResult {
  subdomain_code: string;
  subdomain_name: string;
  avg_score: number;
  item_count: number;
}

export interface StageContribution {
  stage_code: string;
  stage_label: string;
  raw_score: number;
  weight: number;
  weighted_contribution: number;
}

export interface ScoreTrace {
  version: 1;
  computed_at: string;

  // Session-level trace (filled by session/complete)
  session?: {
    session_id: string;
    stage_code: string;
    total_responses: number;
    total_weighted: number;
    max_possible: number;
    norm_score: number;
    subdomains: SubdomainResult[];
    formula: string;
  };

  // CSI-level trace (filled by recalculateCSI)
  csi?: {
    sessions_used: number;
    stage_contributions: StageContribution[];
    weighted_sum: number;
    weight_total: number;
    csi_score: number;
    formula: string;
  };
}

// CSI stage-progression weights, keyed by canonical code. The INPUT stage value is
// resolved through the shared lifecycle rulebook (`normalizeStoredStage`) so a label,
// display alias, or CAP_* code all weight identically — no per-module literal can drift.
const WEIGHT_BY_CODE: Record<LifecycleStageCode, number> = {
  CAP_CUR: 0.50,
  CAP_INS: 0.75,
  CAP_GRW: 1.00,
  CAP_MAS: 1.25,
};

/**
 * Stage-progression weight for a stored stage value, via the canonical resolver.
 * Unrecognized / uncoded pre-stage inputs fall back to 0.5 (the legacy default),
 * preserving byte-identical behaviour on the CAP_* codes that actually occur.
 */
function stageWeight(stage: string | null | undefined): number {
  const { code } = normalizeStoredStage(stage);
  return code ? WEIGHT_BY_CODE[code] : 0.5;
}

// Canonical stage labels — sourced from the single lifecycle source of truth.
const STAGE_LABEL_MAP: Record<string, string> = STAGE_CODE_TO_LABEL;

/**
 * Normalise a sum of weighted scores to 0-100.
 * totalWeighted: sum of weighted_score values from capadex_responses
 * responseCount: number of responses (each worth up to 100 points)
 */
export function computeNormScore(totalWeighted: number, responseCount: number): number {
  if (responseCount === 0) return 0;
  const maxPossible = responseCount * 100;
  return Math.min(100, Math.round((totalWeighted / maxPossible) * 100));
}

/**
 * Compute the stage-weighted CSI score from an array of completed sessions.
 * Returns the CSI score plus a detailed trace of every stage's contribution.
 */
export function computeCSIScore(
  sessions: Array<{ id: string; stage_code: string; score: string | number }>
): { csiScore: number; trace: ScoreTrace['csi'] } {
  let weightedSum = 0;
  let weightTotal = 0;
  const stageContributions: StageContribution[] = [];

  for (const s of sessions) {
    const rawScore = parseFloat(String(s.score || '0'));
    const weight   = stageWeight(s.stage_code);
    const contribution = rawScore * weight;
    weightedSum += contribution;
    weightTotal += weight;
    stageContributions.push({
      stage_code:            s.stage_code,
      stage_label:           STAGE_LABEL_MAP[s.stage_code] ?? s.stage_code,
      raw_score:             Math.round(rawScore),
      weight,
      weighted_contribution: Math.round(contribution * 10) / 10,
    });
  }

  const csiScore = weightTotal > 0
    ? Math.min(100, Math.round(weightedSum / weightTotal))
    : 0;

  return {
    csiScore,
    trace: {
      sessions_used:       sessions.length,
      stage_contributions: stageContributions,
      weighted_sum:        Math.round(weightedSum * 10) / 10,
      weight_total:        Math.round(weightTotal * 10) / 10,
      csi_score:           csiScore,
      formula:             'CSI = Σ(stage_score × stage_weight) / Σ(stage_weights). Weights: CAP_CUR×0.50, CAP_INS×0.75, CAP_GRW×1.00, CAP_MAS×1.25',
    },
  };
}

/**
 * Build a complete ScoreTrace for a single CAPADEX session.
 */
export function buildSessionScoreTrace(opts: {
  sessionId: string;
  stageCode: string;
  totalWeighted: number;
  responseCount: number;
  normScore: number;
  subdomains: SubdomainResult[];
}): ScoreTrace {
  return {
    version:     1,
    computed_at: new Date().toISOString(),
    session: {
      session_id:       opts.sessionId,
      stage_code:       opts.stageCode,
      total_responses:  opts.responseCount,
      total_weighted:   Math.round(opts.totalWeighted * 10) / 10,
      max_possible:     opts.responseCount * 100,
      norm_score:       opts.normScore,
      subdomains:       opts.subdomains,
      formula:          'score = min(100, round(Σ(weighted_score) / (n_responses × 100) × 100))',
    },
  };
}

/**
 * Build a complete ScoreTrace for a CSI recalculation.
 */
export function buildCSIScoreTrace(
  csiTrace: ScoreTrace['csi']
): ScoreTrace {
  return {
    version:     1,
    computed_at: new Date().toISOString(),
    csi:         csiTrace,
  };
}

/**
 * Generic score trace builder — matches the task-spec API:
 * buildScoreTrace(formula, inputs, weights, computed_at?)
 *
 * Returns a structured object suitable for storing as JSONB on any score table.
 */
export function buildScoreTrace(
  formula: string,
  inputs: Record<string, number | string>,
  weights: Record<string, number>,
  computed_at?: string
): { version: 1; formula: string; inputs: Record<string, number | string>; weights: Record<string, number>; computed_at: string } {
  return {
    version:     1,
    formula,
    inputs,
    weights,
    computed_at: computed_at ?? new Date().toISOString(),
  };
}
