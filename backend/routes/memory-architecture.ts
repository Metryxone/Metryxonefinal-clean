import type { Express } from "express";
import pg from "pg";

async function consolidateEpisodicMemory(email: string, client: pg.PoolClient) {
  const sessions = await client.query(
    `SELECT id, stage_code, status, score, concern_name, time_taken_s, total_items, created_at
     FROM capadex_sessions WHERE guest_email=$1 AND status='completed' ORDER BY created_at DESC LIMIT 20`,
    [email]
  );
  const inserted: string[] = [];
  for (const s of sessions.rows) {
    const existing = await client.query(
      `SELECT id FROM episodic_memory WHERE user_email=$1 AND session_id=$2`, [email, s.id]
    );
    if (existing.rows.length > 0) continue;

    const score = Number(s.score) || 0;
    const emotional_valence = score >= 70 ? 'positive' : score >= 45 ? 'neutral' : 'negative';
    const significance_score = Math.round(
      (score / 100 * 0.5 + (s.stage_code === 'CAP_MAS' ? 0.3 : s.stage_code === 'CAP_GRW' ? 0.2 : 0.1)) * 100
    ) / 100;

    const summary = {
      stage_code: s.stage_code,
      score,
      concern_name: s.concern_name,
      time_taken_s: s.time_taken_s,
      total_items: s.total_items,
      performance_label: score >= 70 ? 'strong' : score >= 50 ? 'moderate' : 'needs_improvement',
      date: s.created_at,
    };

    await client.query(
      `INSERT INTO episodic_memory (user_email,episode_type,episode_summary,emotional_valence,significance_score,concern_name,session_id,created_at)
       VALUES ($1,'session',$2,$3,$4,$5,$6,$7)`,
      [email, JSON.stringify(summary), emotional_valence, significance_score, s.concern_name, s.id, s.created_at]
    );
    inserted.push(s.id);
  }
  return inserted.length;
}

async function consolidateBehaviouralMemory(email: string, client: pg.PoolClient) {
  const sigs = await client.query(
    `SELECT signal_type, severity_level, COUNT(*) as cnt FROM behavioural_signals
     WHERE user_email=$1 GROUP BY signal_type, severity_level`,
    [email]
  );
  for (const sig of sigs.rows) {
    const key = `${sig.signal_type}_${sig.severity_level}`;
    await client.query(
      `INSERT INTO behavioural_memory (user_email,memory_key,memory_value,decay_factor,reinforcement_count,last_reinforced)
       VALUES ($1,$2,$3,1.0,$4,NOW())
       ON CONFLICT (user_email,memory_key) DO UPDATE SET
         memory_value=EXCLUDED.memory_value,
         reinforcement_count=behavioural_memory.reinforcement_count+1,
         last_reinforced=NOW()`,
      [email, key, JSON.stringify({ signal_type: sig.signal_type, severity_level: sig.severity_level, count: parseInt(sig.cnt) }), parseInt(sig.cnt)]
    );
  }

  // LBI summary memory
  const lbi = await client.query(`SELECT * FROM lbi_scores WHERE user_email=$1`, [email]);
  if (lbi.rows[0]) {
    await client.query(
      `INSERT INTO behavioural_memory (user_email,memory_key,memory_value,decay_factor,reinforcement_count,last_reinforced)
       VALUES ($1,'lbi_profile',$2,0.9,1,NOW())
       ON CONFLICT (user_email,memory_key) DO UPDATE SET memory_value=EXCLUDED.memory_value,last_reinforced=NOW()`,
      [email, JSON.stringify({ overall_lbi: lbi.rows[0].overall_lbi, learning_style: lbi.rows[0].learning_style, sessions_analyzed: lbi.rows[0].sessions_analyzed })]
    );
  }
}

export function registerMemoryArchitectureRoutes(app: Express, pool: pg.Pool) {

  // POST /api/memory/consolidate
  app.post('/api/memory/consolidate', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const client = await pool.connect();
    try {
      const episodicCount = await consolidateEpisodicMemory(email, client);
      await consolidateBehaviouralMemory(email, client);
      res.json({ success: true, episodic_memories_created: episodicCount });
    } catch (err) {
      console.error('Memory consolidate error:', err);
      res.status(500).json({ error: 'consolidation failed' });
    } finally { client.release(); }
  });

  // POST /api/memory/consolidate-all
  app.post('/api/memory/consolidate-all', async (_req, res) => {
    res.json({ message: 'memory consolidation started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const users = await client.query(`SELECT DISTINCT guest_email FROM capadex_sessions WHERE guest_email IS NOT NULL AND guest_email != '' LIMIT 500`);
        for (const u of users.rows) {
          try {
            await consolidateEpisodicMemory(u.guest_email, client);
            await consolidateBehaviouralMemory(u.guest_email, client);
          } catch { /* skip */ }
        }
      } finally { client.release(); }
    })();
  });

  // POST /api/memory/intervention
  app.post('/api/memory/intervention', async (req, res) => {
    const { email, intervention_type, intervention_detail, effectiveness_rating, outcome_notes } = req.body;
    if (!email || !intervention_type) return res.status(400).json({ error: 'email and intervention_type required' });
    try {
      const row = await pool.query(
        `INSERT INTO intervention_memory (user_email,intervention_type,intervention_detail,effectiveness_rating,outcome_notes,administered_at)
         VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
        [email, intervention_type, intervention_detail||null, effectiveness_rating||null, outcome_notes||null]
      );
      res.json({ success: true, memory: row.rows[0] });
    } catch (err) {
      console.error('Intervention memory error:', err);
      res.status(500).json({ error: 'store failed' });
    }
  });

  // GET /api/admin/memory/dashboard
  app.get('/api/admin/memory/dashboard', async (_req, res) => {
    try {
      const [episodicKpi, behaviouralKpi, interventionKpi, recentEpisodic, topInterventions, valenceDist] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total_episodes, COUNT(DISTINCT user_email) as unique_users,
          ROUND(AVG(significance_score)::numeric,2) as avg_significance,
          COUNT(*) FILTER (WHERE emotional_valence='positive') as positive_episodes,
          COUNT(*) FILTER (WHERE emotional_valence='negative') as negative_episodes,
          COUNT(*) FILTER (WHERE emotional_valence='neutral') as neutral_episodes
          FROM episodic_memory`),
        pool.query(`SELECT COUNT(*) as total_keys, COUNT(DISTINCT user_email) as unique_users,
          ROUND(AVG(reinforcement_count)::numeric,1) as avg_reinforcement FROM behavioural_memory`),
        pool.query(`SELECT COUNT(*) as total_interventions, COUNT(DISTINCT user_email) as unique_users,
          ROUND(AVG(effectiveness_rating)::numeric,2) as avg_effectiveness FROM intervention_memory`),
        pool.query(`SELECT em.*, em.episode_summary FROM episodic_memory em ORDER BY created_at DESC LIMIT 15`),
        pool.query(`SELECT intervention_type, COUNT(*) as cnt,
          ROUND(AVG(effectiveness_rating)::numeric,2) as avg_effectiveness
          FROM intervention_memory GROUP BY intervention_type ORDER BY cnt DESC LIMIT 8`),
        pool.query(`SELECT emotional_valence, COUNT(*) as cnt FROM episodic_memory GROUP BY emotional_valence`),
      ]);
      res.json({
        episodic_kpi: episodicKpi.rows[0],
        behavioural_kpi: behaviouralKpi.rows[0],
        intervention_kpi: interventionKpi.rows[0],
        recent_episodes: recentEpisodic.rows,
        top_interventions: topInterventions.rows,
        valence_distribution: valenceDist.rows,
      });
    } catch (err) {
      console.error('Memory dashboard error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/memory/episodes/:email
  app.get('/api/admin/memory/episodes/:email', async (req, res) => {
    const { email } = req.params;
    try {
      const [episodes, behavioural, interventions] = await Promise.all([
        pool.query(`SELECT * FROM episodic_memory WHERE user_email=$1 ORDER BY created_at DESC LIMIT 50`, [email]),
        pool.query(`SELECT * FROM behavioural_memory WHERE user_email=$1 ORDER BY reinforcement_count DESC`, [email]),
        pool.query(`SELECT * FROM intervention_memory WHERE user_email=$1 ORDER BY administered_at DESC`, [email]),
      ]);
      res.json({ episodes: episodes.rows, behavioural_keys: behavioural.rows, interventions: interventions.rows });
    } catch (err) {
      console.error('Memory episodes error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });
}
