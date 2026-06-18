import type { Express } from "express";
import pg from "pg";

type GuardMW = (req: any, res: any, next: any) => void;

async function ensureLbiHistorySchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_score_history (
      id              SERIAL PRIMARY KEY,
      user_email      TEXT        NOT NULL,
      consistency_score  INTEGER,
      persistence_score  INTEGER,
      attention_score    INTEGER,
      adaptability_score INTEGER,
      velocity_score     INTEGER,
      overall_lbi        INTEGER,
      learning_style     TEXT,
      sessions_analyzed  INTEGER,
      score_trace        JSONB,
      source             TEXT DEFAULT 'auto',
      calculated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_lbi_score_history_email_at
      ON lbi_score_history(user_email, calculated_at DESC);
  `);
}

async function ensureLbiReportTypesSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_report_types (
      id          SERIAL PRIMARY KEY,
      code        TEXT UNIQUE NOT NULL,
      label       TEXT NOT NULL,
      description TEXT,
      is_active   BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO lbi_report_types (code, label, description) VALUES
      ('standard', 'Standard LBI Report',  'Full 5-dimension learning behaviour profile'),
      ('summary',  'Summary Report',        'Condensed single-page overview'),
      ('parent',   'Parent Report',         'Parent-friendly format with recommendations')
    ON CONFLICT (code) DO NOTHING;
  `);
}

async function enrichWithWcl0(email: string, client: pg.PoolClient): Promise<Record<string, unknown>> {
  try {
    const r = await client.query(
      `SELECT w.segment, w.behaviour, w.persona
       FROM wcl0_user_intelligence w
       WHERE w.user_id = (
         SELECT id FROM capadex_users WHERE LOWER(email)=$1 LIMIT 1
       )
       LIMIT 1`,
      [email.toLowerCase()]
    );
    if (!r.rows[0]) return {};
    return {
      segment:  r.rows[0].segment  ?? null,
      persona:  r.rows[0].persona  ?? null,
      behaviour: r.rows[0].behaviour ?? null,
    };
  } catch {
    return {};
  }
}

async function insertHistory(
  client: pg.PoolClient,
  email: string,
  lbi: ReturnType<typeof makeLBIResult>,
  source = 'auto'
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO lbi_score_history
         (user_email,consistency_score,persistence_score,attention_score,
          adaptability_score,velocity_score,overall_lbi,learning_style,
          sessions_analyzed,score_trace,source,calculated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [email, lbi.consistency_score, lbi.persistence_score, lbi.attention_score,
       lbi.adaptability_score, lbi.velocity_score, lbi.overall_lbi,
       lbi.learning_style, lbi.sessions_analyzed, JSON.stringify(lbi.score_trace), source]
    );
  } catch { }
}

function makeLBIResult(data: {
  consistency_score: number; persistence_score: number; attention_score: number;
  adaptability_score: number; velocity_score: number; overall_lbi: number;
  learning_style: string; sessions_analyzed: number; score_trace: unknown;
}) { return data; }

async function calculateLBI(email: string, client: pg.PoolClient) {
  const sessRes = await client.query(
    `SELECT id, stage_code, status, created_at, concern_name, time_taken_s, total_items, score
     FROM capadex_sessions WHERE guest_email = $1 ORDER BY created_at ASC`,
    [email]
  );
  const sessions = sessRes.rows;
  const total = sessions.length;
  if (total === 0) {
    return { consistency_score: 0, persistence_score: 0, attention_score: 50,
             adaptability_score: 50, velocity_score: 0, overall_lbi: 0,
             learning_style: 'exploratory', sessions_analyzed: 0,
             score_trace: null as unknown };
  }

  const completed = sessions.filter(s => s.status === 'completed');

  const consistency_score = Math.round((completed.length / total) * 100);

  const concernCounts: Record<string, number> = {};
  for (const s of sessions) {
    const key = s.concern_name || 'unknown';
    concernCounts[key] = (concernCounts[key] || 0) + 1;
  }
  const revisited = Object.values(concernCounts).filter(c => c > 1).length;
  const persistence_score = Math.min(100,
    Math.round((revisited / Math.max(1, Object.keys(concernCounts).length)) * 60 + (completed.length > 2 ? 25 : 0))
  );

  const timedSessions = completed.filter(s => s.time_taken_s > 0 && s.total_items > 0);
  let attention_score = 55;
  if (timedSessions.length > 0) {
    const avgPerItem = timedSessions.reduce((sum, s) => sum + (Number(s.time_taken_s) / Number(s.total_items)), 0) / timedSessions.length;
    if (avgPerItem < 2) attention_score = 30;
    else if (avgPerItem < 5) attention_score = 80;
    else if (avgPerItem < 12) attention_score = 70;
    else if (avgPerItem < 25) attention_score = 50;
    else attention_score = 35;
  }

  const stageOrder = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'];
  const stageScores: Record<string, number[]> = {};
  for (const s of completed) {
    if (s.score != null) {
      if (!stageScores[s.stage_code]) stageScores[s.stage_code] = [];
      stageScores[s.stage_code].push(Number(s.score));
    }
  }
  const orderedAvgs = stageOrder
    .map(st => stageScores[st] ? stageScores[st].reduce((a,b)=>a+b,0)/stageScores[st].length : null)
    .filter(v => v !== null) as number[];
  let adaptability_score = 50;
  if (orderedAvgs.length >= 2) {
    const improving = orderedAvgs.slice(1).filter((v,i) => v >= orderedAvgs[i]).length;
    adaptability_score = Math.round(40 + (improving / (orderedAvgs.length - 1)) * 55);
  }

  const firstAt = sessions[0]?.created_at;
  let velocity_score = 20;
  if (firstAt && completed.length > 0) {
    const weeks = Math.max(0.5, (Date.now() - new Date(firstAt).getTime()) / (7 * 86400000));
    velocity_score = Math.min(100, Math.round((completed.length / weeks) * 25));
  }

  const overall_lbi = Math.round(
    consistency_score * 0.25 +
    persistence_score * 0.20 +
    attention_score   * 0.20 +
    adaptability_score* 0.20 +
    velocity_score    * 0.15
  );

  const avgPerItemFinal = timedSessions.length > 0
    ? timedSessions.reduce((s,x) => s + Number(x.time_taken_s)/Number(x.total_items), 0) / timedSessions.length
    : 10;
  let learning_style = 'exploratory';
  if (avgPerItemFinal < 2) learning_style = 'impulsive';
  else if (consistency_score < 35) learning_style = 'disengaged';
  else if (persistence_score > 55) learning_style = 'persistent';
  else if (avgPerItemFinal > 10 && adaptability_score < 55) learning_style = 'reflective';
  else if (Object.keys(concernCounts).length >= 3) learning_style = 'exploratory';

  const wcl0 = await enrichWithWcl0(email, client);

  const score_trace = {
    formula: 'LBI = consistency×0.25 + persistence×0.20 + attention×0.20 + adaptability×0.20 + velocity×0.15',
    dimensions: {
      consistency:  { score: consistency_score,  weight: 0.25, basis: `${completed.length}/${total} sessions completed` },
      persistence:  { score: persistence_score,  weight: 0.20, basis: `${revisited} revisited concern(s)` },
      attention:    { score: attention_score,     weight: 0.20, basis: `${timedSessions.length} timed session(s) analysed` },
      adaptability: { score: adaptability_score, weight: 0.20, basis: `${orderedAvgs.length} stage avg(s) available` },
      velocity:     { score: velocity_score,      weight: 0.15, basis: `${completed.length} completed session(s)` },
    },
    overall_lbi,
    learning_style,
    sessions_analyzed: total,
    computed_at: new Date().toISOString(),
    ...(Object.keys(wcl0).length ? { behaviour_context: wcl0 } : {}),
  };

  return { consistency_score, persistence_score, attention_score, adaptability_score,
           velocity_score, overall_lbi, learning_style, sessions_analyzed: total, score_trace };
}

export async function calculateAndPersistLBI(email: string, pool: pg.Pool): Promise<void> {
  if (!email || email.trim() === '') return;
  const client = await pool.connect();
  try {
    const lbi = await calculateLBI(email, client);
    if (lbi.sessions_analyzed === 0) return;
    await client.query(
      `INSERT INTO lbi_scores
         (user_email,consistency_score,persistence_score,attention_score,
          adaptability_score,velocity_score,overall_lbi,learning_style,sessions_analyzed,score_trace,calculated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (user_email) DO UPDATE SET
         consistency_score=$2,persistence_score=$3,attention_score=$4,
         adaptability_score=$5,velocity_score=$6,overall_lbi=$7,
         learning_style=$8,sessions_analyzed=$9,score_trace=$10,calculated_at=NOW()`,
      [email, lbi.consistency_score, lbi.persistence_score, lbi.attention_score,
       lbi.adaptability_score, lbi.velocity_score, lbi.overall_lbi,
       lbi.learning_style, lbi.sessions_analyzed, JSON.stringify(lbi.score_trace)]
    );
    await insertHistory(client, email, lbi, 'post_completion');
    // Fire intelligence chain fire-and-forget (W3–W8)
    setImmediate(async () => {
      try {
        const { computeAndPersistTrends }         = await import('../services/lbi-trend-engine');
        const { computeAndPersistRisks }           = await import('../services/lbi-risk-engine');
        const { computeAndPersistRecommendations } = await import('../services/lbi-recommendation-engine');
        const { computeAndPersistLongitudinal }    = await import('../services/lbi-longitudinal-engine');
        await computeAndPersistTrends(email, pool);
        await computeAndPersistRisks(email, pool);
        await computeAndPersistRecommendations(email, pool);
        await computeAndPersistLongitudinal(email, pool);
      } catch {}
    });
  } catch (err) {
    console.error('[lbi] calculateAndPersistLBI error:', err);
  } finally {
    client.release();
  }
}

export function registerLBIEngineRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth?: GuardMW,
  requireSuperAdmin?: GuardMW
) {
  const chain = [requireAuth, requireSuperAdmin].filter(Boolean) as GuardMW[];
  const authOnly = [requireAuth].filter(Boolean) as GuardMW[];

  ensureLbiHistorySchema(pool).catch(e =>
    console.error('[lbi] ensureLbiHistorySchema error:', e)
  );
  ensureLbiReportTypesSchema(pool).catch(e =>
    console.error('[lbi] ensureLbiReportTypesSchema error:', e)
  );

  app.post('/api/lbi/calculate', ...authOnly, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const client = await pool.connect();
    try {
      const lbi = await calculateLBI(email, client);
      if (lbi.sessions_analyzed > 0) {
        await client.query(
          `INSERT INTO lbi_scores
             (user_email,consistency_score,persistence_score,attention_score,
              adaptability_score,velocity_score,overall_lbi,learning_style,sessions_analyzed,score_trace,calculated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT (user_email) DO UPDATE SET
             consistency_score=$2,persistence_score=$3,attention_score=$4,
             adaptability_score=$5,velocity_score=$6,overall_lbi=$7,
             learning_style=$8,sessions_analyzed=$9,score_trace=$10,calculated_at=NOW()`,
          [email, lbi.consistency_score, lbi.persistence_score, lbi.attention_score,
           lbi.adaptability_score, lbi.velocity_score, lbi.overall_lbi,
           lbi.learning_style, lbi.sessions_analyzed, JSON.stringify(lbi.score_trace)]
        );
        await insertHistory(client, email, lbi, 'manual');
      }
      res.json({ success: true, lbi });
    } catch (err) {
      console.error('LBI calculate error:', err);
      res.status(500).json({ error: 'calculation failed' });
    } finally { client.release(); }
  });

  app.get('/api/admin/lbi/profiles', ...chain, async (req, res) => {
    const { page='1', limit='25', style, search, sort='overall_lbi', dir='desc' } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (style) { params.push(style); where.push(`learning_style=$${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`user_email ILIKE $${params.length}`); }
    const safeSort = ['overall_lbi','consistency_score','persistence_score','attention_score','adaptability_score','velocity_score','calculated_at'].includes(sort) ? sort : 'overall_lbi';
    const safeDir = dir==='asc'?'ASC':'DESC';
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const countRes = await pool.query(`SELECT COUNT(*) FROM lbi_scores ${wc}`, params);
      const rows = await pool.query(
        `SELECT * FROM lbi_scores ${wc} ORDER BY ${safeSort} ${safeDir} LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]
      );
      const kpi = await pool.query(`
        SELECT ROUND(AVG(overall_lbi)::numeric,1) as avg_lbi,
          ROUND(AVG(consistency_score)::numeric,1) as avg_consistency,
          ROUND(AVG(persistence_score)::numeric,1) as avg_persistence,
          ROUND(AVG(attention_score)::numeric,1) as avg_attention,
          ROUND(AVG(adaptability_score)::numeric,1) as avg_adaptability,
          ROUND(AVG(velocity_score)::numeric,1) as avg_velocity,
          COUNT(*) FILTER (WHERE learning_style='impulsive') as style_impulsive,
          COUNT(*) FILTER (WHERE learning_style='reflective') as style_reflective,
          COUNT(*) FILTER (WHERE learning_style='persistent') as style_persistent,
          COUNT(*) FILTER (WHERE learning_style='disengaged') as style_disengaged,
          COUNT(*) FILTER (WHERE learning_style='exploratory') as style_exploratory
        FROM lbi_scores`);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, kpi: kpi.rows[0] });
    } catch (err) {
      console.error('LBI profiles error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  app.get('/api/admin/lbi/profiles/:email', ...chain, async (req, res) => {
    const { email } = req.params;
    const client = await pool.connect();
    try {
      let profile = (await client.query('SELECT * FROM lbi_scores WHERE user_email=$1', [email])).rows[0];
      if (!profile) {
        const lbi = await calculateLBI(email, client);
        if (lbi.sessions_analyzed > 0) {
          await client.query(
            `INSERT INTO lbi_scores (user_email,consistency_score,persistence_score,attention_score,adaptability_score,velocity_score,overall_lbi,learning_style,sessions_analyzed,score_trace,calculated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (user_email) DO NOTHING`,
            [email,lbi.consistency_score,lbi.persistence_score,lbi.attention_score,lbi.adaptability_score,lbi.velocity_score,lbi.overall_lbi,lbi.learning_style,lbi.sessions_analyzed,JSON.stringify(lbi.score_trace)]
          );
          await insertHistory(client, email, lbi, 'on_demand');
          profile = { user_email: email, ...lbi };
        } else {
          profile = { user_email: email, ...lbi, _no_sessions: true };
        }
      }
      const sessions = await client.query(
        `SELECT id, stage_code, status, concern_name, created_at, score FROM capadex_sessions WHERE guest_email=$1 ORDER BY created_at DESC LIMIT 10`,
        [email]
      );
      res.json({ profile, sessions: sessions.rows });
    } catch (err) {
      console.error('LBI profile detail error:', err);
      res.status(500).json({ error: 'fetch failed' });
    } finally { client.release(); }
  });

  app.post('/api/admin/lbi/recalculate-all', ...chain, async (_req, res) => {
    res.json({ message: 'recalculation started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const users = await client.query(
          `SELECT DISTINCT guest_email FROM capadex_sessions WHERE guest_email IS NOT NULL AND guest_email != '' LIMIT 500`
        );
        for (const u of users.rows) {
          try {
            const lbi = await calculateLBI(u.guest_email, client);
            if (lbi.sessions_analyzed === 0) continue;
            await client.query(
              `INSERT INTO lbi_scores (user_email,consistency_score,persistence_score,attention_score,adaptability_score,velocity_score,overall_lbi,learning_style,sessions_analyzed,score_trace,calculated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
               ON CONFLICT (user_email) DO UPDATE SET
                 consistency_score=$2,persistence_score=$3,attention_score=$4,
                 adaptability_score=$5,velocity_score=$6,overall_lbi=$7,
                 learning_style=$8,sessions_analyzed=$9,score_trace=$10,calculated_at=NOW()`,
              [u.guest_email,lbi.consistency_score,lbi.persistence_score,lbi.attention_score,lbi.adaptability_score,lbi.velocity_score,lbi.overall_lbi,lbi.learning_style,lbi.sessions_analyzed,JSON.stringify(lbi.score_trace)]
            );
            await insertHistory(client, u.guest_email, lbi, 'recalculate_all');
          } catch { }
        }
      } finally { client.release(); }
    })();
  });

  app.get('/api/admin/lbi/analytics', ...chain, async (_req, res) => {
    try {
      const data = await pool.query(`
        SELECT COUNT(*) as total_profiles,
          ROUND(AVG(overall_lbi)::numeric,1) as avg_lbi,
          ROUND(AVG(consistency_score)::numeric,1) as avg_consistency,
          ROUND(AVG(persistence_score)::numeric,1) as avg_persistence,
          ROUND(AVG(attention_score)::numeric,1) as avg_attention,
          ROUND(AVG(adaptability_score)::numeric,1) as avg_adaptability,
          ROUND(AVG(velocity_score)::numeric,1) as avg_velocity,
          COUNT(*) FILTER (WHERE overall_lbi>=75) as high_lbi,
          COUNT(*) FILTER (WHERE overall_lbi>=50 AND overall_lbi<75) as mid_lbi,
          COUNT(*) FILTER (WHERE overall_lbi<50) as low_lbi,
          COUNT(*) FILTER (WHERE learning_style='impulsive') as style_impulsive,
          COUNT(*) FILTER (WHERE learning_style='reflective') as style_reflective,
          COUNT(*) FILTER (WHERE learning_style='persistent') as style_persistent,
          COUNT(*) FILTER (WHERE learning_style='disengaged') as style_disengaged,
          COUNT(*) FILTER (WHERE learning_style='exploratory') as style_exploratory
        FROM lbi_scores
      `);
      res.json(data.rows[0]);
    } catch (err) {
      console.error('LBI analytics error:', err);
      res.status(500).json({ error: 'analytics failed' });
    }
  });

  app.get('/api/admin/lbi/history/:email', ...chain, async (req, res) => {
    const { email } = req.params;
    const { limit = '20' } = req.query as Record<string, string>;
    try {
      const rows = await pool.query(
        `SELECT id, overall_lbi, consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, learning_style, sessions_analyzed,
                source, calculated_at
         FROM lbi_score_history WHERE user_email=$1 ORDER BY calculated_at DESC LIMIT $2`,
        [email, parseInt(limit)]
      );
      res.json({ email, history: rows.rows, count: rows.rowCount });
    } catch (err) {
      console.error('LBI history error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  app.get('/api/lbi/unified-profile', ...authOnly, async (req: any, res) => {
    const email: string | undefined =
      req.user?.email ?? req.session?.email ?? (req.query.email as string | undefined);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const { getUnifiedLbiProfile } = await import('../services/lbi-unifier');
      const profile = await getUnifiedLbiProfile(email, pool);
      res.json(profile);
    } catch (err) {
      console.error('[lbi-unified]', err);
      res.status(500).json({ error: 'unified profile failed' });
    }
  });

  app.get('/api/admin/lbi/unified/:email', ...chain, async (req: any, res) => {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const { getUnifiedLbiProfile } = await import('../services/lbi-unifier');
      const profile = await getUnifiedLbiProfile(email, pool);
      res.json(profile);
    } catch (err) {
      console.error('[lbi-unified-admin]', err);
      res.status(500).json({ error: 'unified profile failed' });
    }
  });

  app.get('/api/admin/lbi/signal-coverage', ...chain, async (_req: any, res) => {
    try {
      const [tagTotal, tagCovered, groundingCount, byDomain] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT relational_bridge_tag) AS n FROM capadex_concerns_master`),
        pool.query(`SELECT COUNT(DISTINCT bridge_tag) AS n FROM capadex_bridge_tag_signal_grounding`),
        pool.query(`SELECT COUNT(*) AS n FROM capadex_bridge_tag_signal_grounding`),
        pool.query(`
          SELECT domain_name, COUNT(*) AS grounding_rows, COUNT(DISTINCT bridge_tag) AS tags_covered
          FROM capadex_bridge_tag_signal_grounding
          GROUP BY domain_name
          ORDER BY grounding_rows DESC
          LIMIT 20
        `),
      ]);
      const total = Number(tagTotal.rows[0]?.n ?? 0);
      const covered = Number(tagCovered.rows[0]?.n ?? 0);
      res.json({
        bridge_tags_total:   total,
        bridge_tags_covered: covered,
        coverage_pct:        total > 0 ? Math.round((covered / total) * 100) : 0,
        grounding_rows:      Number(groundingCount.rows[0]?.n ?? 0),
        by_domain: byDomain.rows.map(r => ({
          domain:         r.domain_name,
          grounding_rows: Number(r.grounding_rows),
          tags_covered:   Number(r.tags_covered),
        })),
        checked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[lbi-signal-coverage]', err);
      res.status(500).json({ error: 'signal coverage check failed' });
    }
  });
}
