import { create } from 'zustand';
import { workforceService } from '@/lib/services/workforceService';
import type { WorkforceOutput } from '@/lib/engines/workforceEngine';

interface WorkforceState {
  output: WorkforceOutput | null;
  analyse: (profile: any, region?: string) => void;
  reset:   () => void;
}

export const useWorkforceStore = create<WorkforceState>((set) => ({
  output: null,
  analyse: (profile, region) =>
    set({ output: workforceService.analyse(profile, region) }),
  reset: () => set({ output: null }),
}));
