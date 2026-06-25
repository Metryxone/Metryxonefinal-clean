import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import fs from 'fs';
import {
  ensureReportFactorySchema, generateReport,
  renderNarrative, evaluateInsightRule,
} from '../services/report-factory-schema';
import {
  renderReportToPDF, renderReportToCSV, renderReportToJSON,
  getExportFilePath, getContentType,
} from '../services/pdf-renderer';
import { computeBenchmark } from '../services/benchmark-engine';
import { resolveVizData } from '../services/viz-data-resolver';

// ── Feature flag ───────────────────────────────────────────────────────────
const FLAG = 'FF_REPORT_FACTORY';
function isEnabled(): boolean {
  const v = (process.env[FLAG] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
function gate(res: Response): boolean {
  if (!isEnabled()) { res.status(503).json({ error: 'Report Factory is not enabled', flag: FLAG }); return false; }
  return true;
}

// ── Simple admin cache (60s TTL) ──────────────────────────────────────────
const adminCache = new Map<string, { data: unknown; ts: number }>();
function getCache(k: string) { const e = adminCache.get(k); return e && Date.now() - e.ts < 60_000 ? e.data : null; }
function setCache(k: string, d: unknown) { adminCache.set(k, { data: d, ts: Date.now() }); }
function bustCache() { adminCache.clear(); }

export function registerReportFactoryRoutes(
  app: Express,
  pool: Pool,
  requireAuth: (req: Request, res: Response, next: () => void) => void,
  requireSuperAdmin: (req: Request, res: Response, next: () => void) => void,
): void {
  // Lazy schema init
  app.use('/api/rf', async (_req, res, next) => {
    if (!isEnabled()) return next();
    try { await ensureReportFactorySchema(pool); next(); } catch (e) { next(e); }
  });
  app.use('/api/admin/rf', async (_req, res, next) => {
    if (!isEnabled()) return next();
    try { await ensureReportFactorySchema(pool); next(); } catch (e) { next(e); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // ADMIN STATS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/admin/rf/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const cacheKey = 'rf:admin:stats';
    const cached = getCache(cacheKey);
    if (cached && !(req.query.refresh === '1')) return res.json({ stats: cached });
    try {
      const [t, n, ir, vc, bc, wl, lp, gr, ej] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM rf_templates WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_narrative_blocks WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_insight_rules WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_visualization_configs WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_benchmark_configs WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_white_label_configs WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_language_packs WHERE is_active=true`),
        pool.query(`SELECT COUNT(*) FROM rf_generated_reports`),
        pool.query(`SELECT COUNT(*) FROM rf_export_jobs`),
      ]);
      const stats = {
        templates:          Number(t.rows[0].count),
        narratives:         Number(n.rows[0].count),
        insight_rules:      Number(ir.rows[0].count),
        viz_configs:        Number(vc.rows[0].count),
        benchmark_configs:  Number(bc.rows[0].count),
        white_label_configs: Number(wl.rows[0].count),
        language_packs:     Number(lp.rows[0].count),
        generated_reports:  Number(gr.rows[0].count),
        export_jobs:        Number(ej.rows[0].count),
      };
      setCache(cacheKey, stats);
      res.json({ stats });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 1. REPORT TEMPLATE BUILDER
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/templates', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { report_type, language } = req.query;
      let q = `SELECT * FROM rf_templates WHERE 1=1`;
      const params: unknown[] = [];
      if (report_type) { params.push(report_type); q += ` AND report_type=$${params.length}`; }
      if (language)    { params.push(language);    q += ` AND language=$${params.length}`; }
      q += ` ORDER BY is_default DESC, created_at DESC`;
      const { rows } = await pool.query(q, params);
      res.json({ templates: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/templates', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { name, report_type = 'custom', description, layout, language = 'en', tags } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_templates (name,report_type,description,layout,language,tags)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, report_type, description ?? null, layout ? JSON.stringify(layout) : null, language, tags ?? []],
      );
      bustCache();
      res.status(201).json({ template: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/rf/templates/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_templates WHERE id=$1`, [id]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ template: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/templates/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['name','report_type','description','layout','version','is_active','is_default','tenant_id','language','tags','thumbnail_url'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { vals.push(k === 'layout' ? JSON.stringify(req.body[k]) : req.body[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(id); sets.push(`updated_at=NOW()`);
    try {
      const { rows } = await pool.query(`UPDATE rf_templates SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ template: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/templates/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try {
      await pool.query(`DELETE FROM rf_templates WHERE id=$1 AND is_default=false`, [id]);
      bustCache();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Template sections
  app.get('/api/rf/templates/:id/sections', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try {
      const { rows } = await pool.query(
        `SELECT * FROM rf_template_sections WHERE template_id=$1 ORDER BY order_index ASC`, [id],
      );
      res.json({ sections: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/templates/:id/sections', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const template_id = Number(req.params.id);
    if (!template_id) return res.status(400).json({ error: 'Invalid id' });
    const { section_key, section_type = 'custom', title, subtitle, config, order_index = 0, is_required = false, conditions, width = 'full' } = req.body;
    if (!section_key) return res.status(400).json({ error: 'section_key required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_template_sections (template_id,section_key,section_type,title,subtitle,config,order_index,is_required,conditions,width)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [template_id, section_key, section_type, title ?? null, subtitle ?? null,
         JSON.stringify(config ?? {}), order_index, is_required, JSON.stringify(conditions ?? {}), width],
      );
      res.status(201).json({ section: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/templates/sections/:sectionId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.sectionId);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['section_key','section_type','title','subtitle','config','order_index','is_required','is_visible','conditions','width'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(['config','conditions'].includes(k) ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id);
    try {
      const { rows } = await pool.query(`UPDATE rf_template_sections SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      res.json({ section: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/templates/sections/:sectionId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.sectionId);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try { await pool.query(`DELETE FROM rf_template_sections WHERE id=$1`, [id]); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 2. NARRATIVE BUILDER
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/narratives', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { tone, category, report_type } = req.query;
      let q = `SELECT * FROM rf_narrative_blocks WHERE 1=1`;
      const p: unknown[] = [];
      if (tone)        { p.push(tone);        q += ` AND tone=$${p.length}`; }
      if (category)    { p.push(category);    q += ` AND category=$${p.length}`; }
      if (report_type) { p.push(`{${report_type}}`); q += ` AND report_types @> $${p.length}::text[]`; }
      q += ` ORDER BY category, title`;
      const { rows } = await pool.query(q, p);
      res.json({ blocks: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/narratives', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { block_key, title, content, variables = [], report_types = [], tone = 'professional', category = 'general', language = 'en' } = req.body;
    if (!block_key || !title || !content) return res.status(400).json({ error: 'block_key, title, content required' });
    // auto-detect variables from {{slot}} syntax
    const detectedVars = [...new Set([...String(content).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
    const finalVars = variables.length ? variables : detectedVars;
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_narrative_blocks (block_key,title,content,variables,report_types,tone,category,language)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [block_key, title, content, JSON.stringify(finalVars), report_types, tone, category, language],
      );
      bustCache();
      res.status(201).json({ block: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/rf/narratives/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_narrative_blocks WHERE id=$1`, [id]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ block: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/narratives/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['title','content','variables','report_types','tone','category','language','is_active'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(k === 'variables' ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id); sets.push(`updated_at=NOW()`);
    try {
      const { rows } = await pool.query(`UPDATE rf_narrative_blocks SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ block: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/narratives/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try { await pool.query(`DELETE FROM rf_narrative_blocks WHERE id=$1`, [id]); bustCache(); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Narrative preview with sample variable substitution
  app.post('/api/rf/narratives/:id/preview', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_narrative_blocks WHERE id=$1`, [id]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      const block = rows[0];
      const sampleData = req.body.data ?? {};
      // fill missing slots with [slot_name] placeholder
      const rendered = renderNarrative(block.content, sampleData);
      res.json({ rendered, variables: block.variables });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 3. INSIGHT ENGINE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/insights/rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { severity, data_source, report_type } = req.query;
      let q = `SELECT * FROM rf_insight_rules WHERE 1=1`;
      const p: unknown[] = [];
      if (severity)    { p.push(severity);    q += ` AND severity=$${p.length}`; }
      if (data_source) { p.push(data_source); q += ` AND (data_source=$${p.length} OR data_source='any')`; }
      if (report_type) { p.push(`{${report_type}}`); q += ` AND report_types @> $${p.length}::text[]`; }
      q += ` ORDER BY priority DESC, title`;
      const { rows } = await pool.query(q, p);
      res.json({ rules: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/insights/rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { rule_key, title, description, condition_type = 'threshold', condition, insight_template, variables = [],
            severity = 'info', priority = 50, report_types = [], data_source = 'any' } = req.body;
    if (!rule_key || !title || !condition || !insight_template)
      return res.status(400).json({ error: 'rule_key, title, condition, insight_template required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_insight_rules (rule_key,title,description,condition_type,condition,insight_template,variables,severity,priority,report_types,data_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [rule_key, title, description ?? null, condition_type, JSON.stringify(condition),
         insight_template, JSON.stringify(variables), severity, priority, report_types, data_source],
      );
      bustCache();
      res.status(201).json({ rule: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/insights/rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['title','description','condition_type','condition','insight_template','variables','severity','priority','report_types','data_source','is_active'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(['condition','variables'].includes(k) ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id); sets.push(`updated_at=NOW()`);
    try {
      const { rows } = await pool.query(`UPDATE rf_insight_rules SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ rule: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/insights/rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try { await pool.query(`DELETE FROM rf_insight_rules WHERE id=$1`, [id]); bustCache(); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Evaluate rules against provided data (dry-run)
  app.post('/api/rf/insights/evaluate', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { data = {}, report_type, rule_keys } = req.body;
      let q = `SELECT * FROM rf_insight_rules WHERE is_active=true`;
      const p: unknown[] = [];
      if (rule_keys?.length) { p.push(rule_keys); q += ` AND rule_key = ANY($${p.length})`; }
      if (report_type) { p.push(`{${report_type}}`); q += ` AND (report_types @> $${p.length}::text[] OR report_types = '{}')`; }
      q += ` ORDER BY priority DESC`;
      const { rows } = await pool.query(q, p);
      const fired = rows.filter(r => evaluateInsightRule(r, data)).map(r => ({
        rule_key: r.rule_key, title: r.title,
        text: renderNarrative(r.insight_template, data),
        severity: r.severity, priority: r.priority,
      }));
      res.json({ fired, total_rules: rows.length, fired_count: fired.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 4. VISUALIZATION ENGINE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/visualizations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { chart_type, data_source } = req.query;
      let q = `SELECT * FROM rf_visualization_configs WHERE 1=1`;
      const p: unknown[] = [];
      if (chart_type)  { p.push(chart_type);  q += ` AND chart_type=$${p.length}`; }
      if (data_source) { p.push(data_source); q += ` AND data_source=$${p.length}`; }
      q += ` ORDER BY title`;
      const { rows } = await pool.query(q, p);
      res.json({ configs: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/visualizations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { config_key, title, description, chart_type = 'bar', data_source = 'custom',
            data_binding = {}, style_config = {}, dimensions = [], color_palette = [], report_types = [] } = req.body;
    if (!config_key || !title) return res.status(400).json({ error: 'config_key, title required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_visualization_configs (config_key,title,description,chart_type,data_source,data_binding,style_config,dimensions,color_palette,report_types)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [config_key, title, description ?? null, chart_type, data_source,
         JSON.stringify(data_binding), JSON.stringify(style_config), JSON.stringify(dimensions), color_palette, report_types],
      );
      bustCache();
      res.status(201).json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/visualizations/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['title','description','chart_type','data_source','data_binding','style_config','dimensions','color_palette','report_types','is_active'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(['data_binding','style_config','dimensions'].includes(k) ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id); sets.push(`updated_at=NOW()`);
    try {
      const { rows } = await pool.query(`UPDATE rf_visualization_configs SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Live data for a visualization config — used by the admin chart preview + report generation
  app.get('/api/rf/visualizations/:id/data', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const cfgRes = await pool.query(`SELECT config_key FROM rf_visualization_configs WHERE id=$1`, [req.params.id]);
      if (!cfgRes.rows.length) return res.status(404).json({ error: 'Config not found' });
      const data = await resolveVizData(pool, {
        configKey: cfgRes.rows[0].config_key,
        userId: req.query.user_id as string | undefined,
        sessionId: req.query.session_id as string | undefined,
      });
      res.json({ data });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/visualizations/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try { await pool.query(`DELETE FROM rf_visualization_configs WHERE id=$1`, [id]); bustCache(); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 5. BENCHMARK ENGINE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/benchmarks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_benchmark_configs WHERE is_active=true ORDER BY benchmark_type, title`);
      res.json({ configs: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/benchmarks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { config_key, title, description, benchmark_type = 'peer', cohort_definition = {},
            metrics = [], aggregations, percentile_bands, min_cohort_size = 30, display_format = 'percentile', report_types = [] } = req.body;
    if (!config_key || !title) return res.status(400).json({ error: 'config_key, title required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_benchmark_configs (config_key,title,description,benchmark_type,cohort_definition,metrics,aggregations,percentile_bands,min_cohort_size,display_format,report_types)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [config_key, title, description ?? null, benchmark_type, JSON.stringify(cohort_definition), metrics,
         aggregations ? JSON.stringify(aggregations) : null, percentile_bands ? JSON.stringify(percentile_bands) : null,
         min_cohort_size, display_format, report_types],
      );
      bustCache();
      res.status(201).json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/benchmarks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['title','description','benchmark_type','cohort_definition','metrics','aggregations','percentile_bands','min_cohort_size','display_format','report_types','is_active'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(['cohort_definition','aggregations','percentile_bands'].includes(k) ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id);
    try {
      const { rows } = await pool.query(`UPDATE rf_benchmark_configs SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Compute live benchmark for a given config + user context
  app.post('/api/rf/benchmarks/:id/compute', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const cfgRes = await pool.query(`SELECT config_key FROM rf_benchmark_configs WHERE id=$1`, [req.params.id]);
      if (!cfgRes.rows.length) return res.status(404).json({ error: 'Config not found' });
      const userContext: Record<string, unknown> = {
        ...req.body,
        age_band: req.body.age_band,
        stage_code: req.body.stage_code,
        persona: req.body.persona,
        concern_name: req.body.concern_name,
      };
      const results = await computeBenchmark(pool, cfgRes.rows[0].config_key, userContext);
      res.json({ results, config_key: cfgRes.rows[0].config_key });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/benchmarks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    try { await pool.query(`DELETE FROM rf_benchmark_configs WHERE id=$1`, [id]); bustCache(); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 6. PDF GENERATOR (export pipeline)
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.post('/api/rf/export', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const userId = (req as any).user?.id ?? (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { report_id, format = 'pdf', config = {} } = req.body;
    if (!format || !['pdf','csv','json','xlsx'].includes(format))
      return res.status(400).json({ error: "format must be one of: pdf, csv, json, xlsx" });
    if (!report_id) return res.status(400).json({ error: 'report_id required' });
    try {
      const rpt = await pool.query(`SELECT * FROM rf_generated_reports WHERE id=$1`, [report_id]);
      if (!rpt.rows.length) return res.status(404).json({ error: 'Report not found' });
      const report = rpt.rows[0];

      const { rows } = await pool.query(
        `INSERT INTO rf_export_jobs (report_id,format,config,requested_by,status) VALUES ($1,$2,$3,$4,'processing') RETURNING *`,
        [report_id, format, JSON.stringify(config), String(userId)],
      );
      const job = rows[0];

      res.status(201).json({ job, message: 'Export processing — poll /api/rf/exports/:jobUuid for status, then /api/rf/exports/:jobUuid/download to retrieve file' });

      // Fire-and-forget rendering (fast — pdfkit is synchronous in-process)
      setImmediate(async () => {
        try {
          let wlConfig: Record<string, unknown> | undefined;
          if (report.tenant_id) {
            const wl = await pool.query(
              `SELECT * FROM rf_white_label_configs WHERE tenant_id=$1 AND is_active=true LIMIT 1`, [report.tenant_id],
            ).catch(() => ({ rows: [] as any[] }));
            if (wl.rows.length) wlConfig = wl.rows[0];
          }

          let filePath: string;
          if (format === 'pdf') {
            filePath = await renderReportToPDF(report, wlConfig as any);
          } else if (format === 'csv' || format === 'xlsx') {
            filePath = getExportFilePath(job.job_uuid, format);
            fs.mkdirSync(require('path').dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, renderReportToCSV(report), 'utf8');
          } else {
            filePath = getExportFilePath(job.job_uuid, 'json');
            fs.mkdirSync(require('path').dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, renderReportToJSON(report), 'utf8');
          }

          await pool.query(
            `UPDATE rf_export_jobs SET status='done', completed_at=NOW(), output_url=$1 WHERE id=$2`,
            [filePath, job.id],
          );
        } catch (renderErr: any) {
          await pool.query(
            `UPDATE rf_export_jobs SET status='failed', error_message=$1 WHERE id=$2`,
            [String(renderErr?.message ?? renderErr), job.id],
          ).catch(() => {});
        }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/rf/exports', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
      const { rows } = await pool.query(
        `SELECT ej.*, rr.report_type FROM rf_export_jobs ej
         LEFT JOIN rf_generated_reports rr ON rr.id=ej.report_id
         ORDER BY ej.created_at DESC LIMIT $1`, [limit],
      );
      res.json({ jobs: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/rf/exports/:jobUuid', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_export_jobs WHERE job_uuid=$1`, [req.params.jobUuid]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ job: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Download the rendered file once job status = 'done'
  app.get('/api/rf/exports/:jobUuid/download', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(
        `SELECT ej.*, rr.report_uuid FROM rf_export_jobs ej
         LEFT JOIN rf_generated_reports rr ON rr.id=ej.report_id
         WHERE ej.job_uuid=$1`, [req.params.jobUuid],
      );
      if (!rows.length) return res.status(404).json({ error: 'Job not found' });
      const job = rows[0];
      if (job.status === 'processing' || job.status === 'queued')
        return res.status(202).json({ status: job.status, message: 'File is still rendering — retry shortly' });
      if (job.status === 'failed')
        return res.status(500).json({ status: 'failed', error: job.error_message ?? 'Rendering failed' });
      const filePath: string = job.output_url;
      if (!filePath || !fs.existsSync(filePath))
        return res.status(404).json({ error: 'Rendered file not found on disk' });
      const fmt: string = job.format ?? 'pdf';
      const filename = `report_${job.report_uuid ?? job.id}.${fmt === 'xlsx' ? 'csv' : fmt}`;
      res.setHeader('Content-Type', getContentType(fmt));
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 7. WHITE LABEL ENGINE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/white-label', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_white_label_configs ORDER BY org_name`);
      res.json({ configs: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/white-label', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { tenant_id, org_name, logo_url, favicon_url, primary_color = '#6366f1', secondary_color = '#8b5cf6',
            accent_color = '#10b981', text_color = '#111827', font_family = 'Inter, sans-serif',
            report_header, report_footer, custom_css, allowed_report_types = [], contact_email, privacy_url } = req.body;
    if (!tenant_id || !org_name) return res.status(400).json({ error: 'tenant_id, org_name required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_white_label_configs (tenant_id,org_name,logo_url,favicon_url,primary_color,secondary_color,accent_color,text_color,font_family,report_header,report_footer,custom_css,allowed_report_types,contact_email,privacy_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [tenant_id, org_name, logo_url ?? null, favicon_url ?? null, primary_color, secondary_color,
         accent_color, text_color, font_family, report_header ?? null, report_footer ?? null,
         custom_css ?? null, allowed_report_types, contact_email ?? null, privacy_url ?? null],
      );
      bustCache();
      res.status(201).json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/white-label/:tenantId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const tenantId = req.params.tenantId;
    const allowed = ['org_name','logo_url','favicon_url','primary_color','secondary_color','accent_color','text_color','font_family','report_header','report_footer','custom_css','allowed_report_types','contact_email','privacy_url','is_active'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { vals.push(req.body[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(tenantId); sets.push(`updated_at=NOW()`);
    try {
      const { rows } = await pool.query(`UPDATE rf_white_label_configs SET ${sets.join(',')} WHERE tenant_id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/rf/white-label/:tenantId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      await pool.query(`DELETE FROM rf_white_label_configs WHERE tenant_id=$1`, [req.params.tenantId]);
      bustCache();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Get config by tenant (public — used by report renderer)
  app.get('/api/rf/white-label/:tenantId', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(
        `SELECT id,tenant_id,org_name,logo_url,primary_color,secondary_color,accent_color,text_color,font_family,report_header,report_footer,allowed_report_types FROM rf_white_label_configs WHERE tenant_id=$1 AND is_active=true`,
        [req.params.tenantId],
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ config: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // 8. MULTI-LANGUAGE ENGINE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.get('/api/rf/languages', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_language_packs ORDER BY is_default DESC, is_active DESC, language_name`);
      res.json({ packs: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rf/languages', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const { language_code, language_name, native_name, translations = {}, report_types = [], rtl = false } = req.body;
    if (!language_code || !language_name || !native_name) return res.status(400).json({ error: 'language_code, language_name, native_name required' });
    const pct = Object.keys(translations).length > 0 ? Math.min(100, Math.round(Object.keys(translations).length / 50 * 100)) : 0;
    try {
      const { rows } = await pool.query(
        `INSERT INTO rf_language_packs (language_code,language_name,native_name,translations,report_types,rtl,completeness_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [language_code, language_name, native_name, JSON.stringify(translations), report_types, rtl, pct],
      );
      bustCache();
      res.status(201).json({ pack: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/rf/languages/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['language_name','native_name','translations','report_types','completeness_pct','is_active','is_default','rtl'];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        vals.push(k === 'translations' ? JSON.stringify(req.body[k]) : req.body[k]);
        sets.push(`${k}=$${vals.length}`);
      }
    }
    // auto-recompute completeness if translations provided
    if (req.body.translations) {
      const pct = Math.min(100, Math.round(Object.keys(req.body.translations).length / 50 * 100));
      vals.push(pct); sets.push(`completeness_pct=$${vals.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' });
    vals.push(id); sets.push(`updated_at=NOW()`);
    try {
      const { rows } = await pool.query(`UPDATE rf_language_packs SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      bustCache();
      res.json({ pack: rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // REPORT GENERATION
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  app.post('/api/rf/generate', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const userId = (req as any).user?.id ?? (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { template_id, data = {}, language = 'en', tenant_id, session_id } = req.body;
    if (!template_id) return res.status(400).json({ error: 'template_id required' });
    try {
      const report = await generateReport(pool, { templateId: template_id, data, language, tenantId: tenant_id, userId: String(userId), sessionId: session_id });
      res.status(201).json({ report });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/rf/reports', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { report_type, status } = req.query;
    try {
      let q = `SELECT id,report_uuid,template_id,user_id,session_id,report_type,language,tenant_id,status,insights,created_at,completed_at FROM rf_generated_reports WHERE 1=1`;
      const p: unknown[] = [];
      if (report_type) { p.push(report_type); q += ` AND report_type=$${p.length}`; }
      if (status)      { p.push(status);      q += ` AND status=$${p.length}`; }
      p.push(limit); q += ` ORDER BY created_at DESC LIMIT $${p.length}`;
      const { rows } = await pool.query(q, p);
      res.json({ reports: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Candidate-facing list: a user's OWN generated reports (scoped to user_id).
  // requireAuth only (no super-admin) — never leaks other users' reports.
  app.get('/api/rf/my-reports', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    const userId = (req as any).user?.id ?? (req as any).session?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { report_type } = req.query;
    try {
      let q = `SELECT id,report_uuid,template_id,user_id,session_id,report_type,language,tenant_id,status,insights,created_at,completed_at FROM rf_generated_reports WHERE user_id=$1`;
      const p: unknown[] = [String(userId)];
      if (report_type) { p.push(report_type); q += ` AND report_type=$${p.length}`; }
      p.push(limit); q += ` ORDER BY created_at DESC LIMIT $${p.length}`;
      const { rows } = await pool.query(q, p);
      res.json({ reports: rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/rf/reports/:reportUuid', requireAuth, async (req: Request, res: Response) => {
    if (!gate(res)) return;
    try {
      const { rows } = await pool.query(`SELECT * FROM rf_generated_reports WHERE report_uuid=$1`, [req.params.reportUuid]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      const report = rows[0];
      // Ownership check: a candidate may view ONLY their own report. Super-admins
      // (and the admin Report Factory panel) may view any. Report user_id is
      // stored as String(userId) at generate-time (see /api/rf/generate).
      const u = (req as any).user;
      const userId = u?.id ?? (req as any).session?.userId;
      const roles: string[] = u?.roles ?? (u?.role ? [u.role] : []);
      const isSuperAdmin = roles.includes('super_admin');
      if (!isSuperAdmin && (!userId || String(report.user_id) !== String(userId))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      res.json({ report });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
