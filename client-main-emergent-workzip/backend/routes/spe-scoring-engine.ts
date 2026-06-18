/**
 * SPE — SCORING & PSYCHOMETRIC ENGINE
 * Sections 1–3: Raw Scoring, Behavioural Scoring, Cognitive Scoring
 */

import { Express } from 'express';
import pg from 'pg';
import { buildScoreTrace } from '../lib/scoring-utils';

// ── Scoring utilities ─────────────────────────────────────────────────────────

function scoreResponse(questionType: string, response: unknown, correctAnswer: unknown, rubric: Record<string, unknown>): number {
  if (questionType === 'mcq') {
    return response === correctAnswer ? 100 : 0;
  }
  if (questionType === 'multi_select') {
    if (!Array.isArray(response) || !Array.isArray(correctAnswer)) return 0;
    const correct = correctAnswer as string[];
    const given   = response as string[];
    const hits    = given.filter(g => correct.includes(g)).length;
    const penalty = given.filter(g => !correct.includes(g)).length;
    return Math.max(0, Math.round((hits / correct.length - penalty / correct.length * 0.25) * 100));
  }
  if (questionType === 'reflective' || questionType === 'short_answer') {
    // Rule-based semantic scoring using keyword rubric
    const keywords = (rubric.keywords as string[]) || [];
    const text = String(response || '').toLowerCase();
    if (keywords.length === 0) return 50;
    const hits = keywords.filter(k => text.includes(k.toLowerCase())).length;
    return Math.round((hits / keywords.length) * 100);
  }
  if (questionType === 'behavioural') {
    const scales = (rubric.scales as Record<string, number>) || {};
    return scales[String(response)] ?? 50;
  }
  return 50;
}

function computeBehaviouralScore(responses: Array<{
  response_time_ms: number; change_count: number; is_correct: boolean; raw_score: number;
}>) {
  if (!responses.length) return { persistence: 50, focus: 50, impulsivity: 0, adaptability: 50, confidence_stability: 50, pacing: 50, engagement: 50, volatility: 0, overall: 50 };

  const times = responses.map(r => r.response_time_ms || 3000);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const stdTime = Math.sqrt(times.map(t => (t - avgTime) ** 2).reduce((a, b) => a + b, 0) / times.length);

  const changes   = responses.reduce((a, r) => a + (r.change_count || 0), 0);
  const rapidFire = times.filter(t => t < 800).length;
  const slowPaced = times.filter(t => t > 15000).length;

  const persistence  = Math.round(Math.min(100, 50 + (responses.filter(r => r.is_correct).length / responses.length) * 50));
  const focus        = Math.round(Math.max(0, 100 - (slowPaced / responses.length) * 80));
  const impulsivity  = Math.round((rapidFire / responses.length) * 60);
  const adaptability = Math.round(50 + (1 - stdTime / Math.max(avgTime, 1)) * 30);
  const pacing       = Math.round(Math.max(0, 100 - (stdTime / Math.max(avgTime, 1)) * 50));
  const engagement   = Math.round(Math.min(100, 40 + (responses.filter(r => r.response_time_ms > 1500 && r.response_time_ms < 12000).length / responses.length) * 60));
  const volatility   = Math.round(Math.min(100, (changes / responses.length) * 40));
  const confStab     = Math.round(Math.max(0, 100 - volatility - impulsivity * 0.5));
  const overall      = Math.round((persistence + focus - impulsivity * 0.3 + adaptability + pacing + engagement + confStab) / 6);

  return { persistence, focus, impulsivity, adaptability, confidence_stability: confStab, pacing, engagement, volatility, overall: Math.min(100, Math.max(0, overall)) };
}

function computeCognitiveProfile(responses: Array<{
  question_type: string; cognitive_load: number; response_time_ms: number; is_correct: boolean; raw_score: number;
}>) {
  if (!responses.length) return { reasoning: 50, memory: 50, flexibility: 50, speed: 50, abstraction: 50, metacognition: 50, attention: 50, overload: 0, fatigue: false, fragmentation: 0, overall: 50 };

  const highLoad = responses.filter(r => (r.cognitive_load || 3) >= 4);
  const reasoning    = highLoad.length ? Math.round(highLoad.filter(r => r.is_correct).length / highLoad.length * 100) : 50;
  const correctRate  = responses.filter(r => r.is_correct).length / responses.length;
  const times        = responses.map(r => r.response_time_ms || 3000);
  const avgTime      = times.reduce((a, b) => a + b, 0) / times.length;
  const speedScore   = Math.round(Math.max(0, Math.min(100, 100 - (avgTime - 2000) / 100)));
  const lateResponses = responses.slice(-Math.ceil(responses.length / 3));
  const earlyAcc     = responses.slice(0, Math.ceil(responses.length / 3)).filter(r => r.is_correct).length / Math.ceil(responses.length / 3);
  const lateAcc      = lateResponses.filter(r => r.is_correct).length / lateResponses.length;
  const fatigueScore = earlyAcc - lateAcc;
  const fatigue      = fatigueScore > 0.2;
  const flexibility  = Math.round(responses.filter(r => ['scenario', 'cognitive', 'reflective'].includes(r.question_type) && r.is_correct).length / Math.max(1, responses.filter(r => ['scenario', 'cognitive', 'reflective'].includes(r.question_type)).length) * 100);
  const abstraction  = Math.round(correctRate * 80 + (1 - fatigueScore) * 20);
  const metacog      = Math.round(50 + (1 - fatigueScore) * 30 + correctRate * 20);
  const attention    = Math.round(Math.max(0, 100 - Math.abs(fatigueScore) * 60));
  const overload     = Math.round(Math.max(0, Math.min(100, fatigueScore * 100 + (1 - correctRate) * 40)));
  const fragmentation = Math.round(times.filter(t => t > 20000).length / responses.length * 100);
  const overall      = Math.round((reasoning + speedScore + flexibility + abstraction + metacog + attention) / 6);
  return { reasoning, memory: Math.round(correctRate * 100), flexibility, speed: speedScore, abstraction, metacognition: metacog, attention, overload: Math.min(100, overload), fatigue, fragmentation, overall: Math.min(100, overall) };
}

// ── IRT utility ───────────────────────────────────────────────────────────────
function irtProbability(theta: number, a: number, b: number, c: number = 0.25): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

function estimateAbilityMLE(responses: Array<{ correct: boolean; difficulty: number; discrimination: number; guessing: number }>, iterations = 20): number {
  let theta = 0;
  for (let i = 0; i < iterations; i++) {
    let num = 0, den = 0;
    for (const r of responses) {
      const p = irtProbability(theta, r.discrimination, r.difficulty, r.guessing);
      const q = 1 - p;
      const y = r.correct ? 1 : 0;
      if (p > 0.001 && q > 0.001) {
        num += r.discrimination * (y - p);
        den += r.discrimination ** 2 * p * q;
      }
    }
    if (den === 0) break;
    theta = Math.max(-4, Math.min(4, theta + num / den));
  }
  return Math.round(theta * 1000) / 1000;
}

function thetaToScore(theta: number): number {
  return Math.round(Math.min(100, Math.max(0, (theta + 4) / 8 * 100)));
}

export function registerSPEScoringRoutes(app: Express, pool: pg.Pool) {

  // ─── POST /api/spe/assessments — create assessment ──────────────────────────
  app.post('/api/spe/assessments', async (req, res) => {
    const { name, assessment_type = 'composite', description = '', tenant_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const r = await pool.query(
        `INSERT INTO spe_assessments (name,assessment_type,description,tenant_id)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [name, assessment_type, description, tenant_id || null]
      );
      res.json({ success: true, assessment: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/spe/assessments ──────────────────────────────────────────────
  app.get('/api/spe/assessments', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [count, rows] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM spe_assessments'),
        pool.query(`SELECT a.*, (SELECT COUNT(*) FROM spe_questions q WHERE q.assessment_id=a.id) as question_count,
                   (SELECT COUNT(DISTINCT user_id) FROM spe_scores s WHERE s.assessment_id=a.id) as respondent_count
                   FROM spe_assessments a ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
          [parseInt(limit), offset]),
      ]);
      res.json({ total: parseInt(count.rows[0].count), page: parseInt(page), rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/questions — add question ────────────────────────────────
  app.post('/api/spe/questions', async (req, res) => {
    const { assessment_id, competency, domain, question_text, question_type = 'mcq',
      options = [], correct_answer, rubric = {}, difficulty_level = 3,
      cognitive_load = 3, tenant_id } = req.body;
    if (!question_text) return res.status(400).json({ error: 'question_text required' });
    try {
      const r = await pool.query(
        `INSERT INTO spe_questions (assessment_id,competency,domain,question_text,question_type,options,correct_answer,rubric,difficulty_level,cognitive_load,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [assessment_id || null, competency || null, domain || null, question_text, question_type,
          JSON.stringify(options), correct_answer ? JSON.stringify(correct_answer) : null,
          JSON.stringify(rubric), difficulty_level, cognitive_load, tenant_id || null]
      );
      res.json({ success: true, question: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/spe/questions/:assessmentId ─────────────────────────────────
  app.get('/api/spe/questions/:assessmentId', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM spe_questions WHERE assessment_id=$1 ORDER BY created_at ASC`,
        [req.params.assessmentId]
      );
      res.json({ questions: r.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/score — score a complete response set ──────────────────
  app.post('/api/spe/score', async (req, res) => {
    const { user_id, assessment_id, responses: rawResponses, tenant_id } = req.body;
    if (!user_id || !assessment_id || !Array.isArray(rawResponses)) {
      return res.status(400).json({ error: 'user_id, assessment_id, responses[] required' });
    }
    const client = await pool.connect();
    try {
      // Load questions for this assessment
      const qs = await client.query(
        `SELECT * FROM spe_questions WHERE assessment_id=$1`, [assessment_id]
      );
      const qMap: Record<string, typeof qs.rows[0]> = {};
      for (const q of qs.rows) qMap[q.id] = q;

      // Score each response
      const scoredResponses: Array<{
        question_id: string; response_time_ms: number; change_count: number;
        is_correct: boolean; raw_score: number; question_type: string; cognitive_load: number;
      }> = [];

      for (const r of rawResponses) {
        const q = qMap[r.question_id];
        if (!q) continue;
        const rawScore = scoreResponse(q.question_type, r.response_value, q.correct_answer, q.rubric || {});
        const isCorrect = rawScore >= 60;
        scoredResponses.push({
          question_id: r.question_id, response_time_ms: r.response_time_ms || 3000,
          change_count: r.change_count || 0, is_correct: isCorrect, raw_score: rawScore,
          question_type: q.question_type, cognitive_load: q.cognitive_load || 3,
        });
        await client.query(
          `INSERT INTO spe_responses (assessment_id,user_id,question_id,response_payload,response_value,is_correct,raw_score,response_time_ms,change_count,tenant_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [assessment_id, user_id, r.question_id, JSON.stringify(r), String(r.response_value || ''),
            isCorrect, rawScore, r.response_time_ms || 3000, r.change_count || 0, tenant_id || null]
        );
      }

      // Compute composite scores — preserve arithmetic precision for parity
      const avgRaw = scoredResponses.length
        ? scoredResponses.reduce((a, r) => a + r.raw_score, 0) / scoredResponses.length
        : 50;
      const beh    = computeBehaviouralScore(scoredResponses);
      const cog    = computeCognitiveProfile(scoredResponses);

      // LBI reconciliation: look up LBI attention_score as the authoritative reference.
      // It is stored in the score_trace for explainability but does NOT override the
      // composite computation — preserving score stability per task spec.
      let lbiAttentionRef: number | null = null;
      let focusSource = 'spe_internal';
      try {
        let resolvedEmail: string | null = null;
        if (typeof user_id === 'string' && user_id.includes('@')) {
          resolvedEmail = user_id;
        } else {
          // Resolve UUID → email via capadex_users
          const userRow = await client.query(
            `SELECT email FROM capadex_users WHERE id::text = $1 LIMIT 1`, [String(user_id)]
          );
          if (userRow.rows.length > 0) resolvedEmail = userRow.rows[0].email;
        }
        if (resolvedEmail) {
          const lbiRow = await client.query(
            `SELECT attention_score FROM lbi_scores WHERE user_email = $1 LIMIT 1`, [resolvedEmail]
          );
          if (lbiRow.rows.length > 0 && lbiRow.rows[0].attention_score != null) {
            lbiAttentionRef = Math.round(Number(lbiRow.rows[0].attention_score));
            focusSource = 'lbi_attention_ref';
          }
        }
      } catch { /* non-critical — fall back to spe_internal */ }

      // IRT ability estimation
      const irtData = scoredResponses.map(r => {
        const q = qMap[r.question_id];
        return { correct: r.is_correct, difficulty: q?.difficulty_parameter || 0, discrimination: q?.discrimination_index || 1, guessing: q?.guessing_parameter || 0.25 };
      });
      const theta     = estimateAbilityMLE(irtData);
      const irtScore  = thetaToScore(theta);
      const composite = Math.round(avgRaw * 0.4 + irtScore * 0.35 + beh.overall * 0.15 + cog.overall * 0.1);
      const confidence  = Math.min(1, 0.3 + scoredResponses.length / 30 * 0.7);
      const uncertainty = Math.round((1 - confidence) * 1000) / 1000;

      // Positive / negative factors
      const factors: {label: string; val: number}[] = [
        { label: 'Persistence', val: beh.persistence }, { label: 'Focus', val: beh.focus },
        { label: 'Reasoning', val: cog.reasoning }, { label: 'Processing Speed', val: cog.speed },
        { label: 'Adaptability', val: beh.adaptability }, { label: 'Cognitive Flexibility', val: cog.flexibility },
      ];
      const positive = factors.filter(f => f.val >= 65).map(f => f.label);
      const negative = factors.filter(f => f.val < 40).map(f => f.label);

      // Build score_trace for explainability (LBI attention stored as authoritative reference)
      const speScoreTrace = buildScoreTrace(
        'composite = avgRaw×0.4 + irt×0.35 + behavioural×0.15 + cognitive×0.1',
        {
          avg_raw:                Math.round(avgRaw * 10) / 10,
          irt_score:              irtScore,
          behavioural_overall:    beh.overall,
          cognitive_overall:      cog.overall,
          spe_focus:              beh.focus,
          lbi_attention_ref:      lbiAttentionRef ?? 'not_available',
          focus_source:           focusSource,
          theta:                  Math.round(theta * 1000) / 1000,
          response_count:         scoredResponses.length,
        },
        { avg_raw: 0.4, irt: 0.35, behavioural: 0.15, cognitive: 0.1 }
      );

      // Upsert score
      await client.query(
        `INSERT INTO spe_scores (assessment_id,user_id,raw_score,normalized_score,irt_score,confidence,uncertainty,score_breakdown,positive_factors,negative_factors,score_trace,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (assessment_id,user_id) DO UPDATE SET
           raw_score=$3,normalized_score=$4,irt_score=$5,confidence=$6,uncertainty=$7,
           score_breakdown=$8,positive_factors=$9,negative_factors=$10,score_trace=$11`,
        [assessment_id, user_id, avgRaw, composite, irtScore, confidence, uncertainty,
          JSON.stringify({ raw: avgRaw, irt: irtScore, behavioural: beh.overall, cognitive: cog.overall, theta, focus_source: focusSource }),
          JSON.stringify(positive), JSON.stringify(negative),
          JSON.stringify(speScoreTrace), tenant_id || null]
      );

      // Audit: score_computed event for SPE (non-blocking)
      pool.query(
        `INSERT INTO capadex_audit_events (session_id, event_type, payload, created_at)
         VALUES (NULL, 'score_computed', $1, now())`,
        [JSON.stringify({
          engine:       'spe',
          assessment_id,
          user_id,
          composite,
          focus_source: focusSource,
          score_trace:  speScoreTrace,
        })]
      ).catch(() => {/* non-blocking */});

      // LBI reconciliation: stored focus_score uses LBI attention when available (authoritative source).
      // Composite is unaffected — composite stability is preserved, focus_score reflects LBI truth.
      const reconciledFocusScore = lbiAttentionRef ?? beh.focus;

      // Upsert behavioural
      await client.query(
        `INSERT INTO spe_behavioural_scores (assessment_id,user_id,persistence_score,focus_score,impulsivity_penalty,adaptability_score,confidence_stability,pacing_score,engagement_score,response_volatility,overall_score,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (assessment_id,user_id) DO UPDATE SET
           persistence_score=$3,focus_score=$4,impulsivity_penalty=$5,adaptability_score=$6,
           confidence_stability=$7,pacing_score=$8,engagement_score=$9,response_volatility=$10,overall_score=$11`,
        [assessment_id, user_id, beh.persistence, reconciledFocusScore, beh.impulsivity, beh.adaptability,
          beh.confidence_stability, beh.pacing, beh.engagement, beh.volatility, beh.overall, tenant_id || null]
      );

      // Upsert cognitive
      await client.query(
        `INSERT INTO spe_cognitive_profiles (user_id,reasoning_score,memory_score,flexibility_score,processing_speed,abstraction_score,metacognition,attention_stability,overload_risk,fatigue_detected,fragmentation_risk,overall_cognitive,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (user_id) DO UPDATE SET
           reasoning_score=$2,memory_score=$3,flexibility_score=$4,processing_speed=$5,
           abstraction_score=$6,metacognition=$7,attention_stability=$8,overload_risk=$9,
           fatigue_detected=$10,fragmentation_risk=$11,overall_cognitive=$12`,
        [user_id, cog.reasoning, cog.memory, cog.flexibility, cog.speed, cog.abstraction,
          cog.metacognition, cog.attention, cog.overload, cog.fatigue, cog.fragmentation, cog.overall, tenant_id || null]
      );

      // Longitudinal record
      await client.query(
        `INSERT INTO spe_longitudinal_scores (user_id,assessment_id,score_type,score_value,tenant_id)
         VALUES ($1,$2,'composite',$3,$4)`,
        [user_id, assessment_id, composite, tenant_id || null]
      );

      res.json({
        success: true, user_id, assessment_id,
        scores: { composite, raw: Math.round(avgRaw), irt: irtScore, behavioural: beh.overall, cognitive: cog.overall },
        confidence: Math.round(confidence * 100) / 100, uncertainty,
        behavioural: beh, cognitive: cog, irt: { theta, score: irtScore },
        positive_factors: positive, negative_factors: negative,
      });
    } catch (e: unknown) {
      console.error('SPE score error:', e);
      res.status(500).json({ error: String(e) });
    } finally { client.release(); }
  });

  // ─── GET /api/admin/spe/dashboard ─────────────────────────────────────────
  app.get('/api/admin/spe/dashboard', async (_req, res) => {
    try {
      const [assessKpi, scoreKpi, behKpi, cogKpi, recentScores] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='active') as active FROM spe_assessments`),
        pool.query(`SELECT COUNT(*) as total_scores, COUNT(DISTINCT user_id) as unique_users,
                   ROUND(AVG(normalized_score)::numeric,1) as avg_score,
                   ROUND(AVG(confidence)::numeric,3) as avg_confidence,
                   COUNT(*) FILTER (WHERE confidence < 0.4) as low_confidence
                   FROM spe_scores`),
        pool.query(`SELECT ROUND(AVG(persistence_score)::numeric,1) as avg_persistence,
                   ROUND(AVG(focus_score)::numeric,1) as avg_focus,
                   ROUND(AVG(engagement_score)::numeric,1) as avg_engagement,
                   ROUND(AVG(overall_score)::numeric,1) as avg_behavioural
                   FROM spe_behavioural_scores`),
        pool.query(`SELECT ROUND(AVG(reasoning_score)::numeric,1) as avg_reasoning,
                   ROUND(AVG(overall_cognitive)::numeric,1) as avg_cognitive,
                   COUNT(*) FILTER (WHERE overload_risk > 60) as overload_count,
                   COUNT(*) FILTER (WHERE fatigue_detected) as fatigue_count
                   FROM spe_cognitive_profiles`),
        pool.query(`SELECT s.user_id, s.normalized_score, s.confidence, s.created_at,
                   a.name as assessment_name
                   FROM spe_scores s LEFT JOIN spe_assessments a ON a.id=s.assessment_id
                   ORDER BY s.created_at DESC LIMIT 10`),
      ]);
      res.json({
        assessments: assessKpi.rows[0], scores: scoreKpi.rows[0],
        behavioural: behKpi.rows[0], cognitive: cogKpi.rows[0],
        recent_scores: recentScores.rows,
      });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/scores ────────────────────────────────────────────
  app.get('/api/admin/spe/scores', async (req, res) => {
    try {
      const { page = '1', limit = '20', assessment_id, search } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params: unknown[] = [];
      const wheres: string[] = [];
      if (assessment_id) { params.push(assessment_id); wheres.push(`s.assessment_id=$${params.length}`); }
      if (search)        { params.push(`%${search}%`);  wheres.push(`s.user_id ILIKE $${params.length}`); }
      const wc = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
      const [count, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM spe_scores s ${wc}`, params),
        pool.query(`SELECT s.*, a.name as assessment_name,
                   b.persistence_score,b.focus_score,b.overall_score as beh_score,
                   c.reasoning_score,c.overall_cognitive
                   FROM spe_scores s
                   LEFT JOIN spe_assessments a ON a.id=s.assessment_id
                   LEFT JOIN spe_behavioural_scores b ON b.user_id=s.user_id AND b.assessment_id=s.assessment_id
                   LEFT JOIN spe_cognitive_profiles c ON c.user_id=s.user_id
                   ${wc} ORDER BY s.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]),
      ]);
      res.json({ total: parseInt(count.rows[0].count), page: parseInt(page), rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/users/:userId ─────────────────────────────────────
  app.get('/api/admin/spe/users/:userId', async (req, res) => {
    const uid = req.params.userId;
    try {
      const [scores, beh, cog, longitudinal] = await Promise.all([
        pool.query(`SELECT s.*,a.name as assessment_name FROM spe_scores s LEFT JOIN spe_assessments a ON a.id=s.assessment_id WHERE s.user_id=$1 ORDER BY s.created_at DESC`, [uid]),
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`, [uid]),
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [uid]),
        pool.query(`SELECT * FROM spe_longitudinal_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [uid]),
      ]);
      res.json({ user_id: uid, scores: scores.rows, behavioural: beh.rows, cognitive: cog.rows[0] || null, longitudinal: longitudinal.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
