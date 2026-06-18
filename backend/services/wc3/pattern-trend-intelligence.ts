/**
 * WCL1 — Pattern Trend Intelligence
 *
 * Computes per-pattern behavioral TRENDS from capadex_session_patterns across
 * a user's session history. This is the entry layer of the WCL chain:
 *
 *   Trend ← Patterns  (NOT raw scores — only pattern confidence values)
 *
 * Reuses the EXISTING leastSquaresSlope / directionOf math from
 * longitudinal-consumption.ts. No new model, no new ontology. Pattern
 * confidence (0..1) is normalised to 0..100 so the same STABLE_DEADBAND
 * applies uniformly.
 *
 * HONEST DEGRADATION:
 *   - A trend needs ≥2 sessions where the same pattern_key appears.
 *   - Absence is an honest finding, never fabricated.
 *   - Anonymous sessions (no guest_email) cannot form a cross-session series.
 *
 * NEVER throws. PURE READ (no writes, no DDL).
 */

import type { Pool } from 'pg';
import { leastSquaresSlope, directionOf, type TrendDirection } from './longitudinal-consumption';

export type PatternPolarity = 'risk' | 'load' | 'protective';

/** Risk patterns — higher confidence = worse behavioural state. */
const RISK_KEYS = new Set([
  'burnout_cluster', 'hesitation_cluster', 'cognitive_avoidance_cluster',
  'career_stress_cluster', 'stress_cluster', 'anxiety_cluster',
]);
/** Protective patterns — higher confidence = better state. */
const PROTECTIVE_KEYS = new Set([
  'stress_regulation_cluster', 'growth_cluster', 'resilience_cluster',
  'self_regulation_cluster',
]);

function classifyPolarity(key: string): PatternPolarity {
  const k = key.toLowerCase();
  if (RISK_KEYS.has(k) || k.includes('burnout') || k.includes('avoidanc') || k.includes('anxiety') || k.includes('hesitat')) return 'risk';
  if (PROTECTIVE_KEYS.has(k) || k.includes('regulation') || k.includes('resilience') || k.includes('growth')) return 'protective';
  return 'load';
}

/** Number of data points at which confidence reaches 1.0 (min is 2). */
const TREND_TARGET_POINTS = 4;

function trendConfidence(pts: number): number {
  if (pts < 2) return 0;
  return Number(Math.max(0, Math.min(1, (pts - 1) / (TREND_TARGET_POINTS - 1))).toFixed(2));
}

export interface PatternTrend {
  pattern_key:        string;
  label:              string;
  polarity:           PatternPolarity;
  points:             number;
  first_value:        number;   // 0..100 (normalised from 0..1 confidence)
  last_value:         number;   // 0..100
  delta:              number;
  slope_per_session:  number;
  direction:          TrendDirection;
  confidence:         number;   // trend confidence 0..1 (scales with #points)
}

export interface PatternTrendResult {
  user_email:  string;
  sessions:    number;
  trends:      PatternTrend[];
  note:        string | null;
}

/**
 * Compute pattern trends for one user by email.
 * Pure read — never throws.
 */
export async function computePatternTrends(
  pool: Pool,
  email: string,
): Promise<PatternTrendResult> {
  const lower = email.toLowerCase();
  const result: PatternTrendResult = { user_email: lower, sessions: 0, trends: [], note: null };

  try {
    // Sessions in chronological order
    const { rows: sess } = await pool.query(
      `SELECT id::text AS id FROM capadex_sessions
        WHERE LOWER(guest_email) = $1 AND status = 'completed'
        ORDER BY created_at ASC`,
      [lower],
    );
    result.sessions = sess.length;

    if (sess.length < 2) {
      result.note = 'Needs ≥2 completed sessions to establish pattern trends.';
      return result;
    }

    const ids = sess.map((r) => r.id as string);

    // Patterns per session (highest confidence per session per key wins)
    const { rows: patRows } = await pool.query(
      `SELECT session_id::text AS sid, pattern_key, label,
              confidence::float AS conf
         FROM capadex_session_patterns
        WHERE session_id = ANY($1::uuid[])
        ORDER BY session_id, confidence DESC`,
      [ids],
    );

    // Group by pattern_key → per-session value map
    const byKey = new Map<string, { label: string; values: Map<string, number> }>();
    for (const row of patRows) {
      if (!byKey.has(row.pattern_key)) {
        byKey.set(row.pattern_key, {
          label:  row.label ?? row.pattern_key,
          values: new Map(),
        });
      }
      const entry = byKey.get(row.pattern_key)!;
      // Take first occurrence per session (already sorted DESC by confidence)
      if (!entry.values.has(row.sid)) {
        entry.values.set(row.sid, Number(row.conf) * 100); // 0..100
      }
    }

    // Build trend for each key seen in ≥2 sessions
    for (const [patternKey, { label, values }] of byKey) {
      const series = ids
        .map((id) => values.get(id))
        .filter((v): v is number => v !== undefined && Number.isFinite(v));

      if (series.length < 2) continue;

      const first = series[0];
      const last  = series[series.length - 1];
      const slope = leastSquaresSlope(series);

      result.trends.push({
        pattern_key:       patternKey,
        label:             label
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        polarity:          classifyPolarity(patternKey),
        points:            series.length,
        first_value:       Math.round(first),
        last_value:        Math.round(last),
        delta:             Math.round(last - first),
        slope_per_session: Number(slope.toFixed(2)),
        direction:         directionOf(slope),
        confidence:        trendConfidence(series.length),
      });
    }

    if (result.trends.length === 0) {
      result.note = 'Sessions found but no pattern appeared in ≥2 sessions.';
    }
  } catch (err) {
    result.note = 'Pattern trend computation failed (non-blocking).';
    console.warn('[wcl1-pattern-trend] compute failed:', err instanceof Error ? err.message : String(err));
  }

  return result;
}
