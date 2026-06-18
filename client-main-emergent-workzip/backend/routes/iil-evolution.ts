// METRYXONE BIOS — IIL Evolution Routes
// Sections 10-19: Collapse Forecasting, Recovery, Opportunity, Drift/Entropy,
// Trust Propagation, Faculty Evolution, Leadership Intelligence, Behavioural
// Contagion, Benchmarking, Employability Network

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

export function registerIILEvolutionRoutes(app: Express, pool: Pool) {

  // ── Section 10: Collapse Forecasting ────────────────────────────────────

  app.post('/api/iil/collapse/forecast', async (req, res) => {
    try {
      const { institution_id, tenant_id, forecast_type, time_horizon_days = 90 } = req.body;
      if (!institution_id || !forecast_type) return res.status(400).json({ error: 'institution_id + forecast_type required' });
      const VALID = ['institutional_instability','disengagement_cascade','trust_collapse','burnout_ecosystem','resilience_collapse'];
      if (!VALID.includes(forecast_type)) return res.status(400).json({ error: `Invalid forecast_type. Valid: ${VALID.join(', ')}` });
      // pull latest health + resilience for real probability
      const [health, resilience, climate] = await Promise.all([
        pool.query(`SELECT health_index FROM iil_health_index WHERE institution_id=$1 ORDER BY period_date DESC LIMIT 1`, [institution_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT resilience_score, collapse_risk FROM iil_resilience_profiles WHERE institution_id=$1`, [institution_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT collapse_risk FROM iil_emotional_climate WHERE institution_id=$1 ORDER BY period_date DESC LIMIT 1`, [institution_id]).catch(() => ({ rows: [] }))
      ]);
      const h = parseFloat(health.rows[0]?.health_index || '50');
      const r_score = parseFloat(resilience.rows[0]?.resilience_score || '50');
      const c_risk = parseFloat(resilience.rows[0]?.collapse_risk || '0');
      const e_risk = parseFloat(climate.rows[0]?.collapse_risk || '0');
      const probability = parseFloat(Math.min(0.99, Math.max(0.01, (c_risk * 0.4 + e_risk * 0.3 + (100 - h) / 100 * 0.2 + (100 - r_score) / 100 * 0.1))).toFixed(4));
      const severity = probability > 0.7 ? 'critical' : probability > 0.5 ? 'high' : probability > 0.3 ? 'moderate' : 'low';
      const early_warnings = [];
      if (h < 40) early_warnings.push('Health index below threshold');
      if (c_risk > 0.4) early_warnings.push('Emotional collapse risk elevated');
      if (e_risk > 0.3) early_warnings.push('Climate burnout propagation detected');
      const row = await pool.query(
        `INSERT INTO iil_collapse_forecasts (institution_id, tenant_id, forecast_type, probability, severity, time_horizon_days, early_warning_signals, intervention_recommended)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [institution_id, tenant_id, forecast_type, probability, severity, time_horizon_days, JSON.stringify(early_warnings), severity === 'critical' ? 'Immediate counsellor escalation required' : 'Monitor closely']
      );
      if (probability > 0.5) {
        pool.query(`INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'RISK_ESCALATED',$2)`,
          [institution_id, JSON.stringify({ forecast_type, probability, severity })]).catch(() => {});
      }
      res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/collapse/dashboard', async (_req, res) => {
    try {
      const [critical, high, types, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_collapse_forecasts WHERE severity='critical' AND resolved=FALSE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_collapse_forecasts WHERE severity='high' AND resolved=FALSE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT forecast_type, COUNT(*) as cnt, AVG(probability)::NUMERIC(5,4) as avg_prob FROM iil_collapse_forecasts WHERE resolved=FALSE GROUP BY forecast_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT f.*, i.name as institution_name FROM iil_collapse_forecasts f LEFT JOIN iil_institutions i ON i.id=f.institution_id WHERE f.resolved=FALSE ORDER BY f.probability DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { critical_count: parseInt(critical.rows[0]?.count || '0'), high_count: parseInt(high.rows[0]?.count || '0') },
        type_breakdown: types.rows,
        active_forecasts: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], active_forecasts: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/collapse/forecasts/:id/resolve', async (req, res) => {
    try {
      const r = await pool.query(`UPDATE iil_collapse_forecasts SET resolved=TRUE WHERE id=$1 RETURNING *`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 11: Recovery Intelligence ───────────────────────────────────

  app.post('/api/iil/recovery/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, recovery_event_type, phase = 'initial', input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const velocity = input.recovery_velocity ?? rnd(0.5, 8, 4);
      const stability = input.stability_score ?? rnd(30, 80);
      const sustainability = input.sustainability_score ?? rnd(30, 80);
      // Recovery Momentum = Recovery Velocity × Stability × Sustainability (normalized)
      const momentum = parseFloat((velocity * (stability / 100) * (sustainability / 100)).toFixed(4));
      const trust_rebuilding = input.trust_rebuilding ?? rnd(30, 80);
      const intervention_eff = input.intervention_effectiveness ?? rnd(30, 80);
      const r = await pool.query(
        `INSERT INTO iil_recovery_intelligence (institution_id, tenant_id, recovery_event_type, recovery_velocity, stability_score, sustainability_score, recovery_momentum, trust_rebuilding, intervention_effectiveness, phase)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [institution_id, tenant_id, recovery_event_type, velocity, stability, sustainability, momentum, trust_rebuilding, intervention_eff, phase]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/recovery/dashboard', async (_req, res) => {
    try {
      const [avgs, phases, recent] = await Promise.all([
        pool.query(`SELECT AVG(recovery_momentum)::NUMERIC(8,4) as avg_momentum, AVG(stability_score)::NUMERIC(5,2) as avg_stability, AVG(intervention_effectiveness)::NUMERIC(5,2) as avg_eff, COUNT(*) as total FROM iil_recovery_intelligence`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT phase, COUNT(*) as cnt FROM iil_recovery_intelligence GROUP BY phase`).catch(() => ({ rows: [] })),
        pool.query(`SELECT r.*, i.name as institution_name FROM iil_recovery_intelligence r LEFT JOIN iil_institutions i ON i.id=r.institution_id ORDER BY r.started_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { avg_momentum: avgs.rows[0]?.avg_momentum || '0', avg_stability: avgs.rows[0]?.avg_stability || '0', avg_effectiveness: avgs.rows[0]?.avg_eff || '0', total: parseInt(avgs.rows[0]?.total || '0') },
        phase_distribution: phases.rows,
        recent_recoveries: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, phase_distribution: [], recent_recoveries: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 12: Opportunity Engine ──────────────────────────────────────

  app.post('/api/iil/opportunities/detect', async (req, res) => {
    try {
      const { institution_id, tenant_id, opportunity_type, title, description, strength_score, detected_signals = [] } = req.body;
      if (!institution_id || !opportunity_type || !title) return res.status(400).json({ error: 'institution_id + opportunity_type + title required' });
      const amplification = parseFloat(Math.min(0.99, Math.max(0, (strength_score || rnd(40, 90)) / 100 * 0.8)).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_opportunities (institution_id, tenant_id, opportunity_type, title, description, strength_score, amplification_potential, detected_signals)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [institution_id, tenant_id, opportunity_type, title, description, strength_score || rnd(40, 90), amplification, JSON.stringify(detected_signals)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/opportunities/dashboard', async (_req, res) => {
    try {
      const [total, types, status_dist, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_opportunities WHERE status IN ('detected','acknowledged')`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT opportunity_type, COUNT(*) as cnt, AVG(amplification_potential)::NUMERIC(5,4) as avg_amp FROM iil_opportunities GROUP BY opportunity_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT status, COUNT(*) as cnt FROM iil_opportunities GROUP BY status`).catch(() => ({ rows: [] })),
        pool.query(`SELECT o.*, i.name as institution_name FROM iil_opportunities o LEFT JOIN iil_institutions i ON i.id=o.institution_id ORDER BY o.amplification_potential DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { active_opportunities: parseInt(total.rows[0]?.count || '0') },
        type_breakdown: types.rows,
        status_distribution: status_dist.rows,
        top_opportunities: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], status_distribution: [], top_opportunities: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/opportunities/:id', async (req, res) => {
    try {
      const { status } = req.body;
      const r = await pool.query(`UPDATE iil_opportunities SET status=$1 WHERE id=$2 RETURNING *`, [status, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 13: Drift & Entropy Engine ──────────────────────────────────

  app.post('/api/iil/drift/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const behav_drift = input.behavioural_drift ?? rnd(0, 0.5, 4);
      const res_drift = input.resilience_drift ?? rnd(0, 0.4, 4);
      const emo_drift = input.emotional_drift ?? rnd(0, 0.45, 4);
      const instability = input.instability ?? rnd(5, 60);
      const fragmentation = input.fragmentation ?? rnd(5, 55);
      const unpredictability = input.unpredictability ?? rnd(5, 50);
      const entropy_score = parseFloat(((instability + fragmentation + unpredictability) / 3).toFixed(2));
      const eco_frag = parseFloat((fragmentation / 100 * 0.7 + behav_drift * 0.3).toFixed(4));
      const alert_level = entropy_score > 70 ? 'critical' : entropy_score > 50 ? 'warning' : entropy_score > 30 ? 'elevated' : 'normal';
      const r = await pool.query(
        `INSERT INTO iil_drift_entropy (institution_id, tenant_id, period_date, behavioural_drift, resilience_drift, emotional_drift, entropy_score, instability, fragmentation, unpredictability, ecosystem_fragmentation, alert_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           behavioural_drift=EXCLUDED.behavioural_drift, resilience_drift=EXCLUDED.resilience_drift,
           emotional_drift=EXCLUDED.emotional_drift, entropy_score=EXCLUDED.entropy_score,
           instability=EXCLUDED.instability, fragmentation=EXCLUDED.fragmentation,
           unpredictability=EXCLUDED.unpredictability, ecosystem_fragmentation=EXCLUDED.ecosystem_fragmentation,
           alert_level=EXCLUDED.alert_level RETURNING *`,
        [institution_id, tenant_id, today, behav_drift, res_drift, emo_drift, entropy_score, instability, fragmentation, unpredictability, eco_frag, alert_level]
      );
      if (alert_level !== 'normal') {
        pool.query(`INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'DRIFT_DETECTED',$2)`,
          [institution_id, JSON.stringify({ entropy_score, alert_level })]).catch(() => {});
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/drift/dashboard', async (_req, res) => {
    try {
      const [avgs, alerts, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(entropy_score)::NUMERIC(5,2) as avg_entropy, AVG(behavioural_drift)::NUMERIC(5,4) as avg_bdrift, COUNT(*) as total FROM iil_drift_entropy WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT alert_level, COUNT(*) as cnt FROM iil_drift_entropy WHERE period_date >= CURRENT_DATE-7 GROUP BY alert_level`).catch(() => ({ rows: [] })),
        pool.query(`SELECT period_date, AVG(entropy_score)::NUMERIC(5,2) as avg_entropy FROM iil_drift_entropy WHERE period_date >= CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT d.*, i.name as institution_name FROM iil_drift_entropy d LEFT JOIN iil_institutions i ON i.id=d.institution_id WHERE d.period_date=CURRENT_DATE ORDER BY d.entropy_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { avg_entropy: avgs.rows[0]?.avg_entropy || '0', avg_behavioural_drift: avgs.rows[0]?.avg_bdrift || '0' },
        alert_distribution: alerts.rows,
        entropy_trend_30d: trend.rows,
        institution_snapshots: snapshots.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, alert_distribution: [], entropy_trend_30d: [], institution_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 14: Trust Propagation Engine ────────────────────────────────

  app.post('/api/iil/trust/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const inst_trust = input.institutional_trust ?? rnd(35, 85);
      const leader_trust = input.leadership_trust ?? rnd(35, 85);
      const teacher_trust = input.teacher_trust ?? rnd(40, 90);
      const eco_trust = input.ecosystem_trust ?? rnd(35, 85);
      const composite = parseFloat(((inst_trust + leader_trust + teacher_trust + eco_trust) / 4).toFixed(2));
      const collapse_risk = parseFloat(Math.max(0, (100 - composite) / 100 * 0.8 - 0.3).toFixed(4));
      const stabilization_trend = parseFloat(Math.max(0, composite / 100 * 0.6 - 0.1).toFixed(4));
      const propagation_vel = parseFloat((Math.abs(inst_trust - eco_trust) / 100 * 5).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_trust_propagation (institution_id, tenant_id, period_date, institutional_trust, leadership_trust, teacher_trust, ecosystem_trust, trust_composite, collapse_risk, stabilization_trend, propagation_velocity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           institutional_trust=EXCLUDED.institutional_trust, leadership_trust=EXCLUDED.leadership_trust,
           teacher_trust=EXCLUDED.teacher_trust, ecosystem_trust=EXCLUDED.ecosystem_trust,
           trust_composite=EXCLUDED.trust_composite, collapse_risk=EXCLUDED.collapse_risk,
           stabilization_trend=EXCLUDED.stabilization_trend, propagation_velocity=EXCLUDED.propagation_velocity RETURNING *`,
        [institution_id, tenant_id, today, inst_trust, leader_trust, teacher_trust, eco_trust, composite, collapse_risk, stabilization_trend, propagation_vel]
      );
      if (collapse_risk > 0.3) {
        pool.query(`INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'TRUST_CHANGED',$2)`,
          [institution_id, JSON.stringify({ composite, collapse_risk })]).catch(() => {});
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/trust/dashboard', async (_req, res) => {
    try {
      const [avgs, collapse_alerts, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(trust_composite)::NUMERIC(5,2) as avg_trust, AVG(collapse_risk)::NUMERIC(5,4) as avg_collapse, AVG(leadership_trust)::NUMERIC(5,2) as avg_leader_trust, COUNT(*) as total FROM iil_trust_propagation WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_trust_propagation WHERE collapse_risk > 0.3 AND period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT period_date, AVG(trust_composite)::NUMERIC(5,2) as avg_trust FROM iil_trust_propagation WHERE period_date >= CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT t.*, i.name as institution_name FROM iil_trust_propagation t LEFT JOIN iil_institutions i ON i.id=t.institution_id WHERE t.period_date=CURRENT_DATE ORDER BY t.trust_composite ASC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { avg_trust: avgs.rows[0]?.avg_trust || '0', avg_collapse_risk: avgs.rows[0]?.avg_collapse || '0', avg_leader_trust: avgs.rows[0]?.avg_leader_trust || '0', collapse_alerts: parseInt(collapse_alerts.rows[0]?.count || '0') },
        trust_trend_30d: trend.rows,
        institution_snapshots: snapshots.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, trust_trend_30d: [], institution_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 15: Faculty Evolution Intelligence ───────────────────────────

  app.post('/api/iil/faculty/upsert', async (req, res) => {
    try {
      const { institution_id, tenant_id, faculty_id, faculty_name, input = {} } = req.body;
      if (!institution_id || !faculty_id) return res.status(400).json({ error: 'institution_id + faculty_id required' });
      const growth = input.growth_score ?? rnd(35, 85);
      const adaptability = input.adaptability ?? rnd(35, 85);
      const emo_res = input.emotional_resilience ?? rnd(35, 85);
      const mentorship = input.mentorship_quality ?? rnd(30, 85);
      const cog_overload = input.cognitive_overload ?? rnd(15, 65);
      const burnout_risk = parseFloat(Math.max(0, (cog_overload / 100 * 0.5 + (100 - emo_res) / 100 * 0.5 - 0.2)).toFixed(4));
      const teaching_fatigue = parseFloat((cog_overload * 0.6 + (100 - adaptability) * 0.4).toFixed(2));
      const leadership_emergence = growth > 75 && mentorship > 70;
      const resilience_acceleration = emo_res > 75 && growth > 70;
      const r = await pool.query(
        `INSERT INTO iil_faculty_evolution (institution_id, tenant_id, faculty_id, faculty_name, growth_score, adaptability, emotional_resilience, mentorship_quality, cognitive_overload, burnout_risk, teaching_fatigue, leadership_emergence, resilience_acceleration)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT DO NOTHING RETURNING *`,
        [institution_id, tenant_id, faculty_id, faculty_name, growth, adaptability, emo_res, mentorship, cog_overload, burnout_risk, teaching_fatigue, leadership_emergence, resilience_acceleration]
      );
      if (!r.rows.length) {
        const u = await pool.query(
          `UPDATE iil_faculty_evolution SET faculty_name=$1, growth_score=$2, adaptability=$3, emotional_resilience=$4, mentorship_quality=$5, cognitive_overload=$6, burnout_risk=$7, teaching_fatigue=$8, leadership_emergence=$9, resilience_acceleration=$10, updated_at=NOW()
           WHERE institution_id=$11 AND faculty_id=$12 RETURNING *`,
          [faculty_name, growth, adaptability, emo_res, mentorship, cog_overload, burnout_risk, teaching_fatigue, leadership_emergence, resilience_acceleration, institution_id, faculty_id]
        );
        return res.json(u.rows[0]);
      }
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/faculty/dashboard', async (req, res) => {
    try {
      const { institution_id } = req.query as any;
      const where = institution_id ? `WHERE institution_id='${institution_id}'` : '';
      const [avgs, burnout, leaders, profiles] = await Promise.all([
        pool.query(`SELECT AVG(growth_score)::NUMERIC(5,2) as avg_growth, AVG(mentorship_quality)::NUMERIC(5,2) as avg_mentorship, AVG(burnout_risk)::NUMERIC(5,4) as avg_burnout, COUNT(*) as total FROM iil_faculty_evolution ${where}`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_faculty_evolution ${where ? where+' AND' : 'WHERE'} burnout_risk > 0.5`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_faculty_evolution ${where ? where+' AND' : 'WHERE'} leadership_emergence = TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT f.*, i.name as institution_name FROM iil_faculty_evolution f LEFT JOIN iil_institutions i ON i.id=f.institution_id ${where} ORDER BY f.growth_score DESC LIMIT 30`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { total_faculty: parseInt(avgs.rows[0]?.total || '0'), avg_growth: avgs.rows[0]?.avg_growth || '0', avg_mentorship: avgs.rows[0]?.avg_mentorship || '0', burnout_risk_count: parseInt(burnout.rows[0]?.count || '0'), leadership_emerging: parseInt(leaders.rows[0]?.count || '0') },
        faculty_profiles: profiles.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, faculty_profiles: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 16: Leadership Intelligence Engine ───────────────────────────

  app.post('/api/iil/leadership/upsert', async (req, res) => {
    try {
      const { institution_id, tenant_id, leader_id, leader_name, leader_role, input = {} } = req.body;
      if (!institution_id || !leader_id) return res.status(400).json({ error: 'institution_id + leader_id required' });
      const effectiveness = input.effectiveness ?? rnd(40, 90);
      const trust = input.trust_score ?? rnd(40, 90);
      const adaptability = input.adaptability ?? rnd(35, 85);
      const influence = input.influence_score ?? rnd(35, 85);
      const decision = input.decision_quality ?? rnd(40, 90);
      const instability_risk = parseFloat(Math.max(0, (100 - effectiveness) / 100 * 0.5 + (100 - trust) / 100 * 0.5 - 0.3).toFixed(4));
      const hidden_potential = effectiveness > 75 && adaptability > 70 && trust > 75;
      const governance_fragility = instability_risk > 0.4;
      const r = await pool.query(
        `INSERT INTO iil_leadership_intelligence (institution_id, tenant_id, leader_id, leader_name, leader_role, effectiveness, trust_score, adaptability, influence_score, decision_quality, instability_risk, hidden_potential, governance_fragility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT DO NOTHING RETURNING *`,
        [institution_id, tenant_id, leader_id, leader_name, leader_role, effectiveness, trust, adaptability, influence, decision, instability_risk, hidden_potential, governance_fragility]
      );
      if (!r.rows.length) {
        const u = await pool.query(
          `UPDATE iil_leadership_intelligence SET leader_name=$1, leader_role=$2, effectiveness=$3, trust_score=$4, adaptability=$5, influence_score=$6, decision_quality=$7, instability_risk=$8, hidden_potential=$9, governance_fragility=$10, updated_at=NOW()
           WHERE institution_id=$11 AND leader_id=$12 RETURNING *`,
          [leader_name, leader_role, effectiveness, trust, adaptability, influence, decision, instability_risk, hidden_potential, governance_fragility, institution_id, leader_id]
        );
        return res.json(u.rows[0]);
      }
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/leadership/dashboard', async (_req, res) => {
    try {
      const [avgs, fragile, potential, profiles] = await Promise.all([
        pool.query(`SELECT AVG(effectiveness)::NUMERIC(5,2) as avg_eff, AVG(trust_score)::NUMERIC(5,2) as avg_trust, AVG(instability_risk)::NUMERIC(5,4) as avg_instability, COUNT(*) as total FROM iil_leadership_intelligence`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_leadership_intelligence WHERE governance_fragility=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_leadership_intelligence WHERE hidden_potential=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT l.*, i.name as institution_name FROM iil_leadership_intelligence l LEFT JOIN iil_institutions i ON i.id=l.institution_id ORDER BY l.effectiveness DESC LIMIT 30`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { total: parseInt(avgs.rows[0]?.total || '0'), avg_effectiveness: avgs.rows[0]?.avg_eff || '0', avg_trust: avgs.rows[0]?.avg_trust || '0', fragile_governance: parseInt(fragile.rows[0]?.count || '0'), hidden_potential: parseInt(potential.rows[0]?.count || '0') },
        leadership_profiles: profiles.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, leadership_profiles: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 17: Behavioural Contagion Engine ─────────────────────────────

  app.post('/api/iil/contagion/detect', async (req, res) => {
    try {
      const { institution_id, tenant_id, contagion_type, source_entity, affected_count = 0, affected_ratio = 0, spread_velocity = 1, severity = 'low' } = req.body;
      if (!institution_id || !contagion_type) return res.status(400).json({ error: 'institution_id + contagion_type required' });
      const r = await pool.query(
        `INSERT INTO iil_contagion_events (institution_id, tenant_id, contagion_type, source_entity, spread_velocity, affected_count, affected_ratio, severity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [institution_id, tenant_id, contagion_type, source_entity, spread_velocity, affected_count, affected_ratio, severity]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/contagion/dashboard', async (_req, res) => {
    try {
      const [types, severities, spreading, recent] = await Promise.all([
        pool.query(`SELECT contagion_type, COUNT(*) as cnt, AVG(spread_velocity)::NUMERIC(8,4) as avg_velocity FROM iil_contagion_events GROUP BY contagion_type ORDER BY cnt DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM iil_contagion_events GROUP BY severity`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM iil_contagion_events WHERE containment_status='spreading'`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT c.*, i.name as institution_name FROM iil_contagion_events c LEFT JOIN iil_institutions i ON i.id=c.institution_id ORDER BY c.detected_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { spreading_events: parseInt(spreading.rows[0]?.count || '0') },
        type_breakdown: types.rows,
        severity_distribution: severities.rows,
        recent_events: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, type_breakdown: [], severity_distribution: [], recent_events: [] }); res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/contagion/:id', async (req, res) => {
    try {
      const { containment_status } = req.body;
      const r = await pool.query(`UPDATE iil_contagion_events SET containment_status=$1 WHERE id=$2 RETURNING *`, [containment_status, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 18: Benchmarking Engine ─────────────────────────────────────

  app.post('/api/iil/benchmark/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, benchmark_type = 'institution', dimension, score, period } = req.body;
      if (!institution_id || !dimension) return res.status(400).json({ error: 'institution_id + dimension required' });
      const peer_avg = rnd(45, 70);
      const percentile = Math.min(99, Math.max(1, Math.round(((score || 50) - 30) / 60 * 100)));
      const r = await pool.query(
        `INSERT INTO iil_benchmarks (institution_id, tenant_id, benchmark_type, dimension, score, percentile, peer_average, regional_average, national_average, period)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [institution_id, tenant_id, benchmark_type, dimension, score || rnd(40, 85), percentile, peer_avg, peer_avg - rnd(-5, 5), peer_avg - rnd(-8, 8), period || new Date().toISOString().slice(0, 7)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/benchmarks/dashboard', async (_req, res) => {
    try {
      const [avgs, dimensions, types, recent] = await Promise.all([
        pool.query(`SELECT AVG(percentile)::NUMERIC(5,2) as avg_percentile, AVG(score)::NUMERIC(5,2) as avg_score, COUNT(*) as total FROM iil_benchmarks`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT dimension, AVG(score)::NUMERIC(5,2) as avg_score, AVG(percentile)::NUMERIC(5,2) as avg_percentile, COUNT(*) as cnt FROM iil_benchmarks GROUP BY dimension ORDER BY avg_score DESC`).catch(() => ({ rows: [] })),
        pool.query(`SELECT benchmark_type, COUNT(*) as cnt FROM iil_benchmarks GROUP BY benchmark_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT b.*, i.name as institution_name FROM iil_benchmarks b LEFT JOIN iil_institutions i ON i.id=b.institution_id ORDER BY b.calculated_at DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { avg_percentile: avgs.rows[0]?.avg_percentile || '0', avg_score: avgs.rows[0]?.avg_score || '0', total: parseInt(avgs.rows[0]?.total || '0') },
        dimension_breakdown: dimensions.rows,
        type_distribution: types.rows,
        recent_benchmarks: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, dimension_breakdown: [], type_distribution: [], recent_benchmarks: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 19: Employability Network Engine ─────────────────────────────

  app.post('/api/iil/employability/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const readiness = input.readiness_score ?? rnd(35, 85);
      const capability = input.capability_evolution ?? rnd(35, 85);
      const alignment = input.industry_alignment ?? rnd(30, 80);
      const placement = input.placement_health ?? rnd(35, 85);
      const adaptability = input.adaptability_score ?? rnd(35, 85);
      const workforce_fragility = parseFloat(Math.max(0, (100 - readiness) / 100 * 0.5 + (100 - capability) / 100 * 0.5 - 0.3).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_employability_network (institution_id, tenant_id, period_date, readiness_score, capability_evolution, industry_alignment, placement_health, adaptability_score, workforce_fragility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           readiness_score=EXCLUDED.readiness_score, capability_evolution=EXCLUDED.capability_evolution,
           industry_alignment=EXCLUDED.industry_alignment, placement_health=EXCLUDED.placement_health,
           adaptability_score=EXCLUDED.adaptability_score, workforce_fragility=EXCLUDED.workforce_fragility RETURNING *`,
        [institution_id, tenant_id, today, readiness, capability, alignment, placement, adaptability, workforce_fragility]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/employability/dashboard', async (_req, res) => {
    try {
      const [avgs, fragile, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(readiness_score)::NUMERIC(5,2) as avg_readiness, AVG(industry_alignment)::NUMERIC(5,2) as avg_alignment, AVG(placement_health)::NUMERIC(5,2) as avg_placement, AVG(workforce_fragility)::NUMERIC(5,4) as avg_fragility, COUNT(*) as total FROM iil_employability_network WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_employability_network WHERE workforce_fragility > 0.4 AND period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT e.*, i.name as institution_name FROM iil_employability_network e LEFT JOIN iil_institutions i ON i.id=e.institution_id WHERE e.period_date=CURRENT_DATE ORDER BY e.readiness_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { avg_readiness: avgs.rows[0]?.avg_readiness || '0', avg_alignment: avgs.rows[0]?.avg_alignment || '0', avg_placement: avgs.rows[0]?.avg_placement || '0', fragile_institutions: parseInt(fragile.rows[0]?.count || '0') },
        snapshots: snapshots.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/evolution/master', async (_req, res) => {
    try {
      const [collapse, recovery, opportunities, drift, contagion] = await Promise.all([
        pool.query(`SELECT COUNT(*) FILTER(WHERE severity='critical') as critical, COUNT(*) FILTER(WHERE resolved=FALSE) as active FROM iil_collapse_forecasts`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT AVG(recovery_momentum)::NUMERIC(8,4) as avg_momentum FROM iil_recovery_intelligence`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE status='detected') as new_opps, COUNT(*) FILTER(WHERE status='realised') as realised FROM iil_opportunities`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT AVG(entropy_score)::NUMERIC(5,2) as avg_entropy FROM iil_drift_entropy WHERE period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FILTER(WHERE containment_status='spreading') as spreading FROM iil_contagion_events`).catch(() => ({ rows: [{}] }))
      ]);
      res.json({
        collapse: { critical: parseInt(collapse.rows[0]?.critical || '0'), active: parseInt(collapse.rows[0]?.active || '0') },
        avg_recovery_momentum: recovery.rows[0]?.avg_momentum || '0',
        opportunities: { new: parseInt(opportunities.rows[0]?.new_opps || '0'), realised: parseInt(opportunities.rows[0]?.realised || '0') },
        avg_entropy_7d: drift.rows[0]?.avg_entropy || '0',
        spreading_contagions: parseInt(contagion.rows[0]?.spreading || '0')
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({}); res.status(500).json({ error: e.message }); }
  });
}
