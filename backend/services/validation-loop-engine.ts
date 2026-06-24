/**
 * PHASE 7 — Validation Loop (structural, outcome-pending).
 *
 * PURE helpers for the evidence loop:
 *   Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction.
 *
 * This module does NOT add a new calibration/prediction/confidence engine — it COMPOSES the
 * EXISTING ones. The only genuinely missing piece (per the §10 certification report) was a
 * unified front-half realized-OUTCOME intake; these helpers turn recorded outcomes into the
 * (predicted, outcome) pairs the EXISTING `buildCalibrationModel` (routes/employer-tig.ts)
 * already consumes, and summarise calibration honestly.
 *
 * Honesty contract (NEVER regress):
 *   - is_demo rows are EXCLUDED from realized / evidence-backed claims.
 *   - No empirical accuracy is claimed until >= VALIDATION_K_MIN realized binary outcomes that
 *     carry a decision-time prediction accrue. Below that the loop is STRUCTURALLY ready, not
 *     validated (calibration status: cold_start / provisional, never 'calibrated').
 *   - Coverage (outcomes recorded) and Confidence (calibration trust) are reported SEPARATELY.
 *   - null = missing, never a fabricated 0.
 */

import { buildCalibrationModel, type CalibrationModel } from '../routes/employer-tig';

export const VALIDATION_LOOP_VERSION = '7.0.0';

/** Platform k_min precedent — mirrors CALIB_MIN_OUTCOMES (employer-tig.ts, not exported). Below
 *  this, calibration is at best 'provisional' (mostly prior) and is NEVER claimed 'calibrated'. */
export const VALIDATION_K_MIN = 30;

export const OUTCOME_TYPES = ['hiring', 'performance', 'promotion', 'retention'] as const;
export type OutcomeType = typeof OUTCOME_TYPES[number];

export const VALIDATION_LANGUAGE_POLICY = {
  purpose: 'developmental_validation',
  allowed: [
    'calibration trust status (cold_start / provisional / calibrated)',
    'realized outcome counts and coverage',
    'abstained prediction status',
    'model confidence (reliability / consistency / evidence)',
  ],
  disallowed: [
    'empirical accuracy claims without realized outcomes',
    'hiring / promotion / suitability predictions',
    'fabricated or synthesized realized outcomes',
    'treating model confidence as empirical accuracy',
  ],
  note: 'Calibration is a TRUST axis; Coverage and Confidence are reported separately. No accuracy is claimed until realized outcomes accrue (≥ k_min).',
};

export function isValidOutcomeType(t: unknown): t is OutcomeType {
  return typeof t === 'string' && (OUTCOME_TYPES as readonly string[]).includes(t);
}

export interface OutcomeRow {
  outcome_kind?: string | null;
  outcome_value?: number | string | null;
  predicted_prob_at_decision?: number | string | null;
}

/**
 * PURE — turn recorded outcome rows into the realized {predicted, outcome} pairs that
 * `buildCalibrationModel` consumes. Only binary rows that carry a FINITE decision-time
 * prediction qualify; continuous/no-prediction/non-0-1 rows are excluded (never coerced).
 * Caller is responsible for pre-filtering demo vs realized.
 */
export function toCalibrationPairs(rows: OutcomeRow[]): { predicted: number; outcome: 0 | 1 }[] {
  const pairs: { predicted: number; outcome: 0 | 1 }[] = [];
  for (const r of rows) {
    if ((r.outcome_kind ?? 'binary') !== 'binary') continue;
    const predRaw = r.predicted_prob_at_decision;
    const valRaw = r.outcome_value;
    if (predRaw == null || predRaw === '' || valRaw == null || valRaw === '') continue;
    const pred = Number(predRaw);
    const val = Number(valRaw);
    if (!Number.isFinite(pred) || !Number.isFinite(val)) continue;
    if (val !== 0 && val !== 1) continue;
    // Honesty: a probability MUST be in [0,1]. Drop out-of-range rows (never clamp) so a malformed
    // backfilled/non-API row can't be silently coerced into a valid evidence pair.
    if (pred < 0 || pred > 1) continue;
    pairs.push({ predicted: pred, outcome: val as 0 | 1 });
  }
  return pairs;
}

/** PURE — honest, display-ready summary of a calibration model. */
export function calibrationSummary(model: CalibrationModel) {
  return {
    status: model.status,
    total_outcomes: model.totalOutcomes,
    k_min: VALIDATION_K_MIN,
    remaining_to_calibrated: Math.max(0, VALIDATION_K_MIN - model.totalOutcomes),
    brier: model.brier,   // null until ≥1 realized outcome
    ece: model.ece,       // null until ≥1 realized outcome
    method: model.method,
    bands: model.bands
      .filter(b => b.sampleSize > 0)
      .map(b => ({
        band: b.bandId,
        n: b.sampleSize,
        observed_rate: b.observedRate,
        calibrated_rate: b.calibratedRate,
        mean_predicted: b.meanPredicted,
      })),
  };
}

/**
 * PURE — build the calibration block for a set of (already demo-filtered) outcome rows.
 * Reuses the EXISTING engine; abstains honestly when empty.
 */
export function calibrationFromRows(rows: OutcomeRow[]) {
  const pairs = toCalibrationPairs(rows);
  const model = buildCalibrationModel(pairs);
  return { pairs_used: pairs.length, ...calibrationSummary(model) };
}

export interface TerminalCandidateRow {
  stage?: string | null;
  predicted_prob_at_decision?: number | string | null;
  email?: string | null;
}

/**
 * PURE — MX-75X CONNECTION: map terminal employer-candidate decisions to realized
 * {predicted, outcome} pairs, CONNECTING the pre-existing employer hiring feeder into the
 * unified loop WITHOUT any manual intake. The decision-time success probability
 * (predicted_prob_at_decision) is the prediction; the terminal stage is the realized binary
 * outcome (Hired = 1, Rejected = 0).
 *
 * Honesty contract (mirrors toCalibrationPairs):
 *   - Demo rows (@example.com) are EXCLUDED from realized/evidence-backed pairs.
 *   - Only finite predictions in [0,1] qualify; out-of-range/missing predictions are DROPPED
 *     (never clamped/coerced) so a malformed row can't become fake evidence.
 *   - Non-terminal rows are ignored. Nothing is ever fabricated.
 */
export function terminalCandidatesToPairs(rows: TerminalCandidateRow[]): { predicted: number; outcome: 0 | 1 }[] {
  const pairs: { predicted: number; outcome: 0 | 1 }[] = [];
  for (const r of rows) {
    const email = String(r.email ?? '').trim().toLowerCase();
    if (email.endsWith('@example.com')) continue; // demo excluded
    const stage = String(r.stage ?? '');
    let outcome: 0 | 1;
    if (stage === 'Hired') outcome = 1;
    else if (stage === 'Rejected') outcome = 0;
    else continue;
    const predRaw = r.predicted_prob_at_decision;
    if (predRaw == null || predRaw === '') continue;
    const pred = Number(predRaw);
    if (!Number.isFinite(pred) || pred < 0 || pred > 1) continue;
    pairs.push({ predicted: pred, outcome });
  }
  return pairs;
}

/**
 * PURE — the honest evidence-backed verdict. Predictions become evidence-backed ONLY when
 * realized outcomes reach k_min; this is an OUTCOME-ACCRUAL milestone, not a code milestone.
 */
export function evidenceVerdict(realizedPairs: number) {
  const evidenceBacked = realizedPairs >= VALIDATION_K_MIN;
  return {
    evidence_backed: evidenceBacked,
    realized_outcomes: realizedPairs,
    k_min: VALIDATION_K_MIN,
    reason: evidenceBacked
      ? null
      : realizedPairs === 0
        ? 'awaiting_outcomes — no realized outcomes recorded yet'
        : `insufficient_outcomes (${realizedPairs}/${VALIDATION_K_MIN}) — provisional until ≥${VALIDATION_K_MIN}`,
  };
}
