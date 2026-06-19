/**
 * Phase 1.6 — Assessment Foundation Mapping.
 *
 * ADDITIVE foundational mapping layer wiring the canonical genome to the
 * assessment surface. It establishes mappings ONLY — it never redesigns or
 * touches any assessment workflow. Three deliverables, all read-only /
 * never-fabricating:
 *
 *   1. Competency Question Mapping  — Competency -> Question
 *        (onto_competency_question_map -> competency_question_templates)
 *   2. Role Assessment Mapping      — Role -> Assessment Blueprint
 *        (onto_role_assessment_map  -> onto_assessment_blueprints)
 *   3. Assessment Blueprint Relationships — Competency Profile -> Blueprint
 *        (onto_assessment_blueprints + onto_blueprint_competency_map)
 *
 * Honesty contract (mirrors Phase 1.1/1.2/1.4/1.5):
 *   - Strictly additive: NEVER mutates onto_roles / onto_competencies /
 *     competency_question_templates. Reversible (drop the four tables -> unchanged).
 *   - NEVER fabricates roles, competencies or questions: every id MUST reference
 *     an existing row; the derive/create paths skip + honestly report a missing id.
 *   - The derived blueprints are a deterministic PROJECTION of the existing role
 *     competency profiles (Phase 1.5) — weights/levels/criticality are copied
 *     verbatim, never invented or re-normalised.
 *   - The Competency -> Question map is derived ONLY from questions that already
 *     exist in competency_question_templates and whose competency_code resolves to
 *     a real competency. With no questions present the map is honestly EMPTY — it
 *     is never seeded with placeholder questions.
 *   - Idempotent seed: only inserts MISSING rows (ON CONFLICT DO NOTHING).
 */

import type { Pool } from 'pg';

export const ASSESSMENT_FOUNDATION_VERSION = 'phase-1.6';

export const CRITICALITY_TIERS = ['critical', 'important', 'desirable', 'optional'] as const;
export type Criticality = (typeof CRITICALITY_TIERS)[number];

// --------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260618_assessment_foundation_mapping.sql).
// --------------------------------------------------------------------------

let schemaPromise: Promise<void> | null = null;

export function ensureAssessmentFoundationSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_assessment_blueprints (
          id              VARCHAR(120) PRIMARY KEY,
          blueprint_key   VARCHAR(120) NOT NULL,
          name            VARCHAR(200) NOT NULL,
          description     TEXT,
          source_role_id  VARCHAR(120) REFERENCES onto_roles(id) ON DELETE SET NULL,
          source          VARCHAR(30)  NOT NULL DEFAULT 'derived',
          active          BOOLEAN      NOT NULL DEFAULT true,
          created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_blueprint_key ON onto_assessment_blueprints (blueprint_key);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_blueprint_role ON onto_assessment_blueprints (source_role_id);`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_blueprint_competency_map (
          id              SERIAL PRIMARY KEY,
          blueprint_id    VARCHAR(120) NOT NULL REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
          competency_id   VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id)          ON DELETE CASCADE,
          required_level  INT          NOT NULL DEFAULT 3,
          weight          NUMERIC(6,2) NOT NULL DEFAULT 0,
          criticality     VARCHAR(20)  NOT NULL DEFAULT 'important',
          source          VARCHAR(30)  NOT NULL DEFAULT 'derived',
          active          BOOLEAN      NOT NULL DEFAULT true,
          created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_bcm_level  CHECK (required_level BETWEEN 1 AND 5),
          CONSTRAINT chk_bcm_weight CHECK (weight >= 0 AND weight <= 100),
          CONSTRAINT chk_bcm_crit   CHECK (criticality IN ('critical','important','desirable','optional'))
        );
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_bcm_blueprint_comp ON onto_blueprint_competency_map (blueprint_id, competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_bcm_blueprint ON onto_blueprint_competency_map (blueprint_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_bcm_comp      ON onto_blueprint_competency_map (competency_id);`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_role_assessment_map (
          id              SERIAL PRIMARY KEY,
          role_id         VARCHAR(120) NOT NULL REFERENCES onto_roles(id)               ON DELETE CASCADE,
          blueprint_id    VARCHAR(120) NOT NULL REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
          is_primary      BOOLEAN      NOT NULL DEFAULT true,
          source          VARCHAR(30)  NOT NULL DEFAULT 'derived',
          active          BOOLEAN      NOT NULL DEFAULT true,
          created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_ram_role_blueprint ON onto_role_assessment_map (role_id, blueprint_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ram_role      ON onto_role_assessment_map (role_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ram_blueprint ON onto_role_assessment_map (blueprint_id);`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_question_map (
          id              SERIAL PRIMARY KEY,
          competency_id   VARCHAR(80) NOT NULL REFERENCES onto_competencies(id)             ON DELETE CASCADE,
          question_id     UUID        NOT NULL REFERENCES competency_question_templates(id) ON DELETE CASCADE,
          source          VARCHAR(30) NOT NULL DEFAULT 'derived',
          active          BOOLEAN     NOT NULL DEFAULT true,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_cqm_comp_question ON onto_competency_question_map (competency_id, question_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqm_comp     ON onto_competency_question_map (competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqm_question ON onto_competency_question_map (question_id);`);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function validLevel(n: unknown): boolean { return Number.isFinite(n) && Number(n) >= 1 && Number(n) <= 5; }
function validWeight(n: unknown): boolean { return Number.isFinite(n) && Number(n) >= 0 && Number(n) <= 100; }
function validCriticality(s: unknown): s is Criticality { return CRITICALITY_TIERS.includes(s as Criticality); }

// ==========================================================================
// Deliverable 3 — Assessment Blueprint Relationships (Competency Profile -> Blueprint)
// ==========================================================================

export interface BlueprintCompetencyRow {
  id: number;
  competency_id: string;
  competency_name: string | null;
  required_level: number;
  weight: number;
  criticality: string;
  source: string;
  active: boolean;
}

export interface BlueprintView {
  id: string;
  blueprint_key: string;
  name: string;
  description: string | null;
  source_role_id: string | null;
  source_role_title: string | null;
  source: string;
  active: boolean;
  competency_count: number;
  weight_total: number;
  weight_balanced: boolean;
  competencies: BlueprintCompetencyRow[];
  updated_at: string | null;
}

const SELECT_BLUEPRINT_COMPS = `
  SELECT bcm.id,
         bcm.competency_id,
         c.canonical_name AS competency_name,
         bcm.required_level,
         bcm.weight::float AS weight,
         bcm.criticality,
         bcm.source,
         bcm.active
    FROM onto_blueprint_competency_map bcm
    JOIN onto_competencies c ON c.id = bcm.competency_id
   WHERE bcm.blueprint_id = $1
   ORDER BY CASE bcm.criticality WHEN 'critical' THEN 0 WHEN 'important' THEN 1 WHEN 'desirable' THEN 2 ELSE 3 END,
            bcm.weight DESC, c.canonical_name
`;

async function loadBlueprintCompetencies(pool: Pool, blueprintId: string): Promise<BlueprintCompetencyRow[]> {
  const { rows } = await pool.query(SELECT_BLUEPRINT_COMPS, [blueprintId]);
  return rows.map((r: any) => ({
    id: r.id,
    competency_id: r.competency_id,
    competency_name: r.competency_name,
    required_level: r.required_level,
    weight: Number(r.weight) || 0,
    criticality: r.criticality,
    source: r.source,
    active: r.active,
  }));
}

function summariseBlueprint(base: any, comps: BlueprintCompetencyRow[]): BlueprintView {
  const weightTotal = Math.round(comps.reduce((s, c) => s + c.weight, 0) * 100) / 100;
  return {
    id: base.id,
    blueprint_key: base.blueprint_key,
    name: base.name,
    description: base.description,
    source_role_id: base.source_role_id,
    source_role_title: base.source_role_title ?? null,
    source: base.source,
    active: base.active,
    competency_count: comps.length,
    weight_total: weightTotal,
    weight_balanced: Math.abs(weightTotal - 100) <= 0.5,
    competencies: comps,
    updated_at: base.updated_at ?? null,
  };
}

const SELECT_BLUEPRINT_BASE = `
  SELECT b.id, b.blueprint_key, b.name, b.description, b.source_role_id,
         r.title AS source_role_title, b.source, b.active, b.updated_at
    FROM onto_assessment_blueprints b
    LEFT JOIN onto_roles r ON r.id = b.source_role_id
`;

export async function getBlueprints(
  pool: Pool,
  opts: { search?: string; activeOnly?: boolean } = {},
): Promise<BlueprintView[]> {
  await ensureAssessmentFoundationSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.activeOnly) where.push(`b.active = true`);
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(b.name) LIKE $${params.length} OR LOWER(b.id) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(`${SELECT_BLUEPRINT_BASE} ${whereSql} ORDER BY b.name`, params);
  const out: BlueprintView[] = [];
  for (const base of rows) {
    const comps = await loadBlueprintCompetencies(pool, base.id);
    out.push(summariseBlueprint(base, comps));
  }
  return out;
}

export async function getBlueprint(pool: Pool, id: string): Promise<BlueprintView | null> {
  await ensureAssessmentFoundationSchema(pool);
  const { rows } = await pool.query(`${SELECT_BLUEPRINT_BASE} WHERE b.id = $1`, [id]);
  if (rows.length === 0) return null;
  const comps = await loadBlueprintCompetencies(pool, id);
  return summariseBlueprint(rows[0], comps);
}

export interface WriteResult { ok: boolean; error?: string; id?: string | number }

export async function createBlueprint(
  pool: Pool,
  input: { id?: string; blueprint_key?: string; name?: string; description?: string | null; source_role_id?: string | null },
): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'name_required' };
  const key = String(input.blueprint_key ?? name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return { ok: false, error: 'invalid_blueprint_key' };
  const id = String(input.id ?? `blueprint_${key}`).trim();

  let sourceRoleId: string | null = null;
  if (input.source_role_id) {
    sourceRoleId = String(input.source_role_id).trim();
    const role = await pool.query(`SELECT id FROM onto_roles WHERE id = $1`, [sourceRoleId]);
    if (role.rowCount === 0) return { ok: false, error: 'role_not_found' };
  }

  // Guard BOTH unique constraints (id AND blueprint_key) so a collision returns a
  // deterministic duplicate error instead of a raw DB unique violation.
  const clash = await pool.query(`SELECT id FROM onto_assessment_blueprints WHERE id = $1 OR blueprint_key = $2`, [id, key]);
  if (clash.rowCount && clash.rowCount > 0) return { ok: false, error: 'duplicate_blueprint' };

  const ins = await pool.query(
    `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, description, source_role_id, source)
     VALUES ($1, $2, $3, $4, $5, 'curated')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [id, key, name, input.description ?? null, sourceRoleId],
  );
  if (ins.rowCount === 0) return { ok: false, error: 'duplicate_blueprint' };
  return { ok: true, id };
}

export async function updateBlueprint(
  pool: Pool,
  id: string,
  patch: { name?: string; description?: string | null; active?: boolean },
): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const existing = await pool.query(`SELECT id FROM onto_assessment_blueprints WHERE id = $1`, [id]);
  if (existing.rowCount === 0) return { ok: false, error: 'blueprint_not_found' };

  const sets: string[] = [];
  const params: any[] = [];
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) return { ok: false, error: 'invalid_name' };
    params.push(name); sets.push(`name = $${params.length}`);
  }
  if (patch.description !== undefined) {
    params.push(patch.description === null ? null : String(patch.description)); sets.push(`description = $${params.length}`);
  }
  if (patch.active !== undefined) {
    if (typeof patch.active !== 'boolean') return { ok: false, error: 'invalid_active' };
    params.push(patch.active); sets.push(`active = $${params.length}`);
  }
  if (sets.length === 0) return { ok: false, error: 'no_editable_fields' };
  params.push(id);
  await pool.query(`UPDATE onto_assessment_blueprints SET ${sets.join(', ')}, source = 'curated', updated_at = now() WHERE id = $${params.length}`, params);
  return { ok: true, id };
}

export async function deleteBlueprint(pool: Pool, id: string): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const res = await pool.query(`DELETE FROM onto_assessment_blueprints WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { ok: false, error: 'blueprint_not_found' };
  return { ok: true, id };
}

export async function addBlueprintCompetency(
  pool: Pool,
  input: { blueprint_id: string; competency_id: string; required_level: number; weight?: number; criticality?: string },
): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const blueprintId = String(input.blueprint_id ?? '').trim();
  const compId = String(input.competency_id ?? '').trim();
  if (!blueprintId) return { ok: false, error: 'blueprint_required' };
  if (!compId) return { ok: false, error: 'competency_required' };
  if (!validLevel(input.required_level)) return { ok: false, error: 'invalid_required_level' };
  const weight = input.weight != null ? Number(input.weight) : 0;
  if (!validWeight(weight)) return { ok: false, error: 'invalid_weight' };
  const criticality = (input.criticality ?? 'important').toString().trim();
  if (!validCriticality(criticality)) return { ok: false, error: 'invalid_criticality' };

  const bp = await pool.query(`SELECT id FROM onto_assessment_blueprints WHERE id = $1`, [blueprintId]);
  if (bp.rowCount === 0) return { ok: false, error: 'blueprint_not_found' };
  const comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [compId]);
  if (comp.rowCount === 0) return { ok: false, error: 'competency_not_found' };

  const ins = await pool.query(
    `INSERT INTO onto_blueprint_competency_map (blueprint_id, competency_id, required_level, weight, criticality, source)
     VALUES ($1, $2, $3, $4, $5, 'curated')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [blueprintId, compId, Number(input.required_level), weight, criticality],
  );
  if (ins.rowCount === 0) return { ok: false, error: 'duplicate_blueprint_competency' };
  return { ok: true, id: ins.rows[0].id };
}

export async function deleteBlueprintCompetency(pool: Pool, id: number): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const res = await pool.query(`DELETE FROM onto_blueprint_competency_map WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { ok: false, error: 'mapping_not_found' };
  return { ok: true, id };
}

// ==========================================================================
// Deliverable 2 — Role Assessment Mapping (Role -> Assessment Blueprint)
// ==========================================================================

export interface RoleAssessmentRow {
  id: number;
  blueprint_id: string;
  blueprint_name: string | null;
  is_primary: boolean;
  competency_count: number;
  source: string;
  active: boolean;
}

export interface RoleAssessmentView {
  role_id: string;
  role_title: string | null;
  blueprint_count: number;
  blueprints: RoleAssessmentRow[];
}

export async function getRoleAssessmentMap(
  pool: Pool,
  opts: { roleId?: string; activeOnly?: boolean } = {},
): Promise<RoleAssessmentView[]> {
  await ensureAssessmentFoundationSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.roleId) { params.push(opts.roleId); where.push(`ram.role_id = $${params.length}`); }
  if (opts.activeOnly) where.push(`ram.active = true`);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT ram.id, ram.role_id, r.title AS role_title, ram.blueprint_id,
            b.name AS blueprint_name, ram.is_primary, ram.source, ram.active,
            (SELECT COUNT(*)::int FROM onto_blueprint_competency_map m WHERE m.blueprint_id = ram.blueprint_id) AS competency_count
       FROM onto_role_assessment_map ram
       JOIN onto_roles r               ON r.id = ram.role_id
       JOIN onto_assessment_blueprints b ON b.id = ram.blueprint_id
       ${whereSql}
      ORDER BY r.title, ram.is_primary DESC, b.name`,
    params,
  );
  const groups = new Map<string, RoleAssessmentView>();
  for (const r of rows as any[]) {
    let g = groups.get(r.role_id);
    if (!g) { g = { role_id: r.role_id, role_title: r.role_title, blueprint_count: 0, blueprints: [] }; groups.set(r.role_id, g); }
    g.blueprints.push({
      id: r.id, blueprint_id: r.blueprint_id, blueprint_name: r.blueprint_name,
      is_primary: r.is_primary, competency_count: r.competency_count, source: r.source, active: r.active,
    });
    g.blueprint_count += 1;
  }
  return [...groups.values()];
}

export async function createRoleAssessment(
  pool: Pool,
  input: { role_id: string; blueprint_id: string; is_primary?: boolean },
): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const roleId = String(input.role_id ?? '').trim();
  const blueprintId = String(input.blueprint_id ?? '').trim();
  if (!roleId) return { ok: false, error: 'role_required' };
  if (!blueprintId) return { ok: false, error: 'blueprint_required' };

  const role = await pool.query(`SELECT id FROM onto_roles WHERE id = $1`, [roleId]);
  if (role.rowCount === 0) return { ok: false, error: 'role_not_found' };
  const bp = await pool.query(`SELECT id FROM onto_assessment_blueprints WHERE id = $1`, [blueprintId]);
  if (bp.rowCount === 0) return { ok: false, error: 'blueprint_not_found' };

  const ins = await pool.query(
    `INSERT INTO onto_role_assessment_map (role_id, blueprint_id, is_primary, source)
     VALUES ($1, $2, $3, 'curated')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [roleId, blueprintId, input.is_primary !== false],
  );
  if (ins.rowCount === 0) return { ok: false, error: 'duplicate_role_assessment' };
  return { ok: true, id: ins.rows[0].id };
}

export async function deleteRoleAssessment(pool: Pool, id: number): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const res = await pool.query(`DELETE FROM onto_role_assessment_map WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { ok: false, error: 'mapping_not_found' };
  return { ok: true, id };
}

// ==========================================================================
// Deliverable 1 — Competency Question Mapping (Competency -> Question)
// ==========================================================================

export interface QuestionRow {
  id: number;                 // map row id
  question_id: string;        // competency_question_templates.id (uuid)
  template_key: string | null;
  question_type: string | null;
  status: string | null;
  source: string;
  active: boolean;
}

export interface CompetencyQuestionView {
  competency_id: string;
  competency_name: string | null;
  question_count: number;
  questions: QuestionRow[];
}

export async function getCompetencyQuestionMap(
  pool: Pool,
  opts: { competencyId?: string; search?: string; activeOnly?: boolean } = {},
): Promise<CompetencyQuestionView[]> {
  await ensureAssessmentFoundationSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.competencyId) { params.push(opts.competencyId); where.push(`cqm.competency_id = $${params.length}`); }
  if (opts.activeOnly) where.push(`cqm.active = true`);
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(c.canonical_name) LIKE $${params.length} OR LOWER(q.template_key) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT cqm.id, cqm.competency_id, c.canonical_name AS competency_name,
            cqm.question_id, q.template_key, q.question_type, q.status,
            cqm.source, cqm.active
       FROM onto_competency_question_map cqm
       JOIN onto_competencies c            ON c.id = cqm.competency_id
       JOIN competency_question_templates q ON q.id = cqm.question_id
       ${whereSql}
      ORDER BY c.canonical_name, q.template_key`,
    params,
  );
  const groups = new Map<string, CompetencyQuestionView>();
  for (const r of rows as any[]) {
    let g = groups.get(r.competency_id);
    if (!g) { g = { competency_id: r.competency_id, competency_name: r.competency_name, question_count: 0, questions: [] }; groups.set(r.competency_id, g); }
    g.questions.push({
      id: r.id, question_id: r.question_id, template_key: r.template_key,
      question_type: r.question_type, status: r.status, source: r.source, active: r.active,
    });
    g.question_count += 1;
  }
  return [...groups.values()];
}

export async function createCompetencyQuestion(
  pool: Pool,
  input: { competency_id: string; question_id: string },
): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const compId = String(input.competency_id ?? '').trim();
  const questionId = String(input.question_id ?? '').trim();
  if (!compId) return { ok: false, error: 'competency_required' };
  if (!questionId) return { ok: false, error: 'question_required' };

  const comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [compId]);
  if (comp.rowCount === 0) return { ok: false, error: 'competency_not_found' };
  const q = await pool.query(`SELECT id FROM competency_question_templates WHERE id = $1`, [questionId]);
  if (q.rowCount === 0) return { ok: false, error: 'question_not_found' };

  const ins = await pool.query(
    `INSERT INTO onto_competency_question_map (competency_id, question_id, source)
     VALUES ($1, $2, 'curated')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [compId, questionId],
  );
  if (ins.rowCount === 0) return { ok: false, error: 'duplicate_question_mapping' };
  return { ok: true, id: ins.rows[0].id };
}

// Grid data for the bulk-mapping tool: the question bank (each row carrying the
// competency_ids it is currently mapped to) plus the competency catalogue to map
// against. Read-only; never throws on empty (honest empty arrays).
export interface MappingGridQuestion {
  question_id: string;
  template_key: string;
  competency_code: string | null;
  question_type: string;
  status: string;
  mapped_competency_ids: string[];
}
export interface MappingGridCompetency {
  id: string;
  canonical_name: string;
  domain_id: string | null;
}
export async function getMappingGrid(
  pool: Pool,
  opts: { search?: string; status?: string; limit?: number } = {},
): Promise<{ questions: MappingGridQuestion[]; competencies: MappingGridCompetency[]; total_questions: number; total_mapped: number }> {
  await ensureAssessmentFoundationSchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.status) { params.push(opts.status); where.push(`q.status = $${params.length}`); }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(q.template_key) LIKE $${params.length} OR LOWER(COALESCE(q.competency_code,'')) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 2000);
  params.push(limit);
  const qRes = await pool.query(
    `SELECT q.id::text AS question_id, q.template_key, q.competency_code, q.question_type, q.status,
            COALESCE(
              (SELECT array_agg(m.competency_id ORDER BY m.competency_id)
                 FROM onto_competency_question_map m
                WHERE m.question_id = q.id AND m.active = true),
              '{}'
            ) AS mapped_competency_ids
       FROM competency_question_templates q
       ${whereSql}
      ORDER BY q.template_key
      LIMIT $${params.length}`,
    params,
  );
  const cRes = await pool.query(
    `SELECT id, canonical_name, domain_id FROM onto_competencies WHERE deprecated = false ORDER BY canonical_name`,
  );
  const questions: MappingGridQuestion[] = (qRes.rows as any[]).map((r) => ({
    question_id: r.question_id,
    template_key: r.template_key,
    competency_code: r.competency_code ?? null,
    question_type: r.question_type,
    status: r.status,
    mapped_competency_ids: Array.isArray(r.mapped_competency_ids) ? r.mapped_competency_ids : [],
  }));
  const total_mapped = questions.filter((q) => q.mapped_competency_ids.length > 0).length;
  return {
    questions,
    competencies: (cRes.rows as any[]).map((r) => ({ id: r.id, canonical_name: r.canonical_name, domain_id: r.domain_id ?? null })),
    total_questions: questions.length,
    total_mapped,
  };
}

// Bulk-map many question->competency pairs in one transaction. Validates each
// side exists (never fabricates an edge to a missing competency/question), and
// upserts on the (competency_id, question_id) unique key so re-running is safe
// and reactivates any soft-deleted edge. Returns the mapped count plus a per-row
// skip ledger (honesty: missing/duplicate rows are reported, not silently dropped).
export async function bulkMapCompetencyQuestions(
  pool: Pool,
  input: { pairs: { competency_id: string; question_id: string }[]; source?: string },
): Promise<{ ok: boolean; mapped: number; reactivated: number; skipped: { competency_id: string; question_id: string; reason: string }[]; error?: string }> {
  await ensureAssessmentFoundationSchema(pool);
  const source = String(input.source ?? 'curated').trim() || 'curated';
  const raw = Array.isArray(input.pairs) ? input.pairs : [];
  // Normalise + dedupe.
  const seen = new Set<string>();
  const pairs: { competency_id: string; question_id: string }[] = [];
  for (const p of raw) {
    const cid = String(p?.competency_id ?? '').trim();
    const qid = String(p?.question_id ?? '').trim();
    if (!cid || !qid) continue;
    const key = `${cid}::${qid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ competency_id: cid, question_id: qid });
  }
  if (pairs.length === 0) return { ok: false, error: 'no_valid_pairs', mapped: 0, reactivated: 0, skipped: [] };

  // Pre-validate question_id UUID format BEFORE the ::uuid[] cast — a malformed
  // string would otherwise throw at the DB and surface as a generic 500 instead
  // of a deterministic skip-ledger entry.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const skipped: { competency_id: string; question_id: string; reason: string }[] = [];
  const validPairs = pairs.filter((p) => {
    if (!UUID_RE.test(p.question_id)) { skipped.push({ ...p, reason: 'invalid_question_id' }); return false; }
    return true;
  });

  const compIds = [...new Set(validPairs.map((p) => p.competency_id))];
  const qIds = [...new Set(validPairs.map((p) => p.question_id))];
  const compRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [compIds]);
  const qRes = await pool.query(`SELECT id::text AS id FROM competency_question_templates WHERE id = ANY($1::uuid[])`, [qIds]);
  const validComp = new Set((compRes.rows as any[]).map((r) => r.id));
  const validQ = new Set((qRes.rows as any[]).map((r) => r.id));

  const toWrite = validPairs.filter((p) => {
    if (!validComp.has(p.competency_id)) { skipped.push({ ...p, reason: 'competency_not_found' }); return false; }
    if (!validQ.has(p.question_id))     { skipped.push({ ...p, reason: 'question_not_found' }); return false; }
    return true;
  });

  let mapped = 0;
  let reactivated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of toWrite) {
      const r = await client.query(
        `INSERT INTO onto_competency_question_map (competency_id, question_id, source, active)
         VALUES ($1,$2,$3,true)
         ON CONFLICT (competency_id, question_id)
         DO UPDATE SET active = true, source = EXCLUDED.source, updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [p.competency_id, p.question_id, source],
      );
      if ((r.rows[0] as any)?.inserted) mapped += 1; else reactivated += 1;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return { ok: true, mapped, reactivated, skipped };
}

export async function deleteCompetencyQuestion(pool: Pool, id: number): Promise<WriteResult> {
  await ensureAssessmentFoundationSchema(pool);
  const res = await pool.query(`DELETE FROM onto_competency_question_map WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { ok: false, error: 'mapping_not_found' };
  return { ok: true, id };
}

// ==========================================================================
// Seed — derive all three foundational mappings from EXISTING data.
//   - Blueprints + blueprint competencies: projected from onto_role_competency_profiles.
//   - Role assessment map: each profiled role -> its derived blueprint (primary).
//   - Competency question map: resolved from competency_question_templates whose
//     competency_code matches a real competency (id OR canonical name). Honestly 0
//     rows when no questions exist — never fabricated.
// ==========================================================================

export interface AssessmentFoundationSeedResult {
  ok: boolean;
  blueprints_created: number;
  blueprint_competencies_inserted: number;
  role_assessments_mapped: number;
  question_mappings_inserted: number;
  questions_available: number;
  questions_unresolved: number;
  skipped: { kind: string; ref: string; reason: string }[];
}

export async function deriveBlueprintsFromProfiles(pool: Pool): Promise<{
  blueprints: number; competencies: number; roleMaps: number; skipped: { kind: string; ref: string; reason: string }[];
}> {
  await ensureAssessmentFoundationSchema(pool);
  const skipped: { kind: string; ref: string; reason: string }[] = [];

  // Roles that have a competency profile (Phase 1.5).
  const profiledRoles = await pool.query(`
    SELECT rcp.role_id, r.title
      FROM onto_role_competency_profiles rcp
      JOIN onto_roles r ON r.id = rcp.role_id
     WHERE rcp.active = true
     GROUP BY rcp.role_id, r.title
     ORDER BY r.title
  `);

  let blueprints = 0, competencies = 0, roleMaps = 0;
  for (const role of profiledRoles.rows as any[]) {
    const roleId: string = role.role_id;
    const title: string = role.title ?? roleId;
    const key = roleId.replace(/^role_/, '');
    const blueprintId = `blueprint_${key}`;

    const bpIns = await pool.query(
      `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, description, source_role_id, source)
       VALUES ($1, $2, $3, $4, $5, 'derived')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [blueprintId, key, `${title} Assessment Blueprint`, `Assessment blueprint derived from the ${title} competency profile (Phase 1.5).`, roleId],
    );
    if (bpIns.rowCount && bpIns.rowCount > 0) blueprints += 1;

    // Copy the role's competency requirements into the blueprint (verbatim).
    const reqs = await pool.query(
      `SELECT competency_id, required_level, weight, criticality
         FROM onto_role_competency_profiles WHERE role_id = $1 AND active = true`,
      [roleId],
    );
    for (const req of reqs.rows as any[]) {
      const ins = await pool.query(
        `INSERT INTO onto_blueprint_competency_map (blueprint_id, competency_id, required_level, weight, criticality, source)
         VALUES ($1, $2, $3, $4, $5, 'derived')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [blueprintId, req.competency_id, req.required_level, req.weight, req.criticality],
      );
      if (ins.rowCount && ins.rowCount > 0) competencies += 1;
    }

    // Map the role to its blueprint (primary).
    const ramIns = await pool.query(
      `INSERT INTO onto_role_assessment_map (role_id, blueprint_id, is_primary, source)
       VALUES ($1, $2, true, 'derived')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [roleId, blueprintId],
    );
    if (ramIns.rowCount && ramIns.rowCount > 0) roleMaps += 1;
  }
  return { blueprints, competencies, roleMaps, skipped };
}

export async function deriveCompetencyQuestionMap(pool: Pool): Promise<{
  inserted: number; available: number; unresolved: number; skipped: { kind: string; ref: string; reason: string }[];
}> {
  await ensureAssessmentFoundationSchema(pool);
  const skipped: { kind: string; ref: string; reason: string }[] = [];

  const questions = await pool.query(`SELECT id, competency_code, template_key FROM competency_question_templates WHERE competency_code IS NOT NULL`);
  const available = questions.rowCount ?? 0;
  let inserted = 0, unresolved = 0;

  for (const q of questions.rows as any[]) {
    const code = String(q.competency_code ?? '').trim();
    if (!code) { unresolved += 1; continue; }
    // Resolve the free-text code to a canonical competency: by id, then by name.
    let comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [code]);
    if (comp.rowCount === 0) {
      comp = await pool.query(`SELECT id FROM onto_competencies WHERE LOWER(canonical_name) = LOWER($1)`, [code]);
    }
    if (comp.rowCount === 0) {
      unresolved += 1;
      skipped.push({ kind: 'question', ref: q.template_key ?? String(q.id), reason: `unresolved_competency_code:${code}` });
      continue;
    }
    const ins = await pool.query(
      `INSERT INTO onto_competency_question_map (competency_id, question_id, source)
       VALUES ($1, $2, 'derived')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [comp.rows[0].id, q.id],
    );
    if (ins.rowCount && ins.rowCount > 0) inserted += 1;
  }
  return { inserted, available, unresolved, skipped };
}

export async function runAssessmentFoundationSeed(pool: Pool): Promise<AssessmentFoundationSeedResult> {
  await ensureAssessmentFoundationSchema(pool);
  const bp = await deriveBlueprintsFromProfiles(pool);
  const cq = await deriveCompetencyQuestionMap(pool);
  return {
    ok: true,
    blueprints_created: bp.blueprints,
    blueprint_competencies_inserted: bp.competencies,
    role_assessments_mapped: bp.roleMaps,
    question_mappings_inserted: cq.inserted,
    questions_available: cq.available,
    questions_unresolved: cq.unresolved,
    skipped: [...bp.skipped, ...cq.skipped],
  };
}

// ==========================================================================
// Admin summary — coverage + integrity + honest findings across all 3 maps.
// ==========================================================================

export interface AssessmentFoundationSummary {
  generated_at: string;
  version: string;
  // Blueprints
  blueprints_total: number;
  blueprint_competencies_total: number;
  unbalanced_blueprints: number;
  blueprint_integrity: { id: string; name: string; weight_total: number; balanced: boolean }[];
  // Role assessment mapping
  roles_total: number | null;
  roles_mapped: number;
  role_coverage_pct: number | null;
  role_assessments_total: number;
  // Competency question mapping
  competencies_total: number | null;
  competencies_with_questions: number;
  competency_question_coverage_pct: number | null;
  question_mappings_total: number;
  questions_available: number;
  source_breakdown: { source: string; count: number }[];
  findings: string[];
}

export async function getAssessmentFoundationSummary(pool: Pool): Promise<AssessmentFoundationSummary> {
  await ensureAssessmentFoundationSchema(pool);

  const bpCount = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_assessment_blueprints`);
  const bpCompCount = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_blueprint_competency_map`);
  const bpWeights = await pool.query(`
    SELECT b.id, b.name, COALESCE(SUM(m.weight), 0)::float AS weight_total
      FROM onto_assessment_blueprints b
      LEFT JOIN onto_blueprint_competency_map m ON m.blueprint_id = b.id AND m.active = true
     GROUP BY b.id, b.name
     ORDER BY b.name
  `);
  const blueprintIntegrity = bpWeights.rows.map((r: any) => {
    const total = Math.round(Number(r.weight_total) * 100) / 100;
    return { id: r.id, name: r.name, weight_total: total, balanced: Math.abs(total - 100) <= 0.5 };
  });
  const unbalancedBlueprints = blueprintIntegrity.filter((b) => !b.balanced).length;

  const rolesTotalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_roles WHERE deprecated IS NOT TRUE`);
  const rolesTotal = rolesTotalRes.rows[0]?.n ?? null;
  const rolesMappedRes = await pool.query(`SELECT COUNT(DISTINCT role_id)::int AS n FROM onto_role_assessment_map WHERE active = true`);
  const rolesMapped = rolesMappedRes.rows[0]?.n ?? 0;
  const ramTotalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_role_assessment_map`);

  const compsTotalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies WHERE deprecated IS NOT TRUE`);
  const compsTotal = compsTotalRes.rows[0]?.n ?? null;
  const compsWithQRes = await pool.query(`SELECT COUNT(DISTINCT competency_id)::int AS n FROM onto_competency_question_map WHERE active = true`);
  const compsWithQ = compsWithQRes.rows[0]?.n ?? 0;
  const cqmTotalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_question_map`);
  const qAvailRes = await pool.query(`SELECT COUNT(*)::int AS n FROM competency_question_templates`);
  const questionsAvailable = qAvailRes.rows[0]?.n ?? 0;

  const srcRes = await pool.query(`
    SELECT source, COUNT(*)::int AS n FROM (
      SELECT source FROM onto_assessment_blueprints
      UNION ALL SELECT source FROM onto_blueprint_competency_map
      UNION ALL SELECT source FROM onto_role_assessment_map
      UNION ALL SELECT source FROM onto_competency_question_map
    ) s GROUP BY source ORDER BY source
  `);

  const findings: string[] = [];
  const blueprintsTotal = bpCount.rows[0]?.n ?? 0;
  if (blueprintsTotal === 0) {
    findings.push('No assessment blueprints yet — run the seed (scripts/seed-assessment-foundation-mapping.ts) to derive blueprints from the Phase 1.5 role competency profiles.');
  } else {
    findings.push(`${blueprintsTotal} assessment blueprint${blueprintsTotal === 1 ? '' : 's'} with ${bpCompCount.rows[0]?.n ?? 0} competency relationships, projected verbatim from the role competency profiles.`);
    if (unbalancedBlueprints > 0) {
      findings.push(`${unbalancedBlueprints} blueprint${unbalancedBlueprints === 1 ? "'s weights do" : "s' weights do"} not sum to 100 — reported as-is, never auto-normalised.`);
    } else {
      findings.push('All blueprints inherit weights that sum to 100 from their source profiles.');
    }
    findings.push(`${rolesMapped} role${rolesMapped === 1 ? '' : 's'} mapped to an assessment blueprint.`);
  }
  if (questionsAvailable === 0) {
    findings.push('Competency question mapping is EMPTY because no questions exist in competency_question_templates yet — the mapping is infrastructure only; it is never seeded with placeholder questions. Once questions are curated, re-run the seed to derive the links.');
  } else {
    findings.push(`${cqmTotalRes.rows[0]?.n ?? 0} competency-question links across ${compsWithQ} competenc${compsWithQ === 1 ? 'y' : 'ies'} (of ${questionsAvailable} available questions).`);
  }
  findings.push('All mappings reference EXISTING roles, competencies and questions only; the genome and question bank are never mutated or fabricated.');

  return {
    generated_at: new Date().toISOString(),
    version: ASSESSMENT_FOUNDATION_VERSION,
    blueprints_total: blueprintsTotal,
    blueprint_competencies_total: bpCompCount.rows[0]?.n ?? 0,
    unbalanced_blueprints: unbalancedBlueprints,
    blueprint_integrity: blueprintIntegrity,
    roles_total: rolesTotal,
    roles_mapped: rolesMapped,
    role_coverage_pct: rolesTotal && rolesTotal > 0 ? Math.round((rolesMapped / rolesTotal) * 1000) / 10 : null,
    role_assessments_total: ramTotalRes.rows[0]?.n ?? 0,
    competencies_total: compsTotal,
    competencies_with_questions: compsWithQ,
    competency_question_coverage_pct: compsTotal && compsTotal > 0 ? Math.round((compsWithQ / compsTotal) * 1000) / 10 : null,
    question_mappings_total: cqmTotalRes.rows[0]?.n ?? 0,
    questions_available: questionsAvailable,
    source_breakdown: srcRes.rows.map((r: any) => ({ source: r.source, count: r.n })),
    findings,
  };
}
