/**
 * CAPADEX WC-L0B — Behaviour Trend Intelligence (Longitudinal Behaviour Layer).
 *
 * Measures the DIRECTION of progression (Improving / Stable / Declining) for the EXISTING behaviour
 * dimensions across a person's session history:
 *   motivation · confidence · risk · engagement · adaptability
 *
 * These dimensions are NOT recomputed here. They are the values the WC-L0 User Intelligence
 * Foundation already PROJECTED from the Unified Behavior Graph and persisted ONE-PER-SESSION into
 * `wcl0_user_intelligence`. This layer is the longitudinal counterpart of WC-L1 trend-intelligence:
 * it introduces NO new intelligence engine, construct, dimension, ontology, scoring model, or AI
 * model. It REUSES the existing longitudinal trend math (`leastSquaresSlope` / `directionOf` /
 * `STABLE_DEADBAND` from longitudinal-consumption.ts) over the already-persisted behaviour dims, and
 * the existing `wc3_longitudinal_trends` schema (via `ensureTrendIntelligenceSchema`).
 *
 * `learning_style` is a CATEGORICAL label (text), not a numeric magnitude — it has no slope and is
 * therefore NEVER numerically trended (it is surfaced in the history/coverage reports instead).
 *
 * HONEST DEGRADATION (mirrors WC-L0 / WC-L1):
 *   - A trend needs ≥2 readable points for the SAME dimension across the SAME user's sessions; a
 *     dimension with <2 readable points → NO trend row is written (never fabricated). A dimension that
 *     is NULL for a session is MISSING, never coerced to 0 (signals are concern-diagnostic, and 0 is a
 *     real low value, not "no data").
 *   - Trend confidence scales with the number of comparable points (2 = minimum = low confidence:
 *     a 2-point line cannot distinguish a real trend from noise). Confidence is never inflated.
 *
 * Persists to the EXISTING `wc3_longitudinal_trends` table under metric `behaviour_<dim>`, keyed
 * UPSERT (user_email, metric) — additive alongside the WC-L1 stage/outcome/journey/decision metrics.
 * Gated by `isBehaviourTrendIntelligenceEnabled()` at the call site. NON-BLOCKING + NEVER-THROWS.
 * Flag OFF → no schema change, no write → byte-identical legacy behaviour.
 */
import type { Pool } from 'pg';
import { ensureTrendIntelligenceSchema } from './trend-intelligence';
import { leastSquaresSlope, directionOf, type TrendDirection } from './longitudinal-consumption';

/** The EXISTING numeric behaviour dimensions persisted in `wcl0_user_intelligence`. */
export type BehaviourDim = 'motivation' | 'confidence' | 'risk' | 'engagement' | 'adaptability';

export const BEHAVIOUR_NUMERIC_DIMS: BehaviourDim[] = [
  'motivation', 'confidence', 'risk', 'engagement', 'adaptability',
];

/** Number of comparable points at which trend confidence reaches 1.0 (mirrors WC-L1). */
const TREND_TARGET_POINTS = 4;

/** Confidence in the TREND itself: scales with #comparable points. 2 pts = low; ≥TARGET = full. */
function trendConfidence(points: number): number {
  if (points < 2) return 0;
  const c = (points - 1) / (TREND_TARGET_POINTS - 1);
  return Number(Math.max(0, Math.min(1, c)).toFixed(2));
}

export interface BehaviourHistoryPoint {
  session_id: string;
  created_at: string;
  behaviour_source: string;
  motivation: number | null;
  confidence: number | null;
  risk: number | null;
  engagement: number | null;
  adaptability: number | null;
  learning_style: string | null;
}

export interface UserBehaviourHistory {
  user_email: string;
  sessions: number;
  points: BehaviourHistoryPoint[];
}

/**
 * Read-only ordered behaviour history for one user: every completed session's persisted behaviour
 * row, oldest→newest by the session's own `created_at` (the canonical chronology — NOT the persist
 * time `resolved_at`). Empty array when the user has no persisted behaviour rows. NEVER throws.
 */
export async function getUserBehaviourHistory(pool: Pool, email: string): Promise<UserBehaviourHistory> {
  const lower = email.toLowerCase();
  const result: UserBehaviourHistory = { user_email: lower, sessions: 0, points: [] };
  try {
    const { rows } = await pool.query(
      `SELECT s.id::text AS session_id, s.created_at,
              w.behaviour_source, w.motivation, w.confidence, w.risk, w.engagement,
              w.adaptability, w.learning_style
         FROM capadex_sessions s
         JOIN wcl0_user_intelligence w ON w.session_id = s.id::text
        WHERE LOWER(s.guest_email) = $1 AND s.status = 'completed'
        ORDER BY s.created_at ASC`,
      [lower],
    );
    result.sessions = rows.length;
    result.points = rows.map((r) => ({
      session_id: String(r.session_id),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      behaviour_source: r.behaviour_source ?? 'absent',
      motivation: r.motivation == null ? null : Number(r.motivation),
      confidence: r.confidence == null ? null : Number(r.confidence),
      risk: r.risk == null ? null : Number(r.risk),
      engagement: r.engagement == null ? null : Number(r.engagement),
      adaptability: r.adaptability == null ? null : Number(r.adaptability),
      learning_style: r.learning_style ?? null,
    }));
  } catch (err) {
    console.warn('[wcl0b-behaviour-trend] history read failed (non-blocking):', err instanceof Error ? err.message : String(err));
  }
  return result;
}

export interface BehaviourDimTrend {
  dim: BehaviourDim;
  metric: string;        // `behaviour_<dim>`
  label: string;
  points: number;        // readable comparable points used
  first: number;         // oldest readable value
  last: number;          // newest readable value
  delta: number;         // last - first (rounded)
  slope_per_session: number;
  direction: TrendDirection;
  confidence: number;    // confidence in the trend (scales with #points)
}

export interface UserBehaviourTrendResult {
  user_email: string;
  sessions: number;
  trends: BehaviourDimTrend[];
  note: string | null;
}

const DIM_LABEL: Record<BehaviourDim, string> = {
  motivation: 'Motivation', confidence: 'Confidence', risk: 'Risk',
  engagement: 'Engagement', adaptability: 'Adaptability',
};

/**
 * Read-only: compute per-dimension behaviour trends for one user from the EXISTING persisted
 * behaviour rows. Pure read — no writes. Honest: a dimension with <2 readable (non-null) points
 * produces no trend (never faked); a NULL dimension is MISSING, never coerced to 0.
 */
export async function computeUserBehaviourTrends(pool: Pool, email: string): Promise<UserBehaviourTrendResult> {
  const lower = email.toLowerCase();
  const history = await getUserBehaviourHistory(pool, lower);
  const result: UserBehaviourTrendResult = {
    user_email: lower, sessions: history.sessions, trends: [], note: null,
  };
  if (history.sessions < 2) {
    result.note = 'Not enough completed sessions to establish a behaviour trend yet — needs at least two.';
    return result;
  }

  for (const dim of BEHAVIOUR_NUMERIC_DIMS) {
    // Series in session (time) order; only sessions that carry a readable value for THIS dimension.
    const series = history.points
      .map((p) => p[dim])
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (series.length < 2) continue; // honest: no trend for this dimension

    const first = series[0];
    const last = series[series.length - 1];
    const slope = leastSquaresSlope(series);
    result.trends.push({
      dim,
      metric: `behaviour_${dim}`,
      label: `${DIM_LABEL[dim]} (behaviour)`,
      points: series.length,
      first: Math.round(first),
      last: Math.round(last),
      delta: Math.round(last - first),
      slope_per_session: Number(slope.toFixed(2)),
      direction: directionOf(slope),
      confidence: trendConfidence(series.length),
    });
  }
  if (result.trends.length === 0) {
    result.note = 'History exists but no behaviour dimension had two readable points — no trend fabricated.';
  }
  return result;
}

/**
 * Compute + UPSERT the behaviour-dimension trends for one user into `wc3_longitudinal_trends`
 * (metric `behaviour_<dim>`). Returns the result summary, or null on any failure (non-blocking).
 * NEVER throws.
 */
export async function persistUserBehaviourTrends(pool: Pool, email: string): Promise<UserBehaviourTrendResult | null> {
  try {
    await ensureTrendIntelligenceSchema(pool);
    const res = await computeUserBehaviourTrends(pool, email);
    for (const t of res.trends) {
      await pool.query(
        `INSERT INTO wc3_longitudinal_trends
           (user_email, metric, direction, delta, window_label,
            points, slope_per_session, confidence, first_value, last_value, source, computed_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
         ON CONFLICT (user_email, metric) DO UPDATE SET
           direction         = EXCLUDED.direction,
           delta             = EXCLUDED.delta,
           window_label      = EXCLUDED.window_label,
           points            = EXCLUDED.points,
           slope_per_session = EXCLUDED.slope_per_session,
           confidence        = EXCLUDED.confidence,
           first_value       = EXCLUDED.first_value,
           last_value        = EXCLUDED.last_value,
           source            = EXCLUDED.source,
           computed_at       = now(),
           updated_at        = now()`,
        [res.user_email, t.metric, t.direction, t.delta, `${t.points} sessions`,
         t.points, t.slope_per_session, t.confidence, t.first, t.last,
         `wcl0_user_intelligence.${t.dim}`],
      );
    }
    return res;
  } catch (err) {
    console.warn('[wcl0b-behaviour-trend] persist failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Post-completion hook entry: resolve the session's owner email and persist that user's behaviour
 * trends. Anonymous sessions (no email) cannot form a cross-session user series → honest skip
 * (returns null). NEVER throws.
 */
export async function persistBehaviourTrendsForSession(pool: Pool, sessionId: string): Promise<UserBehaviourTrendResult | null> {
  try {
    const { rows } = await pool.query(`SELECT guest_email FROM capadex_sessions WHERE id::text = $1 LIMIT 1`, [sessionId]);
    const email = rows[0]?.guest_email ? String(rows[0].guest_email) : null;
    if (!email) return null;
    return await persistUserBehaviourTrends(pool, email);
  } catch (err) {
    console.warn('[wcl0b-behaviour-trend] session persist failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Read-only fetch of the persisted behaviour-dimension trends for a user (empty array on absence / error). */
export async function getUserBehaviourTrends(pool: Pool, email: string): Promise<Record<string, unknown>[]> {
  try {
    await ensureTrendIntelligenceSchema(pool);
    const { rows } = await pool.query(
      `SELECT metric, direction, delta, window_label, points, confidence, slope_per_session,
              first_value, last_value, source, computed_at
         FROM wc3_longitudinal_trends
        WHERE LOWER(user_email) = LOWER($1) AND metric LIKE 'behaviour_%'
        ORDER BY metric`,
      [email],
    );
    return rows;
  } catch {
    return [];
  }
}
