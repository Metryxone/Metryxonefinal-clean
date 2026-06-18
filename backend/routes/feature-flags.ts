/**
 * Feature Flag Admin Routes — Phase 1 S2
 *
 * GET  /api/admin/feature-flags             — list all flags with overrides
 * GET  /api/admin/feature-flags/ws-status   — live WS session count + flag state
 * PATCH /api/admin/feature-flags/:key       — toggle, set rollout_pct, or upsert/remove tenant override
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { getAllFlags, getFlagOverrides, refreshFlagCache, isEnabled } from '../services/feature-flags';
import { getActiveSessionCount } from '../services/ws-broadcast';

interface FlagRow {
  flag_key:    string;
  label:       string;
  description: string | null;
  enabled:     boolean;
  rollout_pct: number;
  phase:       string;
  created_at:  string;
  updated_at:  string;
}

/**
 * Parse a boolean from a PATCH body field.
 * Returns the boolean value, or null if the value is missing/null/undefined,
 * or throws a TypeError if the value cannot safely be interpreted as boolean
 * (e.g. the string "false" would coerce to true via Boolean(), so we reject it).
 */
function parseStrictBool(val: unknown, fieldName: string): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val;
  if (val === 0) return false;
  if (val === 1) return true;
  throw new TypeError(
    `"${fieldName}" must be a boolean (true/false), received ${typeof val} ${JSON.stringify(val)}`
  );
}

export function registerFeatureFlagRoutes(
  app:               Express,
  pool:              Pool,
  requireAuth:       (req: Request, res: Response, next: () => void) => void,
  requireSuperAdmin: (req: Request, res: Response, next: () => void) => void
): void {

  // ── GET /api/admin/feature-flags/ws-status ───────────────────────────────
  // Returns the current websocket_runtime flag state and the number of
  // in-flight sessions with at least one active WS client.
  app.get('/api/admin/feature-flags/ws-status', requireAuth, requireSuperAdmin,
    (_req: Request, res: Response) => {
      return res.json({
        enabled:         isEnabled('websocket_runtime'),
        active_sessions: getActiveSessionCount(),
      });
    }
  );

  // ── GET /api/admin/feature-flags ─────────────────────────────────────────
  app.get('/api/admin/feature-flags', requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        const flags = getAllFlags().map(f => ({
          ...f,
          overrides: getFlagOverrides(f.flag_key),
        }));
        return res.json({ flags });
      } catch (err) {
        console.error('[feature-flags] GET list error:', err);
        return res.status(500).json({ error: 'Failed to retrieve feature flags' });
      }
    }
  );

  // ── PATCH /api/admin/feature-flags/:key ──────────────────────────────────
  app.patch('/api/admin/feature-flags/:key', requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const flagKey = String(req.params.key);
      const { enabled, rollout_pct, tenant_id, tenant_enabled } = req.body ?? {};

      // Strict boolean validation — reject non-boolean types up-front to prevent
      // Boolean("false") === true style coercion bugs.
      let enabledBool:       boolean | null;
      let tenantEnabledBool: boolean | null;
      try {
        enabledBool       = parseStrictBool(enabled,        'enabled');
        tenantEnabledBool = parseStrictBool(tenant_enabled, 'tenant_enabled');
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }

      try {
        // Verify flag exists
        const { rows: existing } = await pool.query<FlagRow>(
          'SELECT flag_key FROM feature_flags WHERE flag_key = $1',
          [flagKey]
        );
        if (existing.length === 0) {
          return res.status(404).json({ error: `Feature flag '${flagKey}' not found` });
        }

        // ── Tenant override ──────────────────────────────────────────────────
        if (tenant_id !== undefined && typeof tenant_id === 'string' && tenant_id.trim()) {
          if (tenantEnabledBool === null) {
            // Remove override
            await pool.query(
              'DELETE FROM feature_flag_tenant_overrides WHERE flag_key = $1 AND tenant_id = $2',
              [flagKey, tenant_id.trim()]
            );
          } else {
            // Upsert override (tenantEnabledBool is a proper boolean — no coercion risk)
            await pool.query(`
              INSERT INTO feature_flag_tenant_overrides (flag_key, tenant_id, enabled)
              VALUES ($1, $2, $3)
              ON CONFLICT (flag_key, tenant_id) DO UPDATE SET enabled = EXCLUDED.enabled
            `, [flagKey, tenant_id.trim(), tenantEnabledBool]);
          }
        }

        // ── Global flag fields ───────────────────────────────────────────────
        const setClauses: string[] = ['updated_at = now()'];
        const params: unknown[]    = [];

        if (enabledBool !== null) {
          params.push(enabledBool);
          setClauses.push(`enabled = $${params.length}`);
        }
        if (rollout_pct !== undefined) {
          const pct = Math.max(0, Math.min(100, parseInt(String(rollout_pct), 10)));
          if (!isNaN(pct)) {
            params.push(pct);
            setClauses.push(`rollout_pct = $${params.length}`);
          }
        }

        if (params.length > 0) {
          params.push(flagKey);
          await pool.query(
            `UPDATE feature_flags SET ${setClauses.join(', ')} WHERE flag_key = $${params.length}`,
            params
          );
        }

        // Refresh in-memory cache immediately
        await refreshFlagCache();

        // Return the freshly-updated flag
        const { rows: updated } = await pool.query<FlagRow>(
          'SELECT * FROM feature_flags WHERE flag_key = $1',
          [flagKey]
        );
        return res.json({
          flag: { ...updated[0], overrides: getFlagOverrides(flagKey) },
        });
      } catch (err) {
        console.error('[feature-flags] PATCH error:', err);
        return res.status(500).json({ error: 'Failed to update feature flag' });
      }
    }
  );
}
