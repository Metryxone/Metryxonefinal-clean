/**
 * Role DNA Expansion Engine — 98X Gap Closure, Phase 1 (additive, flag-gated, reversible).
 *
 * WHAT THIS IS
 * ------------
 * A NEW, isolated engine that surfaces + generates Role DNA from data that ALREADY
 * exists, without rebuilding or mutating any existing engine, the curated `onto_*`
 * genome, or the O*NET `ont_*` reference library.
 *
 * The chokepoint it closes: only 5 of ~1,040 O*NET roles are bridged into the
 * curated `onto_*` space, even though all 1,040 already carry competency links in
 * `map_role_competency` (52,362 rows). This engine:
 *   1. computes crosswalk / DNA coverage across all `ont_roles` (read-only),
 *   2. confidence-scores role resolution (deterministic, never fabricated),
 *   3. inherits competency requirements from `map_role_competency` (curated wins),
 *   4. generates per-role requirement + benchmark + DNA objects, and
 *   5. (POST-only) materializes them into a NEW dedicated, provenance-stamped table
 *      `role_dna_expansion_snapshots` for clean rollback.
 *
 * HONESTY CONTRACT
 * ----------------
 * - Reads use a `to_regclass` probe + degrade (never DDL on a read path).
 * - A role with no competency links abstains (capped confidence, `provisional`) — it
 *   is never given a fabricated DNA.
 * - A role with no benchmark row abstains (`available:false`) — no invented percentile.
 * - Every materialized row carries `provenance = '98x_phase1_expansion'`, so the full
 *   effect of this phase is reversible by deleting that provenance (or dropping the
 *   table). Nothing existing is altered.
 */
import type { Pool } from 'pg';
import {
  resolveBestOntRole,
  getRoleCompetencies,
  type RoleMatch,
} from './role-crosswalk';

export const ROLE_DNA_EXPANSION_VERSION = '98x-phase1-1.0.0';
export const EXPANSION_PROVENANCE = '98x_phase1_expansion';

const MATCH_CONFIDENCE: Record<RoleMatch['matchType'], number> = {
  code: 1.0,
  exact_title: 0.85,
  alias: 0.7,
  partial_title: 0.5,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}
function bandOf(c: number): string {
  if (c >= 0.85) return 'high';
  if (c >= 0.7) return 'moderate';
  if (c >= 0.5) return 'low';
  if (c > 0) return 'very_low';
  return 'none';
}

// Curated onto_role_weights store an integer expected_level (1..5). Map it to the
// same proficiency vocabulary the O*NET-inherited path uses so a composed DNA reads
// consistently. minProficiency is left null — curated weights declare a target, not a floor.
const LEVEL_TO_PROFICIENCY: Record<number, string> = {
  1: 'novice',
  2: 'novice',
  3: 'proficient',
  4: 'advanced',
  5: 'expert',
};
function curatedTierFromWeight(weight: number): string {
  if (weight >= 0.15) return 'core';
  if (weight >= 0.08) return 'important';
  return 'supporting';
}

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
// 1) Confidence scoring for role matching (deterministic, pure)
// ---------------------------------------------------------------------------
export interface RoleMatchConfidence {
  confidence: number;
  band: string;
  provisional: boolean;
  reason: string;
  matchType: RoleMatch['matchType'] | null;
}

export function scoreRoleMatch(match: RoleMatch | null): RoleMatchConfidence {
  if (!match) {
    return { confidence: 0, band: 'none', provisional: true, reason: 'unresolved', matchType: null };
  }
  let base = MATCH_CONFIDENCE[match.matchType] ?? 0.4;
  if (match.competencyCount <= 0) {
    // No competency links → can't back a DNA; cap + flag provisional. Never fabricate.
    base = Math.min(base, 0.3);
    return {
      confidence: round2(base),
      band: bandOf(base),
      provisional: true,
      reason: 'no_competency_links',
      matchType: match.matchType,
    };
  }
  return {
    confidence: round2(base),
    band: bandOf(base),
    provisional: base < 0.7,
    reason: match.matchType,
    matchType: match.matchType,
  };
}

// ---------------------------------------------------------------------------
// 2) Crosswalk / DNA coverage (read-only)
// ---------------------------------------------------------------------------
export interface CrosswalkCoverage {
  totalOntRoles: number | null;
  withCompetencyLinks: number | null;
  withoutCompetencyLinks: number | null;
  bridgedToCurated: number | null;
  curatedRoles: number | null;
  coveragePct: number | null;
  generatedDnaReachable: number | null;
  materializedSnapshots: number | null;
  note: string;
}

export async function computeCrosswalkCoverage(pool: Pool): Promise<CrosswalkCoverage> {
  const total = await scalarInt(pool, 'SELECT COUNT(*)::int n FROM ont_roles WHERE is_active = true');
  const withLinks = await scalarInt(
    pool,
    `SELECT COUNT(DISTINCT m.role_id)::int n
       FROM map_role_competency m
       JOIN ont_roles r ON r.id = m.role_id
      WHERE m.is_active = true AND r.is_active = true`,
  );
  const bridged = (await tableExists(pool, 'map_ont_onto_role'))
    ? await scalarInt(pool, 'SELECT COUNT(DISTINCT ont_role_id)::int n FROM map_ont_onto_role')
    : null;
  const curated = (await tableExists(pool, 'onto_roles'))
    ? await scalarInt(pool, 'SELECT COUNT(*)::int n FROM onto_roles')
    : null;
  const materialized = (await tableExists(pool, 'role_dna_expansion_snapshots'))
    ? await scalarInt(
        pool,
        'SELECT COUNT(*)::int n FROM role_dna_expansion_snapshots WHERE provenance = $1',
        [EXPANSION_PROVENANCE],
      )
    : null;
  const without = total != null && withLinks != null ? total - withLinks : null;
  const coveragePct =
    total != null && total > 0 && withLinks != null ? round2((withLinks / total) * 100) : null;
  return {
    totalOntRoles: total,
    withCompetencyLinks: withLinks,
    withoutCompetencyLinks: without,
    bridgedToCurated: bridged,
    curatedRoles: curated,
    coveragePct,
    generatedDnaReachable: withLinks,
    materializedSnapshots: materialized,
    note:
      'Coverage = active ont_roles carrying >=1 competency link (DNA-reachable) / total active ont_roles. ' +
      'Roles without links abstain (never fabricated). bridgedToCurated counts roles surfaced in the curated onto_* space.',
  };
}

// ---------------------------------------------------------------------------
// 3) Curated precedence (read-only) — curated onto_* always wins where bridged
// ---------------------------------------------------------------------------
async function curatedLayerFor(
  pool: Pool,
  ontRoleId: number,
): Promise<{ bridged: boolean; ontoRoleId: string | null }> {
  if (!(await tableExists(pool, 'map_ont_onto_role'))) return { bridged: false, ontoRoleId: null };
  try {
    const { rows } = await pool.query(
      'SELECT onto_role_id FROM map_ont_onto_role WHERE ont_role_id = $1 LIMIT 1',
      [ontRoleId],
    );
    if (!rows.length) return { bridged: false, ontoRoleId: null };
    return { bridged: true, ontoRoleId: rows[0].onto_role_id as string };
  } catch {
    return { bridged: false, ontoRoleId: null };
  }
}

/**
 * Curated requirement set for a bridged role: the authoritative `onto_role_weights`
 * authored against the curated `onto_*` genome, resolved via the current DNA profile.
 * Returns [] when the role is not bridged, the curated tables are absent, or no
 * curated weights exist — never fabricated. The curated competency namespace (`comp_*`)
 * is DISJOINT from the O*NET `ONET_*` namespace, so these compose ALONGSIDE inherited
 * requirements (curated first), they do not key-collide with them.
 */
async function curatedRequirementsFor(
  pool: Pool,
  ontoRoleId: string | null,
): Promise<RoleDNARequirement[]> {
  if (!ontoRoleId) return [];
  if (!(await tableExists(pool, 'onto_dna_profiles')) || !(await tableExists(pool, 'onto_role_weights'))) {
    return [];
  }
  try {
    const { rows } = await pool.query(
      `SELECT w.competency_id, c.canonical_name, w.weight, w.expected_level, w.rationale
         FROM onto_dna_profiles dp
         JOIN onto_role_weights w ON w.dna_profile_id = dp.id
         LEFT JOIN onto_competencies c ON c.id = w.competency_id
        WHERE dp.role_id = $1 AND dp.is_current = true
        ORDER BY w.weight DESC NULLS LAST`,
      [ontoRoleId],
    );
    return rows.map((r: any) => {
      const weight = Number(r.weight) || 0;
      const level = r.expected_level == null ? null : Number(r.expected_level);
      return {
        code: String(r.competency_id),
        name: r.canonical_name ?? String(r.competency_id),
        competencyType: 'curated',
        importanceTier: curatedTierFromWeight(weight),
        weight,
        minProficiency: null,
        targetProficiency: level != null ? (LEVEL_TO_PROFICIENCY[level] ?? null) : null,
        source: 'curated',
        expectedLevel: level,
        rationale: r.rationale ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 4) Role benchmark generation (read-only, abstain-by-default)
// ---------------------------------------------------------------------------
export interface RoleBenchmark {
  available: boolean;
  source: string | null;
  reason?: string;
  percentiles?: Record<string, number | null>;
  sampleSize?: number | null;
}

export async function generateRoleBenchmark(pool: Pool, roleTitle: string): Promise<RoleBenchmark> {
  if (!roleTitle) return { available: false, source: null, reason: 'no_role_title' };
  if (!(await tableExists(pool, 'ti_role_benchmarks'))) {
    return { available: false, source: null, reason: 'benchmark_table_absent' };
  }
  try {
    const { rows } = await pool.query(
      `SELECT rf_name, composite_p10, composite_p25, composite_p50, composite_p75, composite_p90, sample_size
         FROM ti_role_benchmarks
        WHERE lower(rf_name) = lower($1)
        LIMIT 1`,
      [roleTitle],
    );
    if (!rows.length) {
      // ti_role_benchmarks is keyed by role FAMILY name; a role-level row often has no
      // direct match. Abstain honestly rather than invent a percentile.
      return { available: false, source: 'ti_role_benchmarks', reason: 'no_matching_benchmark_row' };
    }
    const r = rows[0];
    return {
      available: true,
      source: 'ti_role_benchmarks',
      percentiles: {
        p10: numOrNull(r.composite_p10),
        p25: numOrNull(r.composite_p25),
        p50: numOrNull(r.composite_p50),
        p75: numOrNull(r.composite_p75),
        p90: numOrNull(r.composite_p90),
      },
      sampleSize: numOrNull(r.sample_size),
    };
  } catch {
    return { available: false, source: 'ti_role_benchmarks', reason: 'benchmark_query_failed' };
  }
}

// ---------------------------------------------------------------------------
// 5) Role DNA generation (read-only compose)
// ---------------------------------------------------------------------------
export interface RoleDNARequirement {
  code: string;
  name: string;
  competencyType: string | null;
  importanceTier: string;
  weight: number;
  minProficiency: string | null;
  targetProficiency: string | null;
  source: string;
  expectedLevel?: number | null;
  rationale?: string | null;
}

export interface RoleDNA {
  input: string;
  resolved: boolean;
  roleCode: string | null;
  ontRoleId: number | null;
  roleTitle: string | null;
  match: RoleMatchConfidence;
  curatedPrecedence: boolean;
  bridgedOntoRoleId: string | null;
  requirements: RoleDNARequirement[];
  competencyCount: number;
  curatedRequirementCount: number;
  inheritedRequirementCount: number;
  requirementSource: 'curated_over_inherited' | 'inherited_only' | 'none';
  benchmark: RoleBenchmark;
  provenance: string;
  version: string;
  generatedAt: string;
}

export async function generateRoleDNA(pool: Pool, input: string): Promise<RoleDNA> {
  const match = await resolveBestOntRole(pool, input);
  const conf = scoreRoleMatch(match);
  const base: RoleDNA = {
    input,
    resolved: !!match,
    roleCode: match?.code ?? null,
    ontRoleId: match?.id ?? null,
    roleTitle: match?.title ?? null,
    match: conf,
    curatedPrecedence: false,
    bridgedOntoRoleId: null,
    requirements: [],
    competencyCount: 0,
    curatedRequirementCount: 0,
    inheritedRequirementCount: 0,
    requirementSource: 'none',
    benchmark: { available: false, source: null, reason: 'unresolved_role' },
    provenance: EXPANSION_PROVENANCE,
    version: ROLE_DNA_EXPANSION_VERSION,
    generatedAt: new Date().toISOString(),
  };
  if (!match) return base;

  const comps = await getRoleCompetencies(pool, match.code);
  const curated = await curatedLayerFor(pool, match.id);
  const benchmark = await generateRoleBenchmark(pool, match.title);

  // Inherited O*NET requirements (ONET_* namespace).
  const inherited: RoleDNARequirement[] = comps.map((c) => ({
    code: c.code,
    name: c.name,
    competencyType: c.competencyType,
    importanceTier: c.importanceTier,
    weight: c.weight,
    minProficiency: c.minProficiency,
    targetProficiency: c.targetProficiency,
    source: c.source,
  }));

  // Curated requirements (comp_* namespace) — only present where the role is bridged
  // into the curated onto_* genome. Disjoint namespace, so they compose ALONGSIDE the
  // inherited set with precedence (listed first + source='curated'), never fabricated.
  const curatedReqs = curated.bridged ? await curatedRequirementsFor(pool, curated.ontoRoleId) : [];
  const requirements = [...curatedReqs, ...inherited];

  return {
    ...base,
    // curatedPrecedence is true ONLY when curated requirements were actually applied,
    // not merely because a bridge row exists (a bridged role with no curated weights
    // still reads inherited_only — no over-claim).
    curatedPrecedence: curatedReqs.length > 0,
    bridgedOntoRoleId: curated.ontoRoleId,
    requirements,
    competencyCount: requirements.length,
    curatedRequirementCount: curatedReqs.length,
    inheritedRequirementCount: inherited.length,
    requirementSource:
      curatedReqs.length > 0
        ? 'curated_over_inherited'
        : inherited.length > 0
          ? 'inherited_only'
          : 'none',
    benchmark,
  };
}

// ---------------------------------------------------------------------------
// 6) Materialization (WRITE path only) + listing + rollback
// ---------------------------------------------------------------------------
let schemaReady = false;
export async function ensureExpansionSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_dna_expansion_snapshots (
      id BIGSERIAL PRIMARY KEY,
      ont_role_id INTEGER,
      role_code TEXT NOT NULL,
      role_title TEXT,
      confidence NUMERIC,
      confidence_band TEXT,
      provisional BOOLEAN DEFAULT false,
      competency_count INTEGER DEFAULT 0,
      curated_precedence BOOLEAN DEFAULT false,
      dna JSONB NOT NULL,
      provenance TEXT NOT NULL DEFAULT '98x_phase1_expansion',
      version TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_rdes_role_code ON role_dna_expansion_snapshots(role_code)',
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_rdes_provenance ON role_dna_expansion_snapshots(provenance)',
  );
  schemaReady = true;
}

export interface MaterializeResult {
  requested: number;
  resolved: number;
  written: number;
  skipped: number;
  provenance: string;
  details: Array<{ input: string; roleCode: string | null; written: boolean; reason?: string }>;
}

export async function materializeRoleDNA(
  pool: Pool,
  opts: { roleCodes?: string[]; limit?: number },
): Promise<MaterializeResult> {
  await ensureExpansionSchema(pool);

  let inputs: string[] = [];
  if (opts.roleCodes && opts.roleCodes.length) {
    inputs = opts.roleCodes.slice(0, 500);
  } else {
    // Default: materialize the highest-competency-coverage roles first, capped so a
    // call never silently bulk-writes the whole library into the shared/prod DB.
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
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

  const details: MaterializeResult['details'] = [];
  let written = 0;
  let resolved = 0;
  let skipped = 0;

  for (const input of inputs) {
    const dna = await generateRoleDNA(pool, input);
    if (!dna.resolved || !dna.roleCode) {
      skipped++;
      details.push({ input, roleCode: null, written: false, reason: 'unresolved' });
      continue;
    }
    resolved++;
    try {
      // Idempotent per role: replace any prior expansion snapshot for the same role.
      await pool.query(
        'DELETE FROM role_dna_expansion_snapshots WHERE provenance = $1 AND role_code = $2',
        [EXPANSION_PROVENANCE, dna.roleCode],
      );
      await pool.query(
        `INSERT INTO role_dna_expansion_snapshots
           (ont_role_id, role_code, role_title, confidence, confidence_band, provisional,
            competency_count, curated_precedence, dna, provenance, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          dna.ontRoleId,
          dna.roleCode,
          dna.roleTitle,
          dna.match.confidence,
          dna.match.band,
          dna.match.provisional,
          dna.competencyCount,
          dna.curatedPrecedence,
          JSON.stringify(dna),
          EXPANSION_PROVENANCE,
          ROLE_DNA_EXPANSION_VERSION,
        ],
      );
      written++;
      details.push({ input, roleCode: dna.roleCode, written: true });
    } catch (err) {
      skipped++;
      details.push({ input, roleCode: dna.roleCode, written: false, reason: (err as Error).message });
    }
  }

  return { requested: inputs.length, resolved, written, skipped, provenance: EXPANSION_PROVENANCE, details };
}

export interface MaterializedSnapshot {
  roleCode: string;
  roleTitle: string | null;
  confidence: number | null;
  confidenceBand: string | null;
  provisional: boolean;
  competencyCount: number;
  curatedPrecedence: boolean;
  createdAt: string | null;
}

export async function listMaterialized(
  pool: Pool,
  limit = 100,
): Promise<{ available: boolean; count: number; rows: MaterializedSnapshot[] }> {
  if (!(await tableExists(pool, 'role_dna_expansion_snapshots'))) {
    return { available: false, count: 0, rows: [] };
  }
  const cap = Math.min(Math.max(limit, 1), 500);
  try {
    const total = await scalarInt(
      pool,
      'SELECT COUNT(*)::int n FROM role_dna_expansion_snapshots WHERE provenance = $1',
      [EXPANSION_PROVENANCE],
    );
    const { rows } = await pool.query(
      `SELECT role_code, role_title, confidence, confidence_band, provisional,
              competency_count, curated_precedence, created_at
         FROM role_dna_expansion_snapshots
        WHERE provenance = $1
        ORDER BY confidence DESC NULLS LAST, competency_count DESC
        LIMIT $2`,
      [EXPANSION_PROVENANCE, cap],
    );
    return {
      available: true,
      count: total ?? rows.length,
      rows: rows.map((r: any) => ({
        roleCode: r.role_code,
        roleTitle: r.role_title ?? null,
        confidence: numOrNull(r.confidence),
        confidenceBand: r.confidence_band ?? null,
        provisional: !!r.provisional,
        competencyCount: Number(r.competency_count) || 0,
        curatedPrecedence: !!r.curated_precedence,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
    };
  } catch {
    return { available: false, count: 0, rows: [] };
  }
}

export async function rollbackExpansion(pool: Pool): Promise<{ deleted: number; tableExisted: boolean }> {
  if (!(await tableExists(pool, 'role_dna_expansion_snapshots'))) {
    return { deleted: 0, tableExisted: false };
  }
  const res = await pool.query(
    'DELETE FROM role_dna_expansion_snapshots WHERE provenance = $1',
    [EXPANSION_PROVENANCE],
  );
  return { deleted: res.rowCount ?? 0, tableExisted: true };
}
