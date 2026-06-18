export interface RawScore {
  competencyId: string;
  competencyCode: string;
  rawScore: number;
  confidence: number;
}

export interface FinalScore extends RawScore {
  finalScore: number;
  normalizedScore: number;
}

export function computeFinalScore(raw: number, confidence: number): number {
  return Math.min(Math.round(raw * confidence), 100);
}

export function normalizeZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

export function normalizeMinMax(value: number, min = 0, max = 100): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

export function computeWeightedScore(scores: { finalScore: number; weight: number }[]): number {
  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = scores.reduce((s, x) => s + x.finalScore * x.weight, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}
