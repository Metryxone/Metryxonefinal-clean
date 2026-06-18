/**
 * CAPADEX Adaptive Ontology Edges — Admin CRUD
 *
 * Codeless-CMS surface for the `adaptive_ontology_edges` table consumed at
 * runtime by `pickQuestionsFromDB` (capadex-concern-intelligence.ts), which
 * joins it OR-side to surface questions from highly-correlated target
 * buckets (status='approved', weight >= 0.60).
 *
 * Endpoints (all behind `requireAuth, requireSuperAdmin`):
 *   GET    /api/admin/capadex/ontology       — list (filters: source_bucket, target_bucket, status, min_weight)
 *   POST   /api/admin/capadex/ontology       — create (status forced to 'draft')
 *   PATCH  /api/admin/capadex/ontology/:id   — edit / promote status
 *   DELETE /api/admin/capadex/ontology/:id   — hard delete
 *
 * Conventions (mirror capadex-questions.ts):
 *   - Manual POSTs always land as `status='draft'` (Draft → Approved workflow).
 *   - Every successful write goes through `writeAuditEvent(...)`.
 *   - Status transitions restricted to: draft | approved | rejected | archived.
 *   - Weight must be in [0.00, 1.00] (also enforced by CHECK constraint).
 *   - source_bucket != target_bucket (also enforced by CHECK constraint).
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { writeAuditEvent } from '../lib/audit';

const ALLOWED_STATUS = ['draft', 'approved', 'rejected', 'archived'] as const;
type Status = (typeof ALLOWED_STATUS)[number];

interface EdgeRow {
  id:            number;
  source_bucket: string;
  target_bucket: string;
  weight:        string;        // numeric → comes back as string from node-pg
  status:        Status;
  created_at:    string;
}

const BASE = '/api/admin/capadex/ontology';

function actorOf(req: Request): string {
  const u = (req as any).user ?? {};
  return String(u.email ?? u.id ?? (req as any).session?.userId ?? 'superadmin');
}

/**
 * Coerce a body value to a weight in [0.00, 1.00] (2-decimal precision).
 * Returns `number` for valid, `'invalid'` for malformed.
 */
function weightOrInvalid(v: unknown): number | 'invalid' {
  if (v === null || v === undefined || v === '') return 'invalid';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n < 0 || n > 1) return 'invalid';
  return Math.round(n * 100) / 100;
}

function bucketOrInvalid(v: unknown): string | 'invalid' {
  if (typeof v !== 'string') return 'invalid';
  const s = v.trim();
  if (!s || s.length > 50) return 'invalid';
  return s;
}

export function registerCapadexOntologyRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  /* ---------- LIST ---------- */
  app.get(BASE, requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where: string[] = [];
      const args: any[] = [];
      if (req.query.source_bucket) { args.push(String(req.query.source_bucket)); where.push(`source_bucket = $${args.length}`); }
      if (req.query.target_bucket) { args.push(String(req.query.target_bucket)); where.push(`target_bucket = $${args.length}`); }
      if (req.query.status)        { args.push(String(req.query.status));        where.push(`status = $${args.length}`); }
      if (req.query.min_weight) {
        const w = parseFloat(String(req.query.min_weight));
        if (Number.isFinite(w)) { args.push(w); where.push(`weight >= $${args.length}`); }
      }
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
      const sql = `SELECT id, source_bucket, target_bucket, weight, status, created_at
                     FROM adaptive_ontology_edges
                    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                    ORDER BY source_bucket ASC, weight DESC, id DESC
                    LIMIT ${limit}`;
      const rs = await pool.query<EdgeRow>(sql, args);
      // Flat array (no envelope) — matches the CrudTable consumption contract,
      // same as /api/admin/superadmin/capadex/questions.
      res.json(rs.rows);
    } catch (e) { next(e); }
  });

  /* ---------- CREATE (always draft) ---------- */
  app.post(BASE, requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body || {};
      const source_bucket = bucketOrInvalid(b.source_bucket);
      const target_bucket = bucketOrInvalid(b.target_bucket);
      const weight        = weightOrInvalid(b.weight);
      if (source_bucket === 'invalid') return res.status(400).json({ ok: false, error: 'invalid_source_bucket' });
      if (target_bucket === 'invalid') return res.status(400).json({ ok: false, error: 'invalid_target_bucket' });
      if (weight        === 'invalid') return res.status(400).json({ ok: false, error: 'invalid_weight', allowed_range: [0, 1] });
      if (source_bucket === target_bucket) {
        return res.status(400).json({ ok: false, error: 'source_target_must_differ' });
      }
      // Draft → Approved workflow: manual creates never auto-publish, even though
      // the column default is 'approved' (which serves seed/manual SQL).
      const rs = await pool.query<EdgeRow>(
        `INSERT INTO adaptive_ontology_edges (source_bucket, target_bucket, weight, status, created_at)
         VALUES ($1, $2, $3, 'draft', NOW())
         RETURNING id, source_bucket, target_bucket, weight, status, created_at`,
        [source_bucket, target_bucket, weight],
      );
      const row = rs.rows[0];
      await writeAuditEvent(pool, {
        event_type: 'capadex_ontology_edge_created',
        actor:      actorOf(req),
        payload:    { id: row.id, source_bucket, target_bucket, weight, status: 'draft' },
      });
      res.json({ ok: true, row });
    } catch (e) { next(e); }
  });

  /* ---------- PATCH (edit + status transition) ---------- */
  app.patch(`${BASE}/:id`, requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
      const cur = await pool.query<EdgeRow>(`SELECT * FROM adaptive_ontology_edges WHERE id = $1`, [id]);
      if (cur.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });

      const b = req.body || {};
      let next_source: string | null = null;
      let next_target: string | null = null;
      let next_weight: number | null = null;
      let next_status: string | null = null;

      if (b.source_bucket !== undefined) {
        const v = bucketOrInvalid(b.source_bucket);
        if (v === 'invalid') return res.status(400).json({ ok: false, error: 'invalid_source_bucket' });
        next_source = v;
      }
      if (b.target_bucket !== undefined) {
        const v = bucketOrInvalid(b.target_bucket);
        if (v === 'invalid') return res.status(400).json({ ok: false, error: 'invalid_target_bucket' });
        next_target = v;
      }
      if (b.weight !== undefined) {
        const v = weightOrInvalid(b.weight);
        if (v === 'invalid') return res.status(400).json({ ok: false, error: 'invalid_weight', allowed_range: [0, 1] });
        next_weight = v;
      }
      if (b.status !== undefined) {
        const s = String(b.status);
        if (!ALLOWED_STATUS.includes(s as Status)) {
          return res.status(400).json({ ok: false, error: 'invalid_status', allowed: ALLOWED_STATUS });
        }
        next_status = s;
      }

      // Cross-field check against resulting state.
      const effSource = next_source ?? cur.rows[0].source_bucket;
      const effTarget = next_target ?? cur.rows[0].target_bucket;
      if (effSource === effTarget) {
        return res.status(400).json({ ok: false, error: 'source_target_must_differ' });
      }

      const rs = await pool.query<EdgeRow>(
        `UPDATE adaptive_ontology_edges SET
           source_bucket = COALESCE($2, source_bucket),
           target_bucket = COALESCE($3, target_bucket),
           weight        = COALESCE($4, weight),
           status        = COALESCE($5, status)
         WHERE id = $1
         RETURNING id, source_bucket, target_bucket, weight, status, created_at`,
        [id, next_source, next_target, next_weight, next_status],
      );
      const row = rs.rows[0];
      await writeAuditEvent(pool, {
        event_type: 'capadex_ontology_edge_updated',
        actor:      actorOf(req),
        payload: {
          id,
          before: { source_bucket: cur.rows[0].source_bucket, target_bucket: cur.rows[0].target_bucket, weight: cur.rows[0].weight, status: cur.rows[0].status },
          after:  { source_bucket: row.source_bucket,         target_bucket: row.target_bucket,         weight: row.weight,         status: row.status         },
        },
      });
      res.json({ ok: true, row });
    } catch (e) { next(e); }
  });

  /* ---------- DELETE ---------- */
  app.delete(`${BASE}/:id`, requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
      const rs = await pool.query<EdgeRow>(
        `DELETE FROM adaptive_ontology_edges WHERE id = $1
         RETURNING id, source_bucket, target_bucket, weight, status, created_at`,
        [id],
      );
      if (rs.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      await writeAuditEvent(pool, {
        event_type: 'capadex_ontology_edge_deleted',
        actor:      actorOf(req),
        payload:    { id, deleted: rs.rows[0] },
      });
      res.json({ ok: true, id });
    } catch (e) { next(e); }
  });
}
