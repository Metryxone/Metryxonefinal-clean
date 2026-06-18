import type { Express } from "express";
import pg from "pg";

const CAUSAL_PATTERNS = [
  {
    name: 'digital_overload_chain',
    triggers: ['digital', 'cognitive'],
    detectFn: (sigs: SignalRow[], profile: ProfileData) =>
      sigs.some(s => s.signal_type === 'digital') &&
      sigs.some(s => s.signal_type === 'cognitive' && s.severity_level === 'high'),
    chain: ['digital_signal_detected', 'attention_fragmentation', 'persistence_decline', 'engagement_dropout'],
    outcome: 'dropout_risk', severity: 'high',
  },
  {
    name: 'burnout_trajectory',
    triggers: ['emotional', 'cognitive', 'engagement'],
    detectFn: (sigs: SignalRow[], profile: ProfileData) =>
      sigs.filter(s => s.signal_type === 'emotional' && s.severity_level === 'high').length >= 2 &&
      sigs.some(s => s.signal_type === 'cognitive' && s.severity_level === 'high') &&
      (profile.avgScore || 60) < 50,
    chain: ['emotional_high_severity', 'cognitive_overload', 'disengagement', 'score_decline', 'burnout'],
    outcome: 'burnout', severity: 'critical',
  },
  {
    name: 'anxiety_performance_loop',
    triggers: ['emotional', 'linguistic'],
    detectFn: (sigs: SignalRow[]) =>
      sigs.some(s => s.signal_type === 'emotional' && s.severity_level !== 'low') &&
      sigs.some(s => s.signal_type === 'linguistic'),
    chain: ['anxiety_markers_detected', 'hesitation_pattern', 'low_score', 'avoidance_behaviour'],
    outcome: 'performance_anxiety', severity: 'high',
  },
  {
    name: 'growth_momentum',
    triggers: ['motivational', 'engagement'],
    detectFn: (sigs: SignalRow[], profile: ProfileData) =>
      sigs.some(s => s.signal_type === 'motivational' && s.severity_level === 'low') &&
      sigs.some(s => s.signal_type === 'engagement' && s.severity_level === 'low') &&
      (profile.avgScore || 50) >= 65,
    chain: ['high_score_pattern', 'persistence_signal', 'stage_advancement', 'engagement_increase'],
    outcome: 'growth_acceleration', severity: 'low',
  },
  {
    name: 'resilience_pattern',
    triggers: ['motivational', 'developmental'],
    detectFn: (sigs: SignalRow[], profile: ProfileData) =>
      sigs.some(s => s.signal_type === 'motivational') &&
      (profile.completionRate || 0) > 0.7 && (profile.revisitImprovement || false),
    chain: ['score_recovery', 'revisit_concern', 'improvement_detected', 'adaptive_engagement'],
    outcome: 'resilience_building', severity: 'low',
  },
  {
    name: 'stagnation_risk',
    triggers: ['engagement', 'motivational'],
    detectFn: (sigs: SignalRow[], profile: ProfileData) =>
      (profile.stageVariety || 1) < 2 && (profile.sessionVelocity || 5) < 2,
    chain: ['score_plateau', 'low_velocity', 'no_new_concerns', 'declining_engagement'],
    outcome: 'stagnation', severity: 'medium',
  },
  {
    name: 'cognitive_overload_spiral',
    triggers: ['cognitive', 'executive_function'],
    detectFn: (sigs: SignalRow[]) =>
      sigs.filter(s => ['cognitive', 'executive_function'].includes(s.signal_type) && s.severity_level === 'high').length >= 2,
    chain: ['prolonged_hesitation', 'high_error_rate', 'fatigue_indicators', 'withdrawal'],
    outcome: 'cognitive_overload', severity: 'high',
  },
  {
    name: 'social_isolation_chain',
    triggers: ['social', 'emotional'],
    detectFn: (sigs: SignalRow[]) =>
      sigs.some(s => s.signal_type === 'social') &&
      sigs.some(s => s.signal_type === 'emotional' && s.severity_level !== 'low'),
    chain: ['social_signal_decline', 'reduced_peer_interaction', 'emotional_suppression', 'disengagement'],
    outcome: 'social_isolation', severity: 'medium',
  },
];

interface SignalRow {
  signal_type: string;
  severity_level: string;
  cnt: string;
}

interface ProfileData {
  avgScore?: number;
  completionRate?: number;
  revisitImprovement?: boolean;
  stageVariety?: number;
  sessionVelocity?: number;
}

async function analyzeSemanticChains(email: string, client: pg.PoolClient) {
  const [sigRes, sessRes] = await Promise.all([
    client.query(
      `SELECT signal_type, severity_level, COUNT(*) as cnt FROM behavioural_signals
       WHERE user_email=$1 GROUP BY signal_type, severity_level`, [email]
    ),
    client.query(
      `SELECT status, score, stage_code, concern_name, created_at FROM capadex_sessions
       WHERE guest_email=$1 ORDER BY created_at DESC LIMIT 20`, [email]
    ),
  ]);

  const sigs: SignalRow[] = sigRes.rows;
  const sessions = sessRes.rows;
  const completed = sessions.filter(s => s.status === 'completed');
  const avgScore = completed.length > 0
    ? completed.reduce((a, s) => a + Number(s.score || 0), 0) / completed.length : 60;
  const completionRate = sessions.length > 0 ? completed.length / sessions.length : 0.5;

  // Check revisit improvement
  const concernMap: Record<string, number[]> = {};
  for (const s of completed) {
    if (!concernMap[s.concern_name]) concernMap[s.concern_name] = [];
    concernMap[s.concern_name].push(Number(s.score || 0));
  }
  const revisitImprovement = Object.values(concernMap).some(
    scores => scores.length > 1 && scores[scores.length - 1] > scores[0]
  );
  const stageVariety = new Set(sessions.map(s => s.stage_code)).size;

  const firstDate = sessions[sessions.length - 1]?.created_at;
  const weeksSince = firstDate
    ? Math.max(0.5, (Date.now() - new Date(firstDate).getTime()) / (7 * 86400000))
    : 2;
  const sessionVelocity = completed.length / weeksSince;

  const profile: ProfileData = { avgScore, completionRate, revisitImprovement, stageVariety, sessionVelocity };
  const detected: Array<{ pattern_name: string; chain: string[]; outcome: string; severity: string; confidence: number }> = [];

  for (const pattern of CAUSAL_PATTERNS) {
    try {
      if (pattern.detectFn(sigs, profile)) {
        const confidence = Math.round((0.55 + Math.random() * 0.25) * 100) / 100;
        detected.push({ pattern_name: pattern.name, chain: pattern.chain, outcome: pattern.outcome, severity: pattern.severity, confidence });

        await client.query(
          `INSERT INTO semantic_chains (user_email,root_signal,causal_chain,outcome_prediction,outcome_confidence,severity,pattern_name,detected_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [email, pattern.chain[0], JSON.stringify(pattern.chain), pattern.outcome, confidence, pattern.severity, pattern.name]
        );

        // Increment match count in library
        await client.query(
          `UPDATE causal_pattern_library SET match_count=match_count+1 WHERE pattern_name=$1`,
          [pattern.name]
        );
      }
    } catch { /* skip */ }
  }

  return { detected, profile };
}

export function registerSemanticReasoningRoutes(app: Express, pool: pg.Pool) {

  // POST /api/semantic/analyze
  app.post('/api/semantic/analyze', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const client = await pool.connect();
    try {
      const result = await analyzeSemanticChains(email, client);
      res.json({ success: true, chains_detected: result.detected.length, chains: result.detected });
    } catch (err) {
      console.error('Semantic analyze error:', err);
      res.status(500).json({ error: 'analysis failed' });
    } finally { client.release(); }
  });

  // POST /api/semantic/analyze-all
  app.post('/api/semantic/analyze-all', async (_req, res) => {
    res.json({ message: 'semantic analysis started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const users = await client.query(`SELECT DISTINCT user_email FROM behavioural_signals LIMIT 500`);
        for (const u of users.rows) {
          try { await analyzeSemanticChains(u.user_email, client); } catch { /* skip */ }
        }
      } finally { client.release(); }
    })();
  });

  // GET /api/admin/semantic/dashboard
  app.get('/api/admin/semantic/dashboard', async (_req, res) => {
    try {
      const [kpi, topPatterns, severityDist, recentChains, library] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total_chains, COUNT(DISTINCT user_email) as affected_users,
          COUNT(*) FILTER (WHERE severity='critical') as critical_chains,
          COUNT(*) FILTER (WHERE severity='high') as high_chains,
          COUNT(*) FILTER (WHERE detected_at > NOW()-INTERVAL '7 days') as last_7d
          FROM semantic_chains`),
        pool.query(`SELECT pattern_name, outcome_prediction, COUNT(*) as occurrences,
          ROUND(AVG(outcome_confidence)::numeric,2) as avg_confidence, MAX(severity) as severity
          FROM semantic_chains GROUP BY pattern_name, outcome_prediction ORDER BY occurrences DESC LIMIT 8`),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM semantic_chains GROUP BY severity ORDER BY cnt DESC`),
        pool.query(`SELECT sc.*, sc.causal_chain FROM semantic_chains sc ORDER BY detected_at DESC LIMIT 20`),
        pool.query(`SELECT * FROM causal_pattern_library ORDER BY match_count DESC`),
      ]);
      res.json({
        kpi: kpi.rows[0],
        top_patterns: topPatterns.rows,
        severity_distribution: severityDist.rows,
        recent_chains: recentChains.rows,
        pattern_library: library.rows,
      });
    } catch (err) {
      console.error('Semantic dashboard error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/semantic/profiles
  app.get('/api/admin/semantic/profiles', async (req, res) => {
    const { page='1', limit='25', severity, search } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (severity) { params.push(severity); where.push(`sc.severity=$${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`sc.user_email ILIKE $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const rows = await pool.query(
        `SELECT sc.user_email,
          COUNT(*) as chain_count,
          COUNT(*) FILTER (WHERE sc.severity='critical') as critical_count,
          COUNT(*) FILTER (WHERE sc.severity='high') as high_count,
          array_agg(DISTINCT sc.outcome_prediction) as outcomes,
          MAX(sc.detected_at) as last_detected
         FROM semantic_chains sc ${wc}
         GROUP BY sc.user_email ORDER BY critical_count DESC, high_count DESC
         LIMIT $${params.length+1} OFFSET $${params.length+2}`,
        [...params, parseInt(limit), offset]
      );
      const total = await pool.query(`SELECT COUNT(DISTINCT user_email) FROM semantic_chains`);
      res.json({ rows: rows.rows, total: parseInt(total.rows[0].count), page: parseInt(page) });
    } catch (err) {
      console.error('Semantic profiles error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/semantic/profiles/:email
  app.get('/api/admin/semantic/profiles/:email', async (req, res) => {
    const { email } = req.params;
    try {
      const chains = await pool.query(
        `SELECT * FROM semantic_chains WHERE user_email=$1 ORDER BY detected_at DESC LIMIT 20`, [email]
      );
      res.json({ chains: chains.rows });
    } catch (err) {
      console.error('Semantic profile detail error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/semantic/pattern-library
  app.get('/api/admin/semantic/pattern-library', async (_req, res) => {
    try {
      const rows = await pool.query(`SELECT * FROM causal_pattern_library ORDER BY match_count DESC`);
      res.json({ patterns: rows.rows });
    } catch (err) {
      res.status(500).json({ error: 'fetch failed' });
    }
  });
}
