export interface TransitionInput {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  domainName: string;
  currentScore: number;
  currentRoleTarget: number;
  targetRoleTarget: number;
  weight: number;
}

export interface TransitionGap {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  domainName: string;
  currentScore: number;
  currentRoleTarget: number;
  targetRoleTarget: number;
  gapToTarget: number;
  weightedGap: number;
  urgency: 'critical' | 'high' | 'medium' | 'low' | 'met';
}

export interface TransitionReadiness {
  overallReadiness: number;
  readinessLevel: 'Ready' | 'Near Ready' | 'In Progress' | 'Early Stage';
  estimatedMonths: number;
  criticalGaps: TransitionGap[];
  allGaps: TransitionGap[];
}

export function computeTransitionGaps(inputs: TransitionInput[]): TransitionGap[] {
  return inputs.map(item => {
    const gap = item.targetRoleTarget - item.currentScore;
    const weightedGap = gap * item.weight;
    let urgency: TransitionGap['urgency'];
    if (gap <= 0) urgency = 'met';
    else if (gap >= 30) urgency = 'critical';
    else if (gap >= 20) urgency = 'high';
    else if (gap >= 10) urgency = 'medium';
    else urgency = 'low';

    return {
      competencyId: item.competencyId,
      competencyCode: item.competencyCode,
      competencyName: item.competencyName,
      domainName: item.domainName,
      currentScore: item.currentScore,
      currentRoleTarget: item.currentRoleTarget,
      targetRoleTarget: item.targetRoleTarget,
      gapToTarget: Math.max(0, parseFloat(gap.toFixed(1))),
      weightedGap: parseFloat(Math.max(0, weightedGap).toFixed(3)),
      urgency,
    };
  });
}

export function computeTransitionReadiness(gaps: TransitionGap[]): TransitionReadiness {
  if (!gaps.length) return { overallReadiness: 0, readinessLevel: 'Early Stage', estimatedMonths: 24, criticalGaps: [], allGaps: [] };

  const metCount = gaps.filter(g => g.urgency === 'met').length;
  const overallReadiness = Math.round((metCount / gaps.length) * 100);

  let readinessLevel: TransitionReadiness['readinessLevel'];
  if (overallReadiness >= 80) readinessLevel = 'Ready';
  else if (overallReadiness >= 60) readinessLevel = 'Near Ready';
  else if (overallReadiness >= 35) readinessLevel = 'In Progress';
  else readinessLevel = 'Early Stage';

  const avgGap = gaps.filter(g => g.urgency !== 'met').reduce((sum, g) => sum + g.gapToTarget, 0) / (gaps.length || 1);
  const estimatedMonths = Math.max(1, Math.round(avgGap * 0.4));

  const criticalGaps = gaps.filter(g => g.urgency === 'critical' || g.urgency === 'high');
  const allGaps = [...gaps].sort((a, b) => b.weightedGap - a.weightedGap);

  return { overallReadiness, readinessLevel, estimatedMonths, criticalGaps, allGaps };
}
