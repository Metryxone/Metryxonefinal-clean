/**
 * Role Title Crosswalk — free-text job role title → curated Role-DNA role.
 *
 * Why this exists
 * ---------------
 * Candidate matching (talent-matching-engine `rankCandidatesForRole`) requires a
 * role that exists in `onto_role_competency_profiles` (e.g. `role_be_eng`). Real
 * employers post jobs with a FREE-TEXT role title ("Backend Engineer", "Sr.
 * Product Manager", …) — that title does not, by itself, name a curated role, so
 * a posted job cannot be matched against candidates without first bridging the
 * title to a curated role id.
 *
 * This resolver crosswalks a free-text title to the best-fit CURATED role that
 * actually carries an active competency profile (so a resolved role is matchable,
 * not an empty shell). It is the `onto_*` (curated, TEXT-id) counterpart to the
 * O*NET-backed `role-crosswalk.ts` (`ont_*`, INT-id) — those are DISJOINT
 * namespaces (see .agents/memory/onto-vs-ont-namespace-bridge.md); the matching
 * engine reads `onto_role_competency_profiles`, so the crosswalk MUST resolve to
 * `onto_roles.id`, never to `ont_roles`.
 *
 * Honesty contract (do not break):
 *   - NEVER fabricates a match. No good crosswalk → `resolved: null` (ABSTAIN),
 *     never a fallback role.
 *   - Coverage (does the resolved role carry a real, weight-bearing profile —
 *     `competency_count` / `weight_total`) and Confidence (how trustworthy the
 *     TITLE resolution is) are SEPARATE axes, never composited.
 *   - Anything other than an exact-title hit is flagged `estimated: true` so the
 *     caller can surface it as an Estimated crosswalk, not an authoritative one.
 *   - Read-only: a `to_regclass` probe gates the read; absent substrate → abstain.
 *     No DDL, no writes.
 */
import type { Pool } from 'pg';
import { roleCompetencyProfileTablesReady } from './role-competency-profile';

export type TitleMatchType = 'exact_title' | 'alias' | 'partial_title';
export type ConfidenceLabel = 'high' | 'medium' | 'low';

export interface RoleTitleMatch {
  /** onto_roles.id — the curated role (e.g. 'role_be_eng'). */
  role_id: string;
  role_title: string;
  seniority: string | null;
  /** How the input title resolved to this role. */
  match_type: TitleMatchType;
  /** Title-resolution confidence (0..100). SEPARATE from profile coverage. */
  confidence_pct: number;
  confidence_label: ConfidenceLabel;
  /** True for anything but an exact title hit — surface as "Estimated". */
  estimated: boolean;
  /** Coverage signal (SEPARATE axis): active competencies on the role profile. */
  competency_count: number;
  /** Coverage signal: summed profile weight (un-normalised). */
  weight_total: number;
}

export interface RoleTitleResolution {
  input: string;
  /** null ⇒ abstain — no defensible crosswalk found (never fabricated). */
  resolved: RoleTitleMatch | null;
  /** Next-best curated roles, for transparency / operator override. */
  alternatives: RoleTitleMatch[];
  /** How many matchable curated roles were considered. */
  candidates_considered: number;
  note: string;
}

// Generic role-suffix tokens that carry no DISTINCTIVE meaning on their own — a
// shared "engineer"/"manager" alone must never trigger a crosswalk (else
// "Product Manager" would match "Project Manager").
const GENERIC_ROLE_TOKENS = new Set([
  'engineer', 'developer', 'manager', 'analyst', 'specialist', 'lead', 'leader',
  'senior', 'junior', 'staff', 'principal', 'associate', 'officer', 'executive',
  'head', 'director', 'consultant', 'coordinator', 'administrator', 'intern',
  'i', 'ii', 'iii', 'iv', 'and', 'the', 'of', 'for', 'a', 'an',
]);

// Per-token abbreviation expansion (applied during normalisation).
const ABBREV_TOKEN: Record<string, string> = {
  sr: 'senior', snr: 'senior', jr: 'junior', jnr: 'junior',
  eng: 'engineer', engr: 'engineer', dev: 'developer', devel: 'developer',
  mgr: 'manager', mgmt: 'management', ops: 'operations', admin: 'administrator',
  qa: 'quality', ux: 'experience', ui: 'interface',
};

// Whole-title aliases (normalised input → normalised canonical role title to
// try as an exact-equivalent). Deliberately small + defensible; token overlap
// covers the long tail. Each entry is a vocabulary bridge, not a fabrication.
const FULL_TITLE_ALIASES: Record<string, string> = {
  'software engineer': 'software engineer',
  swe: 'software engineer',
  sde: 'software engineer',
  'backend developer': 'backend engineer',
  'back end engineer': 'backend engineer',
  'back end developer': 'backend engineer',
  'server engineer': 'backend engineer',
  'server side engineer': 'backend engineer',
  'frontend developer': 'frontend engineer',
  'front end engineer': 'frontend engineer',
  'product owner': 'product manager',
  pm: 'product manager',
  'program manager': 'product manager',
};

/** Lowercase, strip diacritics/punctuation, collapse whitespace. */
export function normalizeTitle(s: string): string {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenise a normalised title, expanding per-token abbreviations. */
function tokenize(norm: string): string[] {
  return norm
    .split(' ')
    .map((t) => ABBREV_TOKEN[t] ?? t)
    .filter(Boolean);
}

/**
 * Canonical form = normalised + per-token abbreviation-expanded, re-joined. Used
 * for the exact-equivalence check so "Sr. Backend Engineer" canonicalises to
 * "senior backend engineer" and matches the curated "Senior Backend Engineer"
 * role exactly (seniority is preserved here — it is only treated as a generic,
 * non-distinctive token for the looser PARTIAL overlap scoring).
 */
function canonicalForm(s: string): string {
  return tokenize(normalizeTitle(s)).join(' ');
}

/** Distinctive (non-generic, length ≥ 3) tokens — the meaning-bearing ones. */
function distinctiveTokens(tokens: string[]): Set<string> {
  return new Set(tokens.filter((t) => t.length >= 3 && !GENERIC_ROLE_TOKENS.has(t)));
}

function labelFor(confidence: number): ConfidenceLabel {
  if (confidence >= 85) return 'high';
  if (confidence >= 60) return 'medium';
  return 'low';
}

interface MatchableRoleRow {
  id: string;
  title: string;
  seniority: string | null;
  competency_count: number;
  weight_total: number;
}

/**
 * The curated roles that actually carry an active, weight-bearing competency
 * profile — only these are matchable (a resolved role must be usable, never an
 * empty shell). Read-only; degrades to [] when the substrate is absent.
 */
export async function getMatchableCuratedRoles(pool: Pool): Promise<MatchableRoleRow[]> {
  if (!(await roleCompetencyProfileTablesReady(pool))) return [];
  try {
    const { rows } = await pool.query(`
      SELECT r.id,
             r.title,
             r.seniority,
             COUNT(rcp.id) FILTER (WHERE rcp.active)::int                AS competency_count,
             COALESCE(SUM(rcp.weight) FILTER (WHERE rcp.active), 0)::float AS weight_total
        FROM onto_roles r
        JOIN onto_role_competency_profiles rcp ON rcp.role_id = r.id
       WHERE r.deprecated = false
       GROUP BY r.id, r.title, r.seniority
      HAVING COUNT(rcp.id) FILTER (WHERE rcp.active) > 0
    `);
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      seniority: r.seniority ?? null,
      competency_count: Number(r.competency_count) || 0,
      weight_total: Math.round((Number(r.weight_total) || 0) * 100) / 100,
    }));
  } catch {
    return [];
  }
}

interface Scored {
  row: MatchableRoleRow;
  match_type: TitleMatchType;
  confidence: number;
}

/**
 * Score one curated role against a normalised input title. Returns null when the
 * role is not a defensible match (no shared DISTINCTIVE meaning → abstain for it).
 */
function scoreRole(
  inputNorm: string,
  inputCanon: string,
  inputDistinct: Set<string>,
  aliasCanon: string | null,
  row: MatchableRoleRow,
): Scored | null {
  const roleNorm = normalizeTitle(row.title);
  const roleCanon = canonicalForm(row.title);
  const roleDistinct = distinctiveTokens(tokenize(roleNorm));

  // 1. Exact title (canonical, abbreviation-expanded so "Sr." == "Senior").
  if (roleCanon === inputCanon) return { row, match_type: 'exact_title', confidence: 92 };

  // 2. Whole-title alias bridge → treat as an exact-equivalent (slightly lower).
  if (aliasCanon && roleCanon === aliasCanon) return { row, match_type: 'alias', confidence: 82 };

  // 3. Partial — must share at least one DISTINCTIVE token (generic-only overlap
  //    like a shared "manager" is NOT a match) OR be a clear substring.
  const shared = [...inputDistinct].filter((t) => roleDistinct.has(t));
  if (shared.length > 0) {
    const union = new Set([...inputDistinct, ...roleDistinct]);
    const jaccard = union.size > 0 ? shared.length / union.size : 0;
    const roleCoverage = roleDistinct.size > 0 ? shared.length / roleDistinct.size : 0;
    // 50..72: scaled by overlap of distinctive meaning, blending Jaccard and how
    // completely the role's distinctive tokens are covered by the input.
    const confidence = Math.round(50 + Math.max(jaccard, roleCoverage) * 22);
    return { row, match_type: 'partial_title', confidence };
  }

  // 4. Substring containment of the full normalised titles (≥ 5 chars).
  if (inputNorm.length >= 5 && (roleNorm.includes(inputNorm) || inputNorm.includes(roleNorm))) {
    return { row, match_type: 'partial_title', confidence: 55 };
  }

  return null;
}

const TYPE_RANK: Record<TitleMatchType, number> = { exact_title: 0, alias: 1, partial_title: 2 };

function toMatch(s: Scored): RoleTitleMatch {
  return {
    role_id: s.row.id,
    role_title: s.row.title,
    seniority: s.row.seniority,
    match_type: s.match_type,
    confidence_pct: s.confidence,
    confidence_label: labelFor(s.confidence),
    estimated: s.match_type !== 'exact_title',
    competency_count: s.row.competency_count,
    weight_total: s.row.weight_total,
  };
}

/**
 * Crosswalk a free-text role title to the best-fit CURATED role that carries an
 * active competency profile. Returns the resolved match (or null = abstain) plus
 * ranked alternatives for transparency. Never fabricates a match.
 */
export async function resolveCuratedRoleByTitle(
  pool: Pool,
  title: string,
): Promise<RoleTitleResolution> {
  const input = (title ?? '').toString().trim();
  const inputNorm = normalizeTitle(input);

  if (!inputNorm) {
    return { input, resolved: null, alternatives: [], candidates_considered: 0, note: 'empty role title — nothing to crosswalk.' };
  }

  const roles = await getMatchableCuratedRoles(pool);
  if (roles.length === 0) {
    return {
      input,
      resolved: null,
      alternatives: [],
      candidates_considered: 0,
      note: 'no curated roles carry a competency profile yet — cannot crosswalk (no fabrication).',
    };
  }

  const inputCanon = canonicalForm(input);
  const inputDistinct = distinctiveTokens(tokenize(inputNorm));
  const aliasCanon = FULL_TITLE_ALIASES[inputNorm] ? canonicalForm(FULL_TITLE_ALIASES[inputNorm]) : null;

  const scored: Scored[] = [];
  for (const row of roles) {
    const s = scoreRole(inputNorm, inputCanon, inputDistinct, aliasCanon, row);
    if (s) scored.push(s);
  }

  scored.sort((a, b) => {
    const dr = TYPE_RANK[a.match_type] - TYPE_RANK[b.match_type];
    if (dr !== 0) return dr;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    // Tie-break: prefer the richer (more competencies) profile, then shorter title.
    if (b.row.competency_count !== a.row.competency_count) return b.row.competency_count - a.row.competency_count;
    return a.row.title.length - b.row.title.length;
  });

  if (scored.length === 0) {
    return {
      input,
      resolved: null,
      alternatives: [],
      candidates_considered: roles.length,
      note: `no curated role shares enough with "${input}" to crosswalk — abstaining (not fabricated). Set the role explicitly or extend the curated role library.`,
    };
  }

  const best = toMatch(scored[0]);
  const alternatives = scored.slice(1, 4).map(toMatch);
  const via =
    best.match_type === 'exact_title'
      ? 'exact title match'
      : best.match_type === 'alias'
        ? 'a known title synonym (Estimated)'
        : 'partial title overlap (Estimated)';
  const note =
    `Crosswalked "${input}" → ${best.role_title} (${best.role_id}) via ${via} at ${best.confidence_pct}% confidence. ` +
    `Confidence (title resolution) and Coverage (the role's ${best.competency_count} profiled competencies) are separate axes.`;

  return { input, resolved: best, alternatives, candidates_considered: roles.length, note };
}
