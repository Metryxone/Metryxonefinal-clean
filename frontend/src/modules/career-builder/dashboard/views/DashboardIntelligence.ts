import { runEmployabilityEngine, type EIOutput } from '@/lib/engines/employabilityEngine';
import { runFitmentEngine, type FitmentOutput } from '@/lib/engines/fitmentEngine';
import { runRecommendationEngine, type RecommendationOutput } from '@/lib/engines/recommendationEngine';
import { runVisibilityEngine, type VisibilityOutput } from '@/lib/engines/visibilityEngine';
import { runIDPEngine, type IDPOutput } from '@/lib/engines/idpEngine';
import { visibilityService } from '@/lib/services/visibilityService';
import type { CareerProfile } from '@/lib/careerIntelligence';
import type { MarketRole } from '@/data/marketCatalog';

export interface EmployabilityPanel {
  eiScore:       number;
  band:          string;
  color:         string;
  percentile:    number;
  topTip:        string;
  breakdownMax:  number;
  sparkData:     { label: string; value: number; max: number }[];
  status:        'excellent' | 'strong' | 'developing' | 'needs-work';
}

export interface FitmentPanel {
  hasTarget:       boolean;
  fitScore:        number;
  readinessLevel:  string;
  topGap:          string | null;
  missingSkills:   string[];
  switchability:   number;
  hireProbability: number;
  cta:             string;
}

export interface RecommendationPanel {
  topRole:     { title: string; score: number; etaMonths: number } | null;
  alternatives: { title: string; score: number }[];
  reasoning:   string;
  totalOptions:number;
}

export interface VisibilityPanel {
  score:            number;
  band:             string;
  recruiterViews:   number;
  viewTrend:        'up' | 'down' | 'flat';
  discoveryScore:   number;
  readiness:        number;
  topAction:        string | null;
  actionCount:      number;
}

export interface GrowthPanel {
  idpReady:      boolean;
  etaWeeks:      number;
  readyAt:       string;
  completionPct: number;
  totalEILift:   number;
  nextStep:      string | null;
  phaseCount:    number;
  gapCount:      number;
}

export interface DashboardIntelligenceOutput {
  employability:   EmployabilityPanel;
  fitment:         FitmentPanel;
  recommendations: RecommendationPanel;
  visibility:      VisibilityPanel;
  growth:          GrowthPanel;
  generatedAt:     number;
}

function buildEmployabilityPanel(ei: EIOutput): EmployabilityPanel {
  const status: EmployabilityPanel['status'] =
    ei.score >= 75 ? 'excellent' : ei.score >= 55 ? 'strong' : ei.score >= 35 ? 'developing' : 'needs-work';

  const sparkData = [
    { label: 'Assessment',  value: Math.round(ei.breakdown.assessmentScore),   max: 25 },
    { label: 'Experience',  value: Math.round(ei.breakdown.experienceScore),   max: 20 },
    { label: 'Education',   value: Math.round(ei.breakdown.educationScore),    max: 15 },
    { label: 'Tech Skills', value: Math.round(ei.breakdown.technicalScore),    max: 15 },
    { label: 'Certs',       value: Math.round(ei.breakdown.certScore),         max: 10 },
    { label: 'Soft Skills', value: Math.round(ei.breakdown.softScore),         max: 8  },
    { label: 'Projects',    value: Math.round(ei.breakdown.projectScore),      max: 4  },
    { label: 'Profile',     value: Math.round(ei.breakdown.completenessScore), max: 3  },
  ];

  return {
    eiScore:      ei.score,
    band:         ei.band,
    color:        ei.color,
    percentile:   ei.percentileEstimate,
    topTip:       ei.tips[0] ?? 'Keep building your profile to improve your score.',
    breakdownMax: 99,
    sparkData,
    status,
  };
}

function buildFitmentPanel(fit: FitmentOutput | null, targetRole: MarketRole | null): FitmentPanel {
  if (!fit || !targetRole) {
    return {
      hasTarget: false, fitScore: 0, readinessLevel: '', topGap: null,
      missingSkills: [], switchability: 0, hireProbability: 0,
      cta: 'Select a target role to see your personalised fitment analysis',
    };
  }

  const cta = fit.fitScore >= 75
    ? 'You are near hire-ready — polish your profile and apply'
    : fit.fitScore >= 50
      ? `Close ${fit.missingSkills.slice(0, 2).join(', ')} gaps to boost fitment`
      : 'Start your IDP to close the most critical competency gaps';

  return {
    hasTarget:       true,
    fitScore:        fit.fitScore,
    readinessLevel:  fit.readinessLevel,
    topGap:          fit.topGapCompetency?.label ?? null,
    missingSkills:   fit.missingSkills.slice(0, 3),
    switchability:   fit.switchabilityScore,
    hireProbability: fit.hireProbability,
    cta,
  };
}

function buildRecommendationPanel(recs: RecommendationOutput): RecommendationPanel {
  const top = recs.topPick;
  return {
    topRole:     top ? { title: top.role.title, score: top.score, etaMonths: top.etaMonths } : null,
    alternatives:recs.recommendations.slice(1, 4).map(r => ({ title: r.role.title, score: r.score })),
    reasoning:   recs.reasoning,
    totalOptions:recs.recommendations.length,
  };
}

function buildVisibilityPanel(vis: VisibilityOutput): VisibilityPanel {
  const topAction = vis.optimizationActions[0]?.label ?? null;
  return {
    score:          vis.score,
    band:           vis.band,
    recruiterViews: vis.recruiterViews,
    viewTrend:      vis.viewTrend,
    discoveryScore: vis.discoveryScore,
    readiness:      vis.recruiterReadinessScore,
    topAction,
    actionCount:    vis.optimizationActions.length,
  };
}

function buildGrowthPanel(idp: IDPOutput | null): GrowthPanel {
  if (!idp) {
    return {
      idpReady: false, etaWeeks: 0, readyAt: '', completionPct: 0,
      totalEILift: 0, nextStep: null, phaseCount: 0, gapCount: 0,
    };
  }

  const firstPending = idp.items.find(i => !idp.completionPct);
  return {
    idpReady:     true,
    etaWeeks:     idp.etaWeeks,
    readyAt:      idp.readyAt,
    completionPct:idp.completionPct,
    totalEILift:  idp.totalEILift,
    nextStep:     firstPending?.title ?? idp.items[0]?.title ?? null,
    phaseCount:   idp.phases.length,
    gapCount:     idp.gapPriority.length,
  };
}

export function computeDashboardIntelligence(
  profile:    CareerProfile | null | undefined,
  targetRole: MarketRole | null | undefined,
  progress?:  Record<string, 'pending' | 'in-progress' | 'done'>,
): DashboardIntelligenceOutput {
  const eiOutput  = runEmployabilityEngine({ profile });
  const recOutput = runRecommendationEngine({ profile });

  const isOpen    = visibilityService.getOpenToOpportunities();
  const visOutput = runVisibilityEngine({ profile, eiScore: eiOutput.score, isOpenToOpportunities: isOpen });

  const fitOutput: FitmentOutput | null = targetRole
    ? runFitmentEngine({ profile, targetRole })
    : null;

  const idpOutput: IDPOutput | null = targetRole
    ? runIDPEngine({ profile, targetRole, progress })
    : null;

  return {
    employability:   buildEmployabilityPanel(eiOutput),
    fitment:         buildFitmentPanel(fitOutput, targetRole ?? null),
    recommendations: buildRecommendationPanel(recOutput),
    visibility:      buildVisibilityPanel(visOutput),
    growth:          buildGrowthPanel(idpOutput),
    generatedAt:     Date.now(),
  };
}
