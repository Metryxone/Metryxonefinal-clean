/**
 * CAPADEX Concern Intelligence Engine — Admin CRUD routes
 * Manages ci_categories and ci_clarification_questions tables.
 * Also exposes a cache-bust endpoint so the analyze engine reloads from DB.
 */
import type { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import { writeAuditEvent, AUDIT_EVENT } from '../lib/audit';

export function registerConcernIntelligenceAdminRoutes(app: Express, pool: Pool) {

  // ─── GET all categories ───────────────────────────────────────────────────
  app.get('/api/admin/ci/categories', async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM ci_categories ORDER BY sort_order, id`
      );
      res.json(rows);
    } catch (err) {
      console.error('[ci/categories GET]', err);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // ─── PATCH a category ─────────────────────────────────────────────────────
  app.patch('/api/admin/ci/categories/:key', async (req: Request, res: Response) => {
    const { key } = req.params;
    const {
      label, keywords, severity_high, severity_low,
      default_signals, patterns, subdomains,
      preview_templates, mirror_templates, sort_order, is_active,
    } = req.body;
    try {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (label            !== undefined) { sets.push(`label=$${i++}`);            vals.push(label); }
      if (keywords         !== undefined) { sets.push(`keywords=$${i++}`);         vals.push(keywords); }
      if (severity_high    !== undefined) { sets.push(`severity_high=$${i++}`);    vals.push(severity_high); }
      if (severity_low     !== undefined) { sets.push(`severity_low=$${i++}`);     vals.push(severity_low); }
      if (default_signals  !== undefined) { sets.push(`default_signals=$${i++}`);  vals.push(JSON.stringify(default_signals)); }
      if (patterns         !== undefined) { sets.push(`patterns=$${i++}`);         vals.push(JSON.stringify(patterns)); }
      if (subdomains       !== undefined) { sets.push(`subdomains=$${i++}`);       vals.push(JSON.stringify(subdomains)); }
      if (preview_templates !== undefined){ sets.push(`preview_templates=$${i++}`);vals.push(JSON.stringify(preview_templates)); }
      if (mirror_templates !== undefined) { sets.push(`mirror_templates=$${i++}`); vals.push(JSON.stringify(mirror_templates)); }
      if (sort_order       !== undefined) { sets.push(`sort_order=$${i++}`);       vals.push(sort_order); }
      if (is_active        !== undefined) { sets.push(`is_active=$${i++}`);        vals.push(is_active); }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
      sets.push(`updated_at=NOW()`);
      vals.push(key);
      const { rows } = await pool.query(
        `UPDATE ci_categories SET ${sets.join(',')} WHERE cat_key=$${i} RETURNING *`,
        vals
      );
      if (!rows.length) return res.status(404).json({ error: 'Category not found' });
      writeAuditEvent(pool, {
        event_type: AUDIT_EVENT.CONCERN_CATEGORY_UPDATED,
        actor:      'admin',
        payload:    { cat_key: key, fields: Object.keys(req.body) },
      });
      res.json(rows[0]);
    } catch (err) {
      console.error('[ci/categories PATCH]', err);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  // ─── GET questions (with optional ?category= & ?persona= filters) ─────────
  app.get('/api/admin/ci/questions', async (req: Request, res: Response) => {
    try {
      const { category, persona } = req.query;
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (category) { conds.push(`category=$${i++}`); vals.push(category); }
      if (persona === 'base') { conds.push(`persona IS NULL`); }
      else if (persona) { conds.push(`persona=$${i++}`); vals.push(persona); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM ci_clarification_questions ${where} ORDER BY category, persona NULLS FIRST, sort_order`,
        vals
      );
      res.json(rows);
    } catch (err) {
      console.error('[ci/questions GET]', err);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  });

  // ─── POST create question ─────────────────────────────────────────────────
  app.post('/api/admin/ci/questions', async (req: Request, res: Response) => {
    const { question_key, category, persona, sort_order, question, options } = req.body;
    if (!question_key || !category || !question || !options?.length) {
      return res.status(400).json({ error: 'question_key, category, question, and options are required' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO ci_clarification_questions
           (question_key, category, persona, sort_order, question, options)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [question_key, category, persona || null, sort_order ?? 0, question, JSON.stringify(options)]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ error: 'question_key already exists' });
      console.error('[ci/questions POST]', err);
      res.status(500).json({ error: 'Failed to create question' });
    }
  });

  // ─── PATCH question ───────────────────────────────────────────────────────
  app.patch('/api/admin/ci/questions/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { question_key, category, persona, sort_order, question, options, is_active } = req.body;
    try {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (question_key !== undefined) { sets.push(`question_key=$${i++}`); vals.push(question_key); }
      if (category     !== undefined) { sets.push(`category=$${i++}`);     vals.push(category); }
      if (persona      !== undefined) { sets.push(`persona=$${i++}`);      vals.push(persona || null); }
      if (sort_order   !== undefined) { sets.push(`sort_order=$${i++}`);   vals.push(sort_order); }
      if (question     !== undefined) { sets.push(`question=$${i++}`);     vals.push(question); }
      if (options      !== undefined) { sets.push(`options=$${i++}`);      vals.push(JSON.stringify(options)); }
      if (is_active    !== undefined) { sets.push(`is_active=$${i++}`);    vals.push(is_active); }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
      sets.push(`updated_at=NOW()`);
      vals.push(id);
      const { rows } = await pool.query(
        `UPDATE ci_clarification_questions SET ${sets.join(',')} WHERE id=$${i} RETURNING *`,
        vals
      );
      if (!rows.length) return res.status(404).json({ error: 'Question not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('[ci/questions PATCH]', err);
      res.status(500).json({ error: 'Failed to update question' });
    }
  });

  // ─── DELETE question ──────────────────────────────────────────────────────
  app.delete('/api/admin/ci/questions/:id', async (req: Request, res: Response) => {
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM ci_clarification_questions WHERE id=$1`, [req.params.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Question not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[ci/questions DELETE]', err);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  });

  // ─── POST seed — runs the migration SQL if tables are empty ──────────────
  app.post('/api/admin/ci/run-migration', async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ci_categories`);
      if (parseInt(rows[0].n) > 0) {
        return res.json({ message: 'Tables already seeded', count: parseInt(rows[0].n) });
      }
      res.json({ message: 'Run the migration SQL file manually to seed data' });
    } catch (err: any) {
      if (err.code === '42P01') {
        return res.status(400).json({ error: 'Tables do not exist yet — run the migration SQL first' });
      }
      res.status(500).json({ error: String(err.message) });
    }
  });
}
