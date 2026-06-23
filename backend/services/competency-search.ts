// Phase 1.7 — Search & Discovery (competency intelligence)
//
// Additive, read-mostly discovery surface over the EXISTING competency genome.
// It introduces NO new tables: every read composes the already-seeded onto_*
// ontology (competencies, types, the role taxonomy, micro-competencies). The only
// write path is a bulk type assignment that upserts the EXISTING
// onto_competency_type_map (provenance-stamped + needs_review) — nothing is
// fabricated and the genome rows themselves are never mutated.
//
// Taxonomy bridge: competency ↔ role is onto_role_competency_profiles; a role
// rolls up role_family → subfunction (department) → function → industry, which is
// how the Role / Department / Function / Industry filters are resolved WITHOUT
// inventing any link that does not already exist in the data.

import type { Pool } from 'pg';

export interface CompetencySearchOpts {
  q?: string;
  typeKey?: string;
  domainId?: string;
  familyId?: string;
  industryId?: string;
  functionId?: string;
  departmentId?: string; // onto_subfunctions.id
  roleId?: string;
  microTerm?: string;
  hasMicro?: boolean;
  trainability?: string;
  stabilityLevel?: string;
  complexityLevel?: string;
  includeDeprecated?: boolean;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
  // Task #51 — when true, the role/department/function/industry filters resolve
  // through the O*NET (ont_) hierarchy + competency crosswalk instead of the
  // curated onto_ role taxonomy. Flag-gated (ontologyHierarchyV2); OFF = identical
  // to legacy. The competency catalog displayed is ALWAYS onto_competencies.
  useOnet?: boolean;
}

export interface CompetencyResult {
  id: string;
  canonical_name: string;
  slug: string | null;
  definition: string | null;
  domain_id: string | null;
  domain_name: string | null;
  family_id: string | null;
  family_name: string | null;
  type_key: string | null;
  type_label: string | null;
  type_confidence: number | null;
  type_needs_review: boolean | null;
  scientific_type: string | null;
  trainability: string | null;
  stability_level: string | null;
  complexity_level: string | null;
  leadership_relevance: string | null;
  role_relevance: string | null;
  deprecated: boolean;
  micro_count: number;
  role_count: number;
}

// Whitelist sort fields → SQL expressions (never interpolate user input).
const SORT_MAP: Record<string, string> = {
  name: 'c.canonical_name',
  type: 'tm.type_key',
  domain: 'd.name',
  family: 'f.name',
  complexity: 'c.complexity_level',
  trainability: 'c.trainability',
  stability: 'c.stability_level',
  micro: 'micro_count',
  roles: 'role_count',
  created: 'c.created_at',
  updated: 'c.updated_at',
};

const RESULT_SELECT = `
  SELECT
    c.id, c.canonical_name, c.slug, c.definition,
    c.domain_id, d.name AS domain_name,
    c.family_id, f.name AS family_name,
    tm.type_key, t.label AS type_label, tm.confidence AS type_confidence, tm.needs_review AS type_needs_review,
    c.scientific_type, c.trainability::text AS trainability, c.stability_level::text AS stability_level,
    c.complexity_level::text AS complexity_level, c.leadership_relevance::text AS leadership_relevance,
    c.role_relevance::text AS role_relevance, c.deprecated,
    (SELECT COUNT(*)::int FROM onto_competency_hierarchy h WHERE h.parent_competency_id = c.id AND h.active) AS micro_count,
    (SELECT COUNT(DISTINCT rcp.role_id)::int FROM onto_role_competency_profiles rcp WHERE rcp.competency_id = c.id AND rcp.active) AS role_count
  FROM onto_competencies c
  LEFT JOIN onto_domains d ON d.id = c.domain_id
  LEFT JOIN onto_families f ON f.id = c.family_id
  LEFT JOIN onto_competency_type_map tm ON tm.competency_id = c.id
  LEFT JOIN onto_competency_types t ON t.type_key = tm.type_key
`;

// Build the WHERE fragment + params shared by the search + count queries.
function buildWhere(opts: CompetencySearchOpts): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  if (!opts.includeDeprecated) where.push('c.deprecated = false');

  if (opts.q && opts.q.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(`(c.canonical_name ILIKE ${p(like)} OR c.slug ILIKE ${p(like)} OR c.definition ILIKE ${p(like)})`);
  }
  if (opts.typeKey) where.push(`tm.type_key = ${p(opts.typeKey)}`);
  if (opts.domainId) where.push(`c.domain_id = ${p(opts.domainId)}`);
  if (opts.familyId) where.push(`c.family_id = ${p(opts.familyId)}`);
  if (opts.trainability) where.push(`c.trainability::text = ${p(opts.trainability)}`);
  if (opts.stabilityLevel) where.push(`c.stability_level::text = ${p(opts.stabilityLevel)}`);
  if (opts.complexityLevel) where.push(`c.complexity_level::text = ${p(opts.complexityLevel)}`);

  // Role-taxonomy filters. Legacy (useOnet=false) resolve through the curated
  // onto_role_competency_profiles hierarchy. When useOnet=true (flag ontologyHierarchyV2)
  // they resolve through the O*NET hierarchy (industry → map_industry_function →
  // ont_departments → ont_role_families → ont_roles → map_role_competency →
  // ont_competencies → map_ont_onto_competency → onto_competencies). ont_ ids are
  // integers, so they are coerced with Number().
  if (opts.useOnet) {
    // Shared crosswalk join: c.id (onto) ← map_ont_onto_competency ← map_role_competency.
    const onetBase = `FROM map_ont_onto_competency x
      JOIN map_role_competency mrc ON mrc.competency_id = x.ont_competency_id AND mrc.is_active`;
    // ont_ ids are integers. Coerce + guard: a non-numeric id skips the filter cleanly
    // (rather than producing NaN → a SQL type error / 500).
    const intId = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const roleN = opts.roleId ? intId(opts.roleId) : null;
    const deptN = opts.departmentId ? intId(opts.departmentId) : null;
    const fnN = opts.functionId ? intId(opts.functionId) : null;
    const indN = opts.industryId ? intId(opts.industryId) : null;
    if (roleN !== null) {
      where.push(`EXISTS (SELECT 1 ${onetBase}
        WHERE x.onto_competency_id = c.id AND mrc.role_id = ${p(roleN)})`);
    }
    if (deptN !== null) {
      where.push(`EXISTS (SELECT 1 ${onetBase}
        JOIN ont_roles r ON r.id = mrc.role_id
        JOIN ont_role_families rf ON rf.id = r.role_family_id
        WHERE x.onto_competency_id = c.id AND rf.department_id = ${p(deptN)})`);
    }
    if (fnN !== null) {
      where.push(`EXISTS (SELECT 1 ${onetBase}
        JOIN ont_roles r ON r.id = mrc.role_id
        JOIN ont_role_families rf ON rf.id = r.role_family_id
        JOIN ont_departments d ON d.id = rf.department_id
        WHERE x.onto_competency_id = c.id AND d.function_id = ${p(fnN)})`);
    }
    if (indN !== null) {
      where.push(`EXISTS (SELECT 1 ${onetBase}
        JOIN ont_roles r ON r.id = mrc.role_id
        JOIN ont_role_families rf ON rf.id = r.role_family_id
        JOIN ont_departments d ON d.id = rf.department_id
        JOIN map_industry_function mif ON mif.function_id = d.function_id AND mif.is_active
        WHERE x.onto_competency_id = c.id AND mif.industry_id = ${p(indN)})`);
    }
  } else {
    if (opts.roleId) {
      where.push(`EXISTS (SELECT 1 FROM onto_role_competency_profiles rcp
        WHERE rcp.competency_id = c.id AND rcp.active AND rcp.role_id = ${p(opts.roleId)})`);
    }
    if (opts.departmentId) {
      where.push(`EXISTS (SELECT 1 FROM onto_role_competency_profiles rcp
        JOIN onto_roles r ON r.id = rcp.role_id
        JOIN onto_role_families rf ON rf.id = r.role_family_id
        WHERE rcp.competency_id = c.id AND rcp.active AND rf.subfunction_id = ${p(opts.departmentId)})`);
    }
    if (opts.functionId) {
      where.push(`EXISTS (SELECT 1 FROM onto_role_competency_profiles rcp
        JOIN onto_roles r ON r.id = rcp.role_id
        JOIN onto_role_families rf ON rf.id = r.role_family_id
        JOIN onto_subfunctions sf ON sf.id = rf.subfunction_id
        WHERE rcp.competency_id = c.id AND rcp.active AND sf.function_id = ${p(opts.functionId)})`);
    }
    if (opts.industryId) {
      where.push(`EXISTS (SELECT 1 FROM onto_role_competency_profiles rcp
        JOIN onto_roles r ON r.id = rcp.role_id
        JOIN onto_role_families rf ON rf.id = r.role_family_id
        JOIN onto_subfunctions sf ON sf.id = rf.subfunction_id
        JOIN onto_functions fn ON fn.id = sf.function_id
        WHERE rcp.competency_id = c.id AND rcp.active AND fn.industry_id = ${p(opts.industryId)})`);
    }
  }

  if (opts.microTerm && opts.microTerm.trim()) {
    const like = `%${opts.microTerm.trim()}%`;
    where.push(`EXISTS (SELECT 1 FROM onto_competency_hierarchy h
      WHERE h.parent_competency_id = c.id AND h.active AND (h.micro_label ILIKE ${p(like)} OR h.micro_slug ILIKE ${p(like)}))`);
  } else if (opts.hasMicro) {
    where.push(`EXISTS (SELECT 1 FROM onto_competency_hierarchy h WHERE h.parent_competency_id = c.id AND h.active)`);
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export interface CompetencySearchResponse {
  results: CompetencyResult[];
  total: number;
  limit: number;
  offset: number;
  sort: string;
  order: 'asc' | 'desc';
  applied_filters: Record<string, unknown>;
}

export async function searchCompetencies(pool: Pool, opts: CompetencySearchOpts): Promise<CompetencySearchResponse> {
  const { sql: whereSql, params } = buildWhere(opts);

  const sortKey = opts.sort && SORT_MAP[opts.sort] ? opts.sort : 'name';
  const sortCol = SORT_MAP[sortKey];
  const order: 'asc' | 'desc' = String(opts.order).toLowerCase() === 'desc' ? 'desc' : 'asc';

  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const countRes = await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies c
    LEFT JOIN onto_competency_type_map tm ON tm.competency_id = c.id ${whereSql}`, params);
  const total = countRes.rows[0]?.n ?? 0;

  const rowsRes = await pool.query(
    `${RESULT_SELECT} ${whereSql} ORDER BY ${sortCol} ${order} NULLS LAST, c.id ASC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  const applied: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(opts)) {
    if (['limit', 'offset', 'sort', 'order'].includes(k)) continue;
    if (v !== undefined && v !== '' && v !== false) applied[k] = v;
  }

  return { results: rowsRes.rows as CompetencyResult[], total, limit, offset, sort: sortKey, order, applied_filters: applied };
}

export async function getCompetenciesByIds(pool: Pool, ids: string[]): Promise<CompetencyResult[]> {
  if (!ids.length) return [];
  const res = await pool.query(`${RESULT_SELECT} WHERE c.id = ANY($1) ORDER BY c.canonical_name ASC`, [ids]);
  return res.rows as CompetencyResult[];
}

// ---- Facets (filter dropdown options, each with live counts) ----------------

export interface SearchFacets {
  types: { type_key: string; label: string; count: number }[];
  domains: { id: string; name: string; count: number }[];
  families: { id: string; domain_id: string | null; name: string; count: number }[];
  industries: { id: string; name: string }[];
  functions: { id: string; industry_id: string | null; name: string }[];
  departments: { id: string; function_id: string | null; name: string }[];
  roles: { id: string; title: string; role_family_id: string | null }[];
  trainability: string[];
  stability_level: string[];
  complexity_level: string[];
}

export async function getSearchFacets(pool: Pool, useOnet = false): Promise<SearchFacets> {
  // The role-taxonomy facets (industries/functions/departments/roles) come from the
  // O*NET hierarchy when the flag is ON (206 industries, 1k+ roles) and from the
  // curated onto_ taxonomy when OFF. The competency-keyed facets (types/domains/
  // families/attributes) are ALWAYS onto_ — the displayed catalog never changes.
  const taxonomyQueries = useOnet
    ? [
        pool.query(`SELECT id, name FROM ont_industries WHERE is_active = true ORDER BY sort_order, name`),
        pool.query(`SELECT id, NULL::int AS industry_id, name FROM ont_functions WHERE is_active = true ORDER BY sort_order, name`),
        pool.query(`SELECT id, function_id, name FROM ont_departments WHERE is_active = true ORDER BY sort_order, name`),
        pool.query(`SELECT id, title, role_family_id FROM ont_roles WHERE is_active = true ORDER BY sort_order, title`),
      ]
    : [
        pool.query(`SELECT id, name FROM onto_industries WHERE deprecated = false ORDER BY display_order, name`),
        pool.query(`SELECT id, industry_id, name FROM onto_functions WHERE deprecated = false ORDER BY display_order, name`),
        pool.query(`SELECT id, function_id, name FROM onto_subfunctions WHERE deprecated = false ORDER BY display_order, name`),
        pool.query(`SELECT id, title, role_family_id FROM onto_roles WHERE deprecated = false ORDER BY display_order, title`),
      ];
  const [types, domains, families, industries, functions, departments, roles, attrs] = await Promise.all([
    pool.query(`SELECT t.type_key, t.label, COUNT(tm.competency_id)::int AS count
      FROM onto_competency_types t LEFT JOIN onto_competency_type_map tm ON tm.type_key = t.type_key
      GROUP BY t.type_key, t.label, t.display_order ORDER BY t.display_order, t.label`),
    pool.query(`SELECT d.id, d.name, COUNT(c.id)::int AS count
      FROM onto_domains d LEFT JOIN onto_competencies c ON c.domain_id = d.id AND c.deprecated = false
      WHERE d.deprecated = false GROUP BY d.id, d.name, d.display_order ORDER BY d.display_order, d.name`),
    pool.query(`SELECT f.id, f.domain_id, f.name, COUNT(c.id)::int AS count
      FROM onto_families f LEFT JOIN onto_competencies c ON c.family_id = f.id AND c.deprecated = false
      WHERE f.deprecated = false GROUP BY f.id, f.domain_id, f.name, f.display_order ORDER BY f.name`),
    ...taxonomyQueries,
    pool.query(`SELECT
      ARRAY(SELECT DISTINCT trainability::text FROM onto_competencies WHERE trainability IS NOT NULL ORDER BY 1) AS trainability,
      ARRAY(SELECT DISTINCT stability_level::text FROM onto_competencies WHERE stability_level IS NOT NULL ORDER BY 1) AS stability_level,
      ARRAY(SELECT DISTINCT complexity_level::text FROM onto_competencies WHERE complexity_level IS NOT NULL ORDER BY 1) AS complexity_level`),
  ]);

  const a = attrs.rows[0] ?? {};
  return {
    types: types.rows,
    domains: domains.rows,
    families: families.rows,
    industries: industries.rows,
    functions: functions.rows,
    departments: departments.rows,
    roles: roles.rows,
    trainability: a.trainability ?? [],
    stability_level: a.stability_level ?? [],
    complexity_level: a.complexity_level ?? [],
  };
}

// ---- Micro-competency search ------------------------------------------------

export interface MicroResult {
  id: number;
  parent_competency_id: string | null;
  parent_name: string | null;
  child_competency_id: string | null;
  child_name: string | null;
  micro_label: string | null;
  micro_slug: string | null;
  source: string | null;
  active: boolean;
}

export async function searchMicroCompetencies(
  pool: Pool,
  opts: { q?: string; parentId?: string; includeInactive?: boolean; limit?: number; offset?: number },
): Promise<{ results: MicroResult[]; total: number; limit: number; offset: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  if (!opts.includeInactive) where.push('h.active = true');
  if (opts.parentId) where.push(`h.parent_competency_id = ${p(opts.parentId)}`);
  if (opts.q && opts.q.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(`(h.micro_label ILIKE ${p(like)} OR h.micro_slug ILIKE ${p(like)} OR pc.canonical_name ILIKE ${p(like)} OR cc.canonical_name ILIKE ${p(like)})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const base = `FROM onto_competency_hierarchy h
    LEFT JOIN onto_competencies pc ON pc.id = h.parent_competency_id
    LEFT JOIN onto_competencies cc ON cc.id = h.child_competency_id ${whereSql}`;

  const countRes = await pool.query(`SELECT COUNT(*)::int AS n ${base}`, params);
  const rowsRes = await pool.query(
    `SELECT h.id, h.parent_competency_id, pc.canonical_name AS parent_name,
       h.child_competency_id, cc.canonical_name AS child_name,
       h.micro_label, h.micro_slug, h.source, h.active
     ${base} ORDER BY pc.canonical_name ASC NULLS LAST, h.sort_order ASC, h.id ASC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { results: rowsRes.rows as MicroResult[], total: countRes.rows[0]?.n ?? 0, limit, offset };
}

// ---- Catalog summary (panel header metrics) --------------------------------

export interface SearchSummary {
  competencies_total: number;
  competencies_active: number;
  competencies_deprecated: number;
  competencies_typed: number;
  competencies_untyped: number;
  domains: number;
  families: number;
  micro_competencies: number;
  industries: number;
  functions: number;
  departments: number;
  roles: number;
  type_breakdown: { type_key: string; label: string; count: number }[];
  findings: string[];
}

export async function getSearchSummary(pool: Pool, useOnet = false): Promise<SearchSummary> {
  // Taxonomy counts come from the O*NET hierarchy when the flag is ON (so the summary
  // honestly reflects the 206 industries that are now searchable) and from the curated
  // onto_ taxonomy when OFF. Competency totals are ALWAYS onto_ (the displayed catalog).
  const taxoQuery = useOnet
    ? pool.query(`SELECT
        (SELECT COUNT(*)::int FROM ont_industries WHERE is_active = true) AS industries,
        (SELECT COUNT(*)::int FROM ont_functions WHERE is_active = true) AS functions,
        (SELECT COUNT(*)::int FROM ont_departments WHERE is_active = true) AS departments,
        (SELECT COUNT(*)::int FROM ont_roles WHERE is_active = true) AS roles`)
    : pool.query(`SELECT
        (SELECT COUNT(*)::int FROM onto_industries WHERE deprecated = false) AS industries,
        (SELECT COUNT(*)::int FROM onto_functions WHERE deprecated = false) AS functions,
        (SELECT COUNT(*)::int FROM onto_subfunctions WHERE deprecated = false) AS departments,
        (SELECT COUNT(*)::int FROM onto_roles WHERE deprecated = false) AS roles`);
  const [base, typed, micro, taxo, types] = await Promise.all([
    pool.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE deprecated = false)::int AS active,
      COUNT(*) FILTER (WHERE deprecated = true)::int AS deprecated,
      (SELECT COUNT(*)::int FROM onto_domains WHERE deprecated = false) AS domains,
      (SELECT COUNT(*)::int FROM onto_families WHERE deprecated = false) AS families
      FROM onto_competencies`),
    pool.query(`SELECT COUNT(DISTINCT competency_id)::int AS typed FROM onto_competency_type_map`),
    pool.query(`SELECT COUNT(*)::int AS micro FROM onto_competency_hierarchy WHERE active = true`),
    taxoQuery,
    pool.query(`SELECT t.type_key, t.label, COUNT(tm.competency_id)::int AS count
      FROM onto_competency_types t LEFT JOIN onto_competency_type_map tm ON tm.type_key = t.type_key
      GROUP BY t.type_key, t.label, t.display_order ORDER BY t.display_order, t.label`),
  ]);

  const b = base.rows[0];
  const total = b.total ?? 0;
  const typedN = typed.rows[0]?.typed ?? 0;
  const untyped = Math.max(total - typedN, 0);

  const findings: string[] = [];
  findings.push(`${total} competencies indexed across ${b.domains} domains and ${b.families} families.`);
  if (untyped > 0) findings.push(`${untyped} competenc${untyped === 1 ? 'y is' : 'ies are'} not yet classified by type — searchable under the "untyped" filter.`);
  else findings.push('Every competency is classified by type.');
  findings.push(`Role taxonomy: ${taxo.rows[0].industries} industries · ${taxo.rows[0].functions} functions · ${taxo.rows[0].departments} departments · ${taxo.rows[0].roles} roles.`);
  if (useOnet) findings.push('Industry/role filters resolve through the O*NET hierarchy. O*NET has no industry dimension, so industries share the same cross-industry competency set (not differentiated). Only competencies whose names exactly match the curated catalog are reachable through these filters.');
  if ((micro.rows[0]?.micro ?? 0) === 0) findings.push('No micro-competencies defined yet — micro search will return empty (honest, never seeded with placeholders).');

  return {
    competencies_total: total,
    competencies_active: b.active ?? 0,
    competencies_deprecated: b.deprecated ?? 0,
    competencies_typed: typedN,
    competencies_untyped: untyped,
    domains: b.domains ?? 0,
    families: b.families ?? 0,
    micro_competencies: micro.rows[0]?.micro ?? 0,
    industries: taxo.rows[0].industries ?? 0,
    functions: taxo.rows[0].functions ?? 0,
    departments: taxo.rows[0].departments ?? 0,
    roles: taxo.rows[0].roles ?? 0,
    type_breakdown: types.rows,
    findings,
  };
}

// ---- Bulk operations -------------------------------------------------------
// Operate on a search-selected set. `export` is read-only; `assign_type` is the
// only write — an additive, provenance-stamped, review-flagged upsert into the
// EXISTING type map. No destructive operation (delete/deprecate) is offered.

export type BulkOperation = 'export' | 'assign_type';

export interface BulkResult {
  operation: BulkOperation;
  requested: number;
  affected: number;
  skipped: { id: string; reason: string }[];
  exported?: CompetencyResult[];
}

export async function bulkOperation(
  pool: Pool,
  input: { operation: string; competency_ids: unknown; type_key?: unknown },
): Promise<{ ok: true; data: BulkResult } | { ok: false; error: string }> {
  const operation = String(input.operation ?? '') as BulkOperation;
  if (operation !== 'export' && operation !== 'assign_type') return { ok: false, error: 'invalid_operation' };

  const ids = Array.isArray(input.competency_ids)
    ? Array.from(new Set(input.competency_ids.map((x) => String(x).trim()).filter(Boolean)))
    : [];
  if (ids.length === 0) return { ok: false, error: 'no_competency_ids' };
  if (ids.length > 500) return { ok: false, error: 'too_many_ids' };

  // Resolve which ids actually exist; the rest are honestly skipped.
  const existRes = await pool.query(`SELECT id FROM onto_competencies WHERE id = ANY($1)`, [ids]);
  const existing = new Set(existRes.rows.map((r) => r.id as string));
  const skipped: { id: string; reason: string }[] = ids.filter((id) => !existing.has(id)).map((id) => ({ id, reason: 'competency_not_found' }));
  const valid = ids.filter((id) => existing.has(id));

  if (operation === 'export') {
    const exported = await getCompetenciesByIds(pool, valid);
    return { ok: true, data: { operation, requested: ids.length, affected: exported.length, skipped, exported } };
  }

  // assign_type
  const typeKey = String(input.type_key ?? '').trim();
  if (!typeKey) return { ok: false, error: 'missing_type_key' };
  const typeRes = await pool.query(`SELECT type_key FROM onto_competency_types WHERE type_key = $1`, [typeKey]);
  if (typeRes.rowCount === 0) return { ok: false, error: 'type_not_found' };

  let affected = 0;
  for (const id of valid) {
    const r = await pool.query(
      `INSERT INTO onto_competency_type_map (competency_id, type_key, confidence, needs_review, provenance, evidence, updated_at)
       VALUES ($1, $2, 'high', true, 'manual_bulk', 'Manual bulk type assignment via Search & Discovery', now())
       ON CONFLICT (competency_id) DO UPDATE
         SET type_key = EXCLUDED.type_key, confidence = 'high', needs_review = true,
             provenance = 'manual_bulk', evidence = 'Manual bulk type assignment via Search & Discovery', updated_at = now()`,
      [id, typeKey],
    );
    affected += r.rowCount ?? 0;
  }
  return { ok: true, data: { operation, requested: ids.length, affected, skipped } };
}
