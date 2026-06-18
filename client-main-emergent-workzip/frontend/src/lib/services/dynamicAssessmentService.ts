/**
 * Dynamic Assessment Runtime client — Phase 4 (additive, shadow-mode).
 * Mirrors backend envelope. Never throws; returns null on flag-off / failure.
 */
export type DynamicAssessmentFlagState = {
  adaptiveIntelligenceFoundation: boolean;
  dynamicQuestionGeneration: boolean;
  adaptiveQuestionBranching: boolean;
  cognitiveRuntimeEnabled: boolean;
};

type Envelope<T> = T & {
  ok: boolean;
  error?: string;
  methodology_versions?: Record<string, string>;
  language_policy?: { allowed: string[]; disallowed: string[] };
  feature_flag?: DynamicAssessmentFlagState;
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

export const dynamicAssessmentService = {
  async featureFlag(): Promise<DynamicAssessmentFlagState | null> {
    const r = await safeJson<{ feature_flag: DynamicAssessmentFlagState }>('/api/v2/dynamic-assessment/feature-flag');
    return r?.feature_flag ?? null;
  },

  async versions(): Promise<Record<string, string> | null> {
    const r = await safeJson<{ methodology_versions: Record<string, string> }>('/api/v2/dynamic-assessment/_meta/versions');
    return r?.methodology_versions ?? null;
  },

  async startSession(body: Record<string, unknown>) {
    return safeJson<{ sessionId: string | null; shadowMode: boolean }>(
      '/api/v2/dynamic-assessment/session/start',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },

  async generate(sessionId: string, body: Record<string, unknown>) {
    return safeJson<{ question: unknown; persistedId: string | null }>(
      `/api/v2/dynamic-assessment/session/${encodeURIComponent(sessionId)}/generate`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },

  async branch(sessionId: string, body: Record<string, unknown>) {
    return safeJson<{ decision: unknown; persistedId: string | null }>(
      `/api/v2/dynamic-assessment/session/${encodeURIComponent(sessionId)}/branch`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },

  async computeCognitive(userId: string, body: Record<string, unknown>) {
    return safeJson<{ profile: unknown; persistedId: string | null }>(
      `/api/v2/dynamic-assessment/cognitive/${encodeURIComponent(userId)}/compute`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },

  async latestCognitive(userId: string) {
    return safeJson<{ profile: unknown }>(
      `/api/v2/dynamic-assessment/cognitive/${encodeURIComponent(userId)}/latest`,
    );
  },

  async detectContradictions(userId: string, body: Record<string, unknown>) {
    return safeJson<{ contradictions: unknown[]; persisted: number }>(
      `/api/v2/dynamic-assessment/contradictions/${encodeURIComponent(userId)}/detect`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  },

  async recentContradictions(userId: string, limit = 20) {
    return safeJson<{ contradictions: unknown[] }>(
      `/api/v2/dynamic-assessment/contradictions/${encodeURIComponent(userId)}/recent?limit=${limit}`,
    );
  },
};
