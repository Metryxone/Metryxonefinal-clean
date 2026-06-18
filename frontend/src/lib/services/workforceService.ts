import { runWorkforceEngine, type WorkforceOutput } from '@/lib/engines/workforceEngine';
import type { CareerProfile } from '@/lib/careerIntelligence';

export const workforceService = {
  analyse(profile: CareerProfile | null | undefined, region?: string): WorkforceOutput {
    return runWorkforceEngine({ profile, region });
  },
};
