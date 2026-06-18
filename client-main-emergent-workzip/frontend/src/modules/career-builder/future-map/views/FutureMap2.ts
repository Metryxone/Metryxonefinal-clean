/**
 * Future Map 2.0 Module View
 * Aggregated output type for the Future Map tab/panel.
 * Wraps FutureMapOutput with pre-computed chart data
 * ready for visualization components.
 */

import type { FutureMapOutput, FutureMapRecommendation } from '@/lib/engines/futureMapEngine';
import type { TrajectoryNode }  from '@/components/career/visualizations/TrajectoryMap';
import type { TimelinePhase }   from '@/components/career/visualizations/GrowthTimeline';
import type { HeatmapCell }     from '@/components/career/visualizations/CompetencyHeatmap';
import type { FutureCompetencySignal } from '@/lib/competency-genome/futureMapping';
import { COMPETENCY_DOMAINS }   from '@/data/marketCatalog';

export interface FutureMap2View {
  futureMap:         FutureMapOutput;

  /* Pre-computed chart data */
  trajectoryNodes:   TrajectoryNode[];      // for TrajectoryMap
  timelinePhases:    TimelinePhase[];       // for GrowthTimeline
  heatmapCells:      HeatmapCell[];         // for CompetencyHeatmap

  /* Top 3 role cards with colour coding */
  roleCards:         FutureRoleCard[];

  /* Urgency signals */
  urgencyAlerts:     UrgencyAlert[];

  /* Future portfolio analysis */
  portfolioScore:    number;                // 0-100
  portfolioLabel:    string;
  topFutureSignals:  FutureCompetencySignal[];
}

export interface FutureRoleCard {
  rank:              number;
  rec:               FutureMapRecommendation;
  accentColor:       string;
  urgencyColor:      string;
  cta:               string;
}

export interface UrgencyAlert {
  type:    'act-now' | 'gap' | 'momentum' | 'risk';
  message: string;
  color:   string;
}

const URGENCY_COLORS: Record<FutureMapRecommendation['urgency'], string> = {
  'act-now':   '#16a34a',
  'plan-ahead':'#344E86',
  'watch':     '#f4a261',
  'long-term': '#94a3b8',
};

const RANK_COLORS = ['#344E86', '#4ECDC4', '#8b5cf6'];

/** Build a FutureMap2View from the FutureMapEngine output. */
export function buildFutureMap2View(
  futureMap:         FutureMapOutput,
  competencyLevels:  Record<string, number>,
  futureSignals:     FutureCompetencySignal[],
): FutureMap2View {
  /* Trajectory nodes — top 4 recommendations as a path */
  const trajectoryNodes: TrajectoryNode[] = [
    { id: 'current', label: 'Now', sublabel: 'Current profile', status: 'current', score: Math.round(futureMap.futureReadinessScore) },
    ...futureMap.recommendations.slice(0, 3).map((rec, i): TrajectoryNode => ({
      id:       rec.role.id,
      label:    rec.role.title,
      sublabel: `${rec.transformation.probability}% fit`,
      status:   i === 0 ? 'next' : 'future',
      etaMonths:rec.etaMonths,
      score:    rec.v2Score,
    })),
  ];

  /* Growth timeline phases — from IDP milestones */
  const topRec    = futureMap.topPick;
  const timelinePhases: TimelinePhase[] = topRec
    ? [
        { id: 'foundation', label: 'Foundation',  weeks: Math.max(4, Math.round(topRec.etaMonths * 4 * 0.3)), color: '#4ECDC4', completed: 40 },
        { id: 'growth',     label: 'Skill Build',  weeks: Math.max(4, Math.round(topRec.etaMonths * 4 * 0.4)), color: '#344E86', completed: 15 },
        { id: 'mastery',    label: 'Apply & Land', weeks: Math.max(4, Math.round(topRec.etaMonths * 4 * 0.3)), color: '#8b5cf6', completed: 0 },
      ]
    : [];

  /* Heatmap cells — competency levels with future signals */
  const signalMap = new Map(futureSignals.map(s => [s.competencyId, s]));
  const heatmapCells: HeatmapCell[] = COMPETENCY_DOMAINS.map(d => ({
    id:      d.id,
    label:   d.label,
    domain:  d.domain,
    level:   competencyLevels[d.id] ?? 0,
    future:  signalMap.get(d.id)?.growthTrajectory ?? 'stable',
  }));

  /* Role cards */
  const roleCards: FutureRoleCard[] = futureMap.recommendations.slice(0, 3).map((rec, i) => ({
    rank:         i + 1,
    rec,
    accentColor:  RANK_COLORS[i] ?? '#94a3b8',
    urgencyColor: URGENCY_COLORS[rec.urgency],
    cta:          rec.urgency === 'act-now'    ? 'Start Now'   :
                  rec.urgency === 'plan-ahead' ? 'Plan Path'   :
                  rec.urgency === 'watch'      ? 'Watch Market': 'Explore',
  }));

  /* Urgency alerts */
  const urgencyAlerts: UrgencyAlert[] = [];
  const actNow = futureMap.recommendations.filter(r => r.urgency === 'act-now');
  if (actNow.length)
    urgencyAlerts.push({ type: 'act-now', message: `${actNow.map(r => r.role.title).join(', ')} — market timing is optimal now`, color: '#16a34a' });
  if (futureMap.portfolioGaps.length >= 3)
    urgencyAlerts.push({ type: 'gap', message: `${futureMap.portfolioGaps[0].label} gaps your top ${futureMap.portfolioGaps[0].missingFor} role options`, color: '#ef4444' });
  futureMap.marketMomentumSignals.filter(s => s.impact === 'high').slice(0, 2).forEach(s =>
    urgencyAlerts.push({ type: 'momentum', message: s.signal, color: '#344E86' }),
  );

  /* Portfolio score label */
  const portfolioScore = futureMap.futureReadinessScore;
  const portfolioLabel = portfolioScore >= 75 ? 'Future-Ready' :
                         portfolioScore >= 55 ? 'Developing' :
                         portfolioScore >= 35 ? 'Early Stage' : 'Needs Attention';

  /* Top future signals (hot + rising) */
  const topFutureSignals = futureSignals
    .filter(s => s.growthTrajectory === 'hot' || s.growthTrajectory === 'rising')
    .sort((a, b) => b.relevanceIn3Yr - a.relevanceIn3Yr)
    .slice(0, 5);

  return {
    futureMap, trajectoryNodes, timelinePhases, heatmapCells,
    roleCards, urgencyAlerts,
    portfolioScore, portfolioLabel, topFutureSignals,
  };
}
