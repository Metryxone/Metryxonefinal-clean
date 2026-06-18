/**
 * Feature Flag Service — Phase 1 S2
 *
 * Singleton in-memory cache backed by `feature_flags` +
 * `feature_flag_tenant_overrides` tables.
 *
 * Usage:
 *   import { initFeatureFlags, isEnabled } from './services/feature-flags';
 *   await initFeatureFlags(pool);     // once, at startup
 *   isEnabled('hypothesis_engine');    // synchronous thereafter
 */

import type { Pool } from 'pg';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  flag_key:    string;
  label:       string;
  description: string | null;
  enabled:     boolean;
  rollout_pct: number;
  phase:       string;
  created_at:  string;
  updated_at:  string;
}

export interface FlagTenantOverride {
  tenant_id: string;
  enabled:   boolean;
}

// ── Private State ─────────────────────────────────────────────────────────────

let _pool:      Pool | null                               = null;
let _flags:     Map<string, FeatureFlag>                  = new Map();
let _overrides: Map<string, Map<string, boolean>>         = new Map();
let _timer:     ReturnType<typeof setInterval> | null     = null;

// ── Hash helper for rollout_pct bucketing ─────────────────────────────────────

function bucketOf(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

// ── Cache loader ──────────────────────────────────────────────────────────────

async function loadCache(): Promise<void> {
  if (!_pool) return;
  try {
    const [{ rows: flags }, { rows: overrides }] = await Promise.all([
      _pool.query<FeatureFlag>('SELECT * FROM feature_flags ORDER BY phase, flag_key'),
      _pool.query<{ flag_key: string; tenant_id: string; enabled: boolean }>(
        'SELECT flag_key, tenant_id, enabled FROM feature_flag_tenant_overrides'
      ),
    ]);

    const newFlags     = new Map<string, FeatureFlag>();
    const newOverrides = new Map<string, Map<string, boolean>>();

    for (const f of flags)     newFlags.set(f.flag_key, f);
    for (const o of overrides) {
      if (!newOverrides.has(o.flag_key)) newOverrides.set(o.flag_key, new Map());
      newOverrides.get(o.flag_key)!.set(o.tenant_id, o.enabled);
    }

    _flags     = newFlags;
    _overrides = newOverrides;
  } catch (err) {
    console.error('[feature-flags] cache refresh error:', err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the feature-flag service. Call once at application startup.
 * Starts a background refresh timer (60 s).
 */
export async function initFeatureFlags(pool: Pool): Promise<void> {
  _pool = pool;
  await loadCache();
  if (_timer) clearInterval(_timer);
  _timer = setInterval(loadCache, 60_000);
  console.log(`[feature-flags] initialised — ${_flags.size} flags loaded`);
}

/**
 * Synchronous flag check. Safe to call anywhere after `initFeatureFlags`.
 *
 * Resolution order:
 *   1. Tenant override (if tenantId provided) — highest priority; can override
 *      the global toggle in either direction.
 *   2. Global `enabled` — master kill-switch. `false` short-circuits before the
 *      rollout check because rollout_pct is meaningless on a globally disabled flag.
 *      (The task spec wording "rollout_pct then global enabled" is interpreted here
 *      as: rollout_pct is only evaluated *within* the scope of a globally-enabled
 *      flag — otherwise the flag is unconditionally off.)
 *   3. Rollout percentage (deterministic hash, so the same flagKey+tenantId pair
 *      always resolves to the same bucket, enabling stable gradual rollout).
 */
export function isEnabled(flagKey: string, tenantId?: string): boolean {
  const flag = _flags.get(flagKey);
  if (!flag) return false;

  // 1. Tenant override
  if (tenantId) {
    const tenantMap = _overrides.get(flagKey);
    if (tenantMap?.has(tenantId)) return tenantMap.get(tenantId)!;
  }

  // 2. Global toggle
  if (!flag.enabled) return false;

  // 3. Rollout percentage
  if (flag.rollout_pct < 100) {
    const seed = tenantId ? `${flagKey}:${tenantId}` : flagKey;
    return bucketOf(seed) < flag.rollout_pct;
  }

  return true;
}

/**
 * Return all flags as an array (for admin list endpoint).
 */
export function getAllFlags(): FeatureFlag[] {
  return [..._flags.values()];
}

/**
 * Return per-tenant overrides for a flag (for admin detail).
 */
export function getFlagOverrides(flagKey: string): FlagTenantOverride[] {
  const tenantMap = _overrides.get(flagKey);
  if (!tenantMap) return [];
  return [...tenantMap.entries()].map(([tenant_id, enabled]) => ({ tenant_id, enabled }));
}

/**
 * Force-refresh the in-memory cache from the DB.
 * Called immediately after a PATCH to ensure the caller gets fresh data.
 */
export async function refreshFlagCache(): Promise<void> {
  return loadCache();
}

/**
 * Test-only helper — directly prime the in-memory flag + override maps without
 * a DB connection. Never call this in production code.
 * @internal
 */
export function _setTestCache(
  flags:     Array<Pick<FeatureFlag, 'flag_key' | 'enabled' | 'rollout_pct'>>,
  overrides: Array<{ flag_key: string; tenant_id: string; enabled: boolean }> = []
): void {
  _flags = new Map(flags.map(f => [
    f.flag_key,
    { label: '', description: null, phase: 'test', created_at: '', updated_at: '', ...f } as FeatureFlag,
  ]));
  _overrides = new Map();
  for (const o of overrides) {
    if (!_overrides.has(o.flag_key)) _overrides.set(o.flag_key, new Map());
    _overrides.get(o.flag_key)!.set(o.tenant_id, o.enabled);
  }
}
