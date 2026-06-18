import {
  recommendFutureRoles,
  type CareerProfile,
  type FutureRoleRec,
} from '@/lib/careerIntelligence';

export interface RecommendationInput {
  profile: CareerProfile | null | undefined;
  topN?:   number;
}

export interface RecommendationOutput {
  recommendations: FutureRoleRec[];
  topPick:         FutureRoleRec | null;
  reasoning:       string;
}

function buildReasoning(recs: FutureRoleRec[]): string {
  if (!recs.length) return 'Complete your profile to unlock personalised role recommendations.';
  const top = recs[0];
  const parts: string[] = [];
  if (top.role.demandScore >= 70) parts.push('high market demand');
  if (top.switch >= 70)          parts.push('easy transition from your current track');
  if (top.fitment.fitScore >= 60) parts.push(`strong ${top.fitment.fitScore}% skill match`);
  return parts.length
    ? `Top pick based on: ${parts.join(', ')}.`
    : 'Best composite match across demand, switchability, and fit.';
}

export function runRecommendationEngine(input: RecommendationInput): RecommendationOutput {
  const recs = recommendFutureRoles(input.profile, input.topN ?? 6);
  return {
    recommendations: recs,
    topPick:         recs[0] ?? null,
    reasoning:       buildReasoning(recs),
  };
}
