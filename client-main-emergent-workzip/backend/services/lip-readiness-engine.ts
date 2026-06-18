/**
 * LIP — Learning Readiness Engine
 * 5-signal computation with configurable weights from lip_readiness_weights.
 * Upserts lip_readiness_scores, appends lip_readiness_history. Never throws.
 */
import type { Pool } from 'pg';

export interface LIPReadinessSignals {
  motivation: number;
  cognitive_readiness: number;
  time_availability: number;
  support_network: number;
  prior_learning: number;
}

export interface LIPReadinessResult {
  composite: number;
  band: 'low' | 'moderate' | 'good' | 'high';
  signals: LIPReadinessSignals;
  blockers: string[];
  confidence: number;
  computed_at: string;
}

function readinessBand(score: number): 'low' | 'moderate' | 'good' | 'high' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  return 'low';
}

export async function computeReadiness(userId: string, pool: Pool): Promise<LIPReadinessResult> {
  try {
    // Load weights
    let weights = { motivation: 0.30, cognitive: 0.25, time: 0.20, support: 0.15, prior: 0.10 };
    try {
      const wRes = await pool.query<{
        motivation_weight: string; cognitive_weight: string; time_weight: string;
        support_weight: string; prior_weight: string;
      }>('SELECT * FROM lip_readiness_weights LIMIT 1');
      if (wRes.rows.length > 0) {
        const r = wRes.rows[0];
        weights = {
          motivation: Number(r.motivation_weight),
          cognitive: Number(r.cognitive_weight),
          time: Number(r.time_weight),
          support: Number(r.support_weight),
          prior: Number(r.prior_weight),
        };
      }
    } catch { /* use defaults */ }

    let confidenceFactors = 0;
    const blockers: string[] = [];

    // Signal 1: Motivation from wcl0
    let motivation = 50;
    try {
      const mRes = await pool.query<{ motivation_score: string }>(
        `SELECT motivation_score FROM wcl0_user_intelligence WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`,
        [userId],
      );
      if (mRes.rows.length > 0 && mRes.rows[0].motivation_score != null) {
        motivation = Math.min(100, Math.max(0, Number(mRes.rows[0].motivation_score)));
        confidenceFactors += 1;
        if (motivation < 40) blockers.push('Low motivation signal detected — consider setting clear learning goals');
      }
    } catch { /* table may not exist — neutral */ }

    // Signal 2: Cognitive readiness — median of user's top-10 competency scores
    let cognitive = 50;
    try {
      const cRes = await pool.query<{ normalised_score: string }>(
        `SELECT normalised_score FROM competency_scores
         WHERE user_id=$1 ORDER BY normalised_score DESC LIMIT 10`,
        [userId],
      );
      if (cRes.rows.length > 0) {
        const scores = cRes.rows.map(r => Number(r.normalised_score) * 100);
        const median = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)];
        cognitive = Math.round(Math.min(100, median));
        confidenceFactors += 1;
        if (cognitive < 40) blockers.push('Competency baseline is low — prioritise foundational courses');
      }
    } catch { /* assume neutral */ }

    // Signal 3: Time availability — login days in last 30 days proxy
    let timeAvail = 50;
    try {
      const tRes = await pool.query<{ login_count: string }>(
        `SELECT COUNT(DISTINCT DATE(created_at)) AS login_count
         FROM user_activity_log
         WHERE user_id=$1 AND created_at > NOW() - INTERVAL '30 days'`,
        [userId],
      );
      if (tRes.rows.length > 0) {
        const loginDays = Number(tRes.rows[0].login_count);
        timeAvail = Math.min(100, Math.round((loginDays / 20) * 100));
        confidenceFactors += 1;
        if (timeAvail < 30) blockers.push('Low platform engagement — set a regular weekly learning schedule');
      }
    } catch {
      // Try transformation_history as a proxy
      try {
        const altRes = await pool.query<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM transformation_history
           WHERE user_id=$1 AND recorded_at > NOW() - INTERVAL '30 days'`,
          [userId],
        );
        if (altRes.rows.length > 0 && Number(altRes.rows[0].cnt) > 0) {
          timeAvail = Math.min(100, Math.round((Number(altRes.rows[0].cnt) / 10) * 100));
          confidenceFactors += 0.5;
        }
      } catch { /* use neutral 50 */ }
    }

    // Signal 4: Support network — mentor connections + goals
    let support = 50;
    try {
      const mentorRes = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM lip_user_mentors WHERE user_id=$1 AND status='active'`,
        [userId],
      );
      const goalRes = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM career_goals WHERE user_id=$1 AND completed=false`,
        [userId],
      );
      const mentorCount = Number(mentorRes.rows[0]?.cnt ?? 0);
      const goalCount = Number(goalRes.rows[0]?.cnt ?? 0);
      support = Math.min(100, mentorCount * 25 + goalCount * 10);
      if (support === 0) support = 25; // baseline
      confidenceFactors += 0.5;
      if (support < 25) blockers.push('No active mentor — connecting with a mentor accelerates learning velocity');
    } catch { support = 25; }

    // Signal 5: Prior learning — completed courses and certs
    let priorLearning = 0;
    try {
      const coursesDone = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM lip_user_courses WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      const certsDone = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM lip_user_certifications WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      const cc = Number(coursesDone.rows[0]?.cnt ?? 0);
      const cd = Number(certsDone.rows[0]?.cnt ?? 0);
      priorLearning = Math.min(100, Math.round((cc + cd * 2) / 10 * 100));
      if (priorLearning === 0) priorLearning = 10; // fresh start baseline
      confidenceFactors += 0.5;
    } catch { priorLearning = 10; }

    // Composite
    const composite = Math.round(
      motivation * weights.motivation +
      cognitive * weights.cognitive +
      timeAvail * weights.time +
      support * weights.support +
      priorLearning * weights.prior,
    );

    const band = readinessBand(composite);
    const confidence = Math.min(1, confidenceFactors / 4);

    const signals: LIPReadinessSignals = {
      motivation: Math.round(motivation),
      cognitive_readiness: Math.round(cognitive),
      time_availability: Math.round(timeAvail),
      support_network: Math.round(support),
      prior_learning: Math.round(priorLearning),
    };

    // Upsert readiness scores
    try {
      await pool.query(
        `INSERT INTO lip_readiness_scores
           (user_id,motivation_score,cognitive_readiness_score,time_availability_score,
            support_network_score,prior_learning_score,composite_readiness,readiness_band,
            blockers,confidence,computed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           motivation_score=EXCLUDED.motivation_score,
           cognitive_readiness_score=EXCLUDED.cognitive_readiness_score,
           time_availability_score=EXCLUDED.time_availability_score,
           support_network_score=EXCLUDED.support_network_score,
           prior_learning_score=EXCLUDED.prior_learning_score,
           composite_readiness=EXCLUDED.composite_readiness,
           readiness_band=EXCLUDED.readiness_band,
           blockers=EXCLUDED.blockers,
           confidence=EXCLUDED.confidence,
           computed_at=NOW()`,
        [userId, signals.motivation, signals.cognitive_readiness, signals.time_availability,
         signals.support_network, signals.prior_learning, composite, band,
         JSON.stringify(blockers), confidence],
      );

      // Append history
      await pool.query(
        `INSERT INTO lip_readiness_history (user_id,composite_readiness,readiness_band,snapshot,recorded_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [userId, composite, band, JSON.stringify(signals)],
      );
    } catch { /* best-effort */ }

    return { composite, band, signals, blockers, confidence, computed_at: new Date().toISOString() };
  } catch {
    return {
      composite: 50, band: 'moderate',
      signals: { motivation: 50, cognitive_readiness: 50, time_availability: 50, support_network: 25, prior_learning: 10 },
      blockers: [], confidence: 0.2, computed_at: new Date().toISOString(),
    };
  }
}
