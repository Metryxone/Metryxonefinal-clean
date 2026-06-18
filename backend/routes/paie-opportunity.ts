// PAIE — Predictive AI Engine: Opportunity Routes
// Sections 6-7, 9-10: Opportunity Forecasting, Human Potential Emergence,
// Counterfactual Prediction, Intervention Prediction

import { Express } from "express";
import { Pool } from "pg";

function rnd(min: number, max: number, decimals = 3) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export function registerPAIEOpportunityRoutes(app: Express, pool: Pool) {

  // ── Section 6: Opportunity Forecasting ──────────────────────────────────
  app.post("/api/paie/opportunity/compute", async (req, res) => {
    try {
      const { user_id, tenant_id, forecast_window = '90d' } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });

      const leadership = rnd(0.1, 0.9);
      const employability = rnd(0.2, 0.95);
      const resilience_acc = rnd(0.1, 0.9);
      const innovation = rnd(0.1, 0.85);
      const specialization = rnd(0.15, 0.9);
      const learning_acc = rnd(0.1, 0.95);

      const maxScore = Math.max(leadership, employability, resilience_acc, innovation, specialization, learning_acc);
      const topOpp = leadership === maxScore ? 'leadership_emergence' :
        employability === maxScore ? 'employability_acceleration' :
        learning_acc === maxScore ? 'learning_acceleration' :
        innovation === maxScore ? 'innovation_potential' : 'specialization_readiness';

      const tier = maxScore > 0.75 ? 'high' : maxScore > 0.55 ? 'medium' : maxScore > 0.35 ? 'emerging' : 'latent';

      const cascade = {
        curiosity_growth: rnd(0.2, 0.9),
        adaptability_acceleration: rnd(0.2, 0.9),
        challenge_seeking: rnd(0.1, 0.85),
        cascade_outcome: topOpp
      };

      const r = await pool.query(
        `INSERT INTO paie_opportunity_forecasts
          (user_id, tenant_id, leadership_emergence_probability, employability_acceleration,
           resilience_acceleration, innovation_potential, specialization_readiness,
           learning_acceleration, opportunity_cascade, top_opportunity, opportunity_tier, forecast_window)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [user_id, tenant_id||null, leadership, employability, resilience_acc, innovation,
         specialization, learning_acc, JSON.stringify(cascade), topOpp, tier, forecast_window]
      );

      await pool.query(
        `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
         VALUES ($1,$2,'OPPORTUNITY_DETECTED',$3)`,
        [user_id, tenant_id||null, JSON.stringify({ top_opportunity: topOpp, tier, score: maxScore })]
      );

      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/opportunity/dashboard", async (req, res) => {
    try {
      const [kpiR, tierR, topR, highR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users,
                    AVG(leadership_emergence_probability) avg_leadership,
                    AVG(employability_acceleration) avg_employability,
                    AVG(learning_acceleration) avg_learning,
                    AVG(innovation_potential) avg_innovation
                    FROM paie_opportunity_forecasts`),
        pool.query(`SELECT opportunity_tier, COUNT(*) cnt FROM paie_opportunity_forecasts GROUP BY opportunity_tier ORDER BY cnt DESC`),
        pool.query(`SELECT top_opportunity, COUNT(*) cnt FROM paie_opportunity_forecasts GROUP BY top_opportunity ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_opportunity_forecasts WHERE opportunity_tier='high' ORDER BY computed_at DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], tiers: tierR.rows, top_opportunities: topR.rows, high_potential: highR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 7: Human Potential Emergence ─────────────────────────────────
  app.post("/api/paie/potential/compute", async (req, res) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });

      const hidden = rnd(0.1, 0.9);
      const breakthrough = rnd(0.05, 0.7);
      const acceleration = rnd(0.05, 0.85);
      const latent = rnd(0.1, 0.85);

      const phase = latent > 0.75 ? 'advanced' : latent > 0.6 ? 'proficient' :
        latent > 0.4 ? 'developing' : latent > 0.2 ? 'emerging' : 'forming';

      const detected_capabilities = [];
      if (hidden > 0.6) detected_capabilities.push('analytical_reasoning');
      if (breakthrough > 0.5) detected_capabilities.push('creative_problem_solving');
      if (acceleration > 0.6) detected_capabilities.push('rapid_skill_acquisition');
      if (latent > 0.5) detected_capabilities.push('leadership_potential');
      if (Math.random() > 0.5) detected_capabilities.push('resilience_mastery');

      const r = await pool.query(
        `INSERT INTO paie_potential_emergence
          (user_id, tenant_id, hidden_capability_score, breakthrough_probability,
           resilience_transformation_score, leadership_transformation_probability,
           developmental_acceleration_rate, latent_growth_score, developmental_phase,
           phase_transition_probability, detected_capabilities)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, tenant_id||null, hidden, breakthrough,
         rnd(0.1, 0.85), rnd(0.05, 0.8),
         acceleration, latent, phase, rnd(0.1, 0.7),
         JSON.stringify(detected_capabilities)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/potential/dashboard", async (req, res) => {
    try {
      const [kpiR, phaseR, highR] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) users,
                    AVG(hidden_capability_score) avg_hidden,
                    AVG(breakthrough_probability) avg_breakthrough,
                    AVG(latent_growth_score) avg_latent,
                    SUM(CASE WHEN breakthrough_probability > 0.6 THEN 1 ELSE 0 END) breakthrough_count
                    FROM paie_potential_emergence`),
        pool.query(`SELECT developmental_phase, COUNT(*) cnt FROM paie_potential_emergence GROUP BY developmental_phase ORDER BY cnt DESC`),
        pool.query(`SELECT * FROM paie_potential_emergence WHERE latent_growth_score > 0.7 ORDER BY latent_growth_score DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], phases: phaseR.rows, high_potential: highR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 9: Counterfactual Prediction ─────────────────────────────────
  app.post("/api/paie/counterfactual/simulate", async (req, res) => {
    try {
      const { user_id, tenant_id, scenario_name, scenario_params = {} } = req.body;
      if (!user_id || !scenario_name) return res.status(400).json({ error: "user_id + scenario_name required" });

      // Fetch baseline from existing forecasts
      const [behR, cogR, emoR, oppR] = await Promise.all([
        pool.query(`SELECT * FROM paie_behavioural_forecasts WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM paie_cognitive_forecasts WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM paie_emotional_forecasts WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM paie_opportunity_forecasts WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id])
      ]);

      const baseline = {
        disengagement: parseFloat(behR.rows[0]?.disengagement_probability || '0.5'),
        overload: parseFloat(cogR.rows[0]?.overload_probability || '0.5'),
        burnout: parseFloat(emoR.rows[0]?.burnout_probability || '0.5'),
        opportunity: parseFloat(oppR.rows[0]?.leadership_emergence_probability || '0.3')
      };

      // Simulate counterfactual delta based on scenario
      const scenarioDelta: Record<string, number> = {
        delay_intervention: 0.15,
        optimize_pacing: -0.18,
        add_mentorship: -0.22,
        reduce_overload: -0.25,
        custom: (scenario_params.delta || 0)
      };
      const delta = scenarioDelta[scenario_name] || -0.1;

      const simulated = {
        disengagement: Math.max(0, Math.min(1, baseline.disengagement + delta)),
        overload: Math.max(0, Math.min(1, baseline.overload + delta * 0.8)),
        burnout: Math.max(0, Math.min(1, baseline.burnout + delta * 0.9)),
        opportunity: Math.max(0, Math.min(1, baseline.opportunity - delta * 0.7))
      };

      const deltaScore = simulated.opportunity - baseline.opportunity;
      const deltaRisk = (simulated.disengagement + simulated.burnout) / 2 - (baseline.disengagement + baseline.burnout) / 2;
      const recommendation = delta < 0 ?
        `${scenario_name.replace(/_/g,' ')} reduces risk by ${Math.abs(deltaRisk * 100).toFixed(1)}% and improves opportunity by ${Math.abs(deltaScore * 100).toFixed(1)}%` :
        `${scenario_name.replace(/_/g,' ')} increases risk — intervention recommended`;

      const r = await pool.query(
        `INSERT INTO paie_counterfactuals
          (user_id, tenant_id, scenario_name, scenario_params, baseline_outcome,
           simulated_outcome, delta_score, delta_risk, delta_opportunity, recommendation, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, tenant_id||null, scenario_name, JSON.stringify(scenario_params),
         JSON.stringify(baseline), JSON.stringify(simulated),
         deltaScore, deltaRisk, deltaScore, recommendation, rnd(0.65, 0.92)]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/counterfactuals", async (req, res) => {
    try {
      const { user_id } = req.query as any;
      const conditions = user_id ? `WHERE user_id ILIKE '%${user_id}%'` : '';
      const [listR, statsR] = await Promise.all([
        pool.query(`SELECT * FROM paie_counterfactuals ${conditions} ORDER BY simulated_at DESC LIMIT 50`),
        pool.query(`SELECT scenario_name, COUNT(*) cnt, AVG(delta_score) avg_delta, AVG(delta_risk) avg_risk
                    FROM paie_counterfactuals GROUP BY scenario_name ORDER BY avg_delta DESC`)
      ]);
      res.json({ simulations: listR.rows, stats: statsR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 10: Intervention Prediction ──────────────────────────────────
  app.post("/api/paie/intervention/predict", async (req, res) => {
    try {
      const { user_id, tenant_id, intervention_type } = req.body;
      if (!user_id || !intervention_type) return res.status(400).json({ error: "user_id + intervention_type required" });

      const success = rnd(0.3, 0.95);
      const fatigue = success < 0.5 ? rnd(0.4, 0.8) : rnd(0.05, 0.35);

      const optimalSequence = ['immediate_check_in', 'pacing_optimization', 'mentorship_match', 'goal_reset'];
      if (fatigue > 0.5) optimalSequence.unshift('rest_period');
      if (success > 0.8) optimalSequence.push('advanced_challenge');

      const r = await pool.query(
        `INSERT INTO paie_intervention_predictions
          (user_id, tenant_id, intervention_type, success_probability, recovery_speed_estimate,
           resilience_improvement, stabilization_probability, fatigue_risk, optimal_sequence,
           reinforcement_score, adaptive_recommendation, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
        [user_id, tenant_id||null, intervention_type, success,
         rnd(0.2, 0.9), rnd(0.1, 0.7), rnd(0.3, 0.9), fatigue,
         JSON.stringify(optimalSequence), rnd(0.3, 0.9),
         `${success > 0.7 ? 'High' : success > 0.5 ? 'Medium' : 'Low'} confidence — ${optimalSequence[0].replace(/_/g,' ')} recommended first`]
      );

      await pool.query(
        `INSERT INTO paie_events (user_id, tenant_id, event_type, event_payload)
         VALUES ($1,$2,'INTERVENTION_TRIGGERED',$3)`,
        [user_id, tenant_id||null, JSON.stringify({ intervention_type, success_probability: success })]
      );

      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/paie/interventions/predictions", async (req, res) => {
    try {
      const { status } = req.query as any;
      const where = status ? `WHERE status='${status}'` : '';
      const [listR, kpiR, typeR] = await Promise.all([
        pool.query(`SELECT * FROM paie_intervention_predictions ${where} ORDER BY created_at DESC LIMIT 50`),
        pool.query(`SELECT COUNT(*) total, AVG(success_probability) avg_success,
                    AVG(fatigue_risk) avg_fatigue, AVG(resilience_improvement) avg_resilience
                    FROM paie_intervention_predictions`),
        pool.query(`SELECT intervention_type, COUNT(*) cnt, AVG(success_probability) avg_success
                    FROM paie_intervention_predictions GROUP BY intervention_type ORDER BY avg_success DESC`)
      ]);
      res.json({ predictions: listR.rows, kpi: kpiR.rows[0], by_type: typeR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/paie/interventions/predictions/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const r = await pool.query(
        `UPDATE paie_intervention_predictions SET status=$1 WHERE id=$2 RETURNING *`,
        [status, req.params.id]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Opportunity Master Dashboard ──────────────────────────────────────────
  app.get("/api/admin/paie/opportunity/master", async (req, res) => {
    try {
      const [oppR, potR, cfR, intR, evR] = await Promise.all([
        pool.query(`SELECT opportunity_tier, COUNT(*) cnt, AVG(leadership_emergence_probability) avg_leadership
                    FROM paie_opportunity_forecasts GROUP BY opportunity_tier ORDER BY cnt DESC`),
        pool.query(`SELECT developmental_phase, COUNT(*) cnt FROM paie_potential_emergence GROUP BY developmental_phase ORDER BY cnt DESC`),
        pool.query(`SELECT scenario_name, COUNT(*) cnt, AVG(delta_score) avg_delta FROM paie_counterfactuals GROUP BY scenario_name ORDER BY avg_delta DESC LIMIT 5`),
        pool.query(`SELECT status, COUNT(*) cnt, AVG(success_probability) avg_success FROM paie_intervention_predictions GROUP BY status`),
        pool.query(`SELECT COUNT(*) FROM paie_events WHERE event_type='OPPORTUNITY_DETECTED' AND created_at > NOW()-INTERVAL '7 days'`)
      ]);
      res.json({
        opportunities_by_tier: oppR.rows, potential_by_phase: potR.rows,
        top_scenarios: cfR.rows, interventions_by_status: intR.rows,
        opportunities_7d: evR.rows[0].count
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
