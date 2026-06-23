/**
 * O*NET Crosswalk Governance Engine — MX-100X Phase 2 (additive, flag-gated, reversible).
 *
 * WHAT THIS IS
 * ------------
 * A NEW, isolated engine that turns the EXISTING O*NET crosswalk bridge tables into
 * *governed intelligence*. It COMPOSES already-computed data — it never re-crosswalks,
 * never re-scores, never imports:
 *   - `map_ont_onto_role`        curated role (onto_role_id, TEXT) ↔ O*NET role (ont_role_id, INT)
 *   - `map_ont_onto_competency`  curated competency (onto_*, TEXT) ↔ O*NET competency (ont_*, INT)
 *   - `map_role_competency`      O*NET role → competency requirement set
 *   - `ont_roles` / `ont_role_families` inheritance chain (for unlinked-role closure analysis)
 *
 * into crosswalk governance:
 *   - per-mapping confidence (READ from the stored `confidence` / `match_method` — never a
 *     fabricated number; numeric proxy is a deterministic, transparent band map),
 *   - duplicate detection (a curated entity mapped to >1 O*NET entity, or vice-versa),
 *   - missing-mapping detection (unresolved bridges; roles with no competency links;
 *     competencies with no crosswalk),
 *   - inheritance-closure analysis for unlinked roles (can a sibling supply requirements?),
 *   - a manual approve/reject audit (the ONLY write path).
 *
 * HONESTY CONTRACT
 * ----------------
 * - Coverage (a mapping exists) and Confidence (it is trustworthy) are SEPARATE axes.
 * - O*NET is a REFERENCE layer — never a scoring source.
 * - `ont_*` ids are INTEGER, `onto_*` ids are TEXT — NEVER coerced between them.
 * - There is NO role↔industry linkage in the `ont_*` chain → the industry axis abstains
 *   (`measurable:false`, reason `no_role_industry_linkage`); it is NEVER fabricated.
 * - An unlinked role whose family has zero linked siblings is `genuinely_unmappable` via
 *   inheritance — we report that honestly and NEVER fabricate competency links to close it.
 * - Reads use a `to_regclass` probe + degrade (no DDL on a read path). The lazy ensure-schema
 *   for the audit table runs ONLY on the POST/decision path.
 * - Every decision row carries `provenance = 'mx100x_p2_crosswalk'` so the whole phase is
 *   reversible by deleting that provenance (and restoring the recorded prior verified value).
 */
import type { Pool } from 'pg';

export const ONET_CROSSWALK_GOVERNANCE_VERSION = 'mx100x-p2-1.0.0';
export const CROSSWALK_PROVENANCE = 'mx100x_p2_crosswalk';
export const DECISIONS_TABLE = 'onet_crosswalk_decisions';

// Deterministic, transparent band map for the stored text confidence. This is a *normalization*
// of authored data — NOT a fabricated score. `null` where the stored value carries no confidence.
const CONFIDENCE_NUMERIC: Record<string, number | null> = {
  high: 0.9,
  moderate: 0.7,
  medium: 0.7,
  low: 0.5,
  very_low: 0.3,
  none: null,
  unresolved: null,
  '': null,
};

function bandOfText(confidence: string | null | undefined): string {
  const key = (confidence ?? '').trim().toLowerCase();
  if (key === 'high') return 'high';
  if (key === 'moderate' || key === 'medium') return 'moderate';
  if (key === 'low') return 'low';
  if (key === 'very_low') return 'very_low';
  return 'none';
}
function numericOfText(confidence: string | null | undefined): number | null {
  const key = (confidence ?? '').trim().toLowerCase();
  return key in CONFIDENCE_NUMERIC ? CONFIDENCE_NUMERIC[key] : null;
}
function pct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || d === 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [name]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}
async function colExists(pool: Pool, table: string, column: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
      [table, column],
    );
    return rows.length > 0;
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
export interface BandDistribution {
  high: number;
  moderate: number;
  low: number;
  very_low: number;
  none: number;
}
export interface CrosswalkConfidenceRow {
  id: number;
  entity_ref: string; // human-readable (onto id) — never a coercion of the INT id
  ont_id: number | null;
  ont_code: string | null;
  match_method: string | null;
  confidence: string | null;
  confidence_band: string;
  confidence_numeric: number | null;
  verified: boolean | null;
  decision: string | null; // approved | rejected | null (from the audit table)
}
export interface CrosswalkConfidenceSection {
  table: string;
  total: number;
  resolved: number;
  unresolved: number;
  coverage_pct: number | null; // Coverage axis: resolved / total
  band_distribution: BandDistribution; // Confidence axis (over resolved rows)
  rows: CrosswalkConfidenceRow[];
  note: string;
}

function emptyBands(): BandDistribution {
  return { high: 0, moderate: 0, low: 0, very_low: 0, none: 0 };
}

// ---------------------------------------------------------------------------
// 1) Per-mapping confidence (read-only)
// ---------------------------------------------------------------------------
async function roleBridgeConfidence(pool: Pool): Promise<CrosswalkConfidenceSection> {
  const table = 'map_ont_onto_role';
  const note =
    'Role crosswalk confidence READ from stored match_method/confidence; unresolved bridges (ont_role_id NULL) carry no confidence and are excluded from the band distribution.';
  if (!(await tableExists(pool, table))) {
    return { table, total: 0, resolved: 0, unresolved: 0, coverage_pct: null, band_distribution: emptyBands(), rows: [], note: `${table} absent` };
  }
  const hasDecisions = await tableExists(pool, DECISIONS_TABLE);
  try {
    const decisionJoin = hasDecisions
      ? `LEFT JOIN ${DECISIONS_TABLE} d ON d.entity_type = 'role_bridge' AND d.entity_id = m.id`
      : '';
    const decisionCol = hasDecisions ? 'd.decision' : 'NULL::text';
    const { rows } = await pool.query(
      `SELECT m.id, m.onto_role_id, m.ont_role_id, m.ont_role_code, m.match_method, m.confidence, m.verified,
              ${decisionCol} AS decision
         FROM ${table} m
         ${decisionJoin}
        ORDER BY m.id ASC`,
    );
    const bands = emptyBands();
    const out: CrosswalkConfidenceRow[] = [];
    let resolved = 0;
    for (const r of rows) {
      const ontId = r.ont_role_id == null ? null : Number(r.ont_role_id);
      const isResolved = ontId != null;
      if (isResolved) {
        resolved += 1;
        const band = bandOfText(r.confidence) as keyof BandDistribution;
        bands[band] += 1;
      }
      out.push({
        id: Number(r.id),
        entity_ref: String(r.onto_role_id),
        ont_id: ontId,
        ont_code: r.ont_role_code ?? null,
        match_method: r.match_method ?? null,
        confidence: r.confidence ?? null,
        confidence_band: isResolved ? bandOfText(r.confidence) : 'none',
        confidence_numeric: isResolved ? numericOfText(r.confidence) : null,
        verified: r.verified == null ? null : !!r.verified,
        decision: r.decision ?? null,
      });
    }
    const total = out.length;
    return {
      table,
      total,
      resolved,
      unresolved: total - resolved,
      coverage_pct: pct(resolved, total),
      band_distribution: bands,
      rows: out,
      note,
    };
  } catch (err) {
    return { table, total: 0, resolved: 0, unresolved: 0, coverage_pct: null, band_distribution: emptyBands(), rows: [], note: `${table} read_failed: ${(err as Error).message}` };
  }
}

async function competencyMappingConfidence(pool: Pool): Promise<CrosswalkConfidenceSection> {
  const table = 'map_ont_onto_competency';
  const note =
    'Competency crosswalk confidence READ from stored match_method/confidence. Coverage measures how many curated competencies have an O*NET crosswalk (denominator reported separately).';
  if (!(await tableExists(pool, table))) {
    return { table, total: 0, resolved: 0, unresolved: 0, coverage_pct: null, band_distribution: emptyBands(), rows: [], note: `${table} absent` };
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, ont_competency_id, onto_competency_id, match_method, confidence
         FROM ${table}
        ORDER BY id ASC`,
    );
    const bands = emptyBands();
    const out: CrosswalkConfidenceRow[] = [];
    let resolved = 0;
    for (const r of rows) {
      const ontId = r.ont_competency_id == null ? null : Number(r.ont_competency_id);
      const isResolved = ontId != null;
      if (isResolved) {
        resolved += 1;
        const band = bandOfText(r.confidence) as keyof BandDistribution;
        bands[band] += 1;
      }
      out.push({
        id: Number(r.id),
        entity_ref: String(r.onto_competency_id),
        ont_id: ontId,
        ont_code: null,
        match_method: r.match_method ?? null,
        confidence: r.confidence ?? null,
        confidence_band: isResolved ? bandOfText(r.confidence) : 'none',
        confidence_numeric: isResolved ? numericOfText(r.confidence) : null,
        verified: null,
        decision: null,
      });
    }
    const total = out.length;
    return {
      table,
      total,
      resolved,
      unresolved: total - resolved,
      coverage_pct: pct(resolved, total),
      band_distribution: bands,
      rows: out,
      note,
    };
  } catch (err) {
    return { table, total: 0, resolved: 0, unresolved: 0, coverage_pct: null, band_distribution: emptyBands(), rows: [], note: `${table} read_failed: ${(err as Error).message}` };
  }
}

export interface CrosswalkConfidence {
  roleBridge: CrosswalkConfidenceSection;
  competencyMapping: CrosswalkConfidenceSection;
  industry: { measurable: false; reason: string; note: string; ont_industries_count: number | null };
  version: string;
  generatedAt: string;
}

export async function getCrosswalkConfidence(pool: Pool): Promise<CrosswalkConfidence> {
  const [roleBridge, competencyMapping, ontIndustries] = await Promise.all([
    roleBridgeConfidence(pool),
    competencyMappingConfidence(pool),
    (await tableExists(pool, 'ont_industries'))
      ? scalarNum(pool, 'SELECT COUNT(*)::int n FROM ont_industries')
      : Promise.resolve(null),
  ]);
  return {
    roleBridge,
    competencyMapping,
    industry: {
      measurable: false,
      reason: 'no_role_industry_linkage',
      note: 'O*NET has no role↔industry dimension in the ont_* chain — industry-level crosswalk confidence abstains (never fabricated).',
      ont_industries_count: ontIndustries,
    },
    version: ONET_CROSSWALK_GOVERNANCE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 2) Duplicate detection (read-only)
// ---------------------------------------------------------------------------
export interface DuplicateGroup {
  key: string;
  count: number;
  members: Array<Record<string, unknown>>;
}
export interface DuplicatesReport {
  roleBridge: {
    duplicate_onto_role: DuplicateGroup[]; // one curated role → multiple O*NET roles
    duplicate_ont_role: DuplicateGroup[]; // multiple curated roles → one O*NET role
  };
  competencyMapping: {
    duplicate_onto_competency: DuplicateGroup[];
    duplicate_ont_competency: DuplicateGroup[];
  };
  roleCompetency: {
    duplicate_pairs: DuplicateGroup[]; // (role_id, competency_id) appearing >1 active
  };
  total_duplicate_groups: number;
  version: string;
  generatedAt: string;
}

async function dupGroups(
  pool: Pool,
  table: string,
  keyCol: string,
  selectCols: string,
  activeFilter = '',
): Promise<DuplicateGroup[]> {
  if (!(await tableExists(pool, table))) return [];
  try {
    const andActive = activeFilter ? `AND ${activeFilter}` : '';
    const { rows } = await pool.query(
      `SELECT ${keyCol} AS k, COUNT(*)::int AS c
         FROM ${table}
        WHERE ${keyCol} IS NOT NULL ${andActive}
        GROUP BY ${keyCol} HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC, ${keyCol} ASC`,
    );
    const groups: DuplicateGroup[] = [];
    for (const g of rows) {
      const { rows: members } = await pool.query(
        `SELECT ${selectCols} FROM ${table} WHERE ${keyCol} = $1 ${andActive} ORDER BY id ASC`,
        [g.k],
      );
      groups.push({ key: String(g.k), count: Number(g.c), members });
    }
    return groups;
  } catch {
    return [];
  }
}

export async function getDuplicates(pool: Pool): Promise<DuplicatesReport> {
  const roleHasActive = await colExists(pool, 'map_role_competency', 'is_active');
  const activeFilter = roleHasActive ? 'is_active = true' : '';

  const [dupOntoRole, dupOntRole, dupOntoComp, dupOntComp, dupPairs] = await Promise.all([
    dupGroups(pool, 'map_ont_onto_role', 'onto_role_id', 'id, onto_role_id, ont_role_id, ont_role_code, match_method, confidence'),
    dupGroups(pool, 'map_ont_onto_role', 'ont_role_id', 'id, onto_role_id, ont_role_id, ont_role_code, match_method, confidence'),
    dupGroups(pool, 'map_ont_onto_competency', 'onto_competency_id', 'id, onto_competency_id, ont_competency_id, match_method, confidence'),
    dupGroups(pool, 'map_ont_onto_competency', 'ont_competency_id', 'id, onto_competency_id, ont_competency_id, match_method, confidence'),
    // composite (role_id, competency_id) duplicate — read directly, not via dupGroups (two keys).
    (async (): Promise<DuplicateGroup[]> => {
      if (!(await tableExists(pool, 'map_role_competency'))) return [];
      try {
        const { rows } = await pool.query(
          `SELECT role_id, competency_id, COUNT(*)::int AS c
             FROM map_role_competency
            ${activeFilter ? `WHERE ${activeFilter}` : ''}
            GROUP BY role_id, competency_id HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC LIMIT 200`,
        );
        return rows.map((r: any) => ({
          key: `${r.role_id}:${r.competency_id}`,
          count: Number(r.c),
          members: [{ role_id: Number(r.role_id), competency_id: Number(r.competency_id), occurrences: Number(r.c) }],
        }));
      } catch {
        return [];
      }
    })(),
  ]);

  const total =
    dupOntoRole.length + dupOntRole.length + dupOntoComp.length + dupOntComp.length + dupPairs.length;
  return {
    roleBridge: { duplicate_onto_role: dupOntoRole, duplicate_ont_role: dupOntRole },
    competencyMapping: { duplicate_onto_competency: dupOntoComp, duplicate_ont_competency: dupOntComp },
    roleCompetency: { duplicate_pairs: dupPairs },
    total_duplicate_groups: total,
    version: ONET_CROSSWALK_GOVERNANCE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 3) Missing-mapping detection (read-only)
// ---------------------------------------------------------------------------
export interface MissingReport {
  unresolvedRoleBridges: {
    count: number;
    rows: Array<{ id: number; onto_role_id: string; match_method: string | null; confidence: string | null }>;
    note: string;
  };
  rolesWithoutCompetencies: {
    count: number;
    total_active_roles: number | null;
    sample: Array<{ ont_role_id: number; code: string | null; title: string | null; family_id: number | null; family_name: string | null }>;
    note: string;
  };
  competenciesWithoutCrosswalk: {
    ont_uncrosswalked: number | null;
    ont_total: number | null;
    onto_uncrosswalked: number | null;
    onto_total: number | null;
    note: string;
  };
  version: string;
  generatedAt: string;
}

export async function getMissingMappings(pool: Pool): Promise<MissingReport> {
  const generatedAt = new Date().toISOString();

  // Unresolved role bridges (ont_role_id NULL).
  let unresolved = { count: 0, rows: [] as MissingReport['unresolvedRoleBridges']['rows'], note: '' };
  if (await tableExists(pool, 'map_ont_onto_role')) {
    try {
      const { rows } = await pool.query(
        `SELECT id, onto_role_id, match_method, confidence
           FROM map_ont_onto_role WHERE ont_role_id IS NULL ORDER BY id ASC`,
      );
      unresolved = {
        count: rows.length,
        rows: rows.map((r: any) => ({
          id: Number(r.id),
          onto_role_id: String(r.onto_role_id),
          match_method: r.match_method ?? null,
          confidence: r.confidence ?? null,
        })),
        note: 'Curated roles whose O*NET crosswalk could not be resolved — bridge exists but ont_role_id is NULL.',
      };
    } catch {
      unresolved.note = 'map_ont_onto_role read_failed';
    }
  } else {
    unresolved.note = 'map_ont_onto_role absent';
  }

  // Active ont_roles with no competency links.
  const roleActive = await colExists(pool, 'map_role_competency', 'is_active');
  const linkActive = roleActive ? 'AND m.is_active = true' : '';
  const totalActiveRoles = await scalarNum(pool, 'SELECT COUNT(*)::int n FROM ont_roles WHERE is_active = true');
  let rolesWithout = { count: 0, sample: [] as MissingReport['rolesWithoutCompetencies']['sample'], note: '' };
  try {
    const { rows } = await pool.query(
      `SELECT r.id AS ont_role_id, r.code, r.title, f.id AS family_id, f.name AS family_name
         FROM ont_roles r
         LEFT JOIN ont_role_families f ON f.id = r.role_family_id
        WHERE r.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM map_role_competency m WHERE m.role_id = r.id ${linkActive}
          )
        ORDER BY f.id NULLS LAST, r.id ASC`,
    );
    rolesWithout = {
      count: rows.length,
      sample: rows.slice(0, 50).map((r: any) => ({
        ont_role_id: Number(r.ont_role_id),
        code: r.code ?? null,
        title: r.title ?? null,
        family_id: r.family_id == null ? null : Number(r.family_id),
        family_name: r.family_name ?? null,
      })),
      note: 'Active O*NET roles with zero competency requirement links — see getUnlinkedRoleAnalysis for inheritance-closure verdicts.',
    };
  } catch {
    rolesWithout.note = 'ont_roles / map_role_competency read_failed';
  }

  // Competencies with no crosswalk — report BOTH denominators honestly.
  const ontTotal = await scalarNum(pool, 'SELECT COUNT(*)::int n FROM ont_competencies');
  const ontUncrosswalked = (await tableExists(pool, 'map_ont_onto_competency'))
    ? await scalarNum(
        pool,
        `SELECT COUNT(*)::int n FROM ont_competencies c
          WHERE NOT EXISTS (SELECT 1 FROM map_ont_onto_competency x WHERE x.ont_competency_id = c.id)`,
      )
    : ontTotal;
  const ontoTotal = (await tableExists(pool, 'onto_competencies'))
    ? await scalarNum(pool, 'SELECT COUNT(*)::int n FROM onto_competencies')
    : null;
  const ontoUncrosswalked =
    (await tableExists(pool, 'onto_competencies')) && (await tableExists(pool, 'map_ont_onto_competency'))
      ? await scalarNum(
          pool,
          `SELECT COUNT(*)::int n FROM onto_competencies c
            WHERE NOT EXISTS (SELECT 1 FROM map_ont_onto_competency x WHERE x.onto_competency_id = c.id)`,
        )
      : ontoTotal;

  return {
    unresolvedRoleBridges: unresolved,
    rolesWithoutCompetencies: { count: rolesWithout.count, total_active_roles: totalActiveRoles, sample: rolesWithout.sample, note: rolesWithout.note },
    competenciesWithoutCrosswalk: {
      ont_uncrosswalked: ontUncrosswalked,
      ont_total: ontTotal,
      onto_uncrosswalked: ontoUncrosswalked,
      onto_total: ontoTotal,
      note: 'Coverage of the competency crosswalk on BOTH sides — O*NET (ont_*) and curated (onto_*). High uncrosswalked counts are an honest coverage gap, not a defect.',
    },
    version: ONET_CROSSWALK_GOVERNANCE_VERSION,
    generatedAt,
  };
}

// ---------------------------------------------------------------------------
// 4) Unlinked-role inheritance-closure analysis (read-only)
// ---------------------------------------------------------------------------
export interface UnlinkedRoleVerdict {
  ont_role_id: number;
  code: string | null;
  title: string | null;
  family_id: number | null;
  family_name: string | null;
  family_linked_siblings: number;
  verdict: 'inheritance_closable' | 'genuinely_unmappable';
  rationale: string;
}
export interface UnlinkedRoleAnalysis {
  total_unlinked: number;
  inheritance_closable: number;
  genuinely_unmappable: number;
  roles: UnlinkedRoleVerdict[];
  note: string;
  version: string;
  generatedAt: string;
}

export async function getUnlinkedRoleAnalysis(pool: Pool): Promise<UnlinkedRoleAnalysis> {
  const generatedAt = new Date().toISOString();
  const note =
    'For each unlinked role we run the EXISTING inheritance path: a role can inherit competency requirements only if a sibling in the same family carries links. Zero linked siblings → genuinely_unmappable via inheritance (closing it requires real O*NET/ESCO competency data, never fabricated).';
  const roleActive = await colExists(pool, 'map_role_competency', 'is_active');
  const linkActive = roleActive ? 'AND m.is_active = true' : '';
  try {
    const { rows } = await pool.query(
      `WITH unlinked AS (
         SELECT r.id, r.code, r.title, r.role_family_id
           FROM ont_roles r
          WHERE r.is_active = true
            AND NOT EXISTS (SELECT 1 FROM map_role_competency m WHERE m.role_id = r.id ${linkActive})
       ),
       sib AS (
         SELECT r2.role_family_id AS fid, COUNT(DISTINCT r2.id)::int AS linked_siblings
           FROM ont_roles r2
           JOIN map_role_competency m2 ON m2.role_id = r2.id ${roleActive ? 'AND m2.is_active = true' : ''}
          WHERE r2.is_active = true
          GROUP BY r2.role_family_id
       )
       SELECT u.id, u.code, u.title, u.role_family_id AS family_id, f.name AS family_name,
              COALESCE(s.linked_siblings, 0) AS family_linked_siblings
         FROM unlinked u
         LEFT JOIN ont_role_families f ON f.id = u.role_family_id
         LEFT JOIN sib s ON s.fid = u.role_family_id
        ORDER BY u.role_family_id NULLS LAST, u.id ASC`,
    );
    const roles: UnlinkedRoleVerdict[] = rows.map((r: any) => {
      const siblings = Number(r.family_linked_siblings) || 0;
      const closable = siblings > 0;
      return {
        ont_role_id: Number(r.id),
        code: r.code ?? null,
        title: r.title ?? null,
        family_id: r.family_id == null ? null : Number(r.family_id),
        family_name: r.family_name ?? null,
        family_linked_siblings: siblings,
        verdict: closable ? 'inheritance_closable' : 'genuinely_unmappable',
        rationale: closable
          ? `${siblings} linked sibling(s) in family — requirements can be inherited from the family cohort`
          : 'no linked siblings in family — cannot close via inheritance without fabricating links',
      };
    });
    return {
      total_unlinked: roles.length,
      inheritance_closable: roles.filter((r) => r.verdict === 'inheritance_closable').length,
      genuinely_unmappable: roles.filter((r) => r.verdict === 'genuinely_unmappable').length,
      roles,
      note,
      version: ONET_CROSSWALK_GOVERNANCE_VERSION,
      generatedAt,
    };
  } catch (err) {
    return {
      total_unlinked: 0,
      inheritance_closable: 0,
      genuinely_unmappable: 0,
      roles: [],
      note: `analysis_failed: ${(err as Error).message}`,
      version: ONET_CROSSWALK_GOVERNANCE_VERSION,
      generatedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Governance overview (read-only compose of the above)
// ---------------------------------------------------------------------------
export interface GovernanceOverview {
  confidence: {
    roleBridge: { total: number; resolved: number; unresolved: number; coverage_pct: number | null; band_distribution: BandDistribution };
    competencyMapping: { total: number; resolved: number; coverage_pct: number | null; band_distribution: BandDistribution };
    industry: { measurable: false; reason: string };
  };
  duplicates: { total_duplicate_groups: number };
  missing: { unresolved_role_bridges: number; roles_without_competencies: number; ont_uncrosswalked: number | null };
  unlinked: { total: number; inheritance_closable: number; genuinely_unmappable: number };
  decisions: { recorded: number; approved: number; rejected: number; table_present: boolean };
  version: string;
  generatedAt: string;
}

export async function getGovernanceOverview(pool: Pool): Promise<GovernanceOverview> {
  const [conf, dups, missing, unlinked, decisions] = await Promise.all([
    getCrosswalkConfidence(pool),
    getDuplicates(pool),
    getMissingMappings(pool),
    getUnlinkedRoleAnalysis(pool),
    getDecisionSummary(pool),
  ]);
  return {
    confidence: {
      roleBridge: {
        total: conf.roleBridge.total,
        resolved: conf.roleBridge.resolved,
        unresolved: conf.roleBridge.unresolved,
        coverage_pct: conf.roleBridge.coverage_pct,
        band_distribution: conf.roleBridge.band_distribution,
      },
      competencyMapping: {
        total: conf.competencyMapping.total,
        resolved: conf.competencyMapping.resolved,
        coverage_pct: conf.competencyMapping.coverage_pct,
        band_distribution: conf.competencyMapping.band_distribution,
      },
      industry: { measurable: false, reason: conf.industry.reason },
    },
    duplicates: { total_duplicate_groups: dups.total_duplicate_groups },
    missing: {
      unresolved_role_bridges: missing.unresolvedRoleBridges.count,
      roles_without_competencies: missing.rolesWithoutCompetencies.count,
      ont_uncrosswalked: missing.competenciesWithoutCrosswalk.ont_uncrosswalked,
    },
    unlinked: {
      total: unlinked.total_unlinked,
      inheritance_closable: unlinked.inheritance_closable,
      genuinely_unmappable: unlinked.genuinely_unmappable,
    },
    decisions,
    version: ONET_CROSSWALK_GOVERNANCE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Audit table — schema + write-once decision + list + rollback (WRITE path only)
// ---------------------------------------------------------------------------
export async function ensureCrosswalkGovernanceSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DECISIONS_TABLE} (
      id            BIGSERIAL PRIMARY KEY,
      entity_type   TEXT NOT NULL CHECK (entity_type IN ('role_bridge', 'competency_mapping')),
      entity_id     BIGINT NOT NULL,
      entity_ref    TEXT,
      decision      TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
      rationale     TEXT,
      prior_verified BOOLEAN,
      decided_by    TEXT NOT NULL,
      decided_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      provenance    TEXT NOT NULL DEFAULT '${CROSSWALK_PROVENANCE}',
      CONSTRAINT ${DECISIONS_TABLE}_once UNIQUE (entity_type, entity_id)
    )
  `);
}

export interface DecisionInput {
  entityType: 'role_bridge' | 'competency_mapping';
  entityId: number;
  decision: 'approved' | 'rejected';
  rationale?: string | null;
  decidedBy: string;
}
export interface DecisionResult {
  ok: boolean;
  recorded: boolean;
  reason?: string;
  decision?: Record<string, unknown>;
  verified_set?: boolean | null;
}

export async function recordCrosswalkDecision(pool: Pool, input: DecisionInput): Promise<DecisionResult> {
  await ensureCrosswalkGovernanceSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve the target entity + its current verified state (role_bridge only carries verified).
    let entityRef: string | null = null;
    let priorVerified: boolean | null = null;
    if (input.entityType === 'role_bridge') {
      const { rows } = await client.query(
        `SELECT id, onto_role_id, verified FROM map_ont_onto_role WHERE id = $1 FOR UPDATE`,
        [input.entityId],
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return { ok: false, recorded: false, reason: 'entity_not_found' };
      }
      entityRef = String(rows[0].onto_role_id);
      priorVerified = rows[0].verified == null ? null : !!rows[0].verified;
    } else {
      const { rows } = await client.query(
        `SELECT id, onto_competency_id FROM map_ont_onto_competency WHERE id = $1 FOR UPDATE`,
        [input.entityId],
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return { ok: false, recorded: false, reason: 'entity_not_found' };
      }
      entityRef = String(rows[0].onto_competency_id);
    }

    // Write-once: ON CONFLICT DO NOTHING; rowCount 0 → already decided.
    const ins = await client.query(
      `INSERT INTO ${DECISIONS_TABLE}
         (entity_type, entity_id, entity_ref, decision, rationale, prior_verified, decided_by, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (entity_type, entity_id) DO NOTHING
       RETURNING *`,
      [
        input.entityType,
        input.entityId,
        entityRef,
        input.decision,
        input.rationale ?? null,
        priorVerified,
        input.decidedBy,
        CROSSWALK_PROVENANCE,
      ],
    );
    if (ins.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, recorded: false, reason: 'already_decided' };
    }

    // Apply the side-effect: role_bridge approval/rejection flips verified.
    let verifiedSet: boolean | null = null;
    if (input.entityType === 'role_bridge') {
      verifiedSet = input.decision === 'approved';
      await client.query(`UPDATE map_ont_onto_role SET verified = $1, updated_at = now() WHERE id = $2`, [
        verifiedSet,
        input.entityId,
      ]);
    }

    await client.query('COMMIT');
    return { ok: true, recorded: true, decision: ins.rows[0], verified_set: verifiedSet };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    return { ok: false, recorded: false, reason: (err as Error).message };
  } finally {
    client.release();
  }
}

export async function getDecisionSummary(pool: Pool): Promise<{ recorded: number; approved: number; rejected: number; table_present: boolean }> {
  if (!(await tableExists(pool, DECISIONS_TABLE))) {
    return { recorded: 0, approved: 0, rejected: 0, table_present: false };
  }
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS recorded,
         COUNT(*) FILTER (WHERE decision = 'approved')::int AS approved,
         COUNT(*) FILTER (WHERE decision = 'rejected')::int AS rejected
       FROM ${DECISIONS_TABLE} WHERE provenance = $1`,
      [CROSSWALK_PROVENANCE],
    );
    return {
      recorded: Number(rows[0]?.recorded ?? 0),
      approved: Number(rows[0]?.approved ?? 0),
      rejected: Number(rows[0]?.rejected ?? 0),
      table_present: true,
    };
  } catch {
    return { recorded: 0, approved: 0, rejected: 0, table_present: true };
  }
}

export async function listDecisions(pool: Pool, limit = 200): Promise<{ decisions: Array<Record<string, unknown>>; count: number; table_present: boolean }> {
  if (!(await tableExists(pool, DECISIONS_TABLE))) {
    return { decisions: [], count: 0, table_present: false };
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${DECISIONS_TABLE} WHERE provenance = $1 ORDER BY decided_at DESC, id DESC LIMIT $2`,
      [CROSSWALK_PROVENANCE, Math.min(Math.max(limit, 1), 1000)],
    );
    return { decisions: rows, count: rows.length, table_present: true };
  } catch {
    return { decisions: [], count: 0, table_present: true };
  }
}

export interface RollbackResult {
  ok: boolean;
  table_present: boolean;
  decisions_deleted: number;
  verified_restored: number;
  reason?: string;
}

export async function rollbackCrosswalkGovernance(pool: Pool): Promise<RollbackResult> {
  if (!(await tableExists(pool, DECISIONS_TABLE))) {
    return { ok: true, table_present: false, decisions_deleted: 0, verified_restored: 0 };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Restore prior verified for every role_bridge decision before deleting it.
    const { rows: roleDecisions } = await client.query(
      `SELECT entity_id, prior_verified FROM ${DECISIONS_TABLE}
        WHERE provenance = $1 AND entity_type = 'role_bridge' FOR UPDATE`,
      [CROSSWALK_PROVENANCE],
    );
    let restored = 0;
    for (const d of roleDecisions) {
      await client.query(`UPDATE map_ont_onto_role SET verified = $1, updated_at = now() WHERE id = $2`, [
        d.prior_verified ?? null,
        d.entity_id,
      ]);
      restored += 1;
    }
    const del = await client.query(`DELETE FROM ${DECISIONS_TABLE} WHERE provenance = $1`, [CROSSWALK_PROVENANCE]);
    await client.query('COMMIT');
    return { ok: true, table_present: true, decisions_deleted: del.rowCount ?? 0, verified_restored: restored };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    return { ok: false, table_present: true, decisions_deleted: 0, verified_restored: 0, reason: (err as Error).message };
  } finally {
    client.release();
  }
}
