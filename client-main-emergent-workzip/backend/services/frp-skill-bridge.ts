/**
 * FRP Skill Bridge — auto-extracts a user's skills from existing Career Builder
 * and CAPADEX data and populates frp_user_skill_profile.
 *
 * Sources (in order):
 *   1. career_seeker_profiles.data.skills  — explicit skill list from career profile
 *   2. career_seeker_profiles.data role    — upskill_priorities from frp_automation_risk
 *   3. CAPADEX completed sessions          — seeds self-awareness / adaptability skill
 *   4. competency_assessment_results       — domain-level competency signals
 *
 * Rules:
 *   - ON CONFLICT (user_id, skill_code) DO NOTHING — never overrides manual ('self') entries
 *   - source is tagged 'auto_career' / 'auto_role' / 'auto_capadex' / 'auto_competency'
 *   - proficiency_level defaults are conservative (50–65); marked is_verified=false
 *   - idempotent: skips if user already has ≥3 skills (unless force=true)
 */
import type { Pool } from 'pg';

export interface BridgeResult {
  populated: number;
  sources: string[];
  skipped: boolean;
}

export async function autoPopulateSkillProfile(
  userId: string,
  pool: Pool,
  opts: { force?: boolean } = {},
): Promise<BridgeResult> {
  try {
    // Skip if already seeded (unless forced refresh)
    if (!opts.force) {
      const { rows } = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM frp_user_skill_profile WHERE user_id = $1`,
        [userId],
      );
      if (Number(rows[0]?.cnt ?? 0) >= 3) return { populated: 0, sources: [], skipped: true };
    }

    let populated = 0;
    const sources: string[] = [];

    // ── 1. Career profile skills list ────────────────────────────────────────
    try {
      const { rows: profiles } = await pool.query<{ data: any }>(
        `SELECT data FROM career_seeker_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId],
      );
      const pd = profiles[0]?.data ?? {};
      const rawSkills: string[] =
        Array.isArray(pd.skills) ? pd.skills
        : typeof pd.skills === 'string' ? pd.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      if (rawSkills.length) {
        let matched = 0;
        for (const skillName of rawSkills.slice(0, 25)) {
          if (!skillName || skillName.length < 2) continue;
          const { rows: lib } = await pool.query<{ skill_code: string }>(
            `SELECT skill_code FROM frp_skill_library
             WHERE (name ILIKE $1 OR name ILIKE $2) AND is_active = true
             LIMIT 1`,
            [`%${skillName.substring(0, 30)}%`, `${skillName.substring(0, 8)}%`],
          );
          if (!lib.length) continue;
          const r = await pool.query(
            `INSERT INTO frp_user_skill_profile (user_id, skill_code, proficiency_level, source, is_verified)
             VALUES ($1, $2, 60, 'auto_career', false)
             ON CONFLICT (user_id, skill_code) DO NOTHING`,
            [userId, lib[0].skill_code],
          ).catch(() => ({ rowCount: 0 }));
          if ((r as any).rowCount) { populated++; matched++; }
        }
        if (matched > 0) sources.push('career_profile');
      }
    } catch { /* profile table absent or user not found */ }

    // ── 2. Role-based skills from automation risk catalog ─────────────────────
    try {
      const { rows: profiles } = await pool.query<{ data: any }>(
        `SELECT data FROM career_seeker_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId],
      );
      const pd = profiles[0]?.data ?? {};
      const role: string = (pd.currentRole || pd.targetRole || pd.role || '').trim();

      if (role.length >= 3) {
        const { rows: riskRows } = await pool.query<{ upskill_priorities: string[] }>(
          `SELECT upskill_priorities FROM frp_automation_risk WHERE role_name ILIKE $1 LIMIT 1`,
          [`%${role.substring(0, 30)}%`],
        );
        let matched = 0;
        for (const skillName of (riskRows[0]?.upskill_priorities ?? []).slice(0, 6)) {
          if (!skillName) continue;
          const { rows: lib } = await pool.query<{ skill_code: string }>(
            `SELECT skill_code FROM frp_skill_library WHERE name ILIKE $1 AND is_active = true LIMIT 1`,
            [`%${skillName.substring(0, 25)}%`],
          );
          if (!lib.length) continue;
          const r = await pool.query(
            `INSERT INTO frp_user_skill_profile (user_id, skill_code, proficiency_level, source, is_verified)
             VALUES ($1, $2, 50, 'auto_role', false)
             ON CONFLICT (user_id, skill_code) DO NOTHING`,
            [userId, lib[0].skill_code],
          ).catch(() => ({ rowCount: 0 }));
          if ((r as any).rowCount) { populated++; matched++; }
        }
        if (matched > 0) sources.push('role_catalog');
      }
    } catch { /* role mapping unavailable */ }

    // ── 3. CAPADEX sessions → self-awareness / adaptability skills ─────────────
    try {
      const { rows: sessions } = await pool.query<{ session_count: string }>(
        `SELECT COUNT(*) AS session_count FROM capadex_sessions WHERE user_id = $1 AND status = 'completed'`,
        [userId],
      );
      const n = Number(sessions[0]?.session_count ?? 0);
      if (n >= 1) {
        const proficiency = Math.min(80, 50 + n * 8);
        const caps = ['SELF_AWARENESS', 'EMOTIONAL_INTELLIGENCE', 'SELF_REGULATION'];
        let matched = 0;
        for (const code of caps.slice(0, Math.min(n, 3))) {
          const r = await pool.query(
            `INSERT INTO frp_user_skill_profile (user_id, skill_code, proficiency_level, source, is_verified)
             SELECT $1, $2, $3, 'auto_capadex', false
             WHERE EXISTS (SELECT 1 FROM frp_skill_library WHERE skill_code = $2)
             ON CONFLICT (user_id, skill_code) DO NOTHING`,
            [userId, code, proficiency],
          ).catch(() => ({ rowCount: 0 }));
          if ((r as any).rowCount) { populated++; matched++; }
        }
        if (matched > 0) sources.push('capadex_sessions');
      }
    } catch { /* capadex table unavailable */ }

    // ── 4. Competency assessment domain signals ────────────────────────────────
    try {
      // p4_competency_history stores domain-level scores; map to FRP skills
      const { rows: compRows } = await pool.query<{ domain_code: string; score: number }>(
        `SELECT domain_code, score FROM p4_competency_history
         WHERE user_id = $1 AND score >= 60
         ORDER BY score DESC LIMIT 5`,
        [userId],
      );
      const domainToSkill: Record<string, string> = {
        'CE': 'ACTIVE_LISTENING', 'ST': 'SYSTEMS_THINKING',
        'PS': 'ANALYTICAL_REASONING', 'LB': 'COLLABORATIVE_LEARNING',
        'GR': 'GROWTH_MINDSET', 'RL': 'RESILIENCE',
        'DL': 'DATA_LITERACY', 'AI': 'AI_LITERACY',
      };
      let matched = 0;
      for (const row of compRows) {
        const code = domainToSkill[row.domain_code];
        if (!code) continue;
        const r = await pool.query(
          `INSERT INTO frp_user_skill_profile (user_id, skill_code, proficiency_level, source, is_verified)
           SELECT $1, $2, $3, 'auto_competency', false
           WHERE EXISTS (SELECT 1 FROM frp_skill_library WHERE skill_code = $2)
           ON CONFLICT (user_id, skill_code) DO NOTHING`,
          [userId, code, Math.min(90, row.score)],
        ).catch(() => ({ rowCount: 0 }));
        if ((r as any).rowCount) { populated++; matched++; }
      }
      if (matched > 0) sources.push('competency_assessment');
    } catch { /* competency table unavailable */ }

    return { populated, sources, skipped: false };
  } catch {
    return { populated: 0, sources: [], skipped: false };
  }
}
