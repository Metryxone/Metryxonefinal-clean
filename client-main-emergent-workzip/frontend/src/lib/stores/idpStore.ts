import { create } from 'zustand';
import { idpService } from '@/lib/services/idpService';
import type { IDPOutput } from '@/lib/engines/idpEngine';

type IDPStatus = 'pending' | 'in-progress' | 'done';

interface IDPState {
  output:   IDPOutput | null;
  progress: Record<string, IDPStatus>;

  build:       (profile: any, targetRole: any, maxItems?: number) => void;
  setProgress: (interventionId: string, status: IDPStatus) => void;
  loadProgress:() => void;
  reset:       () => void;
}

export const useIDPStore = create<IDPState>((set) => ({
  output:   null,
  progress: {},

  build: (profile, targetRole, maxItems) => {
    if (!targetRole) return;
    const output   = idpService.build(profile, targetRole, maxItems);
    const progress = idpService.getProgress();
    set({ output, progress });
  },

  setProgress: (interventionId, status) => {
    idpService.setProgress(interventionId, status);
    set(s => ({ progress: { ...s.progress, [interventionId]: status } }));
  },

  loadProgress: () => set({ progress: idpService.getProgress() }),
  reset:        () => { idpService.clearProgress(); set({ output: null, progress: {} }); },
}));
