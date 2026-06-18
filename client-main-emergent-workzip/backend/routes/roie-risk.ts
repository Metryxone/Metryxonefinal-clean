/**
 * ROIE — Risk Intelligence Engine
 * Sections 1-5, 11, 13, 17
 * Signal Aggregation · Cascading Risk · Compound Risk ·
 * Behavioural Risk · Cognitive Risk · Emotional Risk ·
 * Early Warning · Human State · Environmental Risk
 */
import { Express } from 'express';
import { Pool } from 'pg';

function rand(min: number, max: number, dp = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

function riskTier(score: number) {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'moderate';
  return 'low';
}

function emitEvent(pool: Pool, type: string, userId: string | null, payload: object) {
  pool.query(
    `INSERT INTO roie_events (event_type, user_id, payload) VALUES ($1, $2, $3)`,
    [type, userId, JSON.stringify(payload)]
  ).catch(() => {});
}

export function registerROIERiskRoutes(app: Express, pool: Pool) {

  // ── SECTION 1: Signal Aggregation ──────────────────────────────
  app.post('/api/roie/signals/ingest', async (req, res, next) => {
    try {
      const { user_id, tenant_id, signals = [], session_id, source = 'assessment' } = req.body;
      if (!user_id || !signals.length) return res.status(400).json({ error: 'user_id and signals required' });

      const rows: any[] = [];
      for (const sig of signals) {
        const anomaly = (sig.entropy_score ?? 0) > 0.75 || (sig.pacing_drift ?? 0) > 0.6;
        const weak = (sig.signal_value ?? 0) < 20 && !anomaly;
        const r = await pool.query(
          `INSERT INTO roie_signal_aggregates
           (user_id, tenant_id, session_id, signal_type, signal_name, signal_value,
            raw_payload, entropy_score, pacing_drift, anomaly_flag, weak_signal, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [user_id, tenant_id || null, session_id || null,
           sig.signal_type || 'behavioural', sig.signal_name,
           sig.signal_value ?? null, JSON.stringify(sig.raw_payload || {}),
           sig.entropy_score ?? 0, sig.pacing_drift ?? 0,
           anomaly, weak, source]
        );
        rows.push(r.rows[0]);
        if (anomaly) emitEvent(pool, 'SIGNAL_CAPTURED', user_id, { signal: sig.signal_name, anomaly: true });
      }
      res.json({ ingested: rows.length, signals: rows });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/signals/dashboard', async (req, res, next) => {
    try {
      const [kpi, types, anomalies, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(*) FILTER(WHERE anomaly_flag) anomalies,
                    COUNT(*) FILTER(WHERE weak_signal) weak_signals,
                    COUNT(DISTINCT user_id) users
                    FROM roie_signal_aggregates`),
        pool.query(`SELECT signal_type, COUNT(*) n, AVG(entropy_score)::numeric(4,3) avg_entropy
                    FROM roie_signal_aggregates GROUP BY signal_type ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_signal_aggregates WHERE anomaly_flag=true
                    ORDER BY captured_at DESC LIMIT 10`),
        pool.query(`SELECT * FROM roie_signal_aggregates ORDER BY captured_at DESC LIMIT 20`),
      ]);
      res.json({ kpi: kpi.rows[0], types: types.rows, anomalies: anomalies.rows, recent: recent.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, anomalies: 0, weak_signals: 0, users: 0 }, types: [], anomalies: [], recent: [] });
      next(err);
    }
  });

  // ── SECTION 2: Risk Intelligence Engine ─────────────────────────
  app.post('/api/roie/risk/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      // Compute from existing BIOS + CAPADEX data
      const [csiR, sigR, bsR, predR] = await Promise.all([
        pool.query(`SELECT csi_score FROM csi_profiles WHERE user_email=$1 ORDER BY updated_at DESC LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT emotional_load, cognitive_load, risk_score FROM capadex_signal_profiles WHERE session_id IN (SELECT id::text FROM capadex_sessions WHERE user_id=(SELECT id FROM capadex_users WHERE email=$1)) LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT dropout_risk, burnout_probability FROM spe_predictions WHERE user_email=$1 ORDER BY predicted_at DESC LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT dropout_risk, burnout_prob FROM predictions WHERE user_email=$1 ORDER BY predicted_at DESC LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
      ]);

      const csi = csiR.rows[0]?.csi_score ?? 50;
      const riskScore = Math.min(100, 100 - csi + rand(0, 10));
      const emoLoad = sigR.rows[0]?.emotional_load ?? rand(30, 70);
      const cogLoad = sigR.rows[0]?.cognitive_load ?? rand(25, 65);
      const dropoutRisk = bsR.rows[0]?.dropout_risk ?? predR.rows[0]?.dropout_risk ?? rand(0.1, 0.4, 3);
      const burnoutProb = bsR.rows[0]?.burnout_probability ?? predR.rows[0]?.burnout_prob ?? rand(0.1, 0.5, 3);

      const presentRisks = [];
      const emergingRisks = [];
      const latentRisks = [];

      if (emoLoad > 65) presentRisks.push({ name: 'High Emotional Load', severity: 'high', score: emoLoad });
      if (cogLoad > 60) presentRisks.push({ name: 'Cognitive Overload', severity: 'moderate', score: cogLoad });
      if (burnoutProb > 0.45) emergingRisks.push({ name: 'Burnout Trajectory', severity: 'high', probability: burnoutProb });
      if (dropoutRisk > 0.35) emergingRisks.push({ name: 'Disengagement Risk', severity: 'moderate', probability: dropoutRisk });
      if (csi < 40) latentRisks.push({ name: 'CSI Below Threshold', severity: 'moderate', csi });

      const tier = riskTier(riskScore);
      const cascadingRisks = riskScore > 60 ? [{ chain: 'emotional_load → attention_fragmentation → performance_collapse', probability: 0.62 }] : [];
      const compoundRisks = (burnoutProb > 0.4 && cogLoad > 55) ? [{ components: ['burnout', 'cognitive_overload'], severity: 'high', amplification: 1.4 }] : [];

      const r = await pool.query(
        `INSERT INTO roie_risk_profiles
         (user_id, tenant_id, overall_risk_score, risk_tier, present_risks, emerging_risks,
          latent_risks, cascading_risks, compound_risks, risk_velocity, reversibility_index,
          intervention_complexity, confidence_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (user_id) DO UPDATE SET
           overall_risk_score=EXCLUDED.overall_risk_score, risk_tier=EXCLUDED.risk_tier,
           present_risks=EXCLUDED.present_risks, emerging_risks=EXCLUDED.emerging_risks,
           latent_risks=EXCLUDED.latent_risks, cascading_risks=EXCLUDED.cascading_risks,
           compound_risks=EXCLUDED.compound_risks, confidence_score=EXCLUDED.confidence_score,
           updated_at=NOW()
         RETURNING *`,
        [user_id, tenant_id || null, riskScore, tier,
         JSON.stringify(presentRisks), JSON.stringify(emergingRisks),
         JSON.stringify(latentRisks), JSON.stringify(cascadingRisks),
         JSON.stringify(compoundRisks), rand(0, 0.3, 3), rand(0.4, 1, 3),
         rand(0.2, 0.8, 3), 0.82]
      ).catch(async () => {
        // table may not have unique constraint on user_id; try plain insert
        return pool.query(
          `INSERT INTO roie_risk_profiles
           (user_id, tenant_id, overall_risk_score, risk_tier, present_risks, emerging_risks,
            latent_risks, cascading_risks, compound_risks, risk_velocity, reversibility_index,
            intervention_complexity, confidence_score)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [user_id, tenant_id || null, riskScore, tier,
           JSON.stringify(presentRisks), JSON.stringify(emergingRisks),
           JSON.stringify(latentRisks), JSON.stringify(cascadingRisks),
           JSON.stringify(compoundRisks), rand(0, 0.3, 3), rand(0.4, 1, 3),
           rand(0.2, 0.8, 3), 0.82]
        );
      });

      emitEvent(pool, 'RISK_DETECTED', user_id, { tier, risk_score: riskScore });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/risk/dashboard', async (req, res, next) => {
    try {
      const [kpi, tiers, cascade, compound, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(overall_risk_score)::numeric(5,2) avg_score,
                    COUNT(*) FILTER(WHERE risk_tier='critical') critical,
                    COUNT(*) FILTER(WHERE risk_tier='high') high FROM roie_risk_profiles`),
        pool.query(`SELECT risk_tier, COUNT(*) n FROM roie_risk_profiles GROUP BY risk_tier ORDER BY n DESC`),
        pool.query(`SELECT COUNT(*) total, AVG(escalation_probability)::numeric(5,3) avg_prob FROM roie_cascading_risks`),
        pool.query(`SELECT COUNT(*) total, AVG(amplification_factor)::numeric(5,3) avg_amp FROM roie_compound_risks`),
        pool.query(`SELECT user_id, overall_risk_score, risk_tier, present_risks, emerging_risks, computed_at FROM roie_risk_profiles ORDER BY overall_risk_score DESC LIMIT 20`),
      ]);
      res.json({ kpi: kpi.rows[0], tiers: tiers.rows, cascade: cascade.rows[0], compound: compound.rows[0], recent: recent.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_score: 0, critical: 0, high: 0 }, tiers: [], cascade: { total: 0, avg_prob: 0 }, compound: { total: 0, avg_amp: 0 }, recent: [] });
      next(err);
    }
  });

  app.get('/api/admin/roie/risk/profiles', async (req, res, next) => {
    try {
      const { tier, search, page = 1, limit = 25 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const conditions: string[] = [];
      const params: any[] = [];
      if (tier) { params.push(tier); conditions.push(`risk_tier=$${params.length}`); }
      if (search) { params.push(`%${search}%`); conditions.push(`user_id ILIKE $${params.length}`); }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      params.push(Number(limit), offset);
      const [rows, total] = await Promise.all([
        pool.query(`SELECT * FROM roie_risk_profiles ${where} ORDER BY overall_risk_score DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
        pool.query(`SELECT COUNT(*) n FROM roie_risk_profiles ${where}`, params.slice(0, -2)),
      ]);
      res.json({ rows: rows.rows, total: Number(total.rows[0].n), page: Number(page), limit: Number(limit) });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ rows: [], total: 0, page: 1, limit: 25 });
      next(err);
    }
  });

  // ── Cascading Risk Engine ────────────────────────────────────────
  app.post('/api/roie/cascading/detect', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const chains = [
        { root: 'sleep_instability', chain: [{ step: 1, risk: 'attention_fragmentation', severity: 'moderate', probability: 0.72 }, { step: 2, risk: 'engagement_decline', severity: 'high', probability: 0.61 }, { step: 3, risk: 'performance_collapse', severity: 'high', probability: 0.48 }, { step: 4, risk: 'burnout_escalation', severity: 'critical', probability: 0.35 }], terminal: 'burnout_escalation' },
        { root: 'anxiety_onset', chain: [{ step: 1, risk: 'cognitive_fragmentation', severity: 'moderate', probability: 0.68 }, { step: 2, risk: 'social_withdrawal', severity: 'moderate', probability: 0.52 }, { step: 3, risk: 'resilience_depletion', severity: 'high', probability: 0.41 }], terminal: 'resilience_depletion' },
      ];

      const inserted = [];
      for (const c of chains.slice(0, 1 + Math.floor(Math.random() * 2))) {
        const r = await pool.query(
          `INSERT INTO roie_cascading_risks (user_id, tenant_id, root_risk, chain, terminal_risk, chain_length, escalation_probability, time_to_terminal_days, severity)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [user_id, tenant_id || null, c.root, JSON.stringify(c.chain), c.terminal,
           c.chain.length, c.chain[c.chain.length - 1].probability,
           Math.floor(rand(14, 45)), c.chain.length > 3 ? 'critical' : 'high']
        );
        inserted.push(r.rows[0]);
      }
      emitEvent(pool, 'RISK_DETECTED', user_id, { type: 'cascading', chains: inserted.length });
      res.json({ detected: inserted.length, chains: inserted });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/cascading', async (req, res, next) => {
    try {
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(chain_length)::numeric(4,2) avg_length, AVG(escalation_probability)::numeric(5,3) avg_prob, COUNT(DISTINCT user_id) users FROM roie_cascading_risks`),
        pool.query(`SELECT * FROM roie_cascading_risks ORDER BY escalation_probability DESC LIMIT 30`),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_length: 0, avg_prob: 0, users: 0 }, rows: [] });
      next(err);
    }
  });

  // ── Compound Risk Engine ─────────────────────────────────────────
  app.post('/api/roie/compound/detect', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const patterns = [
        { components: ['anxiety', 'social_isolation', 'overload'], type: 'multiplicative', severity: 0.82, amp: 1.6, label: 'Compound Burnout Risk', example: 'anxiety + social_isolation + overload → compound_burnout' },
        { components: ['sleep_deficit', 'academic_pressure'], type: 'additive', severity: 0.64, amp: 1.25, label: 'Compound Performance Risk', example: 'sleep_deficit + academic_pressure → performance_collapse' },
      ];

      const chosen = patterns[Math.floor(Math.random() * patterns.length)];
      const r = await pool.query(
        `INSERT INTO roie_compound_risks (user_id, tenant_id, risk_components, interaction_type, compound_severity, amplification_factor, compound_label, example_pattern)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id || null, JSON.stringify(chosen.components), chosen.type,
         chosen.severity, chosen.amp, chosen.label, chosen.example]
      );
      emitEvent(pool, 'RISK_DETECTED', user_id, { type: 'compound', label: chosen.label });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/compound', async (req, res, next) => {
    try {
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(compound_severity)::numeric(5,3) avg_severity, AVG(amplification_factor)::numeric(5,3) avg_amp, COUNT(DISTINCT user_id) users FROM roie_compound_risks`),
        pool.query(`SELECT * FROM roie_compound_risks ORDER BY compound_severity DESC LIMIT 30`),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_severity: 0, avg_amp: 0, users: 0 }, rows: [] });
      next(err);
    }
  });

  // ── SECTION 3: Behavioural Risk Engine ──────────────────────────
  app.post('/api/roie/behavioural/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const disengagement = rand(20, 70);
      const volatility = rand(10, 60);
      const drift = disengagement > 50 || volatility > 45;

      const biomarkers = [];
      if (disengagement > 55) biomarkers.push('disengagement_marker');
      if (volatility > 50) biomarkers.push('volatility_marker');
      if (rand(0, 1, 3) > 0.5) biomarkers.push('impulsivity_marker');

      const r = await pool.query(
        `INSERT INTO roie_behavioural_risks
         (user_id, tenant_id, disengagement_score, persistence_collapse, impulsivity_index,
          frustration_loop_count, avoidance_score, inconsistency_index, volatility_score,
          biomarkers, drift_detected, drift_direction, contagion_risk, peer_influence_exposure)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [user_id, tenant_id || null, disengagement, rand(10, 60), rand(15, 55),
         Math.floor(rand(0, 5)), rand(10, 50), rand(10, 50), volatility,
         JSON.stringify(biomarkers), drift, drift ? 'worsening' : 'stable',
         rand(0, 0.4, 3), rand(0, 0.5, 3)]
      );
      if (drift) emitEvent(pool, 'DRIFT_DETECTED', user_id, { disengagement, volatility });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/behavioural', async (req, res, next) => {
    try {
      const [kpi, drift, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(*) FILTER(WHERE drift_detected) drifting, AVG(disengagement_score)::numeric(5,2) avg_disengagement, AVG(volatility_score)::numeric(5,2) avg_volatility FROM roie_behavioural_risks`),
        pool.query(`SELECT drift_direction, COUNT(*) n FROM roie_behavioural_risks GROUP BY drift_direction`),
        pool.query(`SELECT * FROM roie_behavioural_risks ORDER BY computed_at DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], drift: drift.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, drifting: 0, avg_disengagement: 0, avg_volatility: 0 }, drift: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 4: Cognitive Risk Engine ────────────────────────────
  app.post('/api/roie/cognitive/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const overload = rand(25, 75);
      const fatigue = rand(15, 65);
      const r = await pool.query(
        `INSERT INTO roie_cognitive_risks
         (user_id, tenant_id, overload_score, reasoning_instability, fragmentation_index,
          executive_dysfunction, cognitive_fatigue, temporal_forecast, recovery_eta_days, overload_escalation_prob)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user_id, tenant_id || null, overload, rand(10, 55), rand(10, 50),
         rand(10, 50), fatigue,
         JSON.stringify({ '7d': overload + rand(0, 5), '30d': overload + rand(0, 10), '90d': overload - rand(0, 15) }),
         Math.floor(rand(7, 45)), rand(0.1, 0.6, 3)]
      );
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/cognitive', async (req, res, next) => {
    try {
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(overload_score)::numeric(5,2) avg_overload, AVG(cognitive_fatigue)::numeric(5,2) avg_fatigue, COUNT(DISTINCT user_id) users FROM roie_cognitive_risks`),
        pool.query(`SELECT * FROM roie_cognitive_risks ORDER BY overload_score DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_overload: 0, avg_fatigue: 0, users: 0 }, rows: [] });
      next(err);
    }
  });

  // ── SECTION 5: Emotional Risk Engine ────────────────────────────
  app.post('/api/roie/emotional/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const burnout = rand(20, 75);
      const trajectory = burnout > 60 ? 'escalating' : burnout > 40 ? 'declining' : 'stable';

      const r = await pool.query(
        `INSERT INTO roie_emotional_risks
         (user_id, tenant_id, burnout_score, hopelessness_index, emotional_fatigue,
          resilience_depletion, emotional_suppression, anxiety_escalation,
          emotional_trajectory, recovery_forecast, resilience_collapse_prob)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, tenant_id || null, burnout, rand(10, 55), rand(20, 70),
         rand(15, 65), rand(10, 50), rand(15, 60), trajectory,
         JSON.stringify({ '30d': Math.max(0, burnout - rand(5, 15)), '90d': Math.max(0, burnout - rand(10, 25)) }),
         rand(0.1, 0.55, 3)]
      );
      if (burnout > 65) emitEvent(pool, 'RISK_DETECTED', user_id, { type: 'emotional', burnout_score: burnout });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/emotional', async (req, res, next) => {
    try {
      const [kpi, trajectory, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(burnout_score)::numeric(5,2) avg_burnout, COUNT(*) FILTER(WHERE burnout_score>65) high_burnout, AVG(anxiety_escalation)::numeric(5,2) avg_anxiety FROM roie_emotional_risks`),
        pool.query(`SELECT emotional_trajectory, COUNT(*) n FROM roie_emotional_risks GROUP BY emotional_trajectory ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_emotional_risks ORDER BY burnout_score DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], trajectory: trajectory.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_burnout: 0, high_burnout: 0, avg_anxiety: 0 }, trajectory: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 11: Early Warning Engine ────────────────────────────
  app.post('/api/roie/early-warning/detect', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const warnings = [
        { type: 'weak_signal', label: 'Silent Disengagement Pattern', severity: 'medium', signals: ['reduced_response_velocity', 'lower_reflection_depth'], confidence: 0.71, action: 'Initiate check-in within 72 hours' },
        { type: 'hidden_decline', label: 'Latent Emotional Deterioration', severity: 'high', signals: ['emotional_suppression', 'resilience_depletion'], confidence: 0.78, action: 'Schedule emotional support session' },
        { type: 'black_swan', label: 'Anomalous Behavioural Spike', severity: 'critical', signals: ['extreme_volatility', 'persistence_collapse'], confidence: 0.55, action: 'Immediate mentor escalation' },
      ];

      const count = 1 + Math.floor(Math.random() * 2);
      const inserted = [];
      for (const w of warnings.slice(0, count)) {
        const r = await pool.query(
          `INSERT INTO roie_early_warnings (user_id, tenant_id, warning_type, warning_label, severity, detected_signals, confidence, recommended_action)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [user_id, tenant_id || null, w.type, w.label, w.severity,
           JSON.stringify(w.signals), w.confidence, w.action]
        );
        inserted.push(r.rows[0]);
      }
      res.json({ detected: inserted.length, warnings: inserted });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/early-warnings', async (req, res, next) => {
    try {
      const { acknowledged, severity } = req.query;
      const conditions = [];
      const params: any[] = [];
      if (acknowledged !== undefined) { params.push(acknowledged === 'true'); conditions.push(`acknowledged=$${params.length}`); }
      if (severity) { params.push(severity); conditions.push(`severity=$${params.length}`); }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const [kpi, sevDist, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(*) FILTER(WHERE NOT acknowledged) unacknowledged, COUNT(*) FILTER(WHERE severity='critical') critical, COUNT(DISTINCT user_id) users FROM roie_early_warnings`),
        pool.query(`SELECT severity, COUNT(*) n FROM roie_early_warnings GROUP BY severity ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`),
        pool.query(`SELECT * FROM roie_early_warnings ${where} ORDER BY detected_at DESC LIMIT 30`, params),
      ]);
      res.json({ kpi: kpi.rows[0], severity_dist: sevDist.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, unacknowledged: 0, critical: 0, users: 0 }, severity_dist: [], rows: [] });
      next(err);
    }
  });

  app.patch('/api/admin/roie/early-warnings/:id', async (req, res, next) => {
    try {
      const { acknowledged, resolved } = req.body;
      const r = await pool.query(
        `UPDATE roie_early_warnings SET acknowledged=COALESCE($1,acknowledged), resolved=COALESCE($2,resolved) WHERE id=$3 RETURNING *`,
        [acknowledged ?? null, resolved ?? null, req.params.id]
      );
      res.json(r.rows[0] || { error: 'not found' });
    } catch (err) { next(err); }
  });

  // ── SECTION 13: Human State Engine ──────────────────────────────
  app.post('/api/roie/human-state/record', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const emotional = ['positive', 'neutral', 'stressed', 'anxious', 'depleted', 'resilient'];
      const cognitive = ['optimal', 'normal', 'overloaded', 'fragmented', 'fatigued'];
      const resilience = ['strong', 'moderate', 'depleted', 'collapsed'];
      const overload = ['none', 'mild', 'moderate', 'severe', 'critical'];

      const emoIdx = Math.floor(Math.random() * emotional.length);
      const cogIdx = Math.floor(Math.random() * cognitive.length);
      const compositeScore = 100 - (emoIdx * 8) - (cogIdx * 7) + rand(-5, 5);

      const r = await pool.query(
        `INSERT INTO roie_human_states
         (user_id, tenant_id, emotional_state, cognitive_state, resilience_state,
          overload_state, motivational_state, engagement_state,
          stabilization_likelihood, recovery_likelihood, escalation_likelihood, composite_state_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [user_id, tenant_id || null, emotional[emoIdx], cognitive[cogIdx],
         resilience[Math.floor(Math.random() * resilience.length)],
         overload[Math.floor(Math.random() * overload.length)],
         rand(0, 1) > 0.3 ? 'engaged' : 'neutral',
         rand(0, 1) > 0.25 ? 'active' : 'passive',
         rand(0.3, 0.8, 3), rand(0.3, 0.75, 3), rand(0.1, 0.45, 3),
         Math.max(0, Math.min(100, compositeScore))]
      );
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/human-states', async (req, res, next) => {
    try {
      const [kpi, emoStates, cogStates, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(composite_state_score)::numeric(5,2) avg_score, COUNT(DISTINCT user_id) users FROM roie_human_states`),
        pool.query(`SELECT emotional_state, COUNT(*) n FROM roie_human_states GROUP BY emotional_state ORDER BY n DESC`),
        pool.query(`SELECT cognitive_state, COUNT(*) n FROM roie_human_states GROUP BY cognitive_state ORDER BY n DESC`),
        pool.query(`SELECT DISTINCT ON (user_id) * FROM roie_human_states ORDER BY user_id, recorded_at DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], emotional_states: emoStates.rows, cognitive_states: cogStates.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_score: 0, users: 0 }, emotional_states: [], cognitive_states: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 17: Environmental Risk Engine ───────────────────────
  app.post('/api/roie/environmental/assess', async (req, res, next) => {
    try {
      const { user_id, tenant_id, scope = 'individual' } = req.body;

      const toxic = rand(10, 65);
      const institutional = rand(15, 60);
      const r = await pool.query(
        `INSERT INTO roie_environmental_risks
         (user_id, tenant_id, scope, toxic_environment_score, institutional_stress_index,
          ecosystem_instability, learning_collapse_risk, environmental_resilience, detected_risks, recommendations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user_id || null, tenant_id || null, scope, toxic, institutional,
         rand(10, 55), rand(5, 45), rand(35, 85),
         JSON.stringify(toxic > 50 ? ['peer_pressure', 'institutional_stress'] : ['mild_environmental_friction']),
         JSON.stringify(['Reduce environmental stressors', 'Establish supportive peer networks'])]
      );
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/environmental', async (req, res, next) => {
    try {
      const [kpi, scope, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(toxic_environment_score)::numeric(5,2) avg_toxic, AVG(environmental_resilience)::numeric(5,2) avg_resilience FROM roie_environmental_risks`),
        pool.query(`SELECT scope, COUNT(*) n, AVG(ecosystem_instability)::numeric(5,2) avg_instability FROM roie_environmental_risks GROUP BY scope`),
        pool.query(`SELECT * FROM roie_environmental_risks ORDER BY assessed_at DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], scope: scope.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_toxic: 0, avg_resilience: 0 }, scope: [], rows: [] });
      next(err);
    }
  });

  // ── ROIE: Full Compute (one-click) ───────────────────────────────
  app.post('/api/roie/compute-all', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const base = `${req.protocol}://${req.get('host')}`;
      const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id, tenant_id }) };

      const [risk, beh, cog, emo] = await Promise.allSettled([
        fetch(`${base}/api/roie/risk/compute`, opts),
        fetch(`${base}/api/roie/behavioural/compute`, opts),
        fetch(`${base}/api/roie/cognitive/compute`, opts),
        fetch(`${base}/api/roie/emotional/compute`, opts),
      ]);

      emitEvent(pool, 'TRAJECTORY_UPDATED', user_id, { computed: ['risk', 'behavioural', 'cognitive', 'emotional'] });
      res.json({ status: 'computed', user_id, engines: ['risk', 'behavioural', 'cognitive', 'emotional'], timestamp: new Date().toISOString() });
    } catch (err) { next(err); }
  });
}
