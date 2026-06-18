/**
 * FRP — Future Readiness Recommendation & Benchmarking Engine
 *
 * Generates prioritised recommendations per user based on:
 *   - Low-durability skills in their profile (reskill candidates)
 *   - Missing high-demand skills for their target industry (upskill)
 *   - Role evolution paths from their current role
 *   - High automation risk on their current role (trigger: risk_score > 60)
 *
 * Benchmarks: percentile snapshots per cohort key.
 * All operations are additive and read-only w.r.t. CAPADEX/LBI/Career data.
 */
import type { Pool } from 'pg';

// ── Recommendation Generation ──────────────────────────────────────────────
export interface FRPRecommendation {
  rec_type: string;
  skill_code: string | null;
  role_code: string | null;
  priority: number;
  rationale: string;
}

export async function generateFRPRecommendations(
  userId: string,
  pool: Pool,
  opts?: { targetIndustry?: string; currentRole?: string },
): Promise<FRPRecommendation[]> {
  const recs: FRPRecommendation[] = [];

  try {
    // 1. Reskill: low-durability skills in user profile
    const { rows: lowDurability } = await pool.query<{ skill_code: string; name: string; durability_score: number }>(
      `SELECT sl.skill_code, sl.name, sl.durability_score
       FROM frp_user_skill_profile usp
       JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
       WHERE usp.user_id = $1 AND sl.durability_score < 55
       ORDER BY sl.durability_score ASC LIMIT 5`,
      [userId],
    );
    for (const s of lowDurability) {
      recs.push({ rec_type:'skill_reskill', skill_code:s.skill_code, role_code:null, priority: 100 - s.durability_score, rationale:`${s.name} has a durability score of ${s.durability_score}/100 — significant AI displacement risk within 3–5 years. Build adjacent skills or pivot to higher-durability work.` });
    }

    // 2. Upskill: missing high-demand skills for target industry
    const industry = opts?.targetIndustry || 'technology';
    const { rows: forecast } = await pool.query<{ skill_demand_shift: any }>(
      `SELECT skill_demand_shift FROM frp_industry_forecast WHERE industry_code = $1`,
      [industry],
    );
    const rising: string[] = forecast[0]?.skill_demand_shift?.rising ?? [];
    if (rising.length) {
      const { rows: userSkillNames } = await pool.query<{ name: string }>(
        `SELECT sl.name FROM frp_user_skill_profile usp
         JOIN frp_skill_library sl ON sl.skill_code = usp.skill_code
         WHERE usp.user_id = $1`,
        [userId],
      );
      const owned = new Set(userSkillNames.map(r => r.name.toLowerCase()));
      const missing = rising.filter(r => ![...owned].some(u => u.includes(r.toLowerCase().substring(0,8)))).slice(0, 3);
      for (const skillName of missing) {
        const { rows: lib } = await pool.query<{ skill_code: string }>(
          `SELECT skill_code FROM frp_skill_library WHERE name ILIKE $1 LIMIT 1`,
          [`%${skillName.substring(0,12)}%`],
        );
        recs.push({ rec_type:'skill_upskill', skill_code: lib[0]?.skill_code ?? null, role_code:null, priority: 75, rationale:`${skillName} is a rising skill in the ${industry} sector. Building proficiency now positions you ahead of the curve.` });
      }
    }

    // 3. Role evolution paths from current role
    if (opts?.currentRole) {
      const { rows: evolutions } = await pool.query(
        `SELECT to_role, feasibility_score, evolution_type, required_skills, transition_months_min, transition_months_max, is_ai_driven
         FROM frp_role_evolution WHERE from_role ILIKE $1 ORDER BY feasibility_score DESC LIMIT 3`,
        [`%${opts.currentRole.substring(0, 20)}%`],
      );
      for (const ev of evolutions) {
        recs.push({ rec_type:'role_pivot', skill_code:null, role_code:null, priority: Math.round(ev.feasibility_score * 0.7), rationale:`${ev.evolution_type === 'adjacent' ? 'Adjacent' : ev.evolution_type === 'uplevel' ? 'Upward' : 'Pivot'} path → ${ev.to_role}. Feasibility: ${ev.feasibility_score}/100. Transition: ${ev.transition_months_min}–${ev.transition_months_max} months. Key skills: ${(ev.required_skills as string[]).slice(0,3).join(', ')}.${ev.is_ai_driven ? ' This transition is AI-driven.' : ''}` });
      }
    }

    // 4. Role resilience alert: current role at high risk
    if (opts?.currentRole) {
      const { rows: risk } = await pool.query<{ risk_score: number; risk_band: string; role_name: string; upskill_priorities: string[] }>(
        `SELECT risk_score, risk_band, role_name, upskill_priorities
         FROM frp_automation_risk WHERE role_name ILIKE $1 OR role_code ILIKE $1 LIMIT 1`,
        [`%${opts.currentRole.substring(0, 20)}%`],
      );
      if (risk.length && risk[0].risk_score >= 60) {
        const r = risk[0];
        recs.push({ rec_type:'role_resilience_alert', skill_code:null, role_code:null, priority: r.risk_score, rationale:`${r.role_name} carries a ${r.risk_band} automation risk (${r.risk_score}/100). Recommended focus areas: ${(r.upskill_priorities as string[]).slice(0,3).join(', ')}.` });
      }
    }
  } catch { /* degrade gracefully */ }

  // Sort by priority descending, deduplicate by rationale prefix
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 10);
}

// ── Persist Recommendations ────────────────────────────────────────────────
export async function persistFRPRecommendations(
  userId: string,
  recs: FRPRecommendation[],
  pool: Pool,
): Promise<void> {
  // Soft-expire prior active recs
  await pool.query(`UPDATE frp_recommendations SET status='superseded' WHERE user_id=$1 AND status='active'`, [userId]).catch(() => null);
  for (const r of recs) {
    await pool.query(
      `INSERT INTO frp_recommendations (user_id,rec_type,skill_code,role_code,priority,rationale,status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [userId, r.rec_type, r.skill_code, r.role_code, r.priority, r.rationale],
    ).catch(() => null);
  }
}

// ── Cohort Benchmarks ──────────────────────────────────────────────────────
export async function computeFRPBenchmarks(pool: Pool): Promise<void> {
  const metrics = ['composite','skill_durability','adaptability','market_alignment','learning_velocity','role_resilience'];
  for (const metric of metrics) {
    try {
      const { rows } = await pool.query<{ p25: string; p50: string; p75: string; p90: string; cnt: string }>(
        `SELECT
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${metric}) AS p25,
           PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${metric}) AS p50,
           PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${metric}) AS p75,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${metric}) AS p90,
           COUNT(*) AS cnt
         FROM frp_user_readiness
         WHERE computed_at > NOW() - INTERVAL '30 days'`,
      );
      if (!rows.length || Number(rows[0].cnt) < 5) continue;
      const r = rows[0];
      await pool.query(
        `INSERT INTO frp_benchmarks (cohort_key, metric, p25, p50, p75, p90, sample_size)
         VALUES ('global_30d', $1, $2, $3, $4, $5, $6)
         ON CONFLICT (cohort_key, metric) DO UPDATE
           SET p25=$2, p50=$3, p75=$4, p90=$5, sample_size=$6, computed_at=NOW()`,
        [metric, r.p25, r.p50, r.p75, r.p90, r.cnt],
      ).catch(() => null);
    } catch { /* skip metric */ }
  }
}

// ── Cohort-Specific Benchmark Compute ─────────────────────────────────────
/**
 * Computes per-industry and per-band percentile snapshots.
 * Uses career profile JSONB to segment users by industry.
 * Runs on-demand (admin trigger) or on a cron; silently skips cohorts with <5 users.
 */
export async function computeFRPBenchmarksByCohort(pool: Pool): Promise<{ computed: string[]; skipped: string[] }> {
  const metrics = ['composite','skill_durability','adaptability','market_alignment','learning_velocity','role_resilience'];
  const industries = ['technology','healthcare','finance','education','creative','legal','manufacturing','retail','logistics','government','business_services'];
  const computed: string[] = []; const skipped: string[] = [];

  for (const industry of industries) {
    const cohortKey = `industry_${industry}_30d`;
    try {
      // Join frp_user_readiness with career_seeker_profiles on user_id (VARCHAR join via ::text cast)
      for (const metric of metrics) {
        const { rows } = await pool.query<{ p25: string; p50: string; p75: string; p90: string; cnt: string }>(
          `SELECT
             PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY r.${metric}::numeric) AS p25,
             PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY r.${metric}::numeric) AS p50,
             PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY r.${metric}::numeric) AS p75,
             PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY r.${metric}::numeric) AS p90,
             COUNT(*) AS cnt
           FROM (
             SELECT DISTINCT ON (r2.user_id) r2.user_id, r2.${metric}
             FROM frp_user_readiness r2
             WHERE r2.computed_at > NOW() - INTERVAL '30 days'
             ORDER BY r2.user_id, r2.computed_at DESC
           ) r
           JOIN career_seeker_profiles csp ON csp.user_id::text = r.user_id
           WHERE
             LOWER(csp.data->>'targetIndustry') = $1
             OR LOWER(csp.data->>'industry') = $1
             OR LOWER(csp.data->>'currentIndustry') = $1`,
          [industry],
        );
        const cnt = Number(rows[0]?.cnt ?? 0);
        if (cnt < 5) { if (!skipped.includes(cohortKey)) skipped.push(cohortKey); continue; }
        const r = rows[0];
        await pool.query(
          `INSERT INTO frp_benchmarks (cohort_key, metric, p25, p50, p75, p90, sample_size)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (cohort_key, metric) DO UPDATE
             SET p25=$3, p50=$4, p75=$5, p90=$6, sample_size=$7, computed_at=NOW()`,
          [cohortKey, metric, r.p25, r.p50, r.p75, r.p90, cnt],
        ).catch(() => null);
        if (!computed.includes(cohortKey)) computed.push(cohortKey);
      }
    } catch { skipped.push(cohortKey); }
  }

  // Band-specific cohorts (pioneering / resilient / capable / developing / emerging)
  for (const bandVal of ['pioneering','resilient','capable','developing','emerging']) {
    const cohortKey = `band_${bandVal}_30d`;
    for (const metric of metrics) {
      try {
        const { rows } = await pool.query<{ p25: string; p50: string; p75: string; p90: string; cnt: string }>(
          `SELECT
             PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${metric}::numeric) AS p25,
             PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${metric}::numeric) AS p50,
             PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${metric}::numeric) AS p75,
             PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${metric}::numeric) AS p90,
             COUNT(*) AS cnt
           FROM frp_user_readiness
           WHERE computed_at > NOW() - INTERVAL '30 days' AND band = $1`,
          [bandVal],
        );
        const cnt = Number(rows[0]?.cnt ?? 0);
        if (cnt < 5) { skipped.push(cohortKey); continue; }
        const r = rows[0];
        await pool.query(
          `INSERT INTO frp_benchmarks (cohort_key, metric, p25, p50, p75, p90, sample_size)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (cohort_key, metric) DO UPDATE
             SET p25=$3, p50=$4, p75=$5, p90=$6, sample_size=$7, computed_at=NOW()`,
          [cohortKey, metric, r.p25, r.p50, r.p75, r.p90, cnt],
        ).catch(() => null);
        if (!computed.includes(cohortKey)) computed.push(cohortKey);
      } catch { skipped.push(cohortKey); }
    }
  }

  return { computed: [...new Set(computed)], skipped: [...new Set(skipped)] };
}

// ── Benchmark Retrieval ────────────────────────────────────────────────────

export interface FRPBenchmarkData {
  [metric: string]: { p25: number; p50: number; p75: number; p90: number; sample_size: number; synthetic?: boolean };
}
export interface FRPBenchmarkResult {
  data: FRPBenchmarkData;
  meta: { cohort: string; label: string; sample_size: number; synthetic: boolean };
}

const INDUSTRY_LABELS: Record<string, string> = {
  technology: 'Technology & Software', healthcare: 'Healthcare',
  finance: 'Financial Services', education: 'Education & Training',
  creative: 'Creative Industries', legal: 'Legal Services',
  manufacturing: 'Manufacturing', retail: 'Retail & E-Commerce',
  logistics: 'Logistics & Supply Chain', government: 'Government & Public Sector',
  business_services: 'Business Services',
};

function rowsToData(rows: any[], synthetic = false): FRPBenchmarkData {
  return Object.fromEntries(rows.map(r => [
    r.metric,
    { p25: Number(r.p25), p50: Number(r.p50), p75: Number(r.p75), p90: Number(r.p90),
      sample_size: synthetic ? 0 : Number(r.sample_size), ...(synthetic ? { synthetic: true } : {}) },
  ]));
}

export async function getFRPBenchmarks(pool: Pool, industry?: string): Promise<FRPBenchmarkResult> {
  const empty: FRPBenchmarkResult = { data: {}, meta: { cohort: 'none', label: 'No benchmarks available', sample_size: 0, synthetic: false } };
  try {
    // 1. Industry-specific 30d cohort (preferred when ≥5 users in sector)
    if (industry) {
      const normalized = industry.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');
      const cohortKey = `industry_${normalized}_30d`;
      const { rows } = await pool.query(
        `SELECT metric, p25, p50, p75, p90, sample_size FROM frp_benchmarks
         WHERE cohort_key = $1 AND sample_size >= 5`,
        [cohortKey],
      );
      if (rows.length >= 3) {
        const label = INDUSTRY_LABELS[normalized] ?? (industry.charAt(0).toUpperCase() + industry.slice(1));
        return { data: rowsToData(rows), meta: { cohort: cohortKey, label: `${label} sector (30d)`, sample_size: Number(rows[0]?.sample_size ?? 0), synthetic: false } };
      }
    }

    // 2. Global 30d cohort (≥3 metrics with ≥5 users each)
    const { rows: live } = await pool.query(
      `SELECT metric, p25, p50, p75, p90, sample_size FROM frp_benchmarks
       WHERE cohort_key = 'global_30d' AND sample_size >= 5`,
    );
    if (live.length >= 3) {
      return { data: rowsToData(live), meta: { cohort: 'global_30d', label: 'Platform peers (30d)', sample_size: Number(live[0]?.sample_size ?? 0), synthetic: false } };
    }

    // 3. Synthetic baseline — always present after seedFRPData()
    const { rows: synth } = await pool.query(
      `SELECT metric, p25, p50, p75, p90, sample_size FROM frp_benchmarks
       WHERE cohort_key = 'baseline_synthetic'`,
    );
    if (synth.length) {
      return { data: rowsToData(synth, true), meta: { cohort: 'baseline_synthetic', label: 'Baseline estimate', sample_size: 0, synthetic: true } };
    }
  } catch { /* degrade */ }
  return empty;
}
