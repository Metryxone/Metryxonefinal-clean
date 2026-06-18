export interface VisibilityProfile {
  userId: string;
  fullName: string;
  overallScore: number;
  overallPercentile: number;
  currentRole: string;
  industry: string;
  careerStage: string;
  experienceYears: number;
}

export interface VisibilityScore {
  userId: string;
  fullName: string;
  visibilityScore: number;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  strengths: string[];
  readinessSignal: string;
  employerAppeal: number;
}

function tierLabel(score: number): VisibilityScore['tier'] {
  if (score >= 85) return 'Platinum';
  if (score >= 70) return 'Gold';
  if (score >= 55) return 'Silver';
  return 'Bronze';
}

function readinessSignal(percentile: number, score: number): string {
  if (percentile >= 80 && score >= 75) return 'Highly Marketable — Top performer for this role level';
  if (percentile >= 65) return 'Market Ready — Strong profile with demonstrated competencies';
  if (percentile >= 45) return 'Developing — Building competitive profile';
  return 'Emerging — Early stage, strong growth potential';
}

export function computeVisibilityScores(profiles: VisibilityProfile[]): VisibilityScore[] {
  return profiles.map(p => {
    const percentileWeight = p.overallPercentile * 0.45;
    const scoreWeight = p.overallScore * 0.35;
    const expBonus = Math.min(p.experienceYears * 1.5, 15);
    const stageBonus = p.careerStage === 'senior' ? 5 : p.careerStage === 'mid' ? 2 : 0;
    const visibilityScore = Math.min(100, Math.round(percentileWeight + scoreWeight + expBonus + stageBonus));

    const strengths: string[] = [];
    if (p.overallPercentile >= 75) strengths.push('Top-quartile performer');
    if (p.overallScore >= 75) strengths.push('High competency scores');
    if (p.experienceYears >= 5) strengths.push('Experienced professional');
    if (p.careerStage === 'senior') strengths.push('Senior-level career stage');

    return {
      userId: p.userId,
      fullName: p.fullName,
      visibilityScore,
      tier: tierLabel(visibilityScore),
      strengths,
      readinessSignal: readinessSignal(p.overallPercentile, p.overallScore),
      employerAppeal: Math.min(100, Math.round(visibilityScore * 0.9 + p.overallScore * 0.1)),
    };
  });
}

export function filterByTier(scores: VisibilityScore[], minTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'): VisibilityScore[] {
  const tierOrder = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 };
  const minRank = tierOrder[minTier];
  return scores.filter(s => tierOrder[s.tier] >= minRank);
}
