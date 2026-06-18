/**
 * RIE Recovery Intelligence & Failure Prediction
 * Computes Recovery Momentum = velocity × stability × sustainability
 * Collapse rule: velocity drop >30% across 2 consecutive sessions (spec-aligned)
 * Detects: collapse, fatigue, diminishing returns, saturation
 */
import type { Pool } from 'pg';

export interface RecoveryProfile {
  velocity: number;
  stability: number;
  sustainability: number;
  momentum_score: number;
  trajectory: string;
  collapse_detected: boolean;
  fatigue_detected: boolean;
  saturation_detected: boolean;
  sessions_analyzed: number;
  score_history: number[];
}

export async function computeRecoveryProfile(pool: Pool, email: string, tenantId: string = '00000000-0000-0000-0000-000000000000'): Promise<RecoveryProfile> {
  const { rows: sessions } = await pool.query(`
    SELECT score, stage_code, created_at, status FROM capadex_sessions
    WHERE LOWER(guest_email)=$1 AND status='completed'
    ORDER BY created_at ASC LIMIT 20
  `, [email.toLowerCase()]);

  if (sessions.length < 2) {
    return {
      velocity: 0, stability: 50, sustainability: 50,
      momentum_score: 0, trajectory: 'insufficient_data',
      collapse_detected: false, fatigue_detected: false, saturation_detected: false,
      sessions_analyzed: sessions.length, score_history: sessions.map(s => Number(s.score)),
    };
  }

  const scores = sessions.map(s => Number(s.score));
  const n = scores.length;

  // Velocity: compare first vs second half trend
  const firstHalf = scores.slice(0, Math.ceil(n / 2));
  const secondHalf = scores.slice(Math.ceil(n / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const velocity = Math.min(100, Math.max(0, Math.round(50 + (secondAvg - firstAvg) * 1.5)));

  // Stability: inverse of standard deviation
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const stability = Math.min(100, Math.max(0, Math.round(100 - stdDev * 1.5)));

  // Sustainability: recent trend direction
  const recentScores = scores.slice(-4);
  const recentTrend = recentScores.length >= 2
    ? (recentScores[recentScores.length - 1] - recentScores[0]) / recentScores.length
    : 0;
  const sustainability = Math.min(100, Math.max(0, Math.round(50 + recentTrend * 5)));

  const momentum_score = Math.round((velocity * 0.4 + stability * 0.35 + sustainability * 0.25));

  // ── Collapse Detection (Spec: velocity drop >30% over 2 consecutive sessions) ──
  // Check each pair of consecutive scores; flag collapse if any pair drops >30%
  let collapseDetected = false;
  for (let i = 1; i < scores.length; i++) {
    const prev = scores[i - 1];
    if (prev > 0) {
      const dropPct = (prev - scores[i]) / prev;
      if (dropPct > 0.30) {
        collapseDetected = true;
        break;
      }
    }
  }

  // Fatigue: 3+ failed/rejected interventions in last 30 days
  const { rows: failedInterventions } = await pool.query(`
    SELECT COUNT(*) as cnt FROM rie_interventions
    WHERE user_email=$1 AND status IN ('failed','rejected') AND created_at > NOW() - INTERVAL '30 days'
  `, [email]);
  const fatigue_detected = parseInt(failedInterventions[0]?.cnt || '0') >= 3;

  // Saturation: 8+ sessions with small score range and low std dev
  const scoreRange = Math.max(...scores) - Math.min(...scores);
  const saturation_detected = n >= 8 && scoreRange < 10 && stdDev < 8;

  let trajectory = 'stable';
  if (collapseDetected) trajectory = 'collapsing';
  else if (velocity > 65 && stability > 60) trajectory = 'accelerating';
  else if (velocity > 50) trajectory = 'improving';
  else if (velocity < 35 || sustainability < 35) trajectory = 'declining';
  else if (saturation_detected) trajectory = 'plateaued';

  const profile: RecoveryProfile = {
    velocity, stability, sustainability, momentum_score, trajectory,
    collapse_detected: collapseDetected,
    fatigue_detected,
    saturation_detected,
    sessions_analyzed: n,
    score_history: scores,
  };

  await pool.query(`
    INSERT INTO rie_recovery_profiles
      (user_email, tenant_id, velocity, stability, sustainability, momentum_score, trajectory,
       collapse_detected, fatigue_detected, saturation_detected, sessions_analyzed,
       score_history, computed_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
    ON CONFLICT (user_email, tenant_id) DO UPDATE SET
      velocity=$3, stability=$4, sustainability=$5, momentum_score=$6, trajectory=$7,
      collapse_detected=$8, fatigue_detected=$9, saturation_detected=$10,
      sessions_analyzed=$11, score_history=$12, updated_at=NOW()
  `, [
    email, tenantId, velocity, stability, sustainability, momentum_score, trajectory,
    collapseDetected, fatigue_detected, saturation_detected, n,
    JSON.stringify(scores),
  ]);

  if (collapseDetected || fatigue_detected || saturation_detected) {
    await pool.query(`
      UPDATE rie_interventions
      SET saturation_detected=$1, diminishing_returns=$2, updated_at=NOW()
      WHERE user_email=$3 AND status='active'
    `, [saturation_detected, fatigue_detected || collapseDetected, email]);
  }

  return profile;
}
