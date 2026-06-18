import { computeDashboardIntelligence, type DashboardIntelligenceOutput } from '@/modules/career-builder/dashboard/views/DashboardIntelligence';
import { runProfileIntelligenceEngine, type ProfileIntelligenceOutput } from '@/lib/engines/profileIntelligenceEngine';
import { runResumeIntelligenceEngine, type ResumeIntelligenceOutput } from '@/lib/engines/resumeIntelligenceEngine';
import { idpService } from '@/lib/services/idpService';
import type { CareerProfile } from '@/lib/careerIntelligence';
import type { MarketRole } from '@/data/marketCatalog';

export const intelligenceService = {
  dashboard(
    profile:    CareerProfile | null | undefined,
    targetRole: MarketRole | null | undefined,
  ): DashboardIntelligenceOutput {
    const progress = idpService.getProgress();
    return computeDashboardIntelligence(profile, targetRole, progress);
  },

  analyzeProfile(profile: CareerProfile | null | undefined): ProfileIntelligenceOutput {
    return runProfileIntelligenceEngine({ profile });
  },

  analyzeResume(parsed: Record<string, unknown>): ResumeIntelligenceOutput {
    return runResumeIntelligenceEngine({ parsed });
  },
};

export type { DashboardIntelligenceOutput, ProfileIntelligenceOutput, ResumeIntelligenceOutput };
