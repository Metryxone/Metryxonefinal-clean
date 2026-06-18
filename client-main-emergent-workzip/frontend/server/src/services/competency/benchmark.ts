export interface BenchmarkStat {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  mean: number;
  median: number;
  stdDev: number;
  p25: number;
  p75: number;
  p90: number;
  sampleSize: number;
}

export interface PercentileResult {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  userScore: number;
  percentile: number;
  vsMedian: number;
  vsMean: number;
}

export function computePercentile(userScore: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return userScore >= mean ? 75 : 25;
  const z = (userScore - mean) / stdDev;
  const percentile = Math.round(normalCDF(z) * 100);
  return Math.max(1, Math.min(99, percentile));
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const approx = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? approx : 1 - approx;
}

export function computeOverallPercentile(results: PercentileResult[]): number {
  if (!results.length) return 50;
  return Math.round(results.reduce((s, r) => s + r.percentile, 0) / results.length);
}
