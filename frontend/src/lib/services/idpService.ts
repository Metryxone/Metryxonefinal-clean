import { runIDPEngine, type IDPOutput } from '@/lib/engines/idpEngine';
import type { MarketRole } from '@/data/marketCatalog';
import type { CareerProfile } from '@/lib/careerIntelligence';

const LS_PROGRESS = 'mx-career-idp-progress';
type IDPStatus = 'pending' | 'in-progress' | 'done';

export const idpService = {
  build(profile: CareerProfile | null | undefined, targetRole: MarketRole, maxItems?: number): IDPOutput {
    return runIDPEngine({ profile, targetRole, maxItems });
  },

  getProgress(): Record<string, IDPStatus> {
    try { return JSON.parse(localStorage.getItem(LS_PROGRESS) ?? '{}'); }
    catch { return {}; }
  },

  setProgress(interventionId: string, status: IDPStatus): void {
    const current = this.getProgress();
    current[interventionId] = status;
    localStorage.setItem(LS_PROGRESS, JSON.stringify(current));
  },

  clearProgress(): void {
    localStorage.removeItem(LS_PROGRESS);
  },
};
