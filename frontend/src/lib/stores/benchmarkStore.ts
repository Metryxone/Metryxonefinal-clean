import { create } from 'zustand';
import { benchmarkService } from '@/lib/services/benchmarkService';
import type { BenchmarkOutput } from '@/lib/engines/benchmarkEngine';

interface BenchmarkState {
  output: BenchmarkOutput | null;
  compute: (profile: any, skillsFilter?: string[]) => void;
  reset:   () => void;
}

export const useBenchmarkStore = create<BenchmarkState>((set) => ({
  output: null,
  compute: (profile, skillsFilter) =>
    set({ output: benchmarkService.compute(profile, skillsFilter) }),
  reset: () => set({ output: null }),
}));
