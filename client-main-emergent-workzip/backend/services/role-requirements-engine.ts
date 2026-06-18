/**
 * Phase 6 — Role Requirements Engine
 *
 * Diffs a user's profile snapshot against a target role's full requirement set
 * across 6 dimensions: technical skills, certifications, education, functional
 * skills, tools, domain expertise.
 *
 * Pure helpers + DB read functions. No writes. Read-only against rr_* tables.
 * Returns evidence-backed, ROI-ranked recommendations. Language policy
 * preserved (developmental only).
 */

import type { Pool } from 'pg';

export const ROLE_REQUIREMENTS_VERSION = '6.0.0';

// ---- profile shape (subset used by engine) ---------------------------------

export interface ProfileSnapshot {
  skills?: {
    technical?: Array<string | { name: string }>;
    functional?: Array<string | { name: string }>;
    tools?: Array<string | { name: string }>;
    soft?: Array<string | { name: string }>;
  };
  certifications?: Array<string | { name?: string; title?: string; provider?: string }>;
  education?: Array<{ degree?: string; field?: string; institution?: string }>;
  experience?: Array<{ title?: string; company?: string; domain?: string; industry?: string; years?: number }>;
  domains?: string[];
}

export type Dimension =
  | 'technical_skill'
  | 'certification'
  | 'education'
  | 'functional_skill'
  | 'tool'
  | 'domain_expertise';

export interface RequirementGap {
  dimension: Dimension;
  item_name: string;
  item_meta?: Record<string, string | number | null>;
  importance: 'critical' | 'required' | 'preferred' | 'nice_to_have';
  ei_impact: number;
  effort_hours: number;
  weight: number;
  evidence_hint?: string | null;
  rationale: string;
}

// ---- DB readers -------------------------------------------------------------

interface TechRow { skill_name: string; category: string; required_level: string; weight: string; ei_impact: string; effort_hours: string; evidence_hint: string | null; }
interface CertRow { cert_name: string; provider: string; importance: string; ei_impact: string; effort_hours: string; validity_months: number | null; }
interface EduRow  { min_degree: string; preferred_fields: string[]; importance: string; ei_impact: string; }
interface FuncRow { functional_area: string; depth: string; weight: string; ei_impact: string; effort_hours: string; evidence_hint: string | null; }
interface ToolRow { tool_name: string; category: string; importance: string; ei_impact: string; effort_hours: string; }
interface DomRow  { domain: string; years_typical: string; importance: string; ei_impact: string; effort_hours: string; }

async function readTech(pool: Pool, roleId: string): Promise<TechRow[]> {
  const { rows } = await pool.query<TechRow>(
    `SELECT skill_name, category, required_level,
            weight::text, ei_impact::text, effort_hours::text, evidence_hint
       FROM rr_technical_skills WHERE role_id = $1
      ORDER BY CASE required_level
                 WHEN 'critical' THEN 1 WHEN 'required' THEN 2
                 WHEN 'preferred' THEN 3 ELSE 4 END,
               weight DESC NULLS LAST`, [roleId]);
  return rows;
}
async function readCerts(pool: Pool, roleId: string): Promise<CertRow[]> {
  const { rows } = await pool.query<CertRow>(
    `SELECT cert_name, provider, importance, ei_impact::text, effort_hours::text, validity_months
       FROM rr_certifications WHERE role_id = $1
      ORDER BY CASE importance WHEN 'critical' THEN 1 WHEN 'preferred' THEN 2 ELSE 3 END`, [roleId]);
  return rows;
}
async function readEdu(pool: Pool, roleId: string): Promise<EduRow | null> {
  const { rows } = await pool.query<EduRow>(
    `SELECT min_degree, preferred_fields, importance, ei_impact::text
       FROM rr_education WHERE role_id = $1 LIMIT 1`, [roleId]);
  return rows[0] ?? null;
}
async function readFunc(pool: Pool, roleId: string): Promise<FuncRow[]> {
  const { rows } = await pool.query<FuncRow>(
    `SELECT functional_area, depth, weight::text, ei_impact::text, effort_hours::text, evidence_hint
       FROM rr_functional_skills WHERE role_id = $1 ORDER BY weight DESC NULLS LAST`, [roleId]);
  return rows;
}
async function readTools(pool: Pool, roleId: string): Promise<ToolRow[]> {
  const { rows } = await pool.query<ToolRow>(
    `SELECT tool_name, category, importance, ei_impact::text, effort_hours::text
       FROM rr_tools WHERE role_id = $1
      ORDER BY CASE importance
                 WHEN 'critical' THEN 1 WHEN 'required' THEN 2
                 WHEN 'preferred' THEN 3 ELSE 4 END`, [roleId]);
  return rows;
}
async function readDomain(pool: Pool, roleId: string): Promise<DomRow[]> {
  const { rows } = await pool.query<DomRow>(
    `SELECT domain, years_typical::text, importance, ei_impact::text, effort_hours::text
       FROM rr_domain_expertise WHERE role_id = $1
      ORDER BY CASE importance WHEN 'critical' THEN 1 WHEN 'preferred' THEN 2 ELSE 3 END`, [roleId]);
  return rows;
}

// ---- normalisation helpers -------------------------------------------------

const DEGREE_RANK: Record<string, number> = { none: 0, diploma: 1, bachelors: 2, masters: 3, phd: 4 };

function stringSet(items: Array<string | { name?: string; title?: string }> | undefined): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(items)) return out;
  for (const it of items) {
    const raw = typeof it === 'string' ? it : (it?.name ?? it?.title ?? '');
    const v = String(raw || '').trim().toLowerCase();
    if (v) out.add(v);
  }
  return out;
}

const STOPWORDS = new Set(['the','and','for','with','of','a','an','to','in','on','or','&','/','-','+']);
const SYNONYMS: Record<string, string[]> = {
  'postgresql': ['postgres','psql'],
  'kubernetes': ['k8s'],
  'javascript': ['js','ecmascript'],
  'typescript': ['ts'],
  'github actions': ['gh actions','ghactions'],
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp','google cloud'],
  'continuous integration': ['ci','ci/cd','cicd'],
  'continuous delivery': ['cd','ci/cd','cicd'],
  'unit testing': ['unit tests','junit','pytest','jest'],
  'rest api design': ['rest','restful api','rest api'],
};

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  const raw = s.toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ');
  for (const part of raw.split(/[\s/]+/)) {
    const p = part.trim().replace(/[-.]+$/, '');
    if (!p || p.length < 3 || STOPWORDS.has(p)) continue;
    out.add(p);
  }
  // include the full normalized phrase (collapsed whitespace) for exact-phrase hits
  const phrase = s.toLowerCase().trim().replace(/\s+/g, ' ');
  if (phrase) out.add(phrase);
  return out;
}

function expandSynonyms(tokens: Set<string>): Set<string> {
  const out = new Set(tokens);
  for (const t of tokens) {
    const syn = SYNONYMS[t];
    if (syn) for (const s of syn) out.add(s);
    for (const [canon, list] of Object.entries(SYNONYMS)) {
      if (list.includes(t)) out.add(canon);
    }
  }
  return out;
}

/**
 * Tokenised fuzzy match.
 *  – exact phrase hit  → match
 *  – ≥1 multi-word required token (len ≥ 3) shared → match
 *  – single-token target → must hit exact token (no substring) to avoid
 *    "Go" matching "Golang adjacent" style false positives.
 */
function hasFuzzyMatch(target: string, profileItems: Set<string>): boolean {
  if (profileItems.size === 0) return false;
  const tTokens = expandSynonyms(tokenize(target));
  if (tTokens.size === 0) return false;
  const targetPhrase = target.toLowerCase().trim();

  // exact-phrase fast path
  for (const item of profileItems) {
    if (item === targetPhrase) return true;
  }

  // tokenize every profile item and intersect with target tokens
  for (const item of profileItems) {
    const iTokens = expandSynonyms(tokenize(item));
    for (const tok of tTokens) {
      if (tok.length < 3) continue;
      if (iTokens.has(tok)) return true;
    }
  }
  return false;
}

function userBestDegreeRank(profile: ProfileSnapshot): number {
  if (!Array.isArray(profile?.education)) return 0;
  let best = 0;
  for (const e of profile.education) {
    const d = String(e?.degree ?? '').toLowerCase();
    if (d.includes('phd') || d.includes('doctor')) best = Math.max(best, 4);
    else if (d.includes('master') || d.includes('mba') || d.includes('msc') || d.includes('m.tech')) best = Math.max(best, 3);
    else if (d.includes('bachelor') || d.includes('btech') || d.includes('b.tech') || d.includes('bsc') || d.includes('be ') || d === 'be') best = Math.max(best, 2);
    else if (d.includes('diploma')) best = Math.max(best, 1);
  }
  return best;
}

function userFieldOfStudy(profile: ProfileSnapshot): string[] {
  if (!Array.isArray(profile?.education)) return [];
  return profile.education.map(e => String(e?.field ?? '').toLowerCase()).filter(Boolean);
}

function userDomains(profile: ProfileSnapshot): Set<string> {
  const out = new Set<string>();
  for (const d of (profile?.domains ?? [])) out.add(String(d).toLowerCase());
  for (const x of (profile?.experience ?? [])) {
    if (x?.domain) out.add(String(x.domain).toLowerCase());
    if (x?.industry) out.add(String(x.industry).toLowerCase());
  }
  return out;
}

// ---- main engine ------------------------------------------------------------

export interface RequirementBundle {
  by_dimension: Record<Dimension, RequirementGap[]>;
  summary: Record<Dimension, { total: number; satisfied: number; missing: number; coverage: number }>;
  total_missing_ei: number;
  ranked_recommendations: RequirementGap[];
  version: string;
}

const EMPTY_BUNDLE: RequirementBundle = {
  by_dimension: {
    technical_skill: [], certification: [], education: [],
    functional_skill: [], tool: [], domain_expertise: [],
  },
  summary: {
    technical_skill:  { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    certification:    { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    education:        { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    functional_skill: { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    tool:             { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    domain_expertise: { total: 0, satisfied: 0, missing: 0, coverage: 1 },
  },
  total_missing_ei: 0,
  ranked_recommendations: [],
  version: ROLE_REQUIREMENTS_VERSION,
};

export async function computeRoleRequirementGaps(
  pool: Pool, roleId: string, profile: ProfileSnapshot | undefined | null
): Promise<RequirementBundle> {
  if (!roleId) return EMPTY_BUNDLE;
  const p = profile ?? {};

  const [tech, certs, edu, func, tools, domains] = await Promise.all([
    readTech(pool, roleId), readCerts(pool, roleId), readEdu(pool, roleId),
    readFunc(pool, roleId), readTools(pool, roleId), readDomain(pool, roleId),
  ]);

  const techSet  = stringSet(p?.skills?.technical);
  const funcSet  = stringSet(p?.skills?.functional);
  const toolSet  = stringSet(p?.skills?.tools);
  const certSet  = stringSet(p?.certifications);
  const userDoms = userDomains(p);
  const bestDeg  = userBestDegreeRank(p);
  const userFields = userFieldOfStudy(p);

  const gaps: RequirementGap[] = [];
  // Deep-clone summary — shallow spread shares nested counters across calls and
  // causes per-dimension totals to accumulate globally (silent multiplier bug).
  const sums: RequirementBundle['summary'] = {
    technical_skill:  { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    certification:    { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    education:        { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    functional_skill: { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    tool:             { total: 0, satisfied: 0, missing: 0, coverage: 1 },
    domain_expertise: { total: 0, satisfied: 0, missing: 0, coverage: 1 },
  };
  const byDim: RequirementBundle['by_dimension'] = {
    technical_skill: [], certification: [], education: [],
    functional_skill: [], tool: [], domain_expertise: [],
  };

  // --- technical skills ---
  for (const t of tech) {
    const have = hasFuzzyMatch(t.skill_name, techSet);
    sums.technical_skill.total++; if (have) sums.technical_skill.satisfied++;
    if (have) continue;
    const g: RequirementGap = {
      dimension: 'technical_skill',
      item_name: t.skill_name,
      item_meta: { category: t.category, required_level: t.required_level },
      importance: t.required_level as RequirementGap['importance'],
      ei_impact: Number(t.ei_impact),
      effort_hours: Number(t.effort_hours),
      weight: Number(t.weight),
      evidence_hint: t.evidence_hint,
      rationale: `Missing ${t.required_level.replace('_', ' ')} ${t.category} skill for this role.`,
    };
    gaps.push(g); byDim.technical_skill.push(g);
  }
  // --- certifications ---
  for (const c of certs) {
    const have = hasFuzzyMatch(c.cert_name, certSet);
    sums.certification.total++; if (have) sums.certification.satisfied++;
    if (have) continue;
    const g: RequirementGap = {
      dimension: 'certification',
      item_name: c.cert_name,
      item_meta: { provider: c.provider, validity_months: c.validity_months },
      importance: c.importance as RequirementGap['importance'],
      ei_impact: Number(c.ei_impact),
      effort_hours: Number(c.effort_hours),
      weight: 1,
      rationale: `${c.importance.replace('_', ' ')} certification from ${c.provider} for this role.`,
    };
    gaps.push(g); byDim.certification.push(g);
  }
  // --- education ---
  if (edu) {
    sums.education.total++;
    const required = DEGREE_RANK[edu.min_degree] ?? 0;
    const fieldOk = (edu.preferred_fields ?? []).length === 0 ||
      userFields.some(uf => (edu.preferred_fields ?? []).some(pf =>
        uf.includes(pf.toLowerCase()) || pf.toLowerCase().includes(uf)));
    const satisfied = bestDeg >= required && fieldOk;
    if (satisfied) sums.education.satisfied++;
    else {
      const degreeGap = bestDeg < required;
      const reason = degreeGap
        ? `Add a ${edu.min_degree} degree (currently ${bestDeg ? 'lower-level' : 'no degree on file'}).`
        : `Education level present but preferred field not detected — consider a bridging course or specialisation in ${(edu.preferred_fields ?? []).slice(0, 2).join(' / ') || 'a relevant field'}.`;
      const g: RequirementGap = {
        dimension: 'education',
        item_name: degreeGap
          ? `${edu.min_degree.charAt(0).toUpperCase() + edu.min_degree.slice(1)} degree`
          : `Bridging course in ${(edu.preferred_fields ?? [])[0] ?? 'preferred field'}`,
        item_meta: { preferred_fields: (edu.preferred_fields ?? []).join(', '), have_level: bestDeg },
        importance: edu.importance as RequirementGap['importance'],
        // ei_impact scales with the size of the gap — a missing degree carries
        // the full impact; a field mismatch is a smaller adjustment.
        ei_impact: degreeGap ? Number(edu.ei_impact) : Math.max(1, Number(edu.ei_impact) * 0.4),
        // Floor effort by gap type so cross-dimension ROI stays comparable:
        //   degree gap → ~2000h (a multi-year programme)
        //   field gap → ~200h (a specialisation / bridging course)
        effort_hours: degreeGap ? 2000 : 200,
        weight: 1,
        rationale: reason,
      };
      gaps.push(g); byDim.education.push(g);
    }
  }
  // --- functional skills ---
  for (const f of func) {
    const have = hasFuzzyMatch(f.functional_area, funcSet);
    sums.functional_skill.total++; if (have) sums.functional_skill.satisfied++;
    if (have) continue;
    const g: RequirementGap = {
      dimension: 'functional_skill',
      item_name: f.functional_area,
      item_meta: { depth: f.depth },
      importance: (f.depth === 'expert' ? 'critical' : f.depth === 'proficient' ? 'required' : 'preferred') as RequirementGap['importance'],
      ei_impact: Number(f.ei_impact),
      effort_hours: Number(f.effort_hours),
      weight: Number(f.weight),
      evidence_hint: f.evidence_hint,
      rationale: `${f.depth} ${f.functional_area} expected for this role.`,
    };
    gaps.push(g); byDim.functional_skill.push(g);
  }
  // --- tools ---
  for (const t of tools) {
    const have = hasFuzzyMatch(t.tool_name, toolSet);
    sums.tool.total++; if (have) sums.tool.satisfied++;
    if (have) continue;
    const g: RequirementGap = {
      dimension: 'tool',
      item_name: t.tool_name,
      item_meta: { category: t.category },
      importance: t.importance as RequirementGap['importance'],
      ei_impact: Number(t.ei_impact),
      effort_hours: Number(t.effort_hours),
      weight: 0.5,
      rationale: `${t.importance.replace('_', ' ')} tool (${t.category}) for day-to-day work.`,
    };
    gaps.push(g); byDim.tool.push(g);
  }
  // --- domain expertise ---
  for (const d of domains) {
    const have = hasFuzzyMatch(d.domain, userDoms);
    sums.domain_expertise.total++; if (have) sums.domain_expertise.satisfied++;
    if (have) continue;
    const g: RequirementGap = {
      dimension: 'domain_expertise',
      item_name: d.domain,
      item_meta: { years_typical: Number(d.years_typical) },
      importance: d.importance as RequirementGap['importance'],
      ei_impact: Number(d.ei_impact),
      effort_hours: Number(d.effort_hours),
      weight: 0.8,
      rationale: `${d.importance.replace('_', ' ')} domain exposure (≈${d.years_typical} yrs typical).`,
    };
    gaps.push(g); byDim.domain_expertise.push(g);
  }

  // coverage
  for (const k of Object.keys(sums) as Dimension[]) {
    sums[k].missing = sums[k].total - sums[k].satisfied;
    sums[k].coverage = sums[k].total === 0 ? 1 : round(sums[k].satisfied / sums[k].total, 3);
  }

  // ROI ranking: ei_impact × importance_weight / max(effort, 1)
  const IMP: Record<RequirementGap['importance'], number> = {
    critical: 1.5, required: 1.2, preferred: 1.0, nice_to_have: 0.6,
  };
  const ranked = [...gaps].sort((a, b) => {
    const ra = (a.ei_impact * IMP[a.importance] * a.weight) / Math.max(a.effort_hours, 1);
    const rb = (b.ei_impact * IMP[b.importance] * b.weight) / Math.max(b.effort_hours, 1);
    return rb - ra;
  });
  const total_missing_ei = round(gaps.reduce((s, g) => s + g.ei_impact * IMP[g.importance], 0), 1);

  return {
    by_dimension: byDim,
    summary: sums,
    total_missing_ei,
    ranked_recommendations: ranked,
    version: ROLE_REQUIREMENTS_VERSION,
  };
}

function round(n: number, dp: number): number { const m = 10 ** dp; return Math.round(n * m) / m; }

// ---- profile loader (DB → snapshot) ----------------------------------------

export async function loadProfileSnapshot(pool: Pool, userId: string): Promise<ProfileSnapshot | null> {
  if (!userId) return null;
  try {
    const { rows } = await pool.query<{ data: ProfileSnapshot }>(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}
