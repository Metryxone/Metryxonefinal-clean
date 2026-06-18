/**
 * Adaptive Intelligence Events — frontend pub/sub helper.
 * Backed by window CustomEvent. Modules can subscribe to refresh their
 * own caches when the orchestrator broadcasts updates.
 */

export const ADAPTIVE_EVENT_NAMES = {
  ASSESSMENT_COMPLETED: 'adaptive:assessment.completed',
  PROFILE_UPDATED:      'adaptive:profile.updated',
  BENCHMARK_UPDATED:    'adaptive:benchmark.updated',
  MOBILITY_UPDATED:     'adaptive:mobility.updated',
  TRAJECTORY_UPDATED:   'adaptive:trajectory.updated',
  COACHING_UPDATED:     'adaptive:coaching.updated',
  WORKFORCE_UPDATED:    'adaptive:workforce.updated',
  SIMULATION_UPDATED:   'adaptive:simulation.updated',
} as const;

export type AdaptiveEventName = (typeof ADAPTIVE_EVENT_NAMES)[keyof typeof ADAPTIVE_EVENT_NAMES];

export type AdaptiveEventDetail<T = unknown> = {
  correlationId?: string;
  userId?: number;
  payload?: T;
};

export function emitAdaptive<T>(name: AdaptiveEventName, detail: AdaptiveEventDetail<T> = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function onAdaptive<T>(name: AdaptiveEventName, handler: (detail: AdaptiveEventDetail<T>) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const wrapped = (e: Event) => handler((e as CustomEvent<AdaptiveEventDetail<T>>).detail ?? {});
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}

/**
 * Run orchestration server-side, then broadcast a profile-updated event
 * so subscribed React components can refetch their slices.
 */
export async function runOrchestration(args: { userId?: number; assessmentId?: string; tenantId?: number }): Promise<{
  ok: boolean;
  correlation_id?: string;
  status?: string;
  duration_ms?: number;
}> {
  try {
    const r = await fetch('/api/v2/orchestration/run', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args),
    });
    if (!r.ok) return { ok: false };
    const j = await r.json() as { ok: boolean; outcome?: { correlation_id: string; status: string; duration_ms: number } };
    if (j.outcome) {
      emitAdaptive(ADAPTIVE_EVENT_NAMES.ASSESSMENT_COMPLETED, { correlationId: j.outcome.correlation_id, userId: args.userId });
      emitAdaptive(ADAPTIVE_EVENT_NAMES.PROFILE_UPDATED,      { correlationId: j.outcome.correlation_id, userId: args.userId });
    }
    return { ok: !!j.ok, correlation_id: j.outcome?.correlation_id, status: j.outcome?.status, duration_ms: j.outcome?.duration_ms };
  } catch {
    return { ok: false };
  }
}

export async function fetchProfile(userId: number): Promise<unknown | null> {
  try {
    const r = await fetch(`/api/v2/orchestration/profile/${userId}`, { credentials: 'include' });
    if (!r.ok) return null;
    const j = await r.json() as { profile?: unknown };
    return j.profile ?? null;
  } catch {
    return null;
  }
}
