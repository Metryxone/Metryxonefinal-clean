/**
 * Conversational Quality Engine Routes — Phase 2 S11
 *
 * POST /api/bios/quality/evaluate/:sessionId
 *   Trigger an on-demand quality evaluation for a session.
 *
 * GET  /api/bios/quality/:sessionId
 *   Latest quality snapshot for a session.
 *
 * GET  /api/bios/quality/:sessionId/history
 *   Ordered quality evolution (one row per evaluation, newest first).
 *
 * GET  /api/admin/quality/dashboard
 *   Aggregate KPIs: avg quality, safety index, adaptation quality,
 *   sessions with active directives, directive frequency breakdown,
 *   quality distribution buckets, worst sessions.
 *
 * GET  /api/admin/quality/sessions
 *   Paginated per-session quality list with filters.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnabled }       from '../services/feature-flags';
import { evaluateQuality } from '../services/conversational-quality';

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

/** Safely extract a single-value string from an Express header (which may be string | string[]). */
function headerStr(h: string | string[] | undefined): string {
  if (Array.isArray(h)) return h[0] ?? '';
  return h ?? '';
}

export function registerConversationalQualityRoutes(
  app:               Express,
  pool:              Pool,
  requireAuth:       AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
): void {

  // ── POST /api/bios/quality/evaluate/:sessionId ────────────────────────────
  app.post('/api/bios/quality/evaluate/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const tenantId = headerStr(req.headers['x-tenant-id']).trim() || undefined;
    try {
      const result = await evaluateQuality(pool, String(sessionId), tenantId);
      res.json({ ok: true, quality: result });
    } catch (err) {
      console.error('[quality] evaluate error:', err);
      res.status(500).json({ error: 'Quality evaluation failed' });
    }
  });

  // ── GET /api/bios/quality/:sessionId ─────────────────────────────────────
  // Register admin dashboard before the parameterised routes to prevent
  // Express interpreting "dashboard" as a sessionId.
  app.get('/api/admin/quality/dashboard', requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const tenantId = headerStr(req.headers['x-tenant-id']).trim() || undefined;
      const flagActive = isEnabled('conversational_quality', tenantId);

      const empty = {
        flag_active: false,
        total_sessions: 0, avg_quality: 0, avg_safety: 0,
        avg_adaptation: 0, sessions_with_directives: 0,
        directive_frequency: {}, quality_distribution: [],
        worst_sessions: [], quality_trend: [],
      };

      if (!flagActive) return res.json(empty);

      try {
        const [kpi, dirFreq, dist, worst, trend] = await Promise.all([
          // KPIs
          pool.query<{
            total_sessions: string;
            avg_quality:    string | null;
            avg_safety:     string | null;
            avg_adaptation: string | null;
            with_directives: string;
          }>(`
            SELECT
              COUNT(DISTINCT session_id)                                  AS total_sessions,
              AVG(overall_quality_score)::numeric(5,2)                    AS avg_quality,
              AVG(emotional_safety_score)::numeric(5,2)                   AS avg_safety,
              AVG(adaptation_quality)::numeric(5,2)                       AS avg_adaptation,
              COUNT(DISTINCT session_id) FILTER (WHERE directive_count>0) AS with_directives
            FROM conversational_quality_snapshots
          `),
          // Directive frequency: explode the JSONB array
          pool.query<{ directive: string; cnt: string }>(`
            SELECT
              d.directive,
              COUNT(*) AS cnt
            FROM conversational_quality_snapshots cqs,
                 jsonb_array_elements_text(cqs.active_directives) AS d(directive)
            WHERE cqs.directive_count > 0
            GROUP BY d.directive
            ORDER BY cnt DESC
          `),
          // Quality distribution buckets (0-20, 21-40, 41-60, 61-80, 81-100)
          pool.query<{ bucket: string; cnt: string }>(`
            SELECT
              CASE
                WHEN overall_quality_score <= 20 THEN '0-20'
                WHEN overall_quality_score <= 40 THEN '21-40'
                WHEN overall_quality_score <= 60 THEN '41-60'
                WHEN overall_quality_score <= 80 THEN '61-80'
                ELSE '81-100'
              END AS bucket,
              COUNT(DISTINCT session_id) AS cnt
            FROM conversational_quality_snapshots
            GROUP BY bucket
            ORDER BY bucket
          `),
          // Worst 10 sessions (lowest avg quality with active directives)
          pool.query<{
            session_id: string;
            avg_quality:     string;
            avg_safety:      string;
            avg_adaptation:  string;
            directive_count: string;
            last_directives: any;
            snapshot_count:  string;
          }>(`
            SELECT
              session_id,
              AVG(overall_quality_score)::numeric(5,2) AS avg_quality,
              AVG(emotional_safety_score)::numeric(5,2) AS avg_safety,
              AVG(adaptation_quality)::numeric(5,2)    AS avg_adaptation,
              MAX(directive_count)                      AS directive_count,
              (SELECT active_directives FROM conversational_quality_snapshots cqs2
               WHERE cqs2.session_id = cqs.session_id
               ORDER BY created_at DESC LIMIT 1)        AS last_directives,
              COUNT(*)                                  AS snapshot_count
            FROM conversational_quality_snapshots cqs
            GROUP BY session_id
            ORDER BY avg_quality ASC
            LIMIT 10
          `),
          // 7-day quality trend (daily avg)
          pool.query<{ day: string; avg_quality: string; avg_safety: string; session_count: string }>(`
            SELECT
              DATE_TRUNC('day', created_at)::date::text AS day,
              AVG(overall_quality_score)::numeric(5,2)  AS avg_quality,
              AVG(emotional_safety_score)::numeric(5,2) AS avg_safety,
              COUNT(DISTINCT session_id)                AS session_count
            FROM conversational_quality_snapshots
            WHERE created_at >= now() - INTERVAL '7 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY day ASC
          `),
        ]);

        const k = kpi.rows[0];
        const directiveFreq: Record<string, number> = {};
        for (const r of dirFreq.rows) directiveFreq[r.directive] = parseInt(r.cnt, 10);

        res.json({
          flag_active:             true,
          total_sessions:          parseInt(k.total_sessions, 10),
          avg_quality:             parseFloat(k.avg_quality  ?? '0'),
          avg_safety:              parseFloat(k.avg_safety   ?? '0'),
          avg_adaptation:          parseFloat(k.avg_adaptation ?? '0'),
          sessions_with_directives: parseInt(k.with_directives, 10),
          directive_frequency:     directiveFreq,
          quality_distribution:    dist.rows.map(r => ({ bucket: r.bucket, count: parseInt(r.cnt, 10) })),
          worst_sessions:          worst.rows.map(r => ({
            session_id:     r.session_id,
            avg_quality:    parseFloat(r.avg_quality),
            avg_safety:     parseFloat(r.avg_safety),
            avg_adaptation: parseFloat(r.avg_adaptation),
            directive_count: parseInt(r.directive_count, 10),
            last_directives: r.last_directives ?? [],
            snapshot_count:  parseInt(r.snapshot_count, 10),
          })),
          quality_trend: trend.rows.map(r => ({
            day:           r.day,
            avg_quality:   parseFloat(r.avg_quality),
            avg_safety:    parseFloat(r.avg_safety),
            session_count: parseInt(r.session_count, 10),
          })),
        });
      } catch (err) {
        console.error('[quality] dashboard error:', err);
        res.status(500).json({ error: 'Quality dashboard failed' });
      }
    },
  );

  // ── GET /api/admin/quality/sessions ──────────────────────────────────────
  app.get('/api/admin/quality/sessions', requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const page     = Math.max(1, parseInt(String(req.query.page  ?? '1'), 10));
      const limit    = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
      const offset   = (page - 1) * limit;
      const onlyRisk = req.query.only_risk === 'true';

      try {
        const where = onlyRisk ? 'WHERE directive_count > 0' : '';
        const { rows: total } = await pool.query<{ n: string }>(
          `SELECT COUNT(DISTINCT session_id) AS n FROM conversational_quality_snapshots ${where}`,
        );

        const { rows } = await pool.query<{
          session_id:      string;
          avg_quality:     string;
          avg_safety:      string;
          avg_adaptation:  string;
          avg_orchestration: string;
          max_directives:  string;
          last_directives: any;
          snapshot_count:  string;
          last_evaluated:  string;
        }>(`
          SELECT
            session_id,
            AVG(overall_quality_score)::numeric(5,2)     AS avg_quality,
            AVG(emotional_safety_score)::numeric(5,2)    AS avg_safety,
            AVG(adaptation_quality)::numeric(5,2)        AS avg_adaptation,
            AVG(orchestration_quality)::numeric(5,2)     AS avg_orchestration,
            MAX(directive_count)                         AS max_directives,
            (SELECT active_directives FROM conversational_quality_snapshots cqs2
             WHERE cqs2.session_id = cqs.session_id
             ORDER BY created_at DESC LIMIT 1)            AS last_directives,
            COUNT(*) AS snapshot_count,
            MAX(created_at) AS last_evaluated
          FROM conversational_quality_snapshots cqs
          ${where}
          GROUP BY session_id
          ORDER BY avg_quality ASC
          LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json({
          sessions: rows.map(r => ({
            session_id:       r.session_id,
            avg_quality:      parseFloat(r.avg_quality),
            avg_safety:       parseFloat(r.avg_safety),
            avg_adaptation:   parseFloat(r.avg_adaptation),
            avg_orchestration: parseFloat(r.avg_orchestration),
            max_directives:   parseInt(r.max_directives, 10),
            last_directives:  r.last_directives ?? [],
            snapshot_count:   parseInt(r.snapshot_count, 10),
            last_evaluated:   r.last_evaluated,
          })),
          total: parseInt(total[0]?.n ?? '0', 10),
          page,
          limit,
        });
      } catch (err) {
        console.error('[quality] sessions error:', err);
        res.status(500).json({ error: 'Quality sessions query failed' });
      }
    },
  );

  // ── GET /api/bios/quality/:sessionId ─────────────────────────────────────
  app.get('/api/bios/quality/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT * FROM conversational_quality_snapshots
         WHERE session_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [sessionId],
      );
      if (rows.length === 0) return res.status(404).json({ error: 'No quality snapshot found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('[quality] latest error:', err);
      res.status(500).json({ error: 'Failed to fetch quality snapshot' });
    }
  });

  // ── GET /api/bios/quality/:sessionId/history ──────────────────────────────
  app.get('/api/bios/quality/:sessionId/history', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
    try {
      const { rows } = await pool.query(
        `SELECT id, session_id, overall_quality_score, emotional_safety_score,
                adaptation_quality, orchestration_quality, active_directives,
                directive_count, question_count, created_at
         FROM conversational_quality_snapshots
         WHERE session_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [sessionId, limit],
      );
      res.json({ history: rows.reverse(), count: rows.length });
    } catch (err) {
      console.error('[quality] history error:', err);
      res.status(500).json({ error: 'Failed to fetch quality history' });
    }
  });
}
