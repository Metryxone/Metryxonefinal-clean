import { runBenchmarkEngine, type BenchmarkOutput } from '@/lib/engines/benchmarkEngine';
import type { CareerProfile } from '@/lib/careerIntelligence';

export const benchmarkService = {
  compute(profile: CareerProfile | null | undefined, skillsFilter?: string[]): BenchmarkOutput {
    return runBenchmarkEngine({ profile, skillsFilter });
  },
};
