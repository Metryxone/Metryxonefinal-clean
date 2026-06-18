/**
 * Competency Runtime V2 — frontend service wrapper.
 *
 * Backs the V2 /api/v2/competency/* endpoints. Returns parsed JSON
 * (or `null` on network/feature-flag failure) so callers can branch
 * cleanly without try/catch noise.
 */

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export interface RuntimeContextInput {
  industry_id?: string | null;
  function_id?: string | null;
  sub_function_id?: string | null;
  role_id?: string | null;
  layer_id?: string | null;
  complexity_model_id?: string | null;
  geography?: string | null;
  org_maturity?: string | null;
  team_scale?: string | null;
  seniority_band?: string | null;
  assessment_mode?: string | null;
}

export interface AppliedModifierSummary {
  modifier_type: string;
  modifier_name: string;
  adjustment_weight: number;
  affected_competencies: string[];
}

export interface RoleDNAEnvelope {
  role_id: string | null;
  dna_name: string;
  dna_description: string;
  default_weightings: Record<string, number>;
  expected_levels: Record<string, number>;
  confidence_model: { coverage: number; provenance: 'ontology' | 'fallback' };
  metadata: Record<string, unknown>;
}

export interface ResolvedDNAResult {
  runtime_version: string;
  runtime_context_id: string;
  role_dna_id: string;
  role_dna: RoleDNAEnvelope;
  final_weightings: Record<string, number>;
  final_expected_levels: Record<string, number>;
  applied_modifiers: AppliedModifierSummary[];
  assessment_intensity: number;
  confidence_score: number;
  explainability: {
    version: string;
    why_competencies_selected: string;
    why_weights_assigned: Array<{ competency_code: string; base_weight: number; final_weight: number; delta: number; reasons: string[] }>;
    why_readiness_level: Array<{ competency_code: string; expected_level: number; rationale: string }>;
    why_cohort: string;
    applied_modifiers: AppliedModifierSummary[];
    confidence: { score: number; coverage: number; provenance: string; rationale: string };
    language_policy: { allowed: string[]; disallowed: string[] };
  };
  methodology_versions: Record<string, string>;
}

interface FeatureFlagResponse {
  ok: boolean;
  feature_flag: { advancedCompetencyRuntimeV2: boolean };
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, {
      ...(init ?? {}),
      headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init?.headers ?? {}) },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const competencyRuntimeV2Service = {
  async isEnabled(): Promise<boolean> {
    const j = await getJson<FeatureFlagResponse>('/api/v2/competency/feature-flag');
    return !!j?.feature_flag?.advancedCompetencyRuntimeV2;
  },

  async resolveDNA(ctx: RuntimeContextInput): Promise<ResolvedDNAResult | null> {
    const j = await getJson<{ ok: boolean; result: ResolvedDNAResult }>(
      '/api/v2/competency/resolve-dna',
      { method: 'POST', body: JSON.stringify(ctx) },
    );
    return j?.result ?? null;
  },

  async fetchRoleDNA(roleId: string, params: Partial<RuntimeContextInput> = {}): Promise<RoleDNAEnvelope | null> {
    const qs = new URLSearchParams();
    if (params.layer_id) qs.set('layer_id', params.layer_id);
    if (params.industry_id) qs.set('industry_id', params.industry_id);
    if (params.complexity_model_id) qs.set('complexity_model_id', params.complexity_model_id);
    if (params.org_maturity) qs.set('org_maturity', params.org_maturity);
    const j = await getJson<{ ok: boolean; role_dna: RoleDNAEnvelope }>(
      `/api/v2/competency/role-dna/${encodeURIComponent(roleId)}${qs.toString() ? `?${qs}` : ''}`,
    );
    return j?.role_dna ?? null;
  },

  async fetchRuntimeWeights(userId: string | number) {
    return getJson<{ ok: boolean; weights: Array<{
      competency_code: string;
      importance_weight: number;
      expected_level: number;
      minimum_threshold: number;
      growth_priority: number;
      criticality: 'critical' | 'high' | 'medium' | 'low';
      weighting_reason: string;
      resolved_role_dna_id: string;
    }> }>(`/api/v2/competency/runtime-weights/${userId}`);
  },

  async fetchContextualExpectations(userId: string | number) {
    return getJson<{ ok: boolean; expectations: {
      resolved_at: string;
      confidence_score: number;
      context: RuntimeContextInput;
      outputs: { finalWeights: Record<string, number>; finalLevels: Record<string, number>; intensity: number };
      explainability: ResolvedDNAResult['explainability'];
      role_dna: Record<string, unknown> | null;
    } | null }>(`/api/v2/competency/contextual-expectations/${userId}`);
  },
};
