/**
 * Phase 1.4 — Micro Competency Framework (parent-child structure).
 *
 * ADDITIVE parent-child relationship layer over the canonical competency genome
 * (onto_competencies). A "micro competency" is a granular child skill grouped
 * under a parent competency:
 *
 *   Communication   -> Active Listening · Written Communication · Presentation Skills · ...
 *   Leadership      -> Delegation · Coaching · Mentoring · Team Motivation · ...
 *   Problem-Solving -> Root Cause Analysis · Decision Quality · Structured Thinking · ...
 *
 * Honesty contract (mirrors Phase 1.1/1.2):
 *   - Strictly additive: NEVER mutates onto_competencies. Hierarchy lives only in
 *     onto_competency_hierarchy. Reversible (drop the table → unchanged).
 *   - NEVER fabricates competencies: a child is EITHER a real existing competency
 *     (child_competency_id FK) OR a named micro item (micro_label only). Named-only
 *     children are honestly flagged, never silently promoted into the genome.
 *   - Idempotent seed: only inserts MISSING relationships (ON CONFLICT DO NOTHING);
 *     never overwrites an admin-curated row.
 */

import type { Pool } from 'pg';

export const MICRO_COMPETENCY_VERSION = 'phase-1.4';

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);
}

export interface MicroChildRow {
  id: number;
  parent_competency_id: string;
  child_competency_id: string | null;
  micro_label: string;
  micro_slug: string;
  sort_order: number;
  source: string;
  active: boolean;
  linked: boolean;            // true => backed by a real competency row
  child_name: string | null;  // canonical name of the linked competency (if any)
  child_deprecated: boolean | null;
  updated_at: string | null;
}

export interface MicroParentGroup {
  parent_competency_id: string;
  parent_name: string;
  parent_family: string | null;
  child_count: number;
  children: MicroChildRow[];
}

// --------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260618_micro_competency_framework.sql).
// --------------------------------------------------------------------------

let schemaPromise: Promise<void> | null = null;

export function ensureMicroCompetencySchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_hierarchy (
          id                    SERIAL PRIMARY KEY,
          parent_competency_id  VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
          child_competency_id   VARCHAR(80)           REFERENCES onto_competencies(id) ON DELETE CASCADE,
          micro_label           VARCHAR(160) NOT NULL,
          micro_slug            VARCHAR(180) NOT NULL,
          sort_order            INT          NOT NULL DEFAULT 0,
          source                VARCHAR(30)  NOT NULL DEFAULT 'default',
          active                BOOLEAN      NOT NULL DEFAULT true,
          created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_hier_no_self CHECK (child_competency_id IS DISTINCT FROM parent_competency_id)
        );
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hier_parent_slug ON onto_competency_hierarchy (parent_competency_id, micro_slug);`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hier_parent_child ON onto_competency_hierarchy (parent_competency_id, child_competency_id) WHERE child_competency_id IS NOT NULL;`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_hier_parent ON onto_competency_hierarchy (parent_competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_hier_child ON onto_competency_hierarchy (child_competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_hier_source ON onto_competency_hierarchy (source);`);
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
  SELECT h.id,
         h.parent_competency_id,
         h.child_competency_id,
         h.micro_label,
         h.micro_slug,
         h.sort_order,
         h.source,
         h.active,
         (h.child_competency_id IS NOT NULL) AS linked,
         cc.canonical_name AS child_name,
         cc.deprecated     AS child_deprecated,
         p.canonical_name  AS parent_name,
         p.family_id       AS parent_family,
         h.updated_at
    FROM onto_competency_hierarchy h
    JOIN onto_competencies p  ON p.id  = h.parent_competency_id
    LEFT JOIN onto_competencies cc ON cc.id = h.child_competency_id
`;

/** Nested parent → children framework. */
export async function getMicroFramework(
  pool: Pool,
  opts: { parentId?: string; search?: string; activeOnly?: boolean } = {},
): Promise<MicroParentGroup[]> {
  await ensureMicroCompetencySchema(pool);
  const where: string[] = [];
  const params: any[] = [];
  if (opts.parentId) { params.push(opts.parentId); where.push(`h.parent_competency_id = $${params.length}`); }
  if (opts.activeOnly) { where.push(`h.active = true`); }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(p.canonical_name) LIKE $${params.length} OR LOWER(h.micro_label) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `${SELECT_ROWS} ${whereSql} ORDER BY p.canonical_name, h.sort_order, h.micro_label`;
  const { rows } = await pool.query(sql, params);

  const groups = new Map<string, MicroParentGroup>();
  for (const r of rows as any[]) {
    let g = groups.get(r.parent_competency_id);
    if (!g) {
      g = {
        parent_competency_id: r.parent_competency_id,
        parent_name: r.parent_name,
        parent_family: r.parent_family,
        child_count: 0,
        children: [],
      };
      groups.set(r.parent_competency_id, g);
    }
    g.children.push({
      id: r.id,
      parent_competency_id: r.parent_competency_id,
      child_competency_id: r.child_competency_id,
      micro_label: r.micro_label,
      micro_slug: r.micro_slug,
      sort_order: r.sort_order,
      source: r.source,
      active: r.active,
      linked: r.linked,
      child_name: r.child_name,
      child_deprecated: r.child_deprecated,
      updated_at: r.updated_at,
    });
    g.child_count += 1;
  }
  return [...groups.values()];
}

/** Flat mapping view (one row per parent-child relationship). */
export async function getMicroMapping(pool: Pool): Promise<MicroChildRow[]> {
  await ensureMicroCompetencySchema(pool);
  const { rows } = await pool.query(`${SELECT_ROWS} ORDER BY p.canonical_name, h.sort_order, h.micro_label`);
  return (rows as any[]).map((r) => ({
    id: r.id,
    parent_competency_id: r.parent_competency_id,
    child_competency_id: r.child_competency_id,
    micro_label: r.micro_label,
    micro_slug: r.micro_slug,
    sort_order: r.sort_order,
    source: r.source,
    active: r.active,
    linked: r.linked,
    child_name: r.child_name,
    child_deprecated: r.child_deprecated,
    updated_at: r.updated_at,
  }));
}

// --------------------------------------------------------------------------
// Admin write — create / update / delete one parent-child relationship.
// Validates that the parent (and, when linked, the child) EXIST. Never creates
// a competency. Stamps source='curated' on admin writes.
// --------------------------------------------------------------------------

export interface CreateMicroInput {
  parent_competency_id: string;
  child_competency_id?: string | null;
  micro_label?: string | null;
  sort_order?: number;
}

export interface MicroWriteResult {
  ok: boolean;
  error?: string;
  row?: MicroChildRow;
}

async function getRowById(pool: Pool, id: number): Promise<MicroChildRow | null> {
  const { rows } = await pool.query(`${SELECT_ROWS} WHERE h.id = $1`, [id]);
  const r = rows[0] as any;
  if (!r) return null;
  return {
    id: r.id, parent_competency_id: r.parent_competency_id, child_competency_id: r.child_competency_id,
    micro_label: r.micro_label, micro_slug: r.micro_slug, sort_order: r.sort_order, source: r.source,
    active: r.active, linked: r.linked, child_name: r.child_name, child_deprecated: r.child_deprecated,
    updated_at: r.updated_at,
  };
}

export async function createMicroRelationship(pool: Pool, input: CreateMicroInput): Promise<MicroWriteResult> {
  await ensureMicroCompetencySchema(pool);

  const parentId = String(input.parent_competency_id ?? '').trim();
  if (!parentId) return { ok: false, error: 'parent_required' };

  const parent = await pool.query(`SELECT canonical_name FROM onto_competencies WHERE id = $1`, [parentId]);
  if (parent.rowCount === 0) return { ok: false, error: 'parent_not_found' };

  const childId = input.child_competency_id ? String(input.child_competency_id).trim() : null;
  let label = (input.micro_label ?? '').trim();

  if (childId) {
    if (childId === parentId) return { ok: false, error: 'self_reference' };
    const child = await pool.query(`SELECT canonical_name FROM onto_competencies WHERE id = $1`, [childId]);
    if (child.rowCount === 0) return { ok: false, error: 'child_not_found' };
    // For a linked child the label IS the child's canonical name (kept honest).
    label = child.rows[0].canonical_name;
  } else if (!label) {
    // No competency link AND no label => nothing to create.
    return { ok: false, error: 'child_or_label_required' };
  }

  const slug = slugify(label);
  if (!slug) return { ok: false, error: 'invalid_label' };

  const sortOrder = Number.isFinite(input.sort_order) ? Number(input.sort_order) : 0;

  const ins = await pool.query(
    `INSERT INTO onto_competency_hierarchy
       (parent_competency_id, child_competency_id, micro_label, micro_slug, sort_order, source)
     VALUES ($1, $2, $3, $4, $5, 'curated')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [parentId, childId, label, slug, sortOrder],
  );
  if (ins.rowCount === 0) return { ok: false, error: 'duplicate_relationship' };

  const row = await getRowById(pool, ins.rows[0].id);
  return { ok: true, row: row ?? undefined };
}

export interface UpdateMicroInput {
  active?: boolean;
  sort_order?: number;
  micro_label?: string; // only honoured for named-only (unlinked) children
}

export async function updateMicroRelationship(pool: Pool, id: number, patch: UpdateMicroInput): Promise<MicroWriteResult> {
  await ensureMicroCompetencySchema(pool);
  const existing = await getRowById(pool, id);
  if (!existing) return { ok: false, error: 'relationship_not_found' };

  const sets: string[] = [];
  const params: any[] = [];
  if (patch.active !== undefined) {
    if (typeof patch.active !== 'boolean') return { ok: false, error: 'invalid_active' };
    params.push(patch.active); sets.push(`active = $${params.length}`);
  }
  if (patch.sort_order !== undefined) {
    if (!Number.isFinite(patch.sort_order)) return { ok: false, error: 'invalid_sort_order' };
    params.push(Number(patch.sort_order)); sets.push(`sort_order = $${params.length}`);
  }
  if (patch.micro_label !== undefined) {
    // A linked child's label is owned by the genome — refuse relabel to avoid drift.
    if (existing.linked) return { ok: false, error: 'cannot_relabel_linked_child' };
    const label = String(patch.micro_label).trim();
    const slug = slugify(label);
    if (!slug) return { ok: false, error: 'invalid_label' };
    params.push(label); sets.push(`micro_label = $${params.length}`);
    params.push(slug); sets.push(`micro_slug = $${params.length}`);
  }
  if (sets.length === 0) return { ok: false, error: 'no_editable_fields' };

  params.push(id);
  try {
    await pool.query(
      `UPDATE onto_competency_hierarchy SET ${sets.join(', ')}, source = 'curated', updated_at = now() WHERE id = $${params.length}`,
      params,
    );
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, error: 'duplicate_relationship' };
    throw err;
  }
  const row = await getRowById(pool, id);
  return { ok: true, row: row ?? undefined };
}

export async function deleteMicroRelationship(pool: Pool, id: number): Promise<MicroWriteResult> {
  await ensureMicroCompetencySchema(pool);
  const res = await pool.query(`DELETE FROM onto_competency_hierarchy WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { ok: false, error: 'relationship_not_found' };
  return { ok: true };
}

// --------------------------------------------------------------------------
// Seed — the canonical example framework (Communication / Leadership /
// Problem-Solving). Links existing competencies where they exist; records a
// named-only micro where no competency row exists (honestly flagged).
// --------------------------------------------------------------------------

interface SeedChild { competency_id?: string; label?: string }
interface SeedParent { parent_competency_id: string; children: SeedChild[] }

// Children reference REAL competency ids verified to exist. Where the example
// names a skill that has no competency row, it is seeded as a named-only micro
// (label) and surfaced in the summary as a promotion candidate.
export const SEED_FRAMEWORK: SeedParent[] = [
  {
    parent_competency_id: 'comp_communication',
    children: [
      { competency_id: 'comp_active_listening' },
      { label: 'Verbal Communication' }, // no canonical competency row → named micro
      { competency_id: 'comp_written_communication' },
      { competency_id: 'comp_presentation_skills' },
    ],
  },
  {
    parent_competency_id: 'comp_leadership',
    children: [
      { competency_id: 'comp_delegation' },
      { competency_id: 'comp_coaching' },
      { competency_id: 'comp_mentorship' }, // "Mentoring" maps to the real Mentorship competency
      { competency_id: 'comp_team_motivation' },
    ],
  },
  {
    parent_competency_id: 'comp_problem_solving',
    children: [
      { competency_id: 'comp_root_cause_analysis' },
      { competency_id: 'comp_decision_quality' },
      { competency_id: 'comp_structured_thinking' },
      { competency_id: 'comp_scenario_planning' },
    ],
  },
];

export interface MicroSeedResult {
  ok: boolean;
  parents_seeded: number;
  relationships_inserted: number;
  linked: number;
  named_only: number;
  skipped: { parent: string; child?: string; reason: string }[];
}

export async function runMicroCompetencySeed(pool: Pool): Promise<MicroSeedResult> {
  await ensureMicroCompetencySchema(pool);

  let parentsSeeded = 0;
  let inserted = 0;
  let linked = 0;
  let named = 0;
  const skipped: { parent: string; child?: string; reason: string }[] = [];

  for (const spec of SEED_FRAMEWORK) {
    const parent = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [spec.parent_competency_id]);
    if (parent.rowCount === 0) {
      skipped.push({ parent: spec.parent_competency_id, reason: 'parent_not_found' });
      continue;
    }
    parentsSeeded += 1;
    let order = 0;
    for (const child of spec.children) {
      order += 10;
      let childId: string | null = null;
      let label: string;
      if (child.competency_id) {
        const cc = await pool.query(`SELECT canonical_name FROM onto_competencies WHERE id = $1`, [child.competency_id]);
        if (cc.rowCount === 0) { skipped.push({ parent: spec.parent_competency_id, child: child.competency_id, reason: 'child_not_found' }); continue; }
        childId = child.competency_id;
        label = cc.rows[0].canonical_name;
      } else if (child.label) {
        label = child.label;
      } else {
        skipped.push({ parent: spec.parent_competency_id, reason: 'child_or_label_required' });
        continue;
      }
      const ins = await pool.query(
        `INSERT INTO onto_competency_hierarchy
           (parent_competency_id, child_competency_id, micro_label, micro_slug, sort_order, source)
         VALUES ($1, $2, $3, $4, $5, 'default')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [spec.parent_competency_id, childId, label, slugify(label), order],
      );
      if (ins.rowCount && ins.rowCount > 0) {
        inserted += 1;
        if (childId) linked += 1; else named += 1;
      }
    }
  }

  return { ok: true, parents_seeded: parentsSeeded, relationships_inserted: inserted, linked, named_only: named, skipped };
}

// --------------------------------------------------------------------------
// Admin summary — coverage, linked-vs-named provenance, honest findings.
// --------------------------------------------------------------------------

export interface MicroSummary {
  generated_at: string;
  version: string;
  competencies_total: number | null;
  parents_total: number;
  relationships_total: number;
  linked_children: number;
  named_only_children: number;
  active_children: number;
  parent_coverage_pct: number | null;
  avg_children_per_parent: number | null;
  source_breakdown: { source: string; count: number }[];
  named_only: { parent_name: string; micro_label: string }[];
  findings: string[];
}

export async function getMicroFrameworkSummary(pool: Pool): Promise<MicroSummary> {
  await ensureMicroCompetencySchema(pool);

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies`);
  const competenciesTotal = totalRes.rows[0]?.n ?? null;

  const agg = await pool.query(`
    SELECT COUNT(DISTINCT parent_competency_id)::int AS parents,
           COUNT(*)::int AS rels,
           COUNT(*) FILTER (WHERE child_competency_id IS NOT NULL)::int AS linked,
           COUNT(*) FILTER (WHERE child_competency_id IS NULL)::int AS named,
           COUNT(*) FILTER (WHERE active)::int AS active
      FROM onto_competency_hierarchy
  `);
  const a = agg.rows[0] ?? {};
  const parents = a.parents ?? 0;
  const rels = a.rels ?? 0;

  const sourceRes = await pool.query(
    `SELECT source, COUNT(*)::int AS n FROM onto_competency_hierarchy GROUP BY source ORDER BY source`,
  );
  const sourceBreakdown = sourceRes.rows.map((r: any) => ({ source: r.source, count: r.n }));

  const namedRes = await pool.query(`
    SELECT p.canonical_name AS parent_name, h.micro_label
      FROM onto_competency_hierarchy h
      JOIN onto_competencies p ON p.id = h.parent_competency_id
     WHERE h.child_competency_id IS NULL
     ORDER BY p.canonical_name, h.micro_label
  `);
  const namedOnly = namedRes.rows.map((r: any) => ({ parent_name: r.parent_name, micro_label: r.micro_label }));

  const findings: string[] = [];
  if (rels === 0) {
    findings.push('No micro-competency relationships yet — run the seed (scripts/seed-micro-competency.ts) to load the baseline framework, then curate via the admin panel.');
  } else {
    findings.push(`${parents} parent competenc${parents === 1 ? 'y' : 'ies'} map ${rels} micro-competencies (${a.linked ?? 0} linked to real competencies, ${a.named ?? 0} named-only).`);
    if ((a.named ?? 0) > 0) {
      findings.push(`${a.named} micro-competenc${(a.named === 1) ? 'y is' : 'ies are'} named-only (no canonical competency row yet): ${namedOnly.map((n) => `"${n.micro_label}"`).join(', ')}. These are honest promotion candidates — not auto-added to the genome.`);
    }
    findings.push('Linked children reuse EXISTING competencies (no duplicates created); named-only children are additive labels only — the canonical genome (onto_competencies) is never mutated.');
  }

  return {
    generated_at: new Date().toISOString(),
    version: MICRO_COMPETENCY_VERSION,
    competencies_total: competenciesTotal,
    parents_total: parents,
    relationships_total: rels,
    linked_children: a.linked ?? 0,
    named_only_children: a.named ?? 0,
    active_children: a.active ?? 0,
    parent_coverage_pct: competenciesTotal && competenciesTotal > 0 ? Math.round((parents / competenciesTotal) * 1000) / 10 : null,
    avg_children_per_parent: parents > 0 ? Math.round((rels / parents) * 10) / 10 : null,
    source_breakdown: sourceBreakdown,
    named_only: namedOnly,
    findings,
  };
}
