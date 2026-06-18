/**
 * Ontology Supplementary Routes — M07 Competency Levels · M09 Indicators · M13 Benchmarks
 *
 * M07: GET/POST/PATCH/DELETE /api/ontology/competency-levels
 * M09: GET/POST/PATCH/DELETE /api/ontology/indicators
 * M13: GET/POST/PATCH/DELETE /api/ontology/benchmarks
 *      GET/POST/DELETE       /api/ontology/benchmarks/:id/items
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

export async function ensureSupplementarySchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_competency_level_anchors (
      id SERIAL PRIMARY KEY, competency_code VARCHAR(60) NOT NULL, competency_name VARCHAR(200) NOT NULL,
      proficiency_level VARCHAR(20) NOT NULL, level_number SMALLINT NOT NULL,
      score_band_min NUMERIC(5,2) NOT NULL DEFAULT 0, score_band_max NUMERIC(5,2) NOT NULL DEFAULT 100,
      behavioural_anchors TEXT[] NOT NULL, sample_evidence TEXT[], learning_actions TEXT[],
      is_active BOOLEAN NOT NULL DEFAULT true, created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (competency_code, proficiency_level)
    );
    CREATE TABLE IF NOT EXISTS ont_indicators (
      id SERIAL PRIMARY KEY, code VARCHAR(60) NOT NULL UNIQUE, label VARCHAR(250) NOT NULL,
      concern_bridge_tag VARCHAR(120) NOT NULL, signal_type VARCHAR(30) NOT NULL DEFAULT 'behavioural',
      polarity VARCHAR(10) NOT NULL DEFAULT 'negative', weight NUMERIC(4,3) NOT NULL DEFAULT 0.500,
      description TEXT, observable_threshold TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_benchmarks (
      id SERIAL PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
      description TEXT, benchmark_type VARCHAR(30) NOT NULL DEFAULT 'role',
      role_id INTEGER, industry_id INTEGER, function_id INTEGER, seniority_level VARCHAR(20),
      sample_size INTEGER NOT NULL DEFAULT 0, is_suppressed BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true, status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_benchmark_items (
      id SERIAL PRIMARY KEY, benchmark_id INTEGER NOT NULL REFERENCES ont_benchmarks(id) ON DELETE CASCADE,
      competency_code VARCHAR(60) NOT NULL, competency_name VARCHAR(200) NOT NULL,
      p25_score NUMERIC(5,2), p50_score NUMERIC(5,2), p75_score NUMERIC(5,2), p90_score NUMERIC(5,2),
      mean_score NUMERIC(5,2), std_dev NUMERIC(5,2),
      is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export function registerOntologySupplementaryRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── M07 Competency Level Anchors ──────────────────────────────────────────
  app.get('/api/ontology/competency-levels', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { search = '', competency_code = '' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (competency_code) { params.push(competency_code); conds.push(`competency_code = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(competency_name ILIKE $${params.length} OR competency_code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM ont_competency_level_anchors ${where} ORDER BY competency_code, level_number LIMIT 500`,
        params
      );
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch competency levels' }); }
  });

  app.post('/api/ontology/competency-levels', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { competency_code, competency_name, proficiency_level, level_number, score_band_min = 0, score_band_max = 100, behavioural_anchors, sample_evidence, learning_actions } = req.body ?? {};
      if (!competency_code || !proficiency_level) return res.status(400).json({ error: 'competency_code and proficiency_level required' });
      if (!Array.isArray(behavioural_anchors) || behavioural_anchors.length < 2) return res.status(400).json({ error: 'behavioural_anchors must be an array with at least 2 items' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_competency_level_anchors (competency_code, competency_name, proficiency_level, level_number, score_band_min, score_band_max, behavioural_anchors, sample_evidence, learning_actions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (competency_code, proficiency_level) DO UPDATE
         SET competency_name=EXCLUDED.competency_name, level_number=EXCLUDED.level_number,
             score_band_min=EXCLUDED.score_band_min, score_band_max=EXCLUDED.score_band_max,
             behavioural_anchors=EXCLUDED.behavioural_anchors, sample_evidence=EXCLUDED.sample_evidence,
             learning_actions=EXCLUDED.learning_actions, updated_at=NOW()
         RETURNING *`,
        [competency_code, competency_name, proficiency_level, level_number, score_band_min, score_band_max, behavioural_anchors, sample_evidence || null, learning_actions || null]
      );
      void logAudit(pool, req, { action: 'create', entityType: 'competency-level', entityId: row.id, entityLabel: `${competency_code} / ${proficiency_level}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err) { console.error('[competency-levels] POST error:', err); return res.status(500).json({ error: 'Failed to save' }); }
  });

  app.patch('/api/ontology/competency-levels/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const id = parseInt(req.params.id);
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_competency_level_anchors WHERE id=$1`, [id]);
      const { competency_name, proficiency_level, level_number, score_band_min, score_band_max, behavioural_anchors, sample_evidence, learning_actions, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_competency_level_anchors SET
         competency_name=COALESCE($1,competency_name), proficiency_level=COALESCE($2,proficiency_level),
         level_number=COALESCE($3,level_number), score_band_min=COALESCE($4,score_band_min),
         score_band_max=COALESCE($5,score_band_max), behavioural_anchors=COALESCE($6,behavioural_anchors),
         sample_evidence=COALESCE($7,sample_evidence), learning_actions=COALESCE($8,learning_actions),
         is_active=COALESCE($9,is_active), updated_at=NOW() WHERE id=$10 RETURNING *`,
        [competency_name, proficiency_level, level_number, score_band_min, score_band_max, behavioural_anchors, sample_evidence, learning_actions, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'competency-level', entityId: id, entityLabel: `${row.competency_code} / ${row.proficiency_level}`, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update' }); }
  });

  app.delete('/api/ontology/competency-levels/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      await pool.query(`UPDATE ont_competency_level_anchors SET is_active=false, updated_at=NOW() WHERE id=$1`, [parseInt(req.params.id)]);
      void logAudit(pool, req, { action: 'archive', entityType: 'competency-level', entityId: req.params.id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete' }); }
  });

  // ── M09 Indicators ────────────────────────────────────────────────────────
  app.get('/api/ontology/indicators', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { search = '', status = 'all', signal_type = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status = $${params.length}`); }
      if (signal_type !== 'all') { params.push(signal_type); conds.push(`signal_type = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(label ILIKE $${params.length} OR code ILIKE $${params.length} OR concern_bridge_tag ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM ont_indicators ${where} ORDER BY concern_bridge_tag, code LIMIT 500`, params);
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch indicators' }); }
  });

  app.post('/api/ontology/indicators', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { code, label, concern_bridge_tag, signal_type = 'behavioural', polarity = 'negative', weight = 0.5, description, observable_threshold } = req.body ?? {};
      if (!code || !label || !concern_bridge_tag) return res.status(400).json({ error: 'code, label, concern_bridge_tag required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_indicators (code, label, concern_bridge_tag, signal_type, polarity, weight, description, observable_threshold)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code, label, concern_bridge_tag, signal_type, polarity, weight, description, observable_threshold]
      );
      void logAudit(pool, req, { action: 'create', entityType: 'indicator', entityId: row.id, entityLabel: `${code} — ${label}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create indicator' });
    }
  });

  app.patch('/api/ontology/indicators/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const id = parseInt(req.params.id);
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_indicators WHERE id=$1`, [id]);
      const { label, concern_bridge_tag, signal_type, polarity, weight, description, observable_threshold, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_indicators SET label=COALESCE($1,label), concern_bridge_tag=COALESCE($2,concern_bridge_tag),
         signal_type=COALESCE($3,signal_type), polarity=COALESCE($4,polarity), weight=COALESCE($5,weight),
         description=COALESCE($6,description), observable_threshold=COALESCE($7,observable_threshold),
         status=COALESCE($8,status), is_active=COALESCE($9,is_active), updated_at=NOW()
         WHERE id=$10 RETURNING *`,
        [label, concern_bridge_tag, signal_type, polarity, weight, description, observable_threshold, status, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'indicator', entityId: id, entityLabel: row.label, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update indicator' }); }
  });

  app.delete('/api/ontology/indicators/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      await pool.query(`UPDATE ont_indicators SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1`, [parseInt(req.params.id)]);
      void logAudit(pool, req, { action: 'archive', entityType: 'indicator', entityId: req.params.id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete indicator' }); }
  });

  // ── M13 Benchmarks ────────────────────────────────────────────────────────
  app.get('/api/ontology/benchmarks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { search = '', benchmark_type = 'all', status = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`b.status = $${params.length}`); }
      if (benchmark_type !== 'all') { params.push(benchmark_type); conds.push(`b.benchmark_type = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(b.name ILIKE $${params.length} OR b.code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT b.*, r.title AS role_title,
           (SELECT COUNT(*) FROM ont_benchmark_items WHERE benchmark_id = b.id)::int AS item_count
         FROM ont_benchmarks b LEFT JOIN ont_roles r ON r.id = b.role_id
         ${where} ORDER BY b.benchmark_type, b.name LIMIT 200`,
        params
      );
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch benchmarks' }); }
  });

  app.post('/api/ontology/benchmarks', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { code, name, description, benchmark_type = 'role', role_id, industry_id, function_id, seniority_level, sample_size = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const is_suppressed = sample_size > 0 && sample_size < 30;
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_benchmarks (code, name, description, benchmark_type, role_id, industry_id, function_id, seniority_level, sample_size, is_suppressed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [code, name, description, benchmark_type, role_id || null, industry_id || null, function_id || null, seniority_level, sample_size, is_suppressed]
      );
      void logAudit(pool, req, { action: 'create', entityType: 'benchmark', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create benchmark' });
    }
  });

  app.patch('/api/ontology/benchmarks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const id = parseInt(req.params.id);
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_benchmarks WHERE id=$1`, [id]);
      const { name, description, benchmark_type, role_id, industry_id, function_id, seniority_level, sample_size, status, is_active } = req.body ?? {};
      const is_suppressed = sample_size != null ? (sample_size > 0 && sample_size < 30) : undefined;
      const { rows: [row] } = await pool.query(
        `UPDATE ont_benchmarks SET name=COALESCE($1,name), description=COALESCE($2,description),
         benchmark_type=COALESCE($3,benchmark_type), role_id=COALESCE($4,role_id),
         industry_id=COALESCE($5,industry_id), function_id=COALESCE($6,function_id),
         seniority_level=COALESCE($7,seniority_level), sample_size=COALESCE($8,sample_size),
         is_suppressed=COALESCE($9,is_suppressed), status=COALESCE($10,status),
         is_active=COALESCE($11,is_active), updated_at=NOW() WHERE id=$12 RETURNING *`,
        [name, description, benchmark_type, role_id, industry_id, function_id, seniority_level, sample_size, is_suppressed ?? null, status, is_active, id]
      );
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'benchmark', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update benchmark' }); }
  });

  app.delete('/api/ontology/benchmarks/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      await pool.query(`UPDATE ont_benchmarks SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1`, [parseInt(req.params.id)]);
      void logAudit(pool, req, { action: 'archive', entityType: 'benchmark', entityId: req.params.id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete benchmark' }); }
  });

  // Benchmark Items
  app.get('/api/ontology/benchmarks/:id/items', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const { rows } = await pool.query(`SELECT * FROM ont_benchmark_items WHERE benchmark_id=$1 ORDER BY competency_code`, [req.params.id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch items' }); }
  });

  app.post('/api/ontology/benchmarks/:id/items', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      const bid = parseInt(req.params.id);
      const { competency_code, competency_name, p25_score, p50_score, p75_score, p90_score, mean_score, std_dev } = req.body ?? {};
      if (!competency_code) return res.status(400).json({ error: 'competency_code required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_benchmark_items (benchmark_id, competency_code, competency_name, p25_score, p50_score, p75_score, p90_score, mean_score, std_dev)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [bid, competency_code, competency_name, p25_score, p50_score, p75_score, p90_score, mean_score, std_dev]
      );
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to add benchmark item' }); }
  });

  app.delete('/api/ontology/benchmarks/:id/items/:iid', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSupplementarySchema(pool);
      await pool.query(`DELETE FROM ont_benchmark_items WHERE id=$1 AND benchmark_id=$2`, [req.params.iid, req.params.id]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete item' }); }
  });
}
