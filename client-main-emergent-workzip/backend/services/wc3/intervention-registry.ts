/**
 * CAPADEX WC-L4 — Intervention Registry (deterministic annotation config).
 *
 * COMPOSE-ONLY. This module is the static, deterministic CONFIGURATION for the WC-L4
 * Intervention Intelligence engine. It deliberately holds NO invented program names and
 * NO scoring — the interventions themselves are the already-curated, library-backed rows
 * from `intervention_library` (surfaced per session via `wc3_outcome_actions`). The ONLY
 * generator of an intervention is the L2 Outcome layer's library-backed actions.
 *
 * Everything here configures how the OTHER intelligence layers (Stage / Journey / Decision /
 * User / Trend / Forecast) ANNOTATE those library-backed interventions with priority/context.
 * It introduces no new construct / ontology / dimension / AI model.
 *
 * Polarity note (honesty-critical): `directionOf(slope)` in longitudinal-consumption.ts is a
 * PURE NUMERIC slope sign — it is NOT polarity-aware. For positive-progression metrics
 * (stage / outcome / journey / decision levers + the positive behaviour dims) a `declining`
 * direction is the CONCERN. For the `risk` behaviour dim and the `risk` forecast kind a RISING
 * value (`improving` direction) is the concern. `isTrendConcern` / `isForecastConcern` encode
 * this so a falling risk trend is never mis-read as a problem.
 */

/** The single layer permitted to GENERATE an intervention (library-backed only). */
export const GENERATOR_LAYER = 'outcome' as const;

/** Layers that may only ANNOTATE (priority/context) — never generate an intervention. */
export const ANNOTATION_LAYERS = ['stage', 'journey', 'decision', 'user', 'trend', 'forecast'] as const;
export type AnnotationLayer = (typeof ANNOTATION_LAYERS)[number];

type Polarity = 'positive' | 'negative';

/**
 * Per-metric polarity for WC-L1 trend metrics (as stored in `wc3_longitudinal_trends.metric`).
 * positive → `declining` is the concern; negative → `improving` (rising value) is the concern.
 * Trend metric names are PREFIXED (`behaviour_confidence`, not `confidence`) — match exactly.
 */
export const TREND_METRIC_POLARITY: Record<string, Polarity> = {
  stage: 'positive',
  outcome: 'positive',
  journey: 'positive',
  decision: 'positive',
  behaviour_motivation: 'positive',
  behaviour_confidence: 'positive',
  behaviour_engagement: 'positive',
  behaviour_adaptability: 'positive',
  behaviour_risk: 'negative',
};

/** Per WC-L2 forecast kind polarity (kinds: risk / growth / outcome / journey). */
export const FORECAST_KIND_POLARITY: Record<string, Polarity> = {
  risk: 'negative',
  growth: 'positive',
  outcome: 'positive',
  journey: 'positive',
};

/**
 * True when a trend's numeric direction represents a CONCERN for the user, given the metric's
 * polarity. Unknown metrics are treated conservatively as non-concern (never fabricate a concern).
 */
export function isTrendConcern(metric: string, direction: string): boolean {
  const polarity = TREND_METRIC_POLARITY[metric];
  if (!polarity) return false;
  return polarity === 'positive' ? direction === 'declining' : direction === 'improving';
}

/** True when a forecast's projected direction represents a CONCERN, given the kind's polarity. */
export function isForecastConcern(kind: string, projectedDirection: string): boolean {
  const polarity = FORECAST_KIND_POLARITY[kind];
  if (!polarity) return false;
  return polarity === 'positive' ? projectedDirection === 'declining' : projectedDirection === 'improving';
}
