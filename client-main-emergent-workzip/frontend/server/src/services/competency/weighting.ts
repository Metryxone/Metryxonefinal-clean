export interface WeightEntry {
  competencyId: string;
  weight: number;
}

export function buildWeightMap(weights: WeightEntry[]): Map<string, number> {
  return new Map(weights.map(w => [w.competencyId, w.weight]));
}

export function applyWeights(
  scores: { competencyId: string; finalScore: number }[],
  weightMap: Map<string, number>,
  fallbackWeight = 1.0
): { competencyId: string; rawScore: number; weightedScore: number; weight: number }[] {
  return scores.map(s => {
    const w = weightMap.get(s.competencyId) ?? fallbackWeight;
    return {
      competencyId: s.competencyId,
      rawScore: s.finalScore,
      weight: w,
      weightedScore: parseFloat((s.finalScore * w).toFixed(2)),
    };
  });
}

export function weightedAverage(
  scores: { finalScore: number; competencyId: string }[],
  weightMap: Map<string, number>
): number {
  if (!scores.length) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of scores) {
    const w = weightMap.get(s.competencyId) ?? 1.0;
    weightedSum += s.finalScore * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(2)) : 0;
}

export function normalizeWeights(weights: WeightEntry[]): WeightEntry[] {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  if (total === 0) return weights;
  return weights.map(w => ({ ...w, weight: parseFloat((w.weight / total).toFixed(4)) }));
}
