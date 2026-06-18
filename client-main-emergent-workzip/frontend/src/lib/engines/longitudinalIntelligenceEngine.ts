/**
 * Longitudinal Intelligence Engine
 * Tracks competency evolution, benchmark movement, learning velocity,
 * and transformation momentum across time-ordered snapshots.
 */

import { COMPETENCY_DOMAINS } from '@/data/marketCatalog';

/* ── Input types ──────────────────────────────────────────────────── */
export interface CompetencySnapshot {
  snapshotId:       string;
  timestamp:        number;   // unix ms
  competencyLevels: Record<string, number>;
  eiScore:          number;
  percentile?:      number;
  source?:          'assessment' | 'self-report' | 'system';
  label?:           string;   // e.g. "Q1 2026"
}

/* ── Output types ─────────────────────────────────────────────────── */
export interface CompetencyDelta {
  competencyId:      string;
  label:             string;
  domain:            string;
  history:           { timestamp: number; level: number }[];
  fromLevel:         number;
  toLevel:           number;
  delta:             number;
  trend:             'growing' | 'stable' | 'declining';
  velocityPerMonth:  number;   // avg level gain per month
  accelerating:      boolean;  // is the pace increasing?
  peakLevel:         number;
  consistency:       number;   // 0-100: how consistent growth is
}

export interface BenchmarkMovement {
  eiHistory:          { timestamp: number; score: number; label?: string }[];
  eiDelta:            number;
  percentileDelta:    number;
  trend:              'improving' | 'stable' | 'declining';
  avgGainPerMonth:    number;
  projectedEI3mo:     number;
  projectedEI12mo:    number;
  bestGainPeriod:     string;
}

export interface LongitudinalIntelligenceOutput {
  snapshots:                number;
  spanDays:                 number;
  competencyDeltas:         CompetencyDelta[];
  benchmarkMovement:        BenchmarkMovement;
  learningVelocity:         number;   // avg levels/month across all competencies
  transformationMomentum:   number;   // 0-100
  overallTrend:             'accelerating' | 'steady' | 'plateauing' | 'declining';
  growingCompetencies:      string[];
  stagnantCompetencies:     string[];
  topGrowthArea:            string;
  topGrowthDomain:          string;
  estimatedBandUpgrade:     number;   // months to next EI band
  milestonesSinceStart:     number;   // how many competencies levelled up
  consistencyScore:         number;   // 0-100: steady learner vs burst learner
  momentumNarrative:        string;
}

/* ── Helper functions ─────────────────────────────────────────────── */
function daysSpan(snaps: CompetencySnapshot[]): number {
  if (snaps.length < 2) return 0;
  return (snaps[snaps.length - 1].timestamp - snaps[0].timestamp) / (1000 * 60 * 60 * 24);
}

function monthsSpan(snaps: CompetencySnapshot[]): number {
  return Math.max(0.1, daysSpan(snaps) / 30.44);
}

function linearProjection(history: number[], stepsAhead: number): number {
  if (history.length < 2) return history[history.length - 1] ?? 0;
  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history;
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0) /
                Math.max(1, xs.reduce((s, x) => s + (x - xMean) ** 2, 0));
  return yMean + slope * (n - 1 + stepsAhead);
}

function consistencyScore(deltas: number[]): number {
  if (deltas.length < 2) return 50;
  const positive = deltas.filter(d => d > 0).length;
  const ratioPositive = positive / deltas.length;
  const variance = deltas.reduce((s, d, _, a) => {
    const m = a.reduce((ss, v) => ss + v, 0) / a.length;
    return s + (d - m) ** 2;
  }, 0) / deltas.length;
  const consistencyFromVariance = Math.max(0, 100 - Math.sqrt(variance) * 10);
  return Math.round(ratioPositive * 60 + consistencyFromVariance * 0.4);
}

/* ── Main engine function ─────────────────────────────────────────── */
export function runLongitudinalIntelligenceEngine(
  snapshots: CompetencySnapshot[],
): LongitudinalIntelligenceOutput {
  if (snapshots.length === 0) {
    return {
      snapshots: 0, spanDays: 0, competencyDeltas: [], benchmarkMovement: {
        eiHistory: [], eiDelta: 0, percentileDelta: 0, trend: 'stable',
        avgGainPerMonth: 0, projectedEI3mo: 0, projectedEI12mo: 0, bestGainPeriod: 'N/A',
      },
      learningVelocity: 0, transformationMomentum: 0, overallTrend: 'steady',
      growingCompetencies: [], stagnantCompetencies: [], topGrowthArea: 'N/A',
      topGrowthDomain: 'N/A', estimatedBandUpgrade: 12, milestonesSinceStart: 0,
      consistencyScore: 0, momentumNarrative: 'No historical data yet — start your first assessment.',
    };
  }

  const ordered = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const first   = ordered[0];
  const last    = ordered[ordered.length - 1];
  const months  = monthsSpan(ordered);
  const span    = daysSpan(ordered);

  /* Per-competency deltas */
  const competencyDeltas: CompetencyDelta[] = COMPETENCY_DOMAINS.map(cd => {
    const history = ordered.map(s => ({
      timestamp: s.timestamp,
      level: s.competencyLevels[cd.id] ?? 0,
    }));
    const levels       = history.map(h => h.level);
    const fromLevel    = levels[0];
    const toLevel      = levels[levels.length - 1];
    const delta        = toLevel - fromLevel;
    const velocityPerMonth = months > 0 ? delta / months : 0;
    const trend: CompetencyDelta['trend'] = delta > 0.2 ? 'growing' : delta < -0.1 ? 'declining' : 'stable';

    // Acceleration: compare first-half vs second-half velocity
    const mid       = Math.floor(levels.length / 2);
    const firstHalf = levels.slice(0, mid);
    const secHalf   = levels.slice(mid);
    const v1 = firstHalf.length > 1 ? (firstHalf[firstHalf.length - 1] - firstHalf[0]) : 0;
    const v2 = secHalf.length > 1   ? (secHalf[secHalf.length - 1] - secHalf[0]) : 0;
    const accelerating = v2 > v1 + 0.1;

    const intervalDeltas = levels.slice(1).map((l, i) => l - levels[i]);
    const consistency = consistencyScore(intervalDeltas);

    return {
      competencyId: cd.id, label: cd.label, domain: cd.domain,
      history, fromLevel, toLevel, delta, trend,
      velocityPerMonth: Math.round(velocityPerMonth * 100) / 100,
      accelerating, peakLevel: Math.max(...levels), consistency,
    };
  });

  /* Benchmark movement */
  const eiHistory = ordered.map(s => ({
    timestamp: s.timestamp, score: s.eiScore, label: s.label,
  }));
  const eiDelta = last.eiScore - first.eiScore;
  const pctDelta = (last.percentile ?? 0) - (first.percentile ?? 0);
  const eiScores = eiHistory.map(h => h.score);
  const proj3mo   = Math.round(Math.min(99, Math.max(0, linearProjection(eiScores, Math.round(3 / months)))));
  const proj12mo  = Math.round(Math.min(99, Math.max(0, linearProjection(eiScores, Math.round(12 / months)))));
  const avgGain   = months > 0 ? Math.round((eiDelta / months) * 10) / 10 : 0;

  // Best gain period
  let bestGain = 0, bestPeriod = 'N/A';
  for (let i = 1; i < eiHistory.length; i++) {
    const g = eiHistory[i].score - eiHistory[i - 1].score;
    if (g > bestGain) { bestGain = g; bestPeriod = eiHistory[i].label ?? `Period ${i}`; }
  }

  const benchmarkMovement: BenchmarkMovement = {
    eiHistory, eiDelta, percentileDelta: pctDelta,
    trend: eiDelta > 3 ? 'improving' : eiDelta < -3 ? 'declining' : 'stable',
    avgGainPerMonth: avgGain, projectedEI3mo: proj3mo, projectedEI12mo: proj12mo,
    bestGainPeriod: bestPeriod,
  };

  /* Learning velocity */
  const growing         = competencyDeltas.filter(d => d.trend === 'growing');
  const stagnant        = competencyDeltas.filter(d => d.trend === 'stable' && d.toLevel < 3);
  const avgVelocityMonth= months > 0
    ? growing.reduce((s, d) => s + d.velocityPerMonth, 0) / Math.max(1, growing.length)
    : 0;
  const learningVelocity = Math.round(Math.min(100, avgVelocityMonth * 40));

  /* Transformation momentum */
  const growthScore   = (growing.length / Math.max(1, COMPETENCY_DOMAINS.length)) * 50;
  const eiGainScore   = Math.min(30, Math.max(0, eiDelta / 2));
  const accelScore    = competencyDeltas.filter(d => d.accelerating).length * 2;
  const momentum      = Math.round(Math.min(100, growthScore + eiGainScore + accelScore));

  /* Overall trend */
  const acceleratingCount = competencyDeltas.filter(d => d.accelerating).length;
  const overallTrend: LongitudinalIntelligenceOutput['overallTrend'] =
    acceleratingCount >= 5 && eiDelta > 5 ? 'accelerating' :
    acceleratingCount >= 3 || eiDelta > 2 ? 'steady' :
    growing.length <= 2                    ? 'plateauing' : 'declining';

  /* Top growth domain */
  const domainVelocities: Record<string, number> = {};
  competencyDeltas.filter(d => d.trend === 'growing').forEach(d => {
    domainVelocities[d.domain] = (domainVelocities[d.domain] ?? 0) + d.velocityPerMonth;
  });
  const topDomain = Object.entries(domainVelocities).sort(([,a],[,b]) => b-a)[0]?.[0] ?? 'N/A';
  const topComp   = [...competencyDeltas].sort((a,b) => b.velocityPerMonth - a.velocityPerMonth)[0];

  /* ETA to next band */
  const currentBandTop = last.eiScore >= 80 ? 99 : last.eiScore >= 65 ? 79 : last.eiScore >= 50 ? 64 : last.eiScore >= 35 ? 49 : 34;
  const pointsNeeded   = currentBandTop - last.eiScore + 1;
  const etaBand        = avgGain > 0 ? Math.ceil(pointsNeeded / avgGain) : 24;

  /* Milestones (level-ups) */
  const milestones = competencyDeltas.filter(d => Math.floor(d.toLevel) > Math.floor(d.fromLevel)).length;

  /* Consistency */
  const allIntervalDeltas = ordered.slice(1).map((s, i) => s.eiScore - ordered[i].eiScore);
  const consScore = consistencyScore(allIntervalDeltas);

  /* Narrative */
  const narrative = overallTrend === 'accelerating'
    ? `Outstanding momentum — ${growing.length} competencies growing, EI up ${eiDelta} pts, on track for ${proj12mo} EI in 12 months.`
    : overallTrend === 'steady'
      ? `Steady progress — ${growing.length} competencies developing, EI moving at ${avgGain} pts/month.`
      : overallTrend === 'plateauing'
        ? `Growth plateauing — fewer competencies advancing. Consider intensifying learning in ${topComp?.label ?? 'core areas'}.`
        : 'Growth has stalled. A focused intervention programme is recommended.';

  return {
    snapshots: ordered.length, spanDays: Math.round(span),
    competencyDeltas, benchmarkMovement,
    learningVelocity, transformationMomentum: momentum, overallTrend,
    growingCompetencies:  growing.map(d => d.competencyId),
    stagnantCompetencies: stagnant.map(d => d.competencyId),
    topGrowthArea:        topComp?.label ?? 'N/A',
    topGrowthDomain:      topDomain,
    estimatedBandUpgrade: Math.min(36, etaBand),
    milestonesSinceStart: milestones,
    consistencyScore:     consScore,
    momentumNarrative:    narrative,
  };
}

/* ── Utility: build a snapshot from current state ─────────────────── */
export function buildSnapshot(
  competencyLevels: Record<string, number>,
  eiScore: number,
  percentile?: number,
  label?: string,
): CompetencySnapshot {
  return {
    snapshotId:       `snap_${Date.now()}`,
    timestamp:        Date.now(),
    competencyLevels: { ...competencyLevels },
    eiScore,
    percentile,
    source:           'system',
    label:            label ?? new Date().toLocaleDateString('en-IN', { month:'short', year:'numeric' }),
  };
}
