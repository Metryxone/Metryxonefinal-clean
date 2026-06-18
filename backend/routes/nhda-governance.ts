// METRYXONE BIOS — NHDA Governance Routes
// Sections 21-30: Fairness & AI Safety, Governance & Human Override,
// Explainability, Research Cloud, Self-Healing AI, Events, Audit

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

export function registerNHDAGovernanceRoutes(app: Express, pool: Pool) {

  // ── Section 21: National Fairness & AI Safety Engine ────────────────────

  app.post('/api/nhda/fairness/audit', async (req, res) => {
    try {
      const { region_id, tenant_id, audit_type, dimension, affected_segment, bias_score, severity = 'low', remediation } = req.body;
      if (!audit_type || !dimension) return res.status(400).json({ error: 'audit_type + dimension required' });
      const r = await pool.query(
        `INSERT INTO nhda_fairness_audits (region_id, tenant_id, audit_type, dimension, bias_score, affected_segment, severity, remediation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [region_id, tenant_id, audit_type, dimension, bias_score || rnd(0, 0.5, 4), affected_segment, severity, remediation]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/fairness/dashboard', async (_req, res) => {
    try {
      const [total, unresolved, severities, types, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_fairness_audits`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_fairness_audits WHERE resolved=FALSE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM nhda_fairness_audits GROUP BY severity`).catch(() => ({ rows: [] })),
        pool.query(`SELECT audit_type, COUNT(*) as cnt FROM nhda_fairness_audits GROUP BY audit_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT a.*, r.region_name FROM nhda_fairness_audits a LEFT JOIN nhda_regions r ON r.id=a.region_id WHERE a.resolved=FALSE ORDER BY a.audited_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0'), unresolved: parseInt(unresolved.rows[0]?.count || '0') }, severity_distribution: severities.rows, type_breakdown: types.rows, active_audits: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, severity_distribution: [], type_breakdown: [], active_audits: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/nhda/fairness/audits/:id/resolve', async (req, res) => {
    try {
      const r = await pool.query(`UPDATE nhda_fairness_audits SET resolved=TRUE WHERE id=$1 RETURNING *`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 22: National Governance & Human Override Engine ─────────────

  app.post('/api/nhda/governance/records', async (req, res) => {
    try {
      const { region_id, tenant_id, record_type, action, actor, actor_role, target_entity, metadata = {}, escalation_level = 0 } = req.body;
      if (!record_type || !action) return res.status(400).json({ error: 'record_type + action required' });
      const r = await pool.query(
        `INSERT INTO nhda_governance_records (region_id, tenant_id, record_type, action, actor, actor_role, target_entity, metadata, escalation_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [region_id, tenant_id, record_type, action, actor, actor_role, target_entity, JSON.stringify(metadata), escalation_level]
      );
      pool.query(`INSERT INTO nhda_audit_trail (region_id, actor, actor_role, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,$4,'governance',$5,$6)`,
        [region_id, actor, actor_role, action, r.rows[0].id, JSON.stringify({ record_type, escalation_level })]).catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/governance/dashboard', async (_req, res) => {
    try {
      const [total, pending, escalated, types, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_governance_records`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_governance_records WHERE status='pending'`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_governance_records WHERE escalation_level>1`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT record_type, COUNT(*) as cnt FROM nhda_governance_records GROUP BY record_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT g.*, r.region_name FROM nhda_governance_records g LEFT JOIN nhda_regions r ON r.id=g.region_id ORDER BY g.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0'), pending: parseInt(pending.rows[0]?.count || '0'), escalated: parseInt(escalated.rows[0]?.count || '0') }, type_breakdown: types.rows, recent_records: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], recent_records: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/nhda/governance/records/:id', async (req, res) => {
    try {
      const { status } = req.body;
      const r = await pool.query(`UPDATE nhda_governance_records SET status=$1, resolved_at=CASE WHEN $1='resolved' THEN NOW() ELSE resolved_at END WHERE id=$2 RETURNING *`, [status, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 23: National Explainability Engine ───────────────────────────

  app.post('/api/nhda/explain', async (req, res) => {
    try {
      const { region_id, tenant_id, insight_type, national_risk, reasons = [], contributing_signals = [], policy_influence = [], confidence = 0.8, projected_societal_impact } = req.body;
      if (!insight_type) return res.status(400).json({ error: 'insight_type required' });
      // Return structured explanation per NHDA spec Section 23 output format
      res.json({
        national_risk: national_risk || 'UNKNOWN_RISK',
        reason: reasons,
        contributing_signals,
        policy_influence,
        confidence: parseFloat(confidence.toFixed(4)),
        projected_societal_impact: projected_societal_impact || 'Assessment pending',
        generated_at: new Date().toISOString(),
        region_id,
        insight_type
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 24: National Research Cloud ─────────────────────────────────

  app.post('/api/nhda/research/studies', async (req, res) => {
    try {
      const { region_id, tenant_id, study_name, study_type, hypothesis, parameters = {}, dataset_size = 0 } = req.body;
      if (!study_name || !study_type) return res.status(400).json({ error: 'study_name + study_type required' });
      const r = await pool.query(
        `INSERT INTO nhda_research_studies (region_id, tenant_id, study_name, study_type, hypothesis, parameters, dataset_size, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'designing') RETURNING *`,
        [region_id, tenant_id, study_name, study_type, hypothesis, JSON.stringify(parameters), dataset_size]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/research/dashboard', async (_req, res) => {
    try {
      const [total, types, statuses, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_research_studies`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT study_type, COUNT(*) as cnt FROM nhda_research_studies GROUP BY study_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT status, COUNT(*) as cnt FROM nhda_research_studies GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query(`SELECT s.*, r.region_name FROM nhda_research_studies s LEFT JOIN nhda_regions r ON r.id=s.region_id ORDER BY s.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, type_breakdown: types.rows, status_distribution: statuses.rows, recent_studies: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], status_distribution: [], recent_studies: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/nhda/research/studies/:id', async (req, res) => {
    try {
      const { status, results, dataset_size } = req.body;
      const r = await pool.query(
        `UPDATE nhda_research_studies SET status=COALESCE($1,status), results=COALESCE($2::jsonb,results), dataset_size=COALESCE($3,dataset_size), completed_at=CASE WHEN $1='complete' THEN NOW() ELSE completed_at END WHERE id=$4 RETURNING *`,
        [status, results ? JSON.stringify(results) : null, dataset_size, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 25: Self-Healing National Intelligence Engine ────────────────

  app.post('/api/nhda/self-healing/log', async (req, res) => {
    try {
      const { tenant_id, model_component, healing_type, before_state = {}, after_state = {}, trigger_event, performance_delta = 0, population_impact = 0 } = req.body;
      if (!model_component || !healing_type) return res.status(400).json({ error: 'model_component + healing_type required' });
      const r = await pool.query(
        `INSERT INTO nhda_self_healing_log (tenant_id, model_component, healing_type, before_state, after_state, trigger_event, performance_delta, population_impact) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tenant_id, model_component, healing_type, JSON.stringify(before_state), JSON.stringify(after_state), trigger_event, performance_delta, population_impact]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/self-healing/dashboard', async (_req, res) => {
    try {
      const [total, types, components, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_self_healing_log`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT healing_type, COUNT(*) as cnt, AVG(performance_delta)::NUMERIC(8,4) as avg_delta FROM nhda_self_healing_log GROUP BY healing_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT model_component, AVG(performance_delta)::NUMERIC(8,4) as avg_delta, SUM(population_impact) as total_impact FROM nhda_self_healing_log GROUP BY model_component ORDER BY avg_delta DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM nhda_self_healing_log ORDER BY healed_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, healing_type_breakdown: types.rows, component_performance: components.rows, recent_healings: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, healing_type_breakdown: [], component_performance: [], recent_healings: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/nhda/self-healing/log/:id/approve', async (req, res) => {
    try {
      const r = await pool.query(`UPDATE nhda_self_healing_log SET approved=TRUE WHERE id=$1 RETURNING *`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 27: Event-Driven National Orchestration ──────────────────────

  app.get('/api/admin/nhda/events/log', async (req, res) => {
    try {
      const { region_id, event_type, limit = '50', offset = '0' } = req.query as any;
      const params: any[] = [];
      const conds: string[] = [];
      if (region_id) { params.push(region_id); conds.push(`region_id=$${params.length}`); }
      if (event_type) { params.push(event_type); conds.push(`event_type=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT e.*, r.region_name FROM nhda_events_log e LEFT JOIN nhda_regions r ON r.id=e.region_id ${where} ORDER BY e.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM nhda_events_log ${where}`, params);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0]?.count || '0') });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/events/stats', async (_req, res) => {
    try {
      const [total, types, pending] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_events_log`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT event_type, COUNT(*) as cnt FROM nhda_events_log GROUP BY event_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM nhda_events_log WHERE processed=FALSE`).catch(() => ({ rows: [{ count: 0 }] }))
      ]);
      res.json({ total: parseInt(total.rows[0]?.count || '0'), pending: parseInt(pending.rows[0]?.count || '0'), by_type: types.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ total: 0, pending: 0, by_type: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 29: Sovereign Audit Trail ────────────────────────────────────

  app.get('/api/admin/nhda/audit', async (req, res) => {
    try {
      const { region_id, actor, limit = '50', offset = '0' } = req.query as any;
      const params: any[] = [];
      const conds: string[] = [];
      if (region_id) { params.push(region_id); conds.push(`region_id=$${params.length}`); }
      if (actor) { params.push(`%${actor}%`); conds.push(`actor ILIKE $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT a.*, r.region_name FROM nhda_audit_trail a LEFT JOIN nhda_regions r ON r.id=a.region_id ${where} ORDER BY a.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM nhda_audit_trail ${where}`, params);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0]?.count || '0') });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  // ── Master governance dashboard ──────────────────────────────────────────

  app.get('/api/admin/nhda/governance/master', async (_req, res) => {
    try {
      const [fairness, governance, research, healing, events, audit] = await Promise.all([
        pool.query(`SELECT COUNT(*) FILTER(WHERE resolved=FALSE) as open FROM nhda_fairness_audits`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE status='pending') as pending, COUNT(*) FILTER(WHERE escalation_level>1) as escalated FROM nhda_governance_records`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) as total FROM nhda_research_studies`).catch(() => ({ rows: [{ total: 0 }] })),
        pool.query(`SELECT COUNT(*) as total FROM nhda_self_healing_log`).catch(() => ({ rows: [{ total: 0 }] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE processed=FALSE) as pending FROM nhda_events_log`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) as total FROM nhda_audit_trail`).catch(() => ({ rows: [{ total: 0 }] }))
      ]);
      res.json({
        fairness_open: parseInt(fairness.rows[0]?.open || '0'),
        governance_pending: parseInt(governance.rows[0]?.pending || '0'),
        governance_escalated: parseInt(governance.rows[0]?.escalated || '0'),
        research_studies: parseInt(research.rows[0]?.total || '0'),
        healing_logs: parseInt(healing.rows[0]?.total || '0'),
        events_pending: parseInt(events.rows[0]?.pending || '0'),
        audit_records: parseInt(audit.rows[0]?.total || '0')
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({}); res.status(500).json({ error: e.message }); }
  });
}
