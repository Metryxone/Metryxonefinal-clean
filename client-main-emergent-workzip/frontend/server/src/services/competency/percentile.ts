function erfApprox(x: number): number {
  const a = 0.147;
  const sign = x >= 0 ? 1 : -1;
  const abs = Math.abs(x);
  const inner = Math.sqrt(1 - Math.exp(-abs * abs * (4 / Math.PI + a * abs * abs) / (1 + a * abs * abs)));
  return sign * inner;
}

export function normalCDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / (stdDev * Math.SQRT2);
  return Math.max(1, Math.min(99, Math.round(50 * (1 + erfApprox(z)))));
}

export function computePercentile(score: number, mean: number, stdDev: number): number {
  return normalCDF(score, mean, stdDev);
}

export function computeOverallPercentile(
  perCompetency: { percentile: number }[]
): number {
  if (!perCompetency.length) return 50;
  const avg = perCompetency.reduce((sum, p) => sum + p.percentile, 0) / perCompetency.length;
  return Math.round(avg);
}

export function percentileLabel(p: number): string {
  if (p >= 90) return 'Top 10%';
  if (p >= 75) return 'Top 25%';
  if (p >= 50) return 'Above Average';
  if (p >= 25) return 'Below Average';
  return 'Bottom 25%';
}

export function computePercentilesBatch(
  scores: { competencyId: string; finalScore: number }[],
  benchmarkMap: Map<string, { mean: number | string; std_dev: number | string }>
): { competencyId: string; score: number; percentile: number; label: string }[] {
  return scores.map(s => {
    const bench = benchmarkMap.get(s.competencyId);
    const mean = bench ? parseFloat(String(bench.mean)) : 55;
    const std = bench ? parseFloat(String(bench.std_dev)) : 10;
    const p = computePercentile(s.finalScore, mean, std);
    return { competencyId: s.competencyId, score: s.finalScore, percentile: p, label: percentileLabel(p) };
  });
}
