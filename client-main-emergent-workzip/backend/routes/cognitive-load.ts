/**
 * Cognitive Load Engine Routes — Phase 1 S6
 *
 * GET  /api/bios/cognitive-load/:sessionId
 *   Returns the latest load snapshot for a session (or computes on-the-fly
 *   if no snapshot exists yet). Flag-gated; returns continue_normal when off.
 *
 * GET  /api/admin/bios/cognitive-load/dashboard
 *   Aggregate stats: avg composite load per stage, high-load session count,
 *   top disengagement question indices, action distribution. Requires auth +
 *   super-admin. Flag-gated; returns zeros when off.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnabled }   from '../services/feature-flags';
import { computeLoad } from '../services/cognitive-load';

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

export function registerCognitiveLoadRoutes(
  app:               Express,
  pool:              Pool,
  requireAuth:       AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
): void {

  // ── GET /api/admin/bios/cognitive-load/dashboard ──────────────────────────
  // Registered before the parameterised session route to avoid Express routing
  // "dashboard" as a :sessionId value.
  app.get(
    '/api/admin/bios/cognitive-load/dashboard',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      if (!isEnabled('cognitive_load_engine', tenantId)) {
        return res.json({
          flag_active:         false,
          avg_composite_load:  0,
          high_load_sessions:  0,
          total_sessions:      0,
          action_distribution: {},
          top_disengagement_points: [],
          avg_load_by_stage:   [],
        });
      }

      try {
        // ── KPI aggregates ─────────────────────────────────────────────────
        const kpiResult = await pool.query<{
          total_snapshots:    string;
          total_sessions:     string;
          avg_composite:      string | null;
          high_load_sessions: string;
        }>(`
          SELECT
            COUNT(*)                                                          AS total_snapshots,
            COUNT(DISTINCT session_id)                                        AS total_sessions,
            AVG(composite_load)::numeric(6,4)                                 AS avg_composite,
            COUNT(DISTINCT session_id) FILTER (WHERE composite_load >= 0.65)  AS high_load_sessions
          FROM cognitive_load_snapshots
        `);

        // ── Action distribution ────────────────────────────────────────────
        const actionResult = await pool.query<{ recommended_action: string; cnt: string }>(`
          SELECT recommended_action, COUNT(*) AS cnt
          FROM cognitive_load_snapshots
          GROUP BY recommended_action
          ORDER BY cnt DESC
        `);

        // ── Top disengagement points: question indices that most often precede
        //    session drop-off / abandonment.
        //    A "drop-off point" is the highest question_index in the snapshot
        //    table for sessions that were never completed (status != 'completed').
        //    Sessions abandoned earlier are weighted equally; the result is
        //    ranked by how many sessions stopped at that index.
        const disengageResult = await pool.query<{
          question_index:    number;
          dropped_sessions:  string;
          avg_disengagement: string;
        }>(`
          SELECT
            last_snap.question_index,
            COUNT(DISTINCT cs.id)::text                            AS dropped_sessions,
            AVG(cls.disengagement_score)::numeric(6,4)::text       AS avg_disengagement
          FROM capadex_sessions cs
          JOIN LATERAL (
            SELECT question_index
            FROM cognitive_load_snapshots
            WHERE session_id = cs.id::text
            ORDER BY question_index DESC
            LIMIT 1
          ) last_snap ON TRUE
          JOIN cognitive_load_snapshots cls
            ON cls.session_id = cs.id::text
           AND cls.question_index = last_snap.question_index
          WHERE cs.status IS DISTINCT FROM 'completed'
          GROUP BY last_snap.question_index
          ORDER BY dropped_sessions DESC
          LIMIT 10
        `);

        // ── Average load by stage (joined to capadex_sessions) ─────────────
        const stageResult = await pool.query<{
          stage_code: string;
          avg_composite: string;
          avg_fatigue: string;
          session_count: string;
        }>(`
          SELECT
            cs.stage_code,
            AVG(cls.composite_load)::numeric(6,4)  AS avg_composite,
            AVG(cls.fatigue_score)::numeric(6,4)   AS avg_fatigue,
            COUNT(DISTINCT cs.id)                  AS session_count
          FROM cognitive_load_snapshots cls
          JOIN capadex_sessions cs ON cs.id::text = cls.session_id
          GROUP BY cs.stage_code
          ORDER BY cs.stage_code
        `);

        const kpi = kpiResult.rows[0];
        const actionDist: Record<string, number> = {};
        for (const row of actionResult.rows) {
          actionDist[row.recommended_action] = parseInt(row.cnt, 10);
        }

        return res.json({
          flag_active:         true,
          total_snapshots:     parseInt(kpi.total_snapshots,    10),
          total_sessions:      parseInt(kpi.total_sessions,     10),
          avg_composite_load:  Number(kpi.avg_composite ?? 0),
          high_load_sessions:  parseInt(kpi.high_load_sessions, 10),
          action_distribution: actionDist,
          top_disengagement_points: disengageResult.rows.map(r => ({
            question_index:    r.question_index,
            dropped_sessions:  parseInt(r.dropped_sessions, 10),
            avg_disengagement: Number(r.avg_disengagement),
          })),
          avg_load_by_stage: stageResult.rows.map(r => ({
            stage_code:    r.stage_code,
            avg_composite: Number(r.avg_composite),
            avg_fatigue:   Number(r.avg_fatigue),
            session_count: parseInt(r.session_count, 10),
          })),
        });
      } catch (err) {
        console.error('[cognitive-load] dashboard error:', err);
        return res.status(500).json({ error: 'Failed to retrieve cognitive load dashboard' });
      }
    }
  );

  // ── GET /api/bios/cognitive-load/:sessionId ───────────────────────────────
  // Returns the latest snapshot for the session. If no snapshot exists yet
  // (engine just enabled or session is brand-new), computes on the fly without
  // writing to the DB so the response is always non-null.
  app.get(
    '/api/bios/cognitive-load/:sessionId',
    async (req: Request, res: Response) => {
      const sessionId = String(req.params.sessionId);
      const tenantId  = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      if (!isEnabled('cognitive_load_engine', tenantId)) {
        return res.json({
          session_id:         sessionId,
          flag_active:        false,
          fatigue_score:      0,
          overload_score:     0,
          hesitation_score:   0,
          disengagement_score: 0,
          composite_load:     0,
          recommended_action: 'continue_normal',
          avg_response_ms:    0,
          question_index:     0,
          snapshot_at:        null,
        });
      }

      try {
        // Try the latest persisted snapshot first
        const { rows: [snapshot] } = await pool.query<{
          question_index:      number;
          fatigue_score:       string;
          overload_score:      string;
          hesitation_score:    string;
          disengagement_score: string;
          composite_load:      string;
          recommended_action:  string;
          created_at:          string;
        }>(
          `SELECT question_index,
                  fatigue_score, overload_score, hesitation_score,
                  disengagement_score, composite_load, recommended_action,
                  created_at
           FROM cognitive_load_snapshots
           WHERE session_id = $1
           ORDER BY question_index DESC
           LIMIT 1`,
          [sessionId]
        );

        if (snapshot) {
          return res.json({
            session_id:          sessionId,
            flag_active:         true,
            question_index:      snapshot.question_index,
            fatigue_score:       Number(snapshot.fatigue_score),
            overload_score:      Number(snapshot.overload_score),
            hesitation_score:    Number(snapshot.hesitation_score),
            disengagement_score: Number(snapshot.disengagement_score),
            composite_load:      Number(snapshot.composite_load),
            recommended_action:  snapshot.recommended_action,
            avg_response_ms:     0,
            snapshot_at:         snapshot.created_at,
          });
        }

        // No snapshot yet — compute live (not persisted)
        const liveResult = await computeLoad(pool, sessionId, tenantId);
        return res.json({
          session_id:          sessionId,
          flag_active:         true,
          snapshot_at:         null,
          ...liveResult,
        });
      } catch (err) {
        console.error('[cognitive-load] session load error:', err);
        return res.status(500).json({ error: 'Failed to retrieve cognitive load' });
      }
    }
  );
}
