/**
 * Competency Graph + Adaptive Blueprint client service — Phase 3.
 *
 * Read-only client wrapper around /api/v2/competency-graph/*. Never throws —
 * every error returned as a structured envelope.
 */

export type GraphFlagState = {
  adaptiveIntelligenceFoundation: boolean;
  competencyGraphRuntime: boolean;
  adaptiveBlueprintRuntime: boolean;
  competencyPropagation: boolean;
};

export type GraphEnvelope<T> = {
  ok: boolean;
  error?: string;
  data?: T;
  feature_flag?: GraphFlagState;
  methodology_versions?: Record<string, string>;
  language_policy?: { allowed: string[]; disallowed: string[] };
};

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<GraphEnvelope<T>> {
  try {
    const res = await fetch(`/api/v2/competency-graph${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, error: json?.error ?? `http_${res.status}`,
                          feature_flag: json?.feature_flag, methodology_versions: json?.methodology_versions };
    return { ok: true, data: json as T,
             feature_flag: json?.feature_flag,
             methodology_versions: json?.methodology_versions,
             language_policy: json?.language_policy };
  } catch (err) { return { ok: false, error: (err as Error).message }; }
}

export const competencyGraphService = {
  flagState:  () => call<{ feature_flag: GraphFlagState }>('GET', '/feature-flag'),
  versions:   () => call<{ methodology_versions: Record<string, string> }>('GET', '/_meta/versions'),
  traverse:   (competencyId: string, hops = 2) =>
                call<{ subview: unknown }>('GET', `/traverse/${encodeURIComponent(competencyId)}?hops=${hops}`),
  propagate:  (userId: string, sourceCompetencyId: string, confidenceDelta: number) =>
                call<{ result: unknown }>('POST', '/propagate', { userId, sourceCompetencyId, confidenceDelta }),
  blueprint:  (userId: string, roleContext?: Record<string, unknown>) =>
                call<{ envelope: unknown }>('POST', `/blueprint/${encodeURIComponent(userId)}`, { roleContext }),
};
