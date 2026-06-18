/**
 * SPE — GOVERNANCE ENGINE
 * Sections 14–18: Adversarial Robustness, Human-AI Review, Trust Calibration,
 * Meta-Scoring, Federated Psychometrics
 * Section 10: Explainability
 */

import { Express } from 'express';
import pg from 'pg';

function clamp(v: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, isFinite(v) ? v : 0)); }
function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

export function registerSPEGovernanceRoutes(app: Express, pool: pg.Pool) {

  // ── SECTION 14: ADVERSARIAL ROBUSTNESS ─────────────────────────────────────

  // ─── POST /api/spe/adversarial/analyze ───────────────────────────────────
  app.post('/api/spe/adversarial/analyze', async (req, res) => {
    const { user_id, assessment_id, tenant_id } = req.body;
    if (!user_id || !assessment_id) return res.status(400).json({ error: 'user_id, assessment_id required' });
    try {
      const responses = (await pool.query(
        `SELECT response_time_ms,change_count,is_correct,raw_score FROM spe_responses WHERE user_id=$1 AND assessment_id=$2 ORDER BY created_at ASC`,
        [user_id, assessment_id]
      )).rows;
      if (!responses.length) return res.status(400).json({ error: 'No responses found' });

      const times       = responses.map(r => Number(r.response_time_ms) || 3000);
      const rapidFire   = times.filter(t => t < 600).length / times.length;
      const uniform     = times.filter(t => Math.abs(t - mean(times)) < 200).length / times.length;
      const allCorrect  = responses.every(r => r.is_correct);
      const changes     = responses.reduce((a, r) => a + (r.change_count || 0), 0);
      const scores      = responses.map(r => Number(r.raw_score) || 0);
      const scoreStd    = Math.sqrt(scores.map(s => (s - mean(scores)) ** 2).reduce((a, b) => a + b, 0) / scores.length);

      const anomalyScore  = Math.round((rapidFire * 40 + uniform * 20 + (allCorrect ? 20 : 0) + (changes > responses.length * 2 ? 20 : 0)) * 10) / 10;
      const entropyScore  = Math.round((1 - uniform) * 100);
      const flags: Array<{type: string; severity: string; evidence: Record<string, unknown>}> = [];

      if (rapidFire > 0.4) flags.push({ type: 'rapid_fire_pattern', severity: rapidFire > 0.7 ? 'high' : 'medium', evidence: { rapid_fire_rate: rapidFire, threshold: 0.4 } });
      if (uniform > 0.6)   flags.push({ type: 'uniform_timing', severity: 'medium', evidence: { uniform_rate: uniform, mean_time: mean(times) } });
      if (allCorrect && responses.length > 10) flags.push({ type: 'perfect_pattern', severity: 'high', evidence: { correct_rate: 1.0, item_count: responses.length } });
      if (scoreStd < 5 && scores.length > 5) flags.push({ type: 'low_score_entropy', severity: 'low', evidence: { std: scoreStd } });

      const existing = await pool.query(`SELECT id FROM spe_adversarial_flags WHERE user_id=$1 AND assessment_id=$2`, [user_id, assessment_id]);
      if (!existing.rows.length && flags.length > 0) {
        for (const flag of flags) {
          await pool.query(
            `INSERT INTO spe_adversarial_flags (user_id,assessment_id,flag_type,severity,evidence,confidence_score,entropy_score,anomaly_score,pattern_detected,tenant_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [user_id, assessment_id, flag.type, flag.severity, JSON.stringify(flag.evidence), clamp(anomalyScore / 100), entropyScore, anomalyScore, flag.type, tenant_id || null]
          );
        }
      }

      res.json({ success: true, user_id, assessment_id, anomaly_score: anomalyScore, entropy_score: entropyScore, flags_detected: flags.length, flags, risk_level: anomalyScore > 60 ? 'high' : anomalyScore > 30 ? 'medium' : 'low' });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/adversarial ──────────────────────────────────────
  app.get('/api/admin/spe/adversarial', async (req, res) => {
    try {
      const { page = '1', limit = '20', resolved } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const wc = resolved !== undefined ? `WHERE resolved=${resolved === 'true'}` : '';
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE severity='high') as high_severity,
                   COUNT(*) FILTER (WHERE resolved) as resolved,
                   COUNT(DISTINCT user_id) as flagged_users,
                   ROUND(AVG(anomaly_score)::numeric,1) as avg_anomaly
                   FROM spe_adversarial_flags`),
        pool.query(`SELECT * FROM spe_adversarial_flags ${wc} ORDER BY detected_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── PATCH /api/admin/spe/adversarial/:id ────────────────────────────────
  app.patch('/api/admin/spe/adversarial/:id', async (req, res) => {
    const { resolved = true, reviewed_by } = req.body;
    try {
      await pool.query(`UPDATE spe_adversarial_flags SET resolved=$1,reviewed_by=$2 WHERE id=$3`, [resolved, reviewed_by || null, req.params.id]);
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 15: HUMAN-AI HYBRID REVIEW ──────────────────────────────────────

  // ─── POST /api/spe/review/escalate ───────────────────────────────────────
  app.post('/api/spe/review/escalate', async (req, res) => {
    const { user_id, assessment_id, score_id, trigger_reason, uncertainty_level = 0.5, ai_score, priority = 'medium', tenant_id } = req.body;
    if (!user_id || !trigger_reason) return res.status(400).json({ error: 'user_id, trigger_reason required' });
    try {
      const r = await pool.query(
        `INSERT INTO spe_human_reviews (user_id,assessment_id,score_id,trigger_reason,uncertainty_level,ai_score,priority,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, assessment_id || null, score_id || null, trigger_reason, uncertainty_level, ai_score || null, priority, tenant_id || null]
      );
      res.json({ success: true, review: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── PATCH /api/admin/spe/reviews/:id — resolve review ──────────────────
  app.patch('/api/admin/spe/reviews/:id', async (req, res) => {
    const { human_score, reviewer_email, review_notes, status = 'completed' } = req.body;
    try {
      await pool.query(
        `UPDATE spe_human_reviews SET human_score=$1,reviewer_email=$2,review_notes=$3,status=$4,reviewed_at=NOW() WHERE id=$5`,
        [human_score || null, reviewer_email || null, review_notes || null, status, req.params.id]
      );
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ─── GET /api/admin/spe/reviews ───────────────────────────────────────────
  app.get('/api/admin/spe/reviews', async (req, res) => {
    try {
      const { page = '1', limit = '20', status } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const wc = status ? `WHERE status='${status.replace(/'/g, "''")}'` : '';
      const [kpi, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='pending') as pending,
                   COUNT(*) FILTER (WHERE status='completed') as completed,
                   COUNT(*) FILTER (WHERE priority='critical') as critical,
                   ROUND(AVG(uncertainty_level)::numeric,3) as avg_uncertainty
                   FROM spe_human_reviews`),
        pool.query(`SELECT * FROM spe_human_reviews ${wc} ORDER BY escalated_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset]),
      ]);
      res.json({ kpi: kpi.rows[0], rows: rows.rows });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 16: TRUST CALIBRATION ───────────────────────────────────────────

  // ─── POST /api/spe/trust/compute ─────────────────────────────────────────
  app.post('/api/spe/trust/compute', async (req, res) => {
    const { user_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [conf, adverse, scores] = await Promise.all([
        pool.query(`SELECT AVG(overall_confidence) as avg_conf FROM spe_confidence_records WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT COUNT(*) as flags, COUNT(*) FILTER (WHERE severity='high') as high_flags FROM spe_adversarial_flags WHERE user_id=$1 AND NOT resolved`, [user_id]),
        pool.query(`SELECT normalized_score FROM spe_scores WHERE user_id=$1 ORDER BY created_at ASC`, [user_id]),
      ]);
      const sc         = scores.rows.map(r => Number(r.normalized_score));
      const psyRel     = clamp(Number(conf.rows[0]?.avg_conf) || 0.5);
      const longStab   = sc.length > 1 ? clamp(1 - Math.sqrt(sc.map(s => (s - mean(sc)) ** 2).reduce((a, b) => a + b, 0) / sc.length) / 50) : 0.5;
      const behConst   = clamp(1 - Math.min(1, Number(adverse.rows[0]?.flags) / 10));
      const scoreCons  = clamp(1 - Number(adverse.rows[0]?.high_flags) / 5);
      const trust      = Math.round((psyRel * 0.3 + longStab * 0.3 + behConst * 0.25 + scoreCons * 0.15) * 1000) / 1000;
      const flags: string[] = [];
      if (Number(adverse.rows[0]?.high_flags) > 0) flags.push('High-severity adversarial flags detected');
      if (sc.length > 2 && longStab < 0.4)          flags.push('Longitudinal instability');
      if (psyRel < 0.4)                              flags.push('Low psychometric reliability');

      await pool.query(
        `INSERT INTO spe_trust_scores (user_id,trust_score,psychometric_reliability,behavioural_consistency,longitudinal_stability,scoring_consistency,flags,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id) DO UPDATE SET trust_score=$2,psychometric_reliability=$3,behavioural_consistency=$4,longitudinal_stability=$5,scoring_consistency=$6,flags=$7,updated_at=NOW()`,
        [user_id, trust, psyRel, behConst, longStab, scoreCons, JSON.stringify(flags), tenant_id || null]
      );
      res.json({ success: true, user_id, trust_score: trust, breakdown: { psychometric_reliability: psyRel, behavioural_consistency: behConst, longitudinal_stability: longStab, scoring_consistency: scoreCons }, flags });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 17: META-SCORING ─────────────────────────────────────────────────

  // ─── POST /api/spe/meta/compute ──────────────────────────────────────────
  app.post('/api/spe/meta/compute', async (req, res) => {
    const { assessment_id, tenant_id } = req.body;
    try {
      const wc = assessment_id ? `WHERE assessment_id='${String(assessment_id).replace(/'/g, "''")}'` : '';
      const [scoreVar, fairness, trust, reviews] = await Promise.all([
        pool.query(`SELECT STDDEV(normalized_score) as score_std, AVG(confidence) as avg_conf FROM spe_scores ${wc}`),
        pool.query(`SELECT AVG(CASE WHEN dif_detected THEN 0 ELSE 1 END) as fairness_rate FROM spe_fairness_reports`),
        pool.query(`SELECT AVG(trust_score) as avg_trust FROM spe_trust_scores`),
        pool.query(`SELECT COUNT(*) FILTER (WHERE status='pending') as pending_reviews FROM spe_human_reviews`),
      ]);
      const scoreStd = Number(scoreVar.rows[0]?.score_std) || 0;
      const stability   = clamp(1 - scoreStd / 50);
      const fairnessH   = clamp(Number(fairness.rows[0]?.fairness_rate) || 1);
      const psyHealth   = clamp(Number(scoreVar.rows[0]?.avg_conf) || 0.5);
      const trustH      = clamp(Number(trust.rows[0]?.avg_trust) || 0.5);
      const overall     = Math.round((stability * 0.3 + fairnessH * 0.25 + psyHealth * 0.25 + trustH * 0.2) * 1000) / 1000;
      const alerts: string[] = [];
      if (stability < 0.5) alerts.push('Scoring instability detected — consider recalibration');
      if (fairnessH < 0.7) alerts.push('High DIF rate — fairness review required');
      if (Number(reviews.rows[0]?.pending_reviews) > 10) alerts.push('Human review queue backlogged');

      await pool.query(
        `INSERT INTO spe_meta_scores (assessment_id,scoring_stability,fairness_health,psychometric_health,overall_system_health,alerts,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [assessment_id || null, stability, fairnessH, psyHealth, overall, JSON.stringify(alerts), tenant_id || null]
      );
      res.json({ success: true, scoring_stability: stability, fairness_health: fairnessH, psychometric_health: psyHealth, trust_health: trustH, overall_system_health: overall, alerts, calibration_drift: clamp(1 - stability, 0, 1) });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 18: FEDERATED PSYCHOMETRICS ─────────────────────────────────────

  // ─── POST /api/spe/federated/norms ────────────────────────────────────────
  app.post('/api/spe/federated/norms', async (req, res) => {
    const { tenant_id, assessment_id, norm_type = 'regional', region, institution_type } = req.body;
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    try {
      const wc = assessment_id ? `AND s.assessment_id='${assessment_id}'` : '';
      const scores = (await pool.query(`SELECT s.normalized_score FROM spe_scores s WHERE s.tenant_id=$1 ${wc}`, [tenant_id])).rows.map(r => Number(r.normalized_score));
      if (!scores.length) return res.status(400).json({ error: 'No scores for this tenant' });
      const sorted = [...scores].sort((a, b) => a - b);
      const avg    = Math.round(mean(scores) * 10) / 10;
      const stdDev = Math.round(Math.sqrt(scores.map(s => (s - avg) ** 2).reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      await pool.query(
        `INSERT INTO spe_federated_norms (tenant_id,assessment_id,norm_type,region,institution_type,mean_score,std_score,percentile_p25,percentile_p50,percentile_p75,sample_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [tenant_id, assessment_id || null, norm_type, region || null, institution_type || null,
          avg, stdDev, sorted[Math.floor(sorted.length * 0.25)], sorted[Math.floor(sorted.length * 0.5)],
          sorted[Math.floor(sorted.length * 0.75)], scores.length]
      );
      res.json({ success: true, tenant_id, mean: avg, std: stdDev, sample_size: scores.length });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── SECTION 10: EXPLAINABILITY ───────────────────────────────────────────────

  // ─── POST /api/spe/explain ────────────────────────────────────────────────
  app.post('/api/spe/explain', async (req, res) => {
    const { user_id, assessment_id, tenant_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    try {
      const [score, beh, cog, ability, conf] = await Promise.all([
        pool.query(`SELECT * FROM spe_scores WHERE user_id=$1${assessment_id ? ` AND assessment_id='${assessment_id}'` : ''} ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_behavioural_scores WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_cognitive_profiles WHERE user_id=$1`, [user_id]),
        pool.query(`SELECT * FROM spe_ability_estimates WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`, [user_id]),
        pool.query(`SELECT * FROM spe_confidence_records WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [user_id]),
      ]);
      const s = score.rows[0] || {}; const b = beh.rows[0] || {}; const c = cog.rows[0] || {};
      const a = ability.rows[0] || {}; const cf = conf.rows[0] || {};

      const signals = [
        { signal: 'Composite Score', value: s.normalized_score, weight: 0.4 },
        { signal: 'IRT Ability', value: a.ability_score, weight: 0.35 },
        { signal: 'Behavioural Profile', value: b.overall_score, weight: 0.15 },
        { signal: 'Cognitive Profile', value: c.overall_cognitive, weight: 0.1 },
      ].filter(sg => sg.value != null);

      const pos: string[] = Array.isArray(s.positive_factors) ? s.positive_factors : JSON.parse(s.positive_factors || '[]');
      const neg: string[] = Array.isArray(s.negative_factors) ? s.negative_factors : JSON.parse(s.negative_factors || '[]');
      if (Number(b.persistence_score) > 70) pos.push('High persistence');
      if (Number(c.reasoning_score) > 70)   pos.push('Strong reasoning');
      if (Number(c.overload_risk) > 60)     neg.push('Cognitive overload risk');
      if (c.fatigue_detected)               neg.push('Fatigue detected');

      const score_val = Number(s.normalized_score) || 50;
      const narrative = `${user_id}'s intelligence profile indicates a score of ${score_val} with ${Math.round((cf.overall_confidence || 0.5) * 100)}% confidence. ${pos.length ? `Key strengths: ${pos.slice(0, 2).join(', ')}.` : ''} ${neg.length ? `Areas for development: ${neg.slice(0, 2).join(', ')}.` : ''}`;

      const r = await pool.query(
        `INSERT INTO spe_score_explanations (user_id,assessment_id,score_id,csi_score,positive_factors,negative_factors,contributing_signals,confidence_level,uncertainty_level,narrative,tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, assessment_id || null, s.id || null, score_val, JSON.stringify([...new Set(pos)]), JSON.stringify([...new Set(neg)]), JSON.stringify(signals), cf.overall_confidence || 0.5, cf.uncertainty || 0.5, narrative, tenant_id || null]
      );
      res.json({ success: true, explanation: r.rows[0] });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });

  // ── AGGREGATED GOVERNANCE DASHBOARD ─────────────────────────────────────────

  // ─── GET /api/admin/spe/governance ───────────────────────────────────────
  app.get('/api/admin/spe/governance', async (_req, res) => {
    try {
      const [adversarial, reviews, trust, meta] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE severity='high') as high, COUNT(*) FILTER (WHERE NOT resolved) as open FROM spe_adversarial_flags`),
        pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='pending') as pending, COUNT(*) FILTER (WHERE priority IN ('critical','high') AND status='pending') as urgent FROM spe_human_reviews`),
        pool.query(`SELECT COUNT(*) as total, ROUND(AVG(trust_score)::numeric,3) as avg_trust, COUNT(*) FILTER (WHERE trust_score < 0.4) as low_trust FROM spe_trust_scores`),
        pool.query(`SELECT * FROM spe_meta_scores ORDER BY computed_at DESC LIMIT 1`),
      ]);
      res.json({ adversarial: adversarial.rows[0], reviews: reviews.rows[0], trust: trust.rows[0], meta: meta.rows[0] || null });
    } catch (e: unknown) { res.status(500).json({ error: String(e) }); }
  });
}
