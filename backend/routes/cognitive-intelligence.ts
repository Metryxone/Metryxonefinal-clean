import type { Express } from "express";
import pg from "pg";
import { normalizeStoredStage, stageOrder } from "../lib/lifecycle";

type CogProfile = {
  working_memory_score: number;
  attention_stability: number;
  cognitive_flexibility: number;
  processing_depth: number;
  metacognition_score: number;
  reasoning_style: string;
  cognitive_fatigue_level: number;
  overload_risk: string;
  composite_cognitive_score: number;
};

async function computeCognitiveProfile(email: string, client: pg.PoolClient): Promise<CogProfile> {
  const [sessRes, sigRes, lbiRes] = await Promise.all([
    client.query(
      `SELECT id, stage_code, status, score, total_items, time_taken_s, concern_name, created_at
       FROM capadex_sessions WHERE guest_email=$1 ORDER BY created_at ASC`,
      [email]
    ),
    client.query(
      `SELECT signal_type, severity_level, COUNT(*) as cnt FROM behavioural_signals
       WHERE user_email=$1 GROUP BY signal_type, severity_level`,
      [email]
    ),
    client.query(`SELECT * FROM lbi_scores WHERE user_email=$1`, [email]),
  ]);
  const sessions = sessRes.rows;
  const sigs = sigRes.rows;
  const lbi = lbiRes.rows[0];
  const completed = sessions.filter(s => s.status === 'completed');

  // Working memory: low variance in scores across completed sessions = better WM
  let working_memory_score = 55;
  if (completed.length >= 2) {
    const scores = completed.map(s => Number(s.score) || 50);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.map(s => (s - mean) ** 2).reduce((a, b) => a + b, 0) / scores.length;
    working_memory_score = Math.round(Math.max(20, Math.min(100, 100 - Math.sqrt(variance) * 1.5)));
  }

  // Attention stability: low variance in time-per-item = stable attention
  let attention_stability = 55;
  const timedSessions = completed.filter(s => Number(s.time_taken_s) > 0 && Number(s.total_items) > 0);
  if (timedSessions.length >= 2) {
    const perItem = timedSessions.map(s => Number(s.time_taken_s) / Number(s.total_items));
    const mean = perItem.reduce((a, b) => a + b, 0) / perItem.length;
    const variance = perItem.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / perItem.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    attention_stability = Math.round(Math.max(20, Math.min(100, 100 - cv * 60)));
  }
  // Reduce if cognitive high-severity signals exist
  const cogHigh = sigs.filter(s => s.signal_type === 'cognitive' && s.severity_level === 'high').length;
  if (cogHigh > 0) attention_stability = Math.max(20, attention_stability - cogHigh * 10);

  // Cognitive flexibility: variety of concerns and stages engaged
  const concerns = new Set(sessions.map(s => s.concern_name)).size;
  const stages = new Set(sessions.map(s => s.stage_code)).size;
  const cognitive_flexibility = Math.min(100, Math.round(20 + concerns * 8 + stages * 10));

  // Processing depth: avg score in advanced stages (at or beyond Growth, CAP_GRW)
  const DEEP_MIN_ORDER = stageOrder('CAP_GRW');
  const deepSessions = completed.filter(s => normalizeStoredStage(s.stage_code).order >= DEEP_MIN_ORDER);
  let processing_depth = 45;
  if (deepSessions.length > 0) {
    processing_depth = Math.round(deepSessions.reduce((a, s) => a + (Number(s.score) || 50), 0) / deepSessions.length);
  } else if (completed.length > 0) {
    processing_depth = Math.round(completed.reduce((a, s) => a + (Number(s.score) || 50), 0) / completed.length * 0.8);
  }

  // Metacognition: concern revisit with improvement
  const concernMap: Record<string, number[]> = {};
  for (const s of completed) {
    if (!concernMap[s.concern_name]) concernMap[s.concern_name] = [];
    concernMap[s.concern_name].push(Number(s.score) || 0);
  }
  let revisitsWithImprovement = 0;
  let totalRevisits = 0;
  for (const scores of Object.values(concernMap)) {
    if (scores.length > 1) {
      totalRevisits++;
      if (scores[scores.length - 1] > scores[0]) revisitsWithImprovement++;
    }
  }
  const metacognition_score = totalRevisits > 0
    ? Math.round(40 + (revisitsWithImprovement / totalRevisits) * 55)
    : 45;

  // Reasoning style: derived from LBI + session patterns
  let reasoning_style = 'analytical';
  if (lbi) {
    if (lbi.learning_style === 'impulsive') reasoning_style = 'intuitive';
    else if (lbi.learning_style === 'reflective') reasoning_style = 'sequential';
    else if (lbi.learning_style === 'exploratory' && cognitive_flexibility > 60) reasoning_style = 'adaptive';
    else if (lbi.learning_style === 'persistent' && processing_depth > 65) reasoning_style = 'analytical';
    else reasoning_style = 'visual';
  }

  // Cognitive fatigue: score decline across sessions in chronological order
  let cognitive_fatigue_level = 20;
  if (completed.length >= 4) {
    const half = Math.ceil(completed.length / 2);
    const earlyAvg = completed.slice(0, half).reduce((a, s) => a + Number(s.score || 50), 0) / half;
    const lateAvg  = completed.slice(half).reduce((a, s) => a + Number(s.score || 50), 0) / (completed.length - half);
    const decline = earlyAvg - lateAvg;
    cognitive_fatigue_level = Math.round(Math.max(10, Math.min(90, 20 + decline * 1.5)));
  }
  const execHigh = sigs.filter(s => s.signal_type === 'executive_function' && s.severity_level === 'high').length;
  cognitive_fatigue_level = Math.min(90, cognitive_fatigue_level + execHigh * 15);

  // Overload risk
  const emotHigh = sigs.filter(s => s.signal_type === 'emotional' && s.severity_level === 'high').length;
  const totalHighSev = cogHigh + emotHigh + execHigh;
  let overload_risk = 'low';
  if (totalHighSev >= 5 || cognitive_fatigue_level > 65) overload_risk = 'critical';
  else if (totalHighSev >= 3 || cognitive_fatigue_level > 45) overload_risk = 'high';
  else if (totalHighSev >= 1 || cognitive_fatigue_level > 30) overload_risk = 'medium';

  const composite_cognitive_score = Math.round(
    working_memory_score * 0.25 +
    attention_stability   * 0.25 +
    cognitive_flexibility * 0.15 +
    processing_depth      * 0.20 +
    metacognition_score   * 0.15
  );

  return { working_memory_score, attention_stability, cognitive_flexibility,
           processing_depth, metacognition_score, reasoning_style,
           cognitive_fatigue_level, overload_risk, composite_cognitive_score };
}

async function detectHumanState(email: string, profile: CogProfile, client: pg.PoolClient) {
  const [sigRes, sessRes] = await Promise.all([
    client.query(
      `SELECT signal_type, severity_level FROM behavioural_signals WHERE user_email=$1 ORDER BY captured_at DESC LIMIT 20`,
      [email]
    ),
    client.query(
      `SELECT score, status, created_at FROM capadex_sessions WHERE guest_email=$1 ORDER BY created_at DESC LIMIT 6`,
      [email]
    ),
  ]);
  const sigs = sigRes.rows;
  const recentSessions = sessRes.rows;

  const emotHigh = sigs.filter(s => s.signal_type === 'emotional' && s.severity_level === 'high').length;
  const cogHigh  = sigs.filter(s => s.signal_type === 'cognitive'  && s.severity_level === 'high').length;
  const completed = recentSessions.filter(s => s.status === 'completed');
  const avgScore  = completed.length > 0
    ? completed.reduce((a, s) => a + Number(s.score || 0), 0) / completed.length
    : 50;

  // Score trend
  const compScores = completed.map(s => Number(s.score || 0));
  const improving  = compScores.length >= 2 && compScores[0] > compScores[compScores.length - 1];
  const declining  = compScores.length >= 2 && compScores[0] < compScores[compScores.length - 1];

  let state_type = 'stable';
  let confidence = 0.60;
  const triggers: string[] = [];

  if (avgScore >= 75 && profile.attention_stability > 65 && emotHigh === 0) {
    state_type = 'flow'; confidence = 0.78;
    triggers.push('high_score', 'stable_attention', 'no_emotional_distress');
  } else if (emotHigh >= 2 && cogHigh >= 1 && declining) {
    state_type = 'burnout'; confidence = 0.80;
    triggers.push('emotional_high', 'cognitive_overload', 'declining_scores');
  } else if (emotHigh >= 2 && cogHigh === 0) {
    state_type = 'stressed'; confidence = 0.72;
    triggers.push('emotional_high');
  } else if (profile.overload_risk === 'critical' || profile.overload_risk === 'high') {
    state_type = 'overloaded'; confidence = 0.75;
    triggers.push('overload_risk_detected', 'high_fatigue');
  } else if (completed.length > 0 && avgScore < 35) {
    state_type = 'disengaged'; confidence = 0.68;
    triggers.push('low_scores', 'low_completion');
  } else if (improving && profile.metacognition_score > 55) {
    state_type = 'resilient'; confidence = 0.70;
    triggers.push('score_recovery', 'metacognitive_engagement');
  } else if (emotHigh >= 1 && avgScore < 50) {
    state_type = 'suppressed'; confidence = 0.65;
    triggers.push('emotional_signals', 'below_average_performance');
  }

  await client.query(
    `INSERT INTO human_state_snapshots (user_email, state_type, confidence, trigger_signals, detected_at)
     VALUES ($1,$2,$3,$4,NOW())`,
    [email, state_type, confidence, JSON.stringify(triggers)]
  );
  return { state_type, confidence, triggers };
}

async function computeMetaLearning(email: string, client: pg.PoolClient) {
  const [sessRes, lbiRes] = await Promise.all([
    client.query(
      `SELECT stage_code, status, score, time_taken_s, total_items, concern_name, created_at
       FROM capadex_sessions WHERE guest_email=$1 ORDER BY created_at ASC`,
      [email]
    ),
    client.query(`SELECT * FROM lbi_scores WHERE user_email=$1`, [email]),
  ]);
  const sessions = sessRes.rows;
  const lbi = lbiRes.rows[0];
  const completed = sessions.filter(s => s.status === 'completed');

  // Primary style based on LBI + behavioural patterns
  let primary_style = 'exploratory';
  let secondary_style = 'reflective';
  const evidence: Record<string, unknown> = {};

  if (lbi) {
    if (lbi.learning_style === 'impulsive') { primary_style = 'challenge_driven'; secondary_style = 'exploratory'; }
    else if (lbi.learning_style === 'reflective') { primary_style = 'reflective'; secondary_style = 'visual'; }
    else if (lbi.learning_style === 'persistent') { primary_style = 'reinforcement'; secondary_style = 'reflective'; }
    else if (lbi.learning_style === 'disengaged') { primary_style = 'visual'; secondary_style = 'exploratory'; }
    else { primary_style = 'exploratory'; secondary_style = 'challenge_driven'; }
    evidence.lbi_style = lbi.learning_style;
    evidence.persistence = lbi.persistence_score;
    evidence.velocity = lbi.velocity_score;
  }

  // Optimal session length: avg of HIGH-SCORING sessions
  const highSessions = completed.filter(s => Number(s.score) >= 65 && Number(s.time_taken_s) > 0);
  const optimal_session_length_min = highSessions.length > 0
    ? Math.round(highSessions.reduce((a, s) => a + Number(s.time_taken_s), 0) / highSessions.length / 60 * 10) / 10
    : 15;

  // Optimal difficulty — "advanced" stages are those at or beyond Growth (CAP_GRW),
  // resolved through the shared lifecycle rulebook so the threshold can never drift.
  const ADVANCED_MIN_ORDER = stageOrder('CAP_GRW');
  const advancedScores: number[] = [];
  for (const s of completed) {
    const { order } = normalizeStoredStage(s.stage_code);
    if (order >= ADVANCED_MIN_ORDER) advancedScores.push(Number(s.score) || 0);
  }
  const hasAdvanced = advancedScores.length > 0;
  const advAvg = hasAdvanced ? advancedScores.reduce((a, b) => a + b, 0) / advancedScores.length : 0;
  let optimal_difficulty = 'moderate';
  if (advAvg >= 70) optimal_difficulty = 'challenging';
  else if (hasAdvanced) optimal_difficulty = 'moderate';
  else optimal_difficulty = 'easy';

  // Pacing
  const avgPerItem = timedAvg(completed);
  let pacing = 'self_paced';
  if (lbi && lbi.learning_style === 'impulsive') pacing = 'intensive';
  else if (lbi && lbi.learning_style === 'reflective') pacing = 'guided';
  else if (avgPerItem > 12) pacing = 'guided';
  else if (avgPerItem < 3) pacing = 'intensive';

  // Learning velocity from LBI
  const learning_velocity = lbi ? Number(lbi.velocity_score) : 45;

  // Feedback preference
  const feedback_preference = lbi && lbi.learning_style === 'reflective' ? 'delayed' :
    lbi && lbi.learning_style === 'impulsive' ? 'immediate' : 'immediate';

  const adaptation_responsiveness = lbi ? Math.round((Number(lbi.adaptability_score) / 100) * 100) / 100 : 0.60;

  return { primary_style, secondary_style, optimal_session_length_min, optimal_difficulty,
           feedback_preference, pacing, learning_velocity, adaptation_responsiveness,
           style_evidence: evidence };
}

function timedAvg(sessions: { time_taken_s: unknown; total_items: unknown }[]): number {
  const valid = sessions.filter(s => Number(s.time_taken_s) > 0 && Number(s.total_items) > 0);
  if (!valid.length) return 10;
  return valid.reduce((a, s) => a + Number(s.time_taken_s) / Number(s.total_items), 0) / valid.length;
}

export function registerCognitiveIntelligenceRoutes(app: Express, pool: pg.Pool) {

  // POST /api/cognitive/compute
  app.post('/api/cognitive/compute', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const client = await pool.connect();
    try {
      const profile = await computeCognitiveProfile(email, client);
      await client.query(
        `INSERT INTO cognitive_profiles
           (user_email,working_memory_score,attention_stability,cognitive_flexibility,processing_depth,
            metacognition_score,reasoning_style,cognitive_fatigue_level,overload_risk,composite_cognitive_score,calculated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (user_email) DO UPDATE SET
           working_memory_score=$2,attention_stability=$3,cognitive_flexibility=$4,processing_depth=$5,
           metacognition_score=$6,reasoning_style=$7,cognitive_fatigue_level=$8,overload_risk=$9,
           composite_cognitive_score=$10,calculated_at=NOW()`,
        [email, profile.working_memory_score, profile.attention_stability, profile.cognitive_flexibility,
         profile.processing_depth, profile.metacognition_score, profile.reasoning_style,
         profile.cognitive_fatigue_level, profile.overload_risk, profile.composite_cognitive_score]
      );
      const state = await detectHumanState(email, profile, client);
      const ml = await computeMetaLearning(email, client);
      await client.query(
        `INSERT INTO meta_learning_profiles
           (user_email,primary_style,secondary_style,optimal_session_length_min,optimal_difficulty,
            feedback_preference,pacing,learning_velocity,adaptation_responsiveness,style_evidence,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (user_email) DO UPDATE SET
           primary_style=$2,secondary_style=$3,optimal_session_length_min=$4,optimal_difficulty=$5,
           feedback_preference=$6,pacing=$7,learning_velocity=$8,adaptation_responsiveness=$9,
           style_evidence=$10,updated_at=NOW()`,
        [email, ml.primary_style, ml.secondary_style, ml.optimal_session_length_min, ml.optimal_difficulty,
         ml.feedback_preference, ml.pacing, ml.learning_velocity, ml.adaptation_responsiveness,
         JSON.stringify(ml.style_evidence)]
      );
      res.json({ success: true, profile, state, meta_learning: ml });
    } catch (err) {
      console.error('Cognitive compute error:', err);
      res.status(500).json({ error: 'compute failed' });
    } finally { client.release(); }
  });

  // POST /api/cognitive/compute-all
  app.post('/api/cognitive/compute-all', async (_req, res) => {
    res.json({ message: 'cognitive computation started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const users = await client.query(`SELECT DISTINCT guest_email FROM capadex_sessions WHERE guest_email IS NOT NULL AND guest_email != '' LIMIT 500`);
        for (const u of users.rows) {
          try {
            const profile = await computeCognitiveProfile(u.guest_email, client);
            await client.query(
              `INSERT INTO cognitive_profiles (user_email,working_memory_score,attention_stability,cognitive_flexibility,processing_depth,metacognition_score,reasoning_style,cognitive_fatigue_level,overload_risk,composite_cognitive_score,calculated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (user_email) DO UPDATE SET working_memory_score=$2,attention_stability=$3,cognitive_flexibility=$4,processing_depth=$5,metacognition_score=$6,reasoning_style=$7,cognitive_fatigue_level=$8,overload_risk=$9,composite_cognitive_score=$10,calculated_at=NOW()`,
              [u.guest_email,profile.working_memory_score,profile.attention_stability,profile.cognitive_flexibility,profile.processing_depth,profile.metacognition_score,profile.reasoning_style,profile.cognitive_fatigue_level,profile.overload_risk,profile.composite_cognitive_score]
            );
            await detectHumanState(u.guest_email, profile, client);
            const ml = await computeMetaLearning(u.guest_email, client);
            await client.query(
              `INSERT INTO meta_learning_profiles (user_email,primary_style,secondary_style,optimal_session_length_min,optimal_difficulty,feedback_preference,pacing,learning_velocity,adaptation_responsiveness,style_evidence,updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (user_email) DO UPDATE SET primary_style=$2,secondary_style=$3,optimal_session_length_min=$4,optimal_difficulty=$5,feedback_preference=$6,pacing=$7,learning_velocity=$8,adaptation_responsiveness=$9,style_evidence=$10,updated_at=NOW()`,
              [u.guest_email,ml.primary_style,ml.secondary_style,ml.optimal_session_length_min,ml.optimal_difficulty,ml.feedback_preference,ml.pacing,ml.learning_velocity,ml.adaptation_responsiveness,JSON.stringify(ml.style_evidence)]
            );
          } catch { /* skip */ }
        }
      } finally { client.release(); }
    })();
  });

  // GET /api/admin/cognitive/profiles
  app.get('/api/admin/cognitive/profiles', async (req, res) => {
    const { page='1', limit='25', overload, search } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (overload) { params.push(overload); where.push(`cp.overload_risk=$${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`cp.user_email ILIKE $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const [countRes, rows, kpi, states, metaStyles] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM cognitive_profiles cp ${wc}`, params),
        pool.query(
          `SELECT cp.*, ml.primary_style, ml.pacing, ml.optimal_difficulty
           FROM cognitive_profiles cp LEFT JOIN meta_learning_profiles ml ON ml.user_email=cp.user_email
           ${wc} ORDER BY cp.calculated_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
        pool.query(`SELECT ROUND(AVG(composite_cognitive_score)::numeric,1) as avg_cognitive,
          ROUND(AVG(working_memory_score)::numeric,1) as avg_wm,
          ROUND(AVG(attention_stability)::numeric,1) as avg_attention,
          ROUND(AVG(processing_depth)::numeric,1) as avg_depth,
          COUNT(*) FILTER (WHERE overload_risk='critical') as critical_overload,
          COUNT(*) FILTER (WHERE overload_risk='high') as high_overload
          FROM cognitive_profiles`),
        pool.query(`SELECT state_type, COUNT(*) as cnt FROM human_state_snapshots
          WHERE detected_at > NOW()-INTERVAL '7 days' GROUP BY state_type ORDER BY cnt DESC`),
        pool.query(`SELECT primary_style, COUNT(*) as cnt FROM meta_learning_profiles GROUP BY primary_style ORDER BY cnt DESC`),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows,
                 kpi: kpi.rows[0], recent_states: states.rows, meta_styles: metaStyles.rows });
    } catch (err) {
      console.error('Cognitive profiles error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/cognitive/profiles/:email
  app.get('/api/admin/cognitive/profiles/:email', async (req, res) => {
    const { email } = req.params;
    const client = await pool.connect();
    try {
      let profile = (await client.query('SELECT * FROM cognitive_profiles WHERE user_email=$1', [email])).rows[0];
      if (!profile) {
        const computed = await computeCognitiveProfile(email, client);
        await client.query(
          `INSERT INTO cognitive_profiles (user_email,working_memory_score,attention_stability,cognitive_flexibility,processing_depth,metacognition_score,reasoning_style,cognitive_fatigue_level,overload_risk,composite_cognitive_score,calculated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (user_email) DO NOTHING`,
          [email,...Object.values(computed)]
        );
        profile = { user_email: email, ...computed };
      }
      const [ml, states] = await Promise.all([
        client.query('SELECT * FROM meta_learning_profiles WHERE user_email=$1', [email]),
        client.query('SELECT * FROM human_state_snapshots WHERE user_email=$1 ORDER BY detected_at DESC LIMIT 10', [email]),
      ]);
      res.json({ profile, meta_learning: ml.rows[0], states: states.rows });
    } catch (err) {
      console.error('Cognitive profile detail error:', err);
      res.status(500).json({ error: 'fetch failed' });
    } finally { client.release(); }
  });

  // GET /api/admin/cognitive/states
  app.get('/api/admin/cognitive/states', async (req, res) => {
    const { days='7' } = req.query as Record<string,string>;
    try {
      const [dist, recent] = await Promise.all([
        pool.query(
          `SELECT state_type, COUNT(*) as cnt, ROUND(AVG(confidence)::numeric,2) as avg_confidence
           FROM human_state_snapshots WHERE detected_at > NOW()-INTERVAL '${parseInt(days)} days'
           GROUP BY state_type ORDER BY cnt DESC`
        ),
        pool.query(
          `SELECT * FROM human_state_snapshots ORDER BY detected_at DESC LIMIT 50`
        ),
      ]);
      res.json({ distribution: dist.rows, recent: recent.rows });
    } catch (err) {
      console.error('Human states error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });
}
