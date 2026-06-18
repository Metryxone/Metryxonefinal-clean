import type { VisibilityScore } from './visibilityEngine.js';

export interface JobRequirement {
  role: string;
  industry?: string;
  careerStage?: string;
  minScore?: number;
  minPercentile?: number;
  requiredCompetencyCodes?: string[];
}

export interface CandidateMatch {
  userId: string;
  fullName: string;
  matchScore: number;
  tier: string;
  visibilityScore: number;
  employerAppeal: number;
  matchReasons: string[];
  missingRequirements: string[];
}

export interface MatchResult {
  requirement: JobRequirement;
  totalCandidates: number;
  matchedCandidates: CandidateMatch[];
  topMatch: CandidateMatch | null;
}

export function matchCandidates(
  candidates: (VisibilityScore & {
    currentRole?: string;
    industry?: string;
    careerStage?: string;
    overallScore?: number;
    overallPercentile?: number;
    competencyCodes?: string[];
  })[],
  requirement: JobRequirement
): MatchResult {
  const matches: CandidateMatch[] = [];

  for (const c of candidates) {
    const matchReasons: string[] = [];
    const missingRequirements: string[] = [];
    let matchScore = c.visibilityScore * 0.4 + c.employerAppeal * 0.3;

    if (requirement.industry && c.industry) {
      if (c.industry.toLowerCase() === requirement.industry.toLowerCase()) {
        matchScore += 15;
        matchReasons.push(`Industry match: ${c.industry}`);
      }
    }

    if (requirement.careerStage && c.careerStage) {
      if (c.careerStage === requirement.careerStage) {
        matchScore += 10;
        matchReasons.push(`Career stage match: ${c.careerStage}`);
      }
    }

    if (requirement.minScore != null) {
      const score = c.overallScore ?? 0;
      if (score >= requirement.minScore) {
        matchScore += 10;
        matchReasons.push(`Meets minimum score: ${score} >= ${requirement.minScore}`);
      } else {
        missingRequirements.push(`Score below minimum (${score} < ${requirement.minScore})`);
        matchScore -= 15;
      }
    }

    if (requirement.minPercentile != null) {
      const p = c.overallPercentile ?? 50;
      if (p >= requirement.minPercentile) {
        matchScore += 8;
        matchReasons.push(`Meets percentile: ${p}th`);
      } else {
        missingRequirements.push(`Percentile below minimum (${p} < ${requirement.minPercentile})`);
      }
    }

    if (c.tier === 'Platinum') { matchScore += 12; matchReasons.push('Platinum tier'); }
    else if (c.tier === 'Gold') { matchScore += 7; matchReasons.push('Gold tier'); }

    matches.push({
      userId: c.userId,
      fullName: c.fullName,
      matchScore: Math.min(100, Math.round(Math.max(0, matchScore))),
      tier: c.tier,
      visibilityScore: c.visibilityScore,
      employerAppeal: c.employerAppeal,
      matchReasons,
      missingRequirements,
    });
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);
  const matchedCandidates = matches.filter(m => m.missingRequirements.length === 0 || m.matchScore >= 50);

  return {
    requirement,
    totalCandidates: candidates.length,
    matchedCandidates: matchedCandidates.slice(0, 20),
    topMatch: matchedCandidates[0] ?? null,
  };
}
