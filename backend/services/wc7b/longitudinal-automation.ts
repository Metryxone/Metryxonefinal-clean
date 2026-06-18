/**
 * WC-7B Deliverable 5 — Longitudinal Automation.
 *
 * Compose-only, additive, never-throws. Gated by the caller on
 * isLongitudinalAutomationEnabled() (FF_LONGITUDINAL_AUTOMATION, default OFF).
 *
 * On CAPADEX session completion this:
 *   1. GUARANTEES a longitudinal-memory snapshot is built for the user (calls the
 *      writer fn directly — never HTTP). This surfaces the OMEGA buildMemory
 *      detections (recurring constructs / behavioural drift / burnout / resilience
 *      / growth) into longitudinal_patterns + longitudinal_pattern_events.
 *      `buildAndPersistMemory` is idempotent (upsert + replace-strategy), so it is
 *      always safe to call. WC-7B is the SOLE builder when its flag is ON — the
 *      caller suppresses the legacy longitudinal_memory DB-flag build in that case
 *      so the two never race (concurrent event DELETE+INSERT would duplicate rows).
 *   2. Computes an additive next_reassessment_at cadence hint from the completed
 *      session score and persists it onto the (now guaranteed-present)
 *      longitudinal_patterns row via a lazy ADD COLUMN IF NOT EXISTS — no new
 *      out-of-scope tables.
 *
 * Reads/writes only data already derived by existing engines; never recomputes or
 * fabricates intelligence. Flag OFF → this module is never invoked → byte-identical.
 */

import type { Pool } from 'pg';
import type { LongitudinalMemory } from '../longitudinal-memory';

export interface LongitudinalAutomationInput {
  email: string;
  sessionId: string;
  /** Completed-session overall score (0-100), used only for the reassessment cadence. */
  score?: number | null;
}

export interface LongitudinalAutomationResult {
  ran: boolean;
  snapshot_built: boolean;
  session_count?: number;
  next_reassessment_at?: string;
  /** The freshly built memory, so the caller can refresh dependent summaries. */
  memory?: LongitudinalMemory;
  reason?: string;
}

/**
 * Cadence: lower scores → reassess sooner (more developmental need); higher
 * scores → longer interval. Pure, deterministic, no fabrication.
 */
function cadenceDays(score: number | null | undefined): number {
  if (score == null || Number.isNaN(score)) return 60;
  if (score < 40) return 30;
  if (score < 70) return 60;
  return 90;
}

export async function runLongitudinalAutomation(
  pool: Pool,
  input: LongitudinalAutomationInput,
): Promise<LongitudinalAutomationResult> {
  const email = (input.email ?? '').toLowerCase().trim();
  if (!email) return { ran: false, snapshot_built: false, reason: 'no_email' };

  try {
    // 1. GUARANTEE the longitudinal snapshot. buildAndPersistMemory is idempotent
    // (upsert + replace-strategy). The caller suppresses the legacy DB-flag builder
    // when this runs, so there is no concurrent rebuild to race with — and the
    // longitudinal_patterns row is guaranteed present before the hint write below.
    const { buildAndPersistMemory } = await import('../longitudinal-memory');
    const memory = await buildAndPersistMemory(pool, email, input.sessionId);

    // 2. Additive next_reassessment_at on the (now present) longitudinal_patterns row.
    const days = cadenceDays(input.score);
    const nextAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `ALTER TABLE longitudinal_patterns
         ADD COLUMN IF NOT EXISTS next_reassessment_at TIMESTAMPTZ`,
    );
    await pool.query(
      `UPDATE longitudinal_patterns
         SET next_reassessment_at = $2
       WHERE user_email = $1`,
      [email, nextAt],
    );

    return {
      ran: true,
      snapshot_built: true,
      session_count: memory.session_count,
      next_reassessment_at: nextAt,
      memory,
    };
  } catch (e) {
    console.error('[wc7b-longitudinal-automation] non-blocking error:', e);
    return { ran: false, snapshot_built: false, reason: 'error' };
  }
}
