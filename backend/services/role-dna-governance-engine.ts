/**
 * Role DNA Governance Engine — MX-100X Phase 1 (additive, flag-gated, reversible).
 *
 * WHAT THIS IS
 * ------------
 * A NEW, isolated, read-only engine that turns the EXISTING Role-DNA data into
 * *governed intelligence*. It COMPOSES already-computed data — the `ont_roles`
 * inheritance chain (role → family → department → function) and the
 * `map_role_competency` requirement set (52k+ rows, 1,021 of 1,040 active roles
 * linked) — into, per role:
 *   - Completeness  (Coverage axis: which DNA components actually exist),
 *   - Confidence    (Confidence axis: provenance quality + competency-link density),
 *   - Quality       (internal coherence checks over the requirement set),
 *   - an explainability trace (which inheritance level / source supplied each value),
 *   - a version stamp, and
 *   - benchmark availability across levels (role / competency / department / family /
 *     function / readiness — computed from `map_role_competency` aggregates).
 *
 * HONESTY CONTRACT
 * ----------------
 * - Coverage (data exists) and Confidence (trustworthy) are reported as SEPARATE axes.
 * - There is NO role↔industry linkage anywhere in the `ont_*` chain, so the INDUSTRY
 *   benchmark level always abstains (`available:false`, reason `no_role_industry_linkage`).
 *   It is NEVER fabricated to inflate "100% coverage".
 * - A role with no competency links abstains (null scores + reason) — never a fabricated DNA.
 * - Reads use a `to_regclass` probe + degrade (never DDL on a read path). The lazy
 *   ensure-schema for the optional persistence table runs ONLY on the POST/write path.
 * - Every materialized row carries `provenance = 'mx100x_p1_governance'`, so the full
 *   effect of this phase is reversible by deleting that provenance (or dropping the table).
 *   Nothing existing is altered.
 */
import type { Pool } from 'pg';

export const ROLE_DNA_GOVERNANCE_VERSION = 'mx100x-p1-1.0.0';
export const GOVERNANCE_PROVENANCE = 'mx100x_p1_governance';

// Canonical ordinal proficiency vocabulary used by map_role_competency
// (min_proficiency / target_proficiency).
const PROFICIENCY_LEVEL: Record<string, number> = {
  novice: 1,
  developing: 2,
  proficient: 3,
  advanced: 4,
  expert: 5,
};

// Source-provenance trust weights (deterministic, explainable — never tuned to a verdict).
const SOURCE_TRUST: Record<string, number> = {
  seeded: 0.9, // curator-seeded
  curated: 0.9,
  manual: 0.85,
  onet_derived: 0.6,
  onet: 0.7,
};
const DEFAULT_SOURCE_TRUST = 0.5;

// A role is "dense enough" for full link-density confidence at this many competency links.
const DENSITY_FULL_AT = 30;
// Minimum cohort size (roles-with-links) for a meaningful group-level benchmark.
const COHORT_MIN = 2;
// Minimum number of roles a competency must appear in for a cross-role competency benchmark.
const COMP_BENCHMARK_MIN_ROLES = 2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function bandOf(c: number | null): string {
  if (c == null) return 'none';
  if (c >= 0.85) return 'high';
  if (c >= 0.7) return 'moderate';
  if (c >= 0.5) return 'low';
  if (c > 0) return 'very_low';
  return 'none';
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [name]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}
async function scalarNum(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0]?.n;
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ExplainEntry {
  field: string;
  value: string | number | boolean | null;
  source: string | null;
  note: string;
}

export interface BenchmarkLevel {
  available: boolean;
  source: string | null;
  reason?: string;
  stats?: Record<string, number | null>;
}

export interface RoleGovernance {
  input: string;
  resolved: boolean;
  roleCode: string | null;
  ontRoleId: number | null;
  roleTitle: string | null;
  // Inheritance chain (Coverage axis)
  family: { id: number | null; name: string | null };
  department: { id: number | null; name: string | null };
  function: { id: number | null; name: string | null };
  competencyCount: number;
  coreCompetencyCount: number;
  // Governance scores
  completeness: number | null;
  completenessBand: string;
  confidence: number | null;
  confidenceBand: string;
  quality: number | null;
  qualityBand: string;
  provisional: boolean;
  /** True when no competency requirements exist for the role (resolved or not). The
   *  requirement-dependent scores (confidence, quality) are then null — abstained, not
   *  fabricated. `completeness` may still carry a partial Coverage value reflecting the
   *  inheritance chain that genuinely exists; absent requirement components are listed in
   *  `missingComponents`. */
  abstained: boolean;
  abstainReason: string | null;
  missingComponents: string[];
  failedQualityChecks: string[];
  // Benchmark availability across levels
  benchmarks: {
    role: BenchmarkLevel;
    competency: BenchmarkLevel;
    department: BenchmarkLevel;
    family: BenchmarkLevel;
    function: BenchmarkLevel;
    industry: BenchmarkLevel;
    readiness: BenchmarkLevel;
  };
  benchmarkLevelsAvailable: number;
  benchmarkLevelsTotal: number;
  explainability: ExplainEntry[];
  version: string;
  generatedAt: string;
}

interface RoleRow {
  id: number;
  code: string;
  title: string | null;
  family_id: number | null;
  family_name: string | null;
  department_id: number | null;
  department_name: string | null;
  function_id: number | null;
  function_name: string | null;
}
interface LinkRow {
  competency_id: number;
  competency_name: string | null;
  weight: number | null;
  min_proficiency: string | null;
  target_proficiency: string | null;
  source: string | null;
  importance_tier: string | null;
}

async function loadRole(pool: Pool, input: string): Promise<RoleRow | null> {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.code, r.title,
              f.id AS family_id, f.name AS family_name,
              d.id AS department_id, d.name AS department_name,
              fn.id AS function_id, fn.name AS function_name
         FROM ont_roles r
         LEFT JOIN ont_role_families f ON f.id = r.role_family_id
         LEFT JOIN ont_departments d ON d.id = f.department_id
         LEFT JOIN ont_functions fn ON fn.id = d.function_id
        WHERE r.is_active = true AND (lower(r.code) = lower($1) OR lower(r.title) = lower($1))
        ORDER BY (lower(r.code) = lower($1)) DESC
        LIMIT 1`,
      [input],
    );
    return (rows[0] as RoleRow) ?? null;
  } catch {
    return null;
  }
}

async function loadLinks(pool: Pool, roleId: number): Promise<LinkRow[]> {
  try {
    const { rows } = await pool.query(
      `SELECT m.competency_id, c.name AS competency_name,
              m.weight, m.min_proficiency, m.target_proficiency, m.source, m.importance_tier
         FROM map_role_competency m
         LEFT JOIN ont_competencies c ON c.id = m.competency_id
        WHERE m.role_id = $1 AND m.is_active = true`,
      [roleId],
    );
    return rows as LinkRow[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Scoring (pure)
// ---------------------------------------------------------------------------
export function scoreCompleteness(role: RoleRow, links: LinkRow[]): {
  score: number;
  missing: string[];
} {
  const checks: Array<[string, boolean]> = [
    ['role_resolved', !!role.code],
    ['family', role.family_id != null],
    ['department', role.department_id != null],
    ['function', role.function_id != null],
    ['has_competency_links', links.length > 0],
    ['weights_populated', links.length > 0 && links.every((l) => l.weight != null)],
    ['target_proficiency_populated', links.length > 0 && links.every((l) => l.target_proficiency != null)],
    ['min_proficiency_populated', links.length > 0 && links.every((l) => l.min_proficiency != null)],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  return { score: round2(passed / checks.length), missing };
}

export function scoreConfidence(links: LinkRow[]): { score: number | null; reason: string } {
  if (links.length === 0) return { score: null, reason: 'no_competency_links' };
  // Provenance trust = link-share-weighted average of per-source trust.
  let trustSum = 0;
  for (const l of links) {
    trustSum += SOURCE_TRUST[(l.source ?? '').toLowerCase()] ?? DEFAULT_SOURCE_TRUST;
  }
  const provenance = trustSum / links.length;
  // Density = saturating at DENSITY_FULL_AT links.
  const density = clamp01(links.length / DENSITY_FULL_AT);
  const score = round2(clamp01(0.6 * provenance + 0.4 * density));
  return { score, reason: 'provenance_and_density' };
}

export function scoreQuality(links: LinkRow[]): { score: number | null; failed: string[] } {
  if (links.length === 0) return { score: null, failed: ['no_competency_links'] };
  const ids = links.map((l) => l.competency_id);
  const noDup = new Set(ids).size === ids.length;
  const minLeTarget = links.every((l) => {
    const mn = l.min_proficiency ? PROFICIENCY_LEVEL[l.min_proficiency.toLowerCase()] : null;
    const tg = l.target_proficiency ? PROFICIENCY_LEVEL[l.target_proficiency.toLowerCase()] : null;
    if (mn == null || tg == null) return true; // can't disprove → not a coherence failure
    return mn <= tg;
  });
  const checks: Array<[string, boolean]> = [
    ['has_min_3_competencies', links.length >= 3],
    ['has_core_competency', links.some((l) => (l.importance_tier ?? '').toLowerCase() === 'core')],
    ['min_le_target', minLeTarget],
    ['no_duplicate_competency', noDup],
    ['weights_positive', links.every((l) => l.weight != null && Number(l.weight) > 0)],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  return { score: round2(passed / checks.length), failed };
}

function meanTargetLevel(links: LinkRow[]): number | null {
  const levels = links
    .map((l) => (l.target_proficiency ? PROFICIENCY_LEVEL[l.target_proficiency.toLowerCase()] : null))
    .filter((v): v is number => v != null);
  if (!levels.length) return null;
  return round2(levels.reduce((a, b) => a + b, 0) / levels.length);
}

// ---------------------------------------------------------------------------
// Per-role benchmark availability (composes map_role_competency aggregates)
// ---------------------------------------------------------------------------
async function cohortBenchmark(
  pool: Pool,
  level: 'family' | 'department' | 'function',
  groupId: number | null,
): Promise<BenchmarkLevel> {
  if (groupId == null) {
    return { available: false, source: null, reason: `no_${level}_on_role` };
  }
  // roles-with-links in the same group + their average competency count.
  const joinChain =
    level === 'family'
      ? 'JOIN ont_role_families g ON g.id = r.role_family_id'
      : level === 'department'
        ? 'JOIN ont_role_families f ON f.id = r.role_family_id JOIN ont_departments g ON g.id = f.department_id'
        : 'JOIN ont_role_families f ON f.id = r.role_family_id JOIN ont_departments d ON d.id = f.department_id JOIN ont_functions g ON g.id = d.function_id';
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT r.id)::int AS cohort_roles,
              ROUND(AVG(lc.c), 1)::float AS mean_competency_count
         FROM ont_roles r
         ${joinChain}
         JOIN (SELECT role_id, COUNT(*) c FROM map_role_competency WHERE is_active = true GROUP BY role_id) lc
           ON lc.role_id = r.id
        WHERE r.is_active = true AND g.id = $1`,
      [groupId],
    );
    const cohortRoles = Number(rows[0]?.cohort_roles ?? 0);
    if (cohortRoles < COHORT_MIN) {
      return {
        available: false,
        source: 'map_role_competency',
        reason: 'insufficient_cohort',
        stats: { cohort_roles: cohortRoles, cohort_min: COHORT_MIN },
      };
    }
    return {
      available: true,
      source: 'map_role_competency',
      stats: {
        cohort_roles: cohortRoles,
        mean_competency_count: rows[0]?.mean_competency_count ?? null,
      },
    };
  } catch {
    return { available: false, source: 'map_role_competency', reason: 'cohort_query_failed' };
  }
}

async function competencyBenchmark(pool: Pool, links: LinkRow[]): Promise<BenchmarkLevel> {
  if (!links.length) return { available: false, source: null, reason: 'no_competency_links' };
  const ids = links.map((l) => l.competency_id);
  try {
    const { rows } = await pool.query(
      `SELECT competency_id, COUNT(DISTINCT role_id)::int AS roles
         FROM map_role_competency
        WHERE is_active = true AND competency_id = ANY($1::int[])
        GROUP BY competency_id`,
      [ids],
    );
    const benchmarkable = rows.filter((r: any) => Number(r.roles) >= COMP_BENCHMARK_MIN_ROLES).length;
    if (benchmarkable === 0) {
      return {
        available: false,
        source: 'map_role_competency',
        reason: 'no_cross_role_distribution',
        stats: { competencies: ids.length, benchmarkable: 0 },
      };
    }
    return {
      available: true,
      source: 'map_role_competency',
      stats: { competencies: ids.length, benchmarkable },
    };
  } catch {
    return { available: false, source: 'map_role_competency', reason: 'competency_query_failed' };
  }
}

// ---------------------------------------------------------------------------
// Public: per-role governance (read-only compose)
// ---------------------------------------------------------------------------
export async function computeRoleGovernance(pool: Pool, input: string): Promise<RoleGovernance> {
  const generatedAt = new Date().toISOString();
  const role = await loadRole(pool, input);
  if (!role) {
    return {
      input,
      resolved: false,
      roleCode: null,
      ontRoleId: null,
      roleTitle: null,
      family: { id: null, name: null },
      department: { id: null, name: null },
      function: { id: null, name: null },
      competencyCount: 0,
      coreCompetencyCount: 0,
      completeness: null,
      completenessBand: 'none',
      confidence: null,
      confidenceBand: 'none',
      quality: null,
      qualityBand: 'none',
      provisional: true,
      abstained: true,
      abstainReason: 'unresolved_role',
      missingComponents: ['role_resolved'],
      failedQualityChecks: ['unresolved_role'],
      benchmarks: {
        role: { available: false, source: null, reason: 'unresolved_role' },
        competency: { available: false, source: null, reason: 'unresolved_role' },
        department: { available: false, source: null, reason: 'unresolved_role' },
        family: { available: false, source: null, reason: 'unresolved_role' },
        function: { available: false, source: null, reason: 'unresolved_role' },
        industry: { available: false, source: null, reason: 'no_role_industry_linkage' },
        readiness: { available: false, source: null, reason: 'unresolved_role' },
      },
      benchmarkLevelsAvailable: 0,
      benchmarkLevelsTotal: 7,
      explainability: [
        { field: 'role', value: input, source: 'ont_roles', note: 'no active role matched code or title' },
      ],
      version: ROLE_DNA_GOVERNANCE_VERSION,
      generatedAt,
    };
  }

  const links = await loadLinks(pool, role.id);
  const completeness = scoreCompleteness(role, links);
  const confidence = scoreConfidence(links);
  const quality = scoreQuality(links);
  const coreCount = links.filter((l) => (l.importance_tier ?? '').toLowerCase() === 'core').length;
  const meanTgt = meanTargetLevel(links);

  // Benchmark levels.
  const roleBench: BenchmarkLevel = links.length
    ? {
        available: true,
        source: 'map_role_competency',
        stats: {
          competency_count: links.length,
          core_count: coreCount,
          mean_target_level: meanTgt,
        },
      }
    : { available: false, source: 'map_role_competency', reason: 'no_competency_links' };

  const readinessBench: BenchmarkLevel = links.length && meanTgt != null
    ? {
        available: true,
        source: 'map_role_competency',
        stats: {
          required_mean_level: meanTgt,
          core_threshold_competencies: coreCount,
          readiness_target_pct: round2((meanTgt / 5) * 100),
        },
      }
    : { available: false, source: 'map_role_competency', reason: 'no_competency_links' };

  const [familyBench, deptBench, funcBench, compBench] = await Promise.all([
    cohortBenchmark(pool, 'family', role.family_id),
    cohortBenchmark(pool, 'department', role.department_id),
    cohortBenchmark(pool, 'function', role.function_id),
    competencyBenchmark(pool, links),
  ]);

  const benchmarks = {
    role: roleBench,
    competency: compBench,
    department: deptBench,
    family: familyBench,
    function: funcBench,
    // No role↔industry linkage exists in the ont_* chain — abstain honestly, never fabricate.
    industry: {
      available: false,
      source: null,
      reason: 'no_role_industry_linkage',
    } as BenchmarkLevel,
    readiness: readinessBench,
  };
  const benchmarkLevelsAvailable = Object.values(benchmarks).filter((b) => b.available).length;

  const explainability: ExplainEntry[] = [
    { field: 'role', value: role.title ?? role.code, source: 'ont_roles', note: `resolved by ${input}` },
    { field: 'family', value: role.family_name, source: 'ont_role_families', note: 'inheritance level 1' },
    { field: 'department', value: role.department_name, source: 'ont_departments', note: 'inheritance level 2' },
    { field: 'function', value: role.function_name, source: 'ont_functions', note: 'inheritance level 3' },
    {
      field: 'competency_requirements',
      value: links.length,
      source: 'map_role_competency',
      note: `${links.length} active links (${coreCount} core)`,
    },
    {
      field: 'completeness',
      value: completeness.score,
      source: 'derived',
      note: completeness.missing.length ? `missing: ${completeness.missing.join(', ')}` : 'all components present',
    },
    {
      field: 'confidence',
      value: confidence.score,
      source: 'derived',
      note: `provenance(link-share-weighted source trust) + link density; ${confidence.reason}`,
    },
    {
      field: 'quality',
      value: quality.score,
      source: 'derived',
      note: quality.failed.length ? `failed: ${quality.failed.join(', ')}` : 'all coherence checks passed',
    },
    {
      field: 'benchmark.industry',
      value: 'unavailable',
      source: null,
      note: 'no role↔industry linkage in the ont_* chain — abstained, not fabricated',
    },
  ];
  if (links.length === 0) {
    explainability.push({
      field: 'abstention',
      value: 'no_competency_links',
      source: 'map_role_competency',
      note: 'role resolved but carries no competency requirements — confidence & quality null (abstained, not fabricated); completeness reflects only the inheritance chain that exists',
    });
  }

  return {
    input,
    resolved: true,
    roleCode: role.code,
    ontRoleId: role.id,
    roleTitle: role.title,
    family: { id: role.family_id, name: role.family_name },
    department: { id: role.department_id, name: role.department_name },
    function: { id: role.function_id, name: role.function_name },
    competencyCount: links.length,
    coreCompetencyCount: coreCount,
    completeness: completeness.score,
    completenessBand: bandOf(completeness.score),
    confidence: confidence.score,
    confidenceBand: bandOf(confidence.score),
    quality: quality.score,
    qualityBand: bandOf(quality.score),
    provisional: confidence.score == null || confidence.score < 0.7 || links.length === 0,
    abstained: links.length === 0,
    abstainReason: links.length === 0 ? 'no_competency_links' : null,
    missingComponents: completeness.missing,
    failedQualityChecks: quality.failed,
    benchmarks,
    benchmarkLevelsAvailable,
    benchmarkLevelsTotal: 7,
    explainability,
    version: ROLE_DNA_GOVERNANCE_VERSION,
    generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public: platform-wide benchmark coverage (read-only, set-based)
// ---------------------------------------------------------------------------
export interface BenchmarkCoverage {
  level: string;
  covered: number | null;
  total: number | null;
  coveragePct: number | null;
  source: string;
  note: string;
}

export async function computeBenchmarkCoverage(pool: Pool): Promise<{
  levels: BenchmarkCoverage[];
  version: string;
  generatedAt: string;
}> {
  const totalRoles = await scalarNum(pool, 'SELECT COUNT(*)::int n FROM ont_roles WHERE is_active = true');
  const rolesWithLinks = await scalarNum(
    pool,
    `SELECT COUNT(DISTINCT m.role_id)::int n
       FROM map_role_competency m JOIN ont_roles r ON r.id = m.role_id
      WHERE m.is_active = true AND r.is_active = true`,
  );
  const compsInUse = await scalarNum(
    pool,
    'SELECT COUNT(DISTINCT competency_id)::int n FROM map_role_competency WHERE is_active = true',
  );
  const compsBenchmarkable = await scalarNum(
    pool,
    `SELECT COUNT(*)::int n FROM (
        SELECT competency_id FROM map_role_competency WHERE is_active = true
        GROUP BY competency_id HAVING COUNT(DISTINCT role_id) >= $1) s`,
    [COMP_BENCHMARK_MIN_ROLES],
  );

  // Group-level coverage: groups with >= COHORT_MIN linked roles / total active groups.
  const groupCoverage = async (
    table: string,
    joinToRole: string,
  ): Promise<{ covered: number | null; total: number | null }> => {
    const total = await scalarNum(pool, `SELECT COUNT(*)::int n FROM ${table} WHERE is_active = true`);
    const covered = await scalarNum(
      pool,
      `SELECT COUNT(*)::int n FROM (
          SELECT g.id
            FROM ${table} g
            JOIN ont_role_families f2 ON ${joinToRole}
            JOIN ont_roles r ON r.role_family_id = f2.id AND r.is_active = true
            JOIN (SELECT DISTINCT role_id FROM map_role_competency WHERE is_active = true) lc ON lc.role_id = r.id
           WHERE g.is_active = true
           GROUP BY g.id HAVING COUNT(DISTINCT r.id) >= $1) s`,
      [COHORT_MIN],
    );
    return { covered, total };
  };

  // family: g IS the family.
  const familyTotal = await scalarNum(pool, 'SELECT COUNT(*)::int n FROM ont_role_families WHERE is_active = true');
  const familyCovered = await scalarNum(
    pool,
    `SELECT COUNT(*)::int n FROM (
        SELECT f.id
          FROM ont_role_families f
          JOIN ont_roles r ON r.role_family_id = f.id AND r.is_active = true
          JOIN (SELECT DISTINCT role_id FROM map_role_competency WHERE is_active = true) lc ON lc.role_id = r.id
         WHERE f.is_active = true
         GROUP BY f.id HAVING COUNT(DISTINCT r.id) >= $1) s`,
    [COHORT_MIN],
  );
  const dept = await groupCoverage('ont_departments', 'f2.department_id = g.id');
  const func = await groupCoverage(
    'ont_functions',
    'f2.department_id IN (SELECT id FROM ont_departments WHERE function_id = g.id)',
  );
  const totalIndustries = await scalarNum(pool, 'SELECT COUNT(*)::int n FROM ont_industries WHERE is_active = true');

  const pct = (c: number | null, t: number | null) =>
    c != null && t != null && t > 0 ? round2((c / t) * 100) : null;

  const levels: BenchmarkCoverage[] = [
    {
      level: 'role',
      covered: rolesWithLinks,
      total: totalRoles,
      coveragePct: pct(rolesWithLinks, totalRoles),
      source: 'map_role_competency',
      note: 'active roles carrying >=1 competency link',
    },
    {
      level: 'competency',
      covered: compsBenchmarkable,
      total: compsInUse,
      coveragePct: pct(compsBenchmarkable, compsInUse),
      source: 'map_role_competency',
      note: `competencies appearing in >=${COMP_BENCHMARK_MIN_ROLES} roles (cross-role distribution)`,
    },
    {
      level: 'department',
      covered: dept.covered,
      total: dept.total,
      coveragePct: pct(dept.covered, dept.total),
      source: 'map_role_competency',
      note: `departments with >=${COHORT_MIN} linked roles`,
    },
    {
      level: 'family',
      covered: familyCovered,
      total: familyTotal,
      coveragePct: pct(familyCovered, familyTotal),
      source: 'map_role_competency',
      note: `role families with >=${COHORT_MIN} linked roles`,
    },
    {
      level: 'function',
      covered: func.covered,
      total: func.total,
      coveragePct: pct(func.covered, func.total),
      source: 'map_role_competency',
      note: `functions with >=${COHORT_MIN} linked roles`,
    },
    {
      level: 'readiness',
      covered: rolesWithLinks,
      total: totalRoles,
      coveragePct: pct(rolesWithLinks, totalRoles),
      source: 'map_role_competency',
      note: 'readiness bar derived from each linked role’s target-proficiency profile',
    },
    {
      level: 'industry',
      covered: 0,
      total: totalIndustries,
      coveragePct: totalIndustries != null && totalIndustries > 0 ? 0 : null,
      source: 'none',
      note: 'NO role↔industry linkage exists in the ont_* chain — abstained, never fabricated',
    },
  ];

  return { levels, version: ROLE_DNA_GOVERNANCE_VERSION, generatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Public: governance overview (score distribution across all linked roles)
// ---------------------------------------------------------------------------
export interface GovernanceOverview {
  totalRoles: number | null;
  rolesWithLinks: number | null;
  rolesAbstained: number | null;
  benchmarkCoverage: BenchmarkCoverage[];
  materialized: {
    available: boolean;
    count: number;
    versions: Array<{ version: string | null; count: number }>;
    latestAt: string | null;
  };
  version: string;
  generatedAt: string;
}

export async function computeGovernanceOverview(pool: Pool): Promise<GovernanceOverview> {
  const coverage = await computeBenchmarkCoverage(pool);
  const totalRoles = coverage.levels.find((l) => l.level === 'role')?.total ?? null;
  const rolesWithLinks = coverage.levels.find((l) => l.level === 'role')?.covered ?? null;
  const rolesAbstained =
    totalRoles != null && rolesWithLinks != null ? totalRoles - rolesWithLinks : null;

  let materialized: GovernanceOverview['materialized'] = {
    available: false,
    count: 0,
    versions: [],
    latestAt: null,
  };
  if (await tableExists(pool, 'role_dna_governance')) {
    try {
      const { rows } = await pool.query(
        `SELECT version, COUNT(*)::int c, MAX(created_at) latest
           FROM role_dna_governance WHERE provenance = $1 GROUP BY version ORDER BY c DESC`,
        [GOVERNANCE_PROVENANCE],
      );
      const total = rows.reduce((a: number, r: any) => a + Number(r.c), 0);
      const latest = rows
        .map((r: any) => (r.latest ? new Date(r.latest).getTime() : 0))
        .reduce((a: number, b: number) => Math.max(a, b), 0);
      materialized = {
        available: true,
        count: total,
        versions: rows.map((r: any) => ({ version: r.version ?? null, count: Number(r.c) })),
        latestAt: latest > 0 ? new Date(latest).toISOString() : null,
      };
    } catch {
      /* degrade to default */
    }
  }

  return {
    totalRoles,
    rolesWithLinks,
    rolesAbstained,
    benchmarkCoverage: coverage.levels,
    materialized,
    version: ROLE_DNA_GOVERNANCE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Persistence (WRITE path only) — reversible by provenance
// ---------------------------------------------------------------------------
let schemaReady = false;
export async function ensureGovernanceSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_dna_governance (
      id BIGSERIAL PRIMARY KEY,
      ont_role_id INTEGER,
      role_code TEXT NOT NULL,
      role_title TEXT,
      completeness NUMERIC,
      confidence NUMERIC,
      quality NUMERIC,
      provisional BOOLEAN DEFAULT false,
      competency_count INTEGER DEFAULT 0,
      benchmark_levels_available INTEGER DEFAULT 0,
      benchmark_levels_total INTEGER DEFAULT 7,
      governance JSONB NOT NULL,
      provenance TEXT NOT NULL DEFAULT 'mx100x_p1_governance',
      version TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_rdg_role_code ON role_dna_governance(role_code)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_rdg_provenance ON role_dna_governance(provenance)');
  schemaReady = true;
}

export interface MaterializeGovernanceResult {
  requested: number;
  resolved: number;
  written: number;
  skipped: number;
  provenance: string;
  details: Array<{ input: string; roleCode: string | null; written: boolean; reason?: string }>;
}

export async function materializeGovernance(
  pool: Pool,
  opts: { roleCodes?: string[]; limit?: number },
): Promise<MaterializeGovernanceResult> {
  await ensureGovernanceSchema(pool);

  let inputs: string[] = [];
  if (opts.roleCodes && opts.roleCodes.length) {
    inputs = opts.roleCodes.slice(0, 1100);
  } else {
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 1100);
    const { rows } = await pool.query(
      `SELECT r.code
         FROM ont_roles r
         JOIN map_role_competency m ON m.role_id = r.id AND m.is_active = true
        WHERE r.is_active = true
        GROUP BY r.code
        ORDER BY COUNT(m.id) DESC
        LIMIT $1`,
      [limit],
    );
    inputs = rows.map((x: any) => x.code);
  }

  const details: MaterializeGovernanceResult['details'] = [];
  let written = 0;
  let resolved = 0;
  let skipped = 0;

  for (const input of inputs) {
    const gov = await computeRoleGovernance(pool, input);
    if (!gov.resolved || !gov.roleCode) {
      skipped++;
      details.push({ input, roleCode: null, written: false, reason: 'unresolved' });
      continue;
    }
    resolved++;
    try {
      await pool.query('DELETE FROM role_dna_governance WHERE provenance = $1 AND role_code = $2', [
        GOVERNANCE_PROVENANCE,
        gov.roleCode,
      ]);
      await pool.query(
        `INSERT INTO role_dna_governance
           (ont_role_id, role_code, role_title, completeness, confidence, quality, provisional,
            competency_count, benchmark_levels_available, benchmark_levels_total, governance,
            provenance, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          gov.ontRoleId,
          gov.roleCode,
          gov.roleTitle,
          gov.completeness,
          gov.confidence,
          gov.quality,
          gov.provisional,
          gov.competencyCount,
          gov.benchmarkLevelsAvailable,
          gov.benchmarkLevelsTotal,
          JSON.stringify(gov),
          GOVERNANCE_PROVENANCE,
          ROLE_DNA_GOVERNANCE_VERSION,
        ],
      );
      written++;
      details.push({ input, roleCode: gov.roleCode, written: true });
    } catch (err) {
      skipped++;
      details.push({ input, roleCode: gov.roleCode, written: false, reason: (err as Error).message });
    }
  }

  return { requested: inputs.length, resolved, written, skipped, provenance: GOVERNANCE_PROVENANCE, details };
}

export interface MaterializedGovernanceRow {
  roleCode: string;
  roleTitle: string | null;
  completeness: number | null;
  confidence: number | null;
  quality: number | null;
  provisional: boolean;
  competencyCount: number;
  benchmarkLevelsAvailable: number;
  createdAt: string | null;
}

export async function listGovernance(
  pool: Pool,
  limit = 100,
): Promise<{ available: boolean; count: number; rows: MaterializedGovernanceRow[] }> {
  if (!(await tableExists(pool, 'role_dna_governance'))) {
    return { available: false, count: 0, rows: [] };
  }
  const cap = Math.min(Math.max(limit, 1), 500);
  try {
    const total = await scalarNum(
      pool,
      'SELECT COUNT(*)::int n FROM role_dna_governance WHERE provenance = $1',
      [GOVERNANCE_PROVENANCE],
    );
    const { rows } = await pool.query(
      `SELECT role_code, role_title, completeness, confidence, quality, provisional,
              competency_count, benchmark_levels_available, created_at
         FROM role_dna_governance
        WHERE provenance = $1
        ORDER BY confidence DESC NULLS LAST, competency_count DESC
        LIMIT $2`,
      [GOVERNANCE_PROVENANCE, cap],
    );
    return {
      available: true,
      count: total ?? rows.length,
      rows: rows.map((r: any) => ({
        roleCode: r.role_code,
        roleTitle: r.role_title ?? null,
        completeness: r.completeness == null ? null : Number(r.completeness),
        confidence: r.confidence == null ? null : Number(r.confidence),
        quality: r.quality == null ? null : Number(r.quality),
        provisional: !!r.provisional,
        competencyCount: Number(r.competency_count) || 0,
        benchmarkLevelsAvailable: Number(r.benchmark_levels_available) || 0,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
    };
  } catch {
    return { available: false, count: 0, rows: [] };
  }
}

export async function rollbackGovernance(
  pool: Pool,
): Promise<{ deleted: number; tableExisted: boolean }> {
  if (!(await tableExists(pool, 'role_dna_governance'))) {
    return { deleted: 0, tableExisted: false };
  }
  const res = await pool.query('DELETE FROM role_dna_governance WHERE provenance = $1', [
    GOVERNANCE_PROVENANCE,
  ]);
  return { deleted: res.rowCount ?? 0, tableExisted: true };
}
