/**
 * LIP — Resource Mapping Engine
 * Four mappers (courses, certs, projects, mentors).
 * Each loads the catalog, scores against user's gaps/needs,
 * upserts relevance to per-user tables, returns top-20 ranked.
 * Never throws.
 */
import type { Pool } from 'pg';
import type { LIPGap } from './lip-competency-gap-engine';
import type { LIPNeed } from './lip-learning-need-engine';

export interface LIPCourse {
  id: string; title: string; provider: string; type: string; delivery_mode: string;
  duration_hours: number; difficulty_level: number; cost_usd: number; cost_inr: number;
  quality_score: number; rating: number; skills_covered: string[]; competency_codes: string[];
  region: string; url: string | null; relevance_score: number;
}
export interface LIPCert {
  id: string; title: string; issuing_body: string; type: string; validity_years: number | null;
  prep_hours_estimate: number; cost_usd: number; cost_inr: number; difficulty_level: number;
  prestige_score: number; skills_validated: string[]; competency_codes: string[];
  industry_codes: string[]; relevance_score: number;
}
export interface LIPProject {
  id: string; title: string; type: string; duration_hours: number; difficulty_level: number;
  skills_practiced: string[]; competency_codes: string[]; deliverable: string;
  solo_or_team: string; description: string | null; relevance_score: number;
}
export interface LIPMentor {
  id: string; name: string; title: string; company: string | null; function_codes: string[];
  competency_expertise: string[]; seniority_level: number; mentoring_style: string;
  availability_hrs_month: number; cost_model: string; cost_per_hour_inr: number;
  rating: number; is_verified: boolean; match_score: number;
}

export interface ResourceMapOpts {
  region?: 'IN' | 'GLOBAL';
  maxCostInr?: number;
  type?: string;
  difficulty?: number;
  industry?: string;
  style?: string;
  function?: string;
  availability?: number;
}

// 30-minute in-memory catalog cache
let _courseCache: { data: LIPCourse[]; ts: number } | null = null;
let _certCache: { data: LIPCert[]; ts: number } | null = null;
let _projectCache: { data: LIPProject[]; ts: number } | null = null;
let _mentorCache: { data: LIPMentor[]; ts: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

function jparse<T>(v: unknown, fallback: T): T {
  if (Array.isArray(v)) return v as unknown as T;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } }
  return fallback;
}

// ── Course mapper ─────────────────────────────────────────────────────────────
export async function mapCourses(
  userId: string,
  gaps: LIPGap[],
  opts: ResourceMapOpts,
  pool: Pool,
): Promise<LIPCourse[]> {
  try {
    let catalog: LIPCourse[] = [];
    if (_courseCache && Date.now() - _courseCache.ts < CACHE_MS) {
      catalog = _courseCache.data;
    } else {
      const res = await pool.query<Record<string, unknown>>(
        `SELECT c.*, COALESCE(json_agg(DISTINCT jsonb_build_object('code',m.competency_code,'cov',m.coverage_score)) FILTER (WHERE m.id IS NOT NULL), '[]') AS comp_map
         FROM lip_courses c
         LEFT JOIN lip_course_competency_map m ON m.course_id = c.id
         WHERE c.is_active = true
         GROUP BY c.id`,
      );
      catalog = res.rows.map(r => ({
        id: r.id as string,
        title: r.title as string,
        provider: r.provider as string,
        type: r.type as string,
        delivery_mode: r.delivery_mode as string,
        duration_hours: Number(r.duration_hours),
        difficulty_level: Number(r.difficulty_level),
        cost_usd: Number(r.cost_usd),
        cost_inr: Number(r.cost_inr),
        quality_score: Number(r.quality_score),
        rating: Number(r.rating),
        skills_covered: jparse(r.skills_covered, [] as string[]),
        competency_codes: jparse(r.competency_codes, [] as string[]),
        region: r.region as string,
        url: r.url as string | null,
        relevance_score: 50,
      }));
      _courseCache = { data: catalog, ts: Date.now() };
    }

    // Get completed courses
    const completedIds = new Set<string>();
    try {
      const doneRes = await pool.query<{ course_id: string }>(
        `SELECT course_id::text FROM lip_user_courses WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      doneRes.rows.forEach(r => completedIds.add(r.course_id));
    } catch { /* ignore */ }

    const gapCodes = new Set(gaps.map(g => g.competency_code));
    const gapMap = new Map(gaps.map(g => [g.competency_code, g]));

    const scored = catalog
      .filter(c => !completedIds.has(c.id))
      .filter(c => !opts.region || c.region === opts.region || c.region === 'GLOBAL')
      .filter(c => !opts.type || c.type === opts.type)
      .filter(c => !opts.maxCostInr || Number(c.cost_inr) <= opts.maxCostInr)
      .map(course => {
        let compCoverage = 50;
        const covered = course.competency_codes.filter(code => gapCodes.has(code));
        if (covered.length > 0) {
          const avgPriority = covered.reduce((s, code) => s + (gapMap.get(code)?.gap_magnitude ?? 20), 0) / covered.length;
          compCoverage = Math.min(99, 50 + avgPriority);
        }
        const regionBonus = (!opts.region || course.region === opts.region) ? 100 : 70;
        const relevance = Math.round(
          compCoverage * 0.5 + course.quality_score * 0.3 + regionBonus * 0.2,
        );
        return { ...course, relevance_score: Math.min(99, relevance) };
      });

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const top20 = scored.slice(0, 20);

    // Upsert
    try {
      for (const c of top20) {
        await pool.query(
          `INSERT INTO lip_user_courses (user_id,course_id,relevance_score,computed_at)
           VALUES ($1,$2,$3,NOW())
           ON CONFLICT (user_id,course_id) DO UPDATE SET relevance_score=EXCLUDED.relevance_score, computed_at=NOW()`,
          [userId, c.id, c.relevance_score],
        );
      }
    } catch { /* best-effort */ }

    return top20;
  } catch { return []; }
}

// ── Cert mapper ───────────────────────────────────────────────────────────────
export async function mapCertifications(
  userId: string,
  gaps: LIPGap[],
  opts: ResourceMapOpts,
  pool: Pool,
): Promise<LIPCert[]> {
  try {
    let catalog: LIPCert[] = [];
    if (_certCache && Date.now() - _certCache.ts < CACHE_MS) {
      catalog = _certCache.data;
    } else {
      const res = await pool.query<Record<string, unknown>>(`SELECT * FROM lip_certifications WHERE is_active=true`);
      catalog = res.rows.map(r => ({
        id: r.id as string, title: r.title as string, issuing_body: r.issuing_body as string,
        type: r.type as string, validity_years: r.validity_years != null ? Number(r.validity_years) : null,
        prep_hours_estimate: Number(r.prep_hours_estimate), cost_usd: Number(r.cost_usd),
        cost_inr: Number(r.cost_inr), difficulty_level: Number(r.difficulty_level),
        prestige_score: Number(r.prestige_score), skills_validated: jparse(r.skills_validated, [] as string[]),
        competency_codes: jparse(r.competency_codes, [] as string[]),
        industry_codes: jparse(r.industry_codes, [] as string[]), relevance_score: 50,
      }));
      _certCache = { data: catalog, ts: Date.now() };
    }

    const completedIds = new Set<string>();
    try {
      const doneRes = await pool.query<{ cert_id: string }>(
        `SELECT cert_id::text FROM lip_user_certifications WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      doneRes.rows.forEach(r => completedIds.add(r.cert_id));
    } catch { /* ignore */ }

    const gapCodes = new Set(gaps.map(g => g.competency_code));
    const gapMap = new Map(gaps.map(g => [g.competency_code, g]));

    const scored = catalog
      .filter(c => !completedIds.has(c.id))
      .filter(c => !opts.type || c.type === opts.type)
      .filter(c => !opts.maxCostInr || c.cost_inr <= opts.maxCostInr)
      .filter(c => !opts.industry || c.industry_codes.includes(opts.industry))
      .map(cert => {
        const covered = cert.competency_codes.filter(code => gapCodes.has(code));
        const gapCoverage = covered.length > 0
          ? Math.min(99, 50 + covered.reduce((s, code) => s + (gapMap.get(code)?.gap_magnitude ?? 20), 0) / covered.length)
          : 30;
        const costViability = cert.cost_inr < 5000 ? 100 : cert.cost_inr < 20000 ? 70 : 40;
        const relevance = Math.round(cert.prestige_score * 0.4 + gapCoverage * 0.4 + costViability * 0.2);
        return { ...cert, relevance_score: Math.min(99, relevance) };
      });

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const top20 = scored.slice(0, 20);

    try {
      for (const c of top20) {
        await pool.query(
          `INSERT INTO lip_user_certifications (user_id,cert_id,relevance_score,computed_at)
           VALUES ($1,$2,$3,NOW())
           ON CONFLICT (user_id,cert_id) DO UPDATE SET relevance_score=EXCLUDED.relevance_score, computed_at=NOW()`,
          [userId, c.id, c.relevance_score],
        );
      }
    } catch { /* best-effort */ }

    return top20;
  } catch { return []; }
}

// ── Project mapper ────────────────────────────────────────────────────────────
export async function mapProjects(
  userId: string,
  gaps: LIPGap[],
  opts: ResourceMapOpts,
  pool: Pool,
): Promise<LIPProject[]> {
  try {
    let catalog: LIPProject[] = [];
    if (_projectCache && Date.now() - _projectCache.ts < CACHE_MS) {
      catalog = _projectCache.data;
    } else {
      const res = await pool.query<Record<string, unknown>>(`SELECT * FROM lip_projects WHERE is_active=true`);
      catalog = res.rows.map(r => ({
        id: r.id as string, title: r.title as string, type: r.type as string,
        duration_hours: Number(r.duration_hours), difficulty_level: Number(r.difficulty_level),
        skills_practiced: jparse(r.skills_practiced, [] as string[]),
        competency_codes: jparse(r.competency_codes, [] as string[]),
        deliverable: r.deliverable as string, solo_or_team: r.solo_or_team as string,
        description: r.description as string | null, relevance_score: 50,
      }));
      _projectCache = { data: catalog, ts: Date.now() };
    }

    const completedIds = new Set<string>();
    try {
      const doneRes = await pool.query<{ project_id: string }>(
        `SELECT project_id::text FROM lip_user_projects WHERE user_id=$1 AND status='completed'`,
        [userId],
      );
      doneRes.rows.forEach(r => completedIds.add(r.project_id));
    } catch { /* ignore */ }

    const gapCodes = new Set(gaps.map(g => g.competency_code));
    const gapMap = new Map(gaps.map(g => [g.competency_code, g]));

    const scored = catalog
      .filter(p => !completedIds.has(p.id))
      .filter(p => !opts.type || p.type === opts.type)
      .filter(p => !opts.difficulty || p.difficulty_level === opts.difficulty)
      .map(proj => {
        const overlap = proj.competency_codes.filter(code => gapCodes.has(code));
        const skillOverlap = overlap.length > 0
          ? Math.min(99, 50 + overlap.reduce((s, code) => s + (gapMap.get(code)?.gap_magnitude ?? 20), 0) / overlap.length)
          : 30;
        // Difficulty fit: match is best when user's worst gap is critical (harder projects)
        const critCount = gaps.filter(g => g.gap_severity === 'critical').length;
        const idealDiff = critCount >= 3 ? 3 : critCount >= 1 ? 2 : 1;
        const diffFit = Math.max(0, 100 - Math.abs(proj.difficulty_level - idealDiff) * 25);
        const relevance = Math.round(skillOverlap * 0.6 + diffFit * 0.4);
        return { ...proj, relevance_score: Math.min(99, relevance) };
      });

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const top20 = scored.slice(0, 20);

    try {
      for (const p of top20) {
        await pool.query(
          `INSERT INTO lip_user_projects (user_id,project_id,relevance_score,computed_at)
           VALUES ($1,$2,$3,NOW())
           ON CONFLICT (user_id,project_id) DO UPDATE SET relevance_score=EXCLUDED.relevance_score, computed_at=NOW()`,
          [userId, p.id, p.relevance_score],
        );
      }
    } catch { /* best-effort */ }

    return top20;
  } catch { return []; }
}

// ── Mentor mapper ─────────────────────────────────────────────────────────────
export async function mapMentors(
  userId: string,
  needs: LIPNeed[],
  opts: ResourceMapOpts,
  pool: Pool,
): Promise<LIPMentor[]> {
  try {
    let catalog: LIPMentor[] = [];
    if (_mentorCache && Date.now() - _mentorCache.ts < CACHE_MS) {
      catalog = _mentorCache.data;
    } else {
      const res = await pool.query<Record<string, unknown>>(`SELECT * FROM lip_mentors WHERE is_active=true`);
      catalog = res.rows.map(r => ({
        id: r.id as string, name: r.name as string, title: r.title as string,
        company: r.company as string | null, function_codes: jparse(r.function_codes, [] as string[]),
        competency_expertise: jparse(r.competency_expertise, [] as string[]),
        seniority_level: Number(r.seniority_level), mentoring_style: r.mentoring_style as string,
        availability_hrs_month: Number(r.availability_hrs_month), cost_model: r.cost_model as string,
        cost_per_hour_inr: Number(r.cost_per_hour_inr), rating: Number(r.rating),
        is_verified: Boolean(r.is_verified), match_score: 50,
      }));
      _mentorCache = { data: catalog, ts: Date.now() };
    }

    const needCategories = new Set(needs.map(n => n.need_category));

    const scored = catalog
      .filter(m => !opts.style || m.mentoring_style === opts.style)
      .filter(m => !opts.function || m.function_codes.includes(opts.function))
      .filter(m => opts.availability == null || m.availability_hrs_month >= opts.availability)
      .map(mentor => {
        const expertiseOverlap = mentor.competency_expertise.filter(code => needCategories.has(code)).length;
        const expertiseScore = Math.min(99, 40 + expertiseOverlap * 15);
        // Seniority fit: higher is better for leadership/domain needs
        const seniorityScore = Math.min(100, mentor.seniority_level * 14);
        // Availability bonus
        const avail = Math.min(100, mentor.availability_hrs_month * 12);
        const match = Math.round(expertiseScore * 0.5 + seniorityScore * 0.3 + avail * 0.2);
        return { ...mentor, match_score: Math.min(99, match) };
      });

    scored.sort((a, b) => b.match_score - a.match_score);
    const top20 = scored.slice(0, 20);

    try {
      for (const m of top20) {
        await pool.query(
          `INSERT INTO lip_user_mentors (user_id,mentor_id,match_score,computed_at)
           VALUES ($1,$2,$3,NOW())
           ON CONFLICT (user_id,mentor_id) DO UPDATE SET match_score=EXCLUDED.match_score, computed_at=NOW()`,
          [userId, m.id, m.match_score],
        );
      }
    } catch { /* best-effort */ }

    return top20;
  } catch { return []; }
}

export function invalidateCatalogCache(): void {
  _courseCache = null;
  _certCache = null;
  _projectCache = null;
  _mentorCache = null;
}
