/**
 * Phase 1.5 — Role Competency Profile Engine.
 *
 * ADDITIVE role -> competency requirement layer over the canonical genome. Each
 * row declares, for one EXISTING role (onto_roles) and one EXISTING competency
 * (onto_competencies):
 *
 *   Role  ->  Competency  ->  Required Proficiency Level  ->  Weight  ->  Criticality
 *
 *   Backend Engineer -> Problem-Solving      (Level 4, 25%, critical)
 *                    -> Technical Competence  (Level 4, 30%, critical)
 *                    -> Communication         (Level 3, 10%, important)
 *                    -> ...
 *
 * Three deliverables, all read-only / never-fabricating:
 *   1. Role Competency Profile Engine — CRUD + per-role requirement profile.
 *   2. Role Competency Matrix          — roles x competencies grid.
 *   3. Role Readiness Framework        — weighted gap of actual vs required.
 *
 * Honesty contract (mirrors Phase 1.1/1.2/1.4):
 *   - Strictly additive: NEVER mutates onto_roles / onto_competencies. The
 *     requirement layer lives only in onto_role_competency_profiles. Reversible
 *     (drop the table -> unchanged).
 *   - NEVER fabricates roles or competencies: both ids MUST reference existing
 *     rows; the seed/create skip + honestly report a missing id.
 *   - Weights are NEVER auto-normalised: per-role weight sums that deviate from
 *     100 are surfaced as findings, never silently rescaled.
 *   - Readiness reports Coverage (how much of the weight was assessed) and the
 *     readiness score as SEPARATE axes. With no actual scores it returns the
 *     required structure only — readiness is null, never invented.
 *   - Idempotent seed: only inserts MISSING rows (ON CONFLICT DO NOTHING).
 */

import type { Pool } from 'pg';

export const ROLE_COMPETENCY_PROFILE_VERSION = 'phase-1.5';

export const CRITICALITY_TIERS = ['critical', 'important', 'desirable', 'optional'] as const;
export type Criticality = (typeof CRITICALITY_TIERS)[number];

// Readiness bands (weighted attainment score 0..100). Half-open from the top.
export const READINESS_BANDS = [
  { min: 85, band: 'ready', label: 'Ready' },
  { min: 70, band: 'nearly_ready', label: 'Nearly Ready' },
  { min: 50, band: 'developing', label: 'Developing' },
  { min: 0, band: 'not_ready', label: 'Not Ready' },
] as const;

export function readinessBand(score: number): { band: string; label: string } {
  for (const b of READINESS_BANDS) {
    if (score >= b.min) return { band: b.band, label: b.label };
  }
  return { band: 'not_ready', label: 'Not Ready' };
}

// Role Fit (Phase 2.6) — a fit classification derived from the readiness score.
// Critical (blocking) gaps CAP the fit: a candidate with an unmet critical
// competency can never read as a "Strong Fit" regardless of the overall score.
export interface RoleFit {
  band: 'strong' | 'good' | 'partial' | 'low' | 'unmeasured';
  label: string;
  score: number | null;
  capped_by_critical: boolean;
}

export function roleFit(score: number | null, blockingGaps: number): RoleFit {
  if (score == null) return { band: 'unmeasured', label: 'Unmeasured', score: null, capped_by_critical: false };
  let band: RoleFit['band'] = score >= 85 ? 'strong' : score >= 70 ? 'good' : score >= 50 ? 'partial' : 'low';
  let capped = false;
  if (blockingGaps > 0 && (band === 'strong' || band === 'good')) {
    band = 'partial';
    capped = true;
  }
  const label = band === 'strong' ? 'Strong Fit' : band === 'good' ? 'Good Fit' : band === 'partial' ? 'Partial Fit' : 'Low Fit';
  return { band, label, score, capped_by_critical: capped };
}

export interface RoleCompetencyRow {
  id: number;
  role_id: string;
  role_title: string | null;
  competency_id: string;
  competency_name: string | null;
  competency_deprecated: boolean | null;
  required_level: number;
  required_level_label: string | null;
  weight: number;
  criticality: string;
  rationale: string | null;
  source: string;
  active: boolean;
  updated_at: string | null;
}

export interface RoleProfile {
  role_id: string;
  role_title: string | null;
  role_family: string | null;
  competency_count: number;
  weight_total: number;          // sum of weights (NOT normalised)
  weight_balanced: boolean;      // weight_total within 0.5 of 100
  competencies: RoleCompetencyRow[];
}

// --------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260618_role_competency_profile.sql).
// --------------------------------------------------------------------------

let schemaPromise: Promise<void> | null = null;

export function ensureRoleCompetencyProfileSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_role_competency_profiles (
          id              SERIAL PRIMARY KEY,
          role_id         VARCHAR(120) NOT NULL REFERENCES onto_roles(id)        ON DELETE CASCADE,
          competency_id   VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
          required_level  INT          NOT NULL,
          weight          NUMERIC(6,2) NOT NULL DEFAULT 0,
          criticality     VARCHAR(20)  NOT NULL DEFAULT 'important',
          rationale       TEXT,
          source          VARCHAR(30)  NOT NULL DEFAULT 'default',
          active          BOOLEAN      NOT NULL DEFAULT true,
          created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_rcp_level   CHECK (required_level BETWEEN 1 AND 5),
          CONSTRAINT chk_rcp_weight  CHECK (weight >= 0 AND weight <= 100),
          CONSTRAINT chk_rcp_crit    CHECK (criticality IN ('critical','important','desirable','optional'))
        );
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_rcp_role_comp ON onto_role_competency_profiles (role_id, competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rcp_role   ON onto_role_competency_profiles (role_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rcp_comp   ON onto_role_competency_profiles (competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rcp_source ON onto_role_competency_profiles (source);`);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

// --------------------------------------------------------------------------
// Read views.
// --------------------------------------------------------------------------

const SELECT_ROWS = `
  SELECT rcp.id,
         rcp.role_id,
         r.title          AS role_title,
         r.role_family_id AS role_family,
         rcp.competency_id,
         c.canonical_name AS competency_name,
         c.deprecated     AS competency_deprecated,
         rcp.required_level,
         pl.label         AS required_level_label,
         rcp.weight::float AS weight,
         rcp.criticality,
         rcp.rationale,
         rcp.source,
         rcp.active,
         rcp.updated_at
    FROM onto_role_competency_profiles rcp
    JOIN onto_roles r        ON r.id  = rcp.role_id
    JOIN onto_competencies c ON c.id  = rcp.competency_id
    LEFT JOIN onto_proficiency_levels pl ON pl.level = rcp.required_level
`;

function mapRow(r: any): RoleCompetencyRow {
  return {
    id: r.id,
    role_id: r.role_id,
    role_title: r.role_title,
    competency_id: r.competency_id,
    competency_name: r.competency_name,
    competency_deprecated: r.competency_deprecated,
    required_level: r.required_level,
    required_level_label: r.required_level_label,
    weight: Number(r.weight) || 0,
    criticality: r.criticality,
    rationale: r.rationale,
    source: r.source,
    active: r.active,
    updated_at: r.updated_at,
  };
}

function buildProfiles(rows: RoleCompetencyRow[]): RoleProfile[] {
  const groups = new Map<string, RoleProfile>();
  for (const row of rows) {
    let g = groups.get(row.role_id);
    if (!g) {
      g = {
        role_id: row.role_id,
        role_title: row.role_title,
        role_family: (row as any).role_family ?? null,
        competency_count: 0,
        weight_total: 0,
        weight_balanced: false,
        competencies: [],
      };
      groups.set(row.role_id, g);
    }
    g.competencies.push(row);
    g.competency_count += 1;
    g.weight_total += row.weight;
  }
  for (const g of groups.values()) {
    g.weight_total = Math.round(g.weight_total * 100) / 100;
    g.weight_balanced = Math.abs(g.weight_total - 100) <= 0.5;
  }
  return [...groups.values()];
}

/** Nested role -> competency requirement profiles (the "Role Competency Profile"). */
export async function getRoleProfiles(
  pool: Pool,
  opts: { roleId?: string; search?: string; activeOnly?: boolean } = {},
): Promise<RoleProfile[]> {
  await ensureRoleCompetencyProfileSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.roleId) { params.push(opts.roleId); where.push(`rcp.role_id = $${params.length}`); }
  if (opts.activeOnly) { where.push(`rcp.active = true`); }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(r.title) LIKE $${params.length} OR LOWER(c.canonical_name) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // Order: criticality (critical first), then weight desc, then name.
  const sql = `${SELECT_ROWS} ${whereSql}
    ORDER BY r.title,
             CASE rcp.criticality WHEN 'critical' THEN 0 WHEN 'important' THEN 1 WHEN 'desirable' THEN 2 ELSE 3 END,
             rcp.weight DESC, c.canonical_name`;
  const { rows } = await pool.query(sql, params);
  return buildProfiles((rows as any[]).map(mapRow));
}

export async function getRoleProfile(pool: Pool, roleId: string): Promise<RoleProfile | null> {
  const profiles = await getRoleProfiles(pool, { roleId });
  if (profiles.length > 0) return profiles[0];
  // Role exists but has no requirements yet → return an honest empty profile.
  const r = await pool.query(`SELECT id, title, role_family_id FROM onto_roles WHERE id = $1`, [roleId]);
  if (r.rowCount === 0) return null;
  return {
    role_id: r.rows[0].id,
    role_title: r.rows[0].title,
    role_family: r.rows[0].role_family_id,
    competency_count: 0,
    weight_total: 0,
    weight_balanced: false,
    competencies: [],
  };
}

// --------------------------------------------------------------------------
// Role Competency Matrix — roles x competencies grid.
// --------------------------------------------------------------------------

export interface MatrixCell { required_level: number; weight: number; criticality: string }
export interface MatrixView {
  roles: { role_id: string; role_title: string | null; weight_total: number; weight_balanced: boolean; competency_count: number }[];
  competencies: { competency_id: string; competency_name: string | null }[];
  cells: Record<string, MatrixCell>; // key = `${role_id}::${competency_id}`
}

export async function getRoleCompetencyMatrix(
  pool: Pool,
  opts: { activeOnly?: boolean } = {},
): Promise<MatrixView> {
  await ensureRoleCompetencyProfileSchema(pool);
  const where = opts.activeOnly ? 'WHERE rcp.active = true' : '';
  const { rows } = await pool.query(`${SELECT_ROWS} ${where} ORDER BY r.title, c.canonical_name`, []);
  const mapped = (rows as any[]).map(mapRow);

  const profiles = buildProfiles(mapped);
  const roles = profiles.map((p) => ({
    role_id: p.role_id,
    role_title: p.role_title,
    weight_total: p.weight_total,
    weight_balanced: p.weight_balanced,
    competency_count: p.competency_count,
  }));

  const compMap = new Map<string, string | null>();
  const cells: Record<string, MatrixCell> = {};
  for (const row of mapped) {
    compMap.set(row.competency_id, row.competency_name);
    cells[`${row.role_id}::${row.competency_id}`] = {
      required_level: row.required_level,
      weight: row.weight,
      criticality: row.criticality,
    };
  }
  const competencies = [...compMap.entries()]
    .map(([competency_id, competency_name]) => ({ competency_id, competency_name }))
    .sort((a, b) => (a.competency_name ?? '').localeCompare(b.competency_name ?? ''));

  return { roles, competencies, cells };
}

// --------------------------------------------------------------------------
// Role Readiness Framework — weighted gap of actual vs required.
// Given a map of actual proficiency levels per competency, computes a weighted
// attainment score. Reports Coverage (assessed weight share) and readiness as
// SEPARATE axes; with no actuals, readiness is null (never fabricated).
// --------------------------------------------------------------------------

export interface ReadinessGap {
  competency_id: string;
  competency_name: string | null;
  required_level: number;
  actual_level: number | null;
  weight: number;
  criticality: string;
  attainment: number | null;   // min(actual/required, 1), null if unassessed
  gap: number | null;          // required - actual (>0 = below target), null if unassessed
  blocking: boolean;           // critical competency assessed below required
}

export interface ReadinessResult {
  role_id: string;
  role_title: string | null;
  measured: boolean;                // true only when at least one actual provided
  readiness_score: number | null;   // weighted attainment 0..100 over ASSESSED weight
  readiness_band: string | null;
  readiness_label: string | null;
  coverage_pct: number | null;      // assessed weight / total weight (separate axis)
  weight_total: number;
  weight_assessed: number;
  blocking_gaps: number;            // count of critical competencies below required
  gaps: ReadinessGap[];
  strengths: ReadinessGap[];        // assessed competencies met or exceeded (gap <= 0)
  gap_areas: ReadinessGap[];        // assessed competencies below required (gap > 0)
  critical_gaps: ReadinessGap[];    // blocking gaps (critical & below required)
  role_fit: RoleFit;                // fit classification (capped by critical gaps)
  notes: string[];
}

export async function getRoleReadiness(
  pool: Pool,
  roleId: string,
  actuals: Record<string, number> = {},
): Promise<ReadinessResult | null> {
  const profile = await getRoleProfile(pool, roleId);
  if (!profile) return null;

  const reqs = profile.competencies.filter((c) => c.active);
  const weightTotal = Math.round(reqs.reduce((s, c) => s + c.weight, 0) * 100) / 100;

  let weightAssessed = 0;
  let weightedAttainment = 0;
  let blocking = 0;
  const gaps: ReadinessGap[] = [];

  for (const c of reqs) {
    const rawActual = actuals[c.competency_id];
    const hasActual = Number.isFinite(rawActual);
    const actual = hasActual ? Math.max(0, Math.min(5, Number(rawActual))) : null;
    const attainment = actual != null && c.required_level > 0 ? Math.min(actual / c.required_level, 1) : null;
    const gap = actual != null ? c.required_level - actual : null;
    const isBlocking = c.criticality === 'critical' && gap != null && gap > 0;
    if (isBlocking) blocking += 1;
    if (attainment != null) {
      weightAssessed += c.weight;
      weightedAttainment += c.weight * attainment;
    }
    gaps.push({
      competency_id: c.competency_id,
      competency_name: c.competency_name,
      required_level: c.required_level,
      actual_level: actual,
      weight: c.weight,
      criticality: c.criticality,
      attainment: attainment != null ? Math.round(attainment * 1000) / 10 : null,
      gap,
      blocking: isBlocking,
    });
  }

  const measured = weightAssessed > 0;
  const score = measured ? Math.round((weightedAttainment / weightAssessed) * 1000) / 10 : null;
  const band = score != null ? readinessBand(score) : null;
  const coverage = weightTotal > 0 ? Math.round((weightAssessed / weightTotal) * 1000) / 10 : null;

  const notes: string[] = [];
  if (reqs.length === 0) {
    notes.push('This role has no competency requirements yet — define a profile before measuring readiness.');
  } else if (!measured) {
    notes.push('No actual proficiency scores supplied — showing the required profile only. Readiness is unmeasured (not assumed).');
  } else {
    notes.push(`Readiness ${score}% reflects weighted attainment across the ${Math.round(coverage ?? 0)}% of role weight that has actual scores (Coverage and readiness are separate axes).`);
    if (coverage != null && coverage < 100) notes.push(`${Math.round(100 - coverage)}% of role weight is unassessed — readiness is provisional until those competencies are scored.`);
    if (blocking > 0) notes.push(`${blocking} CRITICAL competenc${blocking === 1 ? 'y is' : 'ies are'} below the required level — these are blocking gaps regardless of the overall score.`);
  }
  if (!profile.weight_balanced && reqs.length > 0) {
    notes.push(`Weights sum to ${weightTotal} (not 100). Readiness uses raw weights as supplied — weights are not auto-normalised.`);
  }

  return {
    role_id: profile.role_id,
    role_title: profile.role_title,
    measured,
    readiness_score: score,
    readiness_band: band?.band ?? null,
    readiness_label: band?.label ?? null,
    coverage_pct: coverage,
    weight_total: weightTotal,
    weight_assessed: Math.round(weightAssessed * 100) / 100,
    blocking_gaps: blocking,
    gaps,
    strengths: gaps.filter((g) => g.gap != null && g.gap <= 0).sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0)),
    gap_areas: gaps.filter((g) => g.gap != null && g.gap > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)),
    critical_gaps: gaps.filter((g) => g.blocking),
    role_fit: roleFit(score, blocking),
    notes,
  };
}

// --------------------------------------------------------------------------
// Admin write — create / update / delete one role-competency requirement.
// Validates that the role AND competency EXIST. Never creates either. Stamps
// source='curated' on admin writes.
// --------------------------------------------------------------------------

export interface CreateRoleCompetencyInput {
  role_id: string;
  competency_id: string;
  required_level: number;
  weight?: number;
  criticality?: string;
  rationale?: string | null;
}

export interface RoleCompetencyWriteResult {
  ok: boolean;
  error?: string;
  row?: RoleCompetencyRow;
}

async function getRowById(pool: Pool, id: number): Promise<RoleCompetencyRow | null> {
  const { rows } = await pool.query(`${SELECT_ROWS} WHERE rcp.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

function validLevel(n: unknown): boolean { return Number.isFinite(n) && Number(n) >= 1 && Number(n) <= 5; }
function validWeight(n: unknown): boolean { return Number.isFinite(n) && Number(n) >= 0 && Number(n) <= 100; }
function validCriticality(s: unknown): s is Criticality { return CRITICALITY_TIERS.includes(s as Criticality); }

export async function createRoleCompetencyProfile(
  pool: Pool,
  input: CreateRoleCompetencyInput,
): Promise<RoleCompetencyWriteResult> {
  await ensureRoleCompetencyProfileSchema(pool);

  const roleId = String(input.role_id ?? '').trim();
  const compId = String(input.competency_id ?? '').trim();
  if (!roleId) return { ok: false, error: 'role_required' };
  if (!compId) return { ok: false, error: 'competency_required' };
  if (!validLevel(input.required_level)) return { ok: false, error: 'invalid_required_level' };

  const weight = input.weight != null ? Number(input.weight) : 0;
  if (!validWeight(weight)) return { ok: false, error: 'invalid_weight' };

  const criticality = (input.criticality ?? 'important').toString().trim();
  if (!validCriticality(criticality)) return { ok: false, error: 'invalid_criticality' };

  const role = await pool.query(`SELECT id FROM onto_roles WHERE id = $1`, [roleId]);
  if (role.rowCount === 0) return { ok: false, error: 'role_not_found' };
  const comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [compId]);
  if (comp.rowCount === 0) return { ok: false, error: 'competency_not_found' };

  const ins = await pool.query(
    `INSERT INTO onto_role_competency_profiles
       (role_id, competency_id, required_level, weight, criticality, rationale, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'curated')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [roleId, compId, Number(input.required_level), weight, criticality, input.rationale ?? null],
  );
  if (ins.rowCount === 0) return { ok: false, error: 'duplicate_requirement' };

  const row = await getRowById(pool, ins.rows[0].id);
  return { ok: true, row: row ?? undefined };
}

export interface UpdateRoleCompetencyInput {
  required_level?: number;
  weight?: number;
  criticality?: string;
  rationale?: string | null;
  active?: boolean;
}

export async function updateRoleCompetencyProfile(
  pool: Pool,
  id: number,
  patch: UpdateRoleCompetencyInput,
): Promise<RoleCompetencyWriteResult> {
  await ensureRoleCompetencyProfileSchema(pool);
  const existing = await getRowById(pool, id);
  if (!existing) return { ok: false, error: 'requirement_not_found' };

  const sets: string[] = [];
  const params: any[] = [];
  if (patch.required_level !== undefined) {
    if (!validLevel(patch.required_level)) return { ok: false, error: 'invalid_required_level' };
    params.push(Number(patch.required_level)); sets.push(`required_level = $${params.length}`);
  }
  if (patch.weight !== undefined) {
    if (!validWeight(patch.weight)) return { ok: false, error: 'invalid_weight' };
    params.push(Number(patch.weight)); sets.push(`weight = $${params.length}`);
  }
  if (patch.criticality !== undefined) {
    if (!validCriticality(patch.criticality)) return { ok: false, error: 'invalid_criticality' };
    params.push(patch.criticality); sets.push(`criticality = $${params.length}`);
  }
  if (patch.rationale !== undefined) {
    params.push(patch.rationale === null ? null : String(patch.rationale)); sets.push(`rationale = $${params.length}`);
  }
  if (patch.active !== undefined) {
    if (typeof patch.active !== 'boolean') return { ok: false, error: 'invalid_active' };
    params.push(patch.active); sets.push(`active = $${params.length}`);
  }
  if (sets.length === 0) return { ok: false, error: 'no_editable_fields' };

  params.push(id);
  await pool.query(
    `UPDATE onto_role_competency_profiles SET ${sets.join(', ')}, source = 'curated', updated_at = now() WHERE id = $${params.length}`,
    params,
  );
  const row = await getRowById(pool, id);
  return { ok: true, row: row ?? undefined };
}

export async function deleteRoleCompetencyProfile(pool: Pool, id: number): Promise<RoleCompetencyWriteResult> {
  await ensureRoleCompetencyProfileSchema(pool);
  const res = await pool.query(`DELETE FROM onto_role_competency_profiles WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { ok: false, error: 'requirement_not_found' };
  return { ok: true };
}

// --------------------------------------------------------------------------
// Seed — example role competency profiles using REAL role + competency ids.
// Weights are curated to sum to 100 per role; the seed verifies every id exists
// and skips (honestly reporting) any missing role/competency.
// --------------------------------------------------------------------------

interface SeedReq { competency_id: string; required_level: number; weight: number; criticality: Criticality }
interface SeedRole { role_id: string; requirements: SeedReq[] }

export const SEED_PROFILES: SeedRole[] = [
  {
    role_id: 'role_be_eng',
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving', required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_decision_quality', required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_collaboration', required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_communication', required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_adaptability', required_level: 2, weight: 5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_sr_be_eng',
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 5, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving', required_level: 5, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_decision_quality', required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_collaboration', required_level: 4, weight: 10, criticality: 'important' },
      { competency_id: 'comp_communication', required_level: 4, weight: 10, criticality: 'important' },
      { competency_id: 'comp_leadership', required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_strategic_planning', required_level: 3, weight: 5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_eng_manager',
    requirements: [
      { competency_id: 'comp_leadership', required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_decision_quality', required_level: 4, weight: 15, criticality: 'critical' },
      { competency_id: 'comp_communication', required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_technical_competence', required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_stakeholder_mgmt', required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_strategic_planning', required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_collaboration', required_level: 3, weight: 10, criticality: 'important' },
    ],
  },
  {
    role_id: 'role_pm',
    requirements: [
      { competency_id: 'comp_stakeholder_mgmt', required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_communication', required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_strategic_planning', required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_decision_quality', required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_analytical_thinking', required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_collaboration', required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_adaptability', required_level: 3, weight: 5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_credit_analyst',
    requirements: [
      { competency_id: 'comp_analytical_thinking', required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_data_driven_decision_making', required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_decision_quality', required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_quality_focus', required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_communication', required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_adaptability', required_level: 2, weight: 10, criticality: 'desirable' },
    ],
  },
];

export interface RoleProfileSeedResult {
  ok: boolean;
  roles_seeded: number;
  requirements_inserted: number;
  skipped: { role: string; competency?: string; reason: string }[];
}

export async function runRoleCompetencyProfileSeed(pool: Pool): Promise<RoleProfileSeedResult> {
  await ensureRoleCompetencyProfileSchema(pool);

  let rolesSeeded = 0;
  let inserted = 0;
  const skipped: { role: string; competency?: string; reason: string }[] = [];

  for (const spec of SEED_PROFILES) {
    const role = await pool.query(`SELECT id FROM onto_roles WHERE id = $1`, [spec.role_id]);
    if (role.rowCount === 0) { skipped.push({ role: spec.role_id, reason: 'role_not_found' }); continue; }
    rolesSeeded += 1;
    for (const req of spec.requirements) {
      const comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [req.competency_id]);
      if (comp.rowCount === 0) { skipped.push({ role: spec.role_id, competency: req.competency_id, reason: 'competency_not_found' }); continue; }
      const ins = await pool.query(
        `INSERT INTO onto_role_competency_profiles
           (role_id, competency_id, required_level, weight, criticality, source)
         VALUES ($1, $2, $3, $4, $5, 'default')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [spec.role_id, req.competency_id, req.required_level, req.weight, req.criticality],
      );
      if (ins.rowCount && ins.rowCount > 0) inserted += 1;
    }
  }

  return { ok: true, roles_seeded: rolesSeeded, requirements_inserted: inserted, skipped };
}

// --------------------------------------------------------------------------
// Admin summary — coverage, weight integrity, criticality mix, honest findings.
// --------------------------------------------------------------------------

export interface RoleProfileSummary {
  generated_at: string;
  version: string;
  roles_total: number | null;          // total roles in onto_roles
  roles_profiled: number;              // roles with >=1 requirement
  role_coverage_pct: number | null;
  requirements_total: number;
  competencies_referenced: number;
  avg_competencies_per_role: number | null;
  criticality_breakdown: { criticality: string; count: number }[];
  source_breakdown: { source: string; count: number }[];
  weight_integrity: { role_id: string; role_title: string | null; weight_total: number; balanced: boolean }[];
  unbalanced_roles: number;
  findings: string[];
}

export async function getRoleCompetencyProfileSummary(pool: Pool): Promise<RoleProfileSummary> {
  await ensureRoleCompetencyProfileSchema(pool);

  const rolesTotalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_roles WHERE deprecated IS NOT TRUE`);
  const rolesTotal = rolesTotalRes.rows[0]?.n ?? null;

  const agg = await pool.query(`
    SELECT COUNT(DISTINCT role_id)::int AS roles_profiled,
           COUNT(*)::int AS reqs,
           COUNT(DISTINCT competency_id)::int AS comps
      FROM onto_role_competency_profiles
     WHERE active = true
  `);
  const a = agg.rows[0] ?? {};
  const rolesProfiled = a.roles_profiled ?? 0;
  const reqs = a.reqs ?? 0;

  const critRes = await pool.query(
    `SELECT criticality, COUNT(*)::int AS n FROM onto_role_competency_profiles WHERE active = true GROUP BY criticality ORDER BY criticality`,
  );
  const sourceRes = await pool.query(
    `SELECT source, COUNT(*)::int AS n FROM onto_role_competency_profiles GROUP BY source ORDER BY source`,
  );
  const weightRes = await pool.query(`
    SELECT rcp.role_id, r.title AS role_title, SUM(rcp.weight)::float AS weight_total
      FROM onto_role_competency_profiles rcp
      JOIN onto_roles r ON r.id = rcp.role_id
     WHERE rcp.active = true
     GROUP BY rcp.role_id, r.title
     ORDER BY r.title
  `);
  const weightIntegrity = weightRes.rows.map((r: any) => {
    const total = Math.round(Number(r.weight_total) * 100) / 100;
    return { role_id: r.role_id, role_title: r.role_title, weight_total: total, balanced: Math.abs(total - 100) <= 0.5 };
  });
  const unbalanced = weightIntegrity.filter((w) => !w.balanced).length;

  const findings: string[] = [];
  if (reqs === 0) {
    findings.push('No role competency profiles yet — run the seed (scripts/seed-role-competency-profile.ts) to load example profiles, then curate via the admin panel.');
  } else {
    findings.push(`${rolesProfiled} role${rolesProfiled === 1 ? '' : 's'} profiled with ${reqs} competency requirements across ${a.comps ?? 0} distinct competencies.`);
    if (unbalanced > 0) {
      findings.push(`${unbalanced} role${unbalanced === 1 ? "'s weights do" : "s' weights do"} not sum to 100: ${weightIntegrity.filter((w) => !w.balanced).map((w) => `${w.role_title} (${w.weight_total})`).join(', ')}. Weights are reported as-is — never auto-normalised.`);
    } else {
      findings.push('All profiled roles have weights summing to 100.');
    }
    findings.push('Every requirement references an EXISTING role and competency; the canonical genome (onto_roles / onto_competencies) is never mutated or fabricated.');
  }

  return {
    generated_at: new Date().toISOString(),
    version: ROLE_COMPETENCY_PROFILE_VERSION,
    roles_total: rolesTotal,
    roles_profiled: rolesProfiled,
    role_coverage_pct: rolesTotal && rolesTotal > 0 ? Math.round((rolesProfiled / rolesTotal) * 1000) / 10 : null,
    requirements_total: reqs,
    competencies_referenced: a.comps ?? 0,
    avg_competencies_per_role: rolesProfiled > 0 ? Math.round((reqs / rolesProfiled) * 10) / 10 : null,
    criticality_breakdown: critRes.rows.map((r: any) => ({ criticality: r.criticality, count: r.n })),
    source_breakdown: sourceRes.rows.map((r: any) => ({ source: r.source, count: r.n })),
    weight_integrity: weightIntegrity,
    unbalanced_roles: unbalanced,
    findings,
  };
}
