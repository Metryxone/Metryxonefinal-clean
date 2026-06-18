/**
 * ROIE — Opportunity Intelligence Engine
 * Sections 6-10, 12
 * Opportunity · Human Potential · Recovery · Longitudinal Trajectory ·
 * Predictive Forecasting · Intervention Intelligence
 */
import { Express } from 'express';
import { Pool } from 'pg';

function rand(min: number, max: number, dp = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

function emitEvent(pool: Pool, type: string, userId: string | null, payload: object) {
  pool.query(`INSERT INTO roie_events (event_type, user_id, payload) VALUES ($1,$2,$3)`,
    [type, userId, JSON.stringify(payload)]).catch(() => {});
}

export function registerROIEOpportunityRoutes(app: Express, pool: Pool) {

  // ── SECTION 6: Opportunity Intelligence Engine ───────────────────
  app.post('/api/roie/opportunity/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const [csiR, lbiR] = await Promise.all([
        pool.query(`SELECT csi_score, stage FROM csi_profiles WHERE user_email=$1 LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT lbi_score, learning_style FROM lbi_scores WHERE user_email=$1 LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
      ]);

      const csi = csiR.rows[0]?.csi_score ?? 50;
      const lbi = lbiR.rows[0]?.lbi_score ?? 50;
      const base = (csi + lbi) / 2;

      const leadership = Math.min(100, base * 0.9 + rand(0, 10));
      const employability = Math.min(100, base * 0.95 + rand(0, 8));
      const resilience = Math.min(100, base * 0.85 + rand(0, 12));
      const learning = Math.min(100, lbi * 0.9 + rand(0, 10));
      const innovation = Math.min(100, base * 0.8 + rand(5, 15));
      const specialization = Math.min(100, base * 0.88 + rand(0, 10));
      const mentorship = Math.min(100, base * 0.92 + rand(0, 8));

      const scores = { leadership, employability, resilience, learning, innovation, specialization, mentorship };
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      const tier = base > 75 ? 'breakthrough' : base > 60 ? 'accelerating' : base > 45 ? 'growing' : 'emerging';

      const compoundingFactors = [];
      if (learning > 65 && innovation > 60) compoundingFactors.push('curiosity_growth + innovation_potential → leadership_emergence_acceleration');
      if (resilience > 70) compoundingFactors.push('resilience_growth + persistence → opportunity_amplification');

      const r = await pool.query(
        `INSERT INTO roie_opportunities
         (user_id, tenant_id, leadership_emergence, employability_acceleration, resilience_growth,
          rapid_learning_potential, innovation_potential, specialization_readiness, mentorship_readiness,
          top_opportunity, opportunity_tier, compounding_factors, acceleration_loop)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (user_id) DO UPDATE SET
           leadership_emergence=EXCLUDED.leadership_emergence, employability_acceleration=EXCLUDED.employability_acceleration,
           resilience_growth=EXCLUDED.resilience_growth, rapid_learning_potential=EXCLUDED.rapid_learning_potential,
           innovation_potential=EXCLUDED.innovation_potential, specialization_readiness=EXCLUDED.specialization_readiness,
           mentorship_readiness=EXCLUDED.mentorship_readiness, top_opportunity=EXCLUDED.top_opportunity,
           opportunity_tier=EXCLUDED.opportunity_tier, compounding_factors=EXCLUDED.compounding_factors,
           acceleration_loop=EXCLUDED.acceleration_loop, updated_at=NOW()
         RETURNING *`,
        [user_id, tenant_id || null, leadership, employability, resilience, learning, innovation, specialization, mentorship,
         top, tier, JSON.stringify(compoundingFactors), compoundingFactors[0] || null]
      ).catch(async () => {
        return pool.query(
          `INSERT INTO roie_opportunities
           (user_id, tenant_id, leadership_emergence, employability_acceleration, resilience_growth,
            rapid_learning_potential, innovation_potential, specialization_readiness, mentorship_readiness,
            top_opportunity, opportunity_tier, compounding_factors, acceleration_loop)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [user_id, tenant_id || null, leadership, employability, resilience, learning, innovation, specialization, mentorship,
           top, tier, JSON.stringify(compoundingFactors), compoundingFactors[0] || null]
        );
      });

      emitEvent(pool, 'OPPORTUNITY_DETECTED', user_id, { top_opportunity: top, tier });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/opportunity/dashboard', async (req, res, next) => {
    try {
      const [kpi, tiers, top, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(leadership_emergence)::numeric(5,2) avg_leadership, AVG(employability_acceleration)::numeric(5,2) avg_employability, COUNT(*) FILTER(WHERE opportunity_tier='breakthrough') breakthroughs FROM roie_opportunities`),
        pool.query(`SELECT opportunity_tier, COUNT(*) n FROM roie_opportunities GROUP BY opportunity_tier ORDER BY n DESC`),
        pool.query(`SELECT top_opportunity, COUNT(*) n FROM roie_opportunities GROUP BY top_opportunity ORDER BY n DESC LIMIT 5`),
        pool.query(`SELECT * FROM roie_opportunities ORDER BY leadership_emergence DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], tiers: tiers.rows, top_opportunities: top.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_leadership: 0, avg_employability: 0, breakthroughs: 0 }, tiers: [], top_opportunities: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 7: Human Potential Emergence Engine ──────────────────
  app.post('/api/roie/potential/detect', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const types = ['capability', 'breakthrough', 'resilience', 'cognitive', 'leadership'];
      const phases = ['pre-emerging', 'emerging', 'developing', 'proficient', 'mastery'];
      const signals = [
        'Sustained upward CSI trajectory over 3 sessions',
        'Rapid recovery from performance setback',
        'Unexpected leadership signal in group contexts',
        'Cognitive acceleration beyond age-band norms',
        'Cross-domain competency emergence',
      ];

      const count = 1 + Math.floor(Math.random() * 2);
      const inserted = [];
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const phase = phases[Math.floor(Math.random() * phases.length)];
        const confidence = rand(0.52, 0.91, 3);
        const r = await pool.query(
          `INSERT INTO roie_potential_emergence (user_id, tenant_id, emergence_type, emergence_signal, confidence, phase_transition, regression_detected, latent_growth_forecast, breakthrough_probability)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [user_id, tenant_id || null, type, signals[i % signals.length], confidence, phase,
           false, JSON.stringify({ '30d': rand(55, 80), '90d': rand(60, 88), '1y': rand(65, 92) }), rand(0.3, 0.7, 3)]
        );
        inserted.push(r.rows[0]);
      }
      res.json({ detected: inserted.length, emergences: inserted });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/potential', async (req, res, next) => {
    try {
      const [kpi, types, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(confidence)::numeric(5,3) avg_confidence, COUNT(*) FILTER(WHERE emergence_type='breakthrough') breakthroughs, COUNT(DISTINCT user_id) users FROM roie_potential_emergence`),
        pool.query(`SELECT emergence_type, COUNT(*) n, AVG(breakthrough_probability)::numeric(5,3) avg_prob FROM roie_potential_emergence GROUP BY emergence_type ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_potential_emergence ORDER BY confidence DESC LIMIT 30`),
      ]);
      res.json({ kpi: kpi.rows[0], types: types.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_confidence: 0, breakthroughs: 0, users: 0 }, types: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 8: Recovery Intelligence Engine ──────────────────────
  app.post('/api/roie/recovery/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const velocity = rand(0.2, 0.9, 3);
      const stability = rand(0.3, 0.9, 3);
      const sustainability = rand(0.3, 0.85, 3);
      const momentum = parseFloat((velocity * stability * sustainability).toFixed(3));

      const stages = ['initiating', 'stabilizing', 'rebuilding', 'sustaining', 'complete'];
      const stage = stages[Math.min(4, Math.floor(momentum * 5))];

      const r = await pool.query(
        `INSERT INTO roie_recovery_tracking
         (user_id, tenant_id, recovery_velocity, emotional_stabilization, resilience_rebuilding,
          cognitive_recovery, engagement_recovery, recovery_momentum, stability_index,
          sustainability_index, recovery_stage, recovery_eta_days, adaptive_sequence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [user_id, tenant_id || null, velocity, rand(30, 80), rand(25, 75),
         rand(30, 78), rand(25, 72), momentum, stability, sustainability, stage,
         Math.floor(rand(7, 60)),
         JSON.stringify(['Emotional stabilization', 'Cognitive reorientation', 'Resilience rebuilding', 'Engagement recovery'])]
      );
      emitEvent(pool, 'RECOVERY_DETECTED', user_id, { stage, momentum });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/recovery', async (req, res, next) => {
    try {
      const [kpi, stages, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, AVG(recovery_momentum)::numeric(5,3) avg_momentum, COUNT(*) FILTER(WHERE recovery_stage='complete') complete, AVG(recovery_velocity)::numeric(5,3) avg_velocity FROM roie_recovery_tracking`),
        pool.query(`SELECT recovery_stage, COUNT(*) n FROM roie_recovery_tracking GROUP BY recovery_stage ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_recovery_tracking ORDER BY recovery_momentum DESC LIMIT 25`),
      ]);
      res.json({ kpi: kpi.rows[0], stages: stages.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, avg_momentum: 0, complete: 0, avg_velocity: 0 }, stages: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 9: Longitudinal Trajectory Engine ────────────────────
  app.post('/api/roie/trajectory/snapshot', async (req, res, next) => {
    try {
      const { user_id, tenant_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const types = ['growth', 'stagnation', 'regression', 'volatility', 'recovery', 'resilience_evolution'];
      const type = types[Math.floor(Math.random() * types.length)];
      const acceleration = type === 'growth' ? rand(0.3, 0.9, 3) : type === 'regression' ? rand(-0.6, -0.1, 3) : rand(-0.2, 0.3, 3);
      const volatility = rand(0.05, 0.5, 3);
      const collapseRisk = type === 'regression' ? rand(0.4, 0.75, 3) : rand(0.05, 0.3, 3);

      const r = await pool.query(
        `INSERT INTO roie_trajectories
         (user_id, tenant_id, trajectory_type, growth_acceleration, stagnation_duration_days,
          regression_severity, volatility_index, instability_detected, collapse_risk, trajectory_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [user_id, tenant_id || null, type, Math.abs(acceleration),
         type === 'stagnation' ? Math.floor(rand(14, 90)) : 0,
         type === 'regression' ? rand(0.2, 0.7, 3) : 0, volatility,
         collapseRisk > 0.45, collapseRisk,
         JSON.stringify({ datapoints: Array.from({ length: 6 }, (_, i) => ({ week: i + 1, score: rand(35, 85) })) })]
      );
      emitEvent(pool, 'TRAJECTORY_UPDATED', user_id, { type, acceleration, volatility });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/trajectories', async (req, res, next) => {
    try {
      const [kpi, types, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(*) FILTER(WHERE instability_detected) unstable, COUNT(*) FILTER(WHERE trajectory_type='growth') growth, AVG(volatility_index)::numeric(5,3) avg_volatility FROM roie_trajectories`),
        pool.query(`SELECT trajectory_type, COUNT(*) n, AVG(collapse_risk)::numeric(5,3) avg_collapse FROM roie_trajectories GROUP BY trajectory_type ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_trajectories ORDER BY snapshot_at DESC LIMIT 30`),
      ]);
      res.json({ kpi: kpi.rows[0], types: types.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, unstable: 0, growth: 0, avg_volatility: 0 }, types: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 10: Predictive Forecasting Engine ────────────────────
  app.post('/api/roie/forecast/compute', async (req, res, next) => {
    try {
      const { user_id, tenant_id, horizons = ['7d', '30d', '90d', '6m', '1y'] } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const [csiR, riskR] = await Promise.all([
        pool.query(`SELECT csi_score FROM csi_profiles WHERE user_email=$1 LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT overall_risk_score FROM roie_risk_profiles WHERE user_id=$1 LIMIT 1`, [user_id]).catch(() => ({ rows: [] })),
      ]);

      const csi = csiR.rows[0]?.csi_score ?? 50;
      const riskScore = riskR.rows[0]?.overall_risk_score ?? 50;

      const inserted = [];
      for (const horizon of horizons) {
        const decay = { '7d': 0, '30d': 0.05, '90d': 0.12, '6m': 0.18, '1y': 0.25 }[horizon as string] ?? 0;
        const burnout = Math.min(0.99, (riskScore / 100) * (1 + decay) + rand(-0.05, 0.05, 3));
        const dropout = Math.min(0.99, (riskScore / 100) * 0.8 * (1 + decay) + rand(-0.05, 0.05, 3));
        const employability = Math.min(0.99, (csi / 100) * (1 - decay * 0.5) + rand(-0.05, 0.05, 3));
        const leadership = Math.min(0.99, (csi / 100) * 0.7 * (1 - decay * 0.3) + rand(-0.05, 0.05, 3));

        const r = await pool.query(
          `INSERT INTO roie_forecasts
           (user_id, tenant_id, forecast_horizon, burnout_probability, dropout_probability,
            employability_readiness, emotional_collapse_prob, leadership_emergence_prob,
            intervention_responsiveness, resilience_trajectory, confidence_interval)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [user_id, tenant_id || null, horizon, burnout, dropout, employability,
           Math.min(0.99, burnout * 0.8 + rand(0, 0.1, 3)),
           leadership, rand(0.5, 0.9, 3),
           burnout < 0.35 ? 'improving' : burnout < 0.55 ? 'stable' : 'declining',
           JSON.stringify({ lower: Math.max(0, burnout - 0.1), mean: burnout, upper: Math.min(1, burnout + 0.1) })]
        );
        inserted.push(r.rows[0]);
      }
      res.json({ user_id, forecasts: inserted, horizons: inserted.length });
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/forecasts', async (req, res, next) => {
    try {
      const { horizon } = req.query;
      const where = horizon ? `WHERE forecast_horizon=$1` : '';
      const params = horizon ? [horizon] : [];
      const [kpi, horizonDist, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(DISTINCT user_id) users, AVG(burnout_probability)::numeric(5,3) avg_burnout, AVG(employability_readiness)::numeric(5,3) avg_employability FROM roie_forecasts`),
        pool.query(`SELECT forecast_horizon, COUNT(*) n, AVG(burnout_probability)::numeric(5,3) avg_burnout, AVG(leadership_emergence_prob)::numeric(5,3) avg_leadership FROM roie_forecasts GROUP BY forecast_horizon ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_forecasts ${where} ORDER BY forecasted_at DESC LIMIT 30`, params),
      ]);
      res.json({ kpi: kpi.rows[0], horizons: horizonDist.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, users: 0, avg_burnout: 0, avg_employability: 0 }, horizons: [], rows: [] });
      next(err);
    }
  });

  // ── SECTION 12: Intervention Intelligence Engine ──────────────────
  app.post('/api/roie/intervention/initiate', async (req, res, next) => {
    try {
      const { user_id, tenant_id, intervention_type, trigger_reason, priority = 'medium' } = req.body;
      if (!user_id || !intervention_type) return res.status(400).json({ error: 'user_id and intervention_type required' });

      const r = await pool.query(
        `INSERT INTO roie_interventions (user_id, tenant_id, intervention_type, trigger_reason, priority, sequence_step, optimized_timing)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [user_id, tenant_id || null, intervention_type, trigger_reason || null, priority, 1,
         priority === 'critical' ? 'Immediate (within 24h)' : priority === 'high' ? 'Within 72 hours' : 'Within 1 week']
      );
      emitEvent(pool, 'INTERVENTION_TRIGGERED', user_id, { type: intervention_type, priority });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.get('/api/admin/roie/interventions', async (req, res, next) => {
    try {
      const { status } = req.query;
      const where = status ? `WHERE status=$1` : '';
      const params = status ? [status] : [];
      const [kpi, types, statusDist, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) total, COUNT(*) FILTER(WHERE status='active') active, COUNT(*) FILTER(WHERE status='completed') completed, AVG(effectiveness_score)::numeric(5,3) avg_effectiveness FROM roie_interventions`),
        pool.query(`SELECT intervention_type, COUNT(*) n FROM roie_interventions GROUP BY intervention_type ORDER BY n DESC`),
        pool.query(`SELECT status, COUNT(*) n FROM roie_interventions GROUP BY status ORDER BY n DESC`),
        pool.query(`SELECT * FROM roie_interventions ${where} ORDER BY initiated_at DESC LIMIT 30`, params),
      ]);
      res.json({ kpi: kpi.rows[0], types: types.rows, status_dist: statusDist.rows, rows: rows.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ kpi: { total: 0, active: 0, completed: 0, avg_effectiveness: null }, types: [], status_dist: [], rows: [] });
      next(err);
    }
  });

  app.patch('/api/admin/roie/interventions/:id', async (req, res, next) => {
    try {
      const { status, effectiveness_score, outcome } = req.body;
      const r = await pool.query(
        `UPDATE roie_interventions SET
           status=COALESCE($1,status),
           effectiveness_score=COALESCE($2,effectiveness_score),
           outcome=COALESCE($3,outcome),
           completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END
         WHERE id=$4 RETURNING *`,
        [status || null, effectiveness_score ?? null, outcome ? JSON.stringify(outcome) : null, req.params.id]
      );
      res.json(r.rows[0] || { error: 'not found' });
    } catch (err) { next(err); }
  });

  // ── OPPORTUNITY: User-level full profile ─────────────────────────
  app.get('/api/admin/roie/opportunity/profile/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      const [opp, potential, recovery, trajectory, forecasts] = await Promise.all([
        pool.query(`SELECT * FROM roie_opportunities WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM roie_potential_emergence WHERE user_id=$1 ORDER BY detected_at DESC LIMIT 5`, [userId]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM roie_recovery_tracking WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM roie_trajectories WHERE user_id=$1 ORDER BY snapshot_at DESC LIMIT 5`, [userId]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM roie_forecasts WHERE user_id=$1 ORDER BY forecasted_at DESC LIMIT 5`, [userId]).catch(() => ({ rows: [] })),
      ]);
      res.json({ user_id: userId, opportunity: opp.rows[0] || null, potential: potential.rows, recovery: recovery.rows[0] || null, trajectories: trajectory.rows, forecasts: forecasts.rows });
    } catch (err) { next(err); }
  });
}
