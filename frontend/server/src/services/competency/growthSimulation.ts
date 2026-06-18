export interface GrowthPoint {
  week: number;
  overallScore: number;
  byDomain: Record<string, number>;
}

export interface SimulationResult {
  initialOverall: number;
  projectedOverall: number;
  improvementPercent: number;
  weeksSimulated: number;
  weeklyGrowthRate: number;
  timeline: GrowthPoint[];
  topImprovers: { competencyCode: string; competencyName: string; initialScore: number; projectedScore: number; gain: number }[];
}

export function simulateGrowth(
  scores: { competencyId: string; competencyCode: string; competencyName: string; domainCode: string; finalScore: number }[],
  interventions: { competencyId: string; expectedScoreGain: number; durationWeeks: number }[],
  weeksToSimulate = 12
): SimulationResult {
  if (!scores.length) {
    return { initialOverall: 0, projectedOverall: 0, improvementPercent: 0, weeksSimulated: weeksToSimulate, weeklyGrowthRate: 0, timeline: [], topImprovers: [] };
  }

  const passiveRate = 0.008;
  const interventionMap = new Map<string, number>();
  for (const iv of interventions) {
    const weeklyGain = iv.durationWeeks > 0 ? iv.expectedScoreGain / iv.durationWeeks : 0;
    interventionMap.set(iv.competencyId, (interventionMap.get(iv.competencyId) ?? 0) + weeklyGain);
  }

  const initialOverall = Math.round(scores.reduce((sum, s) => sum + s.finalScore, 0) / scores.length);
  const timeline: GrowthPoint[] = [];

  const currentScores = scores.map(s => ({ ...s, score: s.finalScore }));

  for (let w = 1; w <= weeksToSimulate; w += Math.max(1, Math.floor(weeksToSimulate / 6))) {
    const projected = currentScores.map(s => {
      const ivRate = interventionMap.get(s.competencyId) ?? 0;
      const totalRate = passiveRate + ivRate;
      return {
        ...s,
        score: Math.min(100, parseFloat((s.finalScore * (1 + totalRate * w)).toFixed(1))),
      };
    });

    const domainSum: Record<string, number> = {};
    const domainCount: Record<string, number> = {};
    for (const s of projected) {
      domainSum[s.domainCode] = (domainSum[s.domainCode] ?? 0) + s.score;
      domainCount[s.domainCode] = (domainCount[s.domainCode] ?? 0) + 1;
    }
    const byDomain: Record<string, number> = {};
    for (const code of Object.keys(domainSum)) {
      byDomain[code] = parseFloat((domainSum[code] / domainCount[code]).toFixed(1));
    }

    timeline.push({
      week: w,
      overallScore: Math.round(projected.reduce((sum, s) => sum + s.score, 0) / projected.length),
      byDomain,
    });
  }

  const finalScores = currentScores.map(s => {
    const ivRate = interventionMap.get(s.competencyId) ?? 0;
    const totalRate = passiveRate + ivRate;
    return { ...s, projected: Math.min(100, parseFloat((s.finalScore * (1 + totalRate * weeksToSimulate)).toFixed(1))) };
  });

  const projectedOverall = Math.round(finalScores.reduce((sum, s) => sum + s.projected, 0) / finalScores.length);
  const improvementPercent = initialOverall > 0 ? parseFloat(((projectedOverall - initialOverall) / initialOverall * 100).toFixed(1)) : 0;
  const weeklyGrowthRate = weeksToSimulate > 0 ? parseFloat(((projectedOverall - initialOverall) / weeksToSimulate).toFixed(2)) : 0;

  const topImprovers = finalScores
    .map(s => ({ competencyCode: s.competencyCode, competencyName: s.competencyName, initialScore: s.finalScore, projectedScore: s.projected, gain: parseFloat((s.projected - s.finalScore).toFixed(1)) }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 8);

  return { initialOverall, projectedOverall, improvementPercent, weeksSimulated: weeksToSimulate, weeklyGrowthRate, timeline, topImprovers };
}
