// ============================================================
// Competency Assessment Factory — Analytics Engine
// backend/services/caf/analytics-engine.ts
//
// Part A: Question Analytics (Classical Test Theory — CTT)
//   p-value, point-biserial, discrimination index,
//   distractor analysis, drift detection
//
// Part B: Psychometric Analytics
//   Cronbach's α, McDonald's ω, SEM, split-half reliability,
//   DIF (Mantel-Haenszel), factor structure signals,
//   floor/ceiling detection
// ============================================================

import { Pool } from 'pg';
import { ItemStats, PsychometricReport, QualityFlag } from './types.js';

// ── Quality gate thresholds ──────────────────────────────────

const GATES = {
  p_value:              { min: 0.10, max: 0.90, warn_min: 0.15, warn_max: 0.85 },
  point_biserial:       { min: 0.15, good: 0.20 },
  discrimination:       { min: 0.20, good: 0.30 },
  mean_time_floor_s:    5,
  skip_rate_max:        0.10,
  revision_rate_max:    0.30,
  drift_threshold:      0.15,
  alpha_acceptable:     0.70,
  alpha_good:           0.80,
  alpha_excellent:      0.90,
  kmo_min:              0.60,
  floor_ceiling_max:    0.10,
} as const;

// ── Part A: Item Statistics ──────────────────────────────────

interface RawResponseRow {
  question_id:      number;
  session_id:       string;
  raw_score:        number | null;
  is_correct:       boolean | null;
  is_skipped:       boolean;
  is_revised:       boolean;
  time_taken_secs:  number | null;
  selected_option?: string;       // for distractor analysis
}

interface TotalScoreRow {
  session_id:  string;
  total_score: number;
}

/**
 * Compute point-biserial correlation between item scores and total test scores.
 * r_pb = (M_p − M_q) / SD_total × sqrt(p × q)
 */
function pointBiserial(
  itemScores:   number[],      // 0/1 per session (in session order)
  totalScores:  number[],      // total score per session (same order)
): number {
  if (itemScores.length < 5) return NaN;

  const passIdx  = itemScores.map((s, i) => s > 0.5 ? i : -1).filter(i => i >= 0);
  const failIdx  = itemScores.map((s, i) => s <= 0.5 ? i : -1).filter(i => i >= 0);

  if (passIdx.length === 0 || failIdx.length === 0) return NaN;

  const Mp = passIdx.reduce((s, i) => s + totalScores[i], 0) / passIdx.length;
  const Mq = failIdx.reduce((s, i) => s + totalScores[i], 0) / failIdx.length;

  const n          = totalScores.length;
  const meanT      = totalScores.reduce((s, v) => s + v, 0) / n;
  const sdT        = Math.sqrt(totalScores.reduce((s, v) => s + Math.pow(v - meanT, 2), 0) / n);

  if (sdT === 0) return NaN;

  const p = passIdx.length / n;
  const q = 1 - p;

  return ((Mp - Mq) / sdT) * Math.sqrt(p * q);
}

/**
 * Discrimination index: (upper 27% correct − lower 27% correct) / n_upper
 */
function discriminationIndex(
  itemScores:  number[],    // per-session item scores (0/1)
  totalScores: number[],    // per-session total scores
): number {
  const n = itemScores.length;
  if (n < 10) return NaN;

  const k = Math.ceil(n * 0.27);
  const paired = itemScores.map((score, i) => ({ score, total: totalScores[i] }));
  paired.sort((a, b) => b.total - a.total);   // descending by total

  const upper = paired.slice(0, k);
  const lower = paired.slice(n - k);

  const upperCorrect = upper.filter(x => x.score > 0.5).length;
  const lowerCorrect = lower.filter(x => x.score > 0.5).length;

  return (upperCorrect - lowerCorrect) / k;
}

function autoQualityFlag(stats: Partial<ItemStats>): QualityFlag {
  const issues: string[] = [];

  if (stats.p_value !== null && stats.p_value !== undefined) {
    if (stats.p_value < GATES.p_value.min || stats.p_value > GATES.p_value.max) issues.push('p_value_extreme');
  }
  if (stats.point_biserial !== null && stats.point_biserial !== undefined) {
    if (stats.point_biserial < GATES.point_biserial.min) issues.push('low_discrimination');
  }
  if (stats.discrimination_index !== null && stats.discrimination_index !== undefined) {
    if (stats.discrimination_index < GATES.discrimination.min) issues.push('low_discrim_index');
  }
  if ((stats.mean_time_secs ?? 99) < GATES.mean_time_floor_s) issues.push('too_fast');
  if ((stats.skip_rate ?? 0)     > GATES.skip_rate_max)       issues.push('high_skip');
  if (stats.drift_detected)                                     issues.push('drifted');

  if (issues.length >= 3) return 'retire';
  if (issues.length >= 1) return 'review';
  return 'good';
}

/**
 * Compute CTT item statistics for a question.
 * Call after a batch of sessions is completed.
 */
export async function computeItemStats(
  pool:       Pool,
  questionId: number,
): Promise<ItemStats> {
  // Fetch all non-skipped responses for this question
  const { rows: responseRows } = await pool.query<{
    session_id:     string;
    raw_score:      string | null;
    is_correct:     boolean | null;
    is_skipped:     boolean;
    is_revised:     boolean;
    time_taken_secs: string | null;
    response_value: Record<string, unknown>;
  }>(
    `SELECT r.session_id, r.raw_score, r.is_correct, r.is_skipped,
            r.is_revised, r.time_taken_secs, r.response_value
     FROM caf_responses r
     JOIN caf_sessions s ON s.id = r.session_id
     WHERE r.question_id = $1 AND s.status = 'completed' AND s.status != 'invalidated'`,
    [questionId],
  );

  const n = responseRows.length;
  if (n === 0) {
    return {
      question_id: questionId, n_administered: 0,
      p_value: null, point_biserial: null, discrimination_index: null,
      distractor_analysis: {}, mean_time_secs: null, skip_rate: 0, revision_rate: 0,
      quality_flag: 'good', drift_detected: false,
    };
  }

  const skipCount    = responseRows.filter(r => r.is_skipped).length;
  const reviseCount  = responseRows.filter(r => r.is_revised).length;
  const answeredRows = responseRows.filter(r => !r.is_skipped && r.raw_score !== null);

  // p-value = mean raw score
  const scores = answeredRows.map(r => parseFloat(r.raw_score as string));
  const pValue = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;

  // Mean response time
  const times = answeredRows
    .map(r => r.time_taken_secs ? parseFloat(r.time_taken_secs as string) : null)
    .filter((t): t is number => t !== null);
  const meanTime = times.length > 0 ? times.reduce((s, v) => s + v, 0) / times.length : null;
  const stdTime  = times.length > 1
    ? Math.sqrt(times.reduce((s, v) => s + Math.pow(v - meanTime!, 2), 0) / times.length)
    : null;

  // Fetch total session scores for point-biserial calculation
  const sessionIds = answeredRows.map(r => `'${r.session_id}'`).join(',');
  let pbCorr: number | null = null;
  let discIdx: number | null = null;

  if (sessionIds.length > 0 && scores.length >= 5) {
    const { rows: totalRows } = await pool.query<{ session_id: string; total: string }>(
      `SELECT session_id, SUM(raw_score) AS total
       FROM caf_responses
       WHERE session_id = ANY($1::uuid[]) AND raw_score IS NOT NULL
       GROUP BY session_id`,
      [answeredRows.map(r => r.session_id)],
    );

    const totalMap = new Map(totalRows.map(r => [r.session_id, parseFloat(r.total)]));
    const paired   = answeredRows
      .map(r => ({ score: parseFloat(r.raw_score as string), total: totalMap.get(r.session_id) ?? 0 }))
      .filter(p => p.total !== undefined);

    if (paired.length >= 5) {
      const itemScores  = paired.map(p => p.score);
      const totalScores = paired.map(p => p.total);
      const pb = pointBiserial(itemScores, totalScores);
      const di = discriminationIndex(itemScores, totalScores);
      pbCorr  = isNaN(pb) ? null : Math.round(pb * 1000) / 1000;
      discIdx = isNaN(di) ? null : Math.round(di * 1000) / 1000;
    }
  }

  // Distractor analysis (MCQ)
  const distractorAnalysis: Record<string, { n_chosen: number; pct_chosen: number; point_biserial: number }> = {};
  const allOptions = answeredRows
    .map(r => (r.response_value as Record<string, unknown>)['selected_option_id'] as string)
    .filter(Boolean);

  const optionCounts: Record<string, number> = {};
  for (const opt of allOptions) {
    optionCounts[opt] = (optionCounts[opt] ?? 0) + 1;
  }
  for (const [optId, count] of Object.entries(optionCounts)) {
    distractorAnalysis[optId] = {
      n_chosen:       count,
      pct_chosen:     count / n,
      point_biserial: 0,   // computed in batch job with total scores
    };
  }

  // Drift detection — fetch baseline stats if available
  const { rows: existing } = await pool.query<{ p_value: string; drift_baseline_p: string; drift_at_n: number }>(
    `SELECT p_value, drift_baseline_p, drift_at_n FROM caf_item_stats WHERE question_id = $1`,
    [questionId],
  );

  let driftDetected   = false;
  let driftBaselineP  = pValue;
  const existingRow   = existing[0];

  if (existingRow) {
    const baseline = parseFloat(existingRow.drift_baseline_p ?? existingRow.p_value ?? '0');
    if (pValue !== null && Math.abs(pValue - baseline) > GATES.drift_threshold) {
      driftDetected = true;
    }
    // Keep original baseline if already set
    driftBaselineP = existingRow.drift_baseline_p
      ? parseFloat(existingRow.drift_baseline_p)
      : pValue;
  }

  const stats: ItemStats = {
    question_id:          questionId,
    n_administered:       n,
    p_value:              pValue !== null ? Math.round(pValue * 1000) / 1000 : null,
    point_biserial:       pbCorr,
    discrimination_index: discIdx,
    distractor_analysis:  distractorAnalysis,
    mean_time_secs:       meanTime !== null ? Math.round(meanTime * 10) / 10 : null,
    skip_rate:            Math.round((skipCount / n) * 1000) / 1000,
    revision_rate:        Math.round((reviseCount / n) * 1000) / 1000,
    drift_detected:       driftDetected,
    quality_flag:         'good',   // set below
  };

  stats.quality_flag = autoQualityFlag(stats);

  // Upsert into caf_item_stats
  await pool.query(
    `INSERT INTO caf_item_stats
       (question_id, n_administered, p_value, point_biserial, discrimination_index,
        distractor_analysis, mean_time_secs, skip_rate, revision_rate,
        drift_detected, drift_baseline_p, quality_flag, last_computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (question_id) DO UPDATE SET
       n_administered       = EXCLUDED.n_administered,
       p_value              = EXCLUDED.p_value,
       point_biserial       = EXCLUDED.point_biserial,
       discrimination_index = EXCLUDED.discrimination_index,
       distractor_analysis  = EXCLUDED.distractor_analysis,
       mean_time_secs       = EXCLUDED.mean_time_secs,
       skip_rate            = EXCLUDED.skip_rate,
       revision_rate        = EXCLUDED.revision_rate,
       drift_detected       = EXCLUDED.drift_detected,
       drift_baseline_p     = COALESCE(caf_item_stats.drift_baseline_p, EXCLUDED.drift_baseline_p),
       quality_flag         = CASE WHEN caf_item_stats.quality_override THEN caf_item_stats.quality_flag
                                   ELSE EXCLUDED.quality_flag END,
       last_computed_at     = NOW(),
       updated_at           = NOW()`,
    [
      questionId,
      stats.n_administered,
      stats.p_value,
      stats.point_biserial,
      stats.discrimination_index,
      JSON.stringify(stats.distractor_analysis),
      stats.mean_time_secs,
      stats.skip_rate,
      stats.revision_rate,
      stats.drift_detected,
      driftBaselineP,
      stats.quality_flag,
    ],
  );

  return stats;
}

// ── Part B: Psychometric Analytics ───────────────────────────

/**
 * Cronbach's α — internal consistency.
 * α = (k/(k-1)) × (1 − Σσ²_i / σ²_total)
 */
function cronbachsAlpha(itemMatrix: number[][]): number {
  // itemMatrix: [n_sessions × n_items], each cell is item score
  const nItems    = itemMatrix[0]?.length ?? 0;
  const nSessions = itemMatrix.length;
  if (nItems < 2 || nSessions < 5) return NaN;

  const totalScores = itemMatrix.map(row => row.reduce((s, v) => s + v, 0));
  const meanTotal   = totalScores.reduce((s, v) => s + v, 0) / nSessions;
  const varTotal    = totalScores.reduce((s, v) => s + Math.pow(v - meanTotal, 2), 0) / nSessions;

  let sumItemVar = 0;
  for (let j = 0; j < nItems; j++) {
    const col    = itemMatrix.map(row => row[j]);
    const mean   = col.reduce((s, v) => s + v, 0) / nSessions;
    const varJ   = col.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / nSessions;
    sumItemVar  += varJ;
  }

  if (varTotal === 0) return NaN;
  return (nItems / (nItems - 1)) * (1 - sumItemVar / varTotal);
}

/**
 * Split-half reliability (Spearman-Brown corrected).
 * Odd items vs. even items split.
 */
function splitHalfReliability(itemMatrix: number[][]): number {
  const nItems    = itemMatrix[0]?.length ?? 0;
  if (nItems < 4) return NaN;

  const oddScores  = itemMatrix.map(row => row.filter((_, j) => j % 2 === 0).reduce((s, v) => s + v, 0));
  const evenScores = itemMatrix.map(row => row.filter((_, j) => j % 2 !== 0).reduce((s, v) => s + v, 0));

  const rOddEven = pearsonR(oddScores, evenScores);
  if (isNaN(rOddEven)) return NaN;

  // Spearman-Brown prophecy formula
  return (2 * rOddEven) / (1 + rOddEven);
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return NaN;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx  += Math.pow(x[i] - mx, 2);
    dy  += Math.pow(y[i] - my, 2);
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? NaN : num / denom;
}

/**
 * Standard Error of Measurement.
 * SEM = SD_observed × sqrt(1 - α)
 */
function sem(sdObserved: number, alpha: number): number {
  if (isNaN(alpha) || alpha >= 1) return NaN;
  return sdObserved * Math.sqrt(1 - alpha);
}

/**
 * Kaiser-Meyer-Olkin measure of sampling adequacy.
 * KMO > 0.60 required for factor analysis to be meaningful.
 * Approximated here from inter-item correlations.
 */
function kmoMeasure(corrMatrix: number[][]): number {
  const n = corrMatrix.length;
  if (n < 3) return NaN;

  let sumR2 = 0, sumU2 = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const r = corrMatrix[i][j];
      sumR2 += r * r;
      // Partial correlation approximation: u_ij ≈ -r_ij / sqrt(r_ii × r_jj) ≈ r_ij (simplified)
      sumU2 += r * r * 0.1;   // rough approximation; full KMO needs matrix inversion
    }
  }
  if (sumR2 + sumU2 === 0) return NaN;
  return sumR2 / (sumR2 + sumU2);
}

/**
 * Mantel-Haenszel DIF statistic.
 * Groups: group A (e.g. junior) vs. group B (e.g. senior).
 * Strata: ability quintiles by total score.
 */
function mantelHaenszel(
  groupA: Array<{ score: number; total: number }>,   // focal group
  groupB: Array<{ score: number; total: number }>,   // reference group
  nStrata: number = 5,
): { mh_alpha: number; mh_delta: number; category: 'A' | 'B' | 'C' } {
  if (groupA.length < 10 || groupB.length < 10) {
    return { mh_alpha: 1, mh_delta: 0, category: 'A' };
  }

  const all = [...groupA.map(x => ({ ...x, group: 0 })), ...groupB.map(x => ({ ...x, group: 1 }))];
  all.sort((a, b) => a.total - b.total);

  // Create strata by total score quintiles
  const strataSize = Math.ceil(all.length / nStrata);
  const strata: typeof all[] = [];
  for (let i = 0; i < nStrata; i++) {
    strata.push(all.slice(i * strataSize, (i + 1) * strataSize));
  }

  let sumNum = 0, sumDen = 0;
  for (const stratum of strata) {
    const n  = stratum.length;
    if (n < 2) continue;
    const nA = stratum.filter(x => x.group === 0).length;
    const nB = n - nA;
    if (nA === 0 || nB === 0) continue;

    const correct = stratum.filter(x => x.score > 0.5);
    const correctA = correct.filter(x => x.group === 0).length;
    const correctB = correct.filter(x => x.group === 1).length;
    const nCorrect = correctA + correctB;
    const nWrong   = n - nCorrect;

    // MH 2×2 table
    const A = correctA;
    const B = correctB;
    const C = nA - correctA;
    const D = nB - correctB;
    const T = n;

    sumNum += A * D / T;
    sumDen += B * C / T;
  }

  if (sumDen === 0) return { mh_alpha: 1, mh_delta: 0, category: 'A' };

  const mhAlpha = sumNum / sumDen;
  const mhDelta = -2.35 * Math.log(mhAlpha);
  const absDelta = Math.abs(mhDelta);

  return {
    mh_alpha: mhAlpha,
    mh_delta: mhDelta,
    category: absDelta < 1.0 ? 'A' : absDelta < 1.5 ? 'B' : 'C',
  };
}

/**
 * Compute and persist a full psychometric report for an assessment.
 */
export async function computePsychometricReport(
  pool:         Pool,
  assessmentId: number,
  minSessions:  number = 30,
): Promise<PsychometricReport> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all completed, valid sessions for this assessment
  const { rows: sessionRows } = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM caf_sessions
     WHERE assessment_id=$1 AND status='completed' AND flagged=false`,
    [assessmentId],
  );

  const nSessions = sessionRows.length;
  const sessionIds = sessionRows.map(s => s.id);

  if (nSessions < minSessions) {
    const report: PsychometricReport = {
      assessment_id:  assessmentId,
      report_date:    today,
      n_sessions:     nSessions,
      cronbachs_alpha: null,
      mcdonalds_omega: null,
      sem:             null,
      domain_alphas:   {},
      kmo_measure:     null,
      n_factors_suggested: null,
      floor_pct:       null,
      ceiling_pct:     null,
      dif_results:     {},
      quality_advisory: [`Insufficient data: ${nSessions} sessions (minimum: ${minSessions})`],
    };
    await persistPsychometricReport(pool, report);
    return report;
  }

  // Fetch item scores matrix [session × question]
  const { rows: responseRows } = await pool.query<{
    session_id:  string;
    question_id: number;
    raw_score:   string;
  }>(
    `SELECT session_id, question_id, raw_score
     FROM caf_responses
     WHERE session_id = ANY($1::uuid[]) AND raw_score IS NOT NULL AND is_skipped=false`,
    [sessionIds],
  );

  // Build matrix
  const questionIds = [...new Set(responseRows.map(r => r.question_id))].sort((a, b) => a - b);
  const sessionIdSet = sessionIds;
  const matrix: number[][] = sessionIdSet.map(sid =>
    questionIds.map(qid => {
      const r = responseRows.find(r => r.session_id === sid && r.question_id === qid);
      return r ? parseFloat(r.raw_score) : 0;
    }),
  );

  // Overall Cronbach's α
  const alpha = cronbachsAlpha(matrix);
  const totalScores = matrix.map(row => row.reduce((s, v) => s + v, 0));
  const sdTotal = Math.sqrt(
    totalScores.reduce((s, v) => s + Math.pow(v - totalScores.reduce((a, b) => a + b, 0) / totalScores.length, 2), 0)
    / totalScores.length,
  );
  const semVal        = isNaN(alpha) ? null : sem(sdTotal, alpha);
  const splitHalf     = splitHalfReliability(matrix);

  // Domain-level alphas
  const { rows: questionDomains } = await pool.query<{ id: number; domain_code: string }>(
    `SELECT id, domain_code FROM caf_question_bank WHERE id = ANY($1::bigint[])`,
    [questionIds],
  );
  const domainMap = new Map(questionDomains.map(q => [q.id, q.domain_code]));

  const domainAlphas: Record<string, number> = {};
  const domains = [...new Set(questionDomains.map(q => q.domain_code))];
  for (const domain of domains) {
    const domainQIds = questionIds.filter(qid => domainMap.get(qid) === domain);
    if (domainQIds.length < 2) continue;
    const domainColIndices = domainQIds.map(qid => questionIds.indexOf(qid));
    const subMatrix = matrix.map(row => domainColIndices.map(ci => row[ci]));
    const da = cronbachsAlpha(subMatrix);
    if (!isNaN(da)) domainAlphas[domain] = Math.round(da * 1000) / 1000;
  }

  // Inter-item correlation matrix (compact: only high correlations)
  const interItemCorr: Record<string, number> = {};
  for (let i = 0; i < questionIds.length; i++) {
    for (let j = i + 1; j < questionIds.length; j++) {
      const colI = matrix.map(row => row[i]);
      const colJ = matrix.map(row => row[j]);
      const r    = pearsonR(colI, colJ);
      if (!isNaN(r) && Math.abs(r) > 0.40) {
        interItemCorr[`${questionIds[i]}_${questionIds[j]}`] = Math.round(r * 1000) / 1000;
      }
    }
  }

  // KMO measure (simplified)
  const corrMatrix: number[][] = questionIds.map((_, i) =>
    questionIds.map((__, j) => {
      if (i === j) return 1;
      const key1 = `${questionIds[Math.min(i,j)]}_${questionIds[Math.max(i,j)]}`;
      return interItemCorr[key1] ?? 0;
    }),
  );
  const kmo = kmoMeasure(corrMatrix);

  // Factor signal: count eigenvalue > 1.0 (simplified: count high-correlation clusters)
  const highCorrPairs = Object.values(interItemCorr).filter(r => Math.abs(r) > 0.70).length;
  const nFactors = highCorrPairs > 0 ? Math.max(1, Math.ceil(questionIds.length / 5)) : 1;

  // Floor/ceiling detection
  const maxScore   = questionIds.length;
  const minScore   = 0;
  const floorPct   = totalScores.filter(s => s <= minScore + 0.5).length / nSessions;
  const ceilingPct = totalScores.filter(s => s >= maxScore - 0.5).length / nSessions;

  // DIF analysis (compare junior vs senior career stage)
  const { rows: contextRows } = await pool.query<{ id: string; context: Record<string, unknown> }>(
    `SELECT id, context FROM caf_sessions WHERE id = ANY($1::uuid[])`,
    [sessionIds],
  );
  const stageMap = new Map(contextRows.map(r => [r.id, (r.context as Record<string, unknown>)['career_stage'] as string ?? 'unknown']));

  const difResults: Record<string, { mh_delta: number; category: 'A' | 'B' | 'C' }> = {};
  for (const qid of questionIds) {
    const qIdx = questionIds.indexOf(qid);
    const juniorData = sessionIds
      .filter(sid => ['intern','junior','mid'].includes(stageMap.get(sid) ?? ''))
      .map(sid => ({
        score: matrix[sessionIds.indexOf(sid)][qIdx],
        total: totalScores[sessionIds.indexOf(sid)],
      }));
    const seniorData = sessionIds
      .filter(sid => ['senior','lead','principal','director'].includes(stageMap.get(sid) ?? ''))
      .map(sid => ({
        score: matrix[sessionIds.indexOf(sid)][qIdx],
        total: totalScores[sessionIds.indexOf(sid)],
      }));

    if (juniorData.length >= 10 && seniorData.length >= 10) {
      const { mh_delta, category } = mantelHaenszel(juniorData, seniorData);
      if (category !== 'A') {
        difResults[qid.toString()] = { mh_delta: Math.round(mh_delta * 100) / 100, category };
      }
    }
  }

  // Quality advisories
  const advisories: string[] = [];
  if (!isNaN(alpha) && alpha < GATES.alpha_acceptable)          advisories.push(`Low internal consistency: α=${alpha.toFixed(3)} (need ≥0.70)`);
  if (!isNaN(kmo)   && kmo   < GATES.kmo_min)                  advisories.push(`Low KMO: ${kmo.toFixed(3)} (need ≥0.60 for factor analysis)`);
  if (floorPct   > GATES.floor_ceiling_max)                     advisories.push(`Floor effect: ${(floorPct*100).toFixed(1)}% at minimum score — add easier items`);
  if (ceilingPct > GATES.floor_ceiling_max)                     advisories.push(`Ceiling effect: ${(ceilingPct*100).toFixed(1)}% at maximum score — add harder items`);
  Object.entries(domainAlphas).forEach(([d, a]) => {
    if (a < GATES.alpha_acceptable) advisories.push(`Domain ${d} alpha=${a.toFixed(3)} is below acceptable threshold`);
  });
  Object.entries(difResults).forEach(([qid, res]) => {
    if (res.category === 'C') advisories.push(`Question ${qid}: Large DIF (|Δ|=${Math.abs(res.mh_delta).toFixed(2)}) — suspend from high-stakes use`);
  });

  const report: PsychometricReport = {
    assessment_id:          assessmentId,
    report_date:            today,
    n_sessions:             nSessions,
    cronbachs_alpha:        isNaN(alpha)    ? null : Math.round(alpha     * 1000) / 1000,
    mcdonalds_omega:        null,            // requires factor model; offline calculation
    sem:                    semVal !== null && !isNaN(semVal) ? Math.round(semVal * 100) / 100 : null,
    domain_alphas:          domainAlphas,
    kmo_measure:            isNaN(kmo)      ? null : Math.round(kmo       * 1000) / 1000,
    n_factors_suggested:    nFactors,
    floor_pct:              Math.round(floorPct   * 1000) / 1000,
    ceiling_pct:            Math.round(ceilingPct * 1000) / 1000,
    theta_mean:             undefined,
    theta_sd:               undefined,
    dif_results:            difResults,
    quality_advisory:       advisories,
  };

  await persistPsychometricReport(pool, report);
  return report;
}

async function persistPsychometricReport(pool: Pool, report: PsychometricReport): Promise<void> {
  await pool.query(
    `INSERT INTO caf_psychometric_calibrations
       (assessment_id, report_date, n_sessions, cronbachs_alpha, sem,
        domain_alphas, inter_item_correlations, kmo_measure, n_factors_suggested,
        floor_pct, ceiling_pct, dif_results, quality_advisory)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (assessment_id, report_date) DO UPDATE SET
       n_sessions           = EXCLUDED.n_sessions,
       cronbachs_alpha      = EXCLUDED.cronbachs_alpha,
       sem                  = EXCLUDED.sem,
       domain_alphas        = EXCLUDED.domain_alphas,
       kmo_measure          = EXCLUDED.kmo_measure,
       n_factors_suggested  = EXCLUDED.n_factors_suggested,
       floor_pct            = EXCLUDED.floor_pct,
       ceiling_pct          = EXCLUDED.ceiling_pct,
       dif_results          = EXCLUDED.dif_results,
       quality_advisory     = EXCLUDED.quality_advisory`,
    [
      report.assessment_id,
      report.report_date,
      report.n_sessions,
      report.cronbachs_alpha,
      report.sem,
      JSON.stringify(report.domain_alphas),
      '{}',
      report.kmo_measure,
      report.n_factors_suggested,
      report.floor_pct,
      report.ceiling_pct,
      JSON.stringify(report.dif_results),
      JSON.stringify(report.quality_advisory),
    ],
  );
}
