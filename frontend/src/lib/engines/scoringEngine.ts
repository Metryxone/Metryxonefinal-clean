import { computeScoresFromAnswers, type AQ } from '@/data/catalogs/assessment-questions';

export interface ScoringInput {
  answers:   Record<string, number>;
  questions: AQ[];
}

export interface DomainScore {
  domain:   string;
  score:    number;
  count:    number;
  color:    string;
}

export interface ScoringOutput {
  rawScores:    { competencyCode: string; rawScore: number; confidence: number }[];
  domainScores: DomainScore[];
  overallScore: number;
  grade:        string;
}

import { DOMAIN_COLORS } from '@/data/catalogs/assessment-questions';

function gradeFrom(score: number): string {
  if (score >= 85) return 'Outstanding';
  if (score >= 70) return 'Proficient';
  if (score >= 55) return 'Developing';
  if (score >= 40) return 'Emerging';
  return 'Foundation';
}

export function runScoringEngine(input: ScoringInput): ScoringOutput {
  const rawScores = computeScoresFromAnswers(input.answers);

  const domainMap: Record<string, { total: number; count: number }> = {};
  for (const q of input.questions) {
    if (input.answers[q.id] !== undefined) {
      if (!domainMap[q.domain]) domainMap[q.domain] = { total: 0, count: 0 };
      domainMap[q.domain].total += input.answers[q.id];
      domainMap[q.domain].count += 1;
    }
  }

  const domainScores: DomainScore[] = Object.entries(domainMap).map(([domain, { total, count }]) => ({
    domain,
    score: Math.round(total / count),
    count,
    color: DOMAIN_COLORS[domain] ?? '#344E86',
  }));

  const overallScore = domainScores.length
    ? Math.round(domainScores.reduce((s, d) => s + d.score, 0) / domainScores.length)
    : 0;

  return { rawScores, domainScores, overallScore, grade: gradeFrom(overallScore) };
}
