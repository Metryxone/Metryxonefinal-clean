import { Router, Request, Response } from 'express';
import { query } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

export const STAGES = ['Curiosity', 'Insight', 'Growth', 'Mastery'] as const;
type Stage = typeof STAGES[number];
const isStage = (s: string): s is Stage => (STAGES as readonly string[]).includes(s);

// ───────────────────── Public endpoints ─────────────────────

// Stats: count of questions per concern_area + stage (for landing page mapping)
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const r = await query(`
      SELECT ca.id AS concern_area_id, ca.category, ca.concern_area, ca.parent_worry,
             COALESCE(json_agg(json_build_object('stage', sub.stage, 'count', sub.c))
               FILTER (WHERE sub.stage IS NOT NULL), '[]') AS stages
      FROM concern_areas ca
      LEFT JOIN (
        SELECT concern_area_id, stage, COUNT(*)::int AS c
        FROM short_assessment_questions
        WHERE is_active = true
        GROUP BY concern_area_id, stage
      ) sub ON sub.concern_area_id = ca.id
      WHERE ca.is_active = true
      GROUP BY ca.id
      ORDER BY ca.sort_order, ca.id
    `);
    res.json({ summary: r.rows });
  } catch (err) {
    console.error('[ShortAssess] summary error:', err);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// Public: questions for a specific concern + stage (used by FreeAssessmentModal etc.)
router.get('/questions', async (req: Request, res: Response) => {
  try {
    const concernAreaId = Number(req.query.concernAreaId);
    const stage = String(req.query.stage ?? 'Curiosity');
    if (!Number.isFinite(concernAreaId)) return res.status(400).json({ error: 'concernAreaId required' });
    if (!isStage(stage)) return res.status(400).json({ error: 'invalid stage' });

    const r = await query(
      `SELECT id, question_code, stage, age_band, is_anchor, focus_area, layer, dimension,
              question_text, response_options, polarity, weight, logic, options, sort_order
       FROM short_assessment_questions
       WHERE concern_area_id = $1 AND stage = $2 AND is_active = true
       ORDER BY sort_order ASC, id ASC`,
      [concernAreaId, stage]
    );
    res.json({ questions: r.rows });
  } catch (err) {
    console.error('[ShortAssess] questions error:', err);
    res.status(500).json({ error: 'Failed to load questions' });
  }
});

// ───────────────────── Age Bands ─────────────────────

// Public list — all bands with question counts
router.get('/age-bands', async (_req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT ab.code, ab.ages, ab.is_active, ab.sort_order,
              COALESCE(ab.description, '') AS description,
              COUNT(q.id)::int AS question_count
       FROM age_bands ab
       LEFT JOIN short_assessment_questions q
         ON q.age_band = ab.ages OR q.age_band = ab.code
       GROUP BY ab.code, ab.ages, ab.is_active, ab.sort_order, ab.description
       ORDER BY ab.sort_order ASC`
    );
    res.json({ bands: r.rows });
  } catch (err) {
    console.error('[ShortAssess] age-bands error:', err);
    res.status(500).json({ error: 'Failed to load age bands' });
  }
});

// Admin bulk sync — body: { bands: [{code, ages, is_active, sort_order}] }.
// Codes not present in the payload are deleted, so this mirrors the UI exactly.
router.put('/admin/age-bands', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const bands = Array.isArray(req.body?.bands) ? req.body.bands : null;
  if (!bands) return res.status(400).json({ error: 'bands array required' });
  try {
    const seenCodes: string[] = [];
    for (const b of bands) {
      const code = String(b?.code ?? '').trim().toUpperCase().slice(0, 8);
      if (!code) continue;
      const ages = String(b?.ages ?? '').trim().slice(0, 40);
      const active = !!(b?.is_active ?? b?.isActive);
      const sort = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : seenCodes.length + 1;
      const desc = String(b?.description ?? '').trim().slice(0, 200);
      await query(
        `INSERT INTO age_bands (code, ages, is_active, sort_order, description, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (code) DO UPDATE SET
           ages = EXCLUDED.ages,
           is_active = EXCLUDED.is_active,
           sort_order = EXCLUDED.sort_order,
           description = EXCLUDED.description,
           updated_at = NOW()`,
        [code, ages, active, sort, desc]
      );
      seenCodes.push(code);
    }
    if (seenCodes.length > 0) {
      await query(
        `DELETE FROM age_bands WHERE code <> ALL($1::text[])`,
        [seenCodes]
      );
    }
    const r = await query(
      `SELECT ab.code, ab.ages, ab.is_active, ab.sort_order,
              COALESCE(ab.description, '') AS description,
              COUNT(q.id)::int AS question_count
       FROM age_bands ab
       LEFT JOIN short_assessment_questions q
         ON q.age_band = ab.ages OR q.age_band = ab.code
       GROUP BY ab.code, ab.ages, ab.is_active, ab.sort_order, ab.description
       ORDER BY ab.sort_order ASC`
    );
    res.json({ bands: r.rows });
  } catch (err) {
    console.error('[ShortAssess] save age-bands error:', err);
    res.status(500).json({ error: 'Failed to save age bands' });
  }
});

router.delete('/admin/age-bands/:code', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const code = String(req.params.code ?? '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'code required' });
  try {
    await query('DELETE FROM age_bands WHERE code = $1', [code]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ShortAssess] delete band error:', err);
    res.status(500).json({ error: 'Failed to delete band' });
  }
});

// ───────────────────── Admin endpoints ─────────────────────

function normalizeOptions(raw: any): Array<{ key: string; text: string; score: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o: any) => ({
      key: String(o?.key ?? '').trim().toUpperCase().slice(0, 4),
      text: String(o?.text ?? '').trim(),
      score: Number.isFinite(Number(o?.score)) ? Number(o.score) : 0,
    }))
    .filter(o => o.key && o.text);
}

function normalizePayload(body: any) {
  return {
    concern_area_id: body?.concern_area_id ?? body?.concernAreaId ?? null,
    question_code: String(body?.question_code ?? body?.questionCode ?? '').trim(),
    stage: String(body?.stage ?? 'Curiosity').trim(),
    age_band: body?.age_band ?? body?.ageBand ?? null,
    is_anchor: !!(body?.is_anchor ?? body?.isAnchor),
    focus_area: body?.focus_area ?? body?.focusArea ?? null,
    layer: body?.layer ?? null,
    dimension: body?.dimension ?? null,
    question_text: String(body?.question_text ?? body?.questionText ?? '').trim(),
    response_options: body?.response_options ?? body?.responseOptions ?? null,
    polarity: body?.polarity ?? null,
    weight: body?.weight != null ? String(body.weight) : '1',
    logic: body?.logic ?? null,
    options: normalizeOptions(body?.options),
    sort_order: Number.isFinite(body?.sort_order) ? Number(body.sort_order)
                : Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0,
    is_active: body?.is_active === undefined ? true : !!body?.is_active,
  };
}

function validate(d: ReturnType<typeof normalizePayload>): string | null {
  if (!d.concern_area_id) return 'concern_area_id is required';
  if (!d.question_code) return 'question_code is required';
  if (!d.question_text) return 'question_text is required';
  if (!isStage(d.stage)) return `stage must be one of ${STAGES.join(', ')}`;
  return null;
}

// Admin list — supports optional concern_area_id and stage filters
router.get('/admin/list', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.concern_area_id) {
      params.push(Number(req.query.concern_area_id));
      where.push(`concern_area_id = $${params.length}`);
    }
    if (req.query.stage) {
      params.push(String(req.query.stage));
      where.push(`stage = $${params.length}`);
    }
    const sql = `SELECT q.id, q.concern_area_id, q.question_code, q.stage, q.age_band,
                        q.is_anchor, q.focus_area, q.layer, q.dimension, q.question_text,
                        q.response_options, q.polarity, q.weight::text, q.logic,
                        q.options::text AS options_json,
                        q.sort_order, q.is_active,
                        ca.category AS concern_category, ca.concern_area AS concern_label
                 FROM short_assessment_questions q
                 LEFT JOIN concern_areas ca ON ca.id = q.concern_area_id
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY q.concern_area_id, q.stage, q.sort_order, q.id`;
    const r = await query(sql, params);
    // Parse the options JSON string into an array for each row
    const questions = r.rows.map((row: any) => {
      let opts = null;
      if (row.options_json) {
        try { opts = JSON.parse(row.options_json); } catch { opts = null; }
      }
      const { options_json, ...rest } = row;
      return { ...rest, options: opts };
    });
    res.json({ questions });
  } catch (err) {
    console.error('[ShortAssess] admin list error:', err);
    res.status(500).json({ error: 'Failed to load questions' });
  }
});

router.post('/admin', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const d = normalizePayload(req.body);
  const err = validate(d);
  if (err) return res.status(400).json({ error: err });
  try {
    const r = await query(
      `INSERT INTO short_assessment_questions
        (concern_area_id, question_code, stage, age_band, is_anchor, focus_area, layer, dimension,
         question_text, response_options, polarity, weight, logic, options, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
       RETURNING *`,
      [d.concern_area_id, d.question_code, d.stage, d.age_band, d.is_anchor, d.focus_area, d.layer, d.dimension,
       d.question_text, d.response_options, d.polarity, d.weight, d.logic, JSON.stringify(d.options), d.sort_order, d.is_active]
    );
    res.status(201).json({ question: r.rows[0] });
  } catch (e) {
    console.error('[ShortAssess] create error:', e);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

router.patch('/admin/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const d = normalizePayload(req.body);
  const err = validate(d);
  if (err) return res.status(400).json({ error: err });
  try {
    const r = await query(
      `UPDATE short_assessment_questions SET
         concern_area_id = $1, question_code = $2, stage = $3, age_band = $4, is_anchor = $5,
         focus_area = $6, layer = $7, dimension = $8, question_text = $9,
         response_options = $10, polarity = $11, weight = $12, logic = $13,
         options = $14::jsonb, sort_order = $15, is_active = $16, updated_at = NOW()
       WHERE id = $17
       RETURNING *`,
      [d.concern_area_id, d.question_code, d.stage, d.age_band, d.is_anchor, d.focus_area, d.layer, d.dimension,
       d.question_text, d.response_options, d.polarity, d.weight, d.logic, JSON.stringify(d.options), d.sort_order, d.is_active, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ question: r.rows[0] });
  } catch (e) {
    console.error('[ShortAssess] update error:', e);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

router.delete('/admin/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const r = await query('DELETE FROM short_assessment_questions WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[ShortAssess] delete error:', e);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Bulk upload — accepts TSV/CSV text or JSON array.
// body: { concern_area_id, stage_default?: 'Curiosity', mode?: 'append' | 'replace', text?: string, rows?: any[] }
router.post('/admin/upload', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const concernAreaId = Number(req.body?.concern_area_id ?? req.body?.concernAreaId);
  if (!Number.isFinite(concernAreaId)) return res.status(400).json({ error: 'concern_area_id required' });
  const stageDefault = String(req.body?.stage_default ?? req.body?.stageDefault ?? 'Curiosity');
  if (!isStage(stageDefault)) return res.status(400).json({ error: 'invalid stage_default' });
  const mode = (req.body?.mode === 'replace') ? 'replace' : 'append';

  let rows: any[] = [];
  if (Array.isArray(req.body?.rows)) {
    rows = req.body.rows;
  } else if (typeof req.body?.text === 'string') {
    const text: string = req.body.text;
    // Detect delimiter: tab if any tab present, else comma
    const delim = text.includes('\t') ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return res.status(400).json({ error: 'No rows' });
    const header = lines[0].split(delim).map(h => h.trim().toLowerCase());
    const idx = (name: string) => header.findIndex(h => h === name || h.startsWith(name));
    const iCode = idx('id'); // FSA-01
    const iAnchor = idx('anchor');
    const iFocus = idx('focus');
    const iLayer = idx('layer');
    const iDim = idx('dimension');
    const iQ = idx('question');
    const iResp = idx('response');
    const iPol = idx('polarity');
    const iWt = idx('wt') >= 0 ? idx('wt') : idx('weight');
    const iLogic = idx('logic');
    const iAge = idx('age');
    const iStage = idx('stage');
    if (iCode < 0 || iQ < 0) return res.status(400).json({ error: 'Header must include ID and Question columns' });
    for (let li = 1; li < lines.length; li++) {
      const p = lines[li].split(delim).map(s => s.trim());
      if (!p[iCode]) continue;
      rows.push({
        question_code: p[iCode],
        is_anchor: iAnchor >= 0 && /^(yes|true|1)$/i.test(p[iAnchor] ?? ''),
        focus_area: iFocus >= 0 ? p[iFocus] : null,
        layer: iLayer >= 0 ? p[iLayer] : null,
        dimension: iDim >= 0 ? p[iDim] : null,
        question_text: p[iQ],
        response_options: iResp >= 0 ? p[iResp] : null,
        polarity: iPol >= 0 ? p[iPol] : null,
        weight: iWt >= 0 ? p[iWt] : '1',
        logic: iLogic >= 0 ? p[iLogic] : null,
        age_band: iAge >= 0 ? p[iAge] : null,
        stage: iStage >= 0 && p[iStage] && isStage(p[iStage]) ? p[iStage] : stageDefault,
      });
    }
  } else {
    return res.status(400).json({ error: 'Provide either rows[] or text' });
  }

  if (rows.length === 0) return res.status(400).json({ error: 'No valid rows parsed' });

  try {
    if (mode === 'replace') {
      await query(
        'DELETE FROM short_assessment_questions WHERE concern_area_id = $1',
        [concernAreaId]
      );
    }
    let inserted = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const stage = isStage(r.stage ?? '') ? r.stage : stageDefault;
      await query(
        `INSERT INTO short_assessment_questions
          (concern_area_id, question_code, stage, age_band, is_anchor, focus_area, layer, dimension,
           question_text, response_options, polarity, weight, logic, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)`,
        [concernAreaId, r.question_code, stage, r.age_band ?? null, !!r.is_anchor, r.focus_area ?? null,
         r.layer ?? null, r.dimension ?? null, r.question_text, r.response_options ?? null,
         r.polarity ?? null, r.weight != null ? String(r.weight) : '1', r.logic ?? null, i + 1]
      );
      inserted++;
    }
    res.json({ ok: true, inserted, mode });
  } catch (e: any) {
    console.error('[ShortAssess] upload error:', e);
    res.status(500).json({ error: 'Upload failed', detail: e?.message });
  }
});

export default router;
