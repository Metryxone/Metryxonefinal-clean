/**
 * CAPADEX Safety Circuit Breaker — "Relief-First" Gateway (Module 2, 2026-05-25)
 *
 * Hybrid two-channel safety evaluator wired into POST /api/capadex/session/:id/respond.
 * Both channels run on every batch; either firing trips the breaker, halts the queue,
 * and returns a unified safety_intercept envelope to the client.
 *
 *   Channel A — Explicit Safety (text-based):
 *     Pipes any client-supplied `response_text` for the current batch through
 *     `safety-layer.validateNarrative()`. A `referral` level (self-harm, crisis,
 *     catastrophic determinism) trips the breaker immediately.
 *
 *     STATUS: hook-only today. CAPADEX questions are choice-only (handleCapadexAnswer
 *     in FreeAssessmentModal.tsx posts {item_id, response_value} — no response_text).
 *     Channel A is active and validated; it will start firing the moment a future
 *     freeform follow-up wires `response_text` into the request body.
 *
 *   Channel B — Implicit Telemetry Risk (behavioural):
 *     Computes two fresh risk scores from accumulated capadex_responses +
 *     capadex_session_telemetry for THIS session, normalised to [0, 1].
 *
 *     Distress detection is POLARITY-AWARE: it uses `weighted_score` (already
 *     sign-flipped at /respond write-time so low values = distress regardless
 *     of item polarity), NOT raw_score (which is unflipped 0-100 and would
 *     miss every negative-polarity distress signal).
 *
 *       crisis_risk
 *         = clamp01( 0.70 * extreme_distress_share + 0.30 * (cumulative_backtracks / 24) )
 *         where extreme_distress_share = share of items with weighted_score < 20
 *         (polarity-corrected bottom quintile of the 0-100 weight-1 scale).
 *         Coefficient split (0.70/0.30) means backtracks alone cannot trip
 *         the 0.80 threshold — distress signal is required.
 *
 *       emotional_breakdown_risk
 *         = clamp01( 0.55 * (avg_hesitation_ms / 25000) + 0.45 * answer_volatility )
 *         where answer_volatility = (total_backtracks / max(answered, 1)) capped at 1.
 *         Tuned tighter than v1 (25s baseline vs 18s) to reduce early-session
 *         false positives from natural reflection on the first 1-2 questions.
 *
 *     MINIMUM-ANSWERED GUARD: Channel B is suppressed until the user has
 *     answered >= 3 items. This prevents tripping on a single hesitant first
 *     answer where the running averages are statistically meaningless.
 *
 *     Either score >= 0.80 trips the breaker. Both are merged back into
 *     `omega_x_payload.risk.{crisis_risk, emotional_breakdown_risk}` via jsonb_set
 *     so the canonical 8-layer payload reflects the running session state — this
 *     is the "real-time back-propagation update" referenced in the Module 2 spec.
 *
 * Defensive contract: this evaluator NEVER throws. On any DB or computation
 * fault it returns `{ tripped: false, error: '...' }` so the assessment can't
 * be bricked by a breaker fault. The caller (/respond) logs but never surfaces
 * these errors to the client.
 */

import type { Pool } from 'pg';
import { validateNarrative } from './safety-layer';

export interface SafetyTripResult {
  tripped: boolean;
  channel: 'A' | 'B' | 'A+B' | null;
  reasons: string[];
  risk: { crisis_risk: number; emotional_breakdown_risk: number };
  error?: string;
}

export interface IncomingResponseItem {
  item_id: string | number;
  response_value: number | string;
  response_text?: string; // optional freeform — only present when client opts in
}

const TRIP_THRESHOLD          = 0.80;
const EXTREME_DISTRESS_CUTOFF = 20;     // weighted_score < 20 = polarity-adjusted distress
const HESITATION_BASELINE_MS  = 25_000;
const BACKTRACK_BASELINE      = 24;
const MIN_ANSWERED_FOR_TRIP   = 3;      // suppress Channel B until enough data

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 100) / 100;
}

export async function evaluateSafetyTrip(
  pool: Pool,
  sessionId: string,
  incoming: IncomingResponseItem[],
): Promise<SafetyTripResult> {
  const reasons: string[] = [];
  let channelAFired = false;
  let channelBFired = false;
  let crisis_risk = 0;
  let emotional_breakdown_risk = 0;

  try {
    // ── Channel A — explicit safety scan on supplied freeform text ─────────
    for (const r of incoming) {
      const txt = (r.response_text || '').trim();
      if (!txt) continue;
      const verdict = validateNarrative(txt);
      if (verdict.safety_status === 'referral') {
        channelAFired = true;
        reasons.push(`channel_a:${verdict.safety_flags.join(',') || 'referral'}`);
        // Don't short-circuit — still compute Channel B so payload is accurate
      }
    }

    // ── Channel B — telemetry-derived behavioural risk ─────────────────────
    // Pull aggregate response + telemetry stats in two queries (cheap; no join
    // because capadex_session_telemetry.session_id is text and responses.session_id
    // is uuid — keep them separate rather than CAST in the hot path).
    // Distress query uses weighted_score (polarity-flipped at write-time) so
    // a distress answer triggers regardless of whether the item is positive-
    // or negative-polarity. raw_score is unflipped 0-100 and would silently
    // miss every negative-polarity max-distress response.
    const [{ rows: respRows }, { rows: telRows }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int                                                  AS answered,
                COUNT(*) FILTER (WHERE weighted_score IS NOT NULL
                                   AND weighted_score::numeric < $2)::int      AS extreme_count
           FROM capadex_responses WHERE session_id = $1`,
        [sessionId, EXTREME_DISTRESS_CUTOFF],
      ),
      pool.query(
        `SELECT COALESCE(AVG(hesitation_ms), 0)::float    AS avg_hesitation,
                COALESCE(SUM(backtrack_count), 0)::int    AS total_backtracks
           FROM capadex_session_telemetry WHERE session_id = $1`,
        [sessionId],
      ),
    ]);

    const answeredRaw       = Number(respRows[0]?.answered    ?? 0);
    const answered          = Math.max(1, answeredRaw);
    const extremeCount      = Number(respRows[0]?.extreme_count           ?? 0);
    const avgHesitation     = Number(telRows[0]?.avg_hesitation           ?? 0);
    const totalBacktracks   = Number(telRows[0]?.total_backtracks         ?? 0);

    const extremeShare      = extremeCount / answered;
    const volatility        = Math.min(1, totalBacktracks / answered);

    // 0.70/0.30 split: backtracks alone (extremeShare=0) max out at 0.30 → can never
    // trip the 0.80 threshold without real distress signal alongside. The backtrack
    // ratio is clamped to 1.0 BEFORE the 0.30 weight so a high backtrack count
    // (> BACKTRACK_BASELINE) cannot inflate the term past 0.30 and break that
    // separation guarantee (e.g. 64 backtracks would otherwise alone yield 0.80).
    const backtrackRatio = Math.min(totalBacktracks / BACKTRACK_BASELINE, 1.0);
    crisis_risk = clamp01(0.70 * extremeShare + 0.30 * backtrackRatio);
    // 0.55/0.45 split tightens hesitation baseline to 25s (was 18s) to reduce
    // early-session false positives from natural reflection on the first answer.
    emotional_breakdown_risk = clamp01(
      0.55 * (avgHesitation / HESITATION_BASELINE_MS) + 0.45 * volatility
    );

    // Channel B is suppressed until the user has answered enough items for the
    // running averages to be statistically meaningful. Without this guard a
    // single hesitant first answer (one 25s pause) could trip the breaker.
    if (answeredRaw >= MIN_ANSWERED_FOR_TRIP) {
      if (crisis_risk >= TRIP_THRESHOLD) {
        channelBFired = true;
        reasons.push(`channel_b:crisis_risk=${crisis_risk}`);
      }
      if (emotional_breakdown_risk >= TRIP_THRESHOLD) {
        channelBFired = true;
        reasons.push(`channel_b:emotional_breakdown_risk=${emotional_breakdown_risk}`);
      }
    }

    const tripped = channelAFired || channelBFired;
    const channel: SafetyTripResult['channel'] =
      channelAFired && channelBFired ? 'A+B'
      : channelAFired                ? 'A'
      : channelBFired                ? 'B'
      : null;

    return {
      tripped,
      channel,
      reasons,
      risk: { crisis_risk, emotional_breakdown_risk },
    };
  } catch (err: any) {
    // Defensive — breaker fault must never freeze the assessment.
    return {
      tripped: false,
      channel: null,
      reasons: [],
      risk: { crisis_risk: 0, emotional_breakdown_risk: 0 },
      error: err?.message || String(err),
    };
  }
}

/**
 * The unified envelope returned to the client when either channel trips.
 * Frontend assessment loop detects `safety_intercept === true` and mounts
 * the relief overlay instead of advancing the question queue.
 */
export function buildSafetyInterceptEnvelope(trip: SafetyTripResult) {
  return {
    safety_intercept:    true,
    terminate_assessment: true,
    relief_target:       'immediate_support',
    support_resources: {
      message: "Your well-being is our absolute priority right now. Let's pause the questions and focus on immediate relief.",
      action_type: 'counsellor_routing',
    },
    // Diagnostic side-channel — never user-facing but useful for audit logs / SuperAdmin
    _trip_channel: trip.channel,
    _trip_reasons: trip.reasons,
    _risk:         trip.risk,
  };
}
