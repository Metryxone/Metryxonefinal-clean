/**
 * CAPADEX 3.0 — Program 2: Longitudinal outcome capture on progression (Task #305)
 *
 * Closes blueprint-06 gaps GAP-O1 (realized-progression / Mastery outcome capture —
 * MECHANISM ONLY; real accuracy stays abstained until real non-demo data accrues) and
 * GAP-A4 (exit / continuous-assessment hook). STRICTLY ADDITIVE, flag-gated, fire-and-
 * forget. Reached only when `longitudinalOutcomeCapture` is ON — so flag-OFF behaviour
 * AND schema are byte-identical to legacy (no auto-snapshots, no new outcome rows, no DDL).
 *
 * ── Reuse-before-build (NO second outcome store / snapshot path) ──────────────────────
 *   1. Longitudinal snapshot → the EXISTING `captureLongitudinalSnapshot`
 *      (services/wc3/longitudinal-foundation.ts → wc3_longitudinal_snapshots). The same
 *      append-only, never-throws capture fn WC-L0 (user-intelligence-foundation) reuses
 *      as its "existing capture fn". One datapoint per progression step.
 *   2. Learning outcome → the EXISTING canonical outcome ledger `validation_loop_outcomes`
 *      (outcome_type='learning', outcome_kind='milestone'), via the EXISTING
 *      `ensureValidationLoopSchema`. We write a "platform milestone" (outcome_value=1) with
 *      predicted_prob_at_decision=NULL — there is NO decision-time prediction, so empirical
 *      calibration is honestly NOT wired (Coverage only). This is NOT a fabricated
 *      job/promotion outcome; it records that the user reached a lifecycle stage.
 *
 * ── Honesty contract ─────────────────────────────────────────────────────────────────
 *   * Demo / @example.com rows are stamped is_demo=true and are ALWAYS excluded from
 *     coverage AND ledger evidence counts in lockstep (the outcome engine's existing
 *     exclusion path) — capture can never self-inflate.
 *   * No accuracy/effectiveness is ever claimed: learning milestones carry no prediction,
 *     so the outcome engine keeps abstaining (method_applies=false) below k-min.
 *   * NEVER fabricate: absence of progression is absence, never a synthesised outcome.
 */

import type { Pool } from 'pg';
import { isLongitudinalOutcomeCaptureEnabled } from '../../config/feature-flags.js';
import { LIFECYCLE_STAGE_CODES, STAGE_CODE_TO_LABEL } from '../../lib/lifecycle.js';

/**
 * Canonical CAPADEX lifecycle Mastery stage — single-sourced from the lifecycle canon
 * (lib/lifecycle.ts). The final coded stage is Mastery; its label ('Mastery') is the same in
 * both the coded and stored-projection label spaces, so this is byte-identical to the prior
 * inline literals ('CAP_MAS' / 'Mastery').
 */
const MASTERY_STAGE_CODE: string = LIFECYCLE_STAGE_CODES[LIFECYCLE_STAGE_CODES.length - 1];
const MASTERY_CANONICAL: string = STAGE_CODE_TO_LABEL[MASTERY_STAGE_CODE];

/**
 * Re-assessment freshness window (days). A user whose newest accrued longitudinal
 * snapshot is older than this is surfaced as eligible for a re-assessment. READ-ONLY
 * display heuristic, derived on read — no scheduler, never gates. Mirrors the #304
 * EVIDENCE_FRESHNESS_DAYS (180d ≈ 6 months — behavioural signals drift over months).
 */
export const REASSESSMENT_FRESHNESS_DAYS = 180;

export interface ProgressionCaptureInput {
  sessionId: string;
  /** capadex_users.id (uuid) when the session is owned, else null. */
  userId?: string | null;
  /** Lower-cased subject email; null for anonymous sessions (no ledger subject). */
  email?: string | null;
  concernName?: string | null;
  /** CAPADEX stage code just completed (e.g. CAP_MAS). */
  stageCode?: string | null;
  /** Canonical behavioural stage label (Curiosity/Insight/Growth/Mastery), when resolved. */
  canonicalStage?: string | null;
  score?: number | null;
  scoreLevel?: string | null;
  csiScore?: number | null;
  csiStage?: string | null;
}

export interface ProgressionCaptureResult {
  enabled: boolean;
  snapshot_captured: boolean;
  learning_outcome_written: boolean;
  mastery_outcome_written: boolean;
  is_demo: boolean;
  skipped_reason?: string;
}

/** A row is demo iff its subject email is an @example.com address (platform convention). */
function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith('@example.com');
}

/**
 * Write ONE learning-type platform-milestone into the canonical outcome ledger.
 * Idempotent on (outcome_type, ref_id). predicted_prob_at_decision is NULL by design
 * (no prediction → coverage-only). Asserts the flag again at the write layer so direct/
 * tooling callers cannot create schema or rows while the flag is OFF. Never throws.
 */
async function writeLearningMilestone(
  pool: Pool,
  args: {
    email: string;
    userId: string | null;
    assessmentRef: string;
    refId: string;
    isDemo: boolean;
    milestone: 'stage_completion' | 'reached_mastery';
    detail: Record<string, unknown>;
  },
): Promise<boolean> {
  if (!isLongitudinalOutcomeCaptureEnabled()) return false; // flag-gate at the SERVICE write layer
  try {
    const { ensureValidationLoopSchema } = await import('../validation-loop-intake.js');
    await ensureValidationLoopSchema(pool);
    await pool.query(
      `INSERT INTO validation_loop_outcomes
         (subject_email, subject_user_id, assessment_ref, outcome_type, outcome_kind,
          outcome_value, predicted_prob_at_decision, predicted_basis, decision_at,
          observed_at, source, is_demo, ref_id, detail)
       VALUES ($1,$2,$3,'learning','milestone',1,NULL,NULL,NULL,now(),'capadex_progression',$4,$5,$6)
       ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET
         observed_at = EXCLUDED.observed_at,
         detail      = EXCLUDED.detail`,
      [
        args.email,
        args.userId,
        args.assessmentRef,
        args.isDemo,
        args.refId,
        JSON.stringify({ ...args.detail, milestone: args.milestone, capturedBy: 'capadex_progression_hook' }),
      ],
    );
    return true;
  } catch (err) {
    console.warn(
      '[progression-capture] writeLearningMilestone failed (non-blocking):',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Fire-and-forget capture invoked from postCompletionHooks on stage completion.
 * (1) appends a longitudinal snapshot (ensure-at-least-one datapoint per progression),
 * (2) records a learning-type platform-milestone outcome, and (3) when the just-completed
 * stage is Mastery, records a DISTINCT "reached-Mastery" milestone of the same honest type.
 * Flag OFF → no-op (the very first guard) → no snapshot, no rows, no DDL. Never throws.
 */
export async function captureProgressionOutcome(
  pool: Pool,
  input: ProgressionCaptureInput,
): Promise<ProgressionCaptureResult> {
  const base: ProgressionCaptureResult = {
    enabled: false,
    snapshot_captured: false,
    learning_outcome_written: false,
    mastery_outcome_written: false,
    is_demo: isDemoEmail(input.email),
  };
  if (!isLongitudinalOutcomeCaptureEnabled()) {
    return { ...base, skipped_reason: 'flag_off' };
  }
  base.enabled = true;
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const isDemo = isDemoEmail(email);

  // (1) Longitudinal snapshot — reuse the existing append-only capture fn.
  try {
    const { captureLongitudinalSnapshot } = await import('../wc3/longitudinal-foundation.js');
    const { canonicalStageFor } = await import('../wc3/stage-intelligence.js');
    base.snapshot_captured = await captureLongitudinalSnapshot(pool, {
      sessionId: input.sessionId,
      userEmail: email,
      userId: input.userId ?? null,
      concernName: input.concernName ?? null,
      stageCode: input.stageCode ?? null,
      canonicalStage: input.canonicalStage ?? canonicalStageFor(input.stageCode ?? null),
      score: input.score ?? null,
      scoreLevel: input.scoreLevel ?? null,
      csiScore: input.csiScore ?? null,
      csiStage: input.csiStage ?? null,
    });
  } catch (err) {
    console.warn(
      '[progression-capture] snapshot step failed (non-blocking):',
      err instanceof Error ? err.message : String(err),
    );
  }

  // (2)+(3) Learning-outcome ledger — requires a subject (validation_loop_outcomes.subject_email
  // is NOT NULL). Anonymous sessions get a snapshot but no ledger outcome (no subject — honest skip).
  if (!email) {
    return { ...base, is_demo: isDemo, skipped_reason: 'no_subject_email' };
  }

  const reachedMastery =
    (input.stageCode ?? '') === MASTERY_STAGE_CODE ||
    (input.canonicalStage ?? '') === MASTERY_CANONICAL;
  const detail: Record<string, unknown> = {
    stage_code: input.stageCode ?? null,
    canonical_stage: input.canonicalStage ?? null,
    concern_name: input.concernName ?? null,
    score: input.score ?? null,
    score_level: input.scoreLevel ?? null,
  };

  // Stage-completion milestone (idempotent per session).
  base.learning_outcome_written = await writeLearningMilestone(pool, {
    email,
    userId: input.userId ?? null,
    assessmentRef: input.sessionId,
    refId: `capadex_progression:${input.sessionId}`,
    isDemo,
    milestone: 'stage_completion',
    detail,
  });

  // Reached-Mastery milestone — DISTINCT ref_id, same honest learning type.
  if (reachedMastery) {
    base.mastery_outcome_written = await writeLearningMilestone(pool, {
      email,
      userId: input.userId ?? null,
      assessmentRef: input.sessionId,
      refId: `capadex_mastery:${input.sessionId}`,
      isDemo,
      milestone: 'reached_mastery',
      detail,
    });
  }

  return { ...base, is_demo: isDemo };
}

export interface ReassessmentSignal {
  /** Number of accrued longitudinal snapshots for this person (PII-safe count). */
  snapshot_count: number;
  /** ISO timestamp of the newest accrued snapshot, or null when none. */
  latest_snapshot_at: string | null;
  /** Whole days since the newest snapshot, or null when none. */
  age_days: number | null;
  /** Newest snapshot is older than the freshness window → re-measure to refresh evidence. */
  eligible_for_reassessment: boolean;
  /** The person reached the canonical Mastery stage → eligible for an exit assessment. */
  reached_mastery: boolean;
  eligible_for_exit: boolean;
  /** Supportive, honest human-readable reason for the surfaced signal. */
  reason: string;
}

/**
 * GAP-A4 — read-only exit / continuous-assessment eligibility signal, DERIVED ON READ
 * from the accrued longitudinal snapshots. No scheduler, no write, no DDL beyond the
 * read path's own existing ensure-schema (reached only when the flag is ON). Returns
 * null when the flag is OFF (byte-identical: no DDL, nothing surfaced) or on any fault.
 */
export async function getReassessmentSignal(
  pool: Pool,
  sessionId: string,
): Promise<ReassessmentSignal | null> {
  if (!isLongitudinalOutcomeCaptureEnabled()) return null;
  try {
    const { getLongitudinalHistoryBySession } = await import('../wc3/longitudinal-foundation.js');
    const history = await getLongitudinalHistoryBySession(pool, sessionId);
    if (!history) return null;

    const snapshots = history.snapshots ?? [];
    const count = history.count ?? snapshots.length;

    let latestMs: number | null = null;
    let reachedMastery = false;
    for (const s of snapshots) {
      const at = s?.captured_at ? new Date(s.captured_at).getTime() : NaN;
      if (Number.isFinite(at)) latestMs = latestMs == null ? at : Math.max(latestMs, at);
      if ((s?.canonical_stage ?? '') === MASTERY_CANONICAL || (s?.stage_code ?? '') === MASTERY_STAGE_CODE) {
        reachedMastery = true;
      }
    }

    const ageDays =
      latestMs == null ? null : Math.max(0, Math.floor((Date.now() - latestMs) / 86_400_000));
    const eligibleForReassessment = ageDays != null && ageDays >= REASSESSMENT_FRESHNESS_DAYS;
    const eligibleForExit = reachedMastery;

    let reason: string;
    if (count === 0) {
      reason = 'No longitudinal evidence yet — complete a stage to start accruing your progression history.';
    } else if (eligibleForExit) {
      reason = 'You have reached Mastery — you are eligible for an exit assessment to confirm your progress.';
    } else if (eligibleForReassessment) {
      reason = `Your most recent measurement is ${ageDays} days old — a re-assessment is recommended to refresh your evidence.`;
    } else {
      reason = 'Your progression evidence is current — keep building toward the next stage.';
    }

    return {
      snapshot_count: count,
      latest_snapshot_at: latestMs == null ? null : new Date(latestMs).toISOString(),
      age_days: ageDays,
      eligible_for_reassessment: eligibleForReassessment,
      reached_mastery: reachedMastery,
      eligible_for_exit: eligibleForExit,
      reason,
    };
  } catch (err) {
    console.warn(
      '[progression-capture] getReassessmentSignal failed (non-blocking):',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
