/**
 * CAF — Runtime: Sessions · Responses · Score Rules · Scoring Engine
 *
 * POST   /api/caf/sessions/start
 * GET    /api/caf/sessions/:id/state
 * GET    /api/caf/sessions/:id/next
 * POST   /api/caf/sessions/:id/respond
 * POST   /api/caf/sessions/:id/pause
 * POST   /api/caf/sessions/:id/resume
 * POST   /api/caf/sessions/:id/submit
 * GET    /api/caf/sessions/:id/responses
 * GET    /api/caf/sessions/:id/score
 * POST   /api/caf/sessions/:id/score   (re-score)
 * GET    /api/caf/sessions              (admin list)
 * GET/POST/PATCH /api/caf/score-rules
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: () => void) => void;

async function ensureCAFRuntimeSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caf_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id INTEGER, user_id TEXT NOT NULL, user_email TEXT,
      attempt_number SMALLINT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'started',
      randomization_seed BIGINT, question_order JSONB,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paused_at TIMESTAMPTZ, resumed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      time_elapsed_secs INTEGER NOT NULL DEFAULT 0,
      current_section_id INTEGER, current_question_index SMALLINT NOT NULL DEFAULT 0,
      flagged_question_ids INTEGER[], proctoring_events JSONB, metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_responses (
      id SERIAL PRIMARY KEY, session_id UUID NOT NULL REFERENCES caf_sessions(id) ON DELETE CASCADE,
      question_id INTEGER, section_id INTEGER, response_value TEXT, response_data JSONB,
      is_skipped BOOLEAN NOT NULL DEFAULT false, is_flagged BOOLEAN NOT NULL DEFAULT false,
      is_revised BOOLEAN NOT NULL DEFAULT false,
      time_taken_secs SMALLINT, confidence_level SMALLINT,
      attempt_number SMALLINT NOT NULL DEFAULT 1,
      responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, question_id, attempt_number)
    );
    CREATE TABLE IF NOT EXISTS caf_score_rules (
      id SERIAL PRIMARY KEY, assessment_id INTEGER NOT NULL,
      rule_name VARCHAR(120) NOT NULL, dimension VARCHAR(80) NOT NULL DEFAULT 'overall',
      scoring_method VARCHAR(30) NOT NULL DEFAULT 'weighted_sum',
      weights JSONB, normalization VARCHAR(20) NOT NULL DEFAULT 'raw',
      band_thresholds JSONB, is_primary BOOLEAN NOT NULL DEFAULT false,
      sort_order SMALLINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS caf_scores (
      id SERIAL PRIMARY KEY, session_id UUID NOT NULL REFERENCES caf_sessions(id) ON DELETE CASCADE,
      assessment_id INTEGER, user_id TEXT NOT NULL,
      overall_raw NUMERIC(8,3), overall_scaled NUMERIC(8,3),
      overall_percentile NUMERIC(5,2), overall_band VARCHAR(30),
      irt_theta NUMERIC(8,5), irt_se NUMERIC(8,5),
      dimension_scores JSONB, section_scores JSONB, competency_scores JSONB,
      strengths TEXT[], development_areas TEXT[],
      scoring_rule_id INTEGER, scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version SMALLINT NOT NULL DEFAULT 1
    );
  `);
}

function buildQuestionOrder(questions: { id: number; section_id: number; sort_order: number }[], seed: number, randomize: boolean) {
  if (!randomize) return questions.sort((a, b) => a.sort_order - b.sort_order);
  let s = seed;
  const arr = [...questions];
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computeScoreClassical(
  responses: { question_id: number; response_value: string | null; is_skipped: boolean }[],
  options: { question_id: number; option_key: string; score_value: number }[],
  questions: { id: number; reverse_score: boolean; polarity: string }[],
  maxPossible: number
): { raw: number; scaled: number } {
  let total = 0;
  const optMap = new Map<string, number>();
  for (const o of options) optMap.set(`${o.question_id}:${o.option_key}`, o.score_value);
  const qMap = new Map(questions.map(q => [q.id, q]));
  for (const r of responses) {
    if (r.is_skipped || !r.response_value || !r.question_id) continue;
    const score = optMap.get(`${r.question_id}:${r.response_value}`) ?? 0;
    const q = qMap.get(r.question_id);
    total += q?.reverse_score ? (maxPossible / responses.length) - score : score;
  }
  const scaled = maxPossible > 0 ? Math.round((total / maxPossible) * 100 * 100) / 100 : 0;
  return { raw: Math.round(total * 1000) / 1000, scaled };
}

function bandFromScore(scaled: number, thresholds: Record<string, number>): string {
  const entries = Object.entries(thresholds).sort((a, b) => b[1] - a[1]);
  for (const [band, min] of entries) { if (scaled >= min) return band; }
  return entries[entries.length - 1]?.[0] ?? 'Unknown';
}

const DEFAULT_THRESHOLDS = { Expert: 90, Advanced: 75, Proficient: 60, Developing: 40, Foundation: 0 };

export function registerCAFRuntimeRoutes(
  app: Express, pool: Pool, requireAuth: Auth, requireSuperAdmin: Auth
): void {

  // ── Start session ────────────────────────────────────────────────────────────
  app.post('/api/caf/sessions/start', requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureCAFRuntimeSchema(pool);
      const { assessment_id, user_id, user_email } = req.body;
      if (!assessment_id || !user_id) return res.status(400).json({ error: 'assessment_id and user_id required' });

      const { rows: [assessment] } = await pool.query(`SELECT * FROM caf_assessments WHERE id=$1 AND status='published'`, [assessment_id]);
      if (!assessment) return res.status(404).json({ error: 'Assessment not found or not published' });

      const { rows: [prevAttempts] } = await pool.query(
        `SELECT COUNT(*) FROM caf_sessions WHERE assessment_id=$1 AND user_id=$2 AND status='completed'`,
        [assessment_id, user_id]
      );
      if (parseInt(prevAttempts.count) >= assessment.max_attempts) {
        return res.status(409).json({ error: 'Maximum attempts reached' });
      }

      const { rows: questions } = await pool.query(
        `SELECT sq.question_id AS id, sq.section_id, sq.sort_order, sq.is_fixed, sq.pool_group
         FROM caf_section_questions sq
         JOIN caf_assessment_sections s ON s.id=sq.section_id
         WHERE s.assessment_id=$1 ORDER BY s.sort_order, sq.sort_order`, [assessment_id]
      );

      const seed = Date.now() & 0xffffffff;
      const orderedQuestions = buildQuestionOrder(questions, seed, assessment.randomize_questions);

      const { rows: [session] } = await pool.query(
        `INSERT INTO caf_sessions (assessment_id,user_id,user_email,randomization_seed,question_order,status,attempt_number)
         VALUES ($1,$2,$3,$4,$5,'started',
           COALESCE((SELECT MAX(attempt_number)+1 FROM caf_sessions WHERE assessment_id=$1 AND user_id=$2), 1))
         RETURNING *`,
        [assessment_id, user_id, user_email || null, seed, JSON.stringify(orderedQuestions)]
      );
      res.status(201).json({ session, total_questions: orderedQuestions.length });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Session state ────────────────────────────────────────────────────────────
  app.get('/api/caf/sessions/:id/state', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rows: [session] } = await pool.query(`SELECT * FROM caf_sessions WHERE id=$1`, [req.params.id]);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const { rows: responses } = await pool.query(`SELECT question_id FROM caf_responses WHERE session_id=$1`, [req.params.id]);
      const answeredIds = new Set(responses.map((r: { question_id: number }) => r.question_id));
      const order: { id: number; section_id: number }[] = session.question_order ?? [];
      const remaining = order.filter(q => !answeredIds.has(q.id)).length;
      const elapsed = session.time_elapsed_secs + (session.status === 'in_progress' ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) : 0);
      res.json({ session, answered: answeredIds.size, remaining, elapsed_secs: elapsed });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Next question ────────────────────────────────────────────────────────────
  app.get('/api/caf/sessions/:id/next', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rows: [session] } = await pool.query(`SELECT * FROM caf_sessions WHERE id=$1`, [req.params.id]);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status === 'completed') return res.json({ done: true });

      const { rows: answered } = await pool.query(`SELECT question_id FROM caf_responses WHERE session_id=$1`, [req.params.id]);
      const answeredIds = new Set(answered.map((r: { question_id: number }) => r.question_id));
      const order: { id: number; section_id: number }[] = session.question_order ?? [];
      const nextQ = order.find(q => !answeredIds.has(q.id));
      if (!nextQ) return res.json({ done: true });

      const { rows: [question] } = await pool.query(
        `SELECT q.*, array_agg(row_to_json(o) ORDER BY o.sort_order) FILTER (WHERE o.id IS NOT NULL) AS options
         FROM caf_question_bank q
         LEFT JOIN caf_question_options o ON o.question_id=q.id
         WHERE q.id=$1 GROUP BY q.id`, [nextQ.id]
      );
      await pool.query(`UPDATE caf_sessions SET status='in_progress', current_question_index=$1, current_section_id=$2, updated_at=NOW() WHERE id=$3`,
        [order.indexOf(nextQ), nextQ.section_id, req.params.id]);

      res.json({ question, position: order.indexOf(nextQ) + 1, total: order.length, section_id: nextQ.section_id });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Save response ────────────────────────────────────────────────────────────
  app.post('/api/caf/sessions/:id/respond', requireAuth, async (req: Request, res: Response) => {
    try {
      const { question_id, section_id, response_value, response_data, is_skipped = false, is_flagged = false, time_taken_secs, confidence_level } = req.body;
      if (!question_id) return res.status(400).json({ error: 'question_id required' });

      const { rows: [existing] } = await pool.query(
        `SELECT id FROM caf_responses WHERE session_id=$1 AND question_id=$2 AND attempt_number=1`, [req.params.id, question_id]
      );
      if (existing) {
        await pool.query(
          `UPDATE caf_responses SET response_value=$1, response_data=$2, is_skipped=$3, is_flagged=$4, is_revised=true, time_taken_secs=$5, confidence_level=$6, responded_at=NOW()
           WHERE session_id=$7 AND question_id=$8 AND attempt_number=1`,
          [response_value || null, response_data ? JSON.stringify(response_data) : null, is_skipped, is_flagged, time_taken_secs || null, confidence_level || null, req.params.id, question_id]
        );
      } else {
        await pool.query(
          `INSERT INTO caf_responses (session_id,question_id,section_id,response_value,response_data,is_skipped,is_flagged,time_taken_secs,confidence_level)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [req.params.id, question_id, section_id || null, response_value || null, response_data ? JSON.stringify(response_data) : null, is_skipped, is_flagged, time_taken_secs || null, confidence_level || null]
        );
      }
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Pause / Resume ───────────────────────────────────────────────────────────
  app.post('/api/caf/sessions/:id/pause', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rows: [s] } = await pool.query(
        `UPDATE caf_sessions SET status='paused', paused_at=NOW(),
         time_elapsed_secs=time_elapsed_secs + EXTRACT(EPOCH FROM (NOW()-started_at))::INTEGER,
         updated_at=NOW() WHERE id=$1 AND status='in_progress' RETURNING id, status`, [req.params.id]
      );
      if (!s) return res.status(404).json({ error: 'Session not found or not in_progress' });
      res.json(s);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/sessions/:id/resume', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rows: [s] } = await pool.query(
        `UPDATE caf_sessions SET status='in_progress', resumed_at=NOW(), started_at=NOW(), updated_at=NOW()
         WHERE id=$1 AND status='paused' RETURNING id, status`, [req.params.id]
      );
      if (!s) return res.status(404).json({ error: 'Session not paused' });
      res.json(s);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Submit + Score ───────────────────────────────────────────────────────────
  app.post('/api/caf/sessions/:id/submit', requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id;
      const { rows: [session] } = await pool.query(`SELECT * FROM caf_sessions WHERE id=$1`, [sessionId]);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status === 'completed') return res.json({ already_completed: true });

      await pool.query(`UPDATE caf_sessions SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`, [sessionId]);
      const score = await scoreSession(pool, sessionId, session);
      res.json({ ok: true, score });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Get session responses ────────────────────────────────────────────────────
  app.get('/api/caf/sessions/:id/responses', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT r.*, q.stem, q.response_format, q.domain, q.level_code
         FROM caf_responses r LEFT JOIN caf_question_bank q ON q.id=r.question_id
         WHERE r.session_id=$1 ORDER BY r.responded_at`, [req.params.id]
      );
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Get/re-compute score ─────────────────────────────────────────────────────
  app.get('/api/caf/sessions/:id/score', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rows: [score] } = await pool.query(`SELECT * FROM caf_scores WHERE session_id=$1 ORDER BY version DESC LIMIT 1`, [req.params.id]);
      if (!score) return res.status(404).json({ error: 'Score not yet computed' });
      res.json(score);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/sessions/:id/score', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { rows: [session] } = await pool.query(`SELECT * FROM caf_sessions WHERE id=$1`, [req.params.id]);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const score = await scoreSession(pool, req.params.id, session);
      res.json(score);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Admin: list sessions ─────────────────────────────────────────────────────
  app.get('/api/caf/sessions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFRuntimeSchema(pool);
      const { assessment_id, status = 'all', user_id, page = '1', limit = '50' } = req.query as Record<string, string>;
      const params: unknown[] = []; const conds: string[] = [];
      if (assessment_id) { params.push(parseInt(assessment_id)); conds.push(`s.assessment_id=$${params.length}`); }
      if (status !== 'all') { params.push(status); conds.push(`s.status=$${params.length}`); }
      if (user_id) { params.push(user_id); conds.push(`s.user_id=$${params.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
      params.push(parseInt(limit)); params.push(offset);
      const { rows } = await pool.query(
        `SELECT s.*, a.title AS assessment_title, a.assessment_type,
          (SELECT COUNT(*) FROM caf_responses WHERE session_id=s.id) AS response_count,
          sc.overall_band, sc.overall_scaled
         FROM caf_sessions s
         LEFT JOIN caf_assessments a ON a.id=s.assessment_id
         LEFT JOIN LATERAL (SELECT overall_band,overall_scaled FROM caf_scores WHERE session_id=s.id ORDER BY version DESC LIMIT 1) sc ON true
         ${where} ORDER BY s.started_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params
      );
      const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM caf_sessions s ${where}`, params.slice(0, -2));
      res.json({ sessions: rows, total: parseInt(count) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── Score Rules ──────────────────────────────────────────────────────────────
  app.get('/api/caf/score-rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFRuntimeSchema(pool);
      const { assessment_id } = req.query as Record<string, string>;
      const where = assessment_id ? 'WHERE assessment_id=$1' : '';
      const params = assessment_id ? [parseInt(assessment_id)] : [];
      const { rows } = await pool.query(`SELECT * FROM caf_score_rules ${where} ORDER BY assessment_id, sort_order`, params);
      res.json(rows);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/api/caf/score-rules', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureCAFRuntimeSchema(pool);
      const { assessment_id, rule_name, dimension = 'overall', scoring_method = 'weighted_sum', weights, normalization = 'raw', band_thresholds, is_primary = false, sort_order = 0 } = req.body;
      if (!assessment_id || !rule_name) return res.status(400).json({ error: 'assessment_id and rule_name required' });
      const { rows: [r] } = await pool.query(
        `INSERT INTO caf_score_rules (assessment_id,rule_name,dimension,scoring_method,weights,normalization,band_thresholds,is_primary,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [assessment_id, rule_name, dimension, scoring_method,
         weights ? JSON.stringify(weights) : null,
         normalization,
         band_thresholds ? JSON.stringify(band_thresholds) : JSON.stringify(DEFAULT_THRESHOLDS),
         is_primary, sort_order]
      );
      res.status(201).json(r);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  app.patch('/api/caf/score-rules/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const allowed = ['rule_name','dimension','scoring_method','weights','normalization','band_thresholds','is_primary','sort_order'];
      const sets: string[] = []; const params: unknown[] = [];
      for (const f of allowed) {
        if (req.body[f] !== undefined) {
          params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
          sets.push(`${f}=$${params.length}`);
        }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields' });
      params.push(id);
      const { rows: [r] } = await pool.query(`UPDATE caf_score_rules SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!r) return res.status(404).json({ error: 'Not found' });
      res.json(r);
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}

async function scoreSession(pool: Pool, sessionId: string, session: Record<string, unknown>) {
  const { rows: responses } = await pool.query(`SELECT * FROM caf_responses WHERE session_id=$1`, [sessionId]);
  const qIds = responses.map((r: { question_id: number }) => r.question_id).filter(Boolean);

  if (!qIds.length) {
    const { rows: [score] } = await pool.query(
      `INSERT INTO caf_scores (session_id,assessment_id,user_id,overall_raw,overall_scaled,overall_band,version)
       VALUES ($1,$2,$3,0,0,'Foundation',1) ON CONFLICT DO NOTHING RETURNING *`,
      [sessionId, session.assessment_id, session.user_id]
    );
    return score;
  }

  const { rows: questions } = await pool.query(`SELECT id, reverse_score, polarity FROM caf_question_bank WHERE id=ANY($1)`, [qIds]);
  const { rows: options } = await pool.query(`SELECT question_id, option_key, score_value FROM caf_question_options WHERE question_id=ANY($1)`, [qIds]);

  const maxPerQ = Math.max(...options.map((o: { score_value: number }) => o.score_value), 1);
  const maxPossible = qIds.length * maxPerQ;

  const { raw, scaled } = computeScoreClassical(responses, options, questions, maxPossible);

  let rule = null;
  if (session.assessment_id) {
    const { rows: [r] } = await pool.query(`SELECT * FROM caf_score_rules WHERE assessment_id=$1 AND is_primary=true LIMIT 1`, [session.assessment_id]);
    rule = r;
  }

  const thresholds = rule?.band_thresholds ?? DEFAULT_THRESHOLDS;
  const band = bandFromScore(scaled, thresholds);

  const { rows: [existing] } = await pool.query(`SELECT version FROM caf_scores WHERE session_id=$1 ORDER BY version DESC LIMIT 1`, [sessionId]);
  const newVersion = existing ? existing.version + 1 : 1;

  const { rows: [score] } = await pool.query(
    `INSERT INTO caf_scores (session_id,assessment_id,user_id,overall_raw,overall_scaled,overall_band,scoring_rule_id,version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [sessionId, session.assessment_id, session.user_id, raw, scaled, band, rule?.id || null, newVersion]
  );
  return score;
}
