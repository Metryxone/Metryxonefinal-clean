export type GapLevel = 'critical' | 'high' | 'medium' | 'low' | 'strength';

export interface GapItem {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  domainName: string;
  userScore: number;
  targetScore: number;
  gap: number;
  weightedGap: number;
  gapLevel: GapLevel;
  priority: number;
}

export interface PrioritizationResult {
  critical: GapItem[];
  high: GapItem[];
  medium: GapItem[];
  low: GapItem[];
  strengths: GapItem[];
  totalWeightedGap: number;
  overallReadiness: number;
}

export function classifyGap(gapSize: number, weight: number): { gapLevel: GapLevel; priority: number } {
  if (gapSize <= -5) return { gapLevel: 'strength', priority: 0 };
  if (gapSize <= 0) return { gapLevel: 'low', priority: 1 };
  if (gapSize < 10) return { gapLevel: 'low', priority: 2 };
  if (gapSize < 20) return { gapLevel: weight >= 1.3 ? 'high' : 'medium', priority: weight >= 1.3 ? 4 : 3 };
  if (gapSize < 30) return { gapLevel: 'high', priority: 5 };
  return { gapLevel: 'critical', priority: 6 };
}

export function prioritizeGaps(
  scores: { competencyId: string; competencyCode: string; competencyName: string; domainName: string; finalScore: number }[],
  benchmarks: { competencyId: string; p75: number }[],
  weights: { competencyId: string; weight: number }[]
): PrioritizationResult {
  const benchMap = new Map(benchmarks.map(b => [b.competencyId, b.p75]));
  const weightMap = new Map(weights.map(w => [w.competencyId, w.weight]));

  const items: GapItem[] = scores.map(s => {
    const target = benchMap.get(s.competencyId) ?? 65;
    const weight = weightMap.get(s.competencyId) ?? 1.0;
    const rawGap = parseFloat((target - s.finalScore).toFixed(1));
    const weightedGap = parseFloat(Math.max(0, rawGap * weight).toFixed(3));
    const { gapLevel, priority } = classifyGap(rawGap, weight);

    return {
      competencyId: s.competencyId,
      competencyCode: s.competencyCode,
      competencyName: s.competencyName,
      domainName: s.domainName,
      userScore: s.finalScore,
      targetScore: parseFloat(target.toFixed(1)),
      gap: parseFloat(Math.max(0, rawGap).toFixed(1)),
      weightedGap,
      gapLevel,
      priority,
    };
  });

  items.sort((a, b) => b.priority - a.priority || b.weightedGap - a.weightedGap);

  const totalWeightedGap = parseFloat(items.filter(i => i.gapLevel !== 'strength').reduce((sum, i) => sum + i.weightedGap, 0).toFixed(2));
  const metCount = items.filter(i => i.gapLevel === 'low' || i.gapLevel === 'strength').length;
  const overallReadiness = Math.round((metCount / (items.length || 1)) * 100);

  return {
    critical: items.filter(i => i.gapLevel === 'critical'),
    high: items.filter(i => i.gapLevel === 'high'),
    medium: items.filter(i => i.gapLevel === 'medium'),
    low: items.filter(i => i.gapLevel === 'low'),
    strengths: items.filter(i => i.gapLevel === 'strength'),
    totalWeightedGap,
    overallReadiness,
  };
}

export function prioritizationSummary(result: PrioritizationResult) {
  return {
    critical: result.critical.length,
    high: result.high.length,
    medium: result.medium.length,
    low: result.low.length,
    strengths: result.strengths.length,
    totalWeightedGap: result.totalWeightedGap,
    overallReadiness: result.overallReadiness,
  };
}
