export function zScore(score: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (score - mean) / stdDev;
}

export function minMaxNormalize(score: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (score - min) / (max - min)));
}

export function normalizeScores(
  scores: { competencyId: string; finalScore: number }[],
  method: 'minmax' | 'zscore' = 'minmax'
): { competencyId: string; rawScore: number; normalizedScore: number }[] {
  if (!scores.length) return [];

  if (method === 'minmax') {
    const min = Math.min(...scores.map(s => s.finalScore));
    const max = Math.max(...scores.map(s => s.finalScore));
    return scores.map(s => ({
      competencyId: s.competencyId,
      rawScore: s.finalScore,
      normalizedScore: parseFloat(minMaxNormalize(s.finalScore, min, max).toFixed(4)),
    }));
  }

  const n = scores.length;
  const mean = scores.reduce((acc, s) => acc + s.finalScore, 0) / n;
  const variance = scores.reduce((acc, s) => acc + Math.pow(s.finalScore - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return scores.map(s => ({
    competencyId: s.competencyId,
    rawScore: s.finalScore,
    normalizedScore: parseFloat(zScore(s.finalScore, mean, stdDev).toFixed(4)),
  }));
}

export function clampScore(score: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(score)));
}
