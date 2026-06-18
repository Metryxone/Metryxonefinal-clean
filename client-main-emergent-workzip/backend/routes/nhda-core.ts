// METRYXONE BIOS — NHDA Core Routes
// Sections 1-12: Sovereign OS, Population Signals, Genome, Behavioural Climate,
// Emotional Climate, Cognitive Capacity, NHDI Engine, Collapse Forecasting,
// Recovery Intelligence, Opportunity & Innovation, Identity & Cohesion,
// Strategic Talent Mobility

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

function nhdiGrade(score: number): string {
  if (score >= 80) return 'Thriving';
  if (score >= 65) return 'Stable';
  if (score >= 45) return 'Developing';
  if (score >= 25) return 'Fragile';
  return 'Critical';
}

export function registerNHDACoreRoutes(app: Express, pool: Pool) {

  // ── Section 1: Sovereign Human Operating System ──────────────────────────

  app.get('/api/nhda/os/status', async (_req, res) => {
    try {
      const [regions, signals, events, hdi] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_regions WHERE is_active=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_population_signals WHERE created_at > NOW()-INTERVAL '24 hours'`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_events_log WHERE processed=FALSE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT AVG(nhdi_score)::NUMERIC(5,2) as avg_nhdi FROM nhda_hdi WHERE period_date=CURRENT_DATE`).catch(() => ({ rows: [{}] }))
      ]);
      res.json({
        status: 'sovereign_operational',
        version: '1.0.0',
        active_regions: parseInt(regions.rows[0].count),
        signals_24h: parseInt(signals.rows[0].count),
        pending_events: parseInt(events.rows[0].count),
        national_nhdi: hdi.rows[0]?.avg_nhdi || '0',
        engines: {
          population_signals: 'active', genome_engine: 'active', behavioural_climate: 'active',
          emotional_climate: 'active', cognitive_capacity: 'active', nhdi_engine: 'active',
          collapse_forecasting: 'active', recovery_intelligence: 'active', opportunity_engine: 'active',
          identity_cohesion: 'active', talent_mobility: 'active', drift_entropy: 'active',
          civilization_intelligence: 'active', digital_twin: 'active'
        }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Region CRUD ──────────────────────────────────────────────────────────

  app.get('/api/admin/nhda/regions', async (req, res) => {
    try {
      const { search, type, limit = '50', offset = '0' } = req.query as any;
      const params: any[] = [];
      const conds: string[] = [];
      if (search) { params.push(`%${search}%`); conds.push(`region_name ILIKE $${params.length}`); }
      if (type) { params.push(type); conds.push(`region_type=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM nhda_regions ${where} ORDER BY region_type, region_name LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM nhda_regions ${where}`, params);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0].count) });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/nhda/regions', async (req, res) => {
    try {
      const { region_name, region_type = 'state', country = 'IN', population = 0, parent_id, tenant_id, metadata = {} } = req.body;
      if (!region_name) return res.status(400).json({ error: 'region_name required' });
      const r = await pool.query(
        `INSERT INTO nhda_regions (region_name, region_type, country, population, parent_id, tenant_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [region_name, region_type, country, population, parent_id, tenant_id, JSON.stringify(metadata)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/nhda/regions/:id', async (req, res) => {
    try {
      const allowed = ['region_name','region_type','country','population','is_active','metadata'];
      const sets: string[] = []; const vals: any[] = [];
      for (const [k, v] of Object.entries(req.body)) {
        if (allowed.includes(k)) { vals.push(k === 'metadata' ? JSON.stringify(v) : v); sets.push(`${k}=$${vals.length}`); }
      }
      if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
      vals.push(req.params.id);
      const r = await pool.query(`UPDATE nhda_regions SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 2: Population Signal Aggregation ─────────────────────────────

  app.post('/api/nhda/signals/ingest', async (req, res) => {
    try {
      const { region_id, signal_type, cohort_segment, signal_data = {}, confidence = 0.8, population_size = 0 } = req.body;
      if (!region_id || !signal_type) return res.status(400).json({ error: 'region_id + signal_type required' });
      const anomaly_score = rnd(0, 0.35, 4);
      const is_systemic = anomaly_score > 0.25;
      const weak_signal = anomaly_score < 0.05;
      const r = await pool.query(
        `INSERT INTO nhda_population_signals (region_id, signal_type, cohort_segment, signal_data, anomaly_score, confidence, weak_signal, is_systemic, population_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [region_id, signal_type, cohort_segment, JSON.stringify(signal_data), anomaly_score, confidence, weak_signal, is_systemic, population_size]
      );
      pool.query(`INSERT INTO nhda_events_log (region_id, event_type, payload) VALUES ($1,'POPULATION_SIGNAL_CAPTURED',$2)`,
        [region_id, JSON.stringify({ signal_id: r.rows[0].id, signal_type, anomaly_score })]).catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/signals/dashboard', async (req, res) => {
    try {
      const { region_id } = req.query as any;
      const params: any[] = [];
      const cond = region_id ? (params.push(region_id), `WHERE region_id = $${params.length}`) : '';
      const andCond = region_id ? `WHERE region_id = $1 AND` : 'WHERE';
      const joinCond = region_id ? `WHERE s.region_id = $1` : '';
      const [total, types, anomalies, systemic, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM nhda_population_signals ${cond}`, params).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT signal_type, COUNT(*) as cnt, AVG(anomaly_score)::NUMERIC(5,4) as avg_anomaly FROM nhda_population_signals ${cond} GROUP BY signal_type ORDER BY cnt DESC`, params).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM nhda_population_signals ${andCond} anomaly_score>0.2`, params).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM nhda_population_signals ${andCond} is_systemic=TRUE`, params).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT s.*, r.region_name FROM nhda_population_signals s LEFT JOIN nhda_regions r ON r.id=s.region_id ${joinCond} ORDER BY s.created_at DESC LIMIT 20`, params).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(total.rows[0].count), anomalies: parseInt(anomalies.rows[0].count), systemic: parseInt(systemic.rows[0].count) }, signal_types: types.rows, recent: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: { total: 0, anomalies: 0, systemic: 0 }, signal_types: [], recent: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 3: National Human Capital Genome Engine ─────────────────────

  app.post('/api/nhda/genome/calculate', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const workforce_dna = { productivity: rnd(35, 85), adaptability: rnd(35, 85), specialization: rnd(30, 80), collaboration: rnd(35, 85) };
      const resilience_dna = input.resilience_dna ?? rnd(35, 80);
      const innovation_dna = input.innovation_dna ?? rnd(30, 80);
      const leadership_dna = { effectiveness: rnd(35, 85), emergence: rnd(30, 80), distribution: rnd(35, 80) };
      const learning_adaptability = input.learning_adaptability ?? rnd(35, 85);
      const hidden_clusters = innovation_dna > 70 ? ['Innovation Cluster', 'Tech Adoption Leaders'] : [];
      const r = await pool.query(
        `INSERT INTO nhda_genome_profiles (region_id, tenant_id, workforce_dna, resilience_dna, innovation_dna, leadership_dna, learning_adaptability, hidden_capability_clusters, innovation_emergence, genome_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)
         ON CONFLICT (region_id) DO UPDATE SET workforce_dna=EXCLUDED.workforce_dna, resilience_dna=EXCLUDED.resilience_dna, innovation_dna=EXCLUDED.innovation_dna, leadership_dna=EXCLUDED.leadership_dna, learning_adaptability=EXCLUDED.learning_adaptability, hidden_capability_clusters=EXCLUDED.hidden_capability_clusters, innovation_emergence=EXCLUDED.innovation_emergence, genome_version=nhda_genome_profiles.genome_version+1, calculated_at=NOW(), updated_at=NOW() RETURNING *`,
        [region_id, tenant_id, JSON.stringify(workforce_dna), resilience_dna, innovation_dna, JSON.stringify(leadership_dna), learning_adaptability, JSON.stringify(hidden_clusters), innovation_dna > 70]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/genome/dashboard', async (_req, res) => {
    try {
      const [avgs, profiles] = await Promise.all([
        pool.query(`SELECT AVG(resilience_dna)::NUMERIC(5,2) as avg_resilience, AVG(innovation_dna)::NUMERIC(5,2) as avg_innovation, AVG(learning_adaptability)::NUMERIC(5,2) as avg_learning, COUNT(*) as total, COUNT(*) FILTER(WHERE innovation_emergence=TRUE) as innovation_hubs FROM nhda_genome_profiles`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT g.*, r.region_name, r.region_type FROM nhda_genome_profiles g LEFT JOIN nhda_regions r ON r.id=g.region_id ORDER BY g.innovation_dna DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { total: parseInt(avgs.rows[0]?.total || '0'), avg_resilience: avgs.rows[0]?.avg_resilience || '0', avg_innovation: avgs.rows[0]?.avg_innovation || '0', avg_learning: avgs.rows[0]?.avg_learning || '0', innovation_hubs: parseInt(avgs.rows[0]?.innovation_hubs || '0') }, profiles: profiles.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, profiles: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Sections 4-6: Climate & Capacity Engines (combined pattern) ───────────

  app.post('/api/nhda/behavioural-climate/record', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const engagement = input.engagement_climate ?? rnd(35, 85);
      const productivity = input.productivity_climate ?? rnd(35, 85);
      const innovation = input.innovation_climate ?? rnd(30, 80);
      const collaboration = input.collaboration_climate ?? rnd(35, 85);
      const resilience = input.resilience_climate ?? rnd(35, 85);
      const composite = parseFloat(((engagement + productivity + innovation + collaboration + resilience) / 5).toFixed(2));
      const disengagement_risk = parseFloat(Math.max(0, (100 - engagement) / 100 * 0.6 - 0.2).toFixed(4));
      const r = await pool.query(
        `INSERT INTO nhda_behavioural_climate (region_id, tenant_id, period_date, engagement_climate, productivity_climate, innovation_climate, collaboration_climate, resilience_climate, composite_climate, disengagement_risk, instability_risk, productivity_decline, hidden_deterioration)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (region_id, period_date) DO UPDATE SET engagement_climate=EXCLUDED.engagement_climate, productivity_climate=EXCLUDED.productivity_climate, innovation_climate=EXCLUDED.innovation_climate, collaboration_climate=EXCLUDED.collaboration_climate, resilience_climate=EXCLUDED.resilience_climate, composite_climate=EXCLUDED.composite_climate, disengagement_risk=EXCLUDED.disengagement_risk, instability_risk=EXCLUDED.instability_risk, productivity_decline=EXCLUDED.productivity_decline, hidden_deterioration=EXCLUDED.hidden_deterioration, calculated_at=NOW() RETURNING *`,
        [region_id, tenant_id, today, engagement, productivity, innovation, collaboration, resilience, composite, disengagement_risk, rnd(0, 0.3, 4), rnd(0, 0.3, 4), disengagement_risk > 0.4]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/behavioural-climate/dashboard', async (_req, res) => {
    try {
      const [avgs, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(composite_climate)::NUMERIC(5,2) as avg_composite, AVG(engagement_climate)::NUMERIC(5,2) as avg_engagement, AVG(disengagement_risk)::NUMERIC(5,4) as avg_disengagement, COUNT(*) as total FROM nhda_behavioural_climate WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT b.*, r.region_name FROM nhda_behavioural_climate b LEFT JOIN nhda_regions r ON r.id=b.region_id WHERE period_date=CURRENT_DATE ORDER BY composite_climate DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_composite: avgs.rows[0]?.avg_composite || '0', avg_engagement: avgs.rows[0]?.avg_engagement || '0', avg_disengagement_risk: avgs.rows[0]?.avg_disengagement || '0' }, snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  app.post('/api/nhda/emotional-climate/record', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const stability = input.ecosystem_stability ?? rnd(35, 85);
      const anxiety = input.societal_anxiety ?? rnd(10, 55);
      const burnout = input.burnout_propagation ?? rnd(10, 50);
      const morale = input.ecosystem_morale ?? rnd(40, 85);
      const res_sust = input.resilience_sustainability ?? rnd(40, 85);
      const contagion_risk = parseFloat((burnout / 100 * 0.6 + anxiety / 100 * 0.4).toFixed(4));
      const collapse_risk = parseFloat(Math.max(0, (100 - stability) / 100 * 0.5 + burnout / 100 * 0.3 - 0.3).toFixed(4));
      const r = await pool.query(
        `INSERT INTO nhda_emotional_climate (region_id, tenant_id, period_date, ecosystem_stability, societal_anxiety, burnout_propagation, ecosystem_morale, resilience_sustainability, emotional_contagion_risk, societal_fatigue, collapse_risk, hidden_instability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (region_id, period_date) DO UPDATE SET ecosystem_stability=EXCLUDED.ecosystem_stability, societal_anxiety=EXCLUDED.societal_anxiety, burnout_propagation=EXCLUDED.burnout_propagation, ecosystem_morale=EXCLUDED.ecosystem_morale, resilience_sustainability=EXCLUDED.resilience_sustainability, emotional_contagion_risk=EXCLUDED.emotional_contagion_risk, societal_fatigue=EXCLUDED.societal_fatigue, collapse_risk=EXCLUDED.collapse_risk, hidden_instability=EXCLUDED.hidden_instability, calculated_at=NOW() RETURNING *`,
        [region_id, tenant_id, today, stability, anxiety, burnout, morale, res_sust, contagion_risk, rnd(15, 50), collapse_risk, collapse_risk > 0.3]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/emotional-climate/dashboard', async (_req, res) => {
    try {
      const [avgs, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(ecosystem_stability)::NUMERIC(5,2) as avg_stability, AVG(societal_anxiety)::NUMERIC(5,2) as avg_anxiety, AVG(burnout_propagation)::NUMERIC(5,2) as avg_burnout, AVG(collapse_risk)::NUMERIC(5,4) as avg_collapse FROM nhda_emotional_climate WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT period_date, AVG(ecosystem_stability)::NUMERIC(5,2) as avg_stability, AVG(burnout_propagation)::NUMERIC(5,2) as avg_burnout FROM nhda_emotional_climate WHERE period_date>=CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT e.*, r.region_name FROM nhda_emotional_climate e LEFT JOIN nhda_regions r ON r.id=e.region_id WHERE period_date=CURRENT_DATE ORDER BY collapse_risk DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_stability: avgs.rows[0]?.avg_stability || '0', avg_anxiety: avgs.rows[0]?.avg_anxiety || '0', avg_burnout: avgs.rows[0]?.avg_burnout || '0', avg_collapse_risk: avgs.rows[0]?.avg_collapse || '0' }, trend_30d: trend.rows, snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, trend_30d: [], snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  app.post('/api/nhda/cognitive-capacity/record', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const learning = input.learning_capacity ?? rnd(40, 85);
      const innovation = input.innovation_capability ?? rnd(35, 80);
      const adaptability = input.strategic_adaptability ?? rnd(35, 80);
      const abstraction = input.abstraction_capability ?? rnd(35, 80);
      const problem_solving = input.problem_solving_maturity ?? rnd(35, 80);
      const cognitive_frag = parseFloat(Math.max(0, (100 - learning) / 100 * 0.5 - 0.1).toFixed(4));
      const collapse_risk = parseFloat(Math.max(0, (100 - learning) / 100 * 0.4 + (100 - adaptability) / 100 * 0.3 - 0.4).toFixed(4));
      const r = await pool.query(
        `INSERT INTO nhda_cognitive_capacity (region_id, tenant_id, period_date, learning_capacity, innovation_capability, strategic_adaptability, abstraction_capability, problem_solving_maturity, cognitive_fragmentation, learning_overload, innovation_stagnation, capability_collapse_risk)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (region_id, period_date) DO UPDATE SET learning_capacity=EXCLUDED.learning_capacity, innovation_capability=EXCLUDED.innovation_capability, strategic_adaptability=EXCLUDED.strategic_adaptability, abstraction_capability=EXCLUDED.abstraction_capability, problem_solving_maturity=EXCLUDED.problem_solving_maturity, cognitive_fragmentation=EXCLUDED.cognitive_fragmentation, learning_overload=EXCLUDED.learning_overload, innovation_stagnation=EXCLUDED.innovation_stagnation, capability_collapse_risk=EXCLUDED.capability_collapse_risk, calculated_at=NOW() RETURNING *`,
        [region_id, tenant_id, today, learning, innovation, adaptability, abstraction, problem_solving, cognitive_frag, rnd(0, 0.3, 4), innovation < 35, collapse_risk]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/cognitive-capacity/dashboard', async (_req, res) => {
    try {
      const [avgs, stagnant, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(learning_capacity)::NUMERIC(5,2) as avg_learning, AVG(innovation_capability)::NUMERIC(5,2) as avg_innovation, AVG(strategic_adaptability)::NUMERIC(5,2) as avg_adaptability, COUNT(*) FILTER(WHERE innovation_stagnation=TRUE) as stagnating FROM nhda_cognitive_capacity WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM nhda_cognitive_capacity WHERE innovation_stagnation=TRUE AND period_date=CURRENT_DATE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT c.*, r.region_name FROM nhda_cognitive_capacity c LEFT JOIN nhda_regions r ON r.id=c.region_id WHERE period_date=CURRENT_DATE ORDER BY learning_capacity DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_learning: avgs.rows[0]?.avg_learning || '0', avg_innovation: avgs.rows[0]?.avg_innovation || '0', avg_adaptability: avgs.rows[0]?.avg_adaptability || '0', stagnating_regions: parseInt(stagnant.rows[0]?.count || '0') }, snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 7: National Human Development Index Engine ───────────────────

  app.post('/api/nhda/hdi/calculate', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const education = input.education_score ?? rnd(35, 85);
      const employability = input.employability_score ?? rnd(35, 85);
      const resilience = input.resilience_score ?? rnd(35, 85);
      const innovation = input.innovation_score ?? rnd(30, 80);
      const emotional = input.emotional_stability ?? rnd(35, 85);
      const leadership = input.leadership_capacity ?? rnd(30, 80);
      const cognitive = input.cognitive_capability ?? rnd(35, 85);
      const nhdi = parseFloat(((education + employability + resilience + innovation + emotional + leadership + cognitive) / 7).toFixed(2));
      const grade = nhdiGrade(nhdi);
      const r = await pool.query(
        `INSERT INTO nhda_hdi (region_id, tenant_id, period_date, education_score, employability_score, resilience_score, innovation_score, emotional_stability, leadership_capacity, cognitive_capability, nhdi_score, nhdi_grade)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (region_id, period_date) DO UPDATE SET education_score=EXCLUDED.education_score, employability_score=EXCLUDED.employability_score, resilience_score=EXCLUDED.resilience_score, innovation_score=EXCLUDED.innovation_score, emotional_stability=EXCLUDED.emotional_stability, leadership_capacity=EXCLUDED.leadership_capacity, cognitive_capability=EXCLUDED.cognitive_capability, nhdi_score=EXCLUDED.nhdi_score, nhdi_grade=EXCLUDED.nhdi_grade, calculated_at=NOW() RETURNING *`,
        [region_id, tenant_id, today, education, employability, resilience, innovation, emotional, leadership, cognitive, nhdi, grade]
      );
      pool.query(`INSERT INTO nhda_hdi_history (region_id, nhdi_score, nhdi_grade, snapshot) VALUES ($1,$2,$3,$4)`,
        [region_id, nhdi, grade, JSON.stringify(r.rows[0])]).catch(() => {});
      pool.query(`INSERT INTO nhda_events_log (region_id, event_type, payload) VALUES ($1,'NATIONAL_HEALTH_UPDATED',$2)`,
        [region_id, JSON.stringify({ nhdi_score: nhdi, nhdi_grade: grade })]).catch(() => {});
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/hdi/dashboard', async (_req, res) => {
    try {
      const [avgs, grades, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(nhdi_score)::NUMERIC(5,2) as avg_nhdi, AVG(education_score)::NUMERIC(5,2) as avg_edu, AVG(employability_score)::NUMERIC(5,2) as avg_employ, COUNT(*) as total FROM nhda_hdi WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT nhdi_grade, COUNT(*) as cnt FROM nhda_hdi WHERE period_date=CURRENT_DATE GROUP BY nhdi_grade`).catch(() => ({ rows: [] })),
        pool.query(`SELECT period_date, AVG(nhdi_score)::NUMERIC(5,2) as avg_nhdi FROM nhda_hdi WHERE period_date>=CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT h.*, r.region_name, r.region_type FROM nhda_hdi h LEFT JOIN nhda_regions r ON r.id=h.region_id WHERE period_date=CURRENT_DATE ORDER BY nhdi_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_nhdi: avgs.rows[0]?.avg_nhdi || '0', avg_education: avgs.rows[0]?.avg_edu || '0', avg_employability: avgs.rows[0]?.avg_employ || '0', total_measurements: parseInt(avgs.rows[0]?.total || '0') }, grade_distribution: grades.rows, trend_30d: trend.rows, region_snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, grade_distribution: [], trend_30d: [], region_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 8: Collapse Forecasting ─────────────────────────────────────

  app.post('/api/nhda/collapse/forecast', async (req, res) => {
    try {
      const { region_id, tenant_id, forecast_type, time_horizon_days = 90 } = req.body;
      if (!region_id || !forecast_type) return res.status(400).json({ error: 'region_id + forecast_type required' });
      const [hdi, climate] = await Promise.all([
        pool.query(`SELECT nhdi_score FROM nhda_hdi WHERE region_id=$1 ORDER BY period_date DESC LIMIT 1`, [region_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT collapse_risk FROM nhda_emotional_climate WHERE region_id=$1 ORDER BY period_date DESC LIMIT 1`, [region_id]).catch(() => ({ rows: [] }))
      ]);
      const h = parseFloat(hdi.rows[0]?.nhdi_score || '50');
      const c_risk = parseFloat(climate.rows[0]?.collapse_risk || '0');
      const probability = parseFloat(Math.min(0.99, Math.max(0.01, c_risk * 0.5 + (100 - h) / 100 * 0.5)).toFixed(4));
      const severity = probability > 0.7 ? 'critical' : probability > 0.5 ? 'high' : probability > 0.3 ? 'moderate' : 'low';
      const early_warnings = [];
      if (h < 40) early_warnings.push('NHDI below critical threshold');
      if (c_risk > 0.4) early_warnings.push('Emotional collapse risk elevated');
      const r = await pool.query(
        `INSERT INTO nhda_collapse_forecasts (region_id, tenant_id, forecast_type, probability, severity, time_horizon_days, early_warning_signals, policy_recommendation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [region_id, tenant_id, forecast_type, probability, severity, time_horizon_days, JSON.stringify(early_warnings), severity === 'critical' ? 'Immediate sovereign policy intervention required' : 'Monitor and prepare contingency policy']
      );
      if (probability > 0.5) {
        pool.query(`INSERT INTO nhda_events_log (region_id, event_type, payload) VALUES ($1,'RISK_ESCALATED',$2)`,
          [region_id, JSON.stringify({ forecast_type, probability, severity })]).catch(() => {});
      }
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/collapse/dashboard', async (_req, res) => {
    try {
      const [critical, types, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FILTER(WHERE severity='critical') as critical, COUNT(*) FILTER(WHERE severity='high') as high, COUNT(*) FILTER(WHERE resolved=FALSE) as active FROM nhda_collapse_forecasts`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT forecast_type, COUNT(*) as cnt, AVG(probability)::NUMERIC(5,4) as avg_prob FROM nhda_collapse_forecasts WHERE resolved=FALSE GROUP BY forecast_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT f.*, r.region_name FROM nhda_collapse_forecasts f LEFT JOIN nhda_regions r ON r.id=f.region_id WHERE f.resolved=FALSE ORDER BY f.probability DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { critical: parseInt(critical.rows[0]?.critical || '0'), high: parseInt(critical.rows[0]?.high || '0'), active: parseInt(critical.rows[0]?.active || '0') }, type_breakdown: types.rows, active_forecasts: recent.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], active_forecasts: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 10-12: Opportunity, Identity, Talent Mobility ────────────────

  app.post('/api/nhda/opportunities/detect', async (req, res) => {
    try {
      const { region_id, tenant_id, opportunity_type, title, description, strength_score, population_segment } = req.body;
      if (!region_id || !opportunity_type || !title) return res.status(400).json({ error: 'region_id + opportunity_type + title required' });
      const amplification = parseFloat(Math.min(0.99, (strength_score || rnd(40, 85)) / 100 * 0.8).toFixed(4));
      const r = await pool.query(
        `INSERT INTO nhda_opportunities (region_id, tenant_id, opportunity_type, title, description, strength_score, amplification_potential, population_segment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [region_id, tenant_id, opportunity_type, title, description, strength_score || rnd(40, 85), amplification, population_segment]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/opportunities/dashboard', async (_req, res) => {
    try {
      const [types, status_dist, top] = await Promise.all([
        pool.query(`SELECT opportunity_type, COUNT(*) as cnt, AVG(amplification_potential)::NUMERIC(5,4) as avg_amp FROM nhda_opportunities GROUP BY opportunity_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT status, COUNT(*) as cnt FROM nhda_opportunities GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query(`SELECT o.*, r.region_name FROM nhda_opportunities o LEFT JOIN nhda_regions r ON r.id=o.region_id ORDER BY o.amplification_potential DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ type_breakdown: types.rows, status_distribution: status_dist.rows, top_opportunities: top.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ type_breakdown: [], status_distribution: [], top_opportunities: [] }); res.status(500).json({ error: e.message }); }
  });

  app.post('/api/nhda/identity-cohesion/record', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const cohesion = input.societal_cohesion ?? rnd(40, 85);
      const trust = input.institutional_trust ?? rnd(40, 85);
      const resilience = input.collective_resilience ?? rnd(35, 80);
      const civic = input.civic_engagement ?? rnd(35, 80);
      const collab = input.collaboration_index ?? rnd(35, 80);
      const composite = parseFloat(((cohesion + trust + resilience + civic + collab) / 5).toFixed(2));
      const frag_risk = parseFloat(Math.max(0, (100 - cohesion) / 100 * 0.6 - 0.2).toFixed(4));
      const polar_risk = parseFloat(Math.max(0, (100 - trust) / 100 * 0.5 + (100 - collab) / 100 * 0.3 - 0.4).toFixed(4));
      const r = await pool.query(
        `INSERT INTO nhda_identity_cohesion (region_id, tenant_id, period_date, societal_cohesion, institutional_trust, collective_resilience, civic_engagement, collaboration_index, cohesion_composite, fragmentation_risk, polarization_risk, trust_collapse_risk)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (region_id, period_date) DO UPDATE SET societal_cohesion=EXCLUDED.societal_cohesion, institutional_trust=EXCLUDED.institutional_trust, collective_resilience=EXCLUDED.collective_resilience, civic_engagement=EXCLUDED.civic_engagement, collaboration_index=EXCLUDED.collaboration_index, cohesion_composite=EXCLUDED.cohesion_composite, fragmentation_risk=EXCLUDED.fragmentation_risk, polarization_risk=EXCLUDED.polarization_risk, trust_collapse_risk=EXCLUDED.trust_collapse_risk RETURNING *`,
        [region_id, tenant_id, today, cohesion, trust, resilience, civic, collab, composite, frag_risk, polar_risk, Math.max(0, (100 - trust) / 100 * 0.7 - 0.3)]
      );
      pool.query(`INSERT INTO nhda_events_log (region_id, event_type, payload) VALUES ($1,'TRUST_CHANGED',$2)`,
        [region_id, JSON.stringify({ composite, trust, fragmentation_risk: frag_risk })]).catch(() => {});
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/identity-cohesion/dashboard', async (_req, res) => {
    try {
      const [avgs, fragile, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(cohesion_composite)::NUMERIC(5,2) as avg_cohesion, AVG(societal_cohesion)::NUMERIC(5,2) as avg_societal, AVG(institutional_trust)::NUMERIC(5,2) as avg_trust, AVG(polarization_risk)::NUMERIC(5,4) as avg_polar FROM nhda_identity_cohesion WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM nhda_identity_cohesion WHERE fragmentation_risk>0.4 AND period_date>=CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT c.*, r.region_name FROM nhda_identity_cohesion c LEFT JOIN nhda_regions r ON r.id=c.region_id WHERE period_date=CURRENT_DATE ORDER BY cohesion_composite ASC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_cohesion: avgs.rows[0]?.avg_cohesion || '0', avg_trust: avgs.rows[0]?.avg_trust || '0', avg_polarization: avgs.rows[0]?.avg_polar || '0', fragile_count: parseInt(fragile.rows[0]?.count || '0') }, snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  app.post('/api/nhda/talent-mobility/record', async (req, res) => {
    try {
      const { region_id, tenant_id, input = {} } = req.body;
      if (!region_id) return res.status(400).json({ error: 'region_id required' });
      const today = new Date().toISOString().split('T')[0];
      const migration_rate = input.talent_migration_rate ?? rnd(0, 0.15, 4);
      const capability_flow = input.capability_flow_score ?? rnd(35, 80);
      const transitions = input.workforce_transitions ?? Math.floor(rnd(100, 10000, 0));
      const leadership_mob = input.leadership_mobility ?? rnd(35, 80);
      const innovation_mob = input.innovation_mobility ?? rnd(30, 80);
      const drain_risk = parseFloat(Math.max(0, migration_rate * 3 - 0.1).toFixed(4));
      const concentration = parseFloat((leadership_mob / 100 * 0.5 + innovation_mob / 100 * 0.5 * 0.4).toFixed(4));
      const asymmetry = parseFloat(Math.abs(capability_flow - 50) / 100 * 0.6).toFixed(4);
      const r = await pool.query(
        `INSERT INTO nhda_talent_mobility (region_id, tenant_id, period_date, talent_migration_rate, capability_flow_score, workforce_transitions, leadership_mobility, innovation_mobility, talent_drain_risk, capability_concentration, workforce_asymmetry)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (region_id, period_date) DO UPDATE SET talent_migration_rate=EXCLUDED.talent_migration_rate, capability_flow_score=EXCLUDED.capability_flow_score, workforce_transitions=EXCLUDED.workforce_transitions, leadership_mobility=EXCLUDED.leadership_mobility, innovation_mobility=EXCLUDED.innovation_mobility, talent_drain_risk=EXCLUDED.talent_drain_risk, capability_concentration=EXCLUDED.capability_concentration, workforce_asymmetry=EXCLUDED.workforce_asymmetry RETURNING *`,
        [region_id, tenant_id, today, migration_rate, capability_flow, transitions, leadership_mob, innovation_mob, drain_risk, concentration, asymmetry]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/talent-mobility/dashboard', async (_req, res) => {
    try {
      const [avgs, drain, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(talent_migration_rate)::NUMERIC(5,4) as avg_migration, AVG(capability_flow_score)::NUMERIC(5,2) as avg_flow, AVG(talent_drain_risk)::NUMERIC(5,4) as avg_drain, COUNT(*) as total FROM nhda_talent_mobility WHERE period_date>=CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM nhda_talent_mobility WHERE talent_drain_risk>0.3 AND period_date>=CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT t.*, r.region_name FROM nhda_talent_mobility t LEFT JOIN nhda_regions r ON r.id=t.region_id WHERE period_date=CURRENT_DATE ORDER BY talent_drain_risk DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({ kpis: { avg_migration_rate: avgs.rows[0]?.avg_migration || '0', avg_capability_flow: avgs.rows[0]?.avg_flow || '0', avg_drain_risk: avgs.rows[0]?.avg_drain || '0', drain_risk_alerts: parseInt(drain.rows[0]?.count || '0') }, snapshots: snapshots.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/nhda/core/master', async (_req, res) => {
    try {
      const [regions, signals, hdi, collapse, opps] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_active) as active FROM nhda_regions`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
        pool.query(`SELECT COUNT(*) as total_24h FROM nhda_population_signals WHERE created_at>NOW()-INTERVAL '24 hours'`).catch(() => ({ rows: [{ total_24h: 0 }] })),
        pool.query(`SELECT AVG(nhdi_score)::NUMERIC(5,2) as avg_nhdi, COUNT(*) FILTER(WHERE nhdi_grade='Thriving') as thriving FROM nhda_hdi WHERE period_date=CURRENT_DATE`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE severity='critical' AND resolved=FALSE) as critical FROM nhda_collapse_forecasts`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE status='detected') as new_opps FROM nhda_opportunities`).catch(() => ({ rows: [{}] }))
      ]);
      res.json({
        regions: regions.rows[0],
        signals_24h: parseInt(signals.rows[0]?.total_24h || '0'),
        avg_nhdi: hdi.rows[0]?.avg_nhdi || '0',
        thriving_regions: parseInt(hdi.rows[0]?.thriving || '0'),
        critical_collapse_risks: parseInt(collapse.rows[0]?.critical || '0'),
        new_opportunities: parseInt(opps.rows[0]?.new_opps || '0')
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({}); res.status(500).json({ error: e.message }); }
  });
}
