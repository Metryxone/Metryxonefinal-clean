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

/**
 * Record a realized hiring outcome as a durable validation_loop_outcomes row, carrying its
 * decision-time prediction snapshot. Flag-gated, never-throws, demo-aware, idempotent.
 * Returns {recorded:false, reason} when the flag is OFF or inputs are invalid — never throws.
 */
export async function recordHiringOutcome(
  pool: Pool,
  args: RecordHiringOutcomeArgs,
): Promise<RecordOutcomeResult> {
  if (!isFlagEnabled('validationLoop')) return { recorded: false, reason: 'flag_off' };
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
       VALUES ($1,$2,$3,'hiring','binary',$4,$5,$6,now(),$7,$8,$9,$10)
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
        args.outcomeValue,
        pred,
        args.predictedBasis != null ? String(args.predictedBasis) : 'employer_success_probability',
        args.source ?? 'outcome_hook',
        isDemo,
        refId,
        JSON.stringify(args.detail ?? {}),
      ],
    );
    return { recorded: true, is_demo: isDemo };
  } catch (err) {
    // Best-effort: never let a recording failure surface to the hiring decision path.
    console.error('[validation-loop-intake] recordHiringOutcome failed:', (err as any)?.message ?? err);
    return { recorded: false, reason: 'write_failed' };
  }
}
