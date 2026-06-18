// METRYXONE BIOS — IIL Intelligence Routes
// Sections 20-26: Economic Intelligence, Reputation, Lifecycle, Knowledge Graph,
// Causal Reasoning, Federated Intelligence, Digital Twin

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

export function registerIILIntelligenceRoutes(app: Express, pool: Pool) {

  // ── Section 20: Economic Intelligence Engine ─────────────────────────────

  app.post('/api/iil/economic/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const sustainability = input.sustainability_score ?? rnd(35, 85);
      const intervention_roi = input.intervention_roi ?? rnd(0.8, 3.5, 4);
      const workforce_roi = input.workforce_roi ?? rnd(0.8, 3.0, 4);
      const learning_eff = input.learning_investment_efficiency ?? rnd(35, 85);
      const eco_eff = input.ecosystem_efficiency ?? rnd(35, 85);
      const economic_instability = parseFloat(Math.max(0, (100 - sustainability) / 100 * 0.6 - 0.2).toFixed(4));
      const intervention_ineff = parseFloat(Math.max(0, (2.0 - intervention_roi) / 2.0 * 0.5).toFixed(4));
      const resource_wastage = parseFloat(Math.max(0, (100 - eco_eff) / 100 * 0.4).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_economic_intelligence (institution_id, tenant_id, period_date, sustainability_score, intervention_roi, workforce_roi, learning_investment_efficiency, ecosystem_efficiency, economic_instability, intervention_inefficiency, resource_wastage)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           sustainability_score=EXCLUDED.sustainability_score, intervention_roi=EXCLUDED.intervention_roi, workforce_roi=EXCLUDED.workforce_roi,
           learning_investment_efficiency=EXCLUDED.learning_investment_efficiency, ecosystem_efficiency=EXCLUDED.ecosystem_efficiency,
           economic_instability=EXCLUDED.economic_instability, intervention_inefficiency=EXCLUDED.intervention_inefficiency,
           resource_wastage=EXCLUDED.resource_wastage RETURNING *`,
        [institution_id, tenant_id, today, sustainability, intervention_roi, workforce_roi, learning_eff, eco_eff, economic_instability, intervention_ineff, resource_wastage]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/economic/dashboard', async (_req, res) => {
    try {
      const [avgs, unstable, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(sustainability_score)::NUMERIC(5,2) as avg_sust, AVG(intervention_roi)::NUMERIC(8,4) as avg_iroi, AVG(workforce_roi)::NUMERIC(8,4) as avg_wroi, AVG(resource_wastage)::NUMERIC(5,4) as avg_waste, COUNT(*) as total FROM iil_economic_intelligence WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_economic_intelligence WHERE economic_instability > 0.3 AND period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT e.*, i.name as institution_name FROM iil_economic_intelligence e LEFT JOIN iil_institutions i ON i.id=e.institution_id WHERE period_date=CURRENT_DATE ORDER BY e.sustainability_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { avg_sustainability: avgs.rows[0]?.avg_sust || '0', avg_intervention_roi: avgs.rows[0]?.avg_iroi || '0', avg_workforce_roi: avgs.rows[0]?.avg_wroi || '0', avg_resource_wastage: avgs.rows[0]?.avg_waste || '0', economic_instability_alerts: parseInt(unstable.rows[0]?.count || '0') },
        snapshots
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 21: Reputation Engine ───────────────────────────────────────

  app.post('/api/iil/reputation/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const trust_perc = input.trust_perception ?? rnd(40, 90);
      const employer_perc = input.employer_perception ?? rnd(35, 85);
      const eco_rep = input.ecosystem_reputation ?? rnd(40, 90);
      const res_rep = input.resilience_reputation ?? rnd(35, 85);
      const inn_rep = input.innovation_reputation ?? rnd(30, 85);
      const composite = parseFloat(((trust_perc + employer_perc + eco_rep + res_rep + inn_rep) / 5).toFixed(2));
      const degradation_risk = parseFloat(Math.max(0, (100 - composite) / 100 * 0.7 - 0.2).toFixed(4));
      const trust_instability = parseFloat(Math.abs(trust_perc - eco_rep) / 100 * 0.5).toFixed(4);
      const employer_confidence = parseFloat((employer_perc / 100 * 0.6 - 0.1).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_reputation_index (institution_id, tenant_id, period_date, trust_perception, employer_perception, ecosystem_reputation, resilience_reputation, innovation_reputation, composite_reputation, degradation_risk, trust_instability, employer_confidence_trend)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET trust_perception=EXCLUDED.trust_perception, employer_perception=EXCLUDED.employer_perception, ecosystem_reputation=EXCLUDED.ecosystem_reputation, resilience_reputation=EXCLUDED.resilience_reputation, innovation_reputation=EXCLUDED.innovation_reputation, composite_reputation=EXCLUDED.composite_reputation, degradation_risk=EXCLUDED.degradation_risk, trust_instability=EXCLUDED.trust_instability, employer_confidence_trend=EXCLUDED.employer_confidence_trend RETURNING *`,
        [institution_id, tenant_id, today, trust_perc, employer_perc, eco_rep, res_rep, inn_rep, composite, degradation_risk, trust_instability, employer_confidence]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/reputation/dashboard', async (_req, res) => {
    try {
      const [avgs, degrading, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(composite_reputation)::NUMERIC(5,2) as avg_rep, AVG(employer_perception)::NUMERIC(5,2) as avg_employer, AVG(degradation_risk)::NUMERIC(5,4) as avg_deg, COUNT(*) as total FROM iil_reputation_index WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_reputation_index WHERE degradation_risk > 0.4 AND period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT r.*, i.name as institution_name FROM iil_reputation_index r LEFT JOIN iil_institutions i ON i.id=r.institution_id WHERE period_date=CURRENT_DATE ORDER BY composite_reputation DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_composite: avgs.rows[0]?.avg_rep || '0', avg_employer: avgs.rows[0]?.avg_employer || '0', avg_degradation: avgs.rows[0]?.avg_deg || '0', degrading_count: parseInt(degrading.rows[0]?.count || '0') }, snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 22: Lifecycle Engine ─────────────────────────────────────────

  app.post('/api/iil/lifecycle/transition', async (req, res) => {
    try {
      const { institution_id, tenant_id, lifecycle_stage, transition_trigger, stage_score, notes } = req.body;
      if (!institution_id || !lifecycle_stage) return res.status(400).json({ error: 'institution_id + lifecycle_stage required' });
      // Close previous stage
      await pool.query(`UPDATE iil_lifecycle_states SET exited_at=NOW(), duration_days=EXTRACT(DAY FROM NOW()-entered_at)::INTEGER WHERE institution_id=$1 AND exited_at IS NULL`, [institution_id]);
      const r = await pool.query(
        `INSERT INTO iil_lifecycle_states (institution_id, tenant_id, lifecycle_stage, transition_trigger, stage_score, notes, stagnation_detected, rebirth_initiated)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [institution_id, tenant_id, lifecycle_stage, transition_trigger, stage_score || rnd(40, 80), notes, lifecycle_stage === 'decline', lifecycle_stage === 'recovery']
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/lifecycle/dashboard', async (_req, res) => {
    try {
      const [stages, transitions, rebirths, current] = await Promise.all([
        pool.query(`SELECT lifecycle_stage, COUNT(*) as cnt FROM iil_lifecycle_states WHERE exited_at IS NULL GROUP BY lifecycle_stage`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM iil_lifecycle_states`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_lifecycle_states WHERE rebirth_initiated=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT l.*, i.name as institution_name FROM iil_lifecycle_states l LEFT JOIN iil_institutions i ON i.id=l.institution_id WHERE l.exited_at IS NULL ORDER BY l.entered_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total_transitions: parseInt(transitions.rows[0]?.count || '0'), rebirths: parseInt(rebirths.rows[0]?.count || '0') }, stage_distribution: stages.rows, current_states: current.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, stage_distribution: [], current_states: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 23: Knowledge Graph Engine ──────────────────────────────────

  app.post('/api/iil/knowledge-graph/nodes', async (req, res) => {
    try {
      const { institution_id, tenant_id, node_type, node_key, node_label, properties = {} } = req.body;
      if (!node_type || !node_key) return res.status(400).json({ error: 'node_type + node_key required' });
      const embedding = Array.from({ length: 16 }, () => parseFloat((Math.random() * 2 - 1).toFixed(4)));
      const r = await pool.query(
        `INSERT INTO iil_knowledge_graph (institution_id, tenant_id, node_type, node_key, node_label, properties, embedding_vector)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING RETURNING *`,
        [institution_id, tenant_id, node_type, node_key, node_label, JSON.stringify(properties), JSON.stringify(embedding)]
      );
      if (!r.rows.length) {
        const existing = await pool.query(`SELECT * FROM iil_knowledge_graph WHERE node_key=$1`, [node_key]);
        return res.json(existing.rows[0]);
      }
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/iil/knowledge-graph/edges', async (req, res) => {
    try {
      const { institution_id, tenant_id, from_node_id, to_node_id, edge_type, weight = 1.0, metadata = {} } = req.body;
      if (!from_node_id || !to_node_id || !edge_type) return res.status(400).json({ error: 'from_node_id + to_node_id + edge_type required' });
      const r = await pool.query(
        `INSERT INTO iil_graph_edges (institution_id, tenant_id, from_node_id, to_node_id, edge_type, weight, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [institution_id, tenant_id, from_node_id, to_node_id, edge_type, weight, JSON.stringify(metadata)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/knowledge-graph/dashboard', async (req, res) => {
    try {
      const { institution_id } = req.query as any;
      const where = institution_id ? `WHERE institution_id='${institution_id}'` : '';
      const [nodes, edges, types] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_knowledge_graph ${where}`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_graph_edges ${where}`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT node_type, COUNT(*) as cnt FROM iil_knowledge_graph ${where} GROUP BY node_type ORDER BY cnt DESC`).catch(() => ({ rows: [] }))
      ]);
      const recent_nodes = await pool.query(`SELECT n.*, i.name as institution_name FROM iil_knowledge_graph n LEFT JOIN iil_institutions i ON i.id=n.institution_id ${where} ORDER BY n.created_at DESC LIMIT 30`).catch(() => ({ rows: [] }));
      res.json({
        kpis: { total_nodes: parseInt(nodes.rows[0]?.count || '0'), total_edges: parseInt(edges.rows[0]?.count || '0') },
        node_type_distribution: types.rows,
        recent_nodes: recent_nodes.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: { total_nodes: 0, total_edges: 0 }, node_type_distribution: [], recent_nodes: [] }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/iil/knowledge-graph/traverse/:node_key', async (req, res) => {
    try {
      const node = await pool.query(`SELECT * FROM iil_knowledge_graph WHERE node_key=$1`, [req.params.node_key]);
      if (!node.rows.length) return res.status(404).json({ error: 'Node not found' });
      const edges = await pool.query(
        `SELECT e.*, n.node_key as target_key, n.node_label as target_label, n.node_type as target_type
         FROM iil_graph_edges e LEFT JOIN iil_knowledge_graph n ON n.id=e.to_node_id WHERE e.from_node_id=$1
         UNION ALL
         SELECT e.*, n.node_key as target_key, n.node_label as target_label, n.node_type as target_type
         FROM iil_graph_edges e LEFT JOIN iil_knowledge_graph n ON n.id=e.from_node_id WHERE e.to_node_id=$1`,
        [node.rows[0].id]
      ).catch(() => ({ rows: [] }));
      res.json({ node: node.rows[0], connected_edges: edges.rows, connection_count: edges.rows.length });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.status(404).json({ error: 'Not found' }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 24: Causal Reasoning Engine ─────────────────────────────────

  app.post('/api/iil/causal/chains', async (req, res) => {
    try {
      const { institution_id, tenant_id, chain_name, chain_steps = [], root_cause, terminal_outcome, probability } = req.body;
      if (!chain_name || !root_cause) return res.status(400).json({ error: 'chain_name + root_cause required' });
      const r = await pool.query(
        `INSERT INTO iil_causal_chains (institution_id, tenant_id, chain_name, chain_steps, root_cause, terminal_outcome, probability)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [institution_id, tenant_id, chain_name, JSON.stringify(chain_steps), root_cause, terminal_outcome, probability || rnd(0.3, 0.9, 4)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/causal/dashboard', async (req, res) => {
    try {
      const { institution_id } = req.query as any;
      const where = institution_id ? `WHERE institution_id='${institution_id}'` : '';
      const [total, validated, chains] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_causal_chains ${where}`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_causal_chains ${where ? where+' AND' : 'WHERE'} validated=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT c.*, i.name as institution_name FROM iil_causal_chains c LEFT JOIN iil_institutions i ON i.id=c.institution_id ${where} ORDER BY c.probability DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total_chains: parseInt(total.rows[0]?.count || '0'), validated: parseInt(validated.rows[0]?.count || '0') }, causal_chains: chains.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, causal_chains: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/causal/chains/:id/validate', async (req, res) => {
    try {
      const r = await pool.query(`UPDATE iil_causal_chains SET validated=TRUE WHERE id=$1 RETURNING *`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 25: Federated Intelligence Engine ────────────────────────────

  app.post('/api/iil/federated/share', async (req, res) => {
    try {
      const { tenant_id, source_institution_id, data_type, anonymized_payload = {}, privacy_level = 'aggregated', region } = req.body;
      if (!data_type) return res.status(400).json({ error: 'data_type required' });
      const r = await pool.query(
        `INSERT INTO iil_federated_data (tenant_id, source_institution_id, data_type, anonymized_payload, privacy_level, region)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [tenant_id, source_institution_id, data_type, JSON.stringify(anonymized_payload), privacy_level, region]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/federated/dashboard', async (_req, res) => {
    try {
      const [total, types, regions, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_federated_data`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT data_type, COUNT(*) as cnt FROM iil_federated_data GROUP BY data_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT region, COUNT(*) as cnt FROM iil_federated_data WHERE region IS NOT NULL GROUP BY region ORDER BY cnt DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM iil_federated_data ORDER BY shared_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total_shared: parseInt(total.rows[0]?.count || '0') }, type_breakdown: types.rows, region_breakdown: regions.rows, recent: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], region_breakdown: [], recent: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 26: Digital Twin Engine ─────────────────────────────────────

  app.post('/api/iil/digital-twin/sync', async (req, res) => {
    try {
      const { institution_id, tenant_id, twin_state = {}, policy_experiments = [], stress_test_results = [], forecast_states = [] } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const r = await pool.query(
        `INSERT INTO iil_digital_twins (institution_id, tenant_id, twin_state, policy_experiments, stress_test_results, forecast_states, simulation_ready, twin_version)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,1)
         ON CONFLICT (institution_id) DO UPDATE SET
           twin_state=EXCLUDED.twin_state, policy_experiments=EXCLUDED.policy_experiments,
           stress_test_results=EXCLUDED.stress_test_results, forecast_states=EXCLUDED.forecast_states,
           simulation_ready=TRUE, twin_version=iil_digital_twins.twin_version+1, last_sync_at=NOW(), updated_at=NOW() RETURNING *`,
        [institution_id, tenant_id, JSON.stringify(twin_state), JSON.stringify(policy_experiments), JSON.stringify(stress_test_results), JSON.stringify(forecast_states)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/iil/digital-twin/:institution_id/experiment', async (req, res) => {
    try {
      const { policy_name, parameters = {}, simulate_steps = 30 } = req.body;
      // Simulate policy outcomes
      const outcomes = Array.from({ length: simulate_steps }, (_, i) => ({
        step: i + 1,
        health_delta: rnd(-5, 15, 4),
        resilience_delta: rnd(-3, 12, 4),
        trust_delta: rnd(-4, 10, 4)
      }));
      const projected_health_gain = outcomes.reduce((sum, o) => sum + o.health_delta, 0) / simulate_steps;
      const r = await pool.query(
        `UPDATE iil_digital_twins SET policy_experiments = policy_experiments || $1::jsonb, updated_at=NOW() WHERE institution_id=$2 RETURNING *`,
        [JSON.stringify([{ policy_name, parameters, outcomes, projected_health_gain, simulated_at: new Date().toISOString() }]), req.params.institution_id]
      );
      res.json({ policy_name, simulate_steps, projected_health_gain: projected_health_gain.toFixed(4), outcomes, twin: r.rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/digital-twins/dashboard', async (_req, res) => {
    try {
      const [total, ready, twins] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_digital_twins`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_digital_twins WHERE simulation_ready=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT t.*, i.name as institution_name FROM iil_digital_twins t LEFT JOIN iil_institutions i ON i.id=t.institution_id ORDER BY t.twin_version DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total_twins: parseInt(total.rows[0]?.count || '0'), simulation_ready: parseInt(ready.rows[0]?.count || '0') }, twins: twins.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, twins: [] }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/intelligence/master', async (_req, res) => {
    try {
      const [economic, reputation, lifecycle, graph, causal, twins] = await Promise.all([
        pool.query(`SELECT AVG(sustainability_score)::NUMERIC(5,2) as avg_sust FROM iil_economic_intelligence WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT AVG(composite_reputation)::NUMERIC(5,2) as avg_rep FROM iil_reputation_index WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT lifecycle_stage, COUNT(*) as cnt FROM iil_lifecycle_states WHERE exited_at IS NULL GROUP BY lifecycle_stage LIMIT 3`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) as nodes FROM iil_knowledge_graph`).catch(() => ({ rows: [{ nodes: 0 }] })),
        pool.query(`SELECT COUNT(*) as chains FROM iil_causal_chains`).catch(() => ({ rows: [{ chains: 0 }] })),
        pool.query(`SELECT COUNT(*) as twins FROM iil_digital_twins WHERE simulation_ready=TRUE`).catch(() => ({ rows: [{ twins: 0 }] }))
      ]);
      res.json({
        avg_sustainability: economic.rows[0]?.avg_sust || '0',
        avg_reputation: reputation.rows[0]?.avg_rep || '0',
        top_lifecycle_stages: lifecycle.rows,
        knowledge_graph_nodes: parseInt(graph.rows[0]?.nodes || '0'),
        causal_chains: parseInt(causal.rows[0]?.chains || '0'),
        active_digital_twins: parseInt(twins.rows[0]?.twins || '0')
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({}); res.status(500).json({ error: e.message }); }
  });
}
