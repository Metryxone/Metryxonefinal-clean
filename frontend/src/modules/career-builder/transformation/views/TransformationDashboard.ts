/**
 * Transformation Dashboard View
 * Pre-computes all chart and panel data from Phase 3 engine outputs
 * for the Transformation Intelligence UI.
 */

import type { LongitudinalIntelligenceOutput, CompetencySnapshot } from '@/lib/engines/longitudinalIntelligenceEngine';
import type { CareerTrajectoryOutput }  from '@/lib/engines/careerTrajectoryEngine';
import type { LearningVelocityOutput }  from '@/lib/engines/learningVelocityEngine';
import type { AdaptiveIDPOutput }       from '@/lib/engines/adaptiveIDPEngine';

/* ── Chart data types ──────────────────────────────────────────────── */

export interface GrowthTimelineData {
  phases: {
    id:           string;
    label:        string;
    weekStart:    number;
    weekEnd:      number;
    theme:        string;
    colour:       string;
    milestoneIds: string[];
  }[];
  milestones: {
    id:      string;
    week:    number;
    label:   string;
    eiTarget:number;
    status:  'completed' | 'on-track' | 'ahead' | 'behind' | 'not-started';
    adapted: boolean;
  }[];
  currentWeek:   number;
  totalWeeks:    number;
  projectedDate: string;
}

export interface TrajectoryMapData {
  nodes: {
    id:       string;
    label:    string;
    monthsFromNow: number;
    status:   'current' | 'next' | 'future' | 'completed';
    eiTarget: number;
    confidence: number;
    colour:   string;
  }[];
  edges: { from: string; to: string; probability: number }[];
}

export interface VelocityPanelData {
  overallScore:    number;
  band:            string;
  bandColour:      string;
  metrics: {
    id:          string;
    label:       string;
    value:       number;
    trend:       'accelerating' | 'steady' | 'slowing';
    colour:      string;
  }[];
  projectedGains:  { label: string; value: string; highlight: boolean }[];
  coaching:        string;
  nextFocusArea:   string;
}

export interface IDPPanelData {
  activeInterventions: {
    id:       string;
    title:    string;
    priority: string;
    hours:    number;
    eiLift:   number;
    status:   string;
    isUrgent: boolean;
    isQuickWin: boolean;
  }[];
  pathwayLabel:     string;
  weeklyHours:      number;
  completionPct:    number;
  completionDate:   string;
  adjustedDate:     string;
  onTrack:          boolean;
  weeksAdj:         number;
  eiLiftRemaining:  number;
}

export interface SummaryMetric {
  id:       string;
  label:    string;
  value:    string;
  sub:      string;
  trend:    'up' | 'down' | 'flat';
  colour:   string;
  icon:     string;
}

export interface MomentumIndicator {
  score:       number;
  label:       string;
  colour:      string;
  trend:       'accelerating' | 'steady' | 'plateauing' | 'declining';
  narrative:   string;
}

export interface FutureReadinessIndicator {
  overall:     number;
  label:       string;
  colour:      string;
  dimensions: { id: string; label: string; score: number }[];
}

export interface TransformationDashboardView {
  growthTimeline:         GrowthTimelineData;
  trajectoryMap:          TrajectoryMapData;
  velocityPanel:          VelocityPanelData;
  idpPanel:               IDPPanelData;
  summaryMetrics:         SummaryMetric[];
  momentumIndicator:      MomentumIndicator;
  futureReadiness:        FutureReadinessIndicator;
  topOpportunities:       { roleId: string; title: string; urgency: string; probability: number; etaMonths: number }[];
  transformationNarrative:string;
}

/* ── Band colours ─────────────────────────────────────────────────── */
const BAND_COLOUR: Record<string, string> = {
  elite:'#10b981', high:'#3b82f6', moderate:'#f59e0b', low:'#f97316', stalled:'#ef4444',
};
const TREND_COLOUR: Record<string, string> = {
  accelerating:'#10b981', steady:'#3b82f6', slowing:'#f97316',
};

/* ── Main builder ─────────────────────────────────────────────────── */
export function buildTransformationDashboardView(
  longitudinal: LongitudinalIntelligenceOutput,
  trajectory:   CareerTrajectoryOutput,
  velocity:     LearningVelocityOutput,
  idp:          AdaptiveIDPOutput,
  currentEI:    number,
): TransformationDashboardView {

  /* Growth Timeline */
  const growthTimeline: GrowthTimelineData = {
    phases: idp.recommendedPathway.phases.map((p, idx) => ({
      id:           `phase-${p.phase}`,
      label:        p.label,
      weekStart:    idx === 0 ? 0 : idp.recommendedPathway.phases.slice(0, idx).reduce((s, pp) => s + pp.weeks, 0),
      weekEnd:      idp.recommendedPathway.phases.slice(0, idx + 1).reduce((s, pp) => s + pp.weeks, 0),
      theme:        ['Close critical gaps','Build depth & evidence','Sharpen & certify'][idx] ?? '',
      colour:       ['#6366f1','#8b5cf6','#a855f7'][idx] ?? '#6366f1',
      milestoneIds: p.interventionIds,
    })),
    milestones: idp.adaptedMilestones.map(m => ({
      id:       m.id, week: m.week, label: m.title,
      eiTarget: m.targetEI, status: m.status as GrowthTimelineData['milestones'][0]['status'],
      adapted:  m.adapted,
    })),
    currentWeek:   0,
    totalWeeks:    idp.totalWeeks,
    projectedDate: idp.velocityAdjustedDate,
  };

  /* Trajectory Map */
  const trajectoryMap: TrajectoryMapData = {
    nodes: [
      {
        id:'current', label: trajectory.currentRole ?? 'Current',
        monthsFromNow:0, status:'current', eiTarget: currentEI, confidence:100,
        colour:'#6366f1',
      },
      ...trajectory.trajectorySteps.filter((_, i) => i % 2 === 1).map((step, idx) => ({
        id:     step.predictedRoleId + idx,
        label:  step.predictedRoleTitle,
        monthsFromNow: step.monthsFromNow,
        status: idx === 0 ? 'next' as const : 'future' as const,
        eiTarget: step.requiredEI, confidence: step.confidence,
        colour: idx === 0 ? '#3b82f6' : '#8b5cf6',
      })),
    ],
    edges: trajectory.trajectorySteps
      .filter((_, i) => i % 2 === 1)
      .map((step, idx) => ({
        from: idx === 0 ? 'current' : trajectory.trajectorySteps.filter((_, i) => i % 2 === 1)[idx - 1].predictedRoleId + (idx - 1),
        to:   step.predictedRoleId + idx,
        probability: step.confidence,
      })),
  };

  /* Velocity Panel */
  const velocityPanel: VelocityPanelData = {
    overallScore: velocity.overallVelocity,
    band:         velocity.velocityBandLabel,
    bandColour:   BAND_COLOUR[velocity.velocityBand] ?? '#6366f1',
    metrics: velocity.metrics.map(m => ({
      id: m.id, label: m.name, value: m.value,
      trend: m.trend, colour: TREND_COLOUR[m.trend] ?? '#6366f1',
    })),
    projectedGains: [
      { label: 'EI Gain (6mo)',  value: `+${velocity.projectedEIGainIn6Mo} pts`,  highlight: velocity.projectedEIGainIn6Mo >= 8 },
      { label: 'Levels (6mo)',   value: `+${velocity.projectedLevelsIn6Mo}`,       highlight: velocity.projectedLevelsIn6Mo >= 3 },
      { label: 'Adaptability',   value: `${velocity.adaptabilityScore}%`,          highlight: velocity.adaptabilityScore >= 70 },
      { label: 'Consistency',    value: `${velocity.executionConsistency}%`,       highlight: velocity.executionConsistency >= 70 },
    ],
    coaching:      velocity.coachingInsight,
    nextFocusArea: velocity.nextFocusArea,
  };

  /* IDP Panel */
  const idpPanel: IDPPanelData = {
    activeInterventions: idp.interventions
      .filter(i => i.status !== 'completed')
      .slice(0, 8)
      .map(i => ({
        id: i.id, title: i.title, priority: i.priority,
        hours: i.hours, eiLift: i.eiLift, status: i.status,
        isUrgent: i.urgencyFlag, isQuickWin: i.quickWin,
      })),
    pathwayLabel:    idp.recommendedPathway.label,
    weeklyHours:     idp.recommendedPathway.weeklyHours,
    completionPct:   idp.completionPct,
    completionDate:  idp.completionDate,
    adjustedDate:    idp.velocityAdjustedDate,
    onTrack:         idp.onTrack,
    weeksAdj:        idp.weeksAheadOrBehind,
    eiLiftRemaining: idp.eiLiftRemaining,
  };

  /* Summary Metrics */
  const summaryMetrics: SummaryMetric[] = [
    {
      id:'momentum', label:'Transformation Momentum', value:`${longitudinal.transformationMomentum}`,
      sub: longitudinal.overallTrend, trend: longitudinal.overallTrend === 'accelerating' ? 'up' : longitudinal.overallTrend === 'declining' ? 'down' : 'flat',
      colour: longitudinal.transformationMomentum >= 70 ? '#10b981' : longitudinal.transformationMomentum >= 40 ? '#f59e0b' : '#ef4444',
      icon: 'TrendingUp',
    },
    {
      id:'velocity', label:'Learning Velocity', value:`${velocity.overallVelocity}`,
      sub: velocity.velocityBandLabel, trend: velocity.growthAcceleration > 0 ? 'up' : velocity.growthAcceleration < 0 ? 'down' : 'flat',
      colour: BAND_COLOUR[velocity.velocityBand] ?? '#6366f1', icon: 'Zap',
    },
    {
      id:'trajectory', label:'Market Opportunity', value:`${trajectory.marketOpportunityScore}`,
      sub: trajectory.forecastedRole12mo?.title ?? 'Analyse profile', trend: trajectory.marketOpportunityScore >= 60 ? 'up' : 'flat',
      colour: trajectory.marketOpportunityScore >= 70 ? '#10b981' : '#f59e0b', icon: 'Target',
    },
    {
      id:'idp', label:'IDP Progress', value:`${idp.completionPct}%`,
      sub: idp.onTrack ? 'On track' : `${Math.abs(idp.weeksAheadOrBehind)}w ${idp.weeksAheadOrBehind > 0 ? 'ahead' : 'behind'}`,
      trend: idp.onTrack ? 'up' : 'down',
      colour: idp.onTrack ? '#10b981' : '#f97316', icon: 'CheckCircle',
    },
  ];

  /* Momentum indicator */
  const momentumIndicator: MomentumIndicator = {
    score:     longitudinal.transformationMomentum,
    label:     longitudinal.overallTrend.charAt(0).toUpperCase() + longitudinal.overallTrend.slice(1),
    colour:    longitudinal.transformationMomentum >= 70 ? '#10b981' : longitudinal.transformationMomentum >= 40 ? '#f59e0b' : '#ef4444',
    trend:     longitudinal.overallTrend,
    narrative: longitudinal.momentumNarrative,
  };

  /* Future readiness */
  const futureReadiness: FutureReadinessIndicator = {
    overall: Math.round((velocity.overallVelocity + longitudinal.transformationMomentum + trajectory.marketOpportunityScore) / 3),
    label:   '',
    colour:  '',
    dimensions: [
      { id:'velocity',   label:'Learning Velocity',  score: velocity.overallVelocity },
      { id:'momentum',   label:'Growth Momentum',    score: longitudinal.transformationMomentum },
      { id:'market',     label:'Market Opportunity', score: trajectory.marketOpportunityScore },
      { id:'adaptability', label:'Adaptability',     score: velocity.adaptabilityScore },
    ],
  };
  futureReadiness.label  = futureReadiness.overall >= 75 ? 'Future Ready' : futureReadiness.overall >= 50 ? 'Developing' : 'Early Stage';
  futureReadiness.colour = futureReadiness.overall >= 75 ? '#10b981' : futureReadiness.overall >= 50 ? '#f59e0b' : '#ef4444';

  /* Top opportunities */
  const topOpportunities = trajectory.transformationForecasts.slice(0, 4).map(f => ({
    roleId: f.roleId, title: f.title, urgency: f.urgency,
    probability: f.probability, etaMonths: f.etaMonths,
  }));

  /* Narrative */
  const transformationNarrative = [
    longitudinal.momentumNarrative,
    trajectory.roleEvolutionNarrative,
    velocity.coachingInsight,
  ].join(' ');

  return {
    growthTimeline, trajectoryMap, velocityPanel, idpPanel,
    summaryMetrics, momentumIndicator, futureReadiness,
    topOpportunities, transformationNarrative,
  };
}
