/**
 * O*NET Activation orchestration — 98X Gap Closure, Phase 1 (additive, flag-gated, read-only at runtime).
 *
 * WHAT THIS IS
 * ------------
 * A thin orchestration layer that COMPOSES the already-live O*NET reference library and the
 * existing Phase-1 `role-dna-expansion-engine` into 5 NAMED capabilities. It does NOT rebuild
 * those engines, does NOT create parallel role/competency tables, and does NOT recompute any
 * score. The 5 capabilities:
 *
 *   1. OnetCrosswalkExpansionEngine  — crosswalk / DNA coverage across all `ont_roles`
 *                                       (composes computeCrosswalkCoverage) + bridge health.
 *   2. OnetRoleIntelligenceEngine    — role resolution + confidence + O*NET HIERARCHY CONTEXT
 *                                       (family -> department -> function). NEW value added here.
 *   3. OnetCompetencyInheritanceEngine— inherited competency requirements grouped by tier/source
 *                                       (composes getRoleCompetencies; curated-wins downstream).
 *   4. OnetRoleDnaGenerator          — full Role DNA (composes generateRoleDNA) + hierarchy context.
 *   5. OnetBenchmarkFoundation       — benchmark positioning (composes generateRoleBenchmark) +
 *                                       library-level benchmark coverage.
 *
 * HONESTY CONTRACT
 * ----------------
 * - O*NET is a REFERENCE layer, never a scoring source. The curated `onto_*` genome stays
 *   canonical: curated requirements take precedence where a bridge exists (handled inside the
 *   composed engine), never fabricated.
 * - "500+ crosswalks" is interpreted HONESTLY as 500+ materialized Role DNA *profiles*
 *   (ont_role -> inherited competencies + benchmark + curated precedence). The curated <-> O*NET
 *   *role* bridge (`map_ont_onto_role`) is hard-capped at the number of curated `onto_roles`
 *   (currently 5) and CANNOT grow to 500+ without inventing curated roles — so it never does.
 * - Reads use a `to_regclass` probe + degrade (never DDL on a read path). Missing data abstains
 *   (null / available:false), never an invented value.
 * - O*NET roles carry NO industry dimension (the library has families -> departments -> functions,
 *   not a role->industry link). Industries are reported as a separate reference count, never
 *   force-attached to a role.
 */
import type { Pool } from 'pg';
import {
  computeCrosswalkCoverage,
  generateRoleDNA,
  generateRoleBenchmark,
  listMaterialized,
  scoreRoleMatch,
  EXPANSION_PROVENANCE,
  type CrosswalkCoverage,
  type RoleDNA,
  type RoleBenchmark,
  type RoleMatchConfidence,
} from './role-dna-expansion-engine';
import { resolveBestOntRole, getRoleCompetencies } from './role-crosswalk';

export const ONET_ACTIVATION_VERSION = '98x-phase1-onet-activation-1.0.0';
/** match_method value stamped on bridge rows resolved BY this activation, so they are
 *  self-identifying and fully reversible (rollback restores them to 'unresolved'). */
export const BRIDGE_RESOLVED_METHOD = 'onet_activation_resolved';

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [name]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}
async function scalarInt(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0]?.n;
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// O*NET hierarchy context (the net-new value of the Role Intelligence engine)
// ---------------------------------------------------------------------------
export interface OntHierarchyContext {
  available: boolean;
  family: string | null;
  careerTrackArchetype: string | null;
  department: string | null;
  function: string | null;
  crossIndustryFunction: boolean | null;
  note: string;
}

const HIERARCHY_NOTE =
  'O*NET hierarchy is role -> family -> department -> function. O*NET roles carry NO industry ' +
  'dimension, so industry is reported separately as a reference count, never attached to a role.';

export async function getOntHierarchyContext(
  pool: Pool,
  ontRoleId: number | null,
): Promise<OntHierarchyContext> {
  const empty: OntHierarchyContext = {
    available: false,
    family: null,
    careerTrackArchetype: null,
    department: null,
    function: null,
    crossIndustryFunction: null,
    note: HIERARCHY_NOTE,
  };
  if (ontRoleId == null) return empty;
  if (!(await tableExists(pool, 'ont_roles'))) return empty;
  try {
    const { rows } = await pool.query(
      `SELECT rf.name AS family,
              rf.career_track_archetype AS career_track_archetype,
              d.name  AS department,
              f.name  AS function_name,
              f.is_cross_industry AS cross_industry
         FROM ont_roles r
         LEFT JOIN ont_role_families rf ON rf.id = r.role_family_id
         LEFT JOIN ont_departments  d  ON d.id  = rf.department_id
         LEFT JOIN ont_functions    f  ON f.id  = d.function_id
        WHERE r.id = $1
        LIMIT 1`,
      [ontRoleId],
    );
    if (!rows.length) return empty;
    const r = rows[0];
    const anything =
      r.family != null || r.department != null || r.function_name != null;
    return {
      available: anything,
      family: r.family ?? null,
      careerTrackArchetype: r.career_track_archetype ?? null,
      department: r.department ?? null,
      function: r.function_name ?? null,
      crossIndustryFunction: r.cross_industry == null ? null : !!r.cross_industry,
      note: HIERARCHY_NOTE,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// 1) OnetCrosswalkExpansionEngine
// ---------------------------------------------------------------------------
export interface BridgeHealth {
  available: boolean;
  total: number | null;
  resolved: number | null;
  unresolved: number | null;
  resolvedByActivation: number | null;
  curatedRoles: number | null;
  note: string;
}

export async function getBridgeHealth(pool: Pool): Promise<BridgeHealth> {
  if (!(await tableExists(pool, 'map_ont_onto_role'))) {
    return {
      available: false, total: null, resolved: null, unresolved: null,
      resolvedByActivation: null, curatedRoles: null,
      note: 'map_ont_onto_role absent',
    };
  }
  const total = await scalarInt(pool, 'SELECT COUNT(*)::int n FROM map_ont_onto_role');
  const resolved = await scalarInt(
    pool, 'SELECT COUNT(*)::int n FROM map_ont_onto_role WHERE ont_role_id IS NOT NULL');
  const resolvedByActivation = await scalarInt(
    pool, 'SELECT COUNT(*)::int n FROM map_ont_onto_role WHERE match_method = $1', [BRIDGE_RESOLVED_METHOD]);
  const curated = (await tableExists(pool, 'onto_roles'))
    ? await scalarInt(pool, 'SELECT COUNT(*)::int n FROM onto_roles')
    : null;
  const unresolved = total != null && resolved != null ? total - resolved : null;
  return {
    available: true,
    total, resolved, unresolved, resolvedByActivation, curatedRoles: curated,
    note:
      'The curated <-> O*NET role bridge is capped at the number of curated onto_roles. It is a ' +
      'QUALITY surface (resolve unresolved rows), not a count that can grow to the O*NET library size.',
  };
}

export interface CrosswalkExpansion {
  coverage: CrosswalkCoverage;
  bridge: BridgeHealth;
  industriesReference: number | null;
  functionsReference: number | null;
}

export async function getCrosswalkExpansion(pool: Pool): Promise<CrosswalkExpansion> {
  const coverage = await computeCrosswalkCoverage(pool);
  const bridge = await getBridgeHealth(pool);
  const industriesReference = (await tableExists(pool, 'ont_industries'))
    ? await scalarInt(pool, 'SELECT COUNT(*)::int n FROM ont_industries')
    : null;
  const functionsReference = (await tableExists(pool, 'ont_functions'))
    ? await scalarInt(pool, 'SELECT COUNT(*)::int n FROM ont_functions')
    : null;
  return { coverage, bridge, industriesReference, functionsReference };
}

// ---------------------------------------------------------------------------
// 2) OnetRoleIntelligenceEngine — resolution + confidence + hierarchy context
// ---------------------------------------------------------------------------
export interface RoleIntelligence {
  input: string;
  resolved: boolean;
  roleCode: string | null;
  ontRoleId: number | null;
  roleTitle: string | null;
  matchType: string | null;
  confidence: RoleMatchConfidence;
  competencyLinkCount: number;
  hierarchy: OntHierarchyContext;
}

export async function getRoleIntelligence(pool: Pool, input: string): Promise<RoleIntelligence> {
  const match = await resolveBestOntRole(pool, input);
  const confidence = scoreRoleMatch(match);
  const hierarchy = await getOntHierarchyContext(pool, match?.id ?? null);
  return {
    input,
    resolved: !!match,
    roleCode: match?.code ?? null,
    ontRoleId: match?.id ?? null,
    roleTitle: match?.title ?? null,
    matchType: match?.matchType ?? null,
    confidence,
    competencyLinkCount: match?.competencyCount ?? 0,
    hierarchy,
  };
}

// ---------------------------------------------------------------------------
// 3) OnetCompetencyInheritanceEngine — inherited requirements grouped
// ---------------------------------------------------------------------------
export interface CompetencyInheritance {
  input: string;
  resolved: boolean;
  roleCode: string | null;
  roleTitle: string | null;
  total: number;
  byTier: Record<string, number>;
  bySource: Record<string, number>;
  requirements: Array<{
    code: string;
    name: string;
    competencyType: string | null;
    importanceTier: string;
    weight: number;
    targetProficiency: string | null;
    source: string;
  }>;
  note: string;
}

export async function getCompetencyInheritance(
  pool: Pool,
  input: string,
): Promise<CompetencyInheritance> {
  const match = await resolveBestOntRole(pool, input);
  if (!match) {
    return {
      input, resolved: false, roleCode: null, roleTitle: null, total: 0,
      byTier: {}, bySource: {}, requirements: [],
      note: 'role unresolved — no inherited requirements (never fabricated)',
    };
  }
  const comps = await getRoleCompetencies(pool, match.code);
  const byTier: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const c of comps) {
    byTier[c.importanceTier] = (byTier[c.importanceTier] ?? 0) + 1;
    bySource[c.source] = (bySource[c.source] ?? 0) + 1;
  }
  return {
    input,
    resolved: true,
    roleCode: match.code,
    roleTitle: match.title,
    total: comps.length,
    byTier,
    bySource,
    requirements: comps.map((c) => ({
      code: c.code,
      name: c.name,
      competencyType: c.competencyType,
      importanceTier: c.importanceTier,
      weight: c.weight,
      targetProficiency: c.targetProficiency,
      source: c.source,
    })),
    note:
      'Inherited from map_role_competency (O*NET reference). Curated onto_* requirements, when a ' +
      'bridge exists, take precedence in the full Role DNA — see the Role DNA Generator.',
  };
}

// ---------------------------------------------------------------------------
// 4) OnetRoleDnaGenerator — full DNA + hierarchy context
// ---------------------------------------------------------------------------
export interface RoleDnaWithContext extends RoleDNA {
  hierarchy: OntHierarchyContext;
}

export async function getRoleDna(pool: Pool, input: string): Promise<RoleDnaWithContext> {
  const dna = await generateRoleDNA(pool, input);
  const hierarchy = await getOntHierarchyContext(pool, dna.ontRoleId);
  return { ...dna, hierarchy };
}

// ---------------------------------------------------------------------------
// 5) OnetBenchmarkFoundation — benchmark positioning + library coverage
// ---------------------------------------------------------------------------
export interface BenchmarkFoundation {
  input: string;
  resolved: boolean;
  roleTitle: string | null;
  benchmark: RoleBenchmark;
  libraryCoverage: {
    benchmarkRows: number | null;
    note: string;
  };
}

export async function getBenchmarkFoundation(
  pool: Pool,
  input: string,
): Promise<BenchmarkFoundation> {
  const match = await resolveBestOntRole(pool, input);
  const benchmark = match
    ? await generateRoleBenchmark(pool, match.title)
    : ({ available: false, source: null, reason: 'unresolved_role' } as RoleBenchmark);
  const benchmarkRows = (await tableExists(pool, 'ti_role_benchmarks'))
    ? await scalarInt(pool, 'SELECT COUNT(*)::int n FROM ti_role_benchmarks')
    : null;
  return {
    input,
    resolved: !!match,
    roleTitle: match?.title ?? null,
    benchmark,
    libraryCoverage: {
      benchmarkRows,
      note:
        'ti_role_benchmarks is keyed by role FAMILY name; role-level lookups abstain when there is ' +
        'no matching row (never an invented percentile).',
    },
  };
}

// ---------------------------------------------------------------------------
// Activation status aggregator (read-only)
// ---------------------------------------------------------------------------
export interface ActivationStatus {
  version: string;
  coverage: CrosswalkCoverage;
  bridge: BridgeHealth;
  materialized: { available: boolean; count: number };
  target: { materializedProfiles: number; reached: boolean };
  generatedAt: string;
}

export async function getActivationStatus(pool: Pool): Promise<ActivationStatus> {
  const coverage = await computeCrosswalkCoverage(pool);
  const bridge = await getBridgeHealth(pool);
  const mat = await listMaterialized(pool, 1);
  const count = mat.available ? mat.count : 0;
  return {
    version: ONET_ACTIVATION_VERSION,
    coverage,
    bridge,
    materialized: { available: mat.available, count },
    target: { materializedProfiles: 500, reached: count >= 500 },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Reversible curated-bridge resolution (WRITE path — offline script only)
// ---------------------------------------------------------------------------
export interface BridgeResolutionResult {
  attempted: number;
  resolved: number;
  skipped: Array<{ ontoRoleId: string; title: string | null; reason: string }>;
  applied: boolean;
}

/**
 * Resolve the currently-unresolved curated <-> O*NET bridge rows (ont_role_id IS NULL) by
 * matching the curated role TITLE against the O*NET library. A bridge is only written when the
 * match is CONFIDENT (matchType code | exact_title | alias) — a weak partial match abstains
 * rather than forcing a low-quality bridge (honesty over coverage). Every written row is stamped
 * `match_method = BRIDGE_RESOLVED_METHOD`, so `rollbackBridgeResolution` restores it exactly.
 */
export async function resolveCuratedBridges(
  pool: Pool,
  opts: { apply: boolean },
): Promise<BridgeResolutionResult> {
  const out: BridgeResolutionResult = { attempted: 0, resolved: 0, skipped: [], applied: opts.apply };
  if (!(await tableExists(pool, 'map_ont_onto_role')) || !(await tableExists(pool, 'onto_roles'))) {
    return out;
  }
  const { rows } = await pool.query(
    `SELECT b.onto_role_id, r.title
       FROM map_ont_onto_role b
       LEFT JOIN onto_roles r ON r.id = b.onto_role_id
      WHERE b.ont_role_id IS NULL`,
  );
  for (const row of rows) {
    out.attempted++;
    const ontoRoleId = String(row.onto_role_id);
    const title = row.title ?? null;
    if (!title) {
      out.skipped.push({ ontoRoleId, title, reason: 'curated_role_has_no_title' });
      continue;
    }
    const match = await resolveBestOntRole(pool, title);
    const confident = match && (match.matchType === 'code' || match.matchType === 'exact_title' || match.matchType === 'alias');
    if (!confident) {
      out.skipped.push({
        ontoRoleId, title,
        reason: match ? `only_${match.matchType}_match_no_confident_onet_equivalent` : 'no_onet_equivalent',
      });
      continue;
    }
    if (opts.apply) {
      await pool.query(
        `UPDATE map_ont_onto_role
            SET ont_role_id = $1, ont_role_code = $2, match_method = $3, confidence = 'moderate'
          WHERE onto_role_id = $4 AND ont_role_id IS NULL`,
        [match!.id, match!.code, BRIDGE_RESOLVED_METHOD, ontoRoleId],
      );
    }
    out.resolved++;
  }
  return out;
}

export async function rollbackBridgeResolution(
  pool: Pool,
): Promise<{ reverted: number; tableExisted: boolean }> {
  if (!(await tableExists(pool, 'map_ont_onto_role'))) return { reverted: 0, tableExisted: false };
  const res = await pool.query(
    `UPDATE map_ont_onto_role
        SET ont_role_id = NULL, ont_role_code = NULL, match_method = 'unresolved', confidence = 'low'
      WHERE match_method = $1`,
    [BRIDGE_RESOLVED_METHOD],
  );
  return { reverted: res.rowCount ?? 0, tableExisted: true };
}

export const ONET_ACTIVATION_PROVENANCE = EXPANSION_PROVENANCE;
