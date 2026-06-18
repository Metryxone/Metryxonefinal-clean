/**
 * S8: Longitudinal Memory Engine Routes
 *
 * GET  /api/bios/longitudinal/:email
 *   Returns the current memory object for a user. Feature-flag gated.
 *
 * POST /api/bios/longitudinal/:email/rebuild
 *   Manually triggers a memory rebuild + upsert for a user.
 *
 * GET  /api/admin/bios/longitudinal/dashboard
 *   Aggregate stats: users with ≥2 sessions, drift distribution,
 *   top recurring constructs, burnout detection rate.
 *   Requires auth + super-admin. Feature-flag gated.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isEnabled }              from '../services/feature-flags';
import { buildAndPersistMemory }  from '../services/longitudinal-memory';

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

export function registerLongitudinalMemoryRoutes(
  app:               Express,
  pool:              Pool,
  requireAuth:       AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
): void {

  // Tables are created by migration 20260509_longitudinal_memory.sql.
  // No runtime DDL here to avoid schema drift with looser constraints.

  // ── GET /api/bios/longitudinal/:email ─────────────────────────────────────
  // Auth-protected: only super-admins may read another user's memory.
  app.get(
    '/api/bios/longitudinal/:email',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;
      if (!isEnabled('longitudinal_memory', tenantId)) {
        return res.json({ flag_active: false, memory: null });
      }

      try {
        const email = decodeURIComponent(String(req.params['email'])).toLowerCase().trim();
        if (!email) return res.status(400).json({ error: 'email required' });

        const { rows: [row] } = await pool.query<{
          memory:        Record<string, unknown>;
          session_count: number;
          first_seen:    string | null;
          last_seen:     string | null;
          updated_at:    string;
        }>(
          `SELECT memory, session_count, first_seen, last_seen, updated_at
           FROM longitudinal_patterns WHERE user_email = $1`,
          [email]
        );

        if (!row) {
          return res.json({ flag_active: true, memory: null, message: 'No memory built yet' });
        }

        return res.json({ flag_active: true, ...row });
      } catch (err) { return next(err); }
    }
  );

  // ── POST /api/bios/longitudinal/:email/rebuild ────────────────────────────
  app.post(
    '/api/bios/longitudinal/:email/rebuild',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;
      if (!isEnabled('longitudinal_memory', tenantId)) {
        return res.json({ flag_active: false, rebuilt: false });
      }

      try {
        const email = decodeURIComponent(String(req.params['email'])).toLowerCase().trim();
        if (!email) return res.status(400).json({ error: 'email required' });

        const memory = await buildAndPersistMemory(pool, email);
        return res.json({ flag_active: true, rebuilt: true, memory });
      } catch (err) { return next(err); }
    }
  );

  // ── GET /api/admin/bios/longitudinal/dashboard ────────────────────────────
  app.get(
    '/api/admin/bios/longitudinal/dashboard',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;
      if (!isEnabled('longitudinal_memory', tenantId)) {
        return res.json({
          flag_active:           false,
          users_with_memory:     0,
          users_multi_session:   0,
          drift_distribution:    { improving: 0, stable: 0, declining: 0 },
          top_recurring_constructs: [],
          burnout_detection_rate:   0,
          recovery_rate:            0,
          growth_rate:              0,
          recent_events:            [],
        });
      }

      try {
        const [
          kpiResult,
          driftResult,
          topConstructsResult,
          burnoutResult,
          recoveryResult,
          growthResult,
          recentEventsResult,
        ] = await Promise.all([

          // KPIs
          pool.query<{
            users_with_memory:   string;
            users_multi_session: string;
            avg_sessions:        string | null;
          }>(`
            SELECT
              COUNT(*)                                        AS users_with_memory,
              COUNT(*) FILTER (WHERE session_count >= 2)     AS users_multi_session,
              AVG(session_count)::numeric(5,2)               AS avg_sessions
            FROM longitudinal_patterns
          `),

          // Drift distribution from memory JSONB
          pool.query<{
            direction: string;
            count:     string;
          }>(`
            SELECT
              memory -> 'behavioural_drift' ->> 'direction' AS direction,
              COUNT(*)                                       AS count
            FROM longitudinal_patterns
            WHERE memory -> 'behavioural_drift' IS NOT NULL
            GROUP BY direction
          `),

          // Top recurring constructs
          pool.query<{
            construct_key: string;
            appearances:   string;
            avg_score:     string | null;
          }>(`
            SELECT
              construct_key,
              COUNT(*)                                AS appearances,
              AVG((description ~ '\\d+')::int)::text  AS avg_score
            FROM longitudinal_pattern_events
            WHERE event_type = 'recurring_construct'
              AND is_stale   = FALSE
              AND construct_key IS NOT NULL
            GROUP BY construct_key
            ORDER BY COUNT(*) DESC
            LIMIT 10
          `),

          // Burnout detection rate
          pool.query<{ burnout_users: string }>(`
            SELECT COUNT(DISTINCT user_email) AS burnout_users
            FROM longitudinal_pattern_events
            WHERE event_type = 'burnout_period' AND is_stale = FALSE
          `),

          // Recovery rate
          pool.query<{ recovery_users: string }>(`
            SELECT COUNT(DISTINCT user_email) AS recovery_users
            FROM longitudinal_pattern_events
            WHERE event_type = 'resilience_recovery' AND is_stale = FALSE
          `),

          // Growth rate
          pool.query<{ growth_users: string }>(`
            SELECT COUNT(DISTINCT user_email) AS growth_users
            FROM longitudinal_pattern_events
            WHERE event_type = 'growth_pattern' AND is_stale = FALSE
          `),

          // Recent events
          pool.query<{
            user_email:       string;
            event_type:       string;
            construct_key:    string | null;
            severity:         string;
            description:      string;
            detected_at:      string;
          }>(`
            SELECT user_email, event_type, construct_key, severity, description, detected_at
            FROM longitudinal_pattern_events
            WHERE is_stale = FALSE
            ORDER BY detected_at DESC
            LIMIT 20
          `),
        ]);

        const kpi              = kpiResult.rows[0];
        const totalWithMemory  = parseInt(kpi.users_with_memory,   10) || 0;
        const burnoutUsers     = parseInt(burnoutResult.rows[0]?.burnout_users   ?? '0', 10);
        const recoveryUsers    = parseInt(recoveryResult.rows[0]?.recovery_users ?? '0', 10);
        const growthUsers      = parseInt(growthResult.rows[0]?.growth_users     ?? '0', 10);

        const driftDist = { improving: 0, stable: 0, declining: 0 };
        for (const row of driftResult.rows) {
          const dir = row.direction as keyof typeof driftDist;
          if (dir in driftDist) driftDist[dir] = parseInt(row.count, 10);
        }

        return res.json({
          flag_active:              true,
          users_with_memory:        totalWithMemory,
          users_multi_session:      parseInt(kpi.users_multi_session, 10) || 0,
          avg_sessions:             parseFloat(kpi.avg_sessions ?? '0'),
          drift_distribution:       driftDist,
          top_recurring_constructs: topConstructsResult.rows.map(r => ({
            construct_key: r.construct_key,
            appearances:   parseInt(r.appearances, 10),
          })),
          burnout_detection_rate:
            totalWithMemory > 0 ? Math.round((burnoutUsers  / totalWithMemory) * 100) : 0,
          recovery_rate:
            totalWithMemory > 0 ? Math.round((recoveryUsers / totalWithMemory) * 100) : 0,
          growth_rate:
            totalWithMemory > 0 ? Math.round((growthUsers   / totalWithMemory) * 100) : 0,
          recent_events: recentEventsResult.rows,
        });
      } catch (err) { return next(err); }
    }
  );
}
