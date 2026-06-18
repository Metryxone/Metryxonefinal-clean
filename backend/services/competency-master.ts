/**
 * Phase 1.2 — Competency Master Enhancement.
 *
 * ADDITIVE governance/eligibility extension over the canonical competency genome
 * (onto_competencies). The enhanced competency entity exposes the required
 * fields by COMPOSING existing columns with a new, reversible extension table:
 *
 *   Code                    -> onto_competencies.id            (existing)
 *   Name                    -> onto_competencies.canonical_name (existing)
 *   Competency Type         -> onto_competency_type_map.type_key (Phase 1.1)
 *   Description             -> onto_competencies.definition      (existing)
 *   Status                  -> onto_competency_master_ext.status (NEW)
 *   Assessment Eligible     -> onto_competency_master_ext.assessment_eligible     (NEW)
 *   EI Eligible             -> onto_competency_master_ext.ei_eligible             (NEW)
 *   Career Builder Eligible -> onto_competency_master_ext.career_builder_eligible (NEW)
 *   Employer Eligible       -> onto_competency_master_ext.employer_eligible       (NEW)
 *   Learning Eligible       -> onto_competency_master_ext.learning_eligible       (NEW)
 *   Future Ready Eligible   -> onto_competency_master_ext.future_ready_eligible   (NEW)
 *
 * Honesty contract (mirrors the rest of the Competency Framework Intelligence
 * surface):
 *   - Strictly additive: NEVER mutates onto_competencies. The new fields live in
 *     onto_competency_master_ext only. Reversible (drop the table → unchanged).
 *   - NEVER creates duplicate competencies: the extension is keyed 1:1 on the
 *     existing competency id (PK = competency_id FK). The seed only ever fills
 *     missing rows (ON CONFLICT DO NOTHING) — it cannot add a competency.
 *   - No fabrication of derived facts: Status is DERIVED from the existing
 *     `deprecated` flag (deprecated → 'deprecated', else 'active'). The six
 *     eligibility flags are platform-governance toggles with a transparent
 *     `source='default'` baseline (eligible-unless-restricted) that admins
 *     curate; once edited a row is stamped `source='curated'` and the seed never
 *     overwrites it.
 */

import type { Pool } from 'pg';

export const COMPETENCY_MASTER_VERSION = 'phase-1.2';

/** The six module-eligibility flags (stable order = UI order). */
export const ELIGIBILITY_FLAGS = [
  { key: 'assessment_eligible', label: 'Assessment Eligible' },
  { key: 'ei_eligible', label: 'EI Eligible' },
  { key: 'career_builder_eligible', label: 'Career Builder Eligible' },
  { key: 'employer_eligible', label: 'Employer Eligible' },
  { key: 'learning_eligible', label: 'Learning Eligible' },
  { key: 'future_ready_eligible', label: 'Future Ready Eligible' },
] as const;

export type EligibilityKey = (typeof ELIGIBILITY_FLAGS)[number]['key'];
const ELIGIBILITY_KEYS: EligibilityKey[] = ELIGIBILITY_FLAGS.map((f) => f.key);

export const COMPETENCY_STATUSES = ['active', 'inactive', 'deprecated'] as const;
export type CompetencyStatus = (typeof COMPETENCY_STATUSES)[number];

export interface CompetencyMasterRow {
  competency_id: string;
  code: string;
  name: string;
  description: string | null;
  type_key: string | null;
  type_label: string | null;
  status: CompetencyStatus | null;
  assessment_eligible: boolean | null;
  ei_eligible: boolean | null;
  career_builder_eligible: boolean | null;
  employer_eligible: boolean | null;
  learning_eligible: boolean | null;
  future_ready_eligible: boolean | null;
  source: string | null;
  deprecated: boolean;
  updated_at: string | null;
}

// --------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260618_competency_master_ext.sql).
// Only invoked behind the feature flag (route gate) or by the seed script.
// --------------------------------------------------------------------------

let schemaPromise: Promise<void> | null = null;

export function ensureCompetencyMasterSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_master_ext (
          competency_id           VARCHAR(80) PRIMARY KEY REFERENCES onto_competencies(id) ON DELETE CASCADE,
          status                  VARCHAR(20)  NOT NULL DEFAULT 'active',
          assessment_eligible     BOOLEAN      NOT NULL DEFAULT true,
          ei_eligible             BOOLEAN      NOT NULL DEFAULT true,
          career_builder_eligible BOOLEAN      NOT NULL DEFAULT true,
          employer_eligible       BOOLEAN      NOT NULL DEFAULT true,
          learning_eligible       BOOLEAN      NOT NULL DEFAULT true,
          future_ready_eligible   BOOLEAN      NOT NULL DEFAULT true,
          source                  VARCHAR(30)  NOT NULL DEFAULT 'default',
          created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_onto_competency_master_ext_status ON onto_competency_master_ext(status);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_onto_competency_master_ext_source ON onto_competency_master_ext(source);`);
    })().catch((err) => {
      schemaPromise = null; // allow retry on next call
      throw err;
    });
  }
  return schemaPromise;
}

// --------------------------------------------------------------------------
// Idempotent seed — one extension row per EXISTING competency. Never inserts a
// competency; never overwrites an admin-curated row.
// --------------------------------------------------------------------------

export interface MasterSeedResult {
  ok: boolean;
  error?: string;
  competencies_total: number;
  rows_existing_before: number;
  rows_inserted: number;
  rows_total_after: number;
}

export async function runCompetencyMasterSeed(pool: Pool): Promise<MasterSeedResult> {
  await ensureCompetencyMasterSchema(pool);

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies`);
  const beforeRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_master_ext`);
  const competenciesTotal = totalRes.rows[0]?.n ?? 0;
  const rowsExistingBefore = beforeRes.rows[0]?.n ?? 0;

  // Insert ONLY missing rows. Status DERIVED from the existing deprecated flag.
  // Eligibility flags take the column defaults (eligible baseline, source=default).
  // ON CONFLICT DO NOTHING => admin-curated rows are never touched.
  const ins = await pool.query(
    `INSERT INTO onto_competency_master_ext (competency_id, status, source)
     SELECT id, CASE WHEN deprecated THEN 'deprecated' ELSE 'active' END, 'default'
       FROM onto_competencies
     ON CONFLICT (competency_id) DO NOTHING`,
  );

  const afterRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_master_ext`);

  return {
    ok: true,
    competencies_total: competenciesTotal,
    rows_existing_before: rowsExistingBefore,
    rows_inserted: ins.rowCount ?? 0,
    rows_total_after: afterRes.rows[0]?.n ?? 0,
  };
}

// --------------------------------------------------------------------------
// Read view — the enhanced competency master (joined: code/name/type/desc/
// status/eligibility). LEFT JOIN the extension so a missing row reads as null
// (honest "unknown"), never a fabricated default.
// --------------------------------------------------------------------------

const SELECT_MASTER = `
  SELECT c.id AS competency_id,
         c.id AS code,
         c.canonical_name AS name,
         c.definition AS description,
         tm.type_key,
         t.label AS type_label,
         e.status,
         e.assessment_eligible, e.ei_eligible, e.career_builder_eligible,
         e.employer_eligible, e.learning_eligible, e.future_ready_eligible,
         e.source,
         c.deprecated,
         e.updated_at
    FROM onto_competencies c
    LEFT JOIN onto_competency_type_map tm ON tm.competency_id = c.id
    LEFT JOIN onto_competency_types t ON t.type_key = tm.type_key
    LEFT JOIN onto_competency_master_ext e ON e.competency_id = c.id
`;

export async function getCompetencyMaster(
  pool: Pool,
  opts: { search?: string; typeKey?: string; status?: string; limit?: number } = {},
): Promise<CompetencyMasterRow[]> {
  await ensureCompetencyMasterSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(c.canonical_name) LIKE $${params.length} OR LOWER(c.id) LIKE $${params.length})`);
  }
  if (opts.typeKey) { params.push(opts.typeKey); where.push(`tm.type_key = $${params.length}`); }
  if (opts.status) { params.push(opts.status); where.push(`e.status = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  let sql = `${SELECT_MASTER} ${whereSql} ORDER BY c.canonical_name`;
  if (opts.limit && opts.limit > 0) { params.push(opts.limit); sql += ` LIMIT $${params.length}`; }
  const { rows } = await pool.query(sql, params);
  return rows as CompetencyMasterRow[];
}

export async function getCompetencyMasterById(pool: Pool, competencyId: string): Promise<CompetencyMasterRow | null> {
  await ensureCompetencyMasterSchema(pool);
  const { rows } = await pool.query(`${SELECT_MASTER} WHERE c.id = $1`, [competencyId]);
  return (rows[0] as CompetencyMasterRow) ?? null;
}

// --------------------------------------------------------------------------
// Admin edit — update status + eligibility flags for ONE existing competency.
// Validates the competency exists (never creates one); upserts the extension
// row and stamps source='curated'.
// --------------------------------------------------------------------------

export interface MasterPatch {
  status?: string;
  assessment_eligible?: boolean;
  ei_eligible?: boolean;
  career_builder_eligible?: boolean;
  employer_eligible?: boolean;
  learning_eligible?: boolean;
  future_ready_eligible?: boolean;
}

export interface UpdateResult {
  ok: boolean;
  error?: string;
  row?: CompetencyMasterRow;
}

export async function updateCompetencyMaster(
  pool: Pool,
  competencyId: string,
  patch: MasterPatch,
): Promise<UpdateResult> {
  await ensureCompetencyMasterSchema(pool);

  // 1) The competency MUST already exist — we never create competencies here.
  const exists = await pool.query(`SELECT deprecated FROM onto_competencies WHERE id = $1`, [competencyId]);
  if (exists.rowCount === 0) return { ok: false, error: 'competency_not_found' };

  // 2) Validate the patch.
  const sets: string[] = [];
  const params: any[] = [];
  if (patch.status !== undefined) {
    if (!(COMPETENCY_STATUSES as readonly string[]).includes(patch.status)) {
      return { ok: false, error: 'invalid_status' };
    }
    params.push(patch.status); sets.push(`status = $${params.length}`);
  }
  for (const key of ELIGIBILITY_KEYS) {
    const v = (patch as any)[key];
    if (v !== undefined) {
      if (typeof v !== 'boolean') return { ok: false, error: `invalid_${key}` };
      params.push(v); sets.push(`${key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return { ok: false, error: 'no_editable_fields' };

  // 3) Ensure the extension row exists (status derived from deprecated for new rows),
  //    then apply the patch + stamp curated. ON CONFLICT keeps any prior values.
  await pool.query(
    `INSERT INTO onto_competency_master_ext (competency_id, status, source)
     VALUES ($1, CASE WHEN $2 THEN 'deprecated' ELSE 'active' END, 'default')
     ON CONFLICT (competency_id) DO NOTHING`,
    [competencyId, exists.rows[0].deprecated],
  );
  params.push(competencyId);
  await pool.query(
    `UPDATE onto_competency_master_ext
        SET ${sets.join(', ')}, source = 'curated', updated_at = now()
      WHERE competency_id = $${params.length}`,
    params,
  );

  const row = await getCompetencyMasterById(pool, competencyId);
  return { ok: true, row: row ?? undefined };
}

// --------------------------------------------------------------------------
// Admin summary — coverage, status breakdown, per-module eligibility counts,
// curated-vs-default provenance, honest findings.
// --------------------------------------------------------------------------

export interface MasterSummary {
  generated_at: string;
  version: string;
  competencies_total: number | null;
  enhanced: number;
  coverage_pct: number | null;
  status_breakdown: { status: string; count: number }[];
  eligibility: { key: string; label: string; eligible: number; ineligible: number }[];
  source_breakdown: { source: string; count: number }[];
  fields: { code: string; name: string; competency_type: string; description: string; status: string }[];
  findings: string[];
}

export async function getCompetencyMasterSummary(pool: Pool): Promise<MasterSummary> {
  await ensureCompetencyMasterSchema(pool);

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies`);
  const enhancedRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_master_ext`);
  const competenciesTotal = totalRes.rows[0]?.n ?? null;
  const enhanced = enhancedRes.rows[0]?.n ?? 0;
  const coveragePct = competenciesTotal && competenciesTotal > 0
    ? Math.round((enhanced / competenciesTotal) * 1000) / 10
    : null;

  const statusRes = await pool.query(
    `SELECT status, COUNT(*)::int AS n FROM onto_competency_master_ext GROUP BY status ORDER BY status`,
  );
  const statusBreakdown = statusRes.rows.map((r: any) => ({ status: r.status, count: r.n }));

  const eligibility = [];
  for (const f of ELIGIBILITY_FLAGS) {
    const r = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE ${f.key}) ::int AS yes,
              COUNT(*) FILTER (WHERE NOT ${f.key})::int AS no
         FROM onto_competency_master_ext`,
    );
    eligibility.push({ key: f.key, label: f.label, eligible: r.rows[0]?.yes ?? 0, ineligible: r.rows[0]?.no ?? 0 });
  }

  const sourceRes = await pool.query(
    `SELECT source, COUNT(*)::int AS n FROM onto_competency_master_ext GROUP BY source ORDER BY source`,
  );
  const sourceBreakdown = sourceRes.rows.map((r: any) => ({ source: r.source, count: r.n }));

  const findings: string[] = [];
  if (competenciesTotal != null) {
    findings.push(enhanced === competenciesTotal
      ? `All ${competenciesTotal} competencies are enhanced with Status + eligibility fields — no duplicates created (extension is keyed 1:1 on the existing competency id).`
      : `${enhanced} of ${competenciesTotal} competencies are enhanced — run the master seed to backfill the remaining ${competenciesTotal - enhanced}.`);
  }
  const curated = sourceBreakdown.find((s) => s.source === 'curated')?.count ?? 0;
  findings.push(curated > 0
    ? `${curated} competenc${curated === 1 ? 'y has' : 'ies have'} admin-curated eligibility/status; the rest carry the transparent default baseline (eligible-unless-restricted).`
    : 'No competency has been individually curated yet — every row carries the transparent default baseline (Status derived from deprecated; all modules eligible). Edit any row to override.');

  return {
    generated_at: new Date().toISOString(),
    version: COMPETENCY_MASTER_VERSION,
    competencies_total: competenciesTotal,
    enhanced,
    coverage_pct: coveragePct,
    status_breakdown: statusBreakdown,
    eligibility,
    source_breakdown: sourceBreakdown,
    fields: [
      { code: 'onto_competencies.id', name: 'canonical_name', competency_type: 'onto_competency_type_map.type_key (Phase 1.1)', description: 'definition', status: 'onto_competency_master_ext.status' },
    ],
    findings,
  };
}
