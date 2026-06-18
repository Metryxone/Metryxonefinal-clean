import { Router, Request, Response } from 'express';
import { pool, query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim().toLowerCase();
    const category = req.query.category as string | undefined;

    if (!q && !category) {
      const result = await query(
        'SELECT id, category, concern_area, parent_worry, impact_on_child, assessment_type, services, roles FROM concern_areas WHERE is_active = true ORDER BY sort_order'
      );
      return res.json({ concerns: result.rows });
    }

    let sql = 'SELECT id, category, concern_area, parent_worry, impact_on_child, assessment_type, services, roles FROM concern_areas WHERE is_active = true';
    const params: string[] = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (LOWER(parent_worry) LIKE $${params.length} OR LOWER(concern_area) LIKE $${params.length} OR LOWER(search_keywords) LIKE $${params.length})`;
    }

    if (category) {
      params.push(category);
      sql += ` AND LOWER(category) = LOWER($${params.length})`;
    }

    sql += ' ORDER BY sort_order LIMIT 20';

    const result = await query(sql, params);
    return res.json({ concerns: result.rows });
  } catch (err) {
    console.error('[Concerns] search error:', err);
    return res.status(500).json({ error: 'Failed to search concerns' });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT DISTINCT category, COUNT(*) as count FROM concern_areas WHERE is_active = true GROUP BY category ORDER BY category'
    );
    return res.json({ categories: result.rows });
  } catch (err) {
    console.error('[Concerns] categories error:', err);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/match', async (req: Request, res: Response) => {
  try {
    const text = (req.query.text as string || '').trim().toLowerCase();
    if (!text) return res.json({ matches: [] });

    const words = text.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return res.json({ matches: [] });

    const conditions = words.map((_, i) => `LOWER(search_keywords) LIKE $${i + 1}`);
    const params = words.map(w => `%${w}%`);

    const result = await query(
      `SELECT id, category, concern_area, parent_worry, impact_on_child, assessment_type, services, roles
       FROM concern_areas WHERE is_active = true AND (${conditions.join(' OR ')})
       ORDER BY sort_order LIMIT 10`,
      params
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('[Concerns] match error:', err);
    return res.status(500).json({ error: 'Failed to match concerns' });
  }
});

// ───────────────────────── Admin CRUD ─────────────────────────

function normalizeArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  return [];
}

function validatePayload(body: any): { ok: true; data: any } | { ok: false; error: string } {
  const category = String(body?.category ?? '').trim();
  const concern_area = String(body?.concern_area ?? body?.concernArea ?? '').trim();
  const parent_worry = String(body?.parent_worry ?? body?.parentWorry ?? '').trim();
  const impact_on_child = String(body?.impact_on_child ?? body?.impactOnChild ?? '').trim();
  if (!category) return { ok: false, error: 'category is required' };
  if (!concern_area) return { ok: false, error: 'concern_area is required' };
  if (!parent_worry) return { ok: false, error: 'parent_worry is required' };
  if (!impact_on_child) return { ok: false, error: 'impact_on_child is required' };
  if (category.length > 50) return { ok: false, error: 'category too long (max 50)' };
  if (concern_area.length > 255) return { ok: false, error: 'concern_area too long (max 255)' };
  if (parent_worry.length > 500) return { ok: false, error: 'parent_worry too long (max 500)' };
  if (impact_on_child.length > 500) return { ok: false, error: 'impact_on_child too long (max 500)' };

  return {
    ok: true,
    data: {
      category,
      concern_area,
      parent_worry,
      impact_on_child,
      assessment_type: String(body?.assessment_type ?? body?.assessmentType ?? 'lbi').trim() || 'lbi',
      search_keywords: body?.search_keywords ?? body?.searchKeywords ?? null,
      services: normalizeArr(body?.services),
      roles: normalizeArr(body?.roles),
      is_active: body?.is_active === undefined ? true : !!body?.is_active,
      sort_order: Number.isFinite(body?.sort_order) ? Number(body.sort_order) : 0,
    },
  };
}

router.get('/admin/list', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, category, concern_area, parent_worry, impact_on_child, assessment_type,
              search_keywords, services, roles, is_active, sort_order, created_at, updated_at
       FROM concern_areas
       ORDER BY sort_order ASC, id ASC`
    );
    return res.json({ concerns: result.rows });
  } catch (err) {
    console.error('[Concerns] admin list error:', err);
    return res.status(500).json({ error: 'Failed to load concerns' });
  }
});

router.post('/admin', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const v = validatePayload(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const d = v.data;
  try {
    const result = await query(
      `INSERT INTO concern_areas
        (category, concern_area, parent_worry, impact_on_child, assessment_type, search_keywords, services, roles, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
       RETURNING *`,
      [
        d.category, d.concern_area, d.parent_worry, d.impact_on_child,
        d.assessment_type, d.search_keywords,
        JSON.stringify(d.services), JSON.stringify(d.roles),
        d.is_active, d.sort_order,
      ]
    );
    return res.status(201).json({ concern: result.rows[0] });
  } catch (err) {
    console.error('[Concerns] create error:', err);
    return res.status(500).json({ error: 'Failed to create concern' });
  }
});

router.patch('/admin/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const v = validatePayload(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const d = v.data;
  try {
    const result = await query(
      `UPDATE concern_areas SET
         category = $1, concern_area = $2, parent_worry = $3, impact_on_child = $4,
         assessment_type = $5, search_keywords = $6,
         services = $7::jsonb, roles = $8::jsonb,
         is_active = $9, sort_order = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        d.category, d.concern_area, d.parent_worry, d.impact_on_child,
        d.assessment_type, d.search_keywords,
        JSON.stringify(d.services), JSON.stringify(d.roles),
        d.is_active, d.sort_order, id,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Concern not found' });
    return res.json({ concern: result.rows[0] });
  } catch (err) {
    console.error('[Concerns] update error:', err);
    return res.status(500).json({ error: 'Failed to update concern' });
  }
});

router.delete('/admin/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await query('DELETE FROM concern_areas WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Concern not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[Concerns] delete error:', err);
    return res.status(500).json({ error: 'Failed to delete concern' });
  }
});

export default router;
