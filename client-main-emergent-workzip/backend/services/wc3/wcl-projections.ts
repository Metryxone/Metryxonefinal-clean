/**
 * WCL3 — Outcome Projections  (Outcome ← Forecasts)
 *
 * Pure derivation layer that composes WCL2 horizon forecasts into three
 * high-level outcome projections a user cares about:
 *
 *   risk_projection    — direction + level of behavioural risk (30/60/90d)
 *   growth_projection  — whether growth is on-track (30/60/90d)
 *   outcome_projection — directional outcome label from risk × growth
 *
 * Canon: Outcome ← Forecasts  (NO raw scores, NO new engine)
 *   Derives exclusively from HorizonForecastResult produced by WCL2.
 *
 * NEVER throws. PURE derivation (no DB reads, no writes).
 */

import type { HorizonForecastResult, HorizonForecast } from './horizon-forecast';

export type RiskLevel      = 'high' | 'moderate' | 'low' | 'unknown';
export type RiskTrajectory = 'rising' | 'stable' | 'falling';
export type GrowthTraj     = 'accelerating' | 'growing' | 'stable' | 'plateauing' | 'declining';
export type OutcomeLabel   = 'positive' | 'neutral' | 'at_risk';

export interface RiskProjection {
  level:         RiskLevel;
  trajectory:    RiskTrajectory;
  driver:        string | null;
  confidence:    number;
  d30_label:     string;
  d60_label:     string;
  d90_label:     string;
  explainability: string;
}

export interface GrowthProjection {
  trajectory:    GrowthTraj;
  driver:        string | null;
  confidence:    number;
  d30_label:     string;
  d60_label:     string;
  d90_label:     string;
  explainability: string;
}

export interface OutcomeProjection {
  likely_outcome:  OutcomeLabel;
  confidence:      number;
  stage_direction: string;
  d30_label:       string;
  d60_label:       string;
  d90_label:       string;
  explainability:  string;
}

export interface WCL3Projections {
  risk:    RiskProjection;
  growth:  GrowthProjection;
  outcome: OutcomeProjection;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskLevelFromValue(v: number): RiskLevel {
  if (v >= 70) return 'high';
  if (v >= 40) return 'moderate';
  if (v > 0)   return 'low';
  return 'unknown';
}

/**
 * Human-readable horizon label for a risk pattern.
 * For RISK polarity: rising value = worsening.
 * For PROTECTIVE polarity: rising value = improving.
 */
function horizonLabel(f: HorizonForecast, days: number): string {
  const pt       = days === 30 ? f.d30 : days === 60 ? f.d60 : f.d90;
  const isRisk   = f.polarity === 'risk';
  const rising   = pt.direction === 'improving'; // slope direction name in existing system
  const worsening = isRisk ? rising : !rising;

  if (worsening)             return `Worsening in ${days}d (${pt.projected}%)`;
  if (pt.direction === 'stable') return `Stable at ${pt.projected}%`;
  return `Improving in ${days}d (${pt.projected}%)`;
}

function riskTrajectoryFromSlope(slope: number): RiskTrajectory {
  if (slope >  1.5) return 'rising';
  if (slope < -1.5) return 'falling';
  return 'stable';
}

function growthTrajFromSlope(slope: number, polarity: string): GrowthTraj {
  const isProtective = polarity === 'protective';
  const effectiveSlope = isProtective ? slope : -slope; // risk falling = growth
  if (effectiveSlope >  3) return 'accelerating';
  if (effectiveSlope >  1) return 'growing';
  if (effectiveSlope < -3) return 'declining';
  if (effectiveSlope < -1) return 'plateauing';
  return 'stable';
}

// ── Main derivation ───────────────────────────────────────────────────────────

/**
 * Derive WCL3 projections from WCL2 horizon forecasts.
 * @param horizons      WCL2 result
 * @param stageDir      Optional lever direction from WCL1 (stage trend direction)
 * Returns null if WCL2 produced no forecasts.
 */
export function deriveProjections(
  horizons:   HorizonForecastResult,
  stageDir?:  string | null,
): WCL3Projections | null {
  if (!horizons.enabled || horizons.forecasts.length === 0) return null;

  const risks      = horizons.forecasts.filter((f) => f.polarity === 'risk');
  const protective = horizons.forecasts.filter((f) => f.polarity === 'protective');
  const loads      = horizons.forecasts.filter((f) => f.polarity === 'load');

  // ── Risk Projection ────────────────────────────────────────────────────────
  // Primary driver: risk pattern with highest d90 projected value (worst case)
  const sortedRisks = [...risks].sort(
    (a, b) => b.d90.projected - a.d90.projected || b.current_value - a.current_value,
  );
  const topRisk = sortedRisks[0] ?? null;

  // Fallback to loads when no explicit risk patterns present
  const riskProxy = topRisk ?? loads.sort((a, b) => b.d90.projected - a.d90.projected)[0] ?? null;
  const riskConf  = risks.length > 0 ? 0.7 : loads.length > 0 ? 0.4 : 0.2;

  const riskLevel: RiskLevel = riskProxy
    ? riskLevelFromValue(riskProxy.d90.projected)
    : 'unknown';

  const riskTraj: RiskTrajectory = riskProxy
    ? riskTrajectoryFromSlope(riskProxy.slope_per_session)
    : 'stable';

  const riskProj: RiskProjection = {
    level:          riskLevel,
    trajectory:     riskTraj,
    driver:         riskProxy?.label ?? null,
    confidence:     riskConf,
    d30_label:      riskProxy ? horizonLabel(riskProxy, 30) : 'Insufficient data',
    d60_label:      riskProxy ? horizonLabel(riskProxy, 60) : 'Insufficient data',
    d90_label:      riskProxy ? horizonLabel(riskProxy, 90) : 'Insufficient data',
    explainability: riskProxy
      ? `Driven by "${riskProxy.label}" (${riskProxy.confidence_band} confidence, ${riskProxy.sessions_per_30d.toFixed(1)} sessions/30d).`
      : 'No direct risk pattern; using load signals as proxy.',
  };

  // ── Growth Projection ──────────────────────────────────────────────────────
  const topProtective = protective[0] ?? null;

  // Stage direction (from WCL1 lever trend) takes priority over pattern slope
  let growthTraj: GrowthTraj = 'stable';
  let growthDriver: string | null = null;
  let growthConf = 0.35;

  if (stageDir === 'improving') {
    growthTraj   = 'growing';
    growthDriver = 'Stage progression';
    growthConf   = 0.55;
  } else if (stageDir === 'declining') {
    growthTraj   = 'declining';
    growthDriver = 'Stage regression';
    growthConf   = 0.55;
  } else if (topProtective) {
    growthTraj   = growthTrajFromSlope(topProtective.slope_per_session, 'protective');
    growthDriver = topProtective.label;
    growthConf   = 0.65;
  } else if (riskTraj === 'falling') {
    growthTraj   = 'growing'; // risk reducing → space for growth
    growthDriver = `${riskProxy?.label ?? 'Risk'} reducing`;
    growthConf   = 0.40;
  }

  const growthProj: GrowthProjection = {
    trajectory:   growthTraj,
    driver:       growthDriver,
    confidence:   growthConf,
    d30_label:    topProtective ? horizonLabel(topProtective, 30) : stageDir === 'improving' ? 'Stage advancing' : 'Stable trajectory',
    d60_label:    topProtective ? horizonLabel(topProtective, 60) : stageDir === 'improving' ? 'Continued advancement' : 'Stable trajectory',
    d90_label:    topProtective ? horizonLabel(topProtective, 90) : stageDir === 'improving' ? 'On track for next stage' : 'Stable trajectory',
    explainability: topProtective
      ? `Driven by "${topProtective.label}" (${topProtective.confidence_band} confidence).`
      : stageDir
        ? `Stage direction: ${stageDir}.`
        : 'Derived from risk reduction trajectory.',
  };

  // ── Outcome Projection ─────────────────────────────────────────────────────
  const riskWeight   = riskLevel === 'high' ? 0.8 : riskLevel === 'moderate' ? 0.5 : 0.1;
  const growthWeight = ['accelerating', 'growing'].includes(growthTraj) ? 0.8 :
                       growthTraj === 'stable' ? 0.5 : 0.2;
  const outcomeScore  = growthWeight * 0.55 + (1 - riskWeight) * 0.45;

  const likelyOutcome: OutcomeLabel =
    outcomeScore >= 0.6 ? 'positive' :
    outcomeScore >= 0.4 ? 'neutral'  : 'at_risk';

  const outcomeConf = Number(Math.min(riskConf, growthConf).toFixed(2));

  const outcomeProj: OutcomeProjection = {
    likely_outcome:  likelyOutcome,
    confidence:      outcomeConf,
    stage_direction: stageDir ?? 'unknown',
    d30_label: likelyOutcome === 'positive' ? 'On track — positive signal'
             : likelyOutcome === 'neutral'  ? 'Mixed signals — monitor closely'
             : 'Risk patterns dominant — intervention needed',
    d60_label: likelyOutcome === 'positive' ? 'Continued positive trajectory'
             : likelyOutcome === 'neutral'  ? 'Stabilisation possible with action'
             : 'High-risk patterns likely to persist',
    d90_label: likelyOutcome === 'positive' ? 'Strong 90-day outcome trajectory'
             : likelyOutcome === 'neutral'  ? 'Outcome uncertain — support recommended'
             : 'Intervention critical for outcome improvement',
    explainability:
      `Outcome derived from risk level (${riskLevel}) × growth trajectory (${growthTraj}). ` +
      `Score: ${Math.round(outcomeScore * 100)}%. Confidence: ${Math.round(outcomeConf * 100)}%.`,
  };

  return { risk: riskProj, growth: growthProj, outcome: outcomeProj };
}
