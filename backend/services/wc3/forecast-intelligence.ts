/**
 * CAPADEX WC-L2 — Forecast Intelligence Foundation.
 *
 * A PURE, READ-ONLY layer that turns the EXISTING Trend Intelligence into a one-step FORECAST.
 * It introduces NO new intelligence engine, construct, dimension, ontology, scoring model, or AI
 * model. It only EXTRAPOLATES a trend that existing intelligence already computed, using the EXISTING
 * linear formula that already ships in `computeLongitudinalConsumption`:
 *
 *     forecast_next = clamp(last + slope_per_session, 0..100)
 *
 * at the EXISTING trend confidence (the trend's own `confidence`, which already scales with the number
 * of comparable sessions). No new uncertainty number is invented.
 *
 * Four forecasts, each backed by ONE existing trend:
 *   - Risk Forecast    ← behaviour `risk` dim trend     (computeUserBehaviourTrends)
 *   - Growth Forecast  ← `stage` lever trend            (computeUserTrends)
 *   - Outcome Forecast ← `outcome` lever trend          (computeUserTrends)
 *   - Journey Forecast ← `journey` lever trend          (computeUserTrends)
 *
 * CANON (strict):
 *   - ADDITIVE & READ-ONLY: composes already-derived data via the existing PURE-READ trend functions
 *     (`computeUserTrends` / `computeUserBehaviourTrends` — neither writes nor ensures schema). No DB
 *     writes, no DDL, no recompute of any session vector.
 *   - DETERMINISTIC: same trends → same forecast.
 *   - HONEST DEGRADATION: a forecast needs an underlying trend (≥2 comparable sessions for that
 *     lever/dim). No trend → `forecastable:false` with an honest reason — NEVER a fabricated number.
 *   - FLAG-GATED: `computeUserForecasts` returns `{enabled:false}` when the flag is OFF, so no runtime
 *     surface can consume a forecast → byte-identical legacy behaviour.
 *   - NEVER-THROWS.
 */
import type { Pool } from 'pg';
import { isForecastIntelligenceEnabled } from '../../config/feature-flags';
import { directionOf, type TrendDirection } from './longitudinal-consumption';
import { computeUserTrends, type LeverTrend, type TrendLever } from './trend-intelligence';
import { computeUserBehaviourTrends, type BehaviourDimTrend } from './behaviour-trend-intelligence';

export type ForecastKind = 'risk' | 'growth' | 'outcome' | 'journey';

/** Qualitative confidence band derived from the EXISTING trend confidence (no new numeric model). */
export type ConfidenceBand = 'low' | 'moderate' | 'high';

/** The shape every existing trend (lever or behaviour dim) shares that a forecast needs. */
interface ProjectableTrend {
  points: number;
  last: number;
  slope_per_session: number;
  direction: TrendDirection;
  confidence: number;
}

export interface Forecast {
  kind: ForecastKind;
  label: string;
  forecastable: true;
  source_metric: string; // the existing trend metric this forecast extrapolates
  horizon: 'next_session';
  points: number; // comparable sessions behind the underlying trend
  last_value: number; // newest observed value (0..100)
  slope_per_session: number;
  projected_value: number; // clamp(last + slope) — the EXISTING forecast_next formula
  projected_direction: TrendDirection;
  forecast_confidence: number; // === underlying trend confidence (not re-derived)
  confidence_band: ConfidenceBand;
  basis: string;
}

export interface ForecastUnavailable {
  kind: ForecastKind;
  label: string;
  forecastable: false;
  reason: 'insufficient_sessions' | 'no_trend';
  detail: string;
}

export type ForecastResult = Forecast | ForecastUnavailable;

export interface UserForecasts {
  enabled: true;
  user_email: string;
  sessions: number;
  forecastable_count: number; // how many of the 4 forecasts have a real underlying trend
  forecasts: Record<ForecastKind, ForecastResult>;
  note: string | null;
}

export interface ForecastsDisabled {
  enabled: false;
  reason: 'flag_disabled';
}

const KIND_LABEL: Record<ForecastKind, string> = {
  risk: 'Risk Forecast',
  growth: 'Growth Forecast',
  outcome: 'Outcome Forecast',
  journey: 'Journey Forecast',
};

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Map the EXISTING trend confidence (0..1) to a qualitative band. No new scoring — a label only.
 * Aligned to the existing trend-confidence point scale (2 pts → 0.33, 3 → 0.67, 4 → 1.0): the 2-point
 * FLOOR is honestly `low` (a 2-point line cannot distinguish a real trajectory from noise), 3 points is
 * `moderate`, and only the full 4-point trend is `high`. Never inflates the floor.
 */
function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.84) return 'high';
  if (confidence >= 0.5) return 'moderate';
  return 'low';
}

/**
 * PURE projection of ONE existing trend, one step forward. Reuses the existing `last + slope` formula
 * (clamped) and the trend's OWN confidence — invents no new number. `directionOf` (existing) classifies
 * the projected direction so the same STABLE_DEADBAND applies as everywhere else.
 */
export function projectForecast(kind: ForecastKind, sourceMetric: string, trend: ProjectableTrend): Forecast {
  const projected = Math.round(clamp01to100(trend.last + trend.slope_per_session));
  return {
    kind,
    label: KIND_LABEL[kind],
    forecastable: true,
    source_metric: sourceMetric,
    horizon: 'next_session',
    points: trend.points,
    last_value: trend.last,
    slope_per_session: trend.slope_per_session,
    projected_value: projected,
    projected_direction: directionOf(trend.slope_per_session),
    forecast_confidence: trend.confidence,
    confidence_band: confidenceBand(trend.confidence),
    basis: `Linear extrapolation of the ${sourceMetric} trend (${trend.points} comparable sessions): ` +
      `last ${trend.last} + slope ${trend.slope_per_session}/session.`,
  };
}

function unavailable(kind: ForecastKind, sessions: number): ForecastUnavailable {
  return sessions < 2
    ? {
        kind,
        label: KIND_LABEL[kind],
        forecastable: false,
        reason: 'insufficient_sessions',
        detail: `Needs ≥2 completed sessions to form a trend; user has ${sessions}.`,
      }
    : {
        kind,
        label: KIND_LABEL[kind],
        forecastable: false,
        reason: 'no_trend',
        detail: 'User has ≥2 sessions but this lever/dimension had <2 readable points — no trend to extrapolate.',
      };
}

/**
 * Read-only: compute the four forecasts for one user by EXTRAPOLATING the existing trends.
 * Flag OFF → `{enabled:false}`. NEVER throws (degrades to every-forecast-unavailable on error).
 */
export async function computeUserForecasts(pool: Pool, email: string): Promise<UserForecasts | ForecastsDisabled> {
  if (!isForecastIntelligenceEnabled()) return { enabled: false, reason: 'flag_disabled' };

  const lower = email.toLowerCase();
  let leverTrends: LeverTrend[] = [];
  let behaviourTrends: BehaviourDimTrend[] = [];
  let sessions = 0;
  try {
    const [lev, beh] = await Promise.all([
      computeUserTrends(pool, lower),
      computeUserBehaviourTrends(pool, lower),
    ]);
    leverTrends = lev.trends;
    behaviourTrends = beh.trends;
    // Both report the same completed-session count; take the max defensively.
    sessions = Math.max(lev.sessions, beh.sessions);
  } catch (err) {
    console.warn('[wcl2-forecast] compute failed (non-blocking):', err instanceof Error ? err.message : String(err));
  }

  const leverByKey = new Map<TrendLever, LeverTrend>();
  for (const t of leverTrends) leverByKey.set(t.lever, t);
  const riskTrend = behaviourTrends.find((t) => t.dim === 'risk') ?? null;

  const build = (kind: ForecastKind, lever: TrendLever): ForecastResult => {
    const t = leverByKey.get(lever);
    return t ? projectForecast(kind, t.source, t) : unavailable(kind, sessions);
  };

  const forecasts: Record<ForecastKind, ForecastResult> = {
    growth: build('growth', 'stage'),
    outcome: build('outcome', 'outcome'),
    journey: build('journey', 'journey'),
    risk: riskTrend
      ? projectForecast('risk', riskTrend.metric, riskTrend)
      : unavailable('risk', sessions),
  };

  const forecastableCount = (Object.values(forecasts) as ForecastResult[]).filter((f) => f.forecastable).length;
  return {
    enabled: true,
    user_email: lower,
    sessions,
    forecastable_count: forecastableCount,
    forecasts,
    note: forecastableCount === 0
      ? (sessions < 2
          ? 'No forecast yet — needs at least two completed sessions to establish any trend.'
          : 'Has ≥2 sessions but no lever/dimension carried two readable points — no trend to extrapolate.')
      : null,
  };
}
