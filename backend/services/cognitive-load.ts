/**
 * Cognitive Load Engine — Phase 1 S6
 *
 * Continuously estimates cognitive fatigue, overload, hesitation, and
 * disengagement from the response pattern of an in-progress CAPADEX session.
 * When load is high the engine recommends a pacing or flow adaptation that S7
 * (Adaptive Assessment Runtime) can act on.
 *
 * Signals used (all derived from existing tables — no new client instrumentation):
 *   fatigue_score       — question count relative to a peak threshold
 *   overload_score      — rapid-answer rate + high response-time variance
 *   hesitation_score    — slow-response rate + session duration vs expected duration
 *   disengagement_score — uniform answer pattern + middle-value bias + trailing slowdown
 *   answer_change_rate  — fraction of responses preceded by a signal_key=answer_changed
 *                         event in capadex_session_signals (0 when table unavailable)
 *   abandonment_score   — idle time since last response + completion deficit
 *   composite_load      — weighted sum of the six dimensions (0–1)
 *
 * Feature-flag: `cognitive_load_engine` — when disabled, returns
 *   `recommended_action: 'continue_normal'` with all scores at 0.
 *
 * Public API:
 *   computeLoad(pool, sessionId, tenantId?) → CognitiveLoadResult
 *     Pure computation; does not write to the DB. Called by routes.
 *   snapshotLoad(pool, sessionId, tenantId?) → CognitiveLoadResult
 *     Compute + upsert cognitive_load_snapshots for every question boundary
 *     since the last persisted snapshot + update cognitive_runtime_state.
 *     Called non-blockingly from the CAPADEX respond endpoint per response.
 */

import type { Pool } from 'pg';
import { isEnabled }          from './feature-flags';
import { updateState }        from './cognitive-state';
import { broadcastToSession } from './ws-broadcast';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendedAction =
  | 'continue_normal'
  | 'reduce_pacing'
  | 'simplify_language'
  | 'offer_break'
  | 'shorten_flow'
  | 'end_gracefully';

export interface CognitiveLoadResult {
  fatigue_score:       number;  // 0–1
  overload_score:      number;  // 0–1
  hesitation_score:    number;  // 0–1
  disengagement_score: number;  // 0–1
  /** Fraction of answers that were changed before submission (0–1). */
  answer_change_rate:  number;  // 0–1
  /** Signal that the session may be on the verge of drop-off (0–1). */
  abandonment_score:   number;  // 0–1
  composite_load:      number;  // 0–1
  recommended_action:  RecommendedAction;
  /** Average inter-response interval in ms (0 when < 2 responses). */
  avg_response_ms:     number;
  /** Number of responses used for the computation. */
  question_index:      number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Inter-response interval above which a response is classified as a hesitation. */
const HESITATION_THRESHOLD_MS = 15_000;   // 15 s

/** Inter-response interval below which a response is classified as rapid/rushing. */
const RAPID_THRESHOLD_MS = 2_000;         // 2 s

/** Expected average time per question (used to judge session duration). */
const EXPECTED_MS_PER_QUESTION = 8_000;   // 8 s

/** Question count at which fatigue_score reaches 1.0 (sigmoid-style). */
const FATIGUE_PEAK_QUESTIONS = 20;

/**
 * Session idle time beyond which abandonment_score begins to rise.
 * If a user hasn't submitted a response in this window the session is at risk.
 */
const IDLE_RISK_MS  = 90_000;   // 90 s
const IDLE_MAX_MS   = 300_000;  // 5 min → abandonment_score = 1.0 from idle alone

/** Composite weights (must sum to 1). */
const FATIGUE_WEIGHT       = 0.25;
const OVERLOAD_WEIGHT      = 0.20;
const HESITATION_WEIGHT    = 0.20;
const DISENGAGEMENT_WEIGHT = 0.15;
const ANSWER_CHANGE_WEIGHT = 0.10;
const ABANDONMENT_WEIGHT   = 0.10;

// ─── Action thresholds ────────────────────────────────────────────────────────

const ACTION_THRESHOLDS: [number, RecommendedAction][] = [
  [0.80, 'end_gracefully'],
  [0.65, 'shorten_flow'],
  [0.55, 'offer_break'],
  [0.40, 'simplify_language'],
  [0.25, 'reduce_pacing'],
  [0.00, 'continue_normal'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function recommendAction(composite: number): RecommendedAction {
  for (const [threshold, action] of ACTION_THRESHOLDS) {
    if (composite >= threshold) return action;
  }
  return 'continue_normal';
}

// ─── Data loaders ─────────────────────────────────────────────────────────────

interface ResponseRow {
  response_value: number;
  raw_score:      number;
  created_at:     string;
}

interface SessionRow {
  total_items:    number;
  answered_items: number;
  created_at:     string;
  updated_at:     string;
}

async function loadSessionData(pool: Pool, sessionId: string): Promise<{
  session:   SessionRow | null;
  responses: ResponseRow[];
}> {
  const [sessionResult, responsesResult] = await Promise.all([
    pool.query<SessionRow>(
      `SELECT total_items, answered_items, created_at, updated_at
       FROM capadex_sessions
       WHERE id = $1`,
      [sessionId]
    ),
    pool.query<{ response_value: string | number; raw_score: string | number; created_at: string }>(
      `SELECT response_value::float8 AS response_value,
              COALESCE(raw_score::float8, 0) AS raw_score,
              created_at
       FROM capadex_responses
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    ),
  ]);

  const session = sessionResult.rows[0] ?? null;
  const responses: ResponseRow[] = responsesResult.rows.map(r => ({
    response_value: Number(r.response_value),
    raw_score:      Number(r.raw_score),
    created_at:     r.created_at,
  }));

  return { session, responses };
}

/**
 * Attempt to count answer-change events from `capadex_session_signals`.
 * The signal classifier stores signal_key='answer_changed' for every question
 * where the user revised their answer before submitting.
 * Returns 0 gracefully when the table is unavailable or the session has no signals.
 */
async function loadAnswerChangedCount(pool: Pool, sessionId: string): Promise<number> {
  try {
    const { rows } = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt
       FROM capadex_session_signals
       WHERE session_id = $1
         AND signal_key IN ('answer_changed', 'frequent_answer_changes')`,
      [sessionId]
    );
    return parseInt(rows[0]?.cnt ?? '0', 10);
  } catch {
    // Table may not exist in all environments (e.g. test seeds) — fail silently.
    return 0;
  }
}

// ─── Load computation ─────────────────────────────────────────────────────────

/** Disabled fallback — all scores 0, action = continue_normal. */
function disabledResult(questionIndex = 0): CognitiveLoadResult {
  return {
    fatigue_score:       0,
    overload_score:      0,
    hesitation_score:    0,
    disengagement_score: 0,
    answer_change_rate:  0,
    abandonment_score:   0,
    composite_load:      0,
    recommended_action:  'continue_normal',
    avg_response_ms:     0,
    question_index:      questionIndex,
  };
}

/**
 * Pure load computation. Does not write to the DB.
 *
 * @param pool      — PG connection pool
 * @param sessionId — CAPADEX session ID
 * @param tenantId  — optional tenant for feature-flag resolution
 */
export async function computeLoad(
  pool:      Pool,
  sessionId: string,
  tenantId?: string,
): Promise<CognitiveLoadResult> {
  if (!isEnabled('cognitive_load_engine', tenantId)) return disabledResult();

  const [{ session, responses }, answerChangedCount] = await Promise.all([
    loadSessionData(pool, sessionId),
    loadAnswerChangedCount(pool, sessionId),
  ]);

  if (!session || responses.length === 0) return disabledResult();

  const answeredCount = responses.length;

  // ── Inter-response intervals ──────────────────────────────────────────────
  const intervals: number[] = [];
  for (let i = 1; i < responses.length; i++) {
    const dt = new Date(responses[i].created_at).getTime()
             - new Date(responses[i - 1].created_at).getTime();
    if (dt > 0 && dt < 300_000) intervals.push(dt); // ignore gaps > 5 min (breaks)
  }

  const avgResponseMs = intervals.length > 0
    ? intervals.reduce((s, ms) => s + ms, 0) / intervals.length
    : 0;

  // ── fatigue_score ─────────────────────────────────────────────────────────
  // Grows linearly with question count; 1.0 at FATIGUE_PEAK_QUESTIONS.
  const fatigue_score = clamp(answeredCount / FATIGUE_PEAK_QUESTIONS);

  // ── overload_score ────────────────────────────────────────────────────────
  // Combines:
  //   (a) rapid-answer rate   — many fast answers → rushed / overloaded
  //   (b) response-time CV    — high variance → inconsistent pacing → overload
  let overload_score = 0;
  if (intervals.length > 0) {
    const rapidCount = intervals.filter(ms => ms < RAPID_THRESHOLD_MS).length;
    const rapidRate  = rapidCount / intervals.length;

    const mean     = avgResponseMs;
    const variance = intervals.reduce((s, ms) => s + (ms - mean) ** 2, 0) / intervals.length;
    const cv       = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const cvNorm   = clamp(cv / 2);  // CV ≥ 2 → fully overloaded

    overload_score = clamp(rapidRate * 0.60 + cvNorm * 0.40);
  }

  // ── hesitation_score ──────────────────────────────────────────────────────
  // Combines:
  //   (a) hesitation-response rate   — slow answers → anxiety / confusion
  //   (b) session duration factor    — much longer than expected → effortful
  let hesitation_score = 0;
  if (intervals.length > 0) {
    const hesitationCount = intervals.filter(ms => ms > HESITATION_THRESHOLD_MS).length;
    const hesitationRate  = hesitationCount / intervals.length;

    const sessionMs      = Math.max(0,
      new Date(session.updated_at).getTime() - new Date(session.created_at).getTime()
    );
    const expectedMs     = answeredCount * EXPECTED_MS_PER_QUESTION;
    const durationFactor = clamp((sessionMs / Math.max(expectedMs, 1) - 1) / 3);

    hesitation_score = clamp(hesitationRate * 0.70 + durationFactor * 0.30);
  }

  // ── disengagement_score ───────────────────────────────────────────────────
  // Combines:
  //   (a) response uniformity — low variance = robotic / safe answering
  //   (b) middle-value bias   — always picking 2 or 3 on 5-pt scale
  //   (c) trailing slowdown   — last 3 intervals slower than first 3
  let disengagement_score = 0;
  {
    const values    = responses.map(r => r.response_value);
    const valMean   = values.reduce((s, v) => s + v, 0) / values.length;
    const valVar    = values.reduce((s, v) => s + (v - valMean) ** 2, 0) / values.length;
    const valStdDev = Math.sqrt(valVar);

    // Low std-dev → very uniform → high uniformity score
    const uniformity = clamp(1 - valStdDev / 2);

    const midBias = values.length > 0
      ? values.filter(v => v === 2 || v === 3).length / values.length
      : 0;

    let trailingSlowdown = 0;
    if (intervals.length >= 6) {
      const firstAvg = intervals.slice(0, 3).reduce((s, ms) => s + ms, 0) / 3;
      const lastAvg  = intervals.slice(-3).reduce((s, ms) => s + ms, 0) / 3;
      trailingSlowdown = clamp((lastAvg - firstAvg) / Math.max(firstAvg, 1_000));
    }

    disengagement_score = clamp(uniformity * 0.40 + midBias * 0.40 + trailingSlowdown * 0.20);
  }

  // ── answer_change_rate ────────────────────────────────────────────────────
  // Fraction of answered questions where the user revised their response.
  // Sourced from capadex_session_signals (signal_key='answer_changed').
  // High rate → uncertainty / indecisiveness → elevated cognitive effort.
  const answer_change_rate = clamp(answerChangedCount / Math.max(answeredCount, 1));

  // ── abandonment_score ─────────────────────────────────────────────────────
  // Combines:
  //   (a) idle time since last response — session going quiet
  //   (b) completion deficit — many questions remaining, few answered
  //
  // "Idle" is measured against wall-clock now so it can detect live sessions
  // that have gone quiet; historical sessions (already completed) will never
  // surface here because the flag gates computeLoad.
  const nowMs       = Date.now();
  const lastRespMs  = responses.length > 0
    ? new Date(responses[responses.length - 1].created_at).getTime()
    : new Date(session.created_at).getTime();
  const idleMs      = Math.max(0, nowMs - lastRespMs);
  const idleFactor  = clamp((idleMs - IDLE_RISK_MS) / Math.max(IDLE_MAX_MS - IDLE_RISK_MS, 1));

  const totalItems  = Math.max(session.total_items, answeredCount, 1);
  const completionDeficit = clamp(1 - answeredCount / totalItems);

  // Idle dominates; completion deficit provides a weaker ongoing signal.
  const abandonment_score = clamp(idleFactor * 0.70 + completionDeficit * 0.30);

  // ── composite_load ────────────────────────────────────────────────────────
  const composite_load = clamp(
    fatigue_score       * FATIGUE_WEIGHT       +
    overload_score      * OVERLOAD_WEIGHT      +
    hesitation_score    * HESITATION_WEIGHT    +
    disengagement_score * DISENGAGEMENT_WEIGHT +
    answer_change_rate  * ANSWER_CHANGE_WEIGHT +
    abandonment_score   * ABANDONMENT_WEIGHT
  );

  return {
    fatigue_score,
    overload_score,
    hesitation_score,
    disengagement_score,
    answer_change_rate,
    abandonment_score,
    composite_load,
    recommended_action: recommendAction(composite_load),
    avg_response_ms:    Math.round(avgResponseMs),
    question_index:     answeredCount,
  };
}

// ─── Snapshot (compute + persist + state sync) ────────────────────────────────

/**
 * Compute load, upsert `cognitive_load_snapshots` rows for every question
 * boundary that has occurred since the last persisted snapshot, and update
 * `cognitive_runtime_state.cognitive_state` via S1.
 *
 * Gap-filling: if the previous snapshot was at index K and current answeredCount
 * is N, rows are written for K+1 … N. This ensures the snapshot table has an
 * entry at every question boundary even when responses arrive in batches.
 * All gap-fill rows use the same computed load (the data at those intermediate
 * boundaries is no longer available separately once a batch is committed).
 *
 * Called non-blockingly from the CAPADEX respond endpoint once per response
 * item in the batch.
 *
 * @param pool      — PG connection pool
 * @param sessionId — CAPADEX session ID
 * @param tenantId  — optional tenant for feature-flag resolution
 */
export async function snapshotLoad(
  pool:      Pool,
  sessionId: string,
  tenantId?: string,
): Promise<CognitiveLoadResult> {
  const result = await computeLoad(pool, sessionId, tenantId);

  // Only persist and update state when the flag is active
  if (!isEnabled('cognitive_load_engine', tenantId)) return result;
  if (result.question_index === 0) return result;

  // ── Find the last persisted snapshot index for gap-filling ────────────────
  const { rows: [lastSnap] } = await pool.query<{ max_qi: string | null }>(
    `SELECT MAX(question_index) AS max_qi
     FROM cognitive_load_snapshots
     WHERE session_id = $1`,
    [sessionId]
  );
  const prevIndex = lastSnap?.max_qi != null ? parseInt(lastSnap.max_qi, 10) : 0;
  const startIdx  = Math.max(prevIndex, 0);   // will write startIdx+1 … current

  // ── Upsert one snapshot row per question boundary in the gap ──────────────
  // All gap rows carry the same computed values (the intermediate state cannot
  // be reconstructed once the full batch is committed).
  for (let qi = startIdx + 1; qi <= result.question_index; qi++) {
    await pool.query(
      `INSERT INTO cognitive_load_snapshots
         (session_id, question_index,
          fatigue_score, overload_score, hesitation_score, disengagement_score,
          composite_load, recommended_action)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (session_id, question_index)
       DO UPDATE SET
         fatigue_score       = EXCLUDED.fatigue_score,
         overload_score      = EXCLUDED.overload_score,
         hesitation_score    = EXCLUDED.hesitation_score,
         disengagement_score = EXCLUDED.disengagement_score,
         composite_load      = EXCLUDED.composite_load,
         recommended_action  = EXCLUDED.recommended_action,
         created_at          = NOW()`,
      [
        sessionId,
        qi,
        result.fatigue_score,
        result.overload_score,
        result.hesitation_score,
        result.disengagement_score,
        result.composite_load,
        result.recommended_action,
      ]
    );
  }

  // ── Update cognitive_runtime_state.cognitive_state via S1 ─────────────────
  const loadLevel =
    result.composite_load >= 0.65 ? 'overloaded' :
    result.composite_load >= 0.40 ? 'high'        :
    result.composite_load >= 0.20 ? 'moderate'    : 'low';

  updateState(pool, sessionId, {
    cognitive_state: {
      load_level:         loadLevel,
      fatigue_score:      result.fatigue_score,
      questions_answered: result.question_index,
      avg_response_ms:    result.avg_response_ms,
    },
  }, `cognitive_load:${result.recommended_action}`)
    .catch(err => console.error('[cognitive-load] state sync error:', err));

  // Broadcast cognitive load alert when load is elevated or action is non-standard
  // fire-and-forget, flag-gated inside broadcastToSession
  if (result.composite_load >= 0.40 || result.recommended_action !== 'continue_normal') {
    broadcastToSession(sessionId, {
      type: 'cognitive_load_alert',
      data: {
        composite_load:     result.composite_load,
        recommended_action: result.recommended_action,
        fatigue_score:      result.fatigue_score,
        overload_score:     result.overload_score,
        load_level:         loadLevel,
      },
      explain: `Cognitive load at ${(result.composite_load * 100).toFixed(0)}% — action: ${result.recommended_action}`,
    }, tenantId);
  }

  return result;
}
