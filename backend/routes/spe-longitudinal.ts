/**
 * SPE — LONGITUDINAL, PREDICTIVE & INTERVENTION ENGINE
 * Sections 11–13: Longitudinal Scoring, Predictive Scoring, Intervention Attribution
 */

import { Express } from 'express';
import pg from 'pg';

function clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : lo)); }
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function trend(arr: number[]): { direction: string; slope: number } {
  if (arr.length < 2) return { direction: 'stable', slope: 0 };
  const n = arr.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(arr);
  let num = 0, den = 0;
  arr.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den ? num / den : 0;
  const direction = slope > 1 ? 'accelerating' : slope > 0.3 ? 'improving' : slope < -1 ? 'declining' : slope < -0.3 ? 'regressing' : 'stable';
  return { direction, slope: Math.round(slope * 100) / 100 };
}
function detectTrajectory(slopes: number[]): string {
  const avgSlope = mean(slopes);
  const volatility = slopes.length > 1 ? Math.sqrt(slopes.map(s => (s - avgSlope) ** 2).reduce((a, b) => a + b, 0) / slopes.length) : 0;
  if (volatility > 2) return 'volatile';
  if (avgSlope > 1.5) return 'growth_acceleration';
  if (avgSlope > 0.5) return 'improving';
  if (avgSlope < -1.5) return 'burnout_trajectory';
  if (avgSlope < -0.5) return 'disengagement_drift';
  if (Math.abs(avgSlope) < 0.2) return 'stagnation';
  return 'stable';
}

export function registerSPELongitudinalRoutes(app: Express, pool: pg.Pool) {

  // ─── POST /api/spe/longitudinal/snapshot ─────────────────────────────────
  app.post('/api/spe/longitudinal/snapshot', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [scores, beh, cog] = await Promise.all([
        pool.query(`SELECT normalized_score,created_at FROM spe_scores WHERE user_id=$1 ORDER BY created_at ASC`, [user_id]),
        pool.query(`SELECT overall_score FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT overall_cognitive FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
      ]);
      const scoreSeries = scores.rows.map(r => Number(r.normalized_score));
      const composite   = scoreSeries.length ? scoreSeries[scoreSeries.length - 1] : 50;
      const { slope, direction } = trend(scoreSeries);
      const acceleration  = scoreSeries.length > 2 ? (scoreSeries[scoreSeries.length - 1] - scoreSeries[scoreSeries.length - 2]) - (scoreSeries[scoreSeries.length - 2] - (scoreSeries[scoreSeries.length - 3] || scoreSeries[scoreSeries.length - 2])) : 0;
      const previousSlopes = scoreSeries.map((_, i) => i > 0 ? scoreSeries[i] - scoreSeries[i - 1] : 0).slice(1);
      const pattern = detectTrajectory(previousSlopes);

      await pool.query(
        `INSERT INTO spe_trajectory_snapshots (user_id,composite_score,cognitive_score,behavioural_score,velocity,acceleration,pattern,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user_id, composite, cog.rows[0]?.overall_cognitive || 50, beh.rows[0]?.overall_score || 50, slope, Math.round(acceleration * 100) / 100, pattern, tenant_id || null]
      );

      await pool.query(
        `INSERT INTO spe_longitudinal_scores (user_id,score_type,score_value,delta,trend_direction,trajectory_type,tenant_id)
         VALUES ($1,'composite',$2,$3,$4,$5,$6)`,
        [user_id, composite, slope, direction, pattern, tenant_id || null]
      );

      res.json({ success: true, user_id, composite, slope, direction, pattern, trajectory: { acceleration, pattern, previous_count: scoreSeries.length } });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/predict ────────────────────────────────────────────────
  app.post('/api/spe/predict', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [scores, beh, cog, longs] = await Promise.all([
        pool.query(`SELECT normalized_score FROM spe_scores WHERE user_id=$1 ORDER BY created_at ASC`, [user_id]),
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT score_value FROM spe_longitudinal_scores WHERE user_id=$1 AND score_type='composite' ORDER BY created_at ASC LIMIT 20`, [user_id]),
      ]);

      const scoreSeries   = scores.rows.map(r => Number(r.normalized_score));
      const longSeries    = longs.rows.map(r => Number(r.score_value));
      const allSeries     = [...scoreSeries, ...longSeries].slice(-20);
      const { slope }     = trend(allSeries);
      const b = beh.rows[0] || {};
      const c = cog.rows[0] || {};
      const avgScore = mean(allSeries) || 50;

      const burnout       = clamp(Math.round((Number(c.overload_risk) || 0) * 0.5 + (c.fatigue_detected ? 20 : 0) + (slope < -1 ? 20 : 0) + (Number(b.impulsivity_penalty) || 0) * 0.3));
      const dropout       = clamp(Math.round((100 - avgScore) * 0.3 + burnout * 0.3 + (slope < -0.5 ? 20 : 0) + (Number(b.focus_score) < 40 ? 20 : 0)));
      const employability = clamp(Math.round(avgScore * 0.4 + (Number(b.persistence_score) || 50) * 0.3 + (Number(c.reasoning_score) || 50) * 0.3));
      const leadership    = clamp(Math.round((Number(b.adaptability_score) || 50) * 0.4 + (Number(c.flexibility_score) || 50) * 0.3 + (slope > 0.5 ? 20 : 0) + avgScore * 0.1));
      const resilience    = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
      const risk          = burnout > 60 || dropout > 60 ? 'high' : burnout > 40 || dropout > 40 ? 'medium' : 'low';
      const predicted30d  = clamp(Math.round(avgScore + slope * 30));

      const riskFactors      = [];
      const protectiveFactors = [];
      if (Number(c.overload_risk) > 60) riskFactors.push('Cognitive overload risk');
      if (c.fatigue_detected)           riskFactors.push('Fatigue pattern detected');
      if (slope < -0.5)                 riskFactors.push('Declining performance trend');
      if (Number(b.focus_score) < 40)   riskFactors.push('Low focus scores');
      if (Number(b.persistence_score) > 70) protectiveFactors.push('Strong persistence');
      if (Number(c.reasoning_score) > 70)   protectiveFactors.push('Strong reasoning');
      if (slope > 0.5)                      protectiveFactors.push('Positive growth trajectory');
      if (avgScore > 65)                    protectiveFactors.push('Above-average performance');

      await pool.query(
        `INSERT INTO spe_predictive_scores (user_id,burnout_probability,dropout_probability,employability_readiness,leadership_emergence,resilience_trajectory,risk_level,top_risk_factors,top_protective_factors,predicted_csi_30d,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (user_id) DO UPDATE SET burnout_probability=$2,dropout_probability=$3,employability_readiness=$4,leadership_emergence=$5,resilience_trajectory=$6,risk_level=$7,top_risk_factors=$8,top_protective_factors=$9,predicted_csi_30d=$10,computed_at=NOW()`,
        [user_id, burnout, dropout, employability, leadership, resilience, risk, JSON.stringify(riskFactors), JSON.stringify(protectiveFactors), predicted30d, tenant_id || null]
      );

      res.json({ success: true, user_id, burnout_probability: burnout, dropout_probability: dropout, employability_readiness: employability, leadership_emergence: leadership, resilience_trajectory: resilience, risk_level: risk, predicted_csi_30d: predicted30d, risk_factors: riskFactors, protective_factors: protectiveFactors });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/interventions — create intervention ───────────────────
  app.post('/api/spe/interventions', async (req, res) => {
    const { user_id, intervention_type, intervention_name, notes, tenant_id } = req.body;
    if (!user_id || !intervention_type || !intervention_name) return res.status(400).json({ error: 'user_id, intervention_type, intervention_name required' });
    try {
      const preScore = (await pool.query(`SELECT AVG(normalized_score) FROM spe_scores WHERE user_id=$1`, [user_id])).rows[0]?.avg || null;
      const r = await pool.query(
        `INSERT INTO spe_interventions (user_id,intervention_type,intervention_name,pre_score,notes,tenant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [user_id, intervention_type, intervention_name, preScore, notes || null, tenant_id || null]
      );
      res.json({ success: true, intervention: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── PATCH /api/spe/interventions/:id/close ──────────────────────────────
  app.patch('/api/spe/interventions/:id/close', async (req, res) => {
    const { notes } = req.body;
    try {
      const iv = (await pool.query(`SELECT * FROM spe_interventions WHERE id=$1`, [req.params.id])).rows[0];
      if (!iv) return res.status(404).json({ error: 'not found' });
      const postScore = Number((await pool.query(`SELECT AVG(normalized_score) FROM spe_scores WHERE user_id=$1 AND created_at > $2`, [iv.user_id, iv.started_at])).rows[0]?.avg || 0);
      const effectiveness = postScore - Number(iv.pre_score || 0);
      const recoveryRate  = effectiveness > 0 ? Math.round(Math.min(100, effectiveness * 2)) : 0;
      await pool.query(
        `UPDATE spe_interventions SET ended_at=NOW(),post_score=$1,effectiveness=$2,recovery_rate=$3,status='closed',notes=$4 WHERE id=$5`,
        [postScore, effectiveness, recoveryRate, notes || iv.notes, req.params.id]
      );
      res.json({ success: true, effectiveness, recovery_rate: recoveryRate, post_score: postScore });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/longitudinal ─────────────────────────────────────
  app.get('/api/admin/spe/longitudinal', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [kpi, trajectories, predictive, interventions] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT user_id) as tracked_users,
                   COUNT(*) FILTER (WHERE pattern='growth_acceleration') as accelerating,
                   COUNT(*) FILTER (WHERE pattern='burnout_trajectory') as at_burnout_risk,
                   COUNT(*) FILTER (WHERE pattern='stagnation') as stagnant,
                   COUNT(*) FILTER (WHERE pattern='volatile') as volatile
                   FROM spe_trajectory_snapshots`),
        pool.query(`SELECT DISTINCT ON (user_id) user_id,composite_score,pattern,velocity,acceleration,created_at FROM spe_trajectory_snapshots ORDER BY user_id,created_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE risk_level='high') as high_risk,
                   ROUND(AVG(burnout_probability)::numeric,1) as avg_burnout,
                   ROUND(AVG(employability_readiness)::numeric,1) as avg_employability
                   FROM spe_predictive_scores`),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='active') as active,
                   ROUND(AVG(effectiveness)::numeric,1) as avg_effectiveness,
                   ROUND(AVG(recovery_rate)::numeric,1) as avg_recovery
                   FROM spe_interventions`),
      ]);
      res.json({ kpi: kpi.rows[0], trajectories: trajectories.rows, predictive: predictive.rows[0], interventions: interventions.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/predictive ───────────────────────────────────────
  app.get('/api/admin/spe/predictive', async (req, res) => {
    try {
      const { risk_level, page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const wc = risk_level ? `WHERE risk_level='${risk_level.replace(/'/g, "''")}'` : '';
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE risk_level='high') as high_risk,
                   ROUND(AVG(burnout_probability)::numeric,1) as avg_burnout,
                   ROUND(AVG(dropout_probability)::numeric,1) as avg_dropout,
                   ROUND(AVG(employability_readiness)::numeric,1) as avg_employability,
                   ROUND(AVG(leadership_emergence)::numeric,1) as avg_leadership
                   FROM spe_predictive_scores`),
        pool.query(`SELECT * FROM spe_predictive_scores ${wc} ORDER BY computed_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/interventions ────────────────────────────────────
  app.get('/api/admin/spe/interventions', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='active') as active,
                   ROUND(AVG(effectiveness)::numeric,1) as avg_effectiveness,
                   ROUND(AVG(recovery_rate)::numeric,1) as avg_recovery,
                   COUNT(*) FILTER (WHERE effectiveness > 0) as positive_impact
                   FROM spe_interventions`),
        pool.query(`SELECT * FROM spe_interventions ORDER BY started_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
