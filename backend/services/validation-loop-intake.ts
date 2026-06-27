/**
 * PHASE 7 — Validation Loop intake helpers (shared, durable recording flow).
 *
 * This module is the WRITE side of the validation loop: it turns a realized hiring
 * decision into a durable `validation_loop_outcomes` row that carries its DECISION-TIME
 * prediction snapshot, so the EXISTING calibration surfaces (validation-loop status /
 * employer-tig calibration / outcome-intelligence) can compute confidence once realized
 * (non-demo) pairs reach k_min=30. It does NOT recompute or fabricate anything.
 *
 * Honesty + safety contract (NEVER regress):
 *   - Flag-gated on `validationLoop` (FF_VALIDATION_LOOP). Flag-OFF → no schema, no write →
 *     byte-identical legacy behaviour incl. schema. The recording call is a no-op.
 *   - Best-effort / never-throws: a failed recording must NEVER fail the originating hiring
 *     decision (the caller already persisted the candidate update).
 *   - Demo-aware: rows whose subject email is `@example.com` are recorded with is_demo=true so
 *     every calibration surface keeps EXCLUDING them from realized/evidence-backed claims.
 *   - Idempotent: keyed on (outcome_type, ref_id) so re-processing the same decision is safe.
 *   - A prediction is stored ONLY when it is a finite probability in [0,1]; otherwise it is
 *     stored as NULL (counts toward Coverage only, never coerced into a fake evidence pair).
 */

import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';

let schemaReady = false;

/** Lazily create the validation_loop_outcomes schema (idempotent, cached). Shared by the
 *  intake route and this recording flow so there is ONE schema source of truth. */
export async function ensureValidationLoopSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  const p = path.join(__dirname, '../migrations/20260623_validation_loop_outcomes.sql');
  const sql = fs.readFileSync(p, 'utf-8');
  await pool.query(sql);
  await pool.query('SELECT 1 FROM validation_loop_outcomes LIMIT 1');
  schemaReady = true;
}

export interface RecordHiringOutcomeArgs {
  subjectEmail: string;
  subjectUserId?: string | null;
  assessmentRef?: string | null;
  /** Realized binary outcome: 1 = Hired/Offer accepted, 0 = Rejected. */
  outcomeValue: 0 | 1;
  /** Decision-time success probability snapshot (0..1). NULL when none was captured. */
  predictedProb?: number | null;
  predictedBasis?: string | null;
  source?: string;
  /** Idempotency key (e.g. `employer_candidate:<id>`). Required for safe re-processing. */
  refId: string;
  detail?: Record<string, unknown>;
}

export interface RecordOutcomeResult {
  recorded: boolean;
  reason?: string;
  is_demo?: boolean;
}

/** The four binary outcome types the validation loop calibrates. Mirrors validation-loop-engine
 *  `OUTCOME_TYPES` (kept local so this WRITE module has no import cycle with the engine). */
export type ValidationOutcomeType = 'hiring' | 'performance' | 'promotion' | 'retention';
const VALIDATION_OUTCOME_TYPES: readonly ValidationOutcomeType[] =
  ['hiring', 'performance', 'promotion', 'retention'];

/** Default decision-time prediction basis per outcome type (used only when the caller omits one). */
const DEFAULT_BASIS: Record<ValidationOutcomeType, string> = {
  hiring: 'employer_success_probability',
  performance: 'candidate_match_score',
  promotion: 'promotion_probability',
  retention: 'employer_success_probability',
};

export interface RecordValidationOutcomeArgs {
  /** Which realized-outcome type this decision realises (hiring/performance/promotion/retention). */
  outcomeType: ValidationOutcomeType;
  subjectEmail: string;
  subjectUserId?: string | null;
  assessmentRef?: string | null;
  /** Realized binary outcome: 1 = positive (Hired/Recommended/Promoted/Retained), 0 = negative. */
  outcomeValue: 0 | 1;
  /** Decision-time success probability snapshot (0..1). NULL when none was captured. */
  predictedProb?: number | null;
  predictedBasis?: string | null;
  source?: string;
  /** Idempotency key (e.g. `employer_offer:<id>`). Required for safe re-processing. */
  refId: string;
  detail?: Record<string, unknown>;
}

/** Args for the per-type sibling recorders (outcome_type is implied by the function). */
export type RecordTypedOutcomeArgs = Omit<RecordValidationOutcomeArgs, 'outcomeType'>;

/**
 * Record ANY realized validation-loop outcome (hiring/performance/promotion/retention) as a durable
 * validation_loop_outcomes row carrying its decision-time prediction snapshot. Flag-gated,
 * never-throws, demo-aware, idempotent — the SAME honesty contract for every type.
 * Returns {recorded:false, reason} when the flag is OFF or inputs are invalid — never throws.
 */
export async function recordValidationOutcome(
  pool: Pool,
  args: RecordValidationOutcomeArgs,
): Promise<RecordOutcomeResult> {
  if (!isFlagEnabled('validationLoop')) return { recorded: false, reason: 'flag_off' };
  const type = String(args.outcomeType ?? '').trim().toLowerCase() as ValidationOutcomeType;
  if (!VALIDATION_OUTCOME_TYPES.includes(type)) {
    return { recorded: false, reason: 'invalid_outcome_type' };
  }
  const email = String(args.subjectEmail ?? '').trim().toLowerCase();
  if (!email) return { recorded: false, reason: 'subject_email_required' };
  const refId = String(args.refId ?? '').trim();
  if (!refId) return { recorded: false, reason: 'ref_id_required' };
  if (args.outcomeValue !== 0 && args.outcomeValue !== 1) {
    return { recorded: false, reason: 'outcome_value_must_be_0_or_1' };
  }
  const isDemo = email.endsWith('@example.com');
  // A prediction is kept ONLY when it is a finite probability in [0,1]; never clamp/coerce.
  let pred: number | null = args.predictedProb == null ? null : Number(args.predictedProb);
  if (pred != null && (!Number.isFinite(pred) || pred < 0 || pred > 1)) pred = null;

  try {
    await ensureValidationLoopSchema(pool);
    await pool.query(
      `INSERT INTO validation_loop_outcomes
         (subject_email, subject_user_id, assessment_ref, outcome_type, outcome_kind, outcome_value,
          predicted_prob_at_decision, predicted_basis, decision_at, source, is_demo, ref_id, detail)
       VALUES ($1,$2,$3,$4,'binary',$5,$6,$7,now(),$8,$9,$10,$11)
       ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET
         outcome_value = EXCLUDED.outcome_value,
         predicted_prob_at_decision = EXCLUDED.predicted_prob_at_decision,
         predicted_basis = EXCLUDED.predicted_basis,
         observed_at = now(),
         detail = EXCLUDED.detail`,
      [
        email,
        args.subjectUserId != null ? String(args.subjectUserId) : null,
        args.assessmentRef != null ? String(args.assessmentRef) : null,
        type,
        args.outcomeValue,
        pred,
        args.predictedBasis != null ? String(args.predictedBasis) : DEFAULT_BASIS[type],
        args.source ?? 'outcome_hook',
        isDemo,
        refId,
        JSON.stringify(args.detail ?? {}),
      ],
    );
    return { recorded: true, is_demo: isDemo };
  } catch (err) {
    // Best-effort: never let a recording failure surface to the originating decision path.
    console.error('[validation-loop-intake] recordValidationOutcome failed:', (err as any)?.message ?? err);
    return { recorded: false, reason: 'write_failed' };
  }
}

/**
 * Record a realized HIRING outcome (back-compat wrapper over recordValidationOutcome). Same
 * flag-gated/never-throws/demo-aware/idempotent contract as before; outcome_type is fixed to 'hiring'.
 */
export async function recordHiringOutcome(
  pool: Pool,
  args: RecordHiringOutcomeArgs,
): Promise<RecordOutcomeResult> {
  return recordValidationOutcome(pool, { ...args, outcomeType: 'hiring' });
}

/** Record a realized PERFORMANCE outcome (e.g. an interviewer's Hire / No-Hire verdict). */
export async function recordPerformanceOutcome(
  pool: Pool,
  args: RecordTypedOutcomeArgs,
): Promise<RecordOutcomeResult> {
  return recordValidationOutcome(pool, { ...args, outcomeType: 'performance' });
}

/** Record a realized PROMOTION outcome (promoted = 1 / passed-over = 0). */
export async function recordPromotionOutcome(
  pool: Pool,
  args: RecordTypedOutcomeArgs,
): Promise<RecordOutcomeResult> {
  return recordValidationOutcome(pool, { ...args, outcomeType: 'promotion' });
}

/** Record a realized RETENTION / yield outcome (joined-retained = 1 / did-not-join = 0). */
export async function recordRetentionOutcome(
  pool: Pool,
  args: RecordTypedOutcomeArgs,
): Promise<RecordOutcomeResult> {
  return recordValidationOutcome(pool, { ...args, outcomeType: 'retention' });
}
