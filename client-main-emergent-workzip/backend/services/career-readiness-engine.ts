/**
 * Career Readiness Engine — 5-signal composite readiness score per role.
 * Signals: skill (40%), experience (25%), behavioural (20%), credential (10%), market (5%)
 * Tables: cg_readiness_weights, cg_user_role_readiness, cg_readiness_history
 * Never throws; degrades gracefully.
 */

import type { Pool } from 'pg';
import type { SkillGapResult } from './career-skill-gap-engine';

export interface ReadinessWeights {
  skill_weight: number;
  experience_weight: number;
  behaviour_weight: number;
  credential_weight: number;
  market_weight: number;
}

const DEFAULT_WEIGHTS: ReadinessWeights = {
  skill_weight:      0.40,
  experience_weight: 0.25,
  behaviour_weight:  0.20,
  credential_weight: 0.10,
  market_weight:     0.05,
};

export type ReadinessBand = 'not_ready' | 'developing' | 'approaching' | 'ready' | 'overqualified';

function bandFromScore(score: number): ReadinessBand {
  if (score >= 90) return 'overqualified';
  if (score >= 70) return 'ready';
  if (score >= 50) return 'approaching';
  if (score >= 30) return 'developing';
  return 'not_ready';
}

function etaFromScore(score: number, gapScore: number): number | null {
  if (score >= 70) return null; // already ready
  // Rough estimate: each 10-point readiness gap ≈ 6 months of deliberate effort
  const gap = 70 - score;
  return Math.max(6, Math.round((gap / 10) * 6));
}

export interface ReadinessResult {
  user_id: string;
  role_id: number;
  role_title: string;
  readiness_score: number;      // 0–100
  readiness_band: ReadinessBand;
  eta_months: number | null;
  confidence: number;
  components: {
    skill_score:      number | null;
    experience_score: number | null;
    behaviour_score:  number | null;
    credential_score: number | null;
    market_score:     number | null;
  };
  top_blockers: Array<{ label: string; pts_gain: number }>;
  data_sources: string[];
  degraded: boolean;
}

export async function loadReadinessWeights(pool: Pool): Promise<ReadinessWeights> {
  try {
    const r = await pool.query(
      `SELECT skill_weight::float, experience_weight::float, behaviour_weight::float,
              credential_weight::float, market_weight::float
       FROM cg_readiness_weights WHERE id = 1 LIMIT 1`
    );
    if (r.rows[0]) {
      const row = r.rows[0] as Record<string, number>;
      return {
        skill_weight:      Number(row.skill_weight),
        experience_weight: Number(row.experience_weight),
        behaviour_weight:  Number(row.behaviour_weight),
        credential_weight: Number(row.credential_weight),
        market_weight:     Number(row.market_weight),
      };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_WEIGHTS };
}

async function fetchExperienceScore(pool: Pool, userId: string): Promise<number | null> {
  try {
    const r = await pool.query(
      `SELECT data->>'totalMonths' AS total_months FROM career_seeker_profiles WHERE id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    if (!r.rows[0]) return null;
    const months = Number(r.rows[0].total_months ?? 0);
    if (months === 0) return null;
    // 24 months → ~40, 60 months → 100 (capped)
    return Math.min(Math.round((months / 60) * 100), 100);
  } catch { return null; }
}

async function fetchBehaviourScore(pool: Pool, userId: string): Promise<number | null> {
  try {
    const r = await pool.query(
      `SELECT motivation_score::float, confidence_score::float,
              engagement_score::float, adaptability_score::float
       FROM wcl0_user_intelligence WHERE user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    if (!r.rows[0]) return null;
    const row = r.rows[0] as Record<string, unknown>;
    const vals = [
      Number(row.motivation_score ?? 0),
      Number(row.confidence_score ?? 0),
      Number(row.engagement_score ?? 0),
      Number(row.adaptability_score ?? 0),
    ].filter(v => v > 0);
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  } catch { return null; }
}

async function fetchCredentialScore(pool: Pool, userId: string, roleId: number): Promise<number | null> {
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM competency_scores WHERE user_id = $1 AND score >= 60`,
      [userId]
    ).catch(() => ({ rows: [] }));
    const n = Number(r.rows[0]?.n ?? 0);
    return n > 0 ? Math.min(n * 10, 100) : null;
  } catch { return null; }
}

async function fetchMarketScore(pool: Pool, roleId: number): Promise<number | null> {
  try {
    const r = await pool.query(
      `SELECT demand_score::float FROM cg_roles WHERE id = $1 LIMIT 1`, [roleId]
    );
    return r.rows[0] ? Number(r.rows[0].demand_score) : null;
  } catch { return null; }
}

export async function computeReadiness(
  pool: Pool,
  userId: string,
  roleId: number,
  gapResult: SkillGapResult
): Promise<ReadinessResult> {
  const degraded: ReadinessResult = {
    user_id: userId, role_id: roleId, role_title: gapResult.role_title,
    readiness_score: 0, readiness_band: 'not_ready', eta_months: null,
    confidence: 0, components: { skill_score: null, experience_score: null, behaviour_score: null, credential_score: null, market_score: null },
    top_blockers: [], data_sources: [], degraded: true,
  };

  try {
    const weights = await loadReadinessWeights(pool);
    const sources: string[] = [...gapResult.data_sources];

    // Skill score from gap coverage (100 - weighted_gap_score)
    const skillScore = gapResult.total_required > 0
      ? Math.max(0, 100 - gapResult.weighted_gap_score)
      : null;
    if (skillScore !== null) sources.push('gap_engine');

    const [experienceScore, behaviourScore, credentialScore, marketScore] = await Promise.all([
      fetchExperienceScore(pool, userId),
      fetchBehaviourScore(pool, userId),
      fetchCredentialScore(pool, userId, roleId),
      fetchMarketScore(pool, roleId),
    ]);
    if (experienceScore !== null) sources.push('career_seeker_profiles');
    if (behaviourScore  !== null) sources.push('wcl0_user_intelligence');
    if (credentialScore !== null) sources.push('competency_scores');
    if (marketScore     !== null) sources.push('cg_roles');

    // Behaviour degrades to neutral 50 when CAPADEX/WCL0 data absent.
    // Spec: neutral = 0.5 (50/100). Keeps the weights denominator stable across
    // users rather than renormalising, so scores are comparable regardless of
    // whether a user has completed a CAPADEX session.
    const effectiveBehaviourScore = behaviourScore ?? 50;

    const components: Array<[number | null, number]> = [
      [skillScore,               weights.skill_weight],
      [experienceScore,         weights.experience_weight],
      [effectiveBehaviourScore, weights.behaviour_weight],
      [credentialScore,         weights.credential_weight],
      [marketScore,             weights.market_weight],
    ];

    let weightedSum = 0;
    let usedWeight  = 0;
    for (const [val, w] of components) {
      if (val !== null) { weightedSum += val * w; usedWeight += w; }
    }

    const readinessScore = usedWeight > 0 ? Math.round(weightedSum / usedWeight) : 0;
    const readinessBand  = bandFromScore(readinessScore);
    const etaMonths      = etaFromScore(readinessScore, gapResult.weighted_gap_score);
    const confidence     = Math.min(0.3 + components.filter(([v]) => v !== null).length * 0.15, 1.0);

    // Top blockers
    const blockers: Array<{ label: string; pts_gain: number }> = [];
    const critGaps = gapResult.gaps.filter(g => g.gap_severity === 'critical').slice(0, 3);
    for (const g of critGaps) {
      blockers.push({ label: `Build ${g.skill_label}`, pts_gain: Math.round(g.gap_delta * 4) });
    }
    if (experienceScore !== null && experienceScore < 50) {
      blockers.push({ label: 'Gain more relevant experience', pts_gain: 15 });
    }

    const result: ReadinessResult = {
      user_id: userId, role_id: roleId, role_title: gapResult.role_title,
      readiness_score: readinessScore, readiness_band: readinessBand,
      eta_months: etaMonths, confidence,
      components: {
        skill_score:      skillScore,
        experience_score: experienceScore,
        behaviour_score:  behaviourScore,
        credential_score: credentialScore,
        market_score:     marketScore,
      },
      top_blockers: blockers.slice(0, 3),
      data_sources: [...new Set(sources)],
      degraded: false,
    };

    await persistReadiness(pool, userId, roleId, result).catch(() => {});
    return result;
  } catch {
    return degraded;
  }
}

async function persistReadiness(pool: Pool, userId: string, roleId: number, r: ReadinessResult): Promise<void> {
  await pool.query(
    `INSERT INTO cg_user_role_readiness
       (user_id, role_id, readiness_score, readiness_band, eta_months,
        skill_score, experience_score, behaviour_score, credential_score, market_score,
        confidence, top_blockers, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT(user_id, role_id)
     DO UPDATE SET readiness_score=$3, readiness_band=$4, eta_months=$5,
       skill_score=$6, experience_score=$7, behaviour_score=$8,
       credential_score=$9, market_score=$10, confidence=$11, top_blockers=$12, computed_at=NOW()`,
    [userId, roleId, r.readiness_score, r.readiness_band, r.eta_months,
     r.components.skill_score, r.components.experience_score, r.components.behaviour_score,
     r.components.credential_score, r.components.market_score,
     r.confidence, JSON.stringify(r.top_blockers)]
  );
  await pool.query(
    `INSERT INTO cg_readiness_history(user_id, role_id, readiness_score, readiness_band)
     VALUES ($1,$2,$3,$4)`,
    [userId, roleId, r.readiness_score, r.readiness_band]
  ).catch(() => {});
}

// k-anonymity cohort stats
export async function readinessCohortStats(
  pool: Pool,
  roleId: number,
  kMin = 10
): Promise<{ avg: number; p25: number; p50: number; p75: number; n: number } | null> {
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n,
              ROUND(AVG(readiness_score)::numeric, 1) AS avg,
              ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY readiness_score)::numeric, 1) AS p25,
              ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY readiness_score)::numeric, 1) AS p50,
              ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY readiness_score)::numeric, 1) AS p75
       FROM cg_user_role_readiness WHERE role_id = $1`,
      [roleId]
    );
    const row = r.rows[0] as Record<string, unknown>;
    const n = Number(row.n ?? 0);
    if (n < kMin) return null;
    return { avg: Number(row.avg), p25: Number(row.p25), p50: Number(row.p50), p75: Number(row.p75), n };
  } catch { return null; }
}
