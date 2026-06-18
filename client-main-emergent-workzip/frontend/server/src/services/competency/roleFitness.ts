export type ReadinessLevel = 'Ready Now' | 'Ready in 3-6 Months' | 'Ready in 6-12 Months' | 'Needs Significant Development';

export interface RoleFitnessResult {
  probability: number;
  readinessLevel: ReadinessLevel;
  overallScore: number;
  weightedScore: number;
  criticalGaps: number;
  highGaps: number;
  topStrengths: string[];
  topGaps: string[];
  factors: { label: string; score: number; weight: number; contribution: number }[];
}

export function computeRoleFitness(
  scores: { competencyId: string; competencyCode: string; competencyName: string; finalScore: number }[],
  weights: { competencyId: string; weight: number }[],
  benchmarks: { competencyId: string; p75: number; mean: number }[]
): RoleFitnessResult {
  const weightMap = new Map(weights.map(w => [w.competencyId, w.weight]));
  const benchMap = new Map(benchmarks.map(b => [b.competencyId, b]));

  let totalWeight = 0;
  let weightedScore = 0;
  const factors: RoleFitnessResult['factors'] = [];

  for (const s of scores) {
    const weight = weightMap.get(s.competencyId) ?? 1.0;
    const bench = benchMap.get(s.competencyId);
    const target = bench?.p75 ?? 70;
    const ratio = Math.min(s.finalScore / target, 1.2);
    weightedScore += ratio * weight;
    totalWeight += weight;
    factors.push({ label: s.competencyName, score: s.finalScore, weight, contribution: ratio * weight });
  }

  const normalizedScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;
  const probability = Math.max(5, Math.min(98, Math.round(normalizedScore * 85)));

  const readinessLevel: ReadinessLevel =
    probability >= 75 ? 'Ready Now' :
    probability >= 55 ? 'Ready in 3-6 Months' :
    probability >= 35 ? 'Ready in 6-12 Months' :
    'Needs Significant Development';

  const sorted = [...scores].sort((a, b) => {
    const wa = weightMap.get(a.competencyId) ?? 1;
    const wb = weightMap.get(b.competencyId) ?? 1;
    const benchA = benchMap.get(a.competencyId)?.p75 ?? 70;
    const benchB = benchMap.get(b.competencyId)?.p75 ?? 70;
    const gapA = benchA - a.finalScore;
    const gapB = benchB - b.finalScore;
    return (gapB * wb) - (gapA * wa);
  });

  const strengths = [...scores].sort((a, b) => b.finalScore - a.finalScore).slice(0, 3).map(s => s.competencyName);
  const topGaps = sorted.filter(s => {
    const bench = benchMap.get(s.competencyId)?.p75 ?? 70;
    return bench > s.finalScore;
  }).slice(0, 3).map(s => s.competencyName);

  const criticalGaps = scores.filter(s => {
    const bench = benchMap.get(s.competencyId)?.p75 ?? 70;
    return (bench - s.finalScore) >= 30;
  }).length;

  const highGaps = scores.filter(s => {
    const bench = benchMap.get(s.competencyId)?.p75 ?? 70;
    const gap = bench - s.finalScore;
    return gap >= 20 && gap < 30;
  }).length;

  return {
    probability,
    readinessLevel,
    overallScore: Math.round(scores.reduce((s, c) => s + c.finalScore, 0) / (scores.length || 1)),
    weightedScore: Math.round(normalizedScore * 100),
    criticalGaps,
    highGaps,
    topStrengths: strengths,
    topGaps,
    factors: factors.sort((a, b) => b.contribution - a.contribution).slice(0, 5),
  };
}
