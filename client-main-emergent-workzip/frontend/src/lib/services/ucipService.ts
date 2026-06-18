/**
 * UCIP client service — Phase 1.
 *
 * Read-only client wrapper around /api/v2/ucip/*. Shadow-mode safe: every
 * call gracefully degrades if any flag is OFF (returns { ok:false } envelope).
 * NEVER throws to callers — every error becomes a structured envelope.
 */

export type UcipFlagState = {
  adaptiveIntelligenceFoundation: boolean;
  ucipEnabled: boolean;
  ucipShadowMode: boolean;
};

export type UcipEnvelope<T> = {
  ok: boolean;
  error?: string;
  data?: T;
  feature_flag?: UcipFlagState;
  methodology_versions?: Record<string, string>;
  language_policy?: { allowed: string[]; disallowed: string[] };
};

async function call<T>(method: 'GET' | 'POST', path: string): Promise<UcipEnvelope<T>> {
  try {
    const res = await fetch(`/api/v2/ucip${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return {
        ok: false,
        error: body?.error ?? `http_${res.status}`,
        feature_flag: body?.feature_flag,
        methodology_versions: body?.methodology_versions,
      };
    }
    return {
      ok: true,
      data: body as T,
      feature_flag: body?.feature_flag,
      methodology_versions: body?.methodology_versions,
      language_policy: body?.language_policy,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const ucipService = {
  flagState: () => call<{ feature_flag: UcipFlagState }>('GET', '/feature-flag'),
  versions:  () => call<{ methodology_versions: Record<string, string> }>('GET', '/_meta/versions'),
  fetch:     (userId: string) => call<{ profile: unknown }>('GET', `/${encodeURIComponent(userId)}`),
  rebuild:   (userId: string) => call<{ outcome: unknown }>('POST', `/rebuild/${encodeURIComponent(userId)}`),
  status:    (userId: string) => call<{ status: { latest: unknown; logs: unknown[] } }>('GET', `/status/${encodeURIComponent(userId)}`),
};
