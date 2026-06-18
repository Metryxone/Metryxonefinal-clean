/**
 * Role DNA Cache Engine — Phase 2.
 *
 * In-memory TTL + LRU-ish cache keyed by `${roleId}::${ctxHash}`. Memory only,
 * process-local. Safe invalidation on event-bus signals. NEVER persists.
 */
import { ADAPTIVE_EVENTS, on } from './adaptive-event-bus';

export const ROLE_DNA_CACHE_VERSION = '1.0.0';

type Entry<T> = { value: T; expiresAt: number };

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 256;
const store = new Map<string, Entry<any>>();

export function makeKey(roleId: string, contextKey: string): string {
  return `${roleId}::${contextKey}`;
}

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) { store.delete(key); return undefined; }
  // refresh LRU ordering
  store.delete(key); store.set(key, e);
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value as string | undefined;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheInvalidateByRole(roleId: string): number {
  let n = 0;
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(`${roleId}::`)) { store.delete(k); n++; }
  }
  return n;
}

export function cacheClear(): void { store.clear(); }

export function cacheStats() {
  return { size: store.size, max: MAX_ENTRIES, ttl_ms: TTL_MS };
}

let initialised = false;
export function initRoleDNACache(): void {
  if (initialised) return;
  initialised = true;
  on(ADAPTIVE_EVENTS.ROLE_CONTEXT_UPDATED, (e) => {
    const roleId = (e.payload as any)?.role_id;
    if (typeof roleId === 'string') cacheInvalidateByRole(roleId);
  });
  on(ADAPTIVE_EVENTS.ROLE_COMPETENCIES_SEEDED, (e) => {
    const roleId = (e.payload as any)?.role_id;
    if (typeof roleId === 'string') cacheInvalidateByRole(roleId);
  });
}
