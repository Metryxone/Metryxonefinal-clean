/**
 * CAPADEX Adaptive Question Bank — Admin CRUD
 *
 * Codeless-CMS surface for the `adaptive_question_bank` table consumed at
 * runtime by `pickQuestionsFromDB` in `capadex-concern-intelligence.ts`.
 *
 * Endpoints (all behind `requireAuth, requireSuperAdmin`):
 *   GET    /api/admin/superadmin/capadex/questions       — list (filters: concern_bucket, persona, status, search)
 *   POST   /api/admin/superadmin/capadex/questions       — create (status forced to 'draft')
 *   PATCH  /api/admin/superadmin/capadex/questions/:id   — edit / promote status
 *   DELETE /api/admin/superadmin/capadex/questions/:id   — hard delete
 *   GET    /api/admin/superadmin/capadex/questions/stats — counts per concern_bucket × persona × status
 *
 * Conventions:
 *   - Manual POSTs always land as `status='draft'` (Draft → Approved workflow).
 *   - Every successful write goes through `writeAuditEvent(...)` —
 *     append-only audit trail in `capadex_audit_events`.
 *   - Status transitions are restricted to: draft | approved | rejected | archived.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { writeAuditEvent } from '../lib/audit';

const ALLOWED_STATUS = ['draft', 'approved', 'rejected', 'archived'] as const;
type Status = (typeof ALLOWED_STATUS)[number];

interface QuestionRow {
  id:             number;
  concern_bucket: string;
  persona:        string;
  question_text:  string;
  status:         Status;
  age_min:        number | null;
  age_max:        number | null;
  created_at:     string;
}

/**
 * Coerce a body value to an integer-or-null age band bound.
 * Tri-state: `null` = explicit clear (caller sent null/''), `number` = valid bound,
 * `'invalid'` = malformed (caller sent garbage). Lets handlers reject malformed
 * input with 400 instead of silently clearing the field.
 */
function ageOrNull(v: unknown): number | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0 || n > 120) return 'invalid';
  return Math.trunc(n);
}

const BASE = '/api/admin/superadmin/capadex/questions';

function actorOf(req: Request): string {
  const u = (req as any).user ?? {};
  return String(u.email ?? u.id ?? (req as any).session?.userId ?? 'superadmin');
}

export function registerCapadexQuestionsRoutes(
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
      if (req.query.concern_bucket) { args.push(String(req.query.concern_bucket)); where.push(`concern_bucket = $${args.length}`); }
      if (req.query.persona)        { args.push(String(req.query.persona));        where.push(`persona = $${args.length}`); }
      if (req.query.status)         { args.push(String(req.query.status));         where.push(`status = $${args.length}`); }
      if (req.query.search) {
        args.push(`%${String(req.query.search).toLowerCase()}%`);
        where.push(`LOWER(question_text) LIKE $${args.length}`);
      }
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
      const sql = `SELECT id, concern_bucket, persona, question_text, status, age_min, age_max, created_at
                     FROM adaptive_question_bank
                    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                    ORDER BY id DESC
                    LIMIT ${limit}`;
      const rs = await pool.query<QuestionRow>(sql, args);
      // Returns a flat array (no envelope) so the shared `CrudTable` primitive
      // can consume it directly — matches the convention of other admin list
      // endpoints (e.g. /api/concerns/admin/list).
      res.json(rs.rows);
    } catch (e) { next(e); }
  });

  /* ---------- STATS ---------- */
  app.get(`${BASE}/stats`, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const byStatus = await pool.query(
        `SELECT status, COUNT(*)::int AS n FROM adaptive_question_bank GROUP BY 1 ORDER BY 1`,
      );
      const byBucket = await pool.query(
        `SELECT concern_bucket, persona, status, COUNT(*)::int AS n
           FROM adaptive_question_bank GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
      );
      res.json({ ok: true, by_status: byStatus.rows, by_bucket: byBucket.rows });
    } catch (e) { next(e); }
  });

  /* ---------- CREATE (always draft) ---------- */
  app.post(BASE, requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body || {};
      const concern_bucket = typeof b.concern_bucket === 'string' ? b.concern_bucket.trim() : '';
      const persona        = typeof b.persona        === 'string' ? b.persona.trim()        : '';
      const question_text  = typeof b.question_text  === 'string' ? b.question_text.trim()  : '';
      if (!concern_bucket || !persona || !question_text) {
        return res.status(400).json({ ok: false, error: 'concern_bucket, persona, question_text required' });
      }
      const age_min = ageOrNull(b.age_min);
      const age_max = ageOrNull(b.age_max);
      if (age_min === 'invalid' || age_max === 'invalid') {
        return res.status(400).json({ ok: false, error: 'invalid_age_bound', allowed_range: [0, 120] });
      }
      if (age_min !== null && age_max !== null && age_min > age_max) {
        return res.status(400).json({ ok: false, error: 'age_min_gt_age_max' });
      }
      // Draft → Approved workflow: manual creates never auto-publish.
      const rs = await pool.query<QuestionRow>(
        `INSERT INTO adaptive_question_bank (concern_bucket, persona, question_text, status, age_min, age_max, created_at)
         VALUES ($1, $2, $3, 'draft', $4, $5, NOW())
         RETURNING id, concern_bucket, persona, question_text, status, age_min, age_max, created_at`,
        [concern_bucket, persona, question_text, age_min, age_max],
      );
      const row = rs.rows[0];
      await writeAuditEvent(pool, {
        event_type: 'capadex_question_created',
        actor:      actorOf(req),
        payload:    { id: row.id, concern_bucket, persona, status: 'draft', age_min, age_max },
      });
      res.json({ ok: true, row });
    } catch (e) { next(e); }
  });

  /* ---------- PATCH (edit + status transition) ---------- */
  app.patch(`${BASE}/:id`, requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });
      const cur = await pool.query<QuestionRow>(`SELECT * FROM adaptive_question_bank WHERE id = $1`, [id]);
      if (cur.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });

      const b = req.body || {};
      const next_concern = b.concern_bucket !== undefined ? String(b.concern_bucket).trim() : null;
      const next_persona = b.persona        !== undefined ? String(b.persona).trim()        : null;
      const next_text    = b.question_text  !== undefined ? String(b.question_text).trim()  : null;
      const next_status  = b.status         !== undefined ? String(b.status)                : null;
      // PATCH sentinel: `undefined` = leave as-is, `null` = explicit clear,
      // `number` = new bound. ageOrNull additionally returns 'invalid' for
      // malformed input (rejected with 400 below).
      const raw_age_min = b.age_min !== undefined ? ageOrNull(b.age_min) : undefined;
      const raw_age_max = b.age_max !== undefined ? ageOrNull(b.age_max) : undefined;
      if (raw_age_min === 'invalid' || raw_age_max === 'invalid') {
        return res.status(400).json({ ok: false, error: 'invalid_age_bound', allowed_range: [0, 120] });
      }
      const next_age_min = raw_age_min as number | null | undefined;
      const next_age_max = raw_age_max as number | null | undefined;

      if (next_status && !ALLOWED_STATUS.includes(next_status as Status)) {
        return res.status(400).json({ ok: false, error: 'invalid_status', allowed: ALLOWED_STATUS });
      }
      if (next_concern === '' || next_persona === '' || next_text === '') {
        return res.status(400).json({ ok: false, error: 'fields_cannot_be_empty' });
      }
      // Cross-field check against the resulting state (incoming || current).
      const effMin = next_age_min !== undefined ? next_age_min : cur.rows[0].age_min;
      const effMax = next_age_max !== undefined ? next_age_max : cur.rows[0].age_max;
      if (effMin !== null && effMax !== null && effMin > effMax) {
        return res.status(400).json({ ok: false, error: 'age_min_gt_age_max' });
      }

      const rs = await pool.query<QuestionRow>(
        `UPDATE adaptive_question_bank SET
           concern_bucket = COALESCE($2, concern_bucket),
           persona        = COALESCE($3, persona),
           question_text  = COALESCE($4, question_text),
           status         = COALESCE($5, status),
           age_min        = CASE WHEN $7::boolean THEN $6::int ELSE age_min END,
           age_max        = CASE WHEN $9::boolean THEN $8::int ELSE age_max END
         WHERE id = $1
         RETURNING id, concern_bucket, persona, question_text, status, age_min, age_max, created_at`,
        [
          id, next_concern, next_persona, next_text, next_status,
          next_age_min ?? null, next_age_min !== undefined,
          next_age_max ?? null, next_age_max !== undefined,
        ],
      );
      const row = rs.rows[0];
      await writeAuditEvent(pool, {
        event_type: 'capadex_question_updated',
        actor:      actorOf(req),
        payload: {
          id,
          before: { concern_bucket: cur.rows[0].concern_bucket, persona: cur.rows[0].persona, status: cur.rows[0].status, age_min: cur.rows[0].age_min, age_max: cur.rows[0].age_max },
          after:  { concern_bucket: row.concern_bucket,         persona: row.persona,         status: row.status,         age_min: row.age_min,         age_max: row.age_max         },
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
      const rs = await pool.query<QuestionRow>(
        `DELETE FROM adaptive_question_bank WHERE id = $1
         RETURNING id, concern_bucket, persona, question_text, status, age_min, age_max, created_at`,
        [id],
      );
      if (rs.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
      await writeAuditEvent(pool, {
        event_type: 'capadex_question_deleted',
        actor:      actorOf(req),
        payload:    { id, deleted: rs.rows[0] },
      });
      res.json({ ok: true, id });
    } catch (e) { next(e); }
  });
}
