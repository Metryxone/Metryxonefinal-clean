/**
 * Adaptive Runtime Authority client — Phase 5 (additive, shadow-mode).
 * Mirrors backend envelope. Never throws; returns null on flag-off / failure.
 */
export type AdaptiveRuntimeFlagState = {
  adaptiveIntelligenceFoundation: boolean;
  adaptiveRuntimeAuthority: boolean;
  competencyFusionEnabled: boolean;
  contextualScoringAuthority: boolean;
  intelligenceNarratives: boolean;
  continuousCompetencyMemory: boolean;
};

type Envelope<T> = T & {
  ok: boolean;
  error?: string;
  methodology_versions?: Record<string, string>;
  language_policy?: { allowed: string[]; disallowed: string[] };
  feature_flag?: AdaptiveRuntimeFlagState;
};

async function safeJson<T>(url: string, init?: RequestInit): Promise<Envelope<T> | null> {
  try {
    const res = await fetch(url, { credentials: 'include', ...(init ?? {}) });
    const data = await res.json().catch(() => null);
    return (data ?? null) as Envelope<T> | null;
  } catch {
    return null;
  }
}

export const adaptiveRuntimeAuthorityService = {
  async featureFlag(): Promise<AdaptiveRuntimeFlagState | null> {
    const r = await safeJson<{ feature_flag: AdaptiveRuntimeFlagState }>(
      '/api/v2/adaptive-runtime/feature-flag');
    return r?.feature_flag ?? null;
  },
  async versions() {
    return safeJson<{ versions: Record<string, string>; authority_stages: string[]; narrative_kinds: string[] }>(
      '/api/v2/adaptive-runtime/_meta/versions');
  },
  async run(userId: string, body: Record<string, unknown> = {}) {
    return safeJson<{ snapshot: unknown }>(
      `/api/v2/adaptive-runtime/run/${encodeURIComponent(userId)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },
  async snapshot(userId: string) {
    return safeJson<{ snapshot: unknown }>(
      `/api/v2/adaptive-runtime/snapshot/${encodeURIComponent(userId)}`);
  },
  async fusion(userId: string, limit = 50) {
    return safeJson<{ fusion: unknown[] }>(
      `/api/v2/adaptive-runtime/fusion/${encodeURIComponent(userId)}?limit=${limit}`);
  },
  async narratives(userId: string, opts: { kind?: string; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.kind) q.set('kind', opts.kind);
    if (opts.limit) q.set('limit', String(opts.limit));
    const qs = q.toString();
    return safeJson<{ narratives: unknown[] }>(
      `/api/v2/adaptive-runtime/narratives/${encodeURIComponent(userId)}${qs ? `?${qs}` : ''}`);
  },
  async memory(userId: string, opts: { competencyId?: string; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.competencyId) q.set('competencyId', opts.competencyId);
    if (opts.limit) q.set('limit', String(opts.limit));
    const qs = q.toString();
    return safeJson<{ memory: unknown[]; summary: unknown }>(
      `/api/v2/adaptive-runtime/memory/${encodeURIComponent(userId)}${qs ? `?${qs}` : ''}`);
  },
  async transition(body: { fromStage?: string; toStage: string; trigger?: string; userId?: string; diff?: Record<string, unknown> }) {
    return safeJson<{ transitioned: unknown }>(
      '/api/v2/adaptive-runtime/authority/transition',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },
  async transitions(opts: { userId?: string; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.limit) q.set('limit', String(opts.limit));
    const qs = q.toString();
    return safeJson<{ transitions: unknown[] }>(
      `/api/v2/adaptive-runtime/authority/transitions${qs ? `?${qs}` : ''}`);
  },
};
