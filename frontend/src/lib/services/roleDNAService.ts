/**
 * Role DNA client service — Phase 2.
 *
 * Read-only client wrapper around /api/v2/role-dna/*. Shadow-mode safe:
 * never throws — every error is returned as a structured envelope.
 */

export type RoleDNAFlagState = {
  adaptiveIntelligenceFoundation: boolean;
  roleDNARuntimeEnabled: boolean;
  functionalCompetencySeeding: boolean;
  contextualCompetencyResolution: boolean;
};

export type RoleDNAEnvelope<T> = {
  ok: boolean;
  error?: string;
  data?: T;
  feature_flag?: RoleDNAFlagState;
  methodology_versions?: Record<string, string>;
  language_policy?: { allowed: string[]; disallowed: string[] };
};

export type ResolveRoleRequest = {
  roleTitle: string;
  industry?: string;
  orgMaturity?: string;
  orgLayer?: string;
  careerStage?: string;
  experienceYears?: number;
  workArrangement?: string;
  leadershipScope?: string;
};

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<RoleDNAEnvelope<T>> {
  try {
    const res = await fetch(`/api/v2/role-dna${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return { ok: false, error: json?.error ?? `http_${res.status}`,
               feature_flag: json?.feature_flag, methodology_versions: json?.methodology_versions };
    }
    return { ok: true, data: json as T,
             feature_flag: json?.feature_flag,
             methodology_versions: json?.methodology_versions,
             language_policy: json?.language_policy };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const roleDNAService = {
  flagState: () => call<{ feature_flag: RoleDNAFlagState }>('GET', '/feature-flag'),
  versions:  () => call<{ methodology_versions: Record<string, string> }>('GET', '/_meta/versions'),
  resolve:   (req: ResolveRoleRequest) => call<{ profile: unknown }>('POST', '/resolve', req),
  seed:      (roleId: string) => call<{ result: unknown }>('POST', `/seed/${encodeURIComponent(roleId)}`),
  cacheStats:() => call<{ stats: { size: number; max: number; ttl_ms: number } }>('GET', '/cache/stats'),
};
