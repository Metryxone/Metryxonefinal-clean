/**
 * FRP — Future Readiness Index Engine
 *
 * Computes a per-user composite Future Readiness Index (FRI) from 5 signal axes:
 *   skill_durability   (30%) — weighted average durability of user's skill profile
 *   adaptability       (20%) — behavioural signals from wcl0_user_intelligence
 *   market_alignment   (25%) — intersection of user skills with growing skills in target industry
 *   learning_velocity  (15%) — LIP readiness proxy or profile completeness proxy
 *   role_resilience    (10%) — inverse of automation risk for user's role
 *
 * All axes return a 0–100 score.  The composite maps to a band:
 *   0–29 → emerging | 30–49 → developing | 50–64 → capable
 *   65–79 → resilient | 80–100 → pioneering
 *
 * This engine is additive and read-only — it never mutates CAPADEX/LBI/Career data.
 */
import type { Pool } from 'pg';

const WEIGHTS = { skill_durability:0.30, adaptability:0.20, market_alignment:0.25, learning_velocity:0.15, role_resilience:0.10 };

function band(score: number): string {
  if (score >= 80) return 'pioneering';
  if (score >= 65) return 'resilient';
  if (score >= 50) return 'capable';
  if (score >= 30) return 'developing';
  return 'emerging';
}

// ── Signal: Skill Durability ───────────────────────────────────────────────
async function scoreSkillDurability(userId: string, pool: Pool): Promise<{ score: number; source: string; skill_count: number }> {
  try {
    const { rows } = await pool.query<{ durability_score: number; proficiency_level: number }>(
      `SELECT sl.durability_score, usp.proficiency_level
       FROM frp_user_skill_profile usp
       JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
       WHERE usp.user_id = $1`,
      [userId],
    );
    if (!rows.length) return { score: 40, source: 'default_no_profile', skill_count: 0 };
    const weighted = rows.reduce((acc, r) => acc + (r.durability_score * (r.proficiency_level / 100)), 0) / rows.length;
    return { score: Math.round(weighted), source: 'frp_user_skill_profile', skill_count: rows.length };
  } catch { return { score: 40, source: 'error', skill_count: 0 }; }
}

// ── Signal: Adaptability (from behavioural signals) ───────────────────────
async function scoreAdaptability(userId: string, pool: Pool): Promise<{ score: number; source: string }> {
  try {
    // wcl0_user_intelligence is email-keyed (user_email column, no user_id).
    // Join through the users table to resolve by numeric/string id.
    const { rows } = await pool.query<{ motivation: number; adaptability: number; engagement: number }>(
      `SELECT w.motivation, w.adaptability, w.engagement
       FROM wcl0_user_intelligence w
       JOIN users u ON u.email = w.user_email
       WHERE u.id::text = $1
       ORDER BY w.updated_at DESC LIMIT 1`,
      [userId],
    );
    if (!rows.length) return { score: 45, source: 'default_no_wcl0' };
    const r = rows[0];
    const vals = [r.motivation, r.adaptability, r.engagement].filter(v => v != null && !isNaN(Number(v))).map(Number);
    if (!vals.length) return { score: 45, source: 'wcl0_dims_empty' };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { score: Math.round(Math.min(100, Math.max(0, avg))), source: 'wcl0_user_intelligence' };
  } catch { return { score: 45, source: 'error' }; }
}

// ── Signal: Market Alignment ───────────────────────────────────────────────
async function scoreMarketAlignment(userId: string, pool: Pool, targetIndustry?: string): Promise<{ score: number; source: string; matched_skills: number }> {
  try {
    // Get user's skill codes
    const { rows: userSkills } = await pool.query<{ skill_code: string }>(
      `SELECT skill_code FROM frp_user_skill_profile WHERE user_id = $1`,
      [userId],
    );
    if (!userSkills.length) return { score: 35, source: 'no_skill_profile', matched_skills: 0 };

    // Get growing skills for target industry
    const industry = targetIndustry || 'technology';
    const { rows: forecast } = await pool.query<{ skill_demand_shift: any }>(
      `SELECT skill_demand_shift FROM frp_industry_forecast WHERE industry_code = $1`,
      [industry],
    );
    if (!forecast.length) return { score: 40, source: 'no_industry_forecast', matched_skills: 0 };

    const rising: string[] = forecast[0]?.skill_demand_shift?.rising ?? [];
    if (!rising.length) return { score: 40, source: 'no_rising_skills', matched_skills: 0 };

    // Match user skills to rising skills (name-based fuzzy match)
    const { rows: skillNames } = await pool.query<{ name: string }>(
      `SELECT name FROM frp_skill_library WHERE skill_code = ANY($1)`,
      [userSkills.map(r => r.skill_code)],
    );
    const userSkillNames = skillNames.map(r => r.name.toLowerCase());
    const matched = rising.filter(r => userSkillNames.some(u => u.includes(r.toLowerCase().substring(0, 8)) || r.toLowerCase().includes(u.substring(0, 8)))).length;
    const score = Math.min(100, Math.round((matched / rising.length) * 100) + 30);
    return { score, source: `industry_forecast:${industry}`, matched_skills: matched };
  } catch { return { score: 35, source: 'error', matched_skills: 0 }; }
}

// ── Signal: Learning Velocity ──────────────────────────────────────────────
// Priority chain:
//   1. LIP readiness snapshots (external system, may not be present)
//   2. p4_competency_history score progression  ← primary real signal
//   3. FRP skill profile recent activity
//   4. CAPADEX session count (count proxy)
async function scoreLearningVelocity(userId: string, pool: Pool): Promise<{ score: number; source: string; detail?: string }> {
  // 1. LIP readiness snapshot (external; soft-wired)
  try {
    const { rows: lip } = await pool.query<{ composite: number }>(
      `SELECT composite FROM lip_readiness_snapshots WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
      [userId],
    );
    if (lip.length) return { score: Math.round(lip[0].composite * 0.9), source: 'lip_readiness_snapshot' };
  } catch { /* LIP table absent — continue */ }

  // 2. Competency score progression from p4_competency_history
  //    Improvement rate + breadth of domains assessed = real learning velocity signal
  try {
    const { rows: history } = await pool.query<{ score: number; domain_code: string; created_at: string }>(
      `SELECT score, domain_code, created_at FROM p4_competency_history
       WHERE user_id = $1 AND score IS NOT NULL
       ORDER BY created_at ASC LIMIT 50`,
      [userId],
    );
    if (history.length >= 2) {
      const vals = history.map(r => Number(r.score)).filter(v => !isNaN(v));
      const first = vals[0]; const last = vals[vals.length - 1];
      const improvement = last - first;                                    // raw score gain
      const domains = new Set(history.map(r => r.domain_code)).size;      // breadth
      const assessmentCount = history.length;

      // Base from improvement (0-40 pts) + breadth bonus (up to 20) + engagement (up to 20)
      const improvementScore = Math.max(0, Math.min(40, improvement * 1.2));
      const breadthScore = Math.min(20, domains * 4);
      const engagementScore = Math.min(20, assessmentCount * 3);
      const velocity = Math.round(20 + improvementScore + breadthScore + engagementScore);
      return {
        score: Math.min(95, velocity),
        source: `competency_progression:${assessmentCount}_assessments`,
        detail: `+${Math.round(improvement)} pts improvement · ${domains} domains`,
      };
    }
    if (history.length === 1) {
      const s = Math.min(55, 30 + Number(history[0].score) * 0.25);
      return { score: Math.round(s), source: 'competency_single_assessment' };
    }
  } catch { /* p4_competency_history unavailable */ }

  // 3. FRP skill profile update recency — active skill management = learning signal
  try {
    const { rows: recentSkills } = await pool.query<{ cnt: string; latest: string }>(
      `SELECT COUNT(*) AS cnt, MAX(updated_at) AS latest
       FROM frp_user_skill_profile WHERE user_id = $1`,
      [userId],
    );
    const skillCount = Number(recentSkills[0]?.cnt ?? 0);
    if (skillCount >= 3) {
      const daysSince = recentSkills[0]?.latest
        ? Math.max(0, (Date.now() - new Date(recentSkills[0].latest).getTime()) / 86_400_000)
        : 999;
      const recencyBonus = daysSince < 7 ? 15 : daysSince < 30 ? 8 : 0;
      const score = Math.min(75, 30 + Math.min(20, skillCount * 3) + recencyBonus);
      return { score: Math.round(score), source: `frp_skill_activity:${skillCount}_skills` };
    }
  } catch { /* skip */ }

  // 4. CAPADEX session count fallback
  // capadex_sessions is guest_email-keyed (no user_id); join via users.email.
  try {
    const { rows } = await pool.query<{ session_count: string }>(
      `SELECT COUNT(*) AS session_count FROM capadex_sessions
       WHERE guest_email = (SELECT email FROM users WHERE id::text = $1)
         AND status = 'completed'`,
      [userId],
    );
    const n = Number(rows[0]?.session_count ?? 0);
    const score = Math.min(70, 25 + n * 12);
    return { score, source: `capadex_session_count:${n}` };
  } catch { return { score: 35, source: 'default_no_data' }; }
}

// ── Signal: Role Resilience ────────────────────────────────────────────────
async function scoreRoleResilience(userId: string, pool: Pool, currentRoleCode?: string, targetRoleCode?: string): Promise<{ score: number; source: string; role_code: string | null }> {
  const roleCode = targetRoleCode || currentRoleCode;
  if (!roleCode) return { score: 55, source: 'no_role_code', role_code: null };
  try {
    const { rows } = await pool.query<{ risk_score: number }>(
      `SELECT risk_score FROM frp_automation_risk WHERE role_code = $1`,
      [roleCode],
    );
    if (!rows.length) return { score: 55, source: 'role_not_in_catalog', role_code: roleCode };
    const resilience = 100 - rows[0].risk_score;
    return { score: resilience, source: `automation_risk:${roleCode}`, role_code: roleCode };
  } catch { return { score: 55, source: 'error', role_code: roleCode }; }
}

// ── Main Composer ──────────────────────────────────────────────────────────
export interface FRIResult {
  composite: number;
  band: string;
  skill_durability: number;
  adaptability: number;
  market_alignment: number;
  learning_velocity: number;
  role_resilience: number;
  confidence: number;
  provenance: Record<string, unknown>;
}

export async function computeFutureReadinessIndex(
  userId: string,
  pool: Pool,
  opts?: { targetIndustry?: string; currentRoleCode?: string; targetRoleCode?: string },
): Promise<FRIResult> {
  const [sd, ad, ma, lv, rr] = await Promise.all([
    scoreSkillDurability(userId, pool),
    scoreAdaptability(userId, pool),
    scoreMarketAlignment(userId, pool, opts?.targetIndustry),
    scoreLearningVelocity(userId, pool),
    scoreRoleResilience(userId, pool, opts?.currentRoleCode, opts?.targetRoleCode),
  ]);

  const composite = Math.round(
    sd.score * WEIGHTS.skill_durability +
    ad.score * WEIGHTS.adaptability +
    ma.score * WEIGHTS.market_alignment +
    lv.score * WEIGHTS.learning_velocity +
    rr.score * WEIGHTS.role_resilience,
  );

  // Confidence: fraction of axes that have real data (not defaults)
  const realSources = [sd, ad, ma, lv, rr].filter(a => !a.source.startsWith('default') && !a.source.startsWith('error') && !a.source.startsWith('no_')).length;
  const confidence = Number((realSources / 5).toFixed(2));

  return {
    composite: Math.min(100, Math.max(0, composite)),
    band: band(composite),
    skill_durability: sd.score,
    adaptability: ad.score,
    market_alignment: ma.score,
    learning_velocity: lv.score,
    role_resilience: rr.score,
    confidence,
    provenance: { skill_durability: sd.source, adaptability: ad.source, market_alignment: ma.source, learning_velocity: lv.source, role_resilience: rr.source, skill_count: sd.skill_count },
  };
}

export async function persistFRISnapshot(userId: string, fri: FRIResult, pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO frp_user_readiness
       (user_id,composite,band,skill_durability,adaptability,market_alignment,learning_velocity,role_resilience,confidence,provenance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [userId, fri.composite, fri.band, fri.skill_durability, fri.adaptability, fri.market_alignment, fri.learning_velocity, fri.role_resilience, fri.confidence, JSON.stringify(fri.provenance)],
  ).catch(() => null);

  // Fire LBI chain on FRP snapshot (cross-platform trigger E5)
  setImmediate(() => {
    pool.query<{ user_email: string }>(
      `SELECT LOWER(COALESCE(NULLIF(TRIM(email),''), username)) AS user_email
       FROM users WHERE id::text = $1 LIMIT 1`,
      [userId],
    ).then(async r => {
      const e = r.rows[0]?.user_email;
      if (!e) return;
      const { calculateAndPersistLBI } = await import('../routes/lbi-engine');
      await calculateAndPersistLBI(e, pool).catch(() => {});
    }).catch(() => {});
  });
}
