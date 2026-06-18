import type { Express } from "express";
import pg from "pg";

function riskLabel(composite: number): string {
  if (composite >= 70) return 'critical';
  if (composite >= 50) return 'high';
  if (composite >= 30) return 'medium';
  return 'low';
}

async function computePredictions(email: string, client: pg.PoolClient) {
  const [sessRes, lbiRes, csiRes, sigRes, burnoutRes] = await Promise.all([
    client.query(
      `SELECT status, stage_code, created_at, score FROM capadex_sessions
       WHERE guest_email=$1 ORDER BY created_at DESC LIMIT 20`,
      [email]
    ),
    client.query(`SELECT * FROM lbi_scores WHERE user_email=$1`, [email]),
    client.query(`SELECT csi_score, csi_stage FROM csi_profiles WHERE user_email=$1`, [email]),
    client.query(
      `SELECT signal_type, severity_level, COUNT(*) as cnt FROM behavioural_signals
       WHERE user_email=$1 GROUP BY signal_type,severity_level`,
      [email]
    ),
    client.query(
      `SELECT COUNT(*) as cnt FROM signal_patterns
       WHERE user_email=$1 AND pattern_type='burnout_trajectory_risk'`,
      [email]
    ),
  ]);

  const sessions = sessRes.rows;
  const lbi = lbiRes.rows[0];
  const csi = csiRes.rows[0];
  const sigs = sigRes.rows;

  // ── Dropout Risk ─────────────────────────────────────────────────────────
  let dropout_risk = 40;
  if (sessions.length > 0) {
    const completionRate = sessions.filter(s => s.status==='completed').length / sessions.length;
    dropout_risk = Math.round((1 - completionRate) * 60);
    const lastAt = sessions[0]?.created_at;
    if (lastAt) {
      const daysSince = (Date.now() - new Date(lastAt).getTime()) / 86400000;
      if (daysSince > 30) dropout_risk = Math.min(95, dropout_risk + 30);
      else if (daysSince > 14) dropout_risk = Math.min(90, dropout_risk + 15);
    }
  }
  if (lbi && lbi.overall_lbi < 30) dropout_risk = Math.min(95, dropout_risk + 20);
  dropout_risk = Math.max(0, Math.min(100, dropout_risk));

  // ── Burnout Probability ───────────────────────────────────────────────────
  let burnout_probability = 20;
  if (sigs.filter(s=>s.signal_type==='emotional'&&s.severity_level==='high').length > 0) burnout_probability += 25;
  if (sigs.filter(s=>s.signal_type==='cognitive'&&s.severity_level==='high').length > 0) burnout_probability += 20;
  if (sessions.length > 10) burnout_probability += 10;
  if (lbi && lbi.attention_score < 35) burnout_probability += 15;
  if (parseInt(burnoutRes.rows[0]?.cnt || '0') > 0) burnout_probability += 20;
  burnout_probability = Math.max(0, Math.min(100, burnout_probability));

  // ── Employability Readiness ───────────────────────────────────────────────
  let employability_readiness = 40;
  if (csi) employability_readiness = Math.round(Number(csi.csi_score) * 0.6 + 40 * 0.4);
  if (lbi) employability_readiness = Math.round(employability_readiness * 0.7 + lbi.overall_lbi * 0.3);
  const completedStages = new Set(sessions.filter(s=>s.status==='completed').map(s=>s.stage_code));
  if (completedStages.has('CAP_MAS')) employability_readiness = Math.min(100, employability_readiness + 15);
  if (completedStages.has('CAP_GRW')) employability_readiness = Math.min(100, employability_readiness + 10);
  employability_readiness = Math.max(0, Math.min(100, employability_readiness));

  // ── Leadership Emergence ──────────────────────────────────────────────────
  let leadership_emergence = 25;
  const csiScore = Number(csi?.csi_score || 0);
  if (csiScore >= 65) leadership_emergence += 30;
  else if (csiScore >= 50) leadership_emergence += 15;
  if (lbi) {
    if (lbi.adaptability_score > 70) leadership_emergence += 20;
    if (lbi.persistence_score > 65) leadership_emergence += 10;
  }
  if (sigs.filter(s=>s.signal_type==='social').length > 0) leadership_emergence += 10;
  leadership_emergence = Math.max(0, Math.min(100, leadership_emergence));

  const composite_risk = Math.round(
    dropout_risk * 0.35 + burnout_probability * 0.35 +
    (100 - employability_readiness) * 0.20 + (100 - leadership_emergence) * 0.10
  );

  return { user_email: email, dropout_risk, burnout_probability,
           employability_readiness, leadership_emergence, composite_risk,
           risk_label: riskLabel(composite_risk) };
}

async function detectTrajectory(email: string, client: pg.PoolClient) {
  const traj = await client.query(
    `SELECT csi_score, created_at FROM csi_trajectory
     WHERE user_email=$1 ORDER BY created_at ASC LIMIT 10`,
    [email]
  );
  const scores = traj.rows.map(r => Number(r.csi_score));
  if (scores.length < 2) return;

  const half = Math.ceil(scores.length / 2);
  const firstAvg = scores.slice(0, half).reduce((a,b)=>a+b,0) / half;
  const lastAvg  = scores.slice(half).reduce((a,b)=>a+b,0) / (scores.length - half);
  const delta = lastAvg - firstAvg;
  const variance = scores.map(s=>(s - scores.reduce((a,b)=>a+b)/scores.length)**2).reduce((a,b)=>a+b) / scores.length;

  let trajectory_type: string, trend_direction: string, confidence: number;
  if (delta > 10)       { trajectory_type='growth_acceleration';  trend_direction='improving'; confidence=0.78; }
  else if (delta > 3)   { trajectory_type='growth_acceleration';  trend_direction='improving'; confidence=0.60; }
  else if (delta < -10) { trajectory_type='burnout_escalation';   trend_direction='declining'; confidence=0.75; }
  else if (delta < -3)  { trajectory_type='disengagement_drift';  trend_direction='declining'; confidence=0.62; }
  else if (variance > 200) { trajectory_type='volatility';        trend_direction='volatile';  confidence=0.65; }
  else                  { trajectory_type='stagnation';           trend_direction='stable';    confidence=0.55; }

  await client.query(
    `INSERT INTO developmental_trajectory (user_email,trajectory_type,trend_direction,confidence,signals_basis,detected_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [email, trajectory_type, trend_direction, confidence, JSON.stringify(scores)]
  );
}

export function registerPredictiveIntelligenceRoutes(app: Express, pool: pg.Pool) {

  // POST /api/predictions/compute
  app.post('/api/predictions/compute', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const client = await pool.connect();
    try {
      const predictions = await computePredictions(email, client);
      await detectTrajectory(email, client);
      res.json({ success: true, predictions });
    } catch (err) {
      console.error('Prediction compute error:', err);
      res.status(500).json({ error: 'compute failed' });
    } finally { client.release(); }
  });

  // GET /api/admin/predictions/dashboard
  app.get('/api/admin/predictions/dashboard', async (_req, res) => {
    try {
      const users = await pool.query(`
        SELECT cp.user_email, cp.csi_score, ls.overall_lbi,
          COUNT(sess.id) as session_count,
          COUNT(sess.id) FILTER (WHERE sess.status='completed') as completed_count,
          MAX(sess.created_at) as last_active
        FROM csi_profiles cp
        LEFT JOIN lbi_scores ls ON ls.user_email=cp.user_email
        LEFT JOIN capadex_sessions sess ON sess.guest_email=cp.user_email
        GROUP BY cp.user_email, cp.csi_score, ls.overall_lbi
        LIMIT 200
      `);
      const total = users.rows.length;
      let critical=0, high=0, medium=0, low=0;
      let sumDropout=0, sumBurnout=0, sumEmploy=0;
      for (const u of users.rows) {
        const csi = Number(u.csi_score)||40, lbi = Number(u.overall_lbi)||40;
        const sessions = Number(u.session_count)||1, completed = Number(u.completed_count)||0;
        const compRate = completed/sessions;
        const d = Math.round(Math.max(0,Math.min(100,(1-compRate)*60+(lbi<30?20:0))));
        const b = Math.round(Math.max(0,Math.min(100,(lbi<35?30:10)+(csi<40?20:0))));
        const e = Math.round(Math.max(0,Math.min(100,csi*0.6+lbi*0.4)));
        const comp = Math.round(d*0.4+b*0.4+(100-e)*0.2);
        sumDropout+=d; sumBurnout+=b; sumEmploy+=e;
        if (comp>=70) critical++;
        else if (comp>=50) high++;
        else if (comp>=30) medium++;
        else low++;
      }
      const trajectories = await pool.query(
        `SELECT trajectory_type,trend_direction,COUNT(*) as count FROM developmental_trajectory
         GROUP BY trajectory_type,trend_direction ORDER BY count DESC LIMIT 10`
      );
      res.json({
        total,
        risk_distribution: { critical, high, medium, low },
        avg_dropout_risk: total ? Math.round(sumDropout/total) : 0,
        avg_burnout_probability: total ? Math.round(sumBurnout/total) : 0,
        avg_employability: total ? Math.round(sumEmploy/total) : 0,
        trajectories: trajectories.rows,
      });
    } catch (err) {
      console.error('Predictions dashboard error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/predictions/profiles
  app.get('/api/admin/predictions/profiles', async (req, res) => {
    const { page='1', limit='25', search, risk } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    try {
      const rows = await pool.query(`
        SELECT cp.user_email, cp.csi_score, ls.overall_lbi, ls.learning_style,
          COUNT(sess.id) as session_count,
          COUNT(sess.id) FILTER (WHERE sess.status='completed') as completed_count,
          MAX(sess.created_at) as last_active
        FROM csi_profiles cp
        LEFT JOIN lbi_scores ls ON ls.user_email=cp.user_email
        LEFT JOIN capadex_sessions sess ON sess.guest_email=cp.user_email
        WHERE ($1::text IS NULL OR cp.user_email ILIKE $1)
        GROUP BY cp.user_email, cp.csi_score, ls.overall_lbi, ls.learning_style
        ORDER BY last_active DESC NULLS LAST
        LIMIT $2 OFFSET $3
      `, [search?`%${search}%`:null, parseInt(limit), offset]);

      const totalRes = await pool.query(
        `SELECT COUNT(DISTINCT user_email) FROM csi_profiles WHERE ($1::text IS NULL OR user_email ILIKE $1)`,
        [search?`%${search}%`:null]
      );

      const enriched = rows.rows.map(u => {
        const csi = Number(u.csi_score)||40, lbi = Number(u.overall_lbi)||40;
        const sessions = Number(u.session_count)||1, completed = Number(u.completed_count)||0;
        const compRate = completed/sessions;
        const dropout_risk = Math.round(Math.max(0,Math.min(100,(1-compRate)*60+(lbi<30?20:0))));
        const burnout_probability = Math.round(Math.max(0,Math.min(100,(lbi<35?30:10)+(csi<40?20:0))));
        const employability_readiness = Math.round(Math.max(0,Math.min(100,csi*0.6+lbi*0.4)));
        const leadership_emergence = Math.round(Math.max(0,Math.min(100,csi>=65?55:csi>=50?40:20)));
        const composite_risk = Math.round(dropout_risk*0.35+burnout_probability*0.35+(100-employability_readiness)*0.20+(100-leadership_emergence)*0.10);
        return { ...u, dropout_risk, burnout_probability, employability_readiness, leadership_emergence, composite_risk, risk_label: riskLabel(composite_risk) };
      });

      const filtered = risk ? enriched.filter(u=>u.risk_label===risk) : enriched;
      res.json({ rows: filtered, total: parseInt(totalRes.rows[0].count), page: parseInt(page) });
    } catch (err) {
      console.error('Predictions profiles error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/predictions/trajectories
  app.get('/api/admin/predictions/trajectories', async (req, res) => {
    const { page='1', limit='30' } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    try {
      const rows = await pool.query(
        `SELECT * FROM developmental_trajectory ORDER BY detected_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      );
      const total = await pool.query('SELECT COUNT(*) FROM developmental_trajectory');
      res.json({ rows: rows.rows, total: parseInt(total.rows[0].count), page: parseInt(page) });
    } catch (err) {
      console.error('Trajectories error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // POST /api/admin/predictions/detect-trajectories
  app.post('/api/admin/predictions/detect-trajectories', async (_req, res) => {
    res.json({ message: 'trajectory detection started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const users = await client.query(`SELECT DISTINCT user_email FROM csi_profiles LIMIT 500`);
        for (const u of users.rows) {
          try { await detectTrajectory(u.user_email, client); } catch { /* skip */ }
        }
      } finally { client.release(); }
    })();
  });
}
