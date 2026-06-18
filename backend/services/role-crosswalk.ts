/**
 * Role crosswalk — maps app-facing role labels / job titles / legacy ids to
 * the canonical ontology role library (`ont_roles.code`).
 *
 * Why this exists
 * ---------------
 * The O*NET importer (services/onet-import.ts) and the curated starter seed
 * (services/ontology-seed.ts) populate `ont_roles` / `ont_competencies` /
 * `map_role_competency` with a large, recognised role→competency library
 * (1016 O*NET occupations + ~24 curated starter roles). But the user-facing
 * flows key off their OWN role identifiers:
 *   - free-text labels stored on the profile (`cra_profiles.target_role_label`,
 *     e.g. "Software Engineer", "Registered Nurse")
 *   - legacy catalog ids (career-intelligence ROLE_CATALOG: 'swe', 'ml-eng', …)
 *   - ontology codes already (ROLE_*, ONET_*)
 *
 * Without a crosswalk, the extra roles sit in the tables unused. This resolver
 * bridges any of those identifiers to an `ont_roles.code`, and exposes the
 * competencies that role requires straight from the shared library.
 *
 * Code namespaces (disjoint, both queryable):
 *   - O*NET occupations  → `ONET_<soc>`   (source 'onet')
 *   - curated starter    → `ROLE_*`        (source 'seeded')
 *
 * Honest by construction: never fabricates a match. If nothing resolves it
 * returns an empty candidate list; if a role has no competency links it returns
 * an empty competency list (the O*NET coverage gap — 137 aggregate occupations
 * carry no ratings — is reported truthfully, not papered over).
 */
import type { Pool } from 'pg';

export type RoleMatchType = 'code' | 'alias' | 'exact_title' | 'partial_title';

export interface RoleMatch {
  /** ont_roles.code — 'ONET_<soc>' or 'ROLE_*'. */
  code: string;
  /** ont_roles.id. */
  id: number;
  /** ont_roles.title. */
  title: string;
  /** How the input resolved to this role. */
  matchType: RoleMatchType;
  /** Library this role came from, derived from the code prefix. */
  source: 'onet' | 'seeded' | 'other';
  /** Number of active map_role_competency links this role carries. */
  competencyCount: number;
}

export interface RoleCompetency {
  code: string;
  name: string;
  category: string | null;
  competencyType: string | null;
  importanceTier: string;
  weight: number;
  minProficiency: string | null;
  targetProficiency: string | null;
  /** map_role_competency.source — 'onet' or 'seeded'. */
  source: string;
}

/** Lowercase, strip punctuation/diacritics, collapse whitespace. */
function normalize(s: string): string {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Legacy career-intelligence catalog ids (and a few common shorthands) →
 * canonical human title. Resolved through normal title matching so we don't
 * have to hardcode (and risk drifting from) O*NET SOC codes.
 */
const LEGACY_ID_TITLES: Record<string, string> = {
  swe: 'Software Engineer',
  'ml-eng': 'Machine Learning Engineer',
  'ai-eng': 'AI Engineer',
  'cloud-arch': 'Cloud Architect',
  cybersec: 'Cybersecurity Engineer',
  devops: 'DevOps Engineer',
  ds: 'Data Scientist',
  da: 'Data Analyst',
  de: 'Data Engineer',
  pm: 'Product Manager',
  ux: 'UX Designer',
  'eng-mgr': 'Engineering Manager',
  'platform-eng': 'Platform Engineer',
};

/**
 * Title synonyms that bridge app vocabulary to O*NET occupation naming
 * (keyed + valued in normalized form). Each entry adds extra title candidates
 * to try; the resolver still prefers an exact app-title match first.
 */
const TITLE_SYNONYMS: Record<string, string[]> = {
  'software engineer': ['software developers', 'software developer'],
  'machine learning engineer': ['data scientists', 'data scientist'],
  'ml engineer': ['data scientists', 'machine learning engineer'],
  'ai engineer': ['data scientists'],
  'data scientist': ['data scientists'],
  'data analyst': ['data scientists'],
  'data engineer': ['database architects', 'data scientists'],
  'product manager': ['project management specialists'],
  'ux designer': ['web and digital interface designers'],
  'devops engineer': ['software developers'],
  'cloud architect': ['computer network architects'],
  'cybersecurity engineer': ['information security analysts'],
  'engineering manager': ['computer and information systems managers'],
  accountant: ['accountants and auditors'],
  nurse: ['registered nurses'],
  'registered nurse': ['registered nurses'],
  teacher: ['secondary school teachers, except special and career/technical education'],
};

function sourceFromCode(code: string): RoleMatch['source'] {
  if (code.startsWith('ONET_')) return 'onet';
  if (code.startsWith('ROLE_')) return 'seeded';
  return 'other';
}

interface RoleRow {
  id: number;
  code: string;
  title: string;
  cc: number;
}

/**
 * Resolve a free-text role label / legacy id / ontology code to ranked
 * `ont_roles` candidates. Highest-confidence match first; among equal-rank
 * matches the one with the most competency links wins (so a resolved role is
 * useful, not an empty shell).
 */
export async function resolveOntRole(pool: Pool, input: string): Promise<RoleMatch[]> {
  const raw = (input ?? '').toString().trim();
  if (!raw) return [];

  const norm = normalize(raw);
  const codeCandidates = new Set<string>();
  const titleCandidates = new Set<string>();

  // Direct ontology code.
  if (/^(onet_|role_)/i.test(raw)) codeCandidates.add(raw.toUpperCase());

  // Legacy catalog id → canonical title.
  const legacy = LEGACY_ID_TITLES[raw.toLowerCase()] ?? LEGACY_ID_TITLES[norm];
  if (legacy) titleCandidates.add(normalize(legacy));

  // The input itself, plus any synonyms.
  titleCandidates.add(norm);
  for (const t of titleCandidates) {
    for (const syn of TITLE_SYNONYMS[t] ?? []) titleCandidates.add(normalize(syn));
  }

  // Load the whole role library (≈1k rows) with competency-link counts and
  // match in-process — avoids fragile in-SQL title normalization.
  const { rows } = await pool.query<RoleRow>(`
    SELECT r.id, r.code, r.title,
           COUNT(m.id) FILTER (WHERE m.is_active = true)::int AS cc
      FROM ont_roles r
      LEFT JOIN map_role_competency m ON m.role_id = r.id
     WHERE r.is_active = true
     GROUP BY r.id, r.code, r.title
  `);

  const matches: RoleMatch[] = [];
  for (const r of rows) {
    const codeUpper = (r.code ?? '').toUpperCase();
    const normTitle = normalize(r.title ?? '');
    let matchType: RoleMatchType | null = null;

    if (codeCandidates.has(codeUpper)) {
      // Only directly-typed ontology codes are ever added to codeCandidates.
      matchType = 'code';
    } else if (titleCandidates.has(normTitle)) {
      // Exact title — distinguish the user's own label from a synonym bridge.
      matchType = normTitle === norm || normTitle === normalize(legacy ?? '') ? 'exact_title' : 'alias';
    } else {
      // Partial: a candidate is contained in the title or vice-versa.
      for (const t of titleCandidates) {
        if (t.length >= 4 && (normTitle.includes(t) || t.includes(normTitle))) {
          matchType = 'partial_title';
          break;
        }
      }
    }

    if (matchType) {
      matches.push({
        code: r.code,
        id: r.id,
        title: r.title,
        matchType,
        source: sourceFromCode(r.code),
        competencyCount: Number(r.cc) || 0,
      });
    }
  }

  const rankOf = (t: RoleMatchType): number =>
    t === 'code' ? 0 : t === 'exact_title' ? 1 : t === 'alias' ? 2 : 3;

  matches.sort((a, b) => {
    const dr = rankOf(a.matchType) - rankOf(b.matchType);
    if (dr !== 0) return dr;
    // Prefer roles that actually carry competencies, then shorter titles.
    if (b.competencyCount !== a.competencyCount) return b.competencyCount - a.competencyCount;
    return a.title.length - b.title.length;
  });

  return matches;
}

/**
 * Best single match for a role identifier, biased toward a role that actually
 * carries competencies (so downstream consumers get a usable library hit).
 * Returns null when nothing resolves.
 */
export async function resolveBestOntRole(pool: Pool, input: string): Promise<RoleMatch | null> {
  const all = await resolveOntRole(pool, input);
  if (all.length === 0) return null;
  // Within the top rank tier, prefer the first with competencies.
  const topRank = all[0].matchType;
  const topTier = all.filter(m => m.matchType === topRank);
  const withComp = topTier.find(m => m.competencyCount > 0);
  return withComp ?? all[0];
}

/**
 * Required competencies for a resolved role, pulled straight from the shared
 * ontology library (`map_role_competency` ⋈ `ont_competencies`). Core tier and
 * higher weight first. Empty list is an honest answer (role has no ratings).
 */
export async function getRoleCompetencies(pool: Pool, roleCode: string): Promise<RoleCompetency[]> {
  const { rows } = await pool.query(`
    SELECT c.code, c.name, c.category, c.competency_type,
           m.importance_tier, m.weight, m.min_proficiency, m.target_proficiency, m.source
      FROM map_role_competency m
      JOIN ont_roles r        ON r.id = m.role_id
      JOIN ont_competencies c ON c.id = m.competency_id
     WHERE r.code = $1
       AND m.is_active = true
       AND c.is_active = true
     ORDER BY (m.importance_tier = 'core') DESC, m.weight DESC NULLS LAST, c.name ASC
  `, [roleCode]);

  return rows.map((r: any) => ({
    code: r.code,
    name: r.name,
    category: r.category ?? null,
    competencyType: r.competency_type ?? null,
    importanceTier: r.importance_tier ?? 'secondary',
    weight: r.weight != null ? Number(r.weight) : 1,
    minProficiency: r.min_proficiency ?? null,
    targetProficiency: r.target_proficiency ?? null,
    source: r.source ?? 'seeded',
  }));
}
