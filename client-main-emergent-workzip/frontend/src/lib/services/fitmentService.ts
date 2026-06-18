import { runFitmentEngine, type FitmentInput, type FitmentOutput } from '@/lib/engines/fitmentEngine';
import type { MarketRole } from '@/data/marketCatalog';
import type { CareerProfile } from '@/lib/careerIntelligence';

export const fitmentService = {
  compute(profile: CareerProfile | null | undefined, role: MarketRole): FitmentOutput {
    return runFitmentEngine({ profile, targetRole: role });
  },

  batch(profile: CareerProfile | null | undefined, roles: MarketRole[]): FitmentOutput[] {
    return roles.map(role => runFitmentEngine({ profile, targetRole: role }));
  },
};
