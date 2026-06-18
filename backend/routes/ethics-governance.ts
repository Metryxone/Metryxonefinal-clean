import type { Express } from "express";
import pg from "pg";

export function registerEthicsGovernanceRoutes(app: Express, pool: pg.Pool) {

  // POST /api/governance/event
  app.post('/api/governance/event', async (req, res) => {
    const { event_type, user_email, actor_email, entity_type, entity_id, description, severity='info', metadata={} } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type required' });
    try {
      const row = await pool.query(
        `INSERT INTO governance_events (event_type,user_email,actor_email,entity_type,entity_id,description,severity,metadata,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
        [event_type, user_email||null, actor_email||null, entity_type||null, entity_id||null, description||null, severity, JSON.stringify(metadata)]
      );
      res.json({ success: true, event: row.rows[0] });
    } catch (err) {
      console.error('Governance event error:', err);
      res.status(500).json({ error: 'store failed' });
    }
  });

  // GET /api/admin/governance/events
  app.get('/api/admin/governance/events', async (req, res) => {
    const { page='1', limit='50', severity, type, search } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (severity) { params.push(severity); where.push(`severity=$${params.length}`); }
    if (type)     { params.push(type);     where.push(`event_type=$${params.length}`); }
    if (search)   { params.push(`%${search}%`); where.push(`(user_email ILIKE $${params.length} OR description ILIKE $${params.length})`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const [countRes, rows, kpi, severityDist, eventTypes] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM governance_events ${wc}`, params),
        pool.query(
          `SELECT * FROM governance_events ${wc} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
        pool.query(`SELECT COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity='critical') as critical_events,
          COUNT(*) FILTER (WHERE severity='warning') as warning_events,
          COUNT(DISTINCT user_email) as affected_users,
          COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '24 hours') as last_24h
          FROM governance_events`),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM governance_events GROUP BY severity ORDER BY cnt DESC`),
        pool.query(`SELECT event_type, COUNT(*) as cnt FROM governance_events GROUP BY event_type ORDER BY cnt DESC LIMIT 10`),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows,
                 kpi: kpi.rows[0], severity_distribution: severityDist.rows, event_types: eventTypes.rows });
    } catch (err) {
      console.error('Governance events error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // POST /api/admin/governance/interventions
  app.post('/api/admin/governance/interventions', async (req, res) => {
    const { intervention_type, user_email, requester_email, priority='medium', notes } = req.body;
    if (!intervention_type || !user_email || !requester_email) return res.status(400).json({ error: 'intervention_type, user_email, requester_email required' });
    try {
      const row = await pool.query(
        `INSERT INTO intervention_approvals (intervention_type,user_email,requester_email,priority,notes,status,created_at)
         VALUES ($1,$2,$3,$4,$5,'pending',NOW()) RETURNING *`,
        [intervention_type, user_email, requester_email, priority, notes||null]
      );
      await pool.query(
        `INSERT INTO governance_events (event_type,user_email,actor_email,entity_type,entity_id,description,severity,created_at)
         VALUES ('intervention_requested',$1,$2,'intervention_approval',$3,$4,'info',NOW())`,
        [user_email, requester_email, String(row.rows[0].id), `${intervention_type} requested for ${user_email}`]
      );
      res.json({ success: true, approval: row.rows[0] });
    } catch (err) {
      console.error('Intervention request error:', err);
      res.status(500).json({ error: 'create failed' });
    }
  });

  // GET /api/admin/governance/interventions
  app.get('/api/admin/governance/interventions', async (req, res) => {
    const { page='1', limit='25', status, priority } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (status)   { params.push(status);   where.push(`status=$${params.length}`); }
    if (priority) { params.push(priority); where.push(`priority=$${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const [countRes, rows, kpi] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM intervention_approvals ${wc}`, params),
        pool.query(
          `SELECT * FROM intervention_approvals ${wc} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
        pool.query(`SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='pending') as pending,
          COUNT(*) FILTER (WHERE status='approved') as approved,
          COUNT(*) FILTER (WHERE status='rejected') as rejected,
          COUNT(*) FILTER (WHERE priority='critical') as critical,
          COUNT(*) FILTER (WHERE priority='high') as high_priority
          FROM intervention_approvals`),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, kpi: kpi.rows[0] });
    } catch (err) {
      console.error('Interventions fetch error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // PATCH /api/admin/governance/interventions/:id
  app.patch('/api/admin/governance/interventions/:id', async (req, res) => {
    const { id } = req.params;
    const { status, approver_email, approver_notes } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    try {
      const row = await pool.query(
        `UPDATE intervention_approvals SET status=$1, approver_email=$2, approver_notes=$3, resolved_at=NOW()
         WHERE id=$4 RETURNING *`,
        [status, approver_email||null, approver_notes||null, id]
      );
      if (!row.rows[0]) return res.status(404).json({ error: 'not found' });
      await pool.query(
        `INSERT INTO governance_events (event_type,user_email,actor_email,entity_type,entity_id,description,severity,created_at)
         VALUES ($1,$2,$3,'intervention_approval',$4,$5,'info',NOW())`,
        [`intervention_${status}`, row.rows[0].user_email, approver_email||'system', id,
         `Intervention ${status}: ${row.rows[0].intervention_type}`]
      );
      res.json({ success: true, approval: row.rows[0] });
    } catch (err) {
      console.error('Intervention update error:', err);
      res.status(500).json({ error: 'update failed' });
    }
  });

  // GET /api/admin/governance/dashboard
  app.get('/api/admin/governance/dashboard', async (_req, res) => {
    try {
      const [eventsKpi, approvalsKpi, recentEvents, pendingApprovals, eventTrend] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity='critical') as critical,
          COUNT(*) FILTER (WHERE severity='warning') as warnings,
          COUNT(DISTINCT user_email) as affected_users,
          COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '24 hours') as last_24h
          FROM governance_events`),
        pool.query(`SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='pending') as pending,
          COUNT(*) FILTER (WHERE status='approved') as approved,
          COUNT(*) FILTER (WHERE status='rejected') as rejected,
          COUNT(*) FILTER (WHERE priority IN ('critical','high') AND status='pending') as urgent_pending
          FROM intervention_approvals`),
        pool.query(`SELECT * FROM governance_events ORDER BY created_at DESC LIMIT 20`),
        pool.query(`SELECT * FROM intervention_approvals WHERE status='pending' ORDER BY
          CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          created_at ASC LIMIT 10`),
        pool.query(`SELECT DATE_TRUNC('day',created_at)::date as day, COUNT(*) as cnt
          FROM governance_events WHERE created_at > NOW()-INTERVAL '14 days'
          GROUP BY day ORDER BY day`),
      ]);
      res.json({
        events_kpi: eventsKpi.rows[0],
        approvals_kpi: approvalsKpi.rows[0],
        recent_events: recentEvents.rows,
        pending_approvals: pendingApprovals.rows,
        event_trend: eventTrend.rows,
      });
    } catch (err) {
      console.error('Governance dashboard error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // Seed some initial governance events
  app.post('/api/admin/governance/seed', async (_req, res) => {
    const events = [
      ['consent_captured','test@example.com','system',null,null,'User consent captured for CAPADEX assessment','info'],
      ['data_accessed','lakshman.vema@gmail.com','superadmin@metryx.one','capadex_session',null,'Admin accessed user session data','info'],
      ['consent_captured','flow_test@example.com','system',null,null,'User consent captured for CAPADEX assessment','info'],
      ['risk_flag_auto_detected','test@example.com','system','risk_flag','1','Low score risk flag auto-detected','warning'],
      ['intervention_triggered','lakshman.vema@gmail.com','system','capadex_intervention',null,'Automated intervention recommendation generated','info'],
    ];
    try {
      for (const [et, ue, ae, etype, eid, desc, sev] of events) {
        await pool.query(
          `INSERT INTO governance_events (event_type,user_email,actor_email,entity_type,entity_id,description,severity,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()-INTERVAL '${Math.floor(Math.random()*48)} hours')`,
          [et, ue, ae, etype, eid, desc, sev]
        );
      }
      res.json({ success: true, seeded: events.length });
    } catch (err) {
      res.status(500).json({ error: 'seed failed' });
    }
  });
}
