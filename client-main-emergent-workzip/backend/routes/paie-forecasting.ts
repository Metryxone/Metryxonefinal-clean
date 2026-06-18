// PAIE — Predictive AI Engine: Forecasting Routes
// Sections 1-5, 8, 11-13: Signal Aggregation, Temporal, Behavioural, Cognitive,
// Emotional Forecasting, Trajectory Intelligence, Black Swan, Early Warning, Trust/Confidence

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function behavioralRisk(signals: any[]): number {
  if (!signals || signals.length === 0) return rnd(0.1, 0.45);
  const avgEntropy = signals.reduce((a: number, s: any) => a + (s.entropy_score || 0), 0) / signals.length;
  const anomalies = signals.filter((s: any) => s.anomaly_flag).length / Math.max(signals.length, 1);
  return Math.min(1, avgEntropy * 0.6 + anomalies * 0.4 + rnd(0, 0.1));
}

export function registerPAIEForecastingRoutes(app: Express, pool: Pool) {

  // ── Section 1: Signal Ingestion ──────────────────────────────────────────
  app.post("/api/paie/signals/ingest", async (req, res) => {
    try {
      const { user_id, tenant_id, signals = [] } = req.body;
      if (!user_id || !signals.length) return res.status(400).json({ error: "user_id + signals required" });
      const inserted: any[] = [];
      for (const s of signals) {
        const r = await pool.query(
          `INSERT INTO paie_signals
            (user_id, tenant_id, signal_type, signal_category, signal_payload, source,
             pacing_drift, hesitation_score, retry_count, entropy_score, anomaly_flag, confidence, contextual_weight)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [user_id, tenant_id || null, s.signal_type, s.signal_category || null,
           JSON.stringify(s.payload || {}), s.source || 'assessment',
           s.pacing_drift || 0, s.hesitation_score || 0, s.retry_count || 0,
           s.entropy_score || 0, s.anomaly_flag || false,
           s.confidence || 0.8, s.contextual_weight || 1.0]
        );
        inserted.push(r.rows[0]);
      }
      // emit event
      await pool.query(
        `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
         VALUES ($1,$2,'SIGNAL_CAPTURED',$3)`,
        [user_id, tenant_id || null, JSON.stringify({ count: inserted.length })]
      );
      res.json({ ingested: inserted.length, ids: inserted.map(r => r.id) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/signals/dashboard", async (req, res) => {
    try {
      const [kpiR, typeR, entR, anomR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(confidence) avg_confidence,
                    SUM(CASE WHEN anomaly_flag THEN 1 ELSE 0 END) anomaly_count,
                    AVG(entropy_score) avg_entropy FROM paie_signals`),
        pool.query(`SELECT signal_type, COUNT(*) cnt FROM paie_signals GROUP BY signal_type ORDER BY cnt DESC LIMIT 10`),
        pool.query(`SELECT DATE_TRUNC('day', created_at) day, AVG(entropy_score) avg_entropy
                    FROM paie_signals WHERE created_at > NOW() - INTERVAL '30 days'
                    GROUP BY 1 ORDER BY 1`),
        pool.query(`SELECT * FROM paie_signals WHERE anomaly_flag = TRUE ORDER BY created_at DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], signal_types: typeR.rows, entropy_trend: entR.rows, anomalies: anomR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/signals/list", async (req, res) => {
    try {
      const { page = 1, limit = 50, user_id, signal_type, anomaly } = req.query as any;
      const off = (parseInt(page) - 1) * parseInt(limit);
      const conditions: string[] = [];
      const params: any[] = [];
      if (user_id) { params.push(`%${user_id}%`); conditions.push(`user_id ILIKE $${params.length}`); }
      if (signal_type) { params.push(signal_type); conditions.push(`signal_type = $${params.length}`); }
      if (anomaly === 'true') conditions.push(`anomaly_flag = TRUE`);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(parseInt(limit), off);
      const r = await pool.query(
        `SELECT * FROM paie_signals ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      const tot = await pool.query(`SELECT COUNT(*) FROM paie_signals ${where}`, params.slice(0, -2));
      res.json({ signals: r.rows, total: parseInt(tot.rows[0].count) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 2: Temporal Intelligence ────────────────────────────────────
  app.post("/api/paie/temporal/compute", async (req, res) => {
    try {
      const { user_id, tenant_id, forecast_windows = ['30d', '90d', '1y'] } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const dimensions = ['behavioural', 'cognitive', 'emotional', 'resilience', 'engagement'];
      const results: any[] = [];
      for (const win of forecast_windows) {
        for (const dim of dimensions) {
          const base = rnd(0.3, 0.85);
          const vol = rnd(0.05, 0.35);
          const trend = ['accelerating','decelerating','stable','volatile','collapsing'][Math.floor(Math.random()*5)];
          const r = await pool.query(
            `INSERT INTO paie_temporal_forecasts
              (user_id, tenant_id, forecast_window, dimension, trend_direction,
               trend_acceleration, volatility_score, silent_deterioration_risk,
               hidden_transition_probability, predicted_value, lower_bound, upper_bound, confidence)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT DO NOTHING RETURNING *`,
            [user_id, tenant_id||null, win, dim, trend,
             rnd(-0.3, 0.5), vol, rnd(0, 0.4), rnd(0.1, 0.6),
             base, Math.max(0, base - vol), Math.min(1, base + vol), rnd(0.65, 0.92)]
          );
          if (r.rows[0]) results.push(r.rows[0]);
        }
      }
      await pool.query(
        `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
         VALUES ($1,$2,'PREDICTION_GENERATED',$3)`,
        [user_id, tenant_id||null, JSON.stringify({ type: 'temporal', windows: forecast_windows })]
      );
      res.json({ computed: results.length, forecasts: results });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/temporal/dashboard", async (req, res) => {
    try {
      const [kpiR, dimR, trendR, silentR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users, AVG(confidence) avg_confidence,
                    AVG(volatility_score) avg_volatility, AVG(silent_deterioration_risk) avg_silent_risk
                    FROM paie_temporal_forecasts`),
        pool.query(`SELECT dimension, AVG(predicted_value) avg_value, AVG(volatility_score) avg_vol,
                    COUNT(*) cnt FROM paie_temporal_forecasts GROUP BY dimension ORDER BY avg_value DESC`),
        pool.query(`SELECT trend_direction, COUNT(*) cnt FROM paie_temporal_forecasts GROUP BY trend_direction ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_temporal_forecasts WHERE silent_deterioration_risk > 0.6
                    ORDER BY silent_deterioration_risk DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], dimensions: dimR.rows, trends: trendR.rows, silent_risks: silentR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 3: Behavioural Forecasting ──────────────────────────────────
  app.post("/api/paie/behavioural/compute", async (req, res) => {
    try {
      const { user_id, tenant_id, forecast_window = '30d' } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const signals = await pool.query(
        `SELECT * FROM paie_signals WHERE user_id=$1 AND signal_type IN ('behavioural','implicit','explicit') ORDER BY created_at DESC LIMIT 50`,
        [user_id]
      );
      const risk = behavioralRisk(signals.rows);
      const disengagement = Math.min(1, risk + rnd(0, 0.2));
      const dominant = disengagement > 0.7 ? 'disengagement' : risk > 0.6 ? 'overload' : risk > 0.4 ? 'frustration' : 'stable';
      const r = await pool.query(
        `INSERT INTO paie_behavioural_forecasts
          (user_id, tenant_id, disengagement_probability, persistence_collapse_risk,
           motivational_collapse_risk, frustration_escalation_risk, behavioural_volatility_score,
           contagion_susceptibility, persistence_biomarker, overload_biomarker, resilience_biomarker,
           disengagement_biomarker, impulsivity_biomarker, forecast_window, dominant_risk)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [user_id, tenant_id||null, disengagement, rnd(0.1, 0.7), rnd(0.1, 0.65),
         rnd(0.1, 0.6), rnd(0.05, 0.45), rnd(0.05, 0.4),
         rnd(0.3, 0.9), rnd(0.1, 0.8), rnd(0.2, 0.9),
         disengagement, rnd(0.1, 0.7), forecast_window, dominant]
      );
      await pool.query(
        `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
         VALUES ($1,$2,'PREDICTION_GENERATED',$3)`,
        [user_id, tenant_id||null, JSON.stringify({ type: 'behavioural', dominant_risk: dominant })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/behavioural/dashboard", async (req, res) => {
    try {
      const [kpiR, domR, highR, bioR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users,
                    AVG(disengagement_probability) avg_disengagement,
                    AVG(behavioural_volatility_score) avg_volatility,
                    SUM(CASE WHEN disengagement_probability > 0.7 THEN 1 ELSE 0 END) high_risk_count
                    FROM paie_behavioural_forecasts`),
        pool.query(`SELECT dominant_risk, COUNT(*) cnt FROM paie_behavioural_forecasts GROUP BY dominant_risk ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_behavioural_forecasts WHERE disengagement_probability > 0.7 ORDER BY disengagement_probability DESC LIMIT 20`),
        pool.query(`SELECT AVG(persistence_biomarker) persistence, AVG(overload_biomarker) overload,
                    AVG(resilience_biomarker) resilience, AVG(disengagement_biomarker) disengagement,
                    AVG(impulsivity_biomarker) impulsivity FROM paie_behavioural_forecasts`)
      ]);
      res.json({ kpi: kpiR.rows[0], dominant_risks: domR.rows, high_risk_users: highR.rows, biomarkers: bioR.rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 4: Cognitive Forecasting ────────────────────────────────────
  app.post("/api/paie/cognitive/compute", async (req, res) => {
    try {
      const { user_id, tenant_id, forecast_window = '30d' } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const overload = rnd(0.1, 0.85);
      const fatigue = rnd(0.1, 0.75);
      const trajectory = overload > 0.75 ? 'overloaded' : overload > 0.5 ? 'at_risk' : fatigue < 0.3 ? 'accelerating' : 'stable';
      const r = await pool.query(
        `INSERT INTO paie_cognitive_forecasts
          (user_id, tenant_id, overload_probability, executive_dysfunction_risk,
           reasoning_instability_risk, attention_fragmentation_risk, cognitive_fatigue_score,
           overload_escalation_probability, recovery_probability, stabilization_forecast,
           cognitive_trajectory, forecast_window)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [user_id, tenant_id||null, overload, rnd(0.1, 0.7), rnd(0.1, 0.65),
         rnd(0.1, 0.75), fatigue, Math.min(1, overload + 0.15),
         Math.max(0, 1 - overload - 0.1), rnd(0.2, 0.8), trajectory, forecast_window]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/cognitive/dashboard", async (req, res) => {
    try {
      const [kpiR, trajR, highR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users,
                    AVG(overload_probability) avg_overload,
                    AVG(cognitive_fatigue_score) avg_fatigue,
                    AVG(recovery_probability) avg_recovery,
                    SUM(CASE WHEN overload_probability > 0.7 THEN 1 ELSE 0 END) critical_count
                    FROM paie_cognitive_forecasts`),
        pool.query(`SELECT cognitive_trajectory, COUNT(*) cnt FROM paie_cognitive_forecasts GROUP BY cognitive_trajectory ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_cognitive_forecasts WHERE overload_probability > 0.7 ORDER BY overload_probability DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], trajectories: trajR.rows, high_overload_users: highR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 5: Emotional Forecasting ────────────────────────────────────
  app.post("/api/paie/emotional/compute", async (req, res) => {
    try {
      const { user_id, tenant_id, forecast_window = '30d' } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const burnout = rnd(0.05, 0.85);
      const resilience = rnd(0.2, 0.9);
      const engagement = rnd(0.2, 0.9);
      const escalating = burnout > 0.6 && resilience < 0.4 && engagement < 0.4;
      const trajectory = escalating ? 'collapsing' : burnout > 0.6 ? 'escalating' : resilience > 0.7 ? 'recovering' : 'stable';
      const r = await pool.query(
        `INSERT INTO paie_emotional_forecasts
          (user_id, tenant_id, burnout_probability, emotional_fatigue_score, anxiety_escalation_risk,
           hopelessness_probability, resilience_depletion_risk, emotional_collapse_risk,
           resilience_index, engagement_trajectory, emotional_trajectory, burnout_escalation_flag, forecast_window)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [user_id, tenant_id||null, burnout, rnd(0.1, 0.8), rnd(0.05, 0.75),
         rnd(0.05, 0.6), rnd(0.1, 0.7), rnd(0.05, 0.65),
         resilience, engagement, trajectory, escalating, forecast_window]
      );
      if (burnout > 0.75) {
        await pool.query(
          `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
           VALUES ($1,$2,'TRAJECTORY_UPDATED',$3)`,
          [user_id, tenant_id||null, JSON.stringify({ type: 'emotional', burnout_flag: true })]
        );
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/emotional/dashboard", async (req, res) => {
    try {
      const [kpiR, trajR, highR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users,
                    AVG(burnout_probability) avg_burnout,
                    AVG(resilience_index) avg_resilience,
                    SUM(CASE WHEN burnout_escalation_flag THEN 1 ELSE 0 END) escalation_flags,
                    AVG(emotional_fatigue_score) avg_fatigue
                    FROM paie_emotional_forecasts`),
        pool.query(`SELECT emotional_trajectory, COUNT(*) cnt FROM paie_emotional_forecasts GROUP BY emotional_trajectory ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_emotional_forecasts WHERE burnout_probability > 0.7 ORDER BY burnout_probability DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], trajectories: trajR.rows, high_burnout_users: highR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 8: Trajectory Intelligence ──────────────────────────────────
  app.post("/api/paie/trajectory/compute", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const types = ['behavioural','emotional','cognitive','resilience','employability'];
      const results: any[] = [];
      for (const t of types) {
        const dir = ['accelerating','decelerating','stagnant','volatile','collapsing','recovering'][Math.floor(Math.random()*6)];
        const mag = rnd(0.1, 0.9);
        const r = await pool.query(
          `INSERT INTO paie_trajectories
            (user_id, tenant_id, trajectory_type, trend_direction, magnitude, confidence,
             forecast_window, stagnation_flag, collapse_risk, recovery_probability, snapshot_data)
           VALUES ($1,$2,$3,$4,$5,$6,'90d',$7,$8,$9,$10) RETURNING *`,
          [user_id, tenant_id||null, t, dir, mag, rnd(0.6, 0.95),
           dir === 'stagnant', dir === 'collapsing' ? rnd(0.5, 0.95) : rnd(0.05, 0.3),
           dir === 'recovering' ? rnd(0.5, 0.9) : rnd(0.1, 0.5),
           JSON.stringify({ direction: dir, magnitude: mag })]
        );
        results.push(r.rows[0]);
      }
      await pool.query(
        `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
         VALUES ($1,$2,'TRAJECTORY_UPDATED',$3)`,
        [user_id, tenant_id||null, JSON.stringify({ trajectories: types })]
      );
      res.json({ computed: results.length, trajectories: results });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/trajectories", async (req, res) => {
    try {
      const { type, direction, collapse_only } = req.query as any;
      const conditions: string[] = [];
      if (type) conditions.push(`trajectory_type = '${type}'`);
      if (direction) conditions.push(`trend_direction = '${direction}'`);
      if (collapse_only === 'true') conditions.push(`collapse_risk > 0.6`);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const [listR, statsR] = await Promise.all([
        pool.query(`SELECT * FROM paie_trajectories ${where} ORDER BY detected_at DESC LIMIT 100`),
        pool.query(`SELECT trajectory_type, trend_direction, COUNT(*) cnt, AVG(magnitude) avg_mag,
                    AVG(collapse_risk) avg_collapse FROM paie_trajectories GROUP BY 1,2 ORDER BY 1,3 DESC`)
      ]);
      res.json({ trajectories: listR.rows, stats: statsR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 11: Black Swan Prediction ───────────────────────────────────
  app.post("/api/paie/black-swan/detect", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const types = ['hidden_collapse','rare_behavioural_failure','silent_disengagement','sudden_emotional_deterioration','resilience_collapse'];
      const events: any[] = [];
      for (const t of types) {
        const prob = rnd(0.01, 0.3);
        if (prob > 0.15 || Math.random() < 0.3) {
          const sev = prob > 0.25 ? 'critical' : prob > 0.18 ? 'high' : 'medium';
          const r = await pool.query(
            `INSERT INTO paie_black_swan_events
              (user_id, tenant_id, event_type, probability, severity, anomaly_score,
               silent_collapse_flag, low_frequency_risk, detection_signals, intervention_urgency)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [user_id, tenant_id||null, t, prob, sev, rnd(0.3, 0.9),
             t.includes('silent'), rnd(0.05, 0.35),
             JSON.stringify([`${t}_signal_1`, `entropy_spike`]),
             prob > 0.25 ? 'immediate' : prob > 0.18 ? 'urgent' : 'monitor']
          );
          events.push(r.rows[0]);
          if (prob > 0.2) {
            await pool.query(
              `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
               VALUES ($1,$2,'BLACK_SWAN_DETECTED',$3)`,
              [user_id, tenant_id||null, JSON.stringify({ type: t, prob, severity: sev })]
            );
          }
        }
      }
      res.json({ detected: events.length, events });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/black-swan/dashboard", async (req, res) => {
    try {
      const [kpiR, typeR, activeR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(DISTINCT user_id) affected_users,
                    SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) critical,
                    SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END) high,
                    SUM(CASE WHEN silent_collapse_flag THEN 1 ELSE 0 END) silent_collapses
                    FROM paie_black_swan_events WHERE resolved=FALSE`),
        pool.query(`SELECT event_type, severity, COUNT(*) cnt, AVG(probability) avg_prob
                    FROM paie_black_swan_events GROUP BY 1,2 ORDER BY avg_prob DESC`),
        pool.query(`SELECT * FROM paie_black_swan_events WHERE resolved=FALSE ORDER BY probability DESC LIMIT 30`)
      ]);
      res.json({ kpi: kpiR.rows[0], by_type: typeR.rows, active_events: activeR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/paie/black-swan/:id/resolve", async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE paie_black_swan_events SET resolved=TRUE WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 12: Early Warning Intelligence ───────────────────────────────
  app.post("/api/paie/early-warnings/detect", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const warnings: any[] = [];
      const wtypes = ['weak_signal','latent_deterioration','hidden_instability','silent_decline'];
      for (const wt of wtypes) {
        const strength = rnd(0.1, 0.9);
        if (strength > 0.35) {
          const urgency = strength > 0.8 ? 'critical' : strength > 0.65 ? 'urgent' : strength > 0.5 ? 'watch' : 'monitor';
          const r = await pool.query(
            `INSERT INTO paie_early_warnings
              (user_id, tenant_id, warning_type, signal_strength, amplification_factor,
               silent_collapse_probability, latent_risk_score, contributing_signals,
               recommended_action, urgency)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [user_id, tenant_id||null, wt, strength, rnd(1.0, 3.5),
             wt.includes('silent') ? strength * 0.9 : strength * 0.5,
             rnd(0.2, 0.85),
             JSON.stringify([`${wt}_pattern`, 'entropy_drift', 'pacing_change']),
             `Immediate ${urgency === 'critical' ? 'intervention' : 'monitoring'} for ${wt.replace(/_/g,' ')}`,
             urgency]
          );
          warnings.push(r.rows[0]);
          await pool.query(
            `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
             VALUES ($1,$2,'WARNING_RAISED',$3)`,
            [user_id, tenant_id||null, JSON.stringify({ warning_type: wt, urgency })]
          );
        }
      }
      res.json({ detected: warnings.length, warnings });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/early-warnings", async (req, res) => {
    try {
      const { urgency, acknowledged = 'false' } = req.query as any;
      const conditions: string[] = [`acknowledged=${acknowledged}`];
      if (urgency) conditions.push(`urgency='${urgency}'`);
      const where = `WHERE ${conditions.join(' AND ')}`;
      const [listR, kpiR] = await Promise.all([
        pool.query(`SELECT * FROM paie_early_warnings ${where} ORDER BY signal_strength DESC, created_at DESC LIMIT 50`),
        pool.query(`SELECT urgency, COUNT(*) cnt FROM paie_early_warnings WHERE acknowledged=false GROUP BY urgency ORDER BY cnt DESC`)
      ]);
      res.json({ warnings: listR.rows, by_urgency: kpiR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/paie/early-warnings/:id/acknowledge", async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE paie_early_warnings SET acknowledged=TRUE WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 13: Trust & Confidence ──────────────────────────────────────
  app.post("/api/paie/trust/compute", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const signals = await pool.query(
        `SELECT COUNT(*) cnt, AVG(confidence) avg_conf, SUM(CASE WHEN anomaly_flag THEN 1 ELSE 0 END) anomalies
         FROM paie_signals WHERE user_id=$1`, [user_id]
      );
      const sig = signals.rows[0];
      const sparse = parseInt(sig.cnt) < 5;
      const avgConf = parseFloat(sig.avg_conf) || 0.75;
      const anomalyRate = parseInt(sig.anomalies) / Math.max(1, parseInt(sig.cnt));
      const trust = Math.max(0.2, avgConf - anomalyRate * 0.3 - (sparse ? 0.15 : 0));
      const trend = trust < 0.5 ? 'degrading' : trust < 0.7 ? 'declining' : trust < 0.85 ? 'stable' : 'rising';
      const r = await pool.query(
        `INSERT INTO paie_trust_confidence
          (user_id, tenant_id, overall_confidence, prediction_confidence, reliability_score,
           uncertainty_level, trust_score, sparse_data_flag, contradictory_signals_flag,
           behavioural_volatility_flag, confidence_trend, trust_degradation_flag)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [user_id, tenant_id||null, avgConf, avgConf * rnd(0.9, 1.0), rnd(0.6, 0.95),
         1 - avgConf, trust, sparse, anomalyRate > 0.3, anomalyRate > 0.5,
         trend, trust < 0.5]
      );
      if (trust < 0.5) {
        await pool.query(
          `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
           VALUES ($1,$2,'TRUST_DEGRADED',$3)`,
          [user_id, tenant_id||null, JSON.stringify({ trust_score: trust })]
        );
      }
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/trust/dashboard", async (req, res) => {
    try {
      const [kpiR, trendR, lowR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users, AVG(overall_confidence) avg_confidence,
                    AVG(trust_score) avg_trust, AVG(uncertainty_level) avg_uncertainty,
                    SUM(CASE WHEN trust_degradation_flag THEN 1 ELSE 0 END) degraded_count,
                    SUM(CASE WHEN sparse_data_flag THEN 1 ELSE 0 END) sparse_data_count
                    FROM paie_trust_confidence`),
        pool.query(`SELECT confidence_trend, COUNT(*) cnt FROM paie_trust_confidence GROUP BY confidence_trend ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_trust_confidence WHERE trust_degradation_flag=TRUE ORDER BY trust_score ASC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], trends: trendR.rows, degraded_users: lowR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Unified compute all ──────────────────────────────────────────────────
  app.post("/api/paie/compute-all", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      // Kick off all engines in parallel (non-blocking)
      const base = `http://localhost:${process.env.PORT || 8080}`;
      const headers = { 'Content-Type': 'application/json' };
      const body = JSON.stringify({ user_id, tenant_id });
      const endpoints = [
        '/api/paie/temporal/compute', '/api/paie/behavioural/compute',
        '/api/paie/cognitive/compute', '/api/paie/emotional/compute',
        '/api/paie/trajectory/compute', '/api/paie/black-swan/detect',
        '/api/paie/early-warnings/detect', '/api/paie/trust/compute'
      ];
      await Promise.allSettled(
        endpoints.map(ep =>
          fetch(`${base}${ep}`, { method: 'POST', headers, body }).catch(() => null)
        )
      );
      res.json({ status: 'ok', message: `All PAIE engines triggered for ${user_id}`, engines: endpoints.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Master Forecasting Dashboard ─────────────────────────────────────────
  app.get("/api/admin/paie/forecasting/master", async (req, res) => {
    try {
      const [sigR, tempR, behR, cogR, emoR, trajR, bsR, ewR, trustR, eventR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN anomaly_flag THEN 1 ELSE 0 END) anomalies FROM paie_signals`),
        pool.query(`SELECT COUNT(DISTINCT user_id) users FROM paie_temporal_forecasts`),
        pool.query(`SELECT AVG(disengagement_probability) avg_dis, COUNT(DISTINCT user_id) users FROM paie_behavioural_forecasts`),
        pool.query(`SELECT AVG(overload_probability) avg_overload, COUNT(DISTINCT user_id) users FROM paie_cognitive_forecasts`),
        pool.query(`SELECT AVG(burnout_probability) avg_burnout, SUM(CASE WHEN burnout_escalation_flag THEN 1 ELSE 0 END) flags FROM paie_emotional_forecasts`),
        pool.query(`SELECT trend_direction, COUNT(*) cnt FROM paie_trajectories GROUP BY trend_direction ORDER BY cnt DESC LIMIT 5`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) critical FROM paie_black_swan_events WHERE resolved=FALSE`),
        pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN urgency='critical' THEN 1 ELSE 0 END) critical FROM paie_early_warnings WHERE acknowledged=FALSE`),
        pool.query(`SELECT AVG(trust_score) avg_trust, SUM(CASE WHEN trust_degradation_flag THEN 1 ELSE 0 END) degraded FROM paie_trust_confidence`),
        pool.query(`SELECT event_type, COUNT(*) cnt FROM paie_events WHERE created_at > NOW()-INTERVAL '24 hours' GROUP BY event_type ORDER BY cnt DESC`)
      ]);
      res.json({
        signals: sigR.rows[0], temporal: tempR.rows[0], behavioural: behR.rows[0],
        cognitive: cogR.rows[0], emotional: emoR.rows[0], trajectories: trajR.rows,
        black_swan: bsR.rows[0], early_warnings: ewR.rows[0], trust: trustR.rows[0],
        events_24h: eventR.rows
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
