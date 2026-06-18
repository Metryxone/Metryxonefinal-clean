// METRYXONE BIOS — NHDA Intelligence Routes
// Sections 13-20: Drift/Entropy, Contagion, Knowledge Graph, Causal Reasoning,
// Digital Twin, Civilization Intelligence, Simulation, Forecast Market

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

export function registerNHDAIntelligenceRoutes(app: Express, pool: Pool) {

  // ── Section 13: National Drift & Entropy Engine ──────────────────────────

  app.post('/api/nhda/drift/record', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const wf_drift = input.workforce_drift ?? rnd(0, 0.4, 4);
      const edu_drift = input.educational_drift ?? rnd(0, 0.4, 4);
      const behav_drift = input.behavioural_drift ?? rnd(0, 0.4, 4);
      const emo_drift = input.emotional_drift ?? rnd(0, 0.4, 4);
      const soc_frag = input.societal_fragmentation ?? rnd(0, 0.45, 4);
      const instability = rnd(5, 60);
      const fragmentation = rnd(5, 55);
      const unpredictability = rnd(5, 55);
      const entropy = parseFloat(((instability + fragmentation + unpredictability) / 3).toFixed(2));
      const alert_level = entropy > 70 ? 'critical' : entropy > 50 ? 'warning' : entropy > 30 ? 'elevated' : 'normal';
      const r = await pool.query(
        `INSERT INTO nhda_drift_entropy (region_id, tenant_id, period_date, workforce_drift, educational_drift, behavioural_drift, emotional_drift, societal_fragmentation, entropy_score, instability, fragmentation, unpredictability, alert_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (region_id, period_date) DO UPDATE SET workforce_drift=EXCLUDED.workforce_drift, educational_drift=EXCLUDED.educational_drift, behavioural_drift=EXCLUDED.behavioural_drift, emotional_drift=EXCLUDED.emotional_drift, societal_fragmentation=EXCLUDED.societal_fragmentation, entropy_score=EXCLUDED.entropy_score, instability=EXCLUDED.instability, fragmentation=EXCLUDED.fragmentation, unpredictability=EXCLUDED.unpredictability, alert_level=EXCLUDED.alert_level RETURNING *`,
        [region_id, tenant_id, today, wf_drift, edu_drift, behav_drift, emo_drift, soc_frag, entropy, instability, fragmentation, unpredictability, alert_level]
      );
      if (alert_level !== 'normal') {
        pool.query(`INSERT INTO nhda_events_log (region_id, event_type, payload) VALUES ($1,'DRIFT_DETECTED',$2)`,
          [region_id, JSON.stringify({ entropy, alert_level })]).catch(() => {});
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/drift/dashboard', async (_req, res) => {
    try {
      const [avgs, alerts, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(entropy_score)::NUMERIC(5,2) as avg_entropy, AVG(workforce_drift)::NUMERIC(5,4) as avg_wf_drift, AVG(societal_fragmentation)::NUMERIC(5,4) as avg_frag, COUNT(*) as total FROM nhda_drift_entropy WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT alert_level, COUNT(*) as cnt FROM nhda_drift_entropy WHERE period_date>=CURRENT_DATE-7 GROUP BY alert_level`).catch(() => ({ rows: [] })),
        pool.query(`SELECT period_date, AVG(entropy_score)::NUMERIC(5,2) as avg_entropy FROM nhda_drift_entropy WHERE period_date>=CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT d.*, r.region_name FROM nhda_drift_entropy d LEFT JOIN nhda_regions r ON r.id=d.region_id WHERE d.period_date=CURRENT_DATE ORDER BY d.entropy_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_entropy: avgs.rows[0]?.avg_entropy || '0', avg_workforce_drift: avgs.rows[0]?.avg_wf_drift || '0', avg_fragmentation: avgs.rows[0]?.avg_frag || '0' }, alert_distribution: alerts.rows, entropy_trend_30d: trend.rows, region_snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, alert_distribution: [], entropy_trend_30d: [], region_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 14: Population Behavioural Contagion Engine ─────────────────

  app.post('/api/nhda/contagion/detect', async (req, res) => {
    try {
      const { region_id, tenant_id, contagion_type, population_segment, spread_velocity = 1, affected_population = 0, affected_ratio = 0, severity = 'low' } = req.body;
      if (!region_id || !contagion_type) return res.status(400).json({ error: 'region_id + contagion_type required' });
      const r = await pool.query(
        `INSERT INTO nhda_contagion_events (region_id, tenant_id, contagion_type, population_segment, spread_velocity, affected_population, affected_ratio, severity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [region_id, tenant_id, contagion_type, population_segment, spread_velocity, affected_population, affected_ratio, severity]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/contagion/dashboard', async (_req, res) => {
    try {
      const [types, severities, spreading, recent] = await Promise.all([
        pool.query(`SELECT contagion_type, COUNT(*) as cnt, AVG(spread_velocity)::NUMERIC(8,4) as avg_vel FROM nhda_contagion_events GROUP BY contagion_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM nhda_contagion_events GROUP BY severity`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM nhda_contagion_events WHERE containment_status='spreading'`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT c.*, r.region_name FROM nhda_contagion_events c LEFT JOIN nhda_regions r ON r.id=c.region_id ORDER BY c.detected_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { spreading: parseInt(spreading.rows[0]?.count || '0') }, type_breakdown: types.rows, severity_distribution: severities.rows, recent_events: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], severity_distribution: [], recent_events: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/nhda/contagion/:id', async (req, res) => {
    try {
      const { containment_status, policy_response } = req.body;
      const r = await pool.query(`UPDATE nhda_contagion_events SET containment_status=COALESCE($1,containment_status), policy_response=COALESCE($2,policy_response) WHERE id=$3 RETURNING *`, [containment_status, policy_response, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 15: National Knowledge & Memory Graph Engine ────────────────

  app.post('/api/nhda/knowledge-graph/nodes', async (req, res) => {
    try {
      const { region_id, tenant_id, node_type, node_key, node_label, properties = {} } = req.body;
      if (!node_type || !node_key) return res.status(400).json({ error: 'node_type + node_key required' });
      const embedding = Array.from({ length: 16 }, () => parseFloat((Math.random() * 2 - 1).toFixed(4)));
      const r = await pool.query(
        `INSERT INTO nhda_knowledge_graph (region_id, tenant_id, node_type, node_key, node_label, properties, embedding_vector) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (node_key) DO UPDATE SET node_label=EXCLUDED.node_label, properties=EXCLUDED.properties RETURNING *`,
        [region_id, tenant_id, node_type, node_key, node_label, JSON.stringify(properties), JSON.stringify(embedding)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/nhda/knowledge-graph/edges', async (req, res) => {
    try {
      const { tenant_id, from_node_id, to_node_id, edge_type, weight = 1.0, metadata = {} } = req.body;
      if (!from_node_id || !to_node_id || !edge_type) return res.status(400).json({ error: 'from_node_id + to_node_id + edge_type required' });
      const r = await pool.query(
        `INSERT INTO nhda_graph_edges (tenant_id, from_node_id, to_node_id, edge_type, weight, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [tenant_id, from_node_id, to_node_id, edge_type, weight, JSON.stringify(metadata)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/knowledge-graph/dashboard', async (_req, res) => {
    try {
      const [nodes, edges, types, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_knowledge_graph`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_graph_edges`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT node_type, COUNT(*) as cnt FROM nhda_knowledge_graph GROUP BY node_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT n.*, r.region_name FROM nhda_knowledge_graph n LEFT JOIN nhda_regions r ON r.id=n.region_id ORDER BY n.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { nodes: parseInt(nodes.rows[0]?.count || '0'), edges: parseInt(edges.rows[0]?.count || '0') }, node_types: types.rows, recent_nodes: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: { nodes: 0, edges: 0 }, node_types: [], recent_nodes: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 17: National Digital Twin Engine ─────────────────────────────

  app.post('/api/nhda/digital-twin/sync', async (req, res) => {
    try {
      const { region_id, tenant_id, twin_type = 'population', twin_state = {}, experiments = [] } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const r = await pool.query(
        `INSERT INTO nhda_digital_twins (region_id, tenant_id, twin_type, twin_state, experiments, simulation_ready, twin_version)
         VALUES ($1,$2,$3,$4,$5,TRUE,1)
         ON CONFLICT (region_id) DO UPDATE SET twin_state=EXCLUDED.twin_state, experiments=EXCLUDED.experiments, simulation_ready=TRUE, twin_version=nhda_digital_twins.twin_version+1, last_sync_at=NOW(), updated_at=NOW() RETURNING *`,
        [region_id, tenant_id, twin_type, JSON.stringify(twin_state), JSON.stringify(experiments)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/nhda/digital-twin/:region_id/experiment', async (req, res) => {
    try {
      const { policy_name, parameters = {}, simulate_steps = 30 } = req.body;
      const outcomes = Array.from({ length: simulate_steps }, (_, i) => ({
        step: i + 1,
        nhdi_delta: rnd(-3, 12, 4),
        resilience_delta: rnd(-2, 10, 4),
        employability_delta: rnd(-2, 8, 4)
      }));
      const projected_nhdi_gain = outcomes.reduce((sum, o) => sum + o.nhdi_delta, 0) / simulate_steps;
      const r = await pool.query(
        `UPDATE nhda_digital_twins SET experiments=experiments||$1::jsonb, updated_at=NOW() WHERE region_id=$2 RETURNING *`,
        [JSON.stringify([{ policy_name, parameters, outcomes, projected_nhdi_gain, simulated_at: new Date().toISOString() }]), req.params.region_id]
      );
      res.json({ policy_name, projected_nhdi_gain: projected_nhdi_gain.toFixed(4), outcomes, twin: r.rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/digital-twins/dashboard', async (_req, res) => {
    try {
      const [total, ready, twins] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_digital_twins`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_digital_twins WHERE simulation_ready=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT t.*, r.region_name FROM nhda_digital_twins t LEFT JOIN nhda_regions r ON r.id=t.region_id ORDER BY t.twin_version DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0'), simulation_ready: parseInt(ready.rows[0]?.count || '0') }, twins: twins.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, twins: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 18: Civilization Intelligence Engine ─────────────────────────

  app.post('/api/nhda/civilization/calculate', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const resilience = input.long_term_resilience ?? rnd(35, 80);
      const innovation_sust = input.innovation_sustainability ?? rnd(30, 80);
      const collective_intel = input.collective_intelligence ?? rnd(35, 80);
      const adaptability = input.national_adaptability ?? rnd(35, 80);
      const evolution_score = parseFloat(((resilience + innovation_sust + collective_intel + adaptability) / 4).toFixed(2));
      const stagnation = evolution_score < 40;
      const decline_risk = parseFloat(Math.max(0, (100 - evolution_score) / 100 * 0.7 - 0.2).toFixed(4));
      const projection_50yr = {
        optimistic: parseFloat(Math.min(100, evolution_score * 1.4).toFixed(2)),
        base_case: parseFloat(Math.min(100, evolution_score * 1.1).toFixed(2)),
        pessimistic: parseFloat(Math.max(10, evolution_score * 0.7).toFixed(2))
      };
      const r = await pool.query(
        `INSERT INTO nhda_civilization_intelligence (region_id, tenant_id, period_date, long_term_resilience, innovation_sustainability, collective_intelligence, national_adaptability, societal_evolution_score, civilization_stagnation, capability_decline_risk, resilience_sustainability, projection_50yr)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (region_id, period_date) DO UPDATE SET long_term_resilience=EXCLUDED.long_term_resilience, innovation_sustainability=EXCLUDED.innovation_sustainability, collective_intelligence=EXCLUDED.collective_intelligence, national_adaptability=EXCLUDED.national_adaptability, societal_evolution_score=EXCLUDED.societal_evolution_score, civilization_stagnation=EXCLUDED.civilization_stagnation, capability_decline_risk=EXCLUDED.capability_decline_risk, resilience_sustainability=EXCLUDED.resilience_sustainability, projection_50yr=EXCLUDED.projection_50yr, calculated_at=NOW() RETURNING *`,
        [region_id, tenant_id, today, resilience, innovation_sust, collective_intel, adaptability, evolution_score, stagnation, decline_risk, rnd(0.3, 0.8, 4), JSON.stringify(projection_50yr)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/civilization/dashboard', async (_req, res) => {
    try {
      const [avgs, stagnating, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(societal_evolution_score)::NUMERIC(5,2) as avg_evolution, AVG(long_term_resilience)::NUMERIC(5,2) as avg_resilience, AVG(innovation_sustainability)::NUMERIC(5,2) as avg_innovation, COUNT(*) FILTER(WHERE civilization_stagnation) as stagnating FROM nhda_civilization_intelligence WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM nhda_civilization_intelligence WHERE civilization_stagnation=TRUE AND period_date=CURRENT_DATE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT period_date, AVG(societal_evolution_score)::NUMERIC(5,2) as avg_evolution FROM nhda_civilization_intelligence WHERE period_date>=CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT c.*, r.region_name FROM nhda_civilization_intelligence c LEFT JOIN nhda_regions r ON r.id=c.region_id WHERE period_date=CURRENT_DATE ORDER BY societal_evolution_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_evolution: avgs.rows[0]?.avg_evolution || '0', avg_resilience: avgs.rows[0]?.avg_resilience || '0', avg_innovation: avgs.rows[0]?.avg_innovation || '0', stagnating_regions: parseInt(stagnating.rows[0]?.count || '0') }, trend_30d: trend.rows, region_snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, trend_30d: [], region_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 19: Synthetic National Simulation Engine ────────────────────

  app.post('/api/nhda/simulations/run', async (req, res) => {
    try {
      const { region_id, tenant_id, simulation_type, parameters = {}, iterations = 100 } = req.body;
      if (!region_id || !simulation_type) return res.status(400).json({ error: 'region_id + simulation_type required' });
      const VALID = ['workforce_evolution','resilience_recovery','innovation_acceleration','educational_reform_impact','societal_collapse_prevention','policy_optimization'];
      if (!VALID.includes(simulation_type)) return res.status(400).json({ error: `Valid types: ${VALID.join(', ')}` });
      const r = await pool.query(
        `INSERT INTO nhda_simulations (region_id, tenant_id, simulation_type, parameters, iterations, status) VALUES ($1,$2,$3,$4,$5,'running') RETURNING *`,
        [region_id, tenant_id, simulation_type, JSON.stringify(parameters), Math.min(1000, iterations)]
      );
      const simId = r.rows[0].id;
      setTimeout(async () => {
        try {
          const n = Math.min(1000, iterations);
          const outcomes = Array.from({ length: n }, () => rnd(20, 90, 2));
          const mean = outcomes.reduce((a, b) => a + b, 0) / n;
          const sorted = [...outcomes].sort((a, b) => a - b);
          const results = { simulation_type, iterations: n, nhdi_outcome_mean: mean.toFixed(2), p10: sorted[Math.floor(n * 0.1)], p50: sorted[Math.floor(n * 0.5)], p90: sorted[Math.floor(n * 0.9)], success_rate: Math.round(outcomes.filter(v => v > 65).length / n * 100), parameters };
          await pool.query(`UPDATE nhda_simulations SET status='complete', results=$1, confidence=$2, completed_at=NOW() WHERE id=$3`,
            [JSON.stringify(results), rnd(0.7, 0.95, 4), simId]);
        } catch { await pool.query(`UPDATE nhda_simulations SET status='failed' WHERE id=$1`, [simId]); }
      }, 500);
      res.status(202).json({ ...r.rows[0], message: `Simulation queued. Poll /api/nhda/simulations/${simId} for results.` });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/nhda/simulations/:id', async (req, res) => {
    try {
      const r = await pool.query(`SELECT s.*, r.region_name FROM nhda_simulations s LEFT JOIN nhda_regions r ON r.id=s.region_id WHERE s.id=$1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Simulation not found' });
      res.json(r.rows[0]);
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.status(404).json({ error: 'Not found' }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/simulations/dashboard', async (_req, res) => {
    try {
      const [total, types, statuses, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_simulations`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT simulation_type, COUNT(*) as cnt FROM nhda_simulations GROUP BY simulation_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT status, COUNT(*) as cnt FROM nhda_simulations GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query(`SELECT s.*, r.region_name FROM nhda_simulations s LEFT JOIN nhda_regions r ON r.id=s.region_id ORDER BY s.created_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, type_breakdown: types.rows, status_distribution: statuses.rows, recent_simulations: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], status_distribution: [], recent_simulations: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 20: National Forecast Market Engine ──────────────────────────

  app.post('/api/nhda/forecasts/generate', async (req, res) => {
    try {
      const { region_id, tenant_id, outcome_type, forecast_horizon = '1y' } = req.body;
      if (!region_id || !outcome_type) return res.status(400).json({ error: 'region_id + outcome_type required' });
      const prob = rnd(0.25, 0.85, 4);
      const ci_low = Math.max(0, prob - rnd(0.05, 0.15, 4));
      const ci_high = Math.min(1, prob + rnd(0.05, 0.15, 4));
      const scenarios = [
        { label: 'Optimistic', probability: ci_high, drivers: ['Strong policy intervention', 'Institutional reform'] },
        { label: 'Base Case', probability: prob, drivers: ['Current trajectory continues'] },
        { label: 'Pessimistic', probability: ci_low, drivers: ['Resource constraints', 'Population pressures'] }
      ];
      const policy_levers = ['Education investment', 'Workforce upskilling', 'Emotional wellbeing programs', 'Innovation incentives'];
      const r = await pool.query(
        `INSERT INTO nhda_forecast_market (region_id, tenant_id, forecast_horizon, outcome_type, probability, confidence_interval_low, confidence_interval_high, scenarios, policy_levers) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [region_id, tenant_id, forecast_horizon, outcome_type, prob, ci_low, ci_high, JSON.stringify(scenarios), JSON.stringify(policy_levers)]
      );
      pool.query(`INSERT INTO nhda_events_log (region_id, event_type, payload) VALUES ($1,'POLICY_IMPACT_FORECASTED',$2)`,
        [region_id, JSON.stringify({ outcome_type, probability: prob, forecast_horizon })]).catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/forecasts/dashboard', async (req, res) => {
    try {
      const { region_id } = req.query as any;
      const where = region_id ? `WHERE region_id='${region_id}'` : '';
      const [total, horizons, outcomes, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_forecast_market ${where}`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT forecast_horizon, COUNT(*) as cnt FROM nhda_forecast_market ${where} GROUP BY forecast_horizon`).catch(() => ({ rows: [] })),
        pool.query(`SELECT outcome_type, AVG(probability)::NUMERIC(5,4) as avg_prob FROM nhda_forecast_market ${where} GROUP BY outcome_type ORDER BY avg_prob DESC LIMIT 10`).catch(() => ({ rows: [] })),
        pool.query(`SELECT f.*, r.region_name FROM nhda_forecast_market f LEFT JOIN nhda_regions r ON r.id=f.region_id ${where} ORDER BY f.generated_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0]?.count || '0') }, horizon_distribution: horizons.rows, outcome_probabilities: outcomes.rows, recent_forecasts: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, horizon_distribution: [], outcome_probabilities: [], recent_forecasts: [] }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/intelligence/master', async (_req, res) => {
    try {
      const [drift, contagion, graph, twins, civ, sims, forecasts] = await Promise.all([
        pool.query(`SELECT AVG(entropy_score)::NUMERIC(5,2) as avg_entropy, COUNT(*) FILTER(WHERE alert_level='critical') as critical FROM nhda_drift_entropy WHERE period_date>=CURRENT_DATE-7`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE containment_status='spreading') as spreading FROM nhda_contagion_events`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) as nodes FROM nhda_knowledge_graph`).catch(() => ({ rows: [{ nodes: 0 }] })),
        pool.query(`SELECT COUNT(*) as twins FROM nhda_digital_twins WHERE simulation_ready=TRUE`).catch(() => ({ rows: [{ twins: 0 }] })),
        pool.query(`SELECT AVG(societal_evolution_score)::NUMERIC(5,2) as avg_evolution FROM nhda_civilization_intelligence WHERE period_date=CURRENT_DATE`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) as total FROM nhda_simulations`).catch(() => ({ rows: [{ total: 0 }] })),
        pool.query(`SELECT COUNT(*) as total FROM nhda_forecast_market`).catch(() => ({ rows: [{ total: 0 }] }))
      ]);
      res.json({
        avg_entropy_7d: drift.rows[0]?.avg_entropy || '0',
        critical_drift_alerts: parseInt(drift.rows[0]?.critical || '0'),
        spreading_contagions: parseInt(contagion.rows[0]?.spreading || '0'),
        knowledge_nodes: parseInt(graph.rows[0]?.nodes || '0'),
        active_digital_twins: parseInt(twins.rows[0]?.twins || '0'),
        avg_civilization_evolution: civ.rows[0]?.avg_evolution || '0',
        total_simulations: parseInt(sims.rows[0]?.total || '0'),
        total_forecasts: parseInt(forecasts.rows[0]?.total || '0')
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({}); res.status(500).json({ error: e.message }); }
  });
}
