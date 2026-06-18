/**
 * Competency Runtime V2 — Zustand store.
 *
 * Holds the resolved Role DNA, runtime weights, contextual expectations,
 * loading state, and explainability envelope for the V2 runtime. Backed
 * by `competencyRuntimeV2Service`. Backward-compatible: when the feature
 * flag is off, all setters become no-ops and consumers see `null` state.
 */
import { create } from 'zustand';
import {
  competencyRuntimeV2Service,
  type ResolvedDNAResult,
  type RuntimeContextInput,
  type RoleDNAEnvelope,
} from '../services/competencyRuntimeV2Service';

interface CompetencyRuntimeState {
  enabled: boolean | null;
  runtimeContext: RuntimeContextInput | null;
  roleDNA: RoleDNAEnvelope | null;
  runtimeWeights: Record<string, number> | null;
  contextualExpectations: Record<string, number> | null;
  appliedModifiers: ResolvedDNAResult['applied_modifiers'] | null;
  explainability: ResolvedDNAResult['explainability'] | null;
  confidence: number | null;
  intensity: number | null;
  loading: boolean;
  error: string | null;

  checkFlag: () => Promise<boolean>;
  resolve: (ctx: RuntimeContextInput) => Promise<ResolvedDNAResult | null>;
  reset: () => void;
}

export const useCompetencyRuntimeStore = create<CompetencyRuntimeState>((set, get) => ({
  enabled: null,
  runtimeContext: null,
  roleDNA: null,
  runtimeWeights: null,
  contextualExpectations: null,
  appliedModifiers: null,
  explainability: null,
  confidence: null,
  intensity: null,
  loading: false,
  error: null,

  async checkFlag() {
    const cached = get().enabled;
    if (cached !== null) return cached;
    const on = await competencyRuntimeV2Service.isEnabled();
    set({ enabled: on });
    return on;
  },

  async resolve(ctx) {
    const on = await get().checkFlag();
    if (!on) {
      set({ error: 'V2 runtime disabled', loading: false });
      return null;
    }
    set({ loading: true, error: null, runtimeContext: ctx });
    const result = await competencyRuntimeV2Service.resolveDNA(ctx);
    if (!result) {
      set({ loading: false, error: 'Failed to resolve competency DNA' });
      return null;
    }
    set({
      loading: false,
      error: null,
      roleDNA: result.role_dna,
      runtimeWeights: result.final_weightings,
      contextualExpectations: result.final_expected_levels,
      appliedModifiers: result.applied_modifiers,
      explainability: result.explainability,
      confidence: result.confidence_score,
      intensity: result.assessment_intensity,
    });
    return result;
  },

  reset() {
    set({
      runtimeContext: null,
      roleDNA: null,
      runtimeWeights: null,
      contextualExpectations: null,
      appliedModifiers: null,
      explainability: null,
      confidence: null,
      intensity: null,
      loading: false,
      error: null,
    });
  },
}));
