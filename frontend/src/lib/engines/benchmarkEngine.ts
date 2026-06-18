import { INDUSTRY_BENCHMARKS } from '@/data/catalogs/benchmarks';
import type { CareerProfile } from '@/lib/careerIntelligence';

export interface BenchmarkInput {
  profile:   CareerProfile | null | undefined;
  skillsFilter?: string[];
}

export interface BenchmarkComparison {
  skill:         string;
  userHas:       boolean;
  industryPct:   number;
  aboveBenchmark:boolean;
}

export interface BenchmarkOutput {
  comparisons:     BenchmarkComparison[];
  aboveCount:      number;
  belowCount:      number;
  coveragePct:     number;
  topOpportunities:BenchmarkComparison[];
}

export function runBenchmarkEngine(input: BenchmarkInput): BenchmarkOutput {
  const userSkills = new Set([
    ...(input.profile?.skills?.technical ?? []).map(s => s.toLowerCase()),
    ...(input.profile?.skills?.soft ?? []).map(s => s.toLowerCase()),
  ]);

  const skills = input.skillsFilter ?? Object.keys(INDUSTRY_BENCHMARKS);
  const comparisons: BenchmarkComparison[] = skills.map(skill => {
    const userHas = userSkills.has(skill.toLowerCase());
    const industryPct = INDUSTRY_BENCHMARKS[skill] ?? 50;
    return { skill, userHas, industryPct, aboveBenchmark: userHas };
  });

  const aboveCount  = comparisons.filter(c => c.aboveBenchmark).length;
  const coveragePct = Math.round((aboveCount / Math.max(1, comparisons.length)) * 100);

  return {
    comparisons,
    aboveCount,
    belowCount:       comparisons.length - aboveCount,
    coveragePct,
    topOpportunities: comparisons
      .filter(c => !c.userHas)
      .sort((a, b) => b.industryPct - a.industryPct)
      .slice(0, 5),
  };
}
