/**
 * Ontology AI Rules Routes — M17
 * Governance rules for AI scoring, routing, suppression, and language policy.
 *
 * GET/POST/PATCH/DELETE /api/ontology/ai-rules
 * POST                  /api/ontology/ai-rules/:id/approve
 * POST                  /api/ontology/ai-rules/:id/suspend
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { logAudit } from '../services/platform-audit.js';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureAIRulesSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ont_ai_rules (
      id SERIAL PRIMARY KEY, code VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL,
      description TEXT,
      rule_type VARCHAR(30) NOT NULL DEFAULT 'scoring',
      applies_to VARCHAR(30) NOT NULL DEFAULT 'all',
      priority SMALLINT NOT NULL DEFAULT 5,
      is_enabled BOOLEAN NOT NULL DEFAULT false,
      conditions JSONB, action JSONB, rationale TEXT,
      risk_level VARCHAR(10) NOT NULL DEFAULT 'low',
      requires_dual_approval BOOLEAN NOT NULL DEFAULT false,
      approved_by TEXT, approved_at TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ont_ai_rule_audit_log (
      id SERIAL PRIMARY KEY, rule_id INTEGER NOT NULL REFERENCES ont_ai_rules(id) ON DELETE CASCADE,
      action VARCHAR(20) NOT NULL, changed_by TEXT NOT NULL, change_note TEXT,
      before_data JSONB, after_data JSONB, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function logRuleAudit(pool: Pool, ruleId: number, action: string, changedBy: string, note: string | null, before: unknown, after: unknown) {
  await pool.query(
    `INSERT INTO ont_ai_rule_audit_log (rule_id, action, changed_by, change_note, before_data, after_data) VALUES ($1,$2,$3,$4,$5,$6)`,
    [ruleId, action, changedBy, note, JSON.stringify(before), JSON.stringify(after)]
  );
}

export function registerOntologyAIRulesRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {
  // List
  app.get('/api/ontology/ai-rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const { search = '', status = 'all', rule_type = 'all', applies_to = 'all' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const conds: string[] = [];
      if (status !== 'all') { params.push(status); conds.push(`status = $${params.length}`); }
      if (rule_type !== 'all') { params.push(rule_type); conds.push(`rule_type = $${params.length}`); }
      if (applies_to !== 'all') { params.push(applies_to); conds.push(`applies_to = $${params.length}`); }
      if (search.trim()) { params.push(`%${search.trim()}%`); conds.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(`SELECT * FROM ont_ai_rules ${where} ORDER BY priority DESC, rule_type, name LIMIT 200`, params);
      return res.json({ items: rows, total: rows.length });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch AI rules' }); }
  });

  // Create
  app.post('/api/ontology/ai-rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const { code, name, description, rule_type = 'scoring', applies_to = 'all', priority = 5, conditions, action, rationale, risk_level = 'low', requires_dual_approval = false } = req.body ?? {};
      if (!code || !name) return res.status(400).json({ error: 'code and name required' });
      if (!description) return res.status(400).json({ error: 'description required for AI rules (governance)' });
      const changedBy = (req as any).user?.email || 'superadmin';
      const { rows: [row] } = await pool.query(
        `INSERT INTO ont_ai_rules (code, name, description, rule_type, applies_to, priority, conditions, action, rationale, risk_level, requires_dual_approval, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [code, name, description, rule_type, applies_to, priority, conditions ? JSON.stringify(conditions) : null, action ? JSON.stringify(action) : null, rationale, risk_level, requires_dual_approval, changedBy]
      );
      await logRuleAudit(pool, row.id, 'created', changedBy, 'Rule created', null, row);
      void logAudit(pool, req, { action: 'create', entityType: 'ai-rule', entityId: row.id, entityLabel: `${code} — ${name}`, after: row });
      return res.status(201).json({ item: row });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ error: 'Code already exists' });
      return res.status(500).json({ error: 'Failed to create AI rule' });
    }
  });

  // Update
  app.patch('/api/ontology/ai-rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_ai_rules WHERE id=$1`, [id]);
      if (!before) return res.status(404).json({ error: 'Not found' });
      // Block enabling without approval
      if (req.body?.is_enabled === true && before.status !== 'approved') {
        return res.status(422).json({ error: 'Rule must be approved before enabling. Use the approve endpoint.' });
      }
      const { name, description, rule_type, applies_to, priority, conditions, action, rationale, risk_level, requires_dual_approval, status } = req.body ?? {};
      const { rows: [row] } = await pool.query(
        `UPDATE ont_ai_rules SET name=COALESCE($1,name), description=COALESCE($2,description),
         rule_type=COALESCE($3,rule_type), applies_to=COALESCE($4,applies_to),
         priority=COALESCE($5,priority), conditions=COALESCE($6,conditions), action=COALESCE($7,action),
         rationale=COALESCE($8,rationale), risk_level=COALESCE($9,risk_level),
         requires_dual_approval=COALESCE($10,requires_dual_approval),
         status=COALESCE($11,status), updated_at=NOW() WHERE id=$12 RETURNING *`,
        [name, description, rule_type, applies_to, priority, conditions ? JSON.stringify(conditions) : null, action ? JSON.stringify(action) : null, rationale, risk_level, requires_dual_approval, status, id]
      );
      const changedBy = (req as any).user?.email || 'superadmin';
      await logRuleAudit(pool, id, 'updated', changedBy, req.body?.change_note || null, before, row);
      void logAudit(pool, req, { action: 'update', entityType: 'ai-rule', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to update AI rule' }); }
  });

  // Approve (moves to approved status + logs)
  app.post('/api/ontology/ai-rules/:id/approve', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const id = parseInt(req.params.id);
      const changedBy = (req as any).user?.email || 'superadmin';
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_ai_rules WHERE id=$1`, [id]);
      if (!before) return res.status(404).json({ error: 'Not found' });
      if (before.status === 'archived') return res.status(422).json({ error: 'Cannot approve an archived rule' });
      const { rows: [row] } = await pool.query(
        `UPDATE ont_ai_rules SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`,
        [changedBy, id]
      );
      await logRuleAudit(pool, id, 'approved', changedBy, req.body?.note || null, before, row);
      void logAudit(pool, req, { action: 'approve', entityType: 'ai-rule', entityId: id, entityLabel: row.name, before: before ?? null, after: row });
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to approve rule' }); }
  });

  // Enable
  app.post('/api/ontology/ai-rules/:id/enable', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const id = parseInt(req.params.id);
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_ai_rules WHERE id=$1`, [id]);
      if (!before) return res.status(404).json({ error: 'Not found' });
      if (before.status !== 'approved') return res.status(422).json({ error: 'Rule must be approved before enabling' });
      const changedBy = (req as any).user?.email || 'superadmin';
      const { rows: [row] } = await pool.query(
        `UPDATE ont_ai_rules SET is_enabled=true, status='active', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
      );
      await logRuleAudit(pool, id, 'enabled', changedBy, null, before, row);
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to enable rule' }); }
  });

  // Suspend
  app.post('/api/ontology/ai-rules/:id/suspend', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const id = parseInt(req.params.id);
      const changedBy = (req as any).user?.email || 'superadmin';
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_ai_rules WHERE id=$1`, [id]);
      const { rows: [row] } = await pool.query(
        `UPDATE ont_ai_rules SET is_enabled=false, status='suspended', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
      );
      await logRuleAudit(pool, id, 'suspended', changedBy, req.body?.reason || null, before, row);
      return res.json({ item: row });
    } catch (err) { return res.status(500).json({ error: 'Failed to suspend rule' }); }
  });

  // Delete (archive)
  app.delete('/api/ontology/ai-rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const id = parseInt(req.params.id);
      const changedBy = (req as any).user?.email || 'superadmin';
      const { rows: [before] } = await pool.query(`SELECT * FROM ont_ai_rules WHERE id=$1`, [id]);
      await pool.query(`UPDATE ont_ai_rules SET is_enabled=false, status='archived', updated_at=NOW() WHERE id=$1`, [id]);
      await logRuleAudit(pool, id, 'archived', changedBy, null, before, { ...before, status: 'archived' });
      void logAudit(pool, req, { action: 'archive', entityType: 'ai-rule', entityId: id });
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'Failed to delete AI rule' }); }
  });

  // Audit log
  app.get('/api/ontology/ai-rules/:id/audit-log', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureAIRulesSchema(pool);
      const { rows } = await pool.query(`SELECT * FROM ont_ai_rule_audit_log WHERE rule_id=$1 ORDER BY changed_at DESC LIMIT 50`, [req.params.id]);
      return res.json({ entries: rows });
    } catch (err) { return res.status(500).json({ error: 'Failed to fetch audit log' }); }
  });
}
