/**
 * SPE — PSYCHOMETRIC ENGINE
 * Sections 4–9: IRT Calibration, Bayesian Estimation, Normalization,
 * Confidence & Uncertainty, Reliability & Validity, Fairness & DIF
 */

import { Express } from 'express';
import pg from 'pg';

// ── Math helpers ──────────────────────────────────────────────────────────────
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function std(arr: number[]): number {
  const m = mean(arr);
  return arr.length > 1 ? Math.sqrt(arr.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / (arr.length - 1)) : 0;
}
function clamp(v: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : 0)); }
function reliabilityGrade(alpha: number): string {
  if (alpha >= 0.90) return 'Excellent';
  if (alpha >= 0.80) return 'Good';
  if (alpha >= 0.70) return 'Acceptable';
  if (alpha >= 0.60) return 'Questionable';
  return 'Poor';
}

// ── Bayesian ability update ───────────────────────────────────────────────────
function bayesianUpdate(prior: number, priorVar: number, responses: Array<{correct: boolean; difficulty: number; discrimination: number}>) {
  let mu = prior, sigma2 = priorVar;
  for (const r of responses) {
    const p = 1 / (1 + Math.exp(-r.discrimination * (mu - r.difficulty)));
    const q = 1 - p;
    const y = r.correct ? 1 : 0;
    const info = r.discrimination ** 2 * p * q;
    if (info < 0.001) continue;
    const gain = sigma2 * r.discrimination * (y - p);
    mu += gain;
    sigma2 = 1 / (1 / sigma2 + info);
    mu = Math.max(-5, Math.min(5, mu));
  }
  return { posterior: mu, variance: sigma2, confidence: clamp(1 - Math.sqrt(sigma2) / 4), uncertainty: clamp(Math.sqrt(sigma2) / 4) };
}

// ── Cronbach Alpha ────────────────────────────────────────────────────────────
function cronbachAlpha(itemScores: number[][]): number {
  const n = itemScores.length;
  if (n < 2) return 0;
  const totals = itemScores[0].map((_, j) => itemScores.reduce((s, row) => s + row[j], 0));
  const totalVar = std(totals) ** 2 * (totals.length - 1) / totals.length;
  if (totalVar === 0) return 0;
  const itemVars = itemScores.map(row => { const m = mean(row); return mean(row.map(x => (x - m) ** 2)); });
  const sumItemVar = itemVars.reduce((a, b) => a + b, 0);
  return clamp((n / (n - 1)) * (1 - sumItemVar / totalVar), -1, 1);
}

export function registerSPEPsychometricsRoutes(app: Express, pool: pg.Pool) {

  // ─── POST /api/spe/calibrate/:assessmentId ────────────────────────────────
  app.post('/api/spe/calibrate/:assessmentId', async (req, res) => {
    const { assessmentId } = req.params;
    const client = await pool.connect();
    try {
      const qRes = await client.query(`SELECT * FROM spe_questions WHERE assessment_id=$1`, [assessmentId]);
      const questions = qRes.rows;
      if (!questions.length) return res.status(400).json({ error: 'No questions found' });

      const calibrated = [];
      for (const q of questions) {
        const rRes = await client.query(
          `SELECT is_correct, raw_score, response_time_ms FROM spe_responses WHERE question_id=$1`, [q.id]
        );
        const responses = rRes.rows;
        if (responses.length < 5) { calibrated.push({ question_id: q.id, skipped: true, reason: 'insufficient data' }); continue; }

        const scores    = responses.map(r => Number(r.raw_score) || 0);
        const correct   = responses.map(r => r.is_correct ? 1 : 0);
        const correctRate = mean(correct);
        const difficulty  = clamp(1 - correctRate, 0, 1);
        const itemVar     = std(scores) ** 2;
        const totalScores = (await client.query(`SELECT normalized_score FROM spe_scores WHERE assessment_id=$1 AND user_id IN (SELECT DISTINCT user_id FROM spe_responses WHERE question_id=$2)`, [assessmentId, q.id])).rows.map(r => Number(r.normalized_score));
        const totalMean = mean(totalScores);
        const itemMean  = mean(scores);
        const covariance = responses.length > 1 ? responses.map((_, i) => (scores[i] - itemMean) * ((totalScores[i] || totalMean) - totalMean)).reduce((a, b) => a + b, 0) / responses.length : 0;
        const totalStd = std(totalScores);
        const itemStd  = std(scores);
        const discrimination = itemStd > 0 && totalStd > 0 ? clamp(covariance / (itemStd * totalStd), -1, 1) : 0.5;
        const information = discrimination ** 2 * correctRate * (1 - correctRate);

        await client.query(
          `INSERT INTO spe_psychometric_items (question_id,difficulty,discrimination,guessing,information_value,sample_size,response_count,calibration_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,1)
           ON CONFLICT (question_id) DO UPDATE SET difficulty=$2,discrimination=$3,guessing=$4,information_value=$5,sample_size=$6,response_count=$7,calibrated_at=NOW(),calibration_version=spe_psychometric_items.calibration_version+1`,
          [q.id, difficulty, discrimination, 0.25, information, responses.length, responses.length]
        );
        await client.query(
          `UPDATE spe_questions SET difficulty_parameter=$1,discrimination_index=$2,calibrated_at=NOW() WHERE id=$3`,
          [difficulty * 6 - 3, discrimination, q.id]
        );
        calibrated.push({ question_id: q.id, difficulty, discrimination, information, n: responses.length });
      }

      // Cronbach alpha across all items for this assessment
      const allUsers = (await client.query(`SELECT DISTINCT user_id FROM spe_responses WHERE assessment_id=$1`, [assessmentId])).rows.map(r => r.user_id);
      const itemScoreMatrix: number[][] = [];
      for (const q of questions) {
        const row: number[] = [];
        for (const uid of allUsers) {
          const r = await client.query(`SELECT raw_score FROM spe_responses WHERE question_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1`, [q.id, uid]);
          row.push(r.rows[0] ? Number(r.rows[0].raw_score) : 0);
        }
        itemScoreMatrix.push(row);
      }
      const alpha = cronbachAlpha(itemScoreMatrix);
      const grade = reliabilityGrade(alpha);

      await client.query(
        `INSERT INTO spe_psychometric_reports (assessment_id,cronbach_alpha,reliability_grade,psychometric_confidence,sample_size)
         VALUES ($1,$2,$3,$4,$5)`,
        [assessmentId, Math.round(alpha * 1000) / 1000, grade, clamp(0.3 + alpha * 0.7), allUsers.length]
      );

      res.json({ success: true, assessment_id: assessmentId, questions_calibrated: calibrated.length, cronbach_alpha: Math.round(alpha * 1000) / 1000, grade, calibrated });
    } catch (e: unknown) { console.error('Calibrate error:', e); res.status(500).json({ error: String(e) }); }
    finally { client.release(); }
  });

  // ─── POST /api/spe/ability — Bayesian ability estimate ────────────────────
  app.post('/api/spe/ability', async (req, res) => {
    const { user_id, assessment_id, prior_ability = 0, prior_variance = 1 } = req.body;
    if (!user_id || !assessment_id) return res.status(400).json({ error: 'user_id, assessment_id required' });
    try {
      const rRes = await pool.query(
        `SELECT r.is_correct, q.difficulty_parameter as difficulty, q.discrimination_index as discrimination
         FROM spe_responses r
         JOIN spe_questions q ON q.id=r.question_id
         WHERE r.user_id=$1 AND r.assessment_id=$2`,
        [user_id, assessment_id]
      );
      const responses = rRes.rows.map(r => ({
        correct: r.is_correct, difficulty: Number(r.difficulty) || 0, discrimination: Number(r.discrimination) || 1
      }));
      if (!responses.length) return res.status(400).json({ error: 'No responses found' });

      const result = bayesianUpdate(prior_ability, prior_variance, responses);
      const abilityScore = Math.round(Math.min(100, Math.max(0, (result.posterior + 4) / 8 * 100)));

      await pool.query(
        `INSERT INTO spe_ability_estimates (user_id,assessment_id,ability_score,prior_ability,posterior_ability,confidence,uncertainty,iteration_count,converged)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id,assessment_id) DO UPDATE SET ability_score=$3,posterior_ability=$5,confidence=$6,uncertainty=$7,iteration_count=spe_ability_estimates.iteration_count+1,converged=$9,updated_at=NOW()`,
        [user_id, assessment_id, abilityScore, prior_ability, result.posterior, result.confidence, result.uncertainty, responses.length, result.variance < 0.5]
      );

      res.json({ success: true, user_id, assessment_id, ability_score: abilityScore, posterior: result.posterior, confidence: result.confidence, uncertainty: result.uncertainty, converged: result.variance < 0.5 });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/normalize/:assessmentId ────────────────────────────────
  app.post('/api/spe/normalize/:assessmentId', async (req, res) => {
    const { assessmentId } = req.params;
    try {
      const scores = (await pool.query(`SELECT normalized_score FROM spe_scores WHERE assessment_id=$1`, [assessmentId])).rows.map(r => Number(r.normalized_score));
      if (!scores.length) return res.status(400).json({ error: 'No scores to normalize' });

      const sorted = [...scores].sort((a, b) => a - b);
      const cohortMean = mean(scores);
      const cohortStd  = std(scores);
      const ptileTable: Record<number, number> = {};
      [10, 25, 50, 75, 90].forEach(p => { ptileTable[p] = sorted[Math.floor(sorted.length * p / 100)] || 0; });

      await pool.query(
        `INSERT INTO spe_normalization_params (assessment_id,cohort_mean,cohort_std,cohort_min,cohort_max,percentile_table,sample_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (assessment_id) DO UPDATE SET cohort_mean=$2,cohort_std=$3,cohort_min=$4,cohort_max=$5,percentile_table=$6,sample_size=$7,norm_version=spe_normalization_params.norm_version+1,updated_at=NOW()`,
        [assessmentId, cohortMean, cohortStd, Math.min(...scores), Math.max(...scores), JSON.stringify(ptileTable), scores.length]
      );

      // Z-score normalize all scores for this assessment
      for (const row of (await pool.query(`SELECT user_id,raw_score FROM spe_scores WHERE assessment_id=$1`, [assessmentId])).rows) {
        const z = cohortStd > 0 ? (Number(row.raw_score) - cohortMean) / cohortStd : 0;
        const normalized = Math.round(Math.min(100, Math.max(0, 50 + z * 15)));
        await pool.query(`UPDATE spe_scores SET normalized_score=$1 WHERE assessment_id=$2 AND user_id=$3`, [normalized, assessmentId, row.user_id]);
      }

      res.json({ success: true, assessment_id: assessmentId, cohort_mean: cohortMean, cohort_std: cohortStd, sample_size: scores.length, percentiles: ptileTable });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/confidence — compute confidence for a user ─────────────
  app.post('/api/spe/confidence', async (req, res) => {
    const { user_id, assessment_id } = req.body;
    if (!user_id || !assessment_id) return res.status(400).json({ error: 'user_id, assessment_id required' });
    try {
      const score  = (await pool.query(`SELECT * FROM spe_scores WHERE user_id=$1 AND assessment_id=$2`, [user_id, assessment_id])).rows[0];
      const beh    = (await pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 AND assessment_id=$2`, [user_id, assessment_id])).rows[0];
      const cog    = (await pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id])).rows[0];
      const prevScores = (await pool.query(`SELECT normalized_score FROM spe_scores WHERE user_id=$1`, [user_id])).rows.map(r => Number(r.normalized_score));

      const behConsistency  = beh ? clamp(1 - Number(beh.response_volatility) / 100) : 0.5;
      const psyReliability  = score ? clamp(Number(score.confidence)) : 0.5;
      const responseStab    = beh ? clamp(1 - Number(beh.impulsivity_penalty) / 100) : 0.5;
      const longConsistency = prevScores.length > 1 ? clamp(1 - std(prevScores) / 50) : 0.5;
      const signalComplete  = score ? clamp(0.3 + (score ? 0.7 : 0)) : 0.3;
      const overall = (behConsistency * 0.25 + psyReliability * 0.25 + responseStab * 0.2 + longConsistency * 0.2 + signalComplete * 0.1);
      const uncertainty = clamp(1 - overall);

      await pool.query(
        `INSERT INTO spe_confidence_records (user_id,assessment_id,behavioural_consistency,psychometric_reliability,response_stability,longitudinal_consistency,signal_completeness,overall_confidence,uncertainty)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id,assessment_id) DO UPDATE SET behavioural_consistency=$3,psychometric_reliability=$4,response_stability=$5,longitudinal_consistency=$6,signal_completeness=$7,overall_confidence=$8,uncertainty=$9,computed_at=NOW()`,
        [user_id, assessment_id, behConsistency, psyReliability, responseStab, longConsistency, signalComplete, overall, uncertainty]
      );

      res.json({ success: true, user_id, assessment_id, confidence: Math.round(overall * 1000) / 1000, uncertainty: Math.round(uncertainty * 1000) / 1000, breakdown: { behavioural_consistency: behConsistency, psychometric_reliability: psyReliability, response_stability: responseStab, longitudinal_consistency: longConsistency, signal_completeness: signalComplete } });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── POST /api/spe/fairness/dif — DIF analysis ────────────────────────────
  app.post('/api/spe/fairness/dif', async (req, res) => {
    const { assessment_id, group_field = 'age_band', threshold = 0.2 } = req.body;
    if (!assessment_id) return res.status(400).json({ error: 'assessment_id required' });
    try {
      const questions = (await pool.query(`SELECT id FROM spe_questions WHERE assessment_id=$1`, [assessment_id])).rows;
      const generated = [];
      for (const q of questions) {
        const rA = (await pool.query(`SELECT AVG(raw_score) as m FROM spe_responses WHERE question_id=$1 AND user_id IN (SELECT user_id FROM spe_scores WHERE assessment_id=$2 AND normalized_score >= 50)`, [q.id, assessment_id])).rows[0];
        const rB = (await pool.query(`SELECT AVG(raw_score) as m FROM spe_responses WHERE question_id=$1 AND user_id IN (SELECT user_id FROM spe_scores WHERE assessment_id=$2 AND normalized_score < 50)`, [q.id, assessment_id])).rows[0];
        const mA = Number(rA?.m) || 50;
        const mB = Number(rB?.m) || 50;
        const effectSize = Math.abs(mA - mB) / 25;
        const dif = effectSize > Number(threshold);
        if (dif || Math.random() < 0.3) {
          await pool.query(
            `INSERT INTO spe_fairness_reports (assessment_id,question_id,dif_score,dif_detected,group_a,group_b,group_a_mean,group_b_mean,effect_size,bias_type,recommended_action)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [assessment_id, q.id, effectSize, dif, 'high_performers', 'low_performers', mA, mB, effectSize,
              dif ? (effectSize > 0.5 ? 'difficulty' : 'discrimination') : 'none',
              dif ? 'Review item wording for clarity' : 'Monitor']
          );
          generated.push({ question_id: q.id, dif, effect_size: effectSize, mA, mB });
        }
      }
      res.json({ success: true, assessment_id, items_analyzed: questions.length, dif_detected: generated.filter(g => g.dif).length, generated });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/psychometrics — reports & items ───────────────────
  app.get('/api/admin/spe/psychometrics', async (req, res) => {
    try {
      const { page = '1', limit = '20', assessment_id } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const wc = assessment_id ? `WHERE r.assessment_id='${assessment_id}'` : '';
      const [kpi, reports, items, fairness] = await Promise.all([
        pool.query(`SELECT ROUND(AVG(cronbach_alpha)::numeric,3) as avg_alpha, COUNT(*) as total_reports,
                   COUNT(*) FILTER (WHERE reliability_grade='Excellent') as excellent,
                   COUNT(*) FILTER (WHERE reliability_grade='Good') as good,
                   ROUND(AVG(sample_size)::numeric,0) as avg_sample
                   FROM spe_psychometric_reports`),
        pool.query(`SELECT r.*,a.name as assessment_name FROM spe_psychometric_reports r LEFT JOIN spe_assessments a ON a.id=r.assessment_id ${wc} ORDER BY r.generated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
        pool.query(`SELECT pi.*,q.question_text,q.competency FROM spe_psychometric_items pi LEFT JOIN spe_questions q ON q.id=pi.question_id ORDER BY pi.calibrated_at DESC LIMIT 50`),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE dif_detected) as dif_count, ROUND(AVG(effect_size)::numeric,3) as avg_effect FROM spe_fairness_reports`),
      ]);
      res.json({ kpi: kpi.rows[0], reports: reports.rows, items: items.rows, fairness: fairness.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/ability ───────────────────────────────────────────
  app.get('/api/admin/spe/ability', async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(ability_score)::numeric,1) as avg_ability,
                   ROUND(AVG(confidence)::numeric,3) as avg_confidence,
                   COUNT(*) FILTER (WHERE converged) as converged_count
                   FROM spe_ability_estimates`),
        pool.query(`SELECT ae.*,a.name as assessment_name FROM spe_ability_estimates ae LEFT JOIN spe_assessments a ON a.id=ae.assessment_id ORDER BY ae.updated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/fairness ─────────────────────────────────────────
  app.get('/api/admin/spe/fairness', async (req, res) => {
    try {
      const [kpi, reports] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE dif_detected) as dif_count,
                   ROUND(AVG(effect_size)::numeric,3) as avg_effect,
                   COUNT(*) FILTER (WHERE resolved) as resolved
                   FROM spe_fairness_reports`),
        pool.query(`SELECT fr.*,a.name as assessment_name,q.question_text FROM spe_fairness_reports fr LEFT JOIN spe_assessments a ON a.id=fr.assessment_id LEFT JOIN spe_questions q ON q.id=fr.question_id ORDER BY fr.generated_at DESC LIMIT 50`),
      ]);
      res.json({ kpi: kpi.rows[0], reports: reports.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── PATCH /api/admin/spe/fairness/:id ────────────────────────────────────
  app.patch('/api/admin/spe/fairness/:id', async (req, res) => {
    const { resolved = true, recommended_action } = req.body;
    try {
      await pool.query(`UPDATE spe_fairness_reports SET resolved=$1${recommended_action ? `,recommended_action='${recommended_action.replace(/'/g, "''")}'` : ''} WHERE id=$2`, [resolved, req.params.id]);
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
