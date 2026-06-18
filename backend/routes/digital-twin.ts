import type { Express } from "express";
import pg from "pg";

async function synthesizeTwin(email: string, client: pg.PoolClient) {
  const [csiRes, lbiRes, cogRes, sigRes, sessRes] = await Promise.all([
    client.query('SELECT csi_score, csi_stage FROM csi_profiles WHERE user_email=$1', [email]),
    client.query('SELECT overall_lbi, learning_style, attention_score FROM lbi_scores WHERE user_email=$1', [email]),
    client.query('SELECT composite_cognitive_score, overload_risk FROM cognitive_profiles WHERE user_email=$1', [email]),
    client.query(
      `SELECT signal_type, severity_level, COUNT(*) as cnt FROM behavioural_signals
       WHERE user_email=$1 GROUP BY signal_type, severity_level`, [email]
    ),
    client.query(
      `SELECT status, score, stage_code, created_at FROM capadex_sessions WHERE guest_email=$1
       ORDER BY created_at DESC LIMIT 20`, [email]
    ),
  ]);

  const csi = csiRes.rows[0];
  const lbi = lbiRes.rows[0];
  const cog = cogRes.rows[0];
  const sigs = sigRes.rows;
  const sessions = sessRes.rows;
  const completed = sessions.filter(s => s.status === 'completed');

  const csi_score = Number(csi?.csi_score || 0);
  const lbi_score = Number(lbi?.overall_lbi || 0);
  const cognitive_score = Number(cog?.composite_cognitive_score || 50);

  // Emotional score: inverse of high-severity emotional signals
  const emotHigh = sigs.filter(s => s.signal_type === 'emotional' && s.severity_level === 'high').length;
  const emotMed  = sigs.filter(s => s.signal_type === 'emotional' && s.severity_level === 'medium').length;
  const emotional_score = Math.max(20, Math.min(100, 75 - emotHigh * 15 - emotMed * 5));

  // Behavioural score: composite from completion rate + score quality
  const completionRate = sessions.length > 0 ? completed.length / sessions.length : 0.5;
  const avgScore = completed.length > 0
    ? completed.reduce((a, s) => a + Number(s.score || 0), 0) / completed.length
    : 50;
  const behavioural_score = Math.round(completionRate * 50 + avgScore * 0.5);

  // Developmental stage from CSI
  const stageMap: Record<string, string> = {
    Forming: 'forming', Emerging: 'emerging', Developing: 'developing',
    Proficient: 'proficient', Advanced: 'advanced'
  };
  const developmental_stage = csi?.csi_stage
    ? (stageMap[csi.csi_stage] || 'forming')
    : 'forming';

  // Human Intelligence Score (HIS) — weighted composite
  const his_inputs = [
    csi_score > 0 ? csi_score * 0.30 : 0,
    lbi_score > 0 ? lbi_score * 0.20 : 0,
    cognitive_score * 0.25,
    emotional_score * 0.15,
    behavioural_score * 0.10,
  ];
  const weight_used = [
    csi_score > 0 ? 0.30 : 0,
    lbi_score > 0 ? 0.20 : 0,
    0.25, 0.15, 0.10
  ].reduce((a, b) => a + b, 0);
  const human_intelligence_score = weight_used > 0
    ? Math.round(his_inputs.reduce((a, b) => a + b, 0) / weight_used)
    : Math.round(cognitive_score * 0.5 + emotional_score * 0.3 + behavioural_score * 0.2);

  // State vector
  const state_vector = {
    cognitive: cognitive_score,
    emotional: emotional_score,
    behavioural: behavioural_score,
    developmental: csi_score,
    learning: lbi_score,
    overload_risk: cog?.overload_risk || 'low',
    learning_style: lbi?.learning_style || 'exploratory',
    stage: developmental_stage,
  };

  // Adaptation profile
  const adaptation_profile = {
    preferred_pace: lbi?.learning_style === 'impulsive' ? 'fast' : lbi?.learning_style === 'reflective' ? 'slow' : 'moderate',
    attention_type: Number(lbi?.attention_score || 50) > 65 ? 'focused' : 'distributed',
    optimal_challenge: csi_score > 65 ? 'high' : csi_score > 45 ? 'moderate' : 'low',
    engagement_driver: emotional_score > 65 ? 'intrinsic' : 'extrinsic',
    intervention_readiness: emotional_score > 50 && cognitive_score > 45 ? 'high' : 'low',
  };

  // Intervention responsiveness: higher if emotionally stable and cognitively engaged
  const intervention_responsiveness = Math.round(
    (emotional_score / 100 * 0.5 + cognitive_score / 100 * 0.3 + completionRate * 0.2) * 100
  ) / 100;

  return { csi_score, lbi_score, cognitive_score, emotional_score, behavioural_score,
           developmental_stage, human_intelligence_score, state_vector,
           adaptation_profile, intervention_responsiveness };
}

export function registerDigitalTwinRoutes(app: Express, pool: pg.Pool) {

  // POST /api/twin/synthesize
  app.post('/api/twin/synthesize', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const client = await pool.connect();
    try {
      const twin = await synthesizeTwin(email, client);
      const existing = await client.query('SELECT twin_version FROM human_digital_twins WHERE user_email=$1', [email]);
      const twin_version = (existing.rows[0]?.twin_version || 0) + 1;

      await client.query(
        `INSERT INTO human_digital_twins
           (user_email,csi_score,lbi_score,cognitive_score,emotional_score,behavioural_score,
            developmental_stage,human_intelligence_score,state_vector,adaptation_profile,
            intervention_responsiveness,twin_version,last_updated)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         ON CONFLICT (user_email) DO UPDATE SET
           csi_score=$2,lbi_score=$3,cognitive_score=$4,emotional_score=$5,behavioural_score=$6,
           developmental_stage=$7,human_intelligence_score=$8,state_vector=$9,adaptation_profile=$10,
           intervention_responsiveness=$11,twin_version=$12,last_updated=NOW()`,
        [email, twin.csi_score, twin.lbi_score, twin.cognitive_score, twin.emotional_score,
         twin.behavioural_score, twin.developmental_stage, twin.human_intelligence_score,
         JSON.stringify(twin.state_vector), JSON.stringify(twin.adaptation_profile),
         twin.intervention_responsiveness, twin_version]
      );

      // Save state snapshot to history
      await client.query(
        `INSERT INTO twin_state_history (user_email, state_snapshot, trigger_event, human_intelligence_score, captured_at)
         VALUES ($1,$2,'manual_synthesis',$3,NOW())`,
        [email, JSON.stringify(twin.state_vector), twin.human_intelligence_score]
      );

      res.json({ success: true, twin: { ...twin, twin_version } });
    } catch (err) {
      console.error('Twin synthesize error:', err);
      res.status(500).json({ error: 'synthesis failed' });
    } finally { client.release(); }
  });

  // POST /api/twin/synthesize-all
  app.post('/api/twin/synthesize-all', async (_req, res) => {
    res.json({ message: 'twin synthesis started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const users = await client.query(
          `SELECT DISTINCT guest_email FROM capadex_sessions WHERE guest_email IS NOT NULL AND guest_email != '' LIMIT 500`
        );
        for (const u of users.rows) {
          try {
            const twin = await synthesizeTwin(u.guest_email, client);
            const existing = await client.query('SELECT twin_version FROM human_digital_twins WHERE user_email=$1', [u.guest_email]);
            const twin_version = (existing.rows[0]?.twin_version || 0) + 1;
            await client.query(
              `INSERT INTO human_digital_twins (user_email,csi_score,lbi_score,cognitive_score,emotional_score,behavioural_score,developmental_stage,human_intelligence_score,state_vector,adaptation_profile,intervention_responsiveness,twin_version,last_updated)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) ON CONFLICT (user_email) DO UPDATE SET csi_score=$2,lbi_score=$3,cognitive_score=$4,emotional_score=$5,behavioural_score=$6,developmental_stage=$7,human_intelligence_score=$8,state_vector=$9,adaptation_profile=$10,intervention_responsiveness=$11,twin_version=$12,last_updated=NOW()`,
              [u.guest_email,twin.csi_score,twin.lbi_score,twin.cognitive_score,twin.emotional_score,twin.behavioural_score,twin.developmental_stage,twin.human_intelligence_score,JSON.stringify(twin.state_vector),JSON.stringify(twin.adaptation_profile),twin.intervention_responsiveness,twin_version]
            );
            await client.query(
              `INSERT INTO twin_state_history (user_email,state_snapshot,trigger_event,human_intelligence_score,captured_at) VALUES ($1,$2,'batch_synthesis',$3,NOW())`,
              [u.guest_email, JSON.stringify(twin.state_vector), twin.human_intelligence_score]
            );
          } catch { /* skip */ }
        }
      } finally { client.release(); }
    })();
  });

  // GET /api/admin/twins
  app.get('/api/admin/twins', async (req, res) => {
    const { page='1', limit='25', stage, search } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (stage) { params.push(stage); where.push(`developmental_stage=$${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`user_email ILIKE $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const [countRes, rows, kpi, stageDist] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM human_digital_twins ${wc}`, params),
        pool.query(
          `SELECT * FROM human_digital_twins ${wc} ORDER BY human_intelligence_score DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
        pool.query(`SELECT COUNT(*) as total,
          ROUND(AVG(human_intelligence_score)::numeric,1) as avg_his,
          ROUND(AVG(csi_score)::numeric,1) as avg_csi,
          ROUND(AVG(lbi_score)::numeric,1) as avg_lbi,
          ROUND(AVG(cognitive_score)::numeric,1) as avg_cognitive,
          ROUND(AVG(emotional_score)::numeric,1) as avg_emotional,
          ROUND(AVG(behavioural_score)::numeric,1) as avg_behavioural,
          MAX(twin_version) as max_version FROM human_digital_twins`),
        pool.query(`SELECT developmental_stage, COUNT(*) as cnt FROM human_digital_twins GROUP BY developmental_stage ORDER BY cnt DESC`),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows,
                 kpi: kpi.rows[0], stage_distribution: stageDist.rows });
    } catch (err) {
      console.error('Twins fetch error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/twins/analytics  ← must be registered BEFORE /:email
  app.get('/api/admin/twins/analytics', async (_req, res) => {
    try {
      const [kpi, stageDist, hisDist] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total,
          ROUND(AVG(human_intelligence_score)::numeric,1) as avg_his,
          ROUND(AVG(csi_score)::numeric,1) as avg_csi,
          ROUND(AVG(cognitive_score)::numeric,1) as avg_cognitive,
          ROUND(AVG(emotional_score)::numeric,1) as avg_emotional,
          COUNT(*) FILTER (WHERE human_intelligence_score>=75) as advanced_count,
          COUNT(*) FILTER (WHERE human_intelligence_score<40) as low_count
          FROM human_digital_twins`),
        pool.query(`SELECT developmental_stage, COUNT(*) as cnt, ROUND(AVG(human_intelligence_score)::numeric,1) as avg_his FROM human_digital_twins GROUP BY developmental_stage`),
        pool.query(`SELECT width_bucket(human_intelligence_score,0,100,10)*10 as bucket, COUNT(*) as cnt FROM human_digital_twins GROUP BY bucket ORDER BY bucket`),
      ]);
      res.json({ kpi: kpi.rows[0], stage_distribution: stageDist.rows, his_distribution: hisDist.rows });
    } catch (err) {
      console.error('Twin analytics error:', err);
      res.status(500).json({ error: 'analytics failed' });
    }
  });

  // GET /api/admin/twins/:email  ← must be AFTER /analytics
  app.get('/api/admin/twins/:email', async (req, res) => {
    const { email } = req.params;
    try {
      const [twin, history] = await Promise.all([
        pool.query('SELECT * FROM human_digital_twins WHERE user_email=$1', [email]),
        pool.query('SELECT * FROM twin_state_history WHERE user_email=$1 ORDER BY captured_at DESC LIMIT 20', [email]),
      ]);
      if (!twin.rows[0]) return res.status(404).json({ error: 'twin not found' });
      res.json({ twin: twin.rows[0], history: history.rows });
    } catch (err) {
      console.error('Twin detail error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });
}
