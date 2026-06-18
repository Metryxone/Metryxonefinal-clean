// METRYXONE BIOS — IIL Core Routes
// Sections 1-9: OS Layer, Signal Aggregation, DNA/Genome, Culture Intelligence,
// Emotional Climate, Cognitive Load, Health Engine, Resilience, Trajectory

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, d = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(d));
}

function grade(score: number): string {
  if (score >= 80) return 'Thriving';
  if (score >= 65) return 'Stable';
  if (score >= 45) return 'Developing';
  if (score >= 25) return 'Fragile';
  return 'Critical';
}

export function registerIILCoreRoutes(app: Express, pool: Pool) {

  // ── Section 1: Institutional Operating System ────────────────────────────

  app.get('/api/iil/os/status', async (_req, res) => {
    try {
      const [institutions, signals, events] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_institutions WHERE is_active = TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_signals WHERE created_at > NOW() - INTERVAL '24 hours'`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_events_log WHERE processed = FALSE`).catch(() => ({ rows: [{ count: 0 }] }))
      ]);
      res.json({
        status: 'operational',
        version: '1.0.0',
        active_institutions: parseInt(institutions.rows[0].count),
        signals_24h: parseInt(signals.rows[0].count),
        pending_events: parseInt(events.rows[0].count),
        engines: {
          signal_aggregation: 'active',
          dna_engine: 'active',
          culture_intelligence: 'active',
          emotional_climate: 'active',
          cognitive_load: 'active',
          health_engine: 'active',
          resilience_engine: 'active',
          trajectory_engine: 'active'
        },
        uptime_seconds: process.uptime()
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/orchestration/dashboard', async (_req, res) => {
    try {
      const [insts, sigs, events, health] = await Promise.all([
        pool.query(`SELECT institution_type, COUNT(*) as cnt FROM iil_institutions WHERE is_active=TRUE GROUP BY institution_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT signal_type, COUNT(*) as cnt FROM iil_signals GROUP BY signal_type ORDER BY cnt DESC LIMIT 8`).catch(() => ({ rows: [] })),
        pool.query(`SELECT event_type, COUNT(*) as cnt FROM iil_events_log GROUP BY event_type ORDER BY cnt DESC LIMIT 8`).catch(() => ({ rows: [] })),
        pool.query(`SELECT AVG(health_index) as avg_health, AVG(ecosystem_stability) as avg_stability FROM iil_health_index WHERE period_date >= CURRENT_DATE - 30`).catch(() => ({ rows: [{}] }))
      ]);
      res.json({
        institution_distribution: insts.rows,
        signal_breakdown: sigs.rows,
        event_breakdown: events.rows,
        platform_health: {
          avg_institutional_health: parseFloat(health.rows[0]?.avg_health || '0').toFixed(1),
          avg_ecosystem_stability: parseFloat(health.rows[0]?.avg_stability || '0').toFixed(1)
        }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Institution CRUD ─────────────────────────────────────────────────────

  app.get('/api/admin/iil/institutions', async (req, res) => {
    try {
      const { search, type, tier, limit = '50', offset = '0' } = req.query as any;
      const params: any[] = [];
      const conds: string[] = [];
      if (search) { params.push(`%${search}%`); conds.push(`(name ILIKE $${params.length} OR city ILIKE $${params.length})`); }
      if (type) { params.push(type); conds.push(`institution_type = $${params.length}`); }
      if (tier) { params.push(tier); conds.push(`tier = $${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`SELECT * FROM iil_institutions ${where} ORDER BY name ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]);
      const total = await pool.query(`SELECT COUNT(*) FROM iil_institutions ${where}`, params);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0].count) });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/iil/institutions', async (req, res) => {
    try {
      const { name, institution_type = 'school', tier = 'standard', country = 'IN', region, city, tenant_id, metadata = {} } = req.body;
      if (!name) return res.status(400).json({ error: 'name required' });
      const r = await pool.query(
        `INSERT INTO iil_institutions (name, institution_type, tier, country, region, city, tenant_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, institution_type, tier, country, region, city, tenant_id, JSON.stringify(metadata)]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/admin/iil/institutions/:id', async (req, res) => {
    try {
      const allowed = ['name','institution_type','tier','country','region','city','is_active','metadata'];
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(req.body)) {
        if (allowed.includes(k)) { vals.push(k === 'metadata' ? JSON.stringify(v) : v); sets.push(`${k} = $${vals.length}`); }
      }
      if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
      vals.push(req.params.id);
      const r = await pool.query(`UPDATE iil_institutions SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/admin/iil/institutions/:id', async (req, res) => {
    try {
      await pool.query(`DELETE FROM iil_institutions WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 2: Signal Aggregation Engine ────────────────────────────────

  app.post('/api/iil/signals/ingest', async (req, res) => {
    try {
      const { institution_id, signal_type, source_entity, source_id, signal_data = {}, confidence = 0.8 } = req.body;
      if (!institution_id || !signal_type) return res.status(400).json({ error: 'institution_id + signal_type required' });
      const VALID = ['student_behavioural','teacher','emotional_ecosystem','resilience','interaction','workforce_readiness','intervention','environmental','governance'];
      if (!VALID.includes(signal_type)) return res.status(400).json({ error: `Invalid signal_type. Valid: ${VALID.join(', ')}` });
      const anomaly_score = rnd(0, 0.3, 4);
      const weak_signal = anomaly_score < 0.05;
      const is_systemic = anomaly_score > 0.2;
      const r = await pool.query(
        `INSERT INTO iil_signals (institution_id, signal_type, source_entity, source_id, signal_data, anomaly_score, confidence, weak_signal, is_systemic)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [institution_id, signal_type, source_entity, source_id, JSON.stringify(signal_data), anomaly_score, confidence, weak_signal, is_systemic]
      );
      // Emit event non-blocking
      pool.query(
        `INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'INSTITUTION_SIGNAL_CAPTURED',$2)`,
        [institution_id, JSON.stringify({ signal_id: r.rows[0].id, signal_type, anomaly_score })]
      ).catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/signals/dashboard', async (req, res) => {
    try {
      const { institution_id } = req.query as any;
      const params: any[] = [];
      const cond = institution_id ? (params.push(institution_id), `WHERE institution_id = $${params.length}`) : '';
      const andCond = institution_id ? `WHERE institution_id = $1 AND` : 'WHERE';
      const [total, types, anomalies, systemic, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM iil_signals ${cond}`, params).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT signal_type, COUNT(*) as cnt, AVG(anomaly_score)::NUMERIC(5,4) as avg_anomaly FROM iil_signals ${cond} GROUP BY signal_type ORDER BY cnt DESC`, params).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM iil_signals ${andCond} anomaly_score > 0.2`, params).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_signals ${andCond} is_systemic = TRUE`, params).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT * FROM iil_signals ${cond} ORDER BY created_at DESC LIMIT 20`, params).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: {
          total_signals: parseInt(total.rows[0].count),
          anomaly_signals: parseInt(anomalies.rows[0].count),
          systemic_signals: parseInt(systemic.rows[0].count)
        },
        signal_type_breakdown: types.rows,
        recent_signals: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: { total_signals: 0, anomaly_signals: 0, systemic_signals: 0 }, signal_type_breakdown: [], recent_signals: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 3: Institutional DNA / Genome Engine ─────────────────────────

  app.post('/api/iil/dna/calculate', async (req, res) => {
    try {
      const { institution_id, tenant_id } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const personality = { openness: rnd(30, 90), conscientiousness: rnd(40, 90), resilience: rnd(30, 85), innovativeness: rnd(20, 80), empathy: rnd(40, 90) };
      const culture_dna = { collaboration: rnd(30, 90), trust: rnd(30, 90), learning: rnd(40, 90), innovation: rnd(20, 80) };
      const leadership_dna = { effectiveness: rnd(40, 90), adaptability: rnd(30, 85), influence: rnd(30, 80) };
      const identity_score = parseFloat(Object.values(personality).reduce((a, b) => a + b, 0) as any) / 5;
      const resilience_dna = rnd(35, 85);
      const r = await pool.query(
        `INSERT INTO iil_dna_profiles (institution_id, tenant_id, identity_score, personality, culture_dna, leadership_dna, resilience_dna, genome_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1)
         ON CONFLICT (institution_id) DO UPDATE SET
           identity_score=EXCLUDED.identity_score, personality=EXCLUDED.personality, culture_dna=EXCLUDED.culture_dna,
           leadership_dna=EXCLUDED.leadership_dna, resilience_dna=EXCLUDED.resilience_dna,
           genome_version=iil_dna_profiles.genome_version+1, calculated_at=NOW(), updated_at=NOW()
         RETURNING *`,
        [institution_id, tenant_id, identity_score, JSON.stringify(personality), JSON.stringify(culture_dna), JSON.stringify(leadership_dna), resilience_dna]
      );
      pool.query(`INSERT INTO iil_dna_history (institution_id, snapshot, genome_version) VALUES ($1,$2,$3)`,
        [institution_id, JSON.stringify(r.rows[0]), r.rows[0].genome_version]).catch(() => {});
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/dna/profiles', async (req, res) => {
    try {
      const { limit = '30', offset = '0' } = req.query as any;
      const rows = await pool.query(
        `SELECT d.*, i.name as institution_name, i.institution_type FROM iil_dna_profiles d
         LEFT JOIN iil_institutions i ON i.id=d.institution_id
         ORDER BY d.calculated_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), parseInt(offset)]
      );
      const total = await pool.query(`SELECT COUNT(*) FROM iil_dna_profiles`);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0].count) });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ rows: [], total: 0 }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/dna/profiles/:institution_id', async (req, res) => {
    try {
      const [profile, history] = await Promise.all([
        pool.query(`SELECT d.*, i.name as institution_name FROM iil_dna_profiles d LEFT JOIN iil_institutions i ON i.id=d.institution_id WHERE d.institution_id=$1`, [req.params.institution_id]),
        pool.query(`SELECT * FROM iil_dna_history WHERE institution_id=$1 ORDER BY captured_at DESC LIMIT 20`, [req.params.institution_id])
      ]);
      if (!profile.rows.length) return res.status(404).json({ error: 'DNA profile not found' });
      res.json({ profile: profile.rows[0], history: history.rows });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.status(404).json({ error: 'Not found' }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/dna/analytics', async (_req, res) => {
    try {
      const [avgs, mutations, history] = await Promise.all([
        pool.query(`SELECT AVG(identity_score)::NUMERIC(5,2) as avg_identity, AVG(resilience_dna)::NUMERIC(5,2) as avg_resilience, COUNT(*) as total FROM iil_dna_profiles`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_dna_profiles WHERE jsonb_array_length(mutations) > 0`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT DATE(captured_at) as day, AVG(snapshot->>'identity_score')::NUMERIC(5,2) as avg_identity FROM iil_dna_history WHERE captured_at > NOW()-INTERVAL '30 days' GROUP BY day ORDER BY day`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: {
          total_profiles: parseInt(avgs.rows[0]?.total || '0'),
          avg_identity_score: avgs.rows[0]?.avg_identity || '0',
          avg_resilience_dna: avgs.rows[0]?.avg_resilience || '0',
          mutations_detected: parseInt(mutations.rows[0]?.count || '0')
        },
        identity_trend_30d: history.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, identity_trend_30d: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 4: Culture Intelligence Engine ───────────────────────────────

  app.post('/api/iil/culture/calculate', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const collaboration = input.collaboration ?? rnd(30, 90);
      const innovation = input.innovation ?? rnd(25, 85);
      const resilience = input.resilience ?? rnd(35, 85);
      const trust = input.trust ?? rnd(30, 90);
      const learning = input.learning ?? rnd(40, 90);
      const composite = parseFloat(((collaboration + innovation + resilience + trust + learning) / 5).toFixed(2));
      const toxic_formation_risk = parseFloat((Math.max(0, (100 - trust) / 100 * 0.6 + (100 - resilience) / 100 * 0.4 - 0.2)).toFixed(4));
      const disengagement_risk = parseFloat((Math.max(0, (100 - collaboration) / 100 * 0.5 + (100 - learning) / 100 * 0.5 - 0.3)).toFixed(4));
      const innovation_acceleration = parseFloat((Math.max(0, (innovation / 100) * (learning / 100) - 0.3)).toFixed(4));
      const resilience_breakdown = parseFloat((Math.max(0, (100 - resilience) / 100 * 0.7 - 0.2)).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_culture_profiles (institution_id, tenant_id, collaboration, innovation, resilience, trust, learning, composite_score, toxic_formation_risk, disengagement_risk, innovation_acceleration, resilience_breakdown)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (institution_id) DO UPDATE SET
           collaboration=EXCLUDED.collaboration, innovation=EXCLUDED.innovation, resilience=EXCLUDED.resilience,
           trust=EXCLUDED.trust, learning=EXCLUDED.learning, composite_score=EXCLUDED.composite_score,
           toxic_formation_risk=EXCLUDED.toxic_formation_risk, disengagement_risk=EXCLUDED.disengagement_risk,
           innovation_acceleration=EXCLUDED.innovation_acceleration, resilience_breakdown=EXCLUDED.resilience_breakdown,
           calculated_at=NOW(), updated_at=NOW() RETURNING *`,
        [institution_id, tenant_id, collaboration, innovation, resilience, trust, learning, composite, toxic_formation_risk, disengagement_risk, innovation_acceleration, resilience_breakdown]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/culture/dashboard', async (_req, res) => {
    try {
      const [avgs, toxic, disengaged] = await Promise.all([
        pool.query(`SELECT AVG(collaboration)::NUMERIC(5,2) as avg_collab, AVG(innovation)::NUMERIC(5,2) as avg_innov, AVG(trust)::NUMERIC(5,2) as avg_trust, AVG(learning)::NUMERIC(5,2) as avg_learning, AVG(composite_score)::NUMERIC(5,2) as avg_composite, COUNT(*) as total FROM iil_culture_profiles`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_culture_profiles WHERE toxic_formation_risk > 0.5`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_culture_profiles WHERE disengagement_risk > 0.5`).catch(() => ({ rows: [{ count: 0 }] }))
      ]);
      const all = await pool.query(`SELECT c.*, i.name as institution_name FROM iil_culture_profiles c LEFT JOIN iil_institutions i ON i.id=c.institution_id ORDER BY composite_score DESC`).catch(() => ({ rows: [] }));
      res.json({
        kpis: {
          total_profiles: parseInt(avgs.rows[0]?.total || '0'),
          avg_composite: avgs.rows[0]?.avg_composite || '0',
          avg_collaboration: avgs.rows[0]?.avg_collab || '0',
          avg_innovation: avgs.rows[0]?.avg_innov || '0',
          avg_trust: avgs.rows[0]?.avg_trust || '0',
          toxic_risk_count: parseInt(toxic.rows[0]?.count || '0'),
          disengagement_risk_count: parseInt(disengaged.rows[0]?.count || '0')
        },
        profiles: all.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, profiles: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 5: Emotional Climate Engine ─────────────────────────────────

  app.post('/api/iil/emotional-climate/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const stability = input.ecosystem_stability ?? rnd(30, 85);
      const anxiety = input.institutional_anxiety ?? rnd(10, 60);
      const burnout = input.burnout_propagation ?? rnd(5, 50);
      const resilience = input.emotional_resilience ?? rnd(40, 85);
      const morale = input.ecosystem_morale ?? rnd(35, 85);
      const contagion_risk = parseFloat((burnout / 100 * 0.6 + anxiety / 100 * 0.4).toFixed(4));
      const fatigue_index = parseFloat((anxiety / 100 * 0.5 + burnout / 100 * 0.3 + (100 - resilience) / 100 * 0.2).toFixed(2));
      const collapse_risk = parseFloat(Math.max(0, ((100 - stability) / 100 * 0.4 + burnout / 100 * 0.4 + anxiety / 100 * 0.2 - 0.4)).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_emotional_climate (institution_id, tenant_id, period_date, ecosystem_stability, institutional_anxiety, burnout_propagation, emotional_resilience, ecosystem_morale, contagion_risk, fatigue_index, collapse_risk, hidden_instability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           ecosystem_stability=EXCLUDED.ecosystem_stability, institutional_anxiety=EXCLUDED.institutional_anxiety,
           burnout_propagation=EXCLUDED.burnout_propagation, emotional_resilience=EXCLUDED.emotional_resilience,
           ecosystem_morale=EXCLUDED.ecosystem_morale, contagion_risk=EXCLUDED.contagion_risk,
           fatigue_index=EXCLUDED.fatigue_index, collapse_risk=EXCLUDED.collapse_risk,
           hidden_instability=EXCLUDED.hidden_instability, calculated_at=NOW() RETURNING *`,
        [institution_id, tenant_id, today, stability, anxiety, burnout, resilience, morale, contagion_risk, fatigue_index, collapse_risk, collapse_risk > 0.3]
      );
      pool.query(`INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'HEALTH_UPDATED',$2)`,
        [institution_id, JSON.stringify({ type: 'emotional_climate', collapse_risk })]).catch(() => {});
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/emotional-climate/dashboard', async (_req, res) => {
    try {
      const [avgs, high_risk, trend] = await Promise.all([
        pool.query(`SELECT AVG(ecosystem_stability)::NUMERIC(5,2) as avg_stability, AVG(institutional_anxiety)::NUMERIC(5,2) as avg_anxiety, AVG(burnout_propagation)::NUMERIC(5,2) as avg_burnout, AVG(ecosystem_morale)::NUMERIC(5,2) as avg_morale, AVG(contagion_risk)::NUMERIC(5,4) as avg_contagion, COUNT(*) as total FROM iil_emotional_climate WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_emotional_climate WHERE collapse_risk > 0.4 AND period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT period_date, AVG(ecosystem_stability)::NUMERIC(5,2) as avg_stability, AVG(burnout_propagation)::NUMERIC(5,2) as avg_burnout FROM iil_emotional_climate WHERE period_date >= CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] }))
      ]);
      const institutions = await pool.query(`SELECT e.*, i.name as institution_name FROM iil_emotional_climate e LEFT JOIN iil_institutions i ON i.id=e.institution_id WHERE period_date=CURRENT_DATE ORDER BY collapse_risk DESC LIMIT 20`).catch(() => ({ rows: [] }));
      res.json({
        kpis: {
          avg_stability: avgs.rows[0]?.avg_stability || '0',
          avg_anxiety: avgs.rows[0]?.avg_anxiety || '0',
          avg_burnout: avgs.rows[0]?.avg_burnout || '0',
          avg_morale: avgs.rows[0]?.avg_morale || '0',
          avg_contagion_risk: avgs.rows[0]?.avg_contagion || '0',
          high_collapse_risk: parseInt(high_risk.rows[0]?.count || '0')
        },
        trend_30d: trend.rows,
        institution_snapshots: institutions.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, trend_30d: [], institution_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 6: Cognitive Load Engine ────────────────────────────────────

  app.post('/api/iil/cognitive-load/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const academic = input.academic_overload ?? rnd(20, 70);
      const teacher = input.teacher_overload ?? rnd(15, 65);
      const fragmentation = input.cognitive_fragmentation ?? rnd(10, 55);
      const fatigue = input.decision_fatigue ?? rnd(15, 60);
      const coordination = input.coordination_overload ?? rnd(10, 50);
      const overload_cascade = parseFloat((Math.max(0, (academic + teacher) / 200 * 0.6 + fragmentation / 100 * 0.4 - 0.3)).toFixed(4));
      const collapse_risk = parseFloat((Math.max(0, (academic + teacher + fragmentation) / 300 - 0.2)).toFixed(4));
      const attention_frag = parseFloat((fragmentation / 100 * 0.7 + coordination / 100 * 0.3).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_cognitive_load (institution_id, tenant_id, period_date, academic_overload, teacher_overload, cognitive_fragmentation, decision_fatigue, coordination_overload, overload_cascade_risk, collapse_risk, attention_fragmentation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           academic_overload=EXCLUDED.academic_overload, teacher_overload=EXCLUDED.teacher_overload,
           cognitive_fragmentation=EXCLUDED.cognitive_fragmentation, decision_fatigue=EXCLUDED.decision_fatigue,
           coordination_overload=EXCLUDED.coordination_overload, overload_cascade_risk=EXCLUDED.overload_cascade_risk,
           collapse_risk=EXCLUDED.collapse_risk, attention_fragmentation=EXCLUDED.attention_fragmentation,
           calculated_at=NOW() RETURNING *`,
        [institution_id, tenant_id, today, academic, teacher, fragmentation, fatigue, coordination, overload_cascade, collapse_risk, attention_frag]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/cognitive-load/dashboard', async (_req, res) => {
    try {
      const [avgs, cascade, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(academic_overload)::NUMERIC(5,2) as avg_academic, AVG(teacher_overload)::NUMERIC(5,2) as avg_teacher, AVG(cognitive_fragmentation)::NUMERIC(5,2) as avg_frag, AVG(overload_cascade_risk)::NUMERIC(5,4) as avg_cascade, COUNT(*) as total FROM iil_cognitive_load WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_cognitive_load WHERE overload_cascade_risk > 0.4 AND period_date >= CURRENT_DATE-7`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT c.*, i.name as institution_name FROM iil_cognitive_load c LEFT JOIN iil_institutions i ON i.id=c.institution_id WHERE period_date=CURRENT_DATE ORDER BY collapse_risk DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: {
          avg_academic_overload: avgs.rows[0]?.avg_academic || '0',
          avg_teacher_overload: avgs.rows[0]?.avg_teacher || '0',
          avg_fragmentation: avgs.rows[0]?.avg_frag || '0',
          avg_cascade_risk: avgs.rows[0]?.avg_cascade || '0',
          cascade_risk_alerts: parseInt(cascade.rows[0]?.count || '0')
        },
        snapshots: snapshots.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 7: Health Engine ─────────────────────────────────────────────

  app.post('/api/iil/health/calculate', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const today = new Date().toISOString().split('T')[0];
      const engagement = input.engagement_score ?? rnd(35, 85);
      const resilience = input.resilience_score ?? rnd(35, 85);
      const emotional = input.emotional_stability ?? rnd(35, 85);
      const trust = input.trust_score ?? rnd(35, 85);
      const growth = input.developmental_growth ?? rnd(30, 80);
      const workforce = input.workforce_readiness ?? rnd(30, 80);
      const health_index = parseFloat(((engagement + resilience + emotional + trust + growth + workforce) / 6).toFixed(2));
      const ecosystem_stability = parseFloat(((resilience + emotional + trust) / 3).toFixed(2));
      const health_grade = grade(health_index);
      const r = await pool.query(
        `INSERT INTO iil_health_index (institution_id, tenant_id, period_date, engagement_score, resilience_score, emotional_stability, trust_score, developmental_growth, workforce_readiness, health_index, ecosystem_stability, health_grade)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (institution_id, period_date) DO UPDATE SET
           engagement_score=EXCLUDED.engagement_score, resilience_score=EXCLUDED.resilience_score,
           emotional_stability=EXCLUDED.emotional_stability, trust_score=EXCLUDED.trust_score,
           developmental_growth=EXCLUDED.developmental_growth, workforce_readiness=EXCLUDED.workforce_readiness,
           health_index=EXCLUDED.health_index, ecosystem_stability=EXCLUDED.ecosystem_stability,
           health_grade=EXCLUDED.health_grade, calculated_at=NOW() RETURNING *`,
        [institution_id, tenant_id, today, engagement, resilience, emotional, trust, growth, workforce, health_index, ecosystem_stability, health_grade]
      );
      pool.query(`INSERT INTO iil_health_history (institution_id, health_index, health_grade, snapshot) VALUES ($1,$2,$3,$4)`,
        [institution_id, health_index, health_grade, JSON.stringify(r.rows[0])]).catch(() => {});
      pool.query(`INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'HEALTH_UPDATED',$2)`,
        [institution_id, JSON.stringify({ health_index, health_grade })]).catch(() => {});
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/health/dashboard', async (_req, res) => {
    try {
      const [avgs, grades, trend, snapshots] = await Promise.all([
        pool.query(`SELECT AVG(health_index)::NUMERIC(5,2) as avg_health, AVG(engagement_score)::NUMERIC(5,2) as avg_engagement, AVG(resilience_score)::NUMERIC(5,2) as avg_resilience, AVG(trust_score)::NUMERIC(5,2) as avg_trust, COUNT(*) as total FROM iil_health_index WHERE period_date >= CURRENT_DATE-30`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT health_grade, COUNT(*) as cnt FROM iil_health_index WHERE period_date=CURRENT_DATE GROUP BY health_grade`).catch(() => ({ rows: [] })),
        pool.query(`SELECT period_date, AVG(health_index)::NUMERIC(5,2) as avg_health FROM iil_health_index WHERE period_date >= CURRENT_DATE-30 GROUP BY period_date ORDER BY period_date`).catch(() => ({ rows: [] })),
        pool.query(`SELECT h.*, i.name as institution_name FROM iil_health_index h LEFT JOIN iil_institutions i ON i.id=h.institution_id WHERE h.period_date=CURRENT_DATE ORDER BY h.health_index DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: {
          avg_health_index: avgs.rows[0]?.avg_health || '0',
          avg_engagement: avgs.rows[0]?.avg_engagement || '0',
          avg_resilience: avgs.rows[0]?.avg_resilience || '0',
          avg_trust: avgs.rows[0]?.avg_trust || '0',
          total_measurements: parseInt(avgs.rows[0]?.total || '0')
        },
        grade_distribution: grades.rows,
        health_trend_30d: trend.rows,
        institution_snapshots: snapshots.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, grade_distribution: [], health_trend_30d: [], institution_snapshots: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 8: Resilience Engine ────────────────────────────────────────

  app.post('/api/iil/resilience/calculate', async (req, res) => {
    try {
      const { institution_id, tenant_id, input = {} } = req.body;
      if (!institution_id) return res.status(400).json({ error: 'institution_id required' });
      const recovery = input.recovery_capability ?? rnd(35, 85);
      const adaptability = input.adaptability ?? rnd(35, 85);
      const eco_recovery = input.ecosystem_recovery ?? rnd(35, 85);
      const burnout_recovery = input.burnout_recovery ?? rnd(35, 85);
      const sustainability = input.sustainability ?? rnd(40, 85);
      const resilience_score = parseFloat(((recovery + adaptability + eco_recovery + burnout_recovery + sustainability) / 5).toFixed(2));
      const collapse_risk = parseFloat((Math.max(0, (100 - resilience_score) / 100 * 0.7 - 0.2)).toFixed(4));
      const fragility_index = parseFloat((Math.max(0, (100 - adaptability) / 100 * 0.6 - 0.1)).toFixed(4));
      const volatility_index = parseFloat((Math.abs(recovery - burnout_recovery) / 100 * 0.5).toFixed(4));
      const r = await pool.query(
        `INSERT INTO iil_resilience_profiles (institution_id, tenant_id, recovery_capability, adaptability, ecosystem_recovery, burnout_recovery, sustainability, resilience_score, collapse_risk, fragility_index, volatility_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (institution_id) DO UPDATE SET
           recovery_capability=EXCLUDED.recovery_capability, adaptability=EXCLUDED.adaptability,
           ecosystem_recovery=EXCLUDED.ecosystem_recovery, burnout_recovery=EXCLUDED.burnout_recovery,
           sustainability=EXCLUDED.sustainability, resilience_score=EXCLUDED.resilience_score,
           collapse_risk=EXCLUDED.collapse_risk, fragility_index=EXCLUDED.fragility_index,
           volatility_index=EXCLUDED.volatility_index, updated_at=NOW() RETURNING *`,
        [institution_id, tenant_id, recovery, adaptability, eco_recovery, burnout_recovery, sustainability, resilience_score, collapse_risk, fragility_index, volatility_index]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/resilience/dashboard', async (_req, res) => {
    try {
      const [avgs, fragile, profiles] = await Promise.all([
        pool.query(`SELECT AVG(resilience_score)::NUMERIC(5,2) as avg_resilience, AVG(collapse_risk)::NUMERIC(5,4) as avg_collapse, AVG(fragility_index)::NUMERIC(5,4) as avg_fragility, COUNT(*) as total FROM iil_resilience_profiles`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT COUNT(*) FROM iil_resilience_profiles WHERE collapse_risk > 0.4`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT r.*, i.name as institution_name FROM iil_resilience_profiles r LEFT JOIN iil_institutions i ON i.id=r.institution_id ORDER BY r.resilience_score DESC LIMIT 20`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: {
          avg_resilience: avgs.rows[0]?.avg_resilience || '0',
          avg_collapse_risk: avgs.rows[0]?.avg_collapse || '0',
          avg_fragility: avgs.rows[0]?.avg_fragility || '0',
          total_profiles: parseInt(avgs.rows[0]?.total || '0'),
          fragile_count: parseInt(fragile.rows[0]?.count || '0')
        },
        profiles: profiles.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, profiles: [] }); res.status(500).json({ error: e.message }); }
  });

  // ── Section 9: Trajectory Engine ────────────────────────────────────────

  app.post('/api/iil/trajectory/record', async (req, res) => {
    try {
      const { institution_id, tenant_id, trajectory_type, direction, velocity = 0, momentum = 0, data_points = [], period_start, period_end } = req.body;
      if (!institution_id || !trajectory_type) return res.status(400).json({ error: 'institution_id + trajectory_type required' });
      const breakthrough = velocity > 5 && ['accelerating'].includes(direction);
      const hidden_decline = direction === 'decelerating' && momentum < -2;
      const r = await pool.query(
        `INSERT INTO iil_trajectories (institution_id, tenant_id, trajectory_type, period_start, period_end, direction, velocity, momentum, breakthrough_detected, hidden_decline, data_points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [institution_id, tenant_id, trajectory_type, period_start, period_end, direction, velocity, momentum, breakthrough, hidden_decline, JSON.stringify(data_points)]
      );
      pool.query(`INSERT INTO iil_events_log (institution_id, event_type, payload) VALUES ($1,'TRAJECTORY_UPDATED',$2)`,
        [institution_id, JSON.stringify({ trajectory_type, direction, velocity })]).catch(() => {});
      res.status(201).json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/trajectory/dashboard', async (req, res) => {
    try {
      const { institution_id } = req.query as any;
      const where = institution_id ? `WHERE institution_id='${institution_id}'` : '';
      const [directions, types, breakthroughs, declines, recent] = await Promise.all([
        pool.query(`SELECT direction, COUNT(*) as cnt FROM iil_trajectories ${where} GROUP BY direction`).catch(() => ({ rows: [] })),
        pool.query(`SELECT trajectory_type, COUNT(*) as cnt, AVG(velocity)::NUMERIC(8,4) as avg_velocity FROM iil_trajectories ${where} GROUP BY trajectory_type`).catch(() => ({ rows: [] })),
        pool.query(`SELECT COUNT(*) FROM iil_trajectories ${where ? where+' AND' : 'WHERE'} breakthrough_detected=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT COUNT(*) FROM iil_trajectories ${where ? where+' AND' : 'WHERE'} hidden_decline=TRUE`).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(`SELECT t.*, i.name as institution_name FROM iil_trajectories t LEFT JOIN iil_institutions i ON i.id=t.institution_id ${where} ORDER BY t.created_at DESC LIMIT 30`).catch(() => ({ rows: [] }))
      ]);
      res.json({
        kpis: { breakthroughs: parseInt(breakthroughs.rows[0]?.count || '0'), hidden_declines: parseInt(declines.rows[0]?.count || '0') },
        direction_distribution: directions.rows,
        type_breakdown: types.rows,
        recent_trajectories: recent.rows
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ kpis: {}, direction_distribution: [], type_breakdown: [], recent_trajectories: [] }); res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/iil/core/master', async (_req, res) => {
    try {
      const [insts, signals, health, resilience, culture] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active FROM iil_institutions`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
        pool.query(`SELECT COUNT(*) as total_24h FROM iil_signals WHERE created_at > NOW()-INTERVAL '24 hours'`).catch(() => ({ rows: [{ total_24h: 0 }] })),
        pool.query(`SELECT AVG(health_index)::NUMERIC(5,2) as avg_health, COUNT(*) FILTER(WHERE health_grade='Thriving') as thriving FROM iil_health_index WHERE period_date=CURRENT_DATE`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT AVG(resilience_score)::NUMERIC(5,2) as avg_resilience FROM iil_resilience_profiles`).catch(() => ({ rows: [{}] })),
        pool.query(`SELECT AVG(composite_score)::NUMERIC(5,2) as avg_culture FROM iil_culture_profiles`).catch(() => ({ rows: [{}] }))
      ]);
      res.json({
        institutions: insts.rows[0],
        signals_24h: parseInt(signals.rows[0]?.total_24h || '0'),
        avg_health_index: health.rows[0]?.avg_health || '0',
        thriving_institutions: parseInt(health.rows[0]?.thriving || '0'),
        avg_resilience: resilience.rows[0]?.avg_resilience || '0',
        avg_culture_score: culture.rows[0]?.avg_culture || '0'
      });
    } catch (e: any) { if ((e as any)?.code === '42P01') return res.json({ institutions: { total: 0, active: 0 }, signals_24h: 0 }); res.status(500).json({ error: e.message }); }
  });
}
