export type GapLevel = 'critical' | 'high' | 'medium' | 'low' | 'strength';

export interface GapResult {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  domainName: string;
  userScore: number;
  targetScore: number;
  gap: number;
  weight: number;
  weightedGap: number;
  gapLevel: GapLevel;
  priority: number;
}

export function classifyGap(gap: number): GapLevel {
  if (gap >= 30) return 'critical';
  if (gap >= 20) return 'high';
  if (gap >= 10) return 'medium';
  if (gap >= 0) return 'low';
  return 'strength';
}

export function computeGaps(
  scores: { competencyId: string; competencyCode: string; competencyName: string; domainName: string; finalScore: number }[],
  benchmarks: { competencyId: string; p75: number }[],
  weights: { competencyId: string; weight: number }[]
): GapResult[] {
  const benchMap = new Map(benchmarks.map(b => [b.competencyId, b.p75]));
  const weightMap = new Map(weights.map(w => [w.competencyId, w.weight]));

  return scores.map(s => {
    const target = benchMap.get(s.competencyId) ?? 70;
    const weight = weightMap.get(s.competencyId) ?? 1.0;
    const gap = Math.max(0, target - s.finalScore);
    const gapLevel = classifyGap(gap);
    const weightedGap = Math.round(gap * weight * 100) / 100;
    const priorityMap: Record<GapLevel, number> = { critical: 1, high: 2, medium: 3, low: 4, strength: 5 };

    return {
      competencyId: s.competencyId,
      competencyCode: s.competencyCode,
      competencyName: s.competencyName,
      domainName: s.domainName,
      userScore: s.finalScore,
      targetScore: target,
      gap,
      weight,
      weightedGap,
      gapLevel,
      priority: priorityMap[gapLevel],
    };
  }).sort((a, b) => a.priority - b.priority || b.weightedGap - a.weightedGap);
}

export function prioritizationSummary(gaps: GapResult[]) {
  return {
    critical: gaps.filter(g => g.gapLevel === 'critical').length,
    high: gaps.filter(g => g.gapLevel === 'high').length,
    medium: gaps.filter(g => g.gapLevel === 'medium').length,
    low: gaps.filter(g => g.gapLevel === 'low').length,
    strength: gaps.filter(g => g.gapLevel === 'strength').length,
    totalWeightedGap: Math.round(gaps.reduce((s, g) => s + g.weightedGap, 0) * 100) / 100,
  };
}
