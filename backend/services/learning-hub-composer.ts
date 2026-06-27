/**
 * MX-302G — Learning Hub composer.
 *
 * A READ-ONLY, never-throws COMPOSITION of the learner's already-computed learning
 * surfaces into one passport-facing hub. It reads existing sources only — it runs
 * NO ensure-schema DDL, writes NO rows, and never fabricates: a section with no
 * data reports `available:false` with `count:0` (null/absent is kept distinct from
 * an empty-but-present zero). Each section degrades independently — one failing read
 * never blanks the others.
 *
 * Sources composed (all pre-existing):
 *   - Growth plan / IDP items ........ cpi_growth_plans      (user_id TEXT)
 *   - Learning activity history ...... cp_learning_history   (passport-scoped)
 *   - Certifications ................. cp_certifications      (honest verified labelling)
 *   - Future-readiness skills ........ frp_user_skill_profile ⋈ frp_skill_library
 *   - Competency development ......... p4_competency_history
 *   - Learning Behaviour Index ....... lbi_scores            (email-keyed)
 */
import type { Pool } from 'pg';

export interface HubSection<T = any> {
  available: boolean;
  count: number;
  items: T[];
  note?: string | null;
}

function emptySection(note?: string): HubSection {
  return { available: false, count: 0, items: [], note: note ?? null };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

/** Growth plan / Individual Development Plan items, grouped by status. */
async function composeGrowthPlan(pool: Pool, userId: string): Promise<HubSection & { summary: Record<string, number> }> {
  return safe(async () => {
    const { rows } = await pool.query<{
      item_id: string; title: string; type: string; status: string;
      priority: number; ei_lift: string; hours: number; updated_at: string;
    }>(
      `SELECT item_id, title, type, status, priority, ei_lift, hours, updated_at
       FROM cpi_growth_plans WHERE user_id = $1
       ORDER BY (status='completed') ASC, priority ASC, updated_at DESC
       LIMIT 100`,
      [userId],
    );
    const summary = { planned: 0, in_progress: 0, completed: 0, skipped: 0 } as Record<string, number>;
    for (const r of rows) if (summary[r.status] !== undefined) summary[r.status] += 1;
    return {
      available: rows.length > 0,
      count: rows.length,
      summary,
      note: rows.length === 0 ? 'No development plan items yet.' : null,
      items: rows.map((r) => ({
        item_id: r.item_id, title: r.title, type: r.type, status: r.status,
        priority: r.priority, ei_lift: r.ei_lift == null ? null : Number(r.ei_lift),
        hours: r.hours, updated_at: r.updated_at,
      })),
    };
  }, { ...emptySection('Development plan unavailable.'), summary: { planned: 0, in_progress: 0, completed: 0, skipped: 0 } });
}

/** Completed learning activities recorded on the passport. */
async function composeLearningHistory(pool: Pool, passportId: number): Promise<HubSection> {
  return safe(async () => {
    const { rows } = await pool.query<{
      activity_type: string; title: string; provider: string; completed_at: string; source: string;
    }>(
      `SELECT activity_type, title, provider, completed_at, source
       FROM cp_learning_history WHERE passport_id = $1
       ORDER BY completed_at DESC NULLS LAST LIMIT 50`,
      [passportId],
    );
    return {
      available: rows.length > 0,
      count: rows.length,
      note: rows.length === 0 ? 'No learning activity recorded yet.' : null,
      items: rows,
    };
  }, emptySection('Learning history unavailable.'));
}

/** Certifications with HONEST verification labelling (no inflation). */
async function composeCertifications(pool: Pool, passportId: number): Promise<HubSection & { verified_count: number }> {
  return safe(async () => {
    const { rows } = await pool.query<{
      title: string; issuer: string; issued_at: string; expires_at: string;
      is_verified: boolean; verification_status: string;
    }>(
      `SELECT title, issuer, issued_at, expires_at, is_verified, verification_status
       FROM cp_certifications WHERE passport_id = $1
       ORDER BY issued_at DESC NULLS LAST LIMIT 50`,
      [passportId],
    );
    const verified = rows.filter((r) => r.is_verified === true && r.verification_status === 'third_party_verified').length;
    return {
      available: rows.length > 0,
      count: rows.length,
      verified_count: verified,
      note: rows.length === 0 ? 'No certifications added yet.'
        : `${verified} of ${rows.length} independently (third-party) verified; the rest are self-declared.`,
      items: rows.map((r) => ({
        title: r.title, issuer: r.issuer, issued_at: r.issued_at, expires_at: r.expires_at,
        // honest single source of truth for the badge — third-party only, never platform-inferred
        verified: r.is_verified === true && r.verification_status === 'third_party_verified',
        verification_status: r.verification_status,
      })),
    };
  }, { ...emptySection('Certifications unavailable.'), verified_count: 0 });
}

/** Future-readiness skill profile (proficiency-ranked). */
async function composeFutureSkills(pool: Pool, userId: string): Promise<HubSection> {
  return safe(async () => {
    const { rows } = await pool.query<{
      skill_name: string; proficiency_level: number; cluster: string; domain: string;
    }>(
      `SELECT l.name AS skill_name, s.proficiency_level, l.cluster, l.domain
       FROM frp_user_skill_profile s
       JOIN frp_skill_library l ON l.skill_code = s.skill_code
       WHERE s.user_id = $1 AND s.proficiency_level IS NOT NULL
       ORDER BY s.proficiency_level DESC LIMIT 50`,
      [userId],
    );
    return {
      available: rows.length > 0,
      count: rows.length,
      note: rows.length === 0 ? 'No future-readiness skill profile yet.' : null,
      items: rows.map((r) => ({
        skill_name: r.skill_name,
        proficiency: r.proficiency_level == null ? null : Number(r.proficiency_level),
        cluster: r.cluster ?? r.domain ?? null,
      })),
    };
  }, emptySection('Future-readiness skills unavailable.'));
}

/** Competency development from measured assessment history (best score per domain). */
async function composeCompetencyDevelopment(pool: Pool, userId: string): Promise<HubSection> {
  return safe(async () => {
    const { rows } = await pool.query<{
      domain_code: string; best_score: string; attempts: string; last_at: string;
    }>(
      `SELECT domain_code, MAX(score) AS best_score, COUNT(*)::text AS attempts, MAX(created_at) AS last_at
       FROM p4_competency_history WHERE user_id = $1 AND score IS NOT NULL
       GROUP BY domain_code ORDER BY MAX(created_at) DESC LIMIT 50`,
      [userId],
    );
    return {
      available: rows.length > 0,
      count: rows.length,
      note: rows.length === 0 ? 'No competency assessment history yet.' : null,
      items: rows.map((r) => ({
        domain_code: r.domain_code,
        best_score: r.best_score == null ? null : Math.round(Number(r.best_score)),
        attempts: Number(r.attempts),
        last_at: r.last_at,
      })),
    };
  }, emptySection('Competency development unavailable.'));
}

/** Learning Behaviour Index analytics (latest). */
async function composeLbi(pool: Pool, userId: string): Promise<HubSection & { latest: any | null }> {
  return safe(async () => {
    const { rows } = await pool.query<{
      overall_lbi: number; learning_style: string; sessions_analyzed: number; calculated_at: string;
    }>(
      `SELECT l.overall_lbi, l.learning_style, l.sessions_analyzed, l.calculated_at
       FROM lbi_scores l
       JOIN users u ON LOWER(COALESCE(NULLIF(TRIM(u.email),''), u.username)) = l.user_email
       WHERE u.id::text = $1 AND l.overall_lbi IS NOT NULL
       ORDER BY l.calculated_at DESC LIMIT 5`,
      [userId],
    );
    const latest = rows[0] ?? null;
    const bandOf = (v: number | null): string | null =>
      v == null ? null : v >= 80 ? 'high' : v >= 60 ? 'developing' : v >= 40 ? 'emerging' : 'early';
    return {
      available: rows.length > 0,
      count: rows.length,
      latest: latest ? {
        overall_lbi: latest.overall_lbi == null ? null : Number(latest.overall_lbi),
        learning_style: latest.learning_style ?? null,
        lbi_band: bandOf(latest.overall_lbi == null ? null : Number(latest.overall_lbi)),
        sessions_analyzed: latest.sessions_analyzed == null ? null : Number(latest.sessions_analyzed),
        calculated_at: latest.calculated_at,
      } : null,
      note: rows.length === 0 ? 'No Learning Behaviour Index computed yet.' : null,
      items: rows,
    };
  }, { ...emptySection('LBI analytics unavailable.'), latest: null });
}

export interface LearningHub {
  user_id: string;
  passport_id: number;
  generated_at: string;
  growth_plan: Awaited<ReturnType<typeof composeGrowthPlan>>;
  learning_history: HubSection;
  certifications: Awaited<ReturnType<typeof composeCertifications>>;
  future_skills: HubSection;
  competency_development: HubSection;
  lbi: Awaited<ReturnType<typeof composeLbi>>;
  coverage: { sections_with_data: number; sections_total: number };
}

export async function composeLearningHub(pool: Pool, userId: string, passportId: number): Promise<LearningHub> {
  const [growth_plan, learning_history, certifications, future_skills, competency_development, lbi] = await Promise.all([
    composeGrowthPlan(pool, userId),
    composeLearningHistory(pool, passportId),
    composeCertifications(pool, passportId),
    composeFutureSkills(pool, userId),
    composeCompetencyDevelopment(pool, userId),
    composeLbi(pool, userId),
  ]);
  const sections = [growth_plan, learning_history, certifications, future_skills, competency_development, lbi];
  return {
    user_id: userId,
    passport_id: passportId,
    generated_at: new Date().toISOString(),
    growth_plan,
    learning_history,
    certifications,
    future_skills,
    competency_development,
    lbi,
    coverage: {
      sections_with_data: sections.filter((s) => s.available).length,
      sections_total: sections.length,
    },
  };
}
