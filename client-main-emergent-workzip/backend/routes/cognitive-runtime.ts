/**
 * Cognitive Runtime State Routes — Phase 1 S1
 *
 * GET  /api/bios/runtime-state/:sessionId          — full current state
 * PATCH /api/bios/runtime-state/:sessionId         — partial merge update
 * GET  /api/bios/runtime-state/:sessionId/history  — ordered snapshot history
 * POST /api/bios/runtime-state/:sessionId/snapshot — manual snapshot
 * GET  /api/admin/bios/runtime-state               — paginated list (admin)
 * GET  /api/admin/bios/runtime-state/stats         — aggregate stats
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { getState, updateState, snapshotState, replayState } from '../services/cognitive-state';
import { isEnabled } from '../services/feature-flags';

interface RuntimeStateRow {
  session_id:             string;
  concern_name:           string;
  stage_code:             string;
  guest_email:            string | null;
  status:                 string;
  version:                number;
  updated_at:             string;
  contradiction_detected: string | null;
  snapshot_count:         number;
}

export function registerCognitiveRuntimeRoutes(app: Express, pool: Pool): void {

  // ── GET /api/admin/bios/runtime-state/stats (must come before /:sessionId) ─
  app.get('/api/admin/bios/runtime-state/stats', async (_req: Request, res: Response) => {
    try {
      const { rows: [stats] } = await pool.query(`
        SELECT
          COUNT(*)                                                              AS total_sessions,
          COUNT(*) FILTER (WHERE s.status = 'in_progress')                    AS active_sessions,
          COUNT(*) FILTER (WHERE s.status = 'completed')                      AS completed_sessions,
          COUNT(*) FILTER (
            WHERE crs.state->'contradiction_state'->>'detected' = 'true'
          )                                                                    AS contradiction_sessions,
          ROUND(AVG(crs.version)::numeric, 1)                                 AS avg_state_version,
          COUNT(DISTINCT s.concern_name)                                       AS unique_concerns
        FROM cognitive_runtime_state crs
        JOIN capadex_sessions s ON s.id = crs.session_id
      `);
      return res.json(stats);
    } catch (err) {
      console.error('[cognitive-runtime] stats error:', err);
      return res.status(500).json({ error: 'Failed to compute stats' });
    }
  });

  // ── GET /api/admin/bios/runtime-state — paginated list ───────────────────
  app.get('/api/admin/bios/runtime-state', async (req: Request, res: Response) => {
    const page   = Math.max(1,   parseInt(String(req.query.page  ?? '1'),  10));
    const limit  = Math.min(100, parseInt(String(req.query.limit ?? '25'), 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search ?? '').trim();

    try {
      const params: unknown[] = [limit, offset];
      const searchClause = search
        ? `AND (s.concern_name ILIKE $3 OR s.guest_email ILIKE $3)` : '';
      if (search) params.push(`%${search}%`);

      const { rows } = await pool.query(`
        SELECT
          crs.session_id,
          s.concern_name,
          s.stage_code,
          s.guest_email,
          s.status,
          crs.version,
          crs.updated_at,
          crs.state->'contradiction_state'->>'detected'  AS contradiction_detected,
          (
            SELECT COUNT(*) FROM cognitive_state_history h
            WHERE h.session_id = crs.session_id
          )::int AS snapshot_count
        FROM cognitive_runtime_state crs
        JOIN capadex_sessions s ON s.id = crs.session_id
        WHERE 1=1 ${searchClause}
        ORDER BY crs.updated_at DESC
        LIMIT $1 OFFSET $2
      `, params);

      const { rows: [{ total }] } = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM cognitive_runtime_state crs
        JOIN capadex_sessions s ON s.id = crs.session_id
        WHERE 1=1 ${search ? `AND (s.concern_name ILIKE $1 OR s.guest_email ILIKE $1)` : ''}
      `, search ? [`%${search}%`] : []);

      return res.json({
        total,
        page,
        limit,
        rows: (rows as RuntimeStateRow[]).map(r => ({
          session_id:           r.session_id,
          concern_name:         r.concern_name,
          stage_code:           r.stage_code,
          guest_email:          r.guest_email,
          status:               r.status,
          version:              r.version,
          updated_at:           r.updated_at,
          contradiction_active: r.contradiction_detected === 'true',
          snapshot_count:       r.snapshot_count ?? 0,
        })),
      });
    } catch (err) {
      console.error('[cognitive-runtime] admin list error:', err);
      return res.status(500).json({ error: 'Failed to list runtime states' });
    }
  });

  // ── GET /api/bios/runtime-state/:sessionId ─────────────────────────────────
  app.get('/api/bios/runtime-state/:sessionId', async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    try {
      const { rows: sessionRows } = await pool.query(
        'SELECT id FROM capadex_sessions WHERE id = $1',
        [sessionId]
      );
      if (sessionRows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const state = await getState(pool, sessionId);
      if (!state) {
        return res.status(404).json({ error: 'No cognitive runtime state for this session yet' });
      }

      return res.json({ session_id: sessionId, state });
    } catch (err) {
      console.error('[cognitive-runtime] GET state error:', err);
      return res.status(500).json({ error: 'Failed to retrieve state' });
    }
  });

  // ── PATCH /api/bios/runtime-state/:sessionId ──────────────────────────────
  // Intended callers: Phase 1 intelligence engines (server-side).
  // Session UUID (v4) is the implicit access credential — not guessable by
  // external parties. Treat session_id as a bearer token for these endpoints.
  app.patch('/api/bios/runtime-state/:sessionId', async (req: Request, res: Response) => {
    // Resolve tenant context FIRST so per-tenant overrides are respected by all checks below
    const tenantId  = (String(req.body?.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;
    if (!isEnabled('cognitive_load_engine', tenantId)) {
      return res.json({ session_id: req.params.sessionId, applied: false, skipped: true, reason: 'cognitive_load_engine flag disabled' });
    }
    const sessionId = String(req.params.sessionId);
    let   partial   = req.body?.state;
    const reason    = String(req.body?.reason ?? 'manual_update');

    if (!partial || typeof partial !== 'object') {
      return res.status(400).json({ error: 'Body must include a "state" object with partial state fields' });
    }

    // Strip flag-gated state fields from the partial update when their flag is disabled
    if (!isEnabled('hypothesis_engine', tenantId) && 'active_hypotheses' in partial) {
      const { active_hypotheses: _ah, ...rest } = partial as Record<string, unknown>;
      partial = rest;
    }
    if (!isEnabled('contradiction_detection', tenantId) && 'contradiction_state' in partial) {
      const { contradiction_state: _cs, ...rest } = partial as Record<string, unknown>;
      partial = rest;
    }
    if (!isEnabled('confidence_engine', tenantId) && 'confidence_scores' in partial) {
      const { confidence_scores: _cf, ...rest } = partial as Record<string, unknown>;
      partial = rest;
    }

    try {
      const { rows: sessionRows } = await pool.query(
        'SELECT id FROM capadex_sessions WHERE id = $1',
        [sessionId]
      );
      if (sessionRows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const applied = await updateState(pool, sessionId, partial, reason);
      if (!applied) {
        return res.status(500).json({ error: 'State persistence failed', applied: false });
      }

      await snapshotState(pool, sessionId, reason, 'api');
      const updated = await getState(pool, sessionId);
      return res.json({ session_id: sessionId, applied: true, state: updated });
    } catch (err) {
      console.error('[cognitive-runtime] PATCH state error:', err);
      return res.status(500).json({ error: 'Failed to update state', applied: false });
    }
  });

  // ── GET /api/bios/runtime-state/:sessionId/history ───────────────────────
  app.get('/api/bios/runtime-state/:sessionId/history', async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '50'), 10));

    try {
      const { rows: sessionRows } = await pool.query(
        'SELECT id FROM capadex_sessions WHERE id = $1',
        [sessionId]
      );
      if (sessionRows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const history = await replayState(pool, sessionId, limit);
      return res.json({ session_id: sessionId, count: history.length, history });
    } catch (err) {
      console.error('[cognitive-runtime] GET history error:', err);
      return res.status(500).json({ error: 'Failed to retrieve state history' });
    }
  });

  // ── POST /api/bios/runtime-state/:sessionId/snapshot ─────────────────────
  app.post('/api/bios/runtime-state/:sessionId/snapshot', async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const reason    = String(req.body?.reason ?? 'manual_snapshot');
    const actor     = String(req.body?.actor  ?? 'admin');

    try {
      await snapshotState(pool, sessionId, reason, actor);
      return res.json({ ok: true, session_id: sessionId, reason });
    } catch (err) {
      console.error('[cognitive-runtime] snapshot error:', err);
      return res.status(500).json({ error: 'Failed to create snapshot' });
    }
  });
}
