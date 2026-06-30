/**
 * CAPADEX WC-L1 — Trend Intelligence (Progression Direction Layer).
 *
 * Measures the DIRECTION of progression (Improving / Stable / Declining) for four EXISTING
 * intelligence levers across a person's session history:
 *   Lever 1 — Stage    (L1 Stage Intelligence)      : canonical stage advancement
 *   Lever 2 — Outcome  (L2 Outcome Intelligence)    : outcome-stage advancement (current_order)
 *   Lever 3 — Journey  (L3 Journey Intelligence)    : routed-journey confidence / fit
 *   Lever 4 — Decision (WC-11 Decision Intelligence): unified decision confidence
 *
 * It introduces NO new intelligence engine, construct, or ontology. It REUSES the existing
 * longitudinal trend math (`leastSquaresSlope` / `directionOf` / `STABLE_DEADBAND` from
 * longitudinal-consumption.ts) over values that EXISTING intelligence already persisted
 * (longitudinal snapshots + per-session outcome/journey/decision state). Each lever's metric is
 * normalised onto a shared 0..100 progression scale so the SAME stable-deadband applies uniformly.
 *
 * HONEST DEGRADATION (mirrors WC-L0):
 *   - A trend needs ≥2 comparable sessions; <2 readable points for a lever → NO trend row is written
 *     (never fabricated). Absence is an honest finding, not a zero.
 *   - Trend confidence scales with the number of comparable sessions (2 = minimum = low confidence:
 *     a 2-point line cannot distinguish a real trend from noise). Confidence is never inflated.
 *
 * Persists to the EXISTING `wc3_longitudinal_trends` table (created long ago for exactly this and
 * never written until now) — analytics columns are added idempotently (additive ALTERs). Lazy
 * ensure-schema, UPSERT per (user_email, metric). Gated by `isTrendIntelligenceEnabled()` at the
 * call site. NON-BLOCKING + NEVER-THROWS. Flag OFF → no schema change, no write → byte-identical
 * legacy behaviour.
 */
import type { Pool } from 'pg';
import { ensureWc3LongitudinalSchema } from './wc3-schema';
import { leastSquaresSlope, directionOf, type TrendDirection } from './longitudinal-consumption';
import { normalizeStoredStage } from '../../lib/lifecycle';

export type TrendLever = 'stage' | 'outcome' | 'journey' | 'decision';

/** Number of comparable sessions at which trend confidence reaches 1.0 (2 = minimum point count). */
const TREND_TARGET_POINTS = 4;

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Normalise a stage label/code to the shared 0..100 progression scale (each canonical stage = 25
 * points). Returns null for an unknown/empty stage so it is treated as MISSING, never as 0.
 *
 * Resolution goes through the canonical read-layer normalizer (`normalizeStoredStage`) so a label
 * (`Clarity`), the display alias, or a `CAP_*` code all resolve identically. The WC3 telemetry uses
 * a 5-point PROGRESSION scale prefixed by the uncoded pre-stage "Awareness" (ordinal 0); the four
 * coded stages follow at ordinals 1..4 (canonical order + 1). Mirrors wc3_stage_definitions.
 */
function stageToScale(canonical: string | null, code: string | null): number | null {
  const resolved = normalizeStoredStage(canonical ?? code ?? '');
  let ordinal: number | null;
  if (resolved.isUncodedPreStage) ordinal = 0;
  else if (resolved.code) ordinal = resolved.order + 1;
  else ordinal = null;
  if (ordinal === null) return null;
  return (ordinal / 4) * 100;
}

/** Confidence in the TREND itself: scales with #comparable points. 2 pts = low; ≥TARGET = full. */
function trendConfidence(points: number): number {
  if (points < 2) return 0;
  const c = (points - 1) / (TREND_TARGET_POINTS - 1);
  return Number(Math.max(0, Math.min(1, c)).toFixed(2));
}

const LEVERS: Array<{ lever: TrendLever; label: string; source: string }> = [
  { lever: 'stage', label: 'Stage progression', source: 'wc3_longitudinal_snapshots.canonical_stage' },
  { lever: 'outcome', label: 'Outcome progression', source: 'wc3_outcome_state.current_order' },
  { lever: 'journey', label: 'Journey progression', source: 'wc3_journey_state.route_confidence' },
  { lever: 'decision', label: 'Decision progression', source: 'wc7b_decision_state.confidence' },
];

let schemaReady = false;

/**
 * Lazy, idempotent schema. The base `wc3_longitudinal_trends` table is created by the existing WC-3
 * longitudinal schema; here we ADD the analytics columns this layer needs (idempotent ADD COLUMN IF
 * NOT EXISTS) and a UNIQUE (user_email, metric) index so trends UPSERT cleanly. Additive only.
 */
export async function ensureTrendIntelligenceSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await ensureWc3LongitudinalSchema(pool);
  await pool.query(`
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS points            integer;
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS slope_per_session numeric;
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS confidence        numeric;
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS first_value       numeric;
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS last_value        numeric;
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS source            text;
    ALTER TABLE wc3_longitudinal_trends ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();
    CREATE UNIQUE INDEX IF NOT EXISTS uq_wc3_long_trends_user_metric ON wc3_longitudinal_trends(user_email, metric);
  `);
  schemaReady = true;
}

export interface LeverTrend {
  lever: TrendLever;
  label: string;
  source: string;
  points: number;        // readable comparable points used
  first: number;         // oldest readable value (0..100 scale)
  last: number;          // newest readable value (0..100 scale)
  delta: number;         // last - first (rounded)
  slope_per_session: number;
  direction: TrendDirection;
  confidence: number;    // confidence in the trend (scales with #points)
}

export interface UserTrendResult {
  user_email: string;
  sessions: number;
  trends: LeverTrend[];
  note: string | null;
}

/**
 * Read-only: compute the four lever trends for one user (by email) from EXISTING persisted state.
 * Pure read — no writes. Honest: a lever with <2 readable points produces no trend (never faked).
 */
export async function computeUserTrends(pool: Pool, email: string): Promise<UserTrendResult> {
  const lower = email.toLowerCase();
  const { rows: sess } = await pool.query(
    `SELECT id::text AS id FROM capadex_sessions
      WHERE LOWER(guest_email) = $1 AND status = 'completed'
      ORDER BY created_at ASC`,
    [lower],
  );
  const ids = sess.map((r) => r.id as string);
  const result: UserTrendResult = { user_email: lower, sessions: ids.length, trends: [], note: null };
  if (ids.length < 2) {
    result.note = 'Not enough completed sessions to establish a trend yet — needs at least two.';
    return result;
  }

  // ── Per-lever value map: session_id → normalised 0..100 progression value (from existing state) ──
  const stageMap = new Map<string, number>();
  {
    const { rows } = await pool.query(
      `SELECT session_id::text AS sid, canonical_stage, stage_code
         FROM wc3_longitudinal_snapshots WHERE session_id = ANY($1::uuid[]) ORDER BY captured_at ASC`,
      [ids],
    );
    for (const r of rows) {
      const v = stageToScale(r.canonical_stage, r.stage_code);
      if (v !== null) stageMap.set(r.sid, v); // ordered ASC → last write wins per session
    }
  }
  const outcomeMap = new Map<string, number>();
  {
    const { rows } = await pool.query(
      `SELECT session_id::text AS sid, AVG(current_order)::float AS v
         FROM wc3_outcome_state WHERE session_id = ANY($1::uuid[]) GROUP BY session_id`,
      [ids],
    );
    for (const r of rows) if (r.v != null) outcomeMap.set(r.sid, clamp01to100(Number(r.v) * 25));
  }
  const journeyMap = new Map<string, number>();
  {
    const { rows } = await pool.query(
      `SELECT session_id::text AS sid, route_confidence AS v
         FROM wc3_journey_state WHERE session_id = ANY($1::uuid[])`,
      [ids],
    );
    for (const r of rows) if (r.v != null) journeyMap.set(r.sid, clamp01to100(Number(r.v) * 100));
  }
  const decisionMap = new Map<string, number>();
  {
    const { rows } = await pool.query(
      `SELECT session_id AS sid, confidence AS v
         FROM wc7b_decision_state WHERE session_id = ANY($1::text[])`,
      [ids],
    );
    for (const r of rows) if (r.v != null) decisionMap.set(String(r.sid), clamp01to100(Number(r.v) * 100));
  }
  const maps: Record<TrendLever, Map<string, number>> = {
    stage: stageMap, outcome: outcomeMap, journey: journeyMap, decision: decisionMap,
  };

  for (const { lever, label, source } of LEVERS) {
    // Series in session (time) order; only sessions that carry a readable value for THIS lever.
    const series = ids
      .map((id) => maps[lever].get(id))
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (series.length < 2) continue; // honest: no trend for this lever

    const first = series[0];
    const last = series[series.length - 1];
    const slope = leastSquaresSlope(series);
    result.trends.push({
      lever,
      label,
      source,
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
    result.note = 'History exists but no lever had two readable points — no trend fabricated.';
  }
  return result;
}

/**
 * Compute + UPSERT the lever trends for one user into `wc3_longitudinal_trends`. Returns the result
 * summary, or null on any failure (non-blocking). NEVER throws.
 */
export async function persistUserTrends(pool: Pool, email: string): Promise<UserTrendResult | null> {
  try {
    await ensureTrendIntelligenceSchema(pool);
    const res = await computeUserTrends(pool, email);
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
        [res.user_email, t.lever, t.direction, t.delta, `${t.points} sessions`,
         t.points, t.slope_per_session, t.confidence, t.first, t.last, t.source],
      );
    }
    return res;
  } catch (err) {
    console.warn('[wcl1-trend-intelligence] persist failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Post-completion hook entry: resolve the session's owner email and persist that user's trends.
 * Anonymous sessions (no email) cannot form a cross-session user series → honest skip (returns null).
 * NEVER throws.
 */
export async function persistTrendsForSession(pool: Pool, sessionId: string): Promise<UserTrendResult | null> {
  try {
    const { rows } = await pool.query(`SELECT guest_email FROM capadex_sessions WHERE id::text = $1 LIMIT 1`, [sessionId]);
    const email = rows[0]?.guest_email ? String(rows[0].guest_email) : null;
    if (!email) return null;
    return await persistUserTrends(pool, email);
  } catch (err) {
    console.warn('[wcl1-trend-intelligence] session persist failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Read-only fetch of the persisted lever trends for a user (empty array on absence / error). */
export async function getUserTrends(pool: Pool, email: string): Promise<Record<string, unknown>[]> {
  try {
    await ensureTrendIntelligenceSchema(pool);
    const { rows } = await pool.query(
      `SELECT metric, direction, delta, window_label, points, confidence, slope_per_session,
              first_value, last_value, source, computed_at
         FROM wc3_longitudinal_trends WHERE LOWER(user_email) = LOWER($1) ORDER BY metric`,
      [email],
    );
    return rows;
  } catch {
    return [];
  }
}
