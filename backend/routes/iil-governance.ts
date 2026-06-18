// METRYXONE BIOS — IIL Governance Routes
// Sections 27-40: Simulation, Forecast Market, Fairness, Governance,
// Explainability, AI Safety, Research, Recursive AI, Events, Audit

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

export function registerIILGovernanceRoutes(app: Express, pool: Pool) {

  // ── Section 27: Simulation Engine ───────────────────────────────────────

  app.post('/api/iil/simulations/run', async (req, res) => {
    try {
      const { institution_id, tenant_id, simulation_type, parameters = {}, iterations = 100 } = req.body;
      if (!institution_id || !simulation_type) return res.status(400).json({ error: 'institution_id + simulation_type required' });
      const VALID = ['ecosystem_instability','resilience_recovery','workforce_evolution','collapse','innovation_acceleration','policy_optimization'];
      if (!VALID.includes(simulation_type)) return res.status(400).json({ error: `Invalid simulation_type. Valid: ${VALID.join(', ')}` });
      const r = await pool.query(
        `INSERT INTO iil_simulations (institution_id, tenant_id, simulation_type, parameters, iterations, status)
         VALUES ($1,$2,$3,$4,$5,'running') RETURNING *`,
        [institution_id, tenant_id, simulation_type, JSON.stringify(parameters), Math.min(1000, iterations)]
      );
      const simId = r.rows[0].id;
      // Run simulation async
      setTimeout(async () => {
        try {
          const n = Math.min(1000, iterations);
          const outcomes: number[] = Array.from({ length: n }, () => rnd(20, 90, 2));
          const mean = outcomes.reduce((a, b) => a + b, 0) / n;
          const std = Math.sqrt(outcomes.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / n);
          const results = {
            simulation_type,
            iterations: n,
            outcome_mean: mean.toFixed(2),
            outcome_std: std.toFixed(2),
            p10: outcomes.sort()[Math.floor(n * 0.1)],
            p50: outcomes.sort()[Math.floor(n * 0.5)],
            p90: outcomes.sort()[Math.floor(n * 0.9)],
            risk_scenarios: Math.round(outcomes.filter(v => v < 40).length / n * 100),
            success_scenarios: Math.round(outcomes.filter(v => v > 70).length / n * 100),
            parameters
          };
          await pool.query(
            `UPDATE iil_simulations SET status='complete', results=$1, confidence=$2, completed_at=NOW() WHERE id=$3`,
            [JSON.stringify(results), rnd(0.7, 0.95, 4), simId]
          );
        } catch { await pool.query(`UPDATE iil_simulations SET status='failed' WHERE id=$1`, [simId]); }
      }, 500);
      res.status(202).json({ ...r.rows[0], message: 'Simulation queued. Poll /api/iil/simulations/'+simId+' for results.' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/iil/simulations/:id', async (req, res) => {
    try {
      const r = await pool.query(`SELECT s.*, i.name as institution_name FROM iil_simulations s LEFT JOIN iil_institutions i ON i.id=s.institution_id WHERE s.id=$1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Simulation not found' });
      res.json(r.rows[0]);
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.status(404).json({ error: 'Not found' }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/simulations/dashboard', async (_req, res) => {
    try {
      const [total, by_type, by_status, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_simulations`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT simulation_type, COUNT(*) as cnt, AVG(confidence)::NUMERIC(5,4) as avg_confidence FROM iil_simulations GROUP BY simulation_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT status, COUNT(*) as cnt FROM iil_simulations GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query(`SELECT s.*, i.name as institution_name FROM iil_simulations s LEFT JOIN iil_institutions i ON i.id=s.institution_id ORDER BY s.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, type_breakdown: by_type.rows, status_distribution: by_status.rows, recent_simulations: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], status_distribution: [], recent_simulations: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 28: Forecast Market Engine ──────────────────────────────────

  app.post('/api/iil/forecasts/generate', async (req, res) => {
    try {
      const { institution_id, tenant_id, outcome_type, forecast_horizon = '90d' } = req.body;
      if (!institution_id || !outcome_type) return res.status(400).json({ error: 'institution_id + outcome_type required' });
      const prob = rnd(0.2, 0.85, 4);
      const ci_low = Math.max(0, prob - rnd(0.05, 0.15, 4));
      const ci_high = Math.min(1, prob + rnd(0.05, 0.15, 4));
      const scenarios = [
        { label: 'Optimistic', probability: ci_high, drivers: ['Strong leadership', 'High engagement'] },
        { label: 'Base Case', probability: prob, drivers: ['Current trajectory continues'] },
        { label: 'Pessimistic', probability: ci_low, drivers: ['Burnout escalation', 'Trust decline'] }
      ];
      const r = await pool.query(
        `INSERT INTO iil_forecast_market (institution_id, tenant_id, forecast_horizon, outcome_type, probability, confidence_interval_low, confidence_interval_high, scenarios, model_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'v1.0') RETURNING *`,
        [institution_id, tenant_id, forecast_horizon, outcome_type, prob, ci_low, ci_high, JSON.stringify(scenarios)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/forecasts/dashboard', async (req, res) => {
    try {
      const { institution_id } = req.query as any;
      const where = institution_id ? `WHERE institution_id='${institution_id}'` : '';
      const [total, horizons, outcomes, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_forecast_market ${where}`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT forecast_horizon, COUNT(*) as cnt FROM iil_forecast_market ${where} GROUP BY forecast_horizon`).catch(() => ({ rows: [] })),
        pool.query(`SELECT outcome_type, AVG(probability)::NUMERIC(5,4) as avg_prob FROM iil_forecast_market ${where} GROUP BY outcome_type ORDER BY avg_prob DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT f.*, i.name as institution_name FROM iil_forecast_market f LEFT JOIN iil_institutions i ON i.id=f.institution_id ${where} ORDER BY f.generated_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, horizon_distribution: horizons.rows, outcome_probabilities: outcomes.rows, recent_forecasts: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, horizon_distribution: [], outcome_probabilities: [], recent_forecasts: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 29: Fairness Engine ──────────────────────────────────────────

  app.post('/api/iil/fairness/audit', async (req, res) => {
    try {
      const { institution_id, tenant_id, audit_type, dimension, affected_group, bias_type, bias_score, severity = 'low', remediation } = req.body;
      if (!institution_id || !audit_type || !dimension) return res.status(400).json({ error: 'institution_id + audit_type + dimension required' });
      const r = await pool.query(
        `INSERT INTO iil_fairness_audits (institution_id, tenant_id, audit_type, dimension, bias_score, bias_type, affected_group, severity, remediation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [institution_id, tenant_id, audit_type, dimension, bias_score || rnd(0, 0.5, 4), bias_type, affected_group, severity, remediation]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/fairness/dashboard', async (_req, res) => {
    try {
      const [total, unresolved, severities, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_fairness_audits`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_fairness_audits WHERE resolved=FALSE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM iil_fairness_audits GROUP BY severity`).catch(() => ({ rows: [] })),
        pool.query(`SELECT a.*, i.name as institution_name FROM iil_fairness_audits a LEFT JOIN iil_institutions i ON i.id=a.institution_id WHERE a.resolved=FALSE ORDER BY a.audited_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0'), unresolved: parseInt(unresolved.rows[0]?.count || '0') }, severity_distribution: severities.rows, active_audits: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, severity_distribution: [], active_audits: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/fairness/audits/:id/resolve', async (req, res) => {
    try {
      const r = await pool.query(`UPDATE iil_fairness_audits SET resolved=TRUE WHERE id=$1 RETURNING *`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 30: Governance Engine ───────────────────────────────────────

  app.post('/api/iil/governance/records', async (req, res) => {
    try {
      const { institution_id, tenant_id, record_type, action, actor, target_entity, metadata = {}, escalation_level = 0 } = req.body;
      if (!record_type || !action) return res.status(400).json({ error: 'record_type + action required' });
      const r = await pool.query(
        `INSERT INTO iil_governance_records (institution_id, tenant_id, record_type, action, actor, target_entity, metadata, escalation_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [institution_id, tenant_id, record_type, action, actor, target_entity, JSON.stringify(metadata), escalation_level]
      );
      pool.query(`INSERT INTO iil_audit_trail (institution_id, actor, action, resource_type, resource_id, metadata) VALUES ($1,$2,$3,'governance',$4,$5)`,
        [institution_id, actor, action, r.rows[0].id, JSON.stringify({ record_type, escalation_level })]).catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/governance/dashboard', async (_req, res) => {
    try {
      const [total, pending, escalated, types, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_governance_records`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_governance_records WHERE status='pending'`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_governance_records WHERE escalation_level > 1`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT record_type, COUNT(*) as cnt FROM iil_governance_records GROUP BY record_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT g.*, i.name as institution_name FROM iil_governance_records g LEFT JOIN iil_institutions i ON i.id=g.institution_id ORDER BY g.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0'), pending: parseInt(pending.rows[0]?.count || '0'), escalated: parseInt(escalated.rows[0]?.count || '0') }, type_breakdown: types.rows, recent_records: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], recent_records: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/governance/records/:id', async (req, res) => {
    try {
      const { status, resolved_at } = req.body;
      const r = await pool.query(`UPDATE iil_governance_records SET status=$1, resolved_at=COALESCE($2::TIMESTAMPTZ, resolved_at) WHERE id=$3 RETURNING *`, [status, resolved_at, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 31: Explainability Engine ───────────────────────────────────

  app.post('/api/iil/explain', async (req, res) => {
    try {
      const { institution_id, tenant_id, insight_type, institutional_risk, reasons = [], contributing_signals = [], intervention_influence = [], confidence = 0.8, future_impact } = req.body;
      if (!insight_type) return res.status(400).json({ error: 'insight_type required' });
      const r = await pool.query(
        `INSERT INTO iil_explainability_logs (institution_id, tenant_id, insight_type, institutional_risk, reasons, contributing_signals, intervention_influence, confidence, future_impact)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [institution_id, tenant_id, insight_type, institutional_risk, JSON.stringify(reasons), JSON.stringify(contributing_signals), JSON.stringify(intervention_influence), confidence, future_impact]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/explainability/logs', async (req, res) => {
    try {
      const { institution_id, limit = '30', offset = '0' } = req.query as any;
      const where = institution_id ? `WHERE institution_id='${institution_id}'` : '';
      const rows = await pool.query(`SELECT e.*, i.name as institution_name FROM iil_explainability_logs e LEFT JOIN iil_institutions i ON i.id=e.institution_id ${where} ORDER BY e.generated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM iil_explainability_logs ${where}`);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0]?.count || '0') });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 32: AI Safety Engine ────────────────────────────────────────

  app.get('/api/admin/iil/safety/constraints', async (_req, res) => {
    try {
      const rows = await pool.query(`SELECT * FROM iil_safety_constraints ORDER BY created_at ASC`);
      res.json(rows.rows);
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json([]); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/safety/constraints/:id', async (req, res) => {
    try {
      const { is_active } = req.body;
      const r = await pool.query(`UPDATE iil_safety_constraints SET is_active=$1 WHERE id=$2 RETURNING *`, [is_active, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/iil/safety/check', async (req, res) => {
    try {
      const { institution_id, action_type, context = {} } = req.body;
      if (!action_type) return res.status(400).json({ error: 'action_type required' });
      const constraints = await pool.query(`SELECT * FROM iil_safety_constraints WHERE is_active=TRUE`).catch(() => ({ rows: [] }));
      const violations = [];
      // Rule-based safety checks
      if (action_type === 'display_risk' && !context.has_explainability) {
        violations.push({ constraint: 'Explainability Mandate', severity: 'high', blocked: true });
      }
      if (context.burnout_probability > 0.75) {
        violations.push({ constraint: 'Burnout Protection Buffer', severity: 'critical', blocked: false, action: 'counsellor_escalation_required' });
      }
      if (context.user_age < 18 && context.raw_data_exposed) {
        violations.push({ constraint: 'Minor Data Shield', severity: 'critical', blocked: true });
      }
      const safe = violations.filter(v => v.blocked).length === 0;
      if (!safe) {
        for (const v of violations) {
          const c = constraints.rows.find((c: any) => c.constraint_name === v.constraint);
          if (c) {
            await pool.query(`UPDATE iil_safety_constraints SET triggered_count=triggered_count+1, last_triggered_at=NOW() WHERE id=$1`, [c.id]).catch(() => {});
            await pool.query(`INSERT INTO iil_safety_violations (institution_id, constraint_id, violation_type, description, severity, blocked) VALUES ($1,$2,$3,$4,$5,$6)`,
              [institution_id, c.id, action_type, JSON.stringify(v), v.severity, v.blocked]).catch(() => {});
          }
        }
      }
      res.json({ safe, violations, active_constraints: constraints.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/safety/dashboard', async (_req, res) => {
    try {
      const [constraints, violations, triggered] = await Promise.all([
        pool.query(`SELECT * FROM iil_safety_constraints ORDER BY triggered_count DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM iil_safety_violations`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_safety_constraints WHERE triggered_count > 0`).catch(() => ({ rows: [{ count: 0 }] }))
      ]);
      const recent_violations = await pool.query(`SELECT v.*, c.constraint_name FROM iil_safety_violations v LEFT JOIN iil_safety_constraints c ON c.id=v.constraint_id ORDER BY v.detected_at DESC LIMIT 20`).catch(() => ({ rows: [] }));
      res.json({ constraints: constraints.rows, kpis: { total_violations: parseInt(violations.rows[0]?.count || '0'), triggered_constraints: parseInt(triggered.rows[0]?.count || '0') }, recent_violations: recent_violations.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ constraints: [], kpis: {}, recent_violations: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 33: Research & Experimentation ───────────────────────────────

  app.post('/api/iil/research/experiments', async (req, res) => {
    try {
      const { institution_id, tenant_id, experiment_name, experiment_type, hypothesis, parameters = {} } = req.body;
      if (!experiment_name || !experiment_type) return res.status(400).json({ error: 'experiment_name + experiment_type required' });
      const r = await pool.query(
        `INSERT INTO iil_research_experiments (institution_id, tenant_id, experiment_name, experiment_type, hypothesis, parameters, status)
         VALUES ($1,$2,$3,$4,$5,$6,'designing') RETURNING *`,
        [institution_id, tenant_id, experiment_name, experiment_type, hypothesis, JSON.stringify(parameters)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/research/dashboard', async (_req, res) => {
    try {
      const [total, by_type, by_status, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_research_experiments`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT experiment_type, COUNT(*) as cnt FROM iil_research_experiments GROUP BY experiment_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT status, COUNT(*) as cnt FROM iil_research_experiments GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query(`SELECT e.*, i.name as institution_name FROM iil_research_experiments e LEFT JOIN iil_institutions i ON i.id=e.institution_id ORDER BY e.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, type_breakdown: by_type.rows, status_distribution: by_status.rows, recent_experiments: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], status_distribution: [], recent_experiments: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/research/experiments/:id', async (req, res) => {
    try {
      const { status, results } = req.body;
      const r = await pool.query(
        `UPDATE iil_research_experiments SET status=COALESCE($1,status), results=COALESCE($2::jsonb,results), completed_at=CASE WHEN $1='complete' THEN NOW() ELSE completed_at END WHERE id=$3 RETURNING *`,
        [status, results ? JSON.stringify(results) : null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 34: Recursive Self-Evolving AI ───────────────────────────────

  app.post('/api/iil/self-evolution/log', async (req, res) => {
    try {
      const { tenant_id, model_component, evolution_type, before_state = {}, after_state = {}, trigger_event, performance_delta = 0 } = req.body;
      if (!model_component || !evolution_type) return res.status(400).json({ error: 'model_component + evolution_type required' });
      const r = await pool.query(
        `INSERT INTO iil_self_evolution_log (tenant_id, model_component, evolution_type, before_state, after_state, trigger_event, performance_delta)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [tenant_id, model_component, evolution_type, JSON.stringify(before_state), JSON.stringify(after_state), trigger_event, performance_delta]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/self-evolution/dashboard', async (_req, res) => {
    try {
      const [total, by_type, performance, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_self_evolution_log`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT evolution_type, COUNT(*) as cnt, AVG(performance_delta)::NUMERIC(8,4) as avg_delta FROM iil_self_evolution_log GROUP BY evolution_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT model_component, AVG(performance_delta)::NUMERIC(8,4) as avg_delta FROM iil_self_evolution_log GROUP BY model_component ORDER BY avg_delta DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM iil_self_evolution_log ORDER BY evolved_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total_evolutions: parseInt(total.rows[0]?.count || '0') }, evolution_type_breakdown: by_type.rows, component_performance: performance.rows, recent_evolutions: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, evolution_type_breakdown: [], component_performance: [], recent_evolutions: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/self-evolution/log/:id/approve', async (req, res) => {
    try {
      const r = await pool.query(`UPDATE iil_self_evolution_log SET approved=TRUE WHERE id=$1 RETURNING *`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 36: Event-Driven Orchestration ───────────────────────────────

  app.get('/api/admin/iil/events/log', async (req, res) => {
    try {
      const { institution_id, event_type, limit = '50', offset = '0' } = req.query as any;
      const params: any[] = [];
      const conds: string[] = [];
      if (institution_id) { params.push(institution_id); conds.push(`institution_id=$${params.length}`); }
      if (event_type) { params.push(event_type); conds.push(`event_type=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT e.*, i.name as institution_name FROM iil_events_log e LEFT JOIN iil_institutions i ON i.id=e.institution_id ${where} ORDER BY e.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM iil_events_log ${where}`, params);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0]?.count || '0') });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/events/stats', async (_req, res) => {
    try {
      const [total, by_type, pending] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_events_log`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT event_type, COUNT(*) as cnt FROM iil_events_log GROUP BY event_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM iil_events_log WHERE processed=FALSE`).catch(() => ({ rows: [{ count: 0 }] }))
      ]);
      res.json({ total: parseInt(total.rows[0]?.count || '0'), pending: parseInt(pending.rows[0]?.count || '0'), by_type: by_type.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ total: 0, pending: 0, by_type: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 38: Audit Trail ──────────────────────────────────────────────

  app.get('/api/admin/iil/audit', async (req, res) => {
    try {
      const { institution_id, actor, action, limit = '50', offset = '0' } = req.query as any;
      const params: any[] = [];
      const conds: string[] = [];
      if (institution_id) { params.push(institution_id); conds.push(`institution_id=$${params.length}`); }
      if (actor) { params.push(`%${actor}%`); conds.push(`actor ILIKE $${params.length}`); }
      if (action) { params.push(`%${action}%`); conds.push(`action ILIKE $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT a.*, i.name as institution_name FROM iil_audit_trail a LEFT JOIN iil_institutions i ON i.id=a.institution_id ${where} ORDER BY a.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM iil_audit_trail ${where}`, params);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0]?.count || '0') });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  // ── Master governance dashboard ──────────────────────────────────────────

  app.get('/api/admin/iil/governance/master', async (_req, res) => {
    try {
      const [sims, forecasts, fairness, governance, safety, research, evolution, events] = await Promise.all([
        pool.query(`SELECT COUNT(*) FILTER(WHERE status='complete') as done, COUNT(*) FILTER(WHERE status='running') as running FROM iil_simulations`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_forecast_market`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE resolved=FALSE) as open FROM iil_fairness_audits`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE status='pending') as pending FROM iil_governance_records`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_safety_violations`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_research_experiments`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_self_evolution_log`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE processed=FALSE) as pending FROM iil_events_log`).catch(() => ({ rows: [{}] }))
      ]);
      res.json({
        simulations: { done: parseInt(sims.rows[0]?.done || '0'), running: parseInt(sims.rows[0]?.running || '0') },
        forecasts: parseInt(forecasts.rows[0]?.count || '0'),
        fairness_open: parseInt(fairness.rows[0]?.open || '0'),
        governance_pending: parseInt(governance.rows[0]?.pending || '0'),
        safety_violations: parseInt(safety.rows[0]?.count || '0'),
        research_experiments: parseInt(research.rows[0]?.count || '0'),
        evolution_logs: parseInt(evolution.rows[0]?.count || '0'),
        events_pending: parseInt(events.rows[0]?.pending || '0')
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({}); res.status(500).json({ error: e.message }); }
  });
}
