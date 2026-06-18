/**
 * Ontology Governance Routes
 *
 * Reference tables, version control, lifecycle events, review schedules, quality gates.
 *
 * Reference:
 *   GET /api/ontology/ref/seniority-levels
 *   GET /api/ontology/ref/proficiency-levels
 *   GET /api/ontology/ref/competency-categories
 *   GET /api/ontology/ref/assessment-types
 *   GET /api/ontology/ref/lifecycle-transitions
 *
 * Version control (append-only):
 *   GET  /api/ontology/versions                    — change history (filterable)
 *   GET  /api/ontology/versions/:entityType/:id    — entity version history
 *   POST /api/ontology/versions/snapshot           — manually capture snapshot
 *
 * Lifecycle:
 *   GET  /api/ontology/lifecycle                   — all lifecycle events (filterable)
 *   POST /api/ontology/lifecycle/transition        — record a status transition
 *
 * Governance:
 *   GET/PATCH /api/ontology/governance/schedules                — review schedules
 *   GET/POST/PATCH /api/ontology/governance/reviews             — review instances
 *   GET/POST/PATCH/DELETE /api/ontology/governance/quality-rules — quality gate rules
 *   GET /api/ontology/governance/quality-run                    — run quality checks
 *   GET /api/ontology/governance/stats                          — dashboard stats
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureGovernanceSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ref_seniority_levels (
      code          VARCHAR(20)   PRIMARY KEY,
      label         VARCHAR(80)   NOT NULL,
      level_order   SMALLINT      NOT NULL,
      is_leadership BOOLEAN       NOT NULL DEFAULT false,
      is_active     BOOLEAN       NOT NULL DEFAULT true,
      description   TEXT
    );
    CREATE TABLE IF NOT EXISTS ref_proficiency_levels (
      code            VARCHAR(20)   PRIMARY KEY,
      label           VARCHAR(80)   NOT NULL,
      level_order     SMALLINT      NOT NULL,
      score_band_min  NUMERIC(5,2)  NOT NULL DEFAULT 0,
      score_band_max  NUMERIC(5,2)  NOT NULL DEFAULT 100,
      description     TEXT,
      is_active       BOOLEAN       NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS ref_competency_categories (
      code        VARCHAR(30)   PRIMARY KEY,
      label       VARCHAR(80)   NOT NULL,
      description TEXT,
      color_hex   VARCHAR(7),
      icon_name   VARCHAR(60),
      sort_order  SMALLINT      NOT NULL DEFAULT 0,
      is_active   BOOLEAN       NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS ref_assessment_types (
      code           VARCHAR(30)   PRIMARY KEY,
      label          VARCHAR(80)   NOT NULL,
      description    TEXT,
      default_format VARCHAR(30),
      is_active      BOOLEAN       NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS ref_lifecycle_transitions (
      id                SERIAL        PRIMARY KEY,
      entity_type       VARCHAR(60)   NOT NULL,
      from_status       VARCHAR(20)   NOT NULL,
      to_status         VARCHAR(20)   NOT NULL,
      requires_approval BOOLEAN       NOT NULL DEFAULT false,
      auto_notify       BOOLEAN       NOT NULL DEFAULT false,
      notes             TEXT,
      UNIQUE (entity_type, from_status, to_status)
    );
    CREATE TABLE IF NOT EXISTS ver_entity_snapshots (
      id            BIGSERIAL     PRIMARY KEY,
      entity_type   VARCHAR(60)   NOT NULL,
      entity_id     INTEGER       NOT NULL,
      entity_code   VARCHAR(60),
      entity_label  VARCHAR(300),
      version       INTEGER       NOT NULL,
      snapshot_data JSONB         NOT NULL,
      snapshot_hash VARCHAR(64),
      triggered_by  TEXT          NOT NULL,
      snapshot_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ver_entity_snapshots_lookup_idx ON ver_entity_snapshots(entity_type, entity_id, version DESC);
    CREATE TABLE IF NOT EXISTS ver_change_history (
      id            BIGSERIAL     PRIMARY KEY,
      entity_type   VARCHAR(60)   NOT NULL,
      entity_id     INTEGER       NOT NULL,
      entity_code   VARCHAR(60),
      field_name    VARCHAR(80)   NOT NULL,
      old_value     TEXT,
      new_value     TEXT,
      change_type   VARCHAR(20)   NOT NULL DEFAULT 'update',
      changed_by    TEXT          NOT NULL,
      change_reason TEXT,
      changed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ver_change_history_entity_idx ON ver_change_history(entity_type, entity_id, changed_at DESC);
    CREATE TABLE IF NOT EXISTS lfc_status_events (
      id            BIGSERIAL     PRIMARY KEY,
      entity_type   VARCHAR(60)   NOT NULL,
      entity_id     INTEGER       NOT NULL,
      entity_code   VARCHAR(60),
      entity_label  VARCHAR(300),
      from_status   VARCHAR(20),
      to_status     VARCHAR(20)   NOT NULL,
      triggered_by  TEXT          NOT NULL,
      trigger_note  TEXT,
      approval_id   INTEGER,
      occurred_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS lfc_status_events_entity_idx ON lfc_status_events(entity_type, entity_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS lfc_status_events_status_idx ON lfc_status_events(to_status, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS gov_review_schedules (
      id                    SERIAL        PRIMARY KEY,
      entity_type           VARCHAR(60)   NOT NULL UNIQUE,
      review_frequency_days INTEGER       NOT NULL DEFAULT 180,
      last_reviewed_at      TIMESTAMPTZ,
      next_review_due       DATE,
      owner_role            VARCHAR(80),
      review_criteria       TEXT,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gov_review_instances (
      id                SERIAL        PRIMARY KEY,
      entity_type       VARCHAR(60)   NOT NULL,
      entity_id         INTEGER       NOT NULL,
      entity_code       VARCHAR(60),
      review_type       VARCHAR(30)   NOT NULL DEFAULT 'periodic',
      reviewer          TEXT,
      outcome           VARCHAR(30),
      findings          TEXT,
      action_required   TEXT,
      due_date          DATE,
      completed_at      TIMESTAMPTZ,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS gov_review_instances_entity_idx ON gov_review_instances(entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS gov_quality_gate_rules (
      id          SERIAL        PRIMARY KEY,
      rule_code   VARCHAR(40)   NOT NULL UNIQUE,
      entity_type VARCHAR(60)   NOT NULL,
      rule_name   VARCHAR(180)  NOT NULL,
      description TEXT,
      severity    VARCHAR(10)   NOT NULL DEFAULT 'warning',
      check_type  VARCHAR(30)   NOT NULL DEFAULT 'field_required',
      check_config JSONB,
      is_active   BOOLEAN       NOT NULL DEFAULT true,
      created_by  TEXT,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  // Seed ref data (idempotent)
  await pool.query(`
    INSERT INTO ref_seniority_levels (code,label,level_order,is_leadership) VALUES
      ('intern','Intern / Trainee',1,false),('junior','Junior',2,false),
      ('mid','Mid-Level',3,false),('senior','Senior',4,false),
      ('staff','Staff / Lead',5,false),('principal','Principal',6,false),
      ('manager','Manager',7,true),('senior_mgr','Senior Manager',8,true),
      ('director','Director',9,true),('vp','Vice President',10,true),
      ('c_suite','C-Suite / Executive',11,true)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO ref_proficiency_levels (code,label,level_order,score_band_min,score_band_max,description) VALUES
      ('novice','Novice',1,0,20,'Aware of the competency; relies on guidance'),
      ('developing','Developing',2,20,40,'Building skills; requires frequent support'),
      ('intermediate','Intermediate',3,40,60,'Applies independently in routine situations'),
      ('advanced','Advanced',4,60,80,'Applies in complex situations; coaches others'),
      ('expert','Expert',5,80,100,'Recognised authority; shapes the discipline')
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO ref_competency_categories (code,label,color_hex,sort_order) VALUES
      ('technical','Technical','#3B82F6',1),
      ('behavioral','Behavioural','#10B981',2),
      ('leadership','Leadership','#8B5CF6',3),
      ('domain','Domain / Functional','#F59E0B',4),
      ('cross_functional','Cross-Functional','#EC4899',5),
      ('cognitive','Cognitive','#6366F1',6),
      ('threshold','Threshold / Entry','#6B7280',7)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO ref_assessment_types (code,label,default_format) VALUES
      ('behavioral','Behavioural','likert_5'),
      ('technical','Technical / Knowledge','mcq'),
      ('situational','Situational Judgment','mcq'),
      ('self_report','Self-Report','likert_5'),
      ('manager_rating','Manager / Observer Rating','rating_scale'),
      ('portfolio','Portfolio / Evidence','open_text'),
      ('observation','Structured Observation','rating_scale'),
      ('feedback_360','360° Feedback','rating_scale'),
      ('knowledge_check','Knowledge Check','mcq'),
      ('simulation','Simulation / Role-Play','open_text')
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO ref_lifecycle_transitions (entity_type,from_status,to_status,requires_approval) VALUES
      ('*','draft','in_review',false),('*','in_review','approved',true),
      ('*','in_review','draft',false),('*','approved','published',false),
      ('*','approved','draft',false),('*','published','deprecated',true),
      ('*','deprecated','archived',false),('*','archived','draft',true)
    ON CONFLICT (entity_type,from_status,to_status) DO NOTHING;

    INSERT INTO gov_review_schedules (entity_type,review_frequency_days,owner_role,review_criteria) VALUES
      ('ont_layers',365,'Ontology Architect','Validate layer type alignment with framework evolution'),
      ('ont_competency_clusters',180,'Competency Lead','Cluster relevance, naming, weight calibration'),
      ('ont_competencies',180,'Competency Lead','Measurability, assessment_methods, development guide quality'),
      ('ont_micro_competencies',90,'Assessment Designer','observable_behavior specificity, IRT calibration'),
      ('ont_concerns',90,'Behavioural Analyst','CAPADEX bridge tag accuracy, severity calibration'),
      ('ont_assessment_questions',90,'Psychometrician','IRT stats, bias review, difficulty distribution'),
      ('ont_indicators',180,'Behavioural Analyst','Signal coverage, polarity accuracy, weight calibration')
    ON CONFLICT (entity_type) DO NOTHING;

    INSERT INTO gov_quality_gate_rules (rule_code,entity_type,rule_name,severity,check_type,check_config) VALUES
      ('COMP_001','ont_competencies','Competency must have at least one Micro Competency','warning','cardinality','{"min":1,"relation":"ont_micro_competencies","fk":"competency_id"}'),
      ('COMP_002','ont_competencies','Competency must be assigned to a Cluster','error','field_required','{"field":"cluster_id"}'),
      ('MICRO_001','ont_micro_competencies','Micro competency must declare proficiency_level','error','field_required','{"field":"proficiency_level"}'),
      ('MICRO_002','ont_micro_competencies','Micro competency must have observable_behavior','error','field_required','{"field":"observable_behavior"}'),
      ('CONC_001','ont_concerns','Concern must map to at least one Indicator','warning','cardinality','{"min":1,"relation":"map_concern_indicator","fk":"concern_id"}'),
      ('CONC_002','ont_concerns','Concern should have a CAPADEX bridge_tag','warning','field_required','{"field":"concern_bridge_tag"}'),
      ('CLUS_001','ont_competency_clusters','Cluster must have at least one Competency','warning','cardinality','{"min":1,"relation":"map_cluster_competency","fk":"cluster_id"}'),
      ('LAYER_001','ont_layers','Layer must link to at least one Cluster','warning','cardinality','{"min":1,"relation":"map_layer_cluster","fk":"layer_id"}'),
      ('IND_001','ont_indicators','Indicator must link to at least one Question','warning','cardinality','{"min":1,"relation":"map_indicator_question","fk":"indicator_id"}')
    ON CONFLICT (rule_code) DO NOTHING;
  `);
}

function pid(v: string): number | null { const n = parseInt(v); return isNaN(n) ? null : n; }

export function registerOntologyGovernanceRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  const ensure = () => ensureGovernanceSchema(pool);

  // ── REFERENCE DATA ───────────────────────────────────────────────────────────

  app.get('/api/ontology/ref/seniority-levels', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows } = await pool.query(`SELECT * FROM ref_seniority_levels WHERE is_active=true ORDER BY level_order`);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/ontology/ref/proficiency-levels', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows } = await pool.query(`SELECT * FROM ref_proficiency_levels WHERE is_active=true ORDER BY level_order`);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/ontology/ref/competency-categories', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows } = await pool.query(`SELECT * FROM ref_competency_categories WHERE is_active=true ORDER BY sort_order`);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/ontology/ref/assessment-types', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows } = await pool.query(`SELECT * FROM ref_assessment_types WHERE is_active=true ORDER BY code`);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/ontology/ref/lifecycle-transitions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type = '*' } = req.query as Record<string, string>;
      const { rows } = await pool.query(
        `SELECT * FROM ref_lifecycle_transitions WHERE entity_type=$1 OR entity_type='*' ORDER BY from_status, to_status`,
        [entity_type]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // ── VERSION SNAPSHOTS ────────────────────────────────────────────────────────

  app.get('/api/ontology/versions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type = '', search = '', page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (entity_type) { params.push(entity_type); conds.push(`entity_type=$${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(entity_code ILIKE $${params.length} OR entity_label ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT id,entity_type,entity_id,entity_code,entity_label,version,triggered_by,snapshot_at
         FROM ver_entity_snapshots ${where} ORDER BY snapshot_at DESC
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM ver_entity_snapshots ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/ontology/versions/:entityType/:entityId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entityType, entityId } = req.params;
      const id = pid(entityId);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query(
        `SELECT * FROM ver_entity_snapshots WHERE entity_type=$1 AND entity_id=$2 ORDER BY version DESC LIMIT 20`,
        [entityType, id]);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/ontology/versions/:entityType/:entityId/:version', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entityType, entityId, version } = req.params;
      const id = pid(entityId); const v = parseInt(version);
      if (!id || isNaN(v)) return res.status(400).json({ error: 'Invalid params' });
      const { rows: [row] } = await pool.query(
        `SELECT * FROM ver_entity_snapshots WHERE entity_type=$1 AND entity_id=$2 AND version=$3`,
        [entityType, id, v]);
      if (!row) return res.status(404).json({ error: 'Snapshot not found' });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // Manual snapshot capture (publish event)
  app.post('/api/ontology/versions/snapshot', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type, entity_id, snapshot_data, trigger_note } = req.body ?? {};
      if (!entity_type || !entity_id || !snapshot_data) return res.status(400).json({ error: 'entity_type, entity_id, snapshot_data required' });
      const actor = (req as any).user?.email ?? 'system';
      const { rows: [{ max_version }] } = await pool.query(
        `SELECT COALESCE(MAX(version),0) AS max_version FROM ver_entity_snapshots WHERE entity_type=$1 AND entity_id=$2`,
        [entity_type, entity_id]);
      const newVersion = (max_version as number) + 1;
      const { rows: [row] } = await pool.query(
        `INSERT INTO ver_entity_snapshots (entity_type,entity_id,entity_code,entity_label,version,snapshot_data,triggered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,version,snapshot_at`,
        [entity_type, entity_id,
         snapshot_data.code ?? null, snapshot_data.name ?? snapshot_data.title ?? null,
         newVersion, JSON.stringify(snapshot_data), actor]);
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to capture snapshot' }); }
  });

  // Change history
  app.get('/api/ontology/changes', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type = '', changed_by = '', field_name = '', page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (entity_type) { params.push(entity_type); conds.push(`entity_type=$${params.length}`); }
      if (changed_by.trim()) { params.push(`%${changed_by.trim()}%`); conds.push(`changed_by ILIKE $${params.length}`); }
      if (field_name.trim()) { params.push(field_name.trim()); conds.push(`field_name=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM ver_change_history ${where} ORDER BY changed_at DESC
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM ver_change_history ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/changes', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type, entity_id, entity_code, field_name, old_value, new_value, change_reason } = req.body ?? {};
      if (!entity_type || !entity_id || !field_name) return res.status(400).json({ error: 'entity_type, entity_id, field_name required' });
      const actor = (req as any).user?.email ?? 'system';
      const { rows: [row] } = await pool.query(
        `INSERT INTO ver_change_history (entity_type,entity_id,entity_code,field_name,old_value,new_value,changed_by,change_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [entity_type, entity_id, entity_code||null, field_name,
         old_value ?? null, new_value ?? null, actor, change_reason||null]);
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // ── LIFECYCLE EVENTS ─────────────────────────────────────────────────────────

  app.get('/api/ontology/lifecycle', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type = '', to_status = '', page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (entity_type) { params.push(entity_type); conds.push(`entity_type=$${params.length}`); }
      if (to_status) { params.push(to_status); conds.push(`to_status=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM lfc_status_events ${where} ORDER BY occurred_at DESC
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM lfc_status_events ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // Record a lifecycle transition
  app.post('/api/ontology/lifecycle/transition', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type, entity_id, entity_code, entity_label, from_status, to_status, trigger_note, approval_id } = req.body ?? {};
      if (!entity_type || !entity_id || !to_status) return res.status(400).json({ error: 'entity_type, entity_id, to_status required' });
      // Validate transition is allowed
      const { rows: [allowed] } = await pool.query(
        `SELECT id FROM ref_lifecycle_transitions WHERE (entity_type=$1 OR entity_type='*') AND from_status=$2 AND to_status=$3`,
        [entity_type, from_status ?? '', to_status]);
      if (!allowed) return res.status(400).json({ error: `Transition ${from_status} → ${to_status} is not allowed for ${entity_type}` });
      const actor = (req as any).user?.email ?? 'system';
      const { rows: [row] } = await pool.query(
        `INSERT INTO lfc_status_events (entity_type,entity_id,entity_code,entity_label,from_status,to_status,triggered_by,trigger_note,approval_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [entity_type, entity_id, entity_code||null, entity_label||null,
         from_status||null, to_status, actor, trigger_note||null, approval_id||null]);
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to record transition' }); }
  });

  // ── REVIEW SCHEDULES ─────────────────────────────────────────────────────────

  app.get('/api/ontology/governance/schedules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows } = await pool.query(`SELECT * FROM gov_review_schedules ORDER BY entity_type`);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.patch('/api/ontology/governance/schedules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { review_frequency_days, owner_role, review_criteria, next_review_due } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE gov_review_schedules SET
           review_frequency_days=COALESCE($1,review_frequency_days),
           owner_role=COALESCE($2,owner_role), review_criteria=COALESCE($3,review_criteria),
           next_review_due=COALESCE($4,next_review_due), updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [review_frequency_days, owner_role, review_criteria, next_review_due||null, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // ── REVIEW INSTANCES ─────────────────────────────────────────────────────────

  app.get('/api/ontology/governance/reviews', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type = '', outcome = 'all', page = '1', limit = '50' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const conds: string[] = [];
      if (entity_type) { params.push(entity_type); conds.push(`entity_type=$${params.length}`); }
      if (outcome !== 'all') { params.push(outcome); conds.push(`outcome=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM gov_review_instances ${where} ORDER BY created_at DESC
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]);
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM gov_review_instances ${where}`, params);
      return res.json({ items: rows, total: count });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/governance/reviews', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type, entity_id, entity_code, review_type = 'periodic', reviewer,
              outcome, findings, action_required, due_date, completed_at } = req.body ?? {};
      if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
      const actor = (req as any).user?.email ?? reviewer ?? 'system';
      const { rows: [row] } = await pool.query(
        `INSERT INTO gov_review_instances (entity_type,entity_id,entity_code,review_type,reviewer,outcome,findings,action_required,due_date,completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [entity_type, entity_id, entity_code||null, review_type, actor,
         outcome||null, findings||null, action_required||null, due_date||null, completed_at||null]);
      // Update the schedule last_reviewed_at
      await pool.query(
        `UPDATE gov_review_schedules SET last_reviewed_at=NOW(), updated_at=NOW() WHERE entity_type=$1`,
        [entity_type]).catch(() => null);
      return res.status(201).json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.patch('/api/ontology/governance/reviews/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { outcome, findings, action_required, completed_at } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE gov_review_instances SET
           outcome=COALESCE($1,outcome), findings=COALESCE($2,findings),
           action_required=COALESCE($3,action_required), completed_at=COALESCE($4,completed_at)
         WHERE id=$5 RETURNING *`,
        [outcome, findings, action_required, completed_at||null, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // ── QUALITY GATE RULES ───────────────────────────────────────────────────────

  app.get('/api/ontology/governance/quality-rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { entity_type = '', severity = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (entity_type) { params.push(entity_type); conds.push(`entity_type=$${params.length}`); }
      if (severity !== 'all') { params.push(severity); conds.push(`severity=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM gov_quality_gate_rules ${where} ORDER BY entity_type, severity, rule_code`, params);
      return res.json({ items: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/ontology/governance/quality-rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rule_code, entity_type, rule_name, description, severity = 'warning', check_type = 'field_required', check_config } = req.body ?? {};
      if (!rule_code || !entity_type || !rule_name) return res.status(400).json({ error: 'rule_code, entity_type, rule_name required' });
      const { rows: [row] } = await pool.query(
        `INSERT INTO gov_quality_gate_rules (rule_code,entity_type,rule_name,description,severity,check_type,check_config,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [rule_code, entity_type, rule_name, description||null, severity, check_type,
         check_config ? JSON.stringify(check_config) : null, (req as any).user?.email ?? null]);
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Rule code already exists' });
      return res.status(500).json({ error: 'Failed' });
    }
  });

  app.patch('/api/ontology/governance/quality-rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      const { rule_name, description, severity, check_type, check_config, is_active } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE gov_quality_gate_rules SET
           rule_name=COALESCE($1,rule_name), description=COALESCE($2,description),
           severity=COALESCE($3,severity), check_type=COALESCE($4,check_type),
           check_config=COALESCE($5,check_config), is_active=COALESCE($6,is_active), updated_at=NOW()
         WHERE id=$7 RETURNING *`,
        [rule_name, description, severity, check_type,
         check_config ? JSON.stringify(check_config) : null, is_active, id]);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/ontology/governance/quality-rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const id = pid(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid id' });
      await pool.query(`UPDATE gov_quality_gate_rules SET is_active=false, updated_at=NOW() WHERE id=$1`, [id]);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed' }); }
  });

  // ── GOVERNANCE STATS ─────────────────────────────────────────────────────────

  app.get('/api/ontology/governance/stats', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensure();
      const { rows: [stats] } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM ver_entity_snapshots) AS snapshots_total,
          (SELECT COUNT(*)::int FROM ver_change_history)   AS changes_total,
          (SELECT COUNT(*)::int FROM lfc_status_events)    AS lifecycle_events_total,
          (SELECT COUNT(*)::int FROM lfc_status_events WHERE to_status='published') AS publish_events,
          (SELECT COUNT(*)::int FROM gov_review_instances) AS reviews_total,
          (SELECT COUNT(*)::int FROM gov_review_instances WHERE outcome='fail') AS review_failures,
          (SELECT COUNT(*)::int FROM gov_quality_gate_rules WHERE is_active=true) AS active_rules,
          (SELECT COUNT(*)::int FROM gov_review_schedules WHERE next_review_due <= CURRENT_DATE) AS overdue_reviews
      `);

      // Overdue review schedules
      const { rows: overdue } = await pool.query(`
        SELECT entity_type, owner_role, next_review_due
        FROM gov_review_schedules
        WHERE next_review_due <= CURRENT_DATE AND is_active=true
        ORDER BY next_review_due
        LIMIT 10
      `);

      // Recent lifecycle events
      const { rows: recentLifecycle } = await pool.query(`
        SELECT entity_type, entity_code, from_status, to_status, triggered_by, occurred_at
        FROM lfc_status_events ORDER BY occurred_at DESC LIMIT 10
      `);

      return res.json({ stats, overdue, recentLifecycle });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch governance stats' }); }
  });
}
