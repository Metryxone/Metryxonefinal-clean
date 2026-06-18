/**
 * Contradiction Intelligence Engine Routes — Phase 1 S5
 *
 * All /api/admin/bios/contradictions* routes require authentication and
 * super-admin privileges — consistent with other admin-only surfaces.
 *
 * GET   /api/admin/bios/contradictions         — paginated list (filterable)
 * GET   /api/admin/bios/contradictions/stats   — aggregate KPI counts
 * PATCH /api/admin/bios/contradictions/:id/resolve — resolve one event
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnabled } from '../services/feature-flags';

type AuthMiddleware = (req: Request, res: Response, next: () => void) => void;

const VALID_TYPES = [
  'score_reversal',
  'emotional_masking',
  'self_perception_bias',
  'defensive_answering',
] as const;

const VALID_SEVERITIES = ['low', 'medium', 'high'] as const;

export function registerContradictionEngineRoutes(
  app:               Express,
  pool:              Pool,
  requireAuth:       AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
): void {

  // ── GET /api/admin/bios/contradictions/stats ───────────────────────────────
  // Registered before the parameterised list route so Express routes it first.
  // Query params: none
  app.get(
    '/api/admin/bios/contradictions/stats',
    requireAuth,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        const { rows } = await pool.query(`
          SELECT
            COUNT(*)::int                                                        AS total,
            COUNT(*) FILTER (WHERE resolved = FALSE)::int                        AS unresolved,
            COUNT(*) FILTER (WHERE severity = 'high')::int                       AS high_severity,
            COUNT(*) FILTER (WHERE contradiction_type = 'score_reversal')::int        AS score_reversal,
            COUNT(*) FILTER (WHERE contradiction_type = 'emotional_masking')::int     AS emotional_masking,
            COUNT(*) FILTER (WHERE contradiction_type = 'self_perception_bias')::int  AS self_perception_bias,
            COUNT(*) FILTER (WHERE contradiction_type = 'defensive_answering')::int   AS defensive_answering,
            COUNT(DISTINCT session_id)::int                                      AS affected_sessions
          FROM contradiction_events
        `);
        return res.json(rows[0] ?? {});
      } catch (err) {
        console.error('[contradiction-engine] stats error:', err);
        return res.status(500).json({ error: 'Failed to retrieve contradiction stats' });
      }
    }
  );

  // ── GET /api/admin/bios/contradictions ─────────────────────────────────────
  // Query params:
  //   page       — 1-based page number (default 1)
  //   limit      — items per page, max 100 (default 20)
  //   session_id — filter to a specific session
  //   type       — filter by contradiction_type
  //   severity   — filter by severity
  //   resolved   — 'true' | 'false' | omitted (all)
  app.get(
    '/api/admin/bios/contradictions',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

      const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
      const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const offset = (page - 1) * limit;

      const sessionId   = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : null;
      const typeFilter  = typeof req.query.type       === 'string' ? req.query.type.trim()       : null;
      const sevFilter   = typeof req.query.severity   === 'string' ? req.query.severity.trim()   : null;
      const resolvedRaw = typeof req.query.resolved   === 'string' ? req.query.resolved.trim()   : null;

      if (typeFilter && !VALID_TYPES.includes(typeFilter as typeof VALID_TYPES[number])) {
        return res.status(400).json({
          error: `type must be one of: ${VALID_TYPES.join(', ')}`,
        });
      }
      if (sevFilter && !VALID_SEVERITIES.includes(sevFilter as typeof VALID_SEVERITIES[number])) {
        return res.status(400).json({
          error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        });
      }

      const conditions: string[] = [];
      const params: unknown[]    = [];

      if (sessionId) {
        params.push(sessionId);
        conditions.push(`ce.session_id = $${params.length}`);
      }
      if (typeFilter) {
        params.push(typeFilter);
        conditions.push(`ce.contradiction_type = $${params.length}`);
      }
      if (sevFilter) {
        params.push(sevFilter);
        conditions.push(`ce.severity = $${params.length}`);
      }
      if (resolvedRaw === 'true') {
        conditions.push(`ce.resolved = TRUE`);
      } else if (resolvedRaw === 'false') {
        conditions.push(`ce.resolved = FALSE`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      try {
        const [{ rows: data }, { rows: [totRow] }] = await Promise.all([
          pool.query(
            `SELECT
               ce.id,
               ce.session_id,
               ce.contradiction_type,
               ce.severity,
               ce.affected_hypothesis_ids,
               ce.response_ids,
               ce.description,
               ce.recommended_action,
               ce.resolved,
               ce.created_at,
               jsonb_array_length(ce.affected_hypothesis_ids) AS affected_hypothesis_count,
               jsonb_array_length(ce.response_ids)            AS response_count
             FROM contradiction_events ce
             ${where}
             ORDER BY ce.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
          ),
          pool.query(
            `SELECT COUNT(*)::int AS total
             FROM contradiction_events ce
             ${where}`,
            params
          ),
        ]);

        return res.json({
          data,
          total:       totRow?.total ?? 0,
          page,
          limit,
          pages:       Math.ceil((totRow?.total ?? 0) / limit),
          flag_active: isEnabled('contradiction_detection', tenantId),
        });
      } catch (err) {
        console.error('[contradiction-engine] admin list error:', err);
        return res.status(500).json({ error: 'Failed to retrieve contradiction events' });
      }
    }
  );

  // ── PATCH /api/admin/bios/contradictions/:id/resolve ───────────────────────
  // Marks a specific contradiction event as resolved.
  app.patch(
    '/api/admin/bios/contradictions/:id/resolve',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
        const { rows: [updated] } = await pool.query(
          `UPDATE contradiction_events
           SET resolved = TRUE
           WHERE id = $1
           RETURNING *`,
          [id]
        );
        if (!updated) {
          return res.status(404).json({ error: 'Contradiction event not found' });
        }
        return res.json({ ok: true, updated });
      } catch (err) {
        console.error('[contradiction-engine] resolve error:', err);
        return res.status(500).json({ error: 'Failed to resolve contradiction event' });
      }
    }
  );
}
