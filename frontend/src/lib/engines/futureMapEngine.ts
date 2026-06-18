/**
 * Future Map 2.0 Engine
 * Enhanced recommendations using workforce signals, competency adjacency,
 * transformation probability, and benchmark intelligence.
 */

import {
  recommendFutureRoles,
  type CareerProfile,
  type FutureRoleRec,
} from '@/lib/careerIntelligence';
import { MARKET_CATALOG, type MarketRole } from '@/data/marketCatalog';
import {
  adjacencyOverlap,
  getAdjacentWithin,
  prereqsMet,
  COMPETENCY_GENOME,
} from '@/lib/competency-genome/genomeEngine';
import { computeFutureReadinessScore, getFutureSignal } from '@/lib/competency-genome/futureMapping';
import { detectBestPath } from '@/lib/competency-genome/progressionPaths';

export interface FutureMapInput {
  profile:           CareerProfile | null | undefined;
  competencyLevels:  Record<string, number>;
  eiScore:           number;
  topN?:             number;
}

export interface TransformationProbability {
  probability:      number;   // 0-100
  adjacencyBoost:   number;   // pts from genome adjacency
  demandBoost:      number;   // pts from market demand
  benchmarkBoost:   number;   // pts from EI score alignment
  barriers:         string[];
  accelerators:     string[];
}

export interface FutureMapRecommendation {
  role:                    MarketRole;
  baseScore:               number;     // original composite score
  v2Score:                 number;     // enhanced with genome + future signals
  fitScore:                number;
  switchabilityScore:      number;
  etaMonths:               number;
  transformation:          TransformationProbability;
  adjacentCompetencies:    string[];   // which user competencies are adjacent to role needs
  futureRelevanceScore:    number;     // how future-proof is this role target
  progressionPath:         string;     // best named path to reach this role
  whyNow:                  string;     // market timing rationale
  urgency:                 'act-now' | 'plan-ahead' | 'watch' | 'long-term';
}

export interface FutureMapOutput {
  recommendations:       FutureMapRecommendation[];
  topPick:               FutureMapRecommendation | null;
  bestPath:              string;
  futureReadinessScore:  number;
  marketMomentumSignals: { signal: string; impact: 'high' | 'medium' }[];
  portfolioGaps:         { competencyId: string; label: string; missingFor: number }[];
  reasoning:             string;
}

function computeTransformationProbability(
  levels:    Record<string, number>,
  eiScore:   number,
  role:      MarketRole,
  baseRec:   FutureRoleRec,
): TransformationProbability {
  const userCompIds    = Object.entries(levels).filter(([,v]) => v >= 2).map(([k]) => k);
  const roleCompIds    = role.competencies.map(rc => rc.id);
  const adjBoost       = adjacencyOverlap(userCompIds, roleCompIds);
  const demandBoost    = Math.round((role.demandScore * 0.4 + role.growth36mo * 0.6) * 0.3);
  const eiBoost        = Math.round((eiScore / 100) * 20);
  const probability    = Math.min(95, baseRec.switch * 0.4 + baseRec.fitment.fitScore * 0.3 + adjBoost * 0.2 + eiBoost * 0.1);

  const barriers: string[] = [];
  const accelerators: string[] = [];

  const unmet = role.competencies.filter(rc => (levels[rc.id] ?? 0) < rc.required - 1);
  if (unmet.length >= 3) barriers.push(`${unmet.length} competency gaps above 1 level`);
  if (baseRec.fitment.fitScore < 40) barriers.push('Low initial skill match — substantial upskilling needed');
  if (role.family !== 'behavioral' && eiScore < 40) barriers.push('EI score below threshold for this role family');

  if (adjBoost >= 60) accelerators.push('Strong competency adjacency — natural transition');
  if (baseRec.switch >= 70) accelerators.push('High switchability from current track');
  if (role.growth36mo >= 30) accelerators.push('Hot market — demand momentum reduces time-to-hire');

  return {
    probability: Math.round(probability),
    adjacencyBoost: adjBoost, demandBoost, benchmarkBoost: eiBoost,
    barriers: barriers.slice(0, 2),
    accelerators: accelerators.slice(0, 2),
  };
}

function computeFutureRelevance(role: MarketRole): number {
  const scores = role.competencies.map(rc => {
    const sig = getFutureSignal(rc.id);
    if (!sig) return 50;
    return sig.relevanceIn3Yr;
  });
  return Math.round(scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length));
}

function urgencyFrom(
  demandScore: number,
  growth36mo:  number,
  automationRisk: number,
  futureRel:   number,
): FutureMapRecommendation['urgency'] {
  const signal = demandScore * 0.3 + growth36mo * 0.4 + futureRel * 0.3;
  if (signal >= 75 && automationRisk < 30) return 'act-now';
  if (signal >= 60)                        return 'plan-ahead';
  if (signal >= 45)                        return 'watch';
  return 'long-term';
}

function buildWhyNow(role: MarketRole, futureRel: number): string {
  const parts: string[] = [];
  if (role.demandScore >= 80) parts.push(`${role.demandScore}/100 market demand`);
  if (role.growth36mo >= 30)  parts.push(`${role.growth36mo}% growth in 36 months`);
  if (futureRel >= 85)        parts.push('high future relevance through 2028');
  if (role.automationRisk < 20) parts.push(`only ${role.automationRisk}% automation risk`);
  return parts.length ? `Strong timing: ${parts.join(', ')}.` : 'Solid market position for this role.';
}

function computePortfolioGaps(
  levels:     Record<string, number>,
  topRoles:   MarketRole[],
): FutureMapOutput['portfolioGaps'] {
  const gapCounts: Record<string, number> = {};
  topRoles.forEach(role => {
    role.competencies.forEach(rc => {
      if ((levels[rc.id] ?? 0) < rc.required - 1) {
        gapCounts[rc.id] = (gapCounts[rc.id] ?? 0) + 1;
      }
    });
  });
  return Object.entries(gapCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({
      competencyId: id,
      label: COMPETENCY_GENOME.find(g => g.id === id)?.label ?? id,
      missingFor: count,
    }));
}

export function runFutureMapEngine(input: FutureMapInput): FutureMapOutput {
  const { profile, competencyLevels: levels, eiScore } = input;
  const topN  = input.topN ?? 6;

  /* Base recommendations from careerIntelligence */
  const baseRecs = recommendFutureRoles(profile, topN + 2);
  const futureReadiness = computeFutureReadinessScore(levels, 3);

  /* Enhance each recommendation */
  const enhanced: FutureMapRecommendation[] = baseRecs.slice(0, topN).map(rec => {
    const role     = rec.role;
    const futureRel= computeFutureRelevance(role);
    const transform= computeTransformationProbability(levels, eiScore, role, rec);

    /* Adjacent competencies the user has near this role's needs */
    const roleNeeds    = role.competencies.map(rc => rc.id);
    const userHas      = Object.entries(levels).filter(([,v]) => v >= 2).map(([k]) => k);
    const adjMatches   = userHas.filter(id => {
      const adj = getAdjacentWithin(id, 1);
      return adj.some(a => roleNeeds.includes(a));
    });

    /* Genome adjacency bonus to score */
    const adjBonus  = Math.round(transform.adjacencyBoost * 0.1);
    const futBonus  = Math.round((futureRel - 70) * 0.05);
    const v2Score   = Math.min(100, rec.score + adjBonus + futBonus);

    /* Best named path */
    const path = detectBestPath(levels, role.family);

    return {
      role,
      baseScore:            rec.score,
      v2Score,
      fitScore:             rec.fitment.fitScore,
      switchabilityScore:   rec.switch,
      etaMonths:            rec.etaMonths,
      transformation:       transform,
      adjacentCompetencies: adjMatches.slice(0, 4),
      futureRelevanceScore: futureRel,
      progressionPath:      path.label,
      whyNow:               buildWhyNow(role, futureRel),
      urgency:              urgencyFrom(role.demandScore, role.growth36mo, role.automationRisk, futureRel),
    };
  }).sort((a, b) => b.v2Score - a.v2Score);

  /* Market momentum signals */
  const momentumSignals: FutureMapOutput['marketMomentumSignals'] = [];
  const avgFutureRel = enhanced.reduce((s, r) => s + r.futureRelevanceScore, 0) / Math.max(1, enhanced.length);
  if (avgFutureRel >= 80) momentumSignals.push({ signal: 'High future relevance across your top picks', impact: 'high' });
  if (futureReadiness.hotCompetencies.length >= 2) momentumSignals.push({ signal: `${futureReadiness.hotCompetencies.length} "hot" competencies in your portfolio`, impact: 'high' });
  if (futureReadiness.riskCompetencies.length)     momentumSignals.push({ signal: `${futureReadiness.riskCompetencies.length} declining competency dependency — diversify`, impact: 'medium' });
  const actNow = enhanced.filter(r => r.urgency === 'act-now').length;
  if (actNow)  momentumSignals.push({ signal: `${actNow} role(s) with "act now" market timing`, impact: 'high' });

  /* Portfolio gaps across top 4 roles */
  const topRoles = enhanced.slice(0, 4).map(r => r.role);
  const portfolioGaps = computePortfolioGaps(levels, topRoles);

  /* Best path for user overall */
  const bestPath = detectBestPath(levels);

  /* Reasoning */
  const top = enhanced[0];
  const reasoning = top
    ? `Top pick: ${top.role.title} — ${top.transformation.probability}% transformation probability, v2 score ${top.v2Score}. ${top.whyNow}`
    : 'Complete your profile to unlock personalised Future Map 2.0 recommendations.';

  return {
    recommendations:      enhanced,
    topPick:              enhanced[0] ?? null,
    bestPath:             bestPath.label,
    futureReadinessScore: futureReadiness.score,
    marketMomentumSignals:momentumSignals,
    portfolioGaps,
    reasoning,
  };
}
