/**
 * Career Passport Bridge — auto-populates passport sections from platform data.
 * Read-only from source systems; additive inserts only (ON CONFLICT DO NOTHING).
 * Never overwrites manually entered data.
 */
import type { Pool } from 'pg';
import crypto from 'crypto';

function makeIntegrityHash(type: string, ref: string, userId: string): string {
  return crypto.createHash('sha256').update(`${type}:${ref}:${userId}`).digest('hex').slice(0, 32);
}

export async function syncPassportFromPlatform(
  userId: string,
  passportId: number,
  pool: Pool,
): Promise<{
  assessments_synced: number;
  scores_synced: number;
  competencies_synced: number;
  learning_synced: number;
  errors: string[];
}> {
  const result = { assessments_synced: 0, scores_synced: 0, competencies_synced: 0, learning_synced: 0, errors: [] as string[] };

  // ── 1. CAPADEX assessment results ─────────────────────────────────────────
  try {
    const { rows: capadex } = await pool.query<{
      session_id: string; concern_name: string; composite_score: number;
      band: string; created_at: string;
    }>(
      `SELECT r.session_id, r.concern_name, r.composite_score, r.band, r.created_at
       FROM capadex_reports r
       WHERE r.user_id = $1 AND r.composite_score IS NOT NULL
       ORDER BY r.created_at DESC LIMIT 20`,
      [userId],
    );
    for (const row of capadex) {
      const hash = makeIntegrityHash('capadex', row.session_id, userId);
      await pool.query(
        `INSERT INTO cp_assessments
           (passport_id, assessment_type, provider, title, score, band, raw_ref, completed_at, platform_verified, integrity_hash)
         VALUES ($1,'capadex','MetryxOne CAPADEX',$2,$3,$4,$5,$6,true,$7)
         ON CONFLICT DO NOTHING`,
        [passportId, `CAPADEX: ${row.concern_name ?? 'Behavioural Profile'}`,
         row.composite_score, row.band, row.session_id, row.created_at, hash],
      ).catch(() => null);
      result.assessments_synced++;
    }
  } catch (e: any) { result.errors.push(`capadex_reports: ${e.message}`); }

  // ── 2. Competency assessment history ──────────────────────────────────────
  try {
    const { rows: comp } = await pool.query<{
      id: string; domain_code: string; score: number; created_at: string;
    }>(
      `SELECT id::text, domain_code, score, created_at
       FROM p4_competency_history
       WHERE user_id = $1 AND score IS NOT NULL
       ORDER BY created_at DESC LIMIT 10`,
      [userId],
    );
    for (const row of comp) {
      const hash = makeIntegrityHash('competency', `p4:${row.id}`, userId);
      await pool.query(
        `INSERT INTO cp_assessments
           (passport_id, assessment_type, provider, title, score, raw_ref, completed_at, platform_verified, integrity_hash)
         VALUES ($1,'competency','MetryxOne Competency',$2,$3,$4,$5,true,$6)
         ON CONFLICT DO NOTHING`,
        [passportId, `Competency: ${row.domain_code}`, row.score, `p4:${row.id}`, row.created_at, hash],
      ).catch(() => null);
      result.assessments_synced++;
    }
  } catch (e: any) { result.errors.push(`p4_competency: ${e.message}`); }

  // ── 3. Future Readiness Index snapshots ───────────────────────────────────
  try {
    const { rows: fri } = await pool.query<{
      id: string; composite: number; band: string; confidence: number; computed_at: string;
    }>(
      `SELECT id::text, composite, band, confidence, computed_at
       FROM frp_user_readiness
       WHERE user_id = $1
       ORDER BY computed_at DESC LIMIT 5`,
      [userId],
    );
    for (const row of fri) {
      await pool.query(
        `INSERT INTO cp_readiness_scores
           (passport_id, score_type, score, band, confidence, computed_at, source_system, source_ref, platform_verified)
         VALUES ($1,'fri',$2,$3,$4,$5,'frp',$6,true)
         ON CONFLICT DO NOTHING`,
        [passportId, row.composite, row.band, row.confidence, row.computed_at, `frp:${row.id}`],
      ).catch(() => null);
      result.scores_synced++;
    }
  } catch (e: any) { result.errors.push(`frp_user_readiness: ${e.message}`); }

  // ── 4. FRP skill profile → competencies ───────────────────────────────────
  try {
    const { rows: skills } = await pool.query<{
      skill_code: string; skill_name: string; proficiency: number; cluster: string; domain: string;
    }>(
      `SELECT s.skill_code, l.name AS skill_name, s.proficiency, l.cluster, l.domain
       FROM frp_user_skill_profile s
       JOIN frp_skill_library l ON l.skill_code = s.skill_code
       WHERE s.user_id = $1 AND s.proficiency >= 40`,
      [userId],
    );
    for (const row of skills) {
      const level = row.proficiency >= 80 ? 'expert' : row.proficiency >= 60 ? 'advanced' : 'intermediate';
      await pool.query(
        `INSERT INTO cp_competencies
           (passport_id, skill_name, category, proficiency_level, proficiency_score, source, source_ref, platform_verified)
         VALUES ($1,$2,$3,$4,$5,'platform',$6,false)
         ON CONFLICT DO NOTHING`,
        [passportId, row.skill_name, row.cluster ?? row.domain, level, row.proficiency, `frp:${row.skill_code}`],
      ).catch(() => null);
      result.competencies_synced++;
    }
  } catch (e: any) { result.errors.push(`frp_skills: ${e.message}`); }

  // ── 5. Career profile skills (manual profile data) ────────────────────────
  try {
    const { rows: csp } = await pool.query<{ data: any }>(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const data = csp[0]?.data ?? {};
    const skills: string[] = Array.isArray(data.skills) ? data.skills : [];
    for (const sk of skills.slice(0, 30)) {
      if (typeof sk !== 'string' || !sk.trim()) continue;
      await pool.query(
        `INSERT INTO cp_competencies (passport_id, skill_name, source, source_ref)
         VALUES ($1,$2,'profile','career_seeker_profile')
         ON CONFLICT DO NOTHING`,
        [passportId, sk.trim()],
      ).catch(() => null);
      result.competencies_synced++;
    }
  } catch (e: any) { result.errors.push(`career_profile: ${e.message}`); }

  // ── 6. Learning history from competency progressions ─────────────────────
  try {
    const { rows: domains } = await pool.query<{
      domain_code: string; max_score: number; last_at: string; assessment_count: string;
    }>(
      `SELECT domain_code, MAX(score) AS max_score, MAX(created_at) AS last_at, COUNT(*)::text AS assessment_count
       FROM p4_competency_history
       WHERE user_id = $1 GROUP BY domain_code`,
      [userId],
    );
    for (const row of domains) {
      await pool.query(
        `INSERT INTO cp_learning_history
           (passport_id, activity_type, title, provider, completed_at, source, source_ref)
         VALUES ($1,'assessment',$2,'MetryxOne Competency Platform',$3,'platform',$4)
         ON CONFLICT DO NOTHING`,
        [passportId,
         `Competency Assessment — ${row.domain_code} (${row.assessment_count}× attempts, best: ${Math.round(row.max_score)}%)`,
         row.last_at, `p4_domain:${row.domain_code}:${userId}`],
      ).catch(() => null);
      result.learning_synced++;
    }
  } catch (e: any) { result.errors.push(`learning_history: ${e.message}`); }

  // ── 7. LBI learning behaviour scores (E4) ─────────────────────────────────
  try {
    const { rows: lbi } = await pool.query<{
      overall_lbi: number; learning_style: string; lbi_band: string; calculated_at: string;
    }>(
      `SELECT l.overall_lbi, l.learning_style, l.lbi_band, l.calculated_at
       FROM lbi_scores l
       JOIN users u ON LOWER(COALESCE(NULLIF(TRIM(u.email),''), u.username)) = l.user_email
       WHERE u.id::text = $1 AND l.overall_lbi IS NOT NULL
       ORDER BY l.calculated_at DESC LIMIT 5`,
      [userId],
    );
    for (const row of lbi) {
      await pool.query(
        `INSERT INTO cp_readiness_scores
           (passport_id, score_type, score, band, confidence, computed_at, source_system, source_ref, platform_verified)
         VALUES ($1,'lbi',$2,$3,0.80,$4,'lbi',$5,true)
         ON CONFLICT DO NOTHING`,
        [passportId, row.overall_lbi, row.lbi_band ?? 'developing',
         row.calculated_at, `lbi:${row.learning_style ?? 'unknown'}:${row.calculated_at}`],
      ).catch(() => null);
      result.scores_synced++;
    }
    if (lbi.length > 0) {
      const latest = lbi[0];
      await pool.query(
        `INSERT INTO cp_assessments
           (passport_id, assessment_type, provider, title, score, band, completed_at, platform_verified, integrity_hash)
         VALUES ($1,'lbi','MetryxOne LBI',$2,$3,$4,$5,true,$6)
         ON CONFLICT DO NOTHING`,
        [passportId,
         `LBI: ${latest.learning_style ? `Learning Style — ${latest.learning_style}` : 'Learning Behaviour Index'}`,
         latest.overall_lbi, latest.lbi_band ?? 'developing', latest.calculated_at,
         makeIntegrityHash('lbi', `${latest.learning_style ?? ''}:${latest.calculated_at}`, userId)],
      ).catch(() => null);
      result.assessments_synced++;
    }
  } catch (e: any) { result.errors.push(`lbi_scores: ${e.message}`); }

  return result;
}
