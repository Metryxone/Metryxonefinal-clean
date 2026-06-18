/**
 * Ontology Concerns & Mapping Routes
 *
 * Entities: Ontology Concern · Assessment Question
 *
 * GET/POST/PATCH/DELETE /api/ontology/ont-concerns
 * GET/POST/PATCH/DELETE /api/ontology/assessment-questions
 * GET/POST/DELETE       /api/ontology/assessment-questions/:id/options
 *
 * Mapping management:
 * GET/POST/DELETE /api/ontology/micro-competencies/:id/concerns    (map_micro_concern)
 * GET/POST/DELETE /api/ontology/concerns/:id/indicators             (map_concern_indicator)
 * GET/POST/DELETE /api/ontology/indicators/:id/questions            (map_indicator_question)
 * GET/POST/DELETE /api/ontology/micro-competencies/:id/questions    (map_micro_question)
 * GET/POST/DELETE /api/ontology/competencies/:id/future-skills      (map_competency_future_skill)
 * GET/POST/DELETE /api/ontology/industries/:id/competencies         (map_industry_competency)
 * GET/POST/DELETE /api/ontology/competencies/:id/learning-paths     (map_competency_learning_path)
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

export async function ensureConcernsMappingSchema(pool: Pool) {
  // Part 1 — entity tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_concerns (
      id                  SERIAL        PRIMARY KEY,
      code                VARCHAR(40)   NOT NULL UNIQUE,
      name                VARCHAR(200)  NOT NULL,
      description         TEXT,
      concern_bridge_tag  VARCHAR(120),
      capadex_concern_id  TEXT,
      severity            VARCHAR(20)   NOT NULL DEFAULT 'moderate',
      domain              VARCHAR(80),
      concern_cluster     VARCHAR(80),
      primary_persona     VARCHAR(30)   NOT NULL DEFAULT 'all',
      age_min             SMALLINT,
      age_max             SMALLINT,
      is_active           BOOLEAN       NOT NULL DEFAULT true,
      status              VARCHAR(20)   NOT NULL DEFAULT 'draft',
      version             INTEGER       NOT NULL DEFAULT 1,
      created_by          TEXT,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ont_concerns_bridge_tag_idx ON ont_concerns(concern_bridge_tag);
    CREATE INDEX IF NOT EXISTS ont_concerns_capadex_id_idx ON ont_concerns(capadex_concern_id);

    CREATE TABLE IF NOT EXISTS ont_assessment_questions (
      id                    SERIAL        PRIMARY KEY,
      code                  VARCHAR(50)   NOT NULL UNIQUE,
      stem                  TEXT          NOT NULL,
      assessment_type       VARCHAR(30)   NOT NULL DEFAULT 'behavioral',
      response_format       VARCHAR(30)   NOT NULL DEFAULT 'likert_5',
      polarity              VARCHAR(10)   NOT NULL DEFAULT 'positive',
      reverse_score         BOOLEAN       NOT NULL DEFAULT false,
      difficulty_tier       VARCHAR(10)   NOT NULL DEFAULT 'medium',
      irt_b                 NUMERIC(6,4),
      irt_a                 NUMERIC(6,4),
      irt_c                 NUMERIC(6,4),
      time_estimate_secs    SMALLINT      NOT NULL DEFAULT 90,
      instructions          TEXT,
      persona_filter        TEXT[],
      age_band_min          SMALLINT,
      age_band_max          SMALLINT,
      source                VARCHAR(20)   NOT NULL DEFAULT 'native',
      caf_question_id       INTEGER,
      clarity_question_id   INTEGER,
      is_anchor_item        BOOLEAN       NOT NULL DEFAULT false,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
      version               INTEGER       NOT NULL DEFAULT 1,
      created_by            TEXT,
      reviewed_at           TIMESTAMPTZ,
      reviewed_by           TEXT,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_question_options (
      id            SERIAL        PRIMARY KEY,
      question_id   INTEGER       NOT NULL REFERENCES ont_assessment_questions(id) ON DELETE CASCADE,
      option_key    VARCHAR(10)   NOT NULL,
      option_text   TEXT          NOT NULL,
      score_value   NUMERIC(6,3)  NOT NULL DEFAULT 0,
      is_correct    BOOLEAN       NOT NULL DEFAULT false,
      sort_order    SMALLINT      NOT NULL DEFAULT 0,
      UNIQUE (question_id, option_key)
    );

    CREATE TABLE IF NOT EXISTS map_micro_concern (
      id                    SERIAL        PRIMARY KEY,
      micro_competency_id   INTEGER       NOT NULL,
      concern_id            INTEGER       NOT NULL REFERENCES ont_concerns(id) ON DELETE CASCADE,
      emergence_probability NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
      relationship_note     TEXT,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (micro_competency_id, concern_id)
    );
    CREATE TABLE IF NOT EXISTS map_concern_indicator (
      id              SERIAL        PRIMARY KEY,
      concern_id      INTEGER       NOT NULL REFERENCES ont_concerns(id) ON DELETE CASCADE,
      indicator_id    INTEGER       NOT NULL,
      weight          NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
      is_primary      BOOLEAN       NOT NULL DEFAULT false,
      is_active       BOOLEAN       NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (concern_id, indicator_id)
    );
    CREATE TABLE IF NOT EXISTS map_indicator_question (
      id              SERIAL        PRIMARY KEY,
      indicator_id    INTEGER       NOT NULL,
      question_id     INTEGER       NOT NULL REFERENCES ont_assessment_questions(id) ON DELETE CASCADE,
      is_primary      BOOLEAN       NOT NULL DEFAULT false,
      weight          NUMERIC(4,3)  NOT NULL DEFAULT 1.000,
      is_active       BOOLEAN       NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (indicator_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS map_micro_question (
      id                    SERIAL        PRIMARY KEY,
      micro_competency_id   INTEGER       NOT NULL,
      question_id           INTEGER       NOT NULL REFERENCES ont_assessment_questions(id) ON DELETE CASCADE,
      is_primary            BOOLEAN       NOT NULL DEFAULT false,
      weight                NUMERIC(4,3)  NOT NULL DEFAULT 1.000,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (micro_competency_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS map_competency_future_skill (
      id                SERIAL        PRIMARY KEY,
      competency_id     INTEGER       NOT NULL,
      future_skill_id   INTEGER       NOT NULL,
      alignment_score   NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
      relationship_type VARCHAR(30)   NOT NULL DEFAULT 'underpins',
      is_active         BOOLEAN       NOT NULL DEFAULT true,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (competency_id, future_skill_id)
    );
    CREATE TABLE IF NOT EXISTS map_industry_competency (
      id                SERIAL        PRIMARY KEY,
      industry_id       INTEGER       NOT NULL,
      competency_id     INTEGER       NOT NULL,
      importance_weight NUMERIC(4,3)  NOT NULL DEFAULT 1.000,
      notes             TEXT,
      is_active         BOOLEAN       NOT NULL DEFAULT true,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (industry_id, competency_id)
    );
    CREATE TABLE IF NOT EXISTS map_competency_learning_path (
      id                  SERIAL        PRIMARY KEY,
      competency_id       INTEGER       NOT NULL,
      learning_path_id    INTEGER       NOT NULL,
      relationship_type   VARCHAR(20)   NOT NULL DEFAULT 'primary',
      is_active           BOOLEAN       NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (competency_id, learning_path_id)
    );
    CREATE INDEX IF NOT EXISTS map_micro_concern_micro_idx    ON map_micro_concern(micro_competency_id);
    CREATE INDEX IF NOT EXISTS map_micro_concern_concern_idx  ON map_micro_concern(concern_id);
    CREATE INDEX IF NOT EXISTS map_concern_ind_concern_idx    ON map_concern_indicator(concern_id);
    CREATE INDEX IF NOT EXISTS map_ind_q_ind_idx              ON map_indicator_question(indicator_id);
    CREATE INDEX IF NOT EXISTS map_micro_q_micro_idx          ON map_micro_question(micro_competency_id);
  `);
}

function pid(v: string): number | null { const n = parseInt(v); return isNaN(n) ? null : n; }

export function registerOntologyConcernsMappingRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  const ensure = () => ensureConcernsMappingSchema(pool);

  // ── ONTOLOGY CONCERNS ────────────────────────────────────────────────────────

  app.get('/api/ontology/ont-concerns', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { search = '', status = 'all', severity = 'all', domain = '', persona = 'all',
              page = '1', limit = '100' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status=$${params.length}`); }
      if (severity !== 'all') { params.push(severity); conds.push(`severity=$${params.length}`); }
      if (persona !== 'all') { params.push(persona); conds.push(`primary_persona=$${params.length}`); }
      if (domain.trim()) { params.push(`%${domain.trim()}%`); conds.push(`domain ILIKE $${params.length}`); }
      if (search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length} OR concern_bridge_tag ILIKE $${params.length})`);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT *,
           (SELECT COUNT(*)::int FROM map_micro_concern WHERE concern_id=id AND is_active=true) AS micro_link_count,
           (SELECT COUNT(*)::int FROM map_concern_indicator WHERE concern_id=id AND is_active=true) AS indicator_count
         FROM ont_concerns ${where} ORDER BY domain, name
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ont_concerns ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch concerns' }); }
  });

  app.post('/api/ontology/ont-concerns', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { code, name, description, concern_bridge_tag, capadex_concern_id, severity = 'moderate',
              domain, concern_cluster, primary_persona = 'all', age_min, age_max } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_concerns (code,name,description,concern_bridge_tag,capadex_concern_id,severity,domain,concern_cluster,primary_persona,age_min,age_max,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING *`,
        [code, name, description, concern_bridge_tag||null, capadex_concern_id||null, severity,
         domain||null, concern_cluster||null, primary_persona, age_min||null, age_max||null,
         (req as any).user?.email ?? null]);
      void logAudit(pool, req, { action: 'create', entityType: 'ont-concerns', entityId: row.id, entityLabel: name, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create concern' });
    }
  });

  app.patch('/api/ontology/ont-concerns/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_concerns WHERE id=$1`, [id]);
      const { name, description, concern_bridge_tag, capadex_concern_id, severity, domain,
              concern_cluster, primary_persona, age_min, age_max, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_concerns SET
           name=COALESCE($1,name), description=COALESCE($2,description),
           concern_bridge_tag=COALESCE($3,concern_bridge_tag), capadex_concern_id=COALESCE($4,capadex_concern_id),
           severity=COALESCE($5,severity), domain=COALESCE($6,domain),
           concern_cluster=COALESCE($7,concern_cluster), primary_persona=COALESCE($8,primary_persona),
           age_min=COALESCE($9,age_min), age_max=COALESCE($10,age_max),
           status=COALESCE($11,status), is_active=COALESCE($12,is_active), updated_at=NOW()
         WHERE id=$13 RETURNING *`,
        [name, description, concern_bridge_tag, capadex_concern_id, severity, domain,
         concern_cluster, primary_persona, age_min, age_max, status, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'ont-concerns', entityId: id, entityLabel: row.name, before: before??null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update concern' }); }
  });

  app.delete('/api/ontology/ont-concerns/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_concerns SET status='archived',is_active=false,updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'ont-concerns', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to archive concern' }); }
  });

  // ── ASSESSMENT QUESTIONS ─────────────────────────────────────────────────────

  app.get('/api/ontology/assessment-questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { search = '', status = 'all', assessment_type = 'all', source = 'all',
              page = '1', limit = '100' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status=$${params.length}`); }
      if (assessment_type !== 'all') { params.push(assessment_type); conds.push(`assessment_type=$${params.length}`); }
      if (source !== 'all') { params.push(source); conds.push(`source=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(code ILIKE $${params.length} OR stem ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT q.*,
           (SELECT COUNT(*)::int FROM ont_question_options WHERE question_id=q.id) AS option_count
         FROM ont_assessment_questions q ${where} ORDER BY q.assessment_type, q.code
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ont_assessment_questions ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch questions' }); }
  });

  app.post('/api/ontology/assessment-questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { code, stem, assessment_type = 'behavioral', response_format = 'likert_5',
              polarity = 'positive', reverse_score = false, difficulty_tier = 'medium',
              irt_b, irt_a, irt_c, time_estimate_secs = 90, instructions,
              persona_filter, age_band_min, age_band_max, source = 'native',
              caf_question_id, clarity_question_id, is_anchor_item = false } = req.body ?? {};
      if (!code || !stem) return res.status(400).json({ error: 'code and stem required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_assessment_questions
           (code,stem,assessment_type,response_format,polarity,reverse_score,difficulty_tier,
            irt_b,irt_a,irt_c,time_estimate_secs,instructions,persona_filter,age_band_min,age_band_max,
            source,caf_question_id,clarity_question_id,is_anchor_item,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft',$20) RETURNING *`,
        [code, stem, assessment_type, response_format, polarity, reverse_score, difficulty_tier,
         irt_b||null, irt_a||null, irt_c||null, time_estimate_secs, instructions||null,
         persona_filter||null, age_band_min||null, age_band_max||null,
         source, caf_question_id||null, clarity_question_id||null, is_anchor_item,
         (req as any).user?.email ?? null]);
      void logAudit(pool, req, { action: 'create', entityType: 'assessment-questions', entityId: row.id, entityLabel: code, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create question' });
    }
  });

  app.patch('/api/ontology/assessment-questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_assessment_questions WHERE id=$1`, [id]);
      const { stem, assessment_type, response_format, polarity, reverse_score, difficulty_tier,
              irt_b, irt_a, irt_c, time_estimate_secs, instructions,
              persona_filter, age_band_min, age_band_max, is_anchor_item, status, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_assessment_questions SET
           stem=COALESCE($1,stem), assessment_type=COALESCE($2,assessment_type),
           response_format=COALESCE($3,response_format), polarity=COALESCE($4,polarity),
           reverse_score=COALESCE($5,reverse_score), difficulty_tier=COALESCE($6,difficulty_tier),
           irt_b=COALESCE($7,irt_b), irt_a=COALESCE($8,irt_a), irt_c=COALESCE($9,irt_c),
           time_estimate_secs=COALESCE($10,time_estimate_secs), instructions=COALESCE($11,instructions),
           persona_filter=COALESCE($12,persona_filter), age_band_min=COALESCE($13,age_band_min),
           age_band_max=COALESCE($14,age_band_max), is_anchor_item=COALESCE($15,is_anchor_item),
           status=COALESCE($16,status), is_active=COALESCE($17,is_active), updated_at=NOW()
         WHERE id=$18 RETURNING *`,
        [stem, assessment_type, response_format, polarity, reverse_score, difficulty_tier,
         irt_b, irt_a, irt_c, time_estimate_secs, instructions, persona_filter,
         age_band_min, age_band_max, is_anchor_item, status, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      void logAudit(pool, req, { action: 'update', entityType: 'assessment-questions', entityId: id, entityLabel: row.code, before: before??null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update question' }); }
  });

  app.delete('/api/ontology/assessment-questions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE ont_assessment_questions SET status='archived',is_active=false,updated_at=NOW() WHERE id=$1`, [id]);
      void logAudit(pool, req, { action: 'archive', entityType: 'assessment-questions', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to archive question' }); }
  });

  // Question options CRUD
  app.get('/api/ontology/assessment-questions/:id/options', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(`SELECT * FROM ont_question_options WHERE question_id=$1 ORDER BY sort_order`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch options' }); }
  });

  app.post('/api/ontology/assessment-questions/:id/options', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { option_key, option_text, score_value = 0, is_correct = false, sort_order = 0 } = req.body ?? {};
      if (!option_key || !option_text) return res.status(400).json({ error: 'option_key and option_text required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_question_options (question_id,option_key,option_text,score_value,is_correct,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (question_id,option_key) DO UPDATE
         SET option_text=$3, score_value=$4, is_correct=$5, sort_order=$6 RETURNING *`,
        [id, option_key, option_text, score_value, is_correct, sort_order]);
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to save option' }); }
  });

  app.delete('/api/ontology/assessment-questions/:id/options/:key', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`DELETE FROM ont_question_options WHERE question_id=$1 AND option_key=$2`, [id, req.params.key]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete option' }); }
  });

  // ── MAPPING ENDPOINTS ────────────────────────────────────────────────────────

  // map_micro_concern — Micro Competency → Concern
  app.get('/api/ontology/micro-competencies/:id/concerns', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT c.*, mc.emergence_probability, mc.relationship_note
         FROM map_micro_concern mc JOIN ont_concerns c ON c.id=mc.concern_id
         WHERE mc.micro_competency_id=$1 AND mc.is_active=true ORDER BY c.name`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/micro-competencies/:id/concerns', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const microId = pid(req.params.id);
      if (!microId) return res.status(400).json({ error: 'Invalid id' });
      const { concern_id, emergence_probability = 0.5, relationship_note } = req.body ?? {};
      if (!concern_id) return res.status(400).json({ error: 'concern_id required' });
      await pool.query(
        `INSERT INTO map_micro_concern (micro_competency_id,concern_id,emergence_probability,relationship_note)
         VALUES ($1,$2,$3,$4) ON CONFLICT (micro_competency_id,concern_id) DO UPDATE
         SET is_active=true, emergence_probability=$3, relationship_note=$4`,
        [microId, concern_id, emergence_probability, relationship_note||null]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/micro-competencies/:id/concerns/:concernId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const microId = pid(req.params.id); const concernId = pid(req.params.concernId);
      if (!microId || !concernId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_micro_concern SET is_active=false WHERE micro_competency_id=$1 AND concern_id=$2`, [microId, concernId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // map_concern_indicator — Concern → Indicator
  app.get('/api/ontology/concerns/:id/indicators', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT i.*, ci.weight, ci.is_primary
         FROM map_concern_indicator ci JOIN ont_indicators i ON i.id=ci.indicator_id
         WHERE ci.concern_id=$1 AND ci.is_active=true ORDER BY ci.is_primary DESC, i.label`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/concerns/:id/indicators', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const concernId = pid(req.params.id);
      if (!concernId) return res.status(400).json({ error: 'Invalid id' });
      const { indicator_id, weight = 0.5, is_primary = false } = req.body ?? {};
      if (!indicator_id) return res.status(400).json({ error: 'indicator_id required' });
      await pool.query(
        `INSERT INTO map_concern_indicator (concern_id,indicator_id,weight,is_primary)
         VALUES ($1,$2,$3,$4) ON CONFLICT (concern_id,indicator_id) DO UPDATE
         SET is_active=true, weight=$3, is_primary=$4`,
        [concernId, indicator_id, weight, is_primary]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/concerns/:id/indicators/:indicatorId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const concernId = pid(req.params.id); const indicatorId = pid(req.params.indicatorId);
      if (!concernId || !indicatorId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_concern_indicator SET is_active=false WHERE concern_id=$1 AND indicator_id=$2`, [concernId, indicatorId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // map_indicator_question — Indicator → Question
  app.get('/api/ontology/indicators/:id/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT q.*, iq.weight, iq.is_primary
         FROM map_indicator_question iq JOIN ont_assessment_questions q ON q.id=iq.question_id
         WHERE iq.indicator_id=$1 AND iq.is_active=true ORDER BY iq.is_primary DESC, q.code`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/indicators/:id/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const indicatorId = pid(req.params.id);
      if (!indicatorId) return res.status(400).json({ error: 'Invalid id' });
      const { question_id, weight = 1, is_primary = false } = req.body ?? {};
      if (!question_id) return res.status(400).json({ error: 'question_id required' });
      await pool.query(
        `INSERT INTO map_indicator_question (indicator_id,question_id,weight,is_primary)
         VALUES ($1,$2,$3,$4) ON CONFLICT (indicator_id,question_id) DO UPDATE
         SET is_active=true, weight=$3, is_primary=$4`,
        [indicatorId, question_id, weight, is_primary]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/indicators/:id/questions/:questionId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const indId = pid(req.params.id); const qId = pid(req.params.questionId);
      if (!indId || !qId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_indicator_question SET is_active=false WHERE indicator_id=$1 AND question_id=$2`, [indId, qId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // map_micro_question — Micro Competency → Question (direct)
  app.get('/api/ontology/micro-competencies/:id/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT q.*, mq.weight, mq.is_primary
         FROM map_micro_question mq JOIN ont_assessment_questions q ON q.id=mq.question_id
         WHERE mq.micro_competency_id=$1 AND mq.is_active=true ORDER BY mq.is_primary DESC, q.code`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/micro-competencies/:id/questions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const microId = pid(req.params.id);
      if (!microId) return res.status(400).json({ error: 'Invalid id' });
      const { question_id, weight = 1, is_primary = false } = req.body ?? {};
      if (!question_id) return res.status(400).json({ error: 'question_id required' });
      await pool.query(
        `INSERT INTO map_micro_question (micro_competency_id,question_id,weight,is_primary)
         VALUES ($1,$2,$3,$4) ON CONFLICT (micro_competency_id,question_id) DO UPDATE
         SET is_active=true, weight=$3, is_primary=$4`,
        [microId, question_id, weight, is_primary]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/micro-competencies/:id/questions/:questionId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const microId = pid(req.params.id); const qId = pid(req.params.questionId);
      if (!microId || !qId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_micro_question SET is_active=false WHERE micro_competency_id=$1 AND question_id=$2`, [microId, qId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // map_competency_future_skill
  app.get('/api/ontology/competencies/:id/future-skills', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT fs.*, cfs.alignment_score, cfs.relationship_type
         FROM map_competency_future_skill cfs JOIN ont_future_skills fs ON fs.id=cfs.future_skill_id
         WHERE cfs.competency_id=$1 AND cfs.is_active=true ORDER BY cfs.alignment_score DESC`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/competencies/:id/future-skills', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const compId = pid(req.params.id);
      if (!compId) return res.status(400).json({ error: 'Invalid id' });
      const { future_skill_id, alignment_score = 0.5, relationship_type = 'underpins' } = req.body ?? {};
      if (!future_skill_id) return res.status(400).json({ error: 'future_skill_id required' });
      await pool.query(
        `INSERT INTO map_competency_future_skill (competency_id,future_skill_id,alignment_score,relationship_type)
         VALUES ($1,$2,$3,$4) ON CONFLICT (competency_id,future_skill_id) DO UPDATE
         SET is_active=true, alignment_score=$3, relationship_type=$4`,
        [compId, future_skill_id, alignment_score, relationship_type]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/competencies/:id/future-skills/:fsId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const compId = pid(req.params.id); const fsId = pid(req.params.fsId);
      if (!compId || !fsId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_competency_future_skill SET is_active=false WHERE competency_id=$1 AND future_skill_id=$2`, [compId, fsId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // map_industry_competency
  app.get('/api/ontology/industries/:id/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT c.*, ic.importance_weight, ic.notes
         FROM map_industry_competency ic JOIN ont_competencies c ON c.id=ic.competency_id
         WHERE ic.industry_id=$1 AND ic.is_active=true ORDER BY ic.importance_weight DESC, c.name`, [id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/industries/:id/competencies', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const indId = pid(req.params.id);
      if (!indId) return res.status(400).json({ error: 'Invalid id' });
      const { competency_id, importance_weight = 1, notes } = req.body ?? {};
      if (!competency_id) return res.status(400).json({ error: 'competency_id required' });
      await pool.query(
        `INSERT INTO map_industry_competency (industry_id,competency_id,importance_weight,notes)
         VALUES ($1,$2,$3,$4) ON CONFLICT (industry_id,competency_id) DO UPDATE
         SET is_active=true, importance_weight=$3, notes=$4`,
        [indId, competency_id, importance_weight, notes||null]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/industries/:id/competencies/:compId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const indId = pid(req.params.id); const compId = pid(req.params.compId);
      if (!indId || !compId) return res.status(400).json({ error: 'Invalid ids' });
      await pool.query(`UPDATE map_industry_competency SET is_active=false WHERE industry_id=$1 AND competency_id=$2`, [indId, compId]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // Concerns + Mapping stats
  app.get('/api/ontology/concerns-mapping/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows: [stats] } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM ont_concerns WHERE is_active=true) AS concerns_total,
          (SELECT COUNT(*)::int FROM ont_concerns WHERE status='published') AS concerns_published,
          (SELECT COUNT(*)::int FROM ont_concerns WHERE concern_bridge_tag IS NOT NULL) AS concerns_bridged,
          (SELECT COUNT(*)::int FROM ont_assessment_questions WHERE is_active=true) AS questions_total,
          (SELECT COUNT(*)::int FROM ont_assessment_questions WHERE status='published') AS questions_published,
          (SELECT COUNT(*)::int FROM map_micro_concern WHERE is_active=true) AS micro_concern_links,
          (SELECT COUNT(*)::int FROM map_concern_indicator WHERE is_active=true) AS concern_indicator_links,
          (SELECT COUNT(*)::int FROM map_indicator_question WHERE is_active=true) AS indicator_question_links,
          (SELECT COUNT(*)::int FROM map_micro_question WHERE is_active=true) AS micro_question_links
      `);
      return res.json({ stats });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch stats' }); }
  });
}
