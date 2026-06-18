/**
 * Ontology Competency Core Routes
 *
 * Entities: Layer · Competency Cluster · Competency · Micro Competency
 *
 * GET/POST/PATCH/DELETE /api/ontology/layers
 * GET/POST/PATCH/DELETE /api/ontology/clusters
 * GET/POST/PATCH/DELETE /api/ontology/competencies
 * GET/POST/PATCH/DELETE /api/ontology/micro-competencies
 *
 * Mapping queries (read-only):
 * GET /api/ontology/layers/:id/clusters        — clusters in a layer
 * GET /api/ontology/clusters/:id/competencies  — competencies in a cluster
 * GET /api/ontology/competencies/:id/micros    — micros for a competency
 *
 * Map mutations:
 * POST   /api/ontology/layers/:id/clusters/:clusterId
 * DELETE /api/ontology/layers/:id/clusters/:clusterId
 * POST   /api/ontology/clusters/:id/competencies/:compId
 * DELETE /api/ontology/clusters/:id/competencies/:compId
 * POST   /api/ontology/roles/:id/layers/:layerId
 * DELETE /api/ontology/roles/:id/layers/:layerId
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

export async function ensureCompetencyCoreSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_layers (
      id                    SERIAL        PRIMARY KEY,
      code                  VARCHAR(30)   NOT NULL UNIQUE,
      name                  VARCHAR(120)  NOT NULL,
      description           TEXT,
      layer_type            VARCHAR(30)   NOT NULL DEFAULT 'proficiency',
      applies_to_seniority  TEXT[],
      scoring_weight        NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
      sort_order            SMALLINT      NOT NULL DEFAULT 0,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
      version               INTEGER       NOT NULL DEFAULT 1,
      created_by            TEXT,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_competency_clusters (
      id              SERIAL        PRIMARY KEY,
      code            VARCHAR(30)   NOT NULL UNIQUE,
      name            VARCHAR(150)  NOT NULL,
      description     TEXT,
      layer_id        INTEGER       REFERENCES ont_layers(id) ON DELETE SET NULL,
      category        VARCHAR(30),
      icon_name       VARCHAR(60),
      color_hex       VARCHAR(7),
      weight_default  NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
      sort_order      SMALLINT      NOT NULL DEFAULT 0,
      is_active       BOOLEAN       NOT NULL DEFAULT true,
      status          VARCHAR(20)   NOT NULL DEFAULT 'draft',
      version         INTEGER       NOT NULL DEFAULT 1,
      created_by      TEXT,
      reviewed_at     TIMESTAMPTZ,
      reviewed_by     TEXT,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_competencies (
      id                  SERIAL        PRIMARY KEY,
      code                VARCHAR(40)   NOT NULL UNIQUE,
      name                VARCHAR(180)  NOT NULL,
      description         TEXT,
      cluster_id          INTEGER       REFERENCES ont_competency_clusters(id) ON DELETE SET NULL,
      category            VARCHAR(30),
      competency_type     VARCHAR(30)   NOT NULL DEFAULT 'core',
      assessment_methods  TEXT[],
      is_measurable       BOOLEAN       NOT NULL DEFAULT true,
      is_threshold        BOOLEAN       NOT NULL DEFAULT false,
      weight_default      NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
      development_guide   TEXT,
      external_ref        VARCHAR(80),
      sort_order          SMALLINT      NOT NULL DEFAULT 0,
      is_active           BOOLEAN       NOT NULL DEFAULT true,
      status              VARCHAR(20)   NOT NULL DEFAULT 'draft',
      version             INTEGER       NOT NULL DEFAULT 1,
      created_by          TEXT,
      reviewed_at         TIMESTAMPTZ,
      reviewed_by         TEXT,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_micro_competencies (
      id                    SERIAL        PRIMARY KEY,
      code                  VARCHAR(50)   NOT NULL UNIQUE,
      name                  VARCHAR(200)  NOT NULL,
      description           TEXT,
      competency_id         INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE RESTRICT,
      proficiency_level     VARCHAR(20),
      observable_behavior   TEXT          NOT NULL DEFAULT '',
      absence_indicator     TEXT,
      development_focus     TEXT,
      assessment_hint       TEXT,
      irt_b                 NUMERIC(6,4),
      sort_order            SMALLINT      NOT NULL DEFAULT 0,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
      version               INTEGER       NOT NULL DEFAULT 1,
      created_by            TEXT,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS map_role_layer (
      id                    SERIAL        PRIMARY KEY,
      role_id               INTEGER       NOT NULL,
      layer_id              INTEGER       NOT NULL REFERENCES ont_layers(id) ON DELETE CASCADE,
      required_proficiency  VARCHAR(20),
      is_mandatory          BOOLEAN       NOT NULL DEFAULT true,
      sort_order            SMALLINT      NOT NULL DEFAULT 0,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (role_id, layer_id)
    );
    CREATE TABLE IF NOT EXISTS map_layer_cluster (
      id          SERIAL        PRIMARY KEY,
      layer_id    INTEGER       NOT NULL REFERENCES ont_layers(id) ON DELETE CASCADE,
      cluster_id  INTEGER       NOT NULL REFERENCES ont_competency_clusters(id) ON DELETE CASCADE,
      weight      NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
      sort_order  SMALLINT      NOT NULL DEFAULT 0,
      is_active   BOOLEAN       NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (layer_id, cluster_id)
    );
    CREATE TABLE IF NOT EXISTS map_cluster_competency (
      id              SERIAL        PRIMARY KEY,
      cluster_id      INTEGER       NOT NULL REFERENCES ont_competency_clusters(id) ON DELETE CASCADE,
      competency_id   INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
      weight_override NUMERIC(5,3),
      sort_order      SMALLINT      NOT NULL DEFAULT 0,
      is_primary      BOOLEAN       NOT NULL DEFAULT false,
      is_active       BOOLEAN       NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (cluster_id, competency_id)
    );
    CREATE TABLE IF NOT EXISTS map_role_competency (
      id                  SERIAL        PRIMARY KEY,
      role_id             INTEGER       NOT NULL,
      competency_id       INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
      importance_tier     VARCHAR(20)   NOT NULL DEFAULT 'core',
      weight              NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
      min_proficiency     VARCHAR(20),
      target_proficiency  VARCHAR(20),
      source              VARCHAR(20)   NOT NULL DEFAULT 'derived',
      is_active           BOOLEAN       NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (role_id, competency_id)
    );
    CREATE TABLE IF NOT EXISTS map_competency_proficiency (
      id                    SERIAL        PRIMARY KEY,
      competency_id         INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
      proficiency_level     VARCHAR(20)   NOT NULL,
      score_band_min        NUMERIC(5,2)  NOT NULL DEFAULT 0,
      score_band_max        NUMERIC(5,2)  NOT NULL DEFAULT 100,
      behavioural_anchors   TEXT[],
      sample_evidence       TEXT[],
      development_actions   TEXT[],
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (competency_id, proficiency_level)
    );
    CREATE INDEX IF NOT EXISTS ont_clusters_layer_idx        ON ont_competency_clusters(layer_id);
    CREATE INDEX IF NOT EXISTS ont_competencies_cluster_idx  ON ont_competencies(cluster_id);
    CREATE INDEX IF NOT EXISTS ont_micro_comp_comp_id_idx    ON ont_micro_competencies(competency_id);
    CREATE INDEX IF NOT EXISTS map_role_layer_role_idx       ON map_role_layer(role_id);
    CREATE INDEX IF NOT EXISTS map_role_layer_layer_idx      ON map_role_layer(layer_id);
    CREATE INDEX IF NOT EXISTS map_layer_cluster_layer_idx   ON map_layer_cluster(layer_id);
    CREATE INDEX IF NOT EXISTS map_cluster_comp_cluster_idx  ON map_cluster_competency(cluster_id);
    CREATE INDEX IF NOT EXISTS map_role_comp_role_idx        ON map_role_competency(role_id);
  `);
}

function parseId(val: string): number | null {
  const n = parseInt(val);
  return isNaN(n) ? null : n;
}

export function registerOntologyCompetencyCoreRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  const ensure = () => ensureCompetencyCoreSchema(pool);

  // ── LAYERS ──────────────────────────────────────────────────────────────────

  app.get('/api/ontology/layers', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { search = '', status = 'all', layer_type = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status=$${params.length}`); }
      if (layer_type !== 'all') { params.push(layer_type); conds.push(`layer_type=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT l.*,
           (SELECT COUNT(*)::int FROM map_layer_cluster WHERE layer_id=l.id AND is_active=true) AS cluster_count
         FROM ont_layers l ${where} ORDER BY sort_order, name LIMIT 200`, params);
      return res.json({ items: rows, total: rows.length });
    } catch (err) { console.error('[layers] GET', err); return res.status(500).json({ error: 'Failed to fetch layers' }); }
  });

  app.post('/api/ontology/layers', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { code, name, description, layer_type = 'proficiency', applies_to_seniority, scoring_weight = 1, sort_order = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_layers (code,name,description,layer_type,applies_to_seniority,scoring_weight,sort_order,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8) RETURNING *`,
        [code, name, description, layer_type, applies_to_seniority || null, scoring_weight, sort_order, (req as any).user?.email ?? null]);
      void logAudit(pool, req, { action: 'create', entityType: 'layers', entityId: row.id, entityLabel: name, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create layer' });
    }
  });

  app.patch('/api/ontology/layers/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_layers WHERE id=$1`, [id]);
      const { name, description, layer_type, applies_to_seniority, scoring_weight, sort_order, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_layers SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           layer_type=COALESCE($3,layer_type), applies_to_seniority=COALESCE($4,applies_to_seniority),
           scoring_weight=COALESCE($5,scoring_weight), sort_order=COALESCE($6,sort_order),
           status=COALESCE($7,status), is_active=COALESCE($8,is_active), updated_at=NOW()
         WHERE id=$9 RETURNING *`,
        [name, description, layer_type, applies_to_seniority, scoring_weight, sort_order, status, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'layers', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update layer' }); }
  });

  app.delete('/api/ontology/layers/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_layers SET status='archived',is_active=false,updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'layers', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to archive layer' }); }
  });

  // Layer cluster members (read)
  app.get('/api/ontology/layers/:id/clusters', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT c.*, lc.weight, lc.sort_order AS map_sort_order
         FROM map_layer_cluster lc JOIN ont_competency_clusters c ON c.id=lc.cluster_id
         WHERE lc.layer_id=$1 AND lc.is_active=true ORDER BY lc.sort_order, c.name`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch layer clusters' }); }
  });

  // Add cluster to layer
  app.post('/api/ontology/layers/:id/clusters/:clusterId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const layerId = parseId(req.params.id); const clusterId = parseId(req.params.clusterId);
      if (!layerId || !clusterId) return res.status(400).json({ error: 'Invalid ids' });
      const { weight = 1, sort_order = 0 } = req.body ?? {};
      await pool.query(
        `INSERT INTO map_layer_cluster (layer_id,cluster_id,weight,sort_order)
         VALUES ($1,$2,$3,$4) ON CONFLICT (layer_id,cluster_id) DO UPDATE SET is_active=true, weight=$3, sort_order=$4, updated_at=NOW()`,
        [layerId, clusterId, weight, sort_order] as any);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to link cluster' }); }
  });

  // Remove cluster from layer
  app.delete('/api/ontology/layers/:id/clusters/:clusterId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const layerId = parseId(req.params.id); const clusterId = parseId(req.params.clusterId);
      if (!layerId || !clusterId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_layer_cluster SET is_active=false WHERE layer_id=$1 AND cluster_id=$2`, [layerId, clusterId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to unlink cluster' }); }
  });

  // ── COMPETENCY CLUSTERS ──────────────────────────────────────────────────────

  app.get('/api/ontology/clusters', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { search = '', status = 'all', layer_id = '', category = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`c.status=$${params.length}`); }
      if (category !== 'all') { params.push(category); conds.push(`c.category=$${params.length}`); }
      if (layer_id) { params.push(parseInt(layer_id)); conds.push(`c.layer_id=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT c.*, l.name AS layer_name,
           (SELECT COUNT(*)::int FROM map_cluster_competency WHERE cluster_id=c.id AND is_active=true) AS competency_count
         FROM ont_competency_clusters c
         LEFT JOIN ont_layers l ON l.id=c.layer_id
         ${where} ORDER BY c.sort_order, c.name LIMIT 300`, params);
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch clusters' }); }
  });

  app.post('/api/ontology/clusters', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { code, name, description, layer_id, category, icon_name, color_hex, weight_default = 1, sort_order = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_competency_clusters (code,name,description,layer_id,category,icon_name,color_hex,weight_default,sort_order,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10) RETURNING *`,
        [code, name, description, layer_id || null, category || null, icon_name || null, color_hex || null, weight_default, sort_order, (req as any).user?.email ?? null]);
      void logAudit(pool, req, { action: 'create', entityType: 'clusters', entityId: row.id, entityLabel: name, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create cluster' });
    }
  });

  app.patch('/api/ontology/clusters/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_competency_clusters WHERE id=$1`, [id]);
      const { name, description, layer_id, category, icon_name, color_hex, weight_default, sort_order, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_competency_clusters SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           layer_id=COALESCE($3,layer_id), category=COALESCE($4,category),
           icon_name=COALESCE($5,icon_name), color_hex=COALESCE($6,color_hex),
           weight_default=COALESCE($7,weight_default), sort_order=COALESCE($8,sort_order),
           status=COALESCE($9,status), is_active=COALESCE($10,is_active), updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [name, description, layer_id, category, icon_name, color_hex, weight_default, sort_order, status, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'clusters', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update cluster' }); }
  });

  app.delete('/api/ontology/clusters/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_competency_clusters SET status='archived',is_active=false,updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'clusters', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to archive cluster' }); }
  });

  // Cluster competencies (read)
  app.get('/api/ontology/clusters/:id/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT c.*, cc.weight_override, cc.sort_order AS map_sort_order, cc.is_primary
         FROM map_cluster_competency cc JOIN ont_competencies c ON c.id=cc.competency_id
         WHERE cc.cluster_id=$1 AND cc.is_active=true ORDER BY cc.sort_order, c.name`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch cluster competencies' }); }
  });

  // Add competency to cluster
  app.post('/api/ontology/clusters/:id/competencies/:compId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const clusterId = parseId(req.params.id); const compId = parseId(req.params.compId);
      if (!clusterId || !compId) return res.status(400).json({ error: 'Invalid ids' });
      const { weight_override, sort_order = 0, is_primary = false } = req.body ?? {};
      await pool.query(
        `INSERT INTO map_cluster_competency (cluster_id,competency_id,weight_override,sort_order,is_primary)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (cluster_id,competency_id) DO UPDATE
         SET is_active=true, weight_override=$3, sort_order=$4, is_primary=$5`,
        [clusterId, compId, weight_override || null, sort_order, is_primary]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to link competency' }); }
  });

  app.delete('/api/ontology/clusters/:id/competencies/:compId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const clusterId = parseId(req.params.id); const compId = parseId(req.params.compId);
      if (!clusterId || !compId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_cluster_competency SET is_active=false WHERE cluster_id=$1 AND competency_id=$2`, [clusterId, compId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to unlink competency' }); }
  });

  // ── COMPETENCIES ─────────────────────────────────────────────────────────────

  app.get('/api/ontology/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { search = '', status = 'all', cluster_id = '', category = 'all', competency_type = 'all',
              page = '1', limit = '100' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`c.status=$${params.length}`); }
      if (category !== 'all') { params.push(category); conds.push(`c.category=$${params.length}`); }
      if (competency_type !== 'all') { params.push(competency_type); conds.push(`c.competency_type=$${params.length}`); }
      if (cluster_id) { params.push(parseInt(cluster_id)); conds.push(`c.cluster_id=$${params.length}`); }
      if (search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(c.name ILIKE $${params.length} OR c.code ILIKE $${params.length} OR c.description ILIKE $${params.length})`);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT c.*, cl.name AS cluster_name, cl.code AS cluster_code,
           (SELECT COUNT(*)::int FROM ont_micro_competencies WHERE competency_id=c.id AND is_active=true) AS micro_count
         FROM ont_competencies c
         LEFT JOIN ont_competency_clusters cl ON cl.id=c.cluster_id
         ${where} ORDER BY c.sort_order, c.name
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ont_competencies c ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch competencies' }); }
  });

  app.get('/api/ontology/competencies/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [row] } = await pool.query(
        `SELECT c.*, cl.name AS cluster_name FROM ont_competencies c
         LEFT JOIN ont_competency_clusters cl ON cl.id=c.cluster_id WHERE c.id=$1`, [id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      const { rows: micros } = await pool.query(
        `SELECT * FROM ont_micro_competencies WHERE competency_id=$1 AND is_active=true ORDER BY sort_order, name`, [id]);
      const { rows: proficiencies } = await pool.query(
        `SELECT * FROM map_competency_proficiency WHERE competency_id=$1 ORDER BY score_band_min`, [id]);
      return res.json({ item: row, micros, proficiencies });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch competency' }); }
  });

  app.post('/api/ontology/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { code, name, description, cluster_id, category, competency_type = 'core',
              assessment_methods, is_measurable = true, is_threshold = false,
              weight_default = 1, development_guide, external_ref, sort_order = 0 } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_competencies
           (code,name,description,cluster_id,category,competency_type,assessment_methods,
            is_measurable,is_threshold,weight_default,development_guide,external_ref,sort_order,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14) RETURNING *`,
        [code, name, description, cluster_id || null, category || null, competency_type,
         assessment_methods || null, is_measurable, is_threshold, weight_default,
         development_guide || null, external_ref || null, sort_order, (req as any).user?.email ?? null]);
      void logAudit(pool, req, { action: 'create', entityType: 'competencies', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create competency' });
    }
  });

  app.patch('/api/ontology/competencies/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_competencies WHERE id=$1`, [id]);
      const { name, description, cluster_id, category, competency_type, assessment_methods,
              is_measurable, is_threshold, weight_default, development_guide, external_ref,
              sort_order, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_competencies SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           cluster_id=COALESCE($3,cluster_id), category=COALESCE($4,category),
           competency_type=COALESCE($5,competency_type), assessment_methods=COALESCE($6,assessment_methods),
           is_measurable=COALESCE($7,is_measurable), is_threshold=COALESCE($8,is_threshold),
           weight_default=COALESCE($9,weight_default), development_guide=COALESCE($10,development_guide),
           external_ref=COALESCE($11,external_ref), sort_order=COALESCE($12,sort_order),
           status=COALESCE($13,status), is_active=COALESCE($14,is_active), updated_at=NOW()
         WHERE id=$15 RETURNING *`,
        [name, description, cluster_id, category, competency_type, assessment_methods,
         is_measurable, is_threshold, weight_default, development_guide, external_ref,
         sort_order, status, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'competencies', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update competency' }); }
  });

  app.delete('/api/ontology/competencies/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [{ mc_count }] } = await pool.query(
        `SELECT COUNT(*)::int AS mc_count FROM ont_micro_competencies WHERE competency_id=$1 AND is_active=true`, [id]);
      if (mc_count > 0) return res.status(409).json({ error: `Cannot archive: ${mc_count} active micro competencies still reference this competency. Archive them first.` });
      await pool.query(`UPDATE ont_competencies SET status='archived',is_active=false,updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'competencies', entityId: id });
      return res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === '409') return res.status(409).json({ error: err.message });
      return res.status(500).json({ error: 'Failed to archive competency' });
    }
  });

  // Competency proficiency levels (upsert)
  app.put('/api/ontology/competencies/:id/proficiency/:level', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const level = req.params.level;
      const { score_band_min = 0, score_band_max = 100, behavioural_anchors, sample_evidence, development_actions } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `INSERT INTO map_competency_proficiency (competency_id,proficiency_level,score_band_min,score_band_max,behavioural_anchors,sample_evidence,development_actions)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (competency_id,proficiency_level) DO UPDATE SET
           score_band_min=$3, score_band_max=$4, behavioural_anchors=$5,
           sample_evidence=$6, development_actions=$7, updated_at=NOW()
         RETURNING *`,
        [id, level, score_band_min, score_band_max, behavioural_anchors || null, sample_evidence || null, development_actions || null]);
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to upsert proficiency level' }); }
  });

  // ── MICRO COMPETENCIES ───────────────────────────────────────────────────────

  app.get('/api/ontology/micro-competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { search = '', status = 'all', competency_id = '', proficiency_level = 'all',
              page = '1', limit = '100' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`m.status=$${params.length}`); }
      if (proficiency_level !== 'all') { params.push(proficiency_level); conds.push(`m.proficiency_level=$${params.length}`); }
      if (competency_id) { params.push(parseInt(competency_id)); conds.push(`m.competency_id=$${params.length}`); }
      if (search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(m.name ILIKE $${params.length} OR m.code ILIKE $${params.length} OR m.observable_behavior ILIKE $${params.length})`);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT m.*, c.name AS competency_name, c.code AS competency_code
         FROM ont_micro_competencies m
         LEFT JOIN ont_competencies c ON c.id=m.competency_id
         ${where} ORDER BY m.sort_order, m.name
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ont_micro_competencies m ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch micro competencies' }); }
  });

  app.post('/api/ontology/micro-competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { code, name, description, competency_id, proficiency_level, observable_behavior = '',
              absence_indicator, development_focus, assessment_hint, irt_b, sort_order = 0 } = req.body ?? {};
      if (!code || !name || !competency_id) return res.status(400).json({ error: 'code, name, and competency_id are required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_micro_competencies
           (code,name,description,competency_id,proficiency_level,observable_behavior,
            absence_indicator,development_focus,assessment_hint,irt_b,sort_order,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING *`,
        [code, name, description, competency_id, proficiency_level || null, observable_behavior,
         absence_indicator || null, development_focus || null, assessment_hint || null,
         irt_b || null, sort_order, (req as any).user?.email ?? null]);
      void logAudit(pool, req, { action: 'create', entityType: 'micro-competencies', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      if (err?.code === '23503') return res.status(400).json({ error: 'Competency not found' });
      return res.status(500).json({ error: 'Failed to create micro competency' });
    }
  });

  app.patch('/api/ontology/micro-competencies/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_micro_competencies WHERE id=$1`, [id]);
      const { name, description, competency_id, proficiency_level, observable_behavior,
              absence_indicator, development_focus, assessment_hint, irt_b, sort_order, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_micro_competencies SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           competency_id=COALESCE($3,competency_id), proficiency_level=COALESCE($4,proficiency_level),
           observable_behavior=COALESCE($5,observable_behavior), absence_indicator=COALESCE($6,absence_indicator),
           development_focus=COALESCE($7,development_focus), assessment_hint=COALESCE($8,assessment_hint),
           irt_b=COALESCE($9,irt_b), sort_order=COALESCE($10,sort_order),
           status=COALESCE($11,status), is_active=COALESCE($12,is_active), updated_at=NOW()
         WHERE id=$13 RETURNING *`,
        [name, description, competency_id, proficiency_level, observable_behavior,
         absence_indicator, development_focus, assessment_hint, irt_b, sort_order, status, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'micro-competencies', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update micro competency' }); }
  });

  app.delete('/api/ontology/micro-competencies/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_micro_competencies SET status='archived',is_active=false,updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'micro-competencies', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to archive micro competency' }); }
  });

  // ── ROLE → LAYER  (role layer assignments) ──────────────────────────────────

  app.get('/api/ontology/roles/:id/layers', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT l.*, rl.required_proficiency, rl.is_mandatory, rl.sort_order AS map_sort_order
         FROM map_role_layer rl JOIN ont_layers l ON l.id=rl.layer_id
         WHERE rl.role_id=$1 AND rl.is_active=true ORDER BY rl.sort_order, l.name`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch role layers' }); }
  });

  app.post('/api/ontology/roles/:id/layers/:layerId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const roleId = parseId(req.params.id); const layerId = parseId(req.params.layerId);
      if (!roleId || !layerId) return res.status(400).json({ error: 'Invalid ids' });
      const { required_proficiency, is_mandatory = true, sort_order = 0 } = req.body ?? {};
      await pool.query(
        `INSERT INTO map_role_layer (role_id,layer_id,required_proficiency,is_mandatory,sort_order)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (role_id,layer_id) DO UPDATE
         SET is_active=true, required_proficiency=$3, is_mandatory=$4, sort_order=$5`,
        [roleId, layerId, required_proficiency || null, is_mandatory, sort_order]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to assign layer to role' }); }
  });

  app.delete('/api/ontology/roles/:id/layers/:layerId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const roleId = parseId(req.params.id); const layerId = parseId(req.params.layerId);
      if (!roleId || !layerId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_role_layer SET is_active=false WHERE role_id=$1 AND layer_id=$2`, [roleId, layerId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to remove layer from role' }); }
  });

  // ── STATS ────────────────────────────────────────────────────────────────────

  app.get('/api/ontology/competency-core/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows: [stats] } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM ont_layers WHERE is_active=true) AS layers_total,
          (SELECT COUNT(*)::int FROM ont_layers WHERE status='published') AS layers_published,
          (SELECT COUNT(*)::int FROM ont_competency_clusters WHERE is_active=true) AS clusters_total,
          (SELECT COUNT(*)::int FROM ont_competency_clusters WHERE status='published') AS clusters_published,
          (SELECT COUNT(*)::int FROM ont_competencies WHERE is_active=true) AS competencies_total,
          (SELECT COUNT(*)::int FROM ont_competencies WHERE status='published') AS competencies_published,
          (SELECT COUNT(*)::int FROM ont_micro_competencies WHERE is_active=true) AS micros_total,
          (SELECT COUNT(*)::int FROM ont_micro_competencies WHERE status='published') AS micros_published,
          (SELECT COUNT(*)::int FROM map_cluster_competency WHERE is_active=true) AS cluster_comp_links,
          (SELECT COUNT(*)::int FROM map_role_competency WHERE is_active=true) AS role_comp_links
      `);
      return res.json({ stats });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch stats' }); }
  });
}
