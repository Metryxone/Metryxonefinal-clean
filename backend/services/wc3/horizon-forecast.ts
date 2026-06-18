/**
 * WCL2 — Horizon Forecast Intelligence
 *
 * Extends WCL1 Pattern Trends into time-based projections:
 *   30-day · 60-day · 90-day
 *
 * Canon: Forecast ← Trends  (NOT raw scores — only from WCL1 pattern trends)
 *
 * Sessions-to-days mapping: derived from ACTUAL session timestamps for the
 * user, so the horizon reflects their real assessment cadence.
 *
 * Formula (same existing one from longitudinal-consumption.ts):
 *   projected = clamp(last + slope * sessions_in_horizon)
 * where sessions_in_horizon = sessions_per_30d × (days / 30).
 *
 * NEVER throws. PURE READ. Flag-gated (isForecastIntelligenceEnabled).
 */

import type { Pool } from 'pg';
import { directionOf, type TrendDirection } from './longitudinal-consumption';
import { computePatternTrends, type PatternTrend } from './pattern-trend-intelligence';
import { isForecastIntelligenceEnabled } from '../../config/feature-flags';

export type ConfidenceBand = 'low' | 'moderate' | 'high';

export interface HorizonPoint {
  days:       number;
  projected:  number;       // 0..100
  direction:  TrendDirection;
  label:      string;       // e.g. "30-day"
}

export interface HorizonForecast {
  pattern_key:        string;
  label:              string;
  polarity:           string;    // 'risk' | 'load' | 'protective'
  current_value:      number;
  slope_per_session:  number;
  sessions_per_30d:   number;
  d30:                HorizonPoint;
  d60:                HorizonPoint;
  d90:                HorizonPoint;
  confidence_band:    ConfidenceBand;
  basis:              string;
}

export interface HorizonForecastResult {
  enabled:          boolean;
  user_email:       string;
  sessions_per_30d: number;
  forecasts:        HorizonForecast[];
  note:             string | null;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function confidenceBand(c: number): ConfidenceBand {
  if (c >= 0.84) return 'high';
  if (c >= 0.5)  return 'moderate';
  return 'low';
}

/**
 * Derive sessions_per_30d from actual session timestamps.
 * Formula: (n_sessions - 1) / daySpan * 30.
 * Floor 0.1, cap 10 (avoids wild extrapolation).
 */
async function deriveSessionFrequency(pool: Pool, email: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT created_at FROM capadex_sessions
        WHERE LOWER(guest_email) = $1 AND status = 'completed'
        ORDER BY created_at ASC`,
      [email.toLowerCase()],
    );
    if (rows.length < 2) return 1; // default: 1 session / 30d
    const first   = new Date(rows[0].created_at).getTime();
    const last    = new Date(rows[rows.length - 1].created_at).getTime();
    const daySpan = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
    const rate    = ((rows.length - 1) / daySpan) * 30;
    return Math.max(0.1, Math.min(10, Number(rate.toFixed(2))));
  } catch {
    return 1;
  }
}

function projectHorizon(
  trend:       PatternTrend,
  sessionsIn:  number,
  days:        number,
  label:       string,
): HorizonPoint {
  const projected = Math.round(clamp(trend.last_value + trend.slope_per_session * sessionsIn));
  // Slope over this horizon (scaled back to per-session units for directionOf)
  const horizonSlope = trend.slope_per_session * sessionsIn / Math.max(1, days / 30);
  return { days, projected, direction: directionOf(horizonSlope), label };
}

/**
 * Compute 30/60/90-day horizon forecasts for one user.
 * Flag OFF → disabled response. NEVER throws.
 */
export async function computeHorizonForecasts(
  pool: Pool,
  email: string,
): Promise<HorizonForecastResult> {
  if (!isForecastIntelligenceEnabled()) {
    return { enabled: false, user_email: email, sessions_per_30d: 0, forecasts: [], note: 'Flag disabled' };
  }

  const lower = email.toLowerCase();
  const result: HorizonForecastResult = {
    enabled:          true,
    user_email:       lower,
    sessions_per_30d: 1,
    forecasts:        [],
    note:             null,
  };

  try {
    const [patTrends, freq] = await Promise.all([
      computePatternTrends(pool, lower),
      deriveSessionFrequency(pool, lower),
    ]);

    result.sessions_per_30d = freq;

    if (patTrends.trends.length === 0) {
      result.note = patTrends.note ?? 'No pattern trends to forecast from.';
      return result;
    }

    for (const t of patTrends.trends) {
      result.forecasts.push({
        pattern_key:        t.pattern_key,
        label:              t.label,
        polarity:           t.polarity,
        current_value:      t.last_value,
        slope_per_session:  t.slope_per_session,
        sessions_per_30d:   freq,
        d30: projectHorizon(t, freq * 1, 30, '30-day'),
        d60: projectHorizon(t, freq * 2, 60, '60-day'),
        d90: projectHorizon(t, freq * 3, 90, '90-day'),
        confidence_band: confidenceBand(t.confidence),
        basis: `${t.points}-session pattern trend extrapolated at ${freq.toFixed(1)} sessions/30d.`,
      });
    }
  } catch (err) {
    result.note = 'Horizon forecast computation failed (non-blocking).';
    console.warn('[wcl2-horizon-forecast] compute failed:', err instanceof Error ? err.message : String(err));
  }

  return result;
}
