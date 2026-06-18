import { runVisibilityEngine, type VisibilityOutput } from '@/lib/engines/visibilityEngine';
import type { CareerProfile } from '@/lib/careerIntelligence';

const LS_OPEN = 'mx-career-visibility-open';

export const visibilityService = {
  compute(profile: CareerProfile | null | undefined, eiScore: number): VisibilityOutput {
    const isOpen = this.getOpenToOpportunities();
    return runVisibilityEngine({ profile, eiScore, isOpenToOpportunities: isOpen });
  },

  getOpenToOpportunities(): boolean {
    return localStorage.getItem(LS_OPEN) === 'true';
  },

  setOpenToOpportunities(value: boolean): void {
    localStorage.setItem(LS_OPEN, String(value));
  },
};
