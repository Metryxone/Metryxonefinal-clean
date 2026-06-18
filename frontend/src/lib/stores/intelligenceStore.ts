import { create } from 'zustand';
import { runRecommendationEngine, type RecommendationOutput } from '@/lib/engines/recommendationEngine';
import { runEmployabilityEngine, type EIOutput } from '@/lib/engines/employabilityEngine';
import { MARKET_CATALOG, type MarketRole } from '@/data/marketCatalog';

const LS_TARGET = 'mx-career-target-role';

interface IntelligenceState {
  eiOutput:         EIOutput | null;
  recommendations:  RecommendationOutput | null;
  targetRoleId:     string | null;
  targetRole:       MarketRole | null;

  compute:        (profile: any) => void;
  setTargetRole:  (roleId: string | null) => void;
  initTargetRole: () => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  eiOutput:        null,
  recommendations: null,
  targetRoleId:    null,
  targetRole:      null,

  compute: (profile) => {
    const eiOutput        = runEmployabilityEngine({ profile });
    const recommendations = runRecommendationEngine({ profile });
    set({ eiOutput, recommendations });
  },

  setTargetRole: (roleId) => {
    const role = roleId ? (MARKET_CATALOG.find(r => r.id === roleId) ?? null) : null;
    localStorage.setItem(LS_TARGET, roleId ?? '');
    set({ targetRoleId: roleId, targetRole: role });
  },

  initTargetRole: () => {
    const roleId = localStorage.getItem(LS_TARGET) || null;
    const role   = roleId ? (MARKET_CATALOG.find(r => r.id === roleId) ?? null) : null;
    set({ targetRoleId: roleId, targetRole: role });
  },
}));
