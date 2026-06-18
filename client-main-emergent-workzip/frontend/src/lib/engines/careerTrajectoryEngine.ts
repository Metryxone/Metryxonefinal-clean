/**
 * Career Trajectory Engine
 * Adjacent role intelligence, role evolution prediction,
 * transformation probability, and future role forecasting.
 */

import {
  MARKET_CATALOG,
  COMPETENCY_DOMAINS,
  type MarketRole,
} from '@/data/marketCatalog';
import {
  detectCurrentRole,
  recommendFutureRoles,
  type CareerProfile,
} from '@/lib/careerIntelligence';
import { adjacencyOverlap, getAdjacentWithin } from '@/lib/competency-genome/genomeEngine';
import { getFutureSignal }                     from '@/lib/competency-genome/futureMapping';

/* ── Output types ─────────────────────────────────────────────────── */
export interface AdjacentRoleIntelligence {
  roleId:              string;
  title:               string;
  family:              string;
  switchabilityScore:  number;   // 0-100
  adjacencyScore:      number;   // genome-based adjacency overlap
  etaMonths:           number;
  demandScore:         number;
  automationRisk:      number;
  futureRelevance:     number;   // 3yr competency relevance
  salaryP50:           number;
  actionable:          boolean;
  keyGaps:             string[];
}

export interface RoleEvolutionStep {
  monthsFromNow:        number;
  label:                string;   // e.g. "6 months", "1 year"
  predictedRoleId:      string;
  predictedRoleTitle:   string;
  requiredEI:           number;
  confidence:           number;   // 0-100
  keyMilestones:        string[];
}

export interface TransformationForecast {
  roleId:              string;
  title:               string;
  family:              string;
  probability:         number;    // 0-100
  adjacencyScore:      number;
  etaMonths:           number;
  demandScore:         number;
  urgency:             'act-now' | 'plan-ahead' | 'watch';
  primaryBarrier:      string;
  primaryAccelerator:  string;
}

export interface CareerTrajectoryOutput {
  currentRole:                string | null;
  currentFamily:              string | null;
  currentEI:                  number;
  adjacentRoles:              AdjacentRoleIntelligence[];
  trajectorySteps:            RoleEvolutionStep[];
  transformationForecasts:    TransformationForecast[];
  forecastedRole12mo:         AdjacentRoleIntelligence | null;
  forecastedRole36mo:         AdjacentRoleIntelligence | null;
  mostLikelyPathLabel:        string;
  roleEvolutionNarrative:     string;
  marketOpportunityScore:     number;   // 0-100: how good is timing for a move?
}

/* ── Input ────────────────────────────────────────────────────────── */
export interface CareerTrajectoryInput {
  profile:           CareerProfile | null | undefined;
  competencyLevels:  Record<string, number>;
  eiScore:           number;
  velocityPerMonth?: number;   // from LearningVelocityEngine
  topN?:             number;
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function computeFutureRelevanceForRole(role: MarketRole): number {
  const scores = role.competencies.map(rc => {
    const sig = getFutureSignal(rc.id);
    return sig ? sig.relevanceIn3Yr : 60;
  });
  return Math.round(scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length));
}

function computeAdjacencyScore(userCompIds: string[], role: MarketRole): number {
  const roleCompIds = role.competencies.map(rc => rc.id);
  return adjacencyOverlap(userCompIds, roleCompIds);
}

function keyGapsFor(levels: Record<string, number>, role: MarketRole): string[] {
  return role.competencies
    .filter(rc => (levels[rc.id] ?? 0) < rc.required - 1)
    .sort((a, b) => b.required - a.required)
    .slice(0, 3)
    .map(rc => COMPETENCY_DOMAINS.find(c => c.id === rc.id)?.label ?? rc.id);
}

function etaMonthsFor(levels: Record<string, number>, role: MarketRole, velocity = 0.15): number {
  const gaps = role.competencies.map(rc => Math.max(0, rc.required - (levels[rc.id] ?? 0)));
  const totalGap = gaps.reduce((s, v) => s + v, 0);
  const baseMonths = totalGap > 0 ? Math.ceil(totalGap / Math.max(0.05, velocity) / 2) : 1;
  return Math.min(48, Math.max(1, baseMonths));
}

/* ── Main engine ──────────────────────────────────────────────────── */
export function runCareerTrajectoryEngine(input: CareerTrajectoryInput): CareerTrajectoryOutput {
  const { profile, competencyLevels: levels, eiScore } = input;
  const velocity   = input.velocityPerMonth ?? 0.15;
  const topN       = input.topN ?? 6;

  const currentRole = detectCurrentRole(profile);
  const userCompIds = Object.entries(levels).filter(([, v]) => v >= 2).map(([k]) => k);

  /* Base recs sorted by composite score */
  const baseRecs = recommendFutureRoles(profile, 12);

  /* Adjacent roles with genome enrichment */
  const adjacentRoles: AdjacentRoleIntelligence[] = MARKET_CATALOG
    .map(role => {
      const adj      = computeAdjacencyScore(userCompIds, role);
      const futRel   = computeFutureRelevanceForRole(role);
      const eta      = etaMonthsFor(levels, role, velocity);
      const rec      = baseRecs.find(r => r.role.id === role.id);
      const switchScore = rec?.switch ?? Math.round(adj * 0.7 + (eiScore / 100) * 30);
      const gaps     = keyGapsFor(levels, role);
      return {
        roleId: role.id, title: role.title, family: role.family,
        switchabilityScore: Math.min(100, switchScore),
        adjacencyScore: adj, etaMonths: eta,
        demandScore: role.demandScore, automationRisk: role.automationRisk,
        futureRelevance: futRel, salaryP50: role.salaryP50,
        actionable: switchScore >= 40 && gaps.length <= 3,
        keyGaps: gaps,
      };
    })
    .sort((a, b) => (b.switchabilityScore + b.adjacencyScore * 0.5) - (a.switchabilityScore + a.adjacencyScore * 0.5))
    .slice(0, topN);

  /* Trajectory steps (6 / 12 / 18 / 24 / 36 months) */
  const horizons = [6, 12, 18, 24, 36];
  const trajectorySteps: RoleEvolutionStep[] = horizons.map(mo => {
    const eiAtPoint  = Math.min(95, eiScore + velocity * mo * 2.5);
    const rolesAtEI  = adjacentRoles.filter(r => r.etaMonths <= mo).slice(0, 1)[0];
    return {
      monthsFromNow:      mo,
      label:              mo < 12 ? `${mo} months` : `${mo / 12} year${mo === 12 ? '' : 's'}`,
      predictedRoleId:    rolesAtEI?.roleId ?? currentRole?.id ?? 'current',
      predictedRoleTitle: rolesAtEI?.title ?? currentRole?.title ?? 'Current Role',
      requiredEI:         Math.round(eiAtPoint),
      confidence:         mo <= 12 ? 80 : mo <= 24 ? 60 : 40,
      keyMilestones:      rolesAtEI?.keyGaps.slice(0, 2).map(g => `Close ${g} gap`) ?? [],
    };
  });

  /* Transformation forecasts */
  const forecasts: TransformationForecast[] = baseRecs.slice(0, topN).map(rec => {
    const adj = computeAdjacencyScore(userCompIds, rec.role);
    const prob = Math.min(95, Math.round(
      rec.fitment.fitScore * 0.3 + rec.switch * 0.25 + adj * 0.2 + (eiScore / 100) * 25,
    ));
    return {
      roleId: rec.role.id, title: rec.role.title, family: rec.role.family,
      probability: prob, adjacencyScore: adj, etaMonths: rec.etaMonths,
      demandScore: rec.role.demandScore,
      urgency: prob >= 65 && rec.role.demandScore >= 80 ? 'act-now' :
               prob >= 45 ? 'plan-ahead' : 'watch',
      primaryBarrier:     rec.fitment.missingSkills[0] ?? 'Profile completeness',
      primaryAccelerator: adj >= 60 ? 'Strong competency adjacency' :
                          rec.switch >= 60 ? 'High switchability' : 'Market demand momentum',
    };
  });

  /* 12mo and 36mo forecasts */
  const forecast12 = adjacentRoles.find(r => r.etaMonths <= 12 && r.actionable) ?? adjacentRoles[0] ?? null;
  const forecast36 = adjacentRoles.find(r => r.etaMonths <= 36 && r.actionable && r.roleId !== forecast12?.roleId) ?? adjacentRoles[1] ?? null;

  /* Market opportunity score */
  const marketOpp = Math.round(
    (adjacentRoles.filter(r => r.demandScore >= 75).length / Math.max(1, adjacentRoles.length)) * 50 +
    (adjacentRoles.filter(r => r.futureRelevance >= 80).length / Math.max(1, adjacentRoles.length)) * 30 +
    (eiScore / 100) * 20,
  );

  /* Path label */
  const mostLikelyPathLabel = forecast12
    ? `${currentRole?.title ?? 'Current'} → ${forecast12.title} (${forecast12.etaMonths}mo) → ${forecast36?.title ?? '…'}`
    : 'Build profile to unlock trajectory';

  /* Narrative */
  const narrative = forecast12
    ? `${forecast12.title} is your most accessible next role (${forecast12.etaMonths} months, ${forecast12.switchabilityScore}% switchability). `
      + `In 36 months, ${forecast36?.title ?? 'a senior role'} becomes achievable with consistent progression.`
    : 'Complete your competency profile to unlock personalised trajectory intelligence.';

  return {
    currentRole:             currentRole?.title ?? null,
    currentFamily:           currentRole?.family ?? null,
    currentEI:               eiScore,
    adjacentRoles,
    trajectorySteps,
    transformationForecasts: forecasts,
    forecastedRole12mo:      forecast12,
    forecastedRole36mo:      forecast36,
    mostLikelyPathLabel,
    roleEvolutionNarrative:  narrative,
    marketOpportunityScore:  Math.min(100, marketOpp),
  };
}
