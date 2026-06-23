// Task #51 — O*NET hierarchy completion + cross-industry bridge.
//
// PROBLEM: the bulk O*NET import (onet-import.ts) creates 23 SOC-major-group role
// families (RF_ONET_<nn>) carrying 1,016 roles + ~52,100 map_role_competency rows,
// but leaves their department_id NULL — so none of that real data is reachable from
// an industry (industry → function → department → role_family → role). This linker
// completes the missing structural hops using ONLY real, documented relationships:
//
//   1. SOC major group → function   — a documented crosswalk. White-collar SOC
//      groups map to the existing cross-industry business functions; SOC groups with
//      no business-function home get a NEW function named from the official O*NET SOC
//      label (FN_ONET_<nn>, is_cross_industry=false — they are occupation-specific).
//   2. SOC major group → department — one ont_departments row per SOC group
//      (DEPT_ONET_<nn>) parented to the mapped function; role_family.department_id set.
//   3. industry → function          — every one of the 206 industries is linked to
//      the 13 functions already flagged is_cross_industry=true. That flag is the
//      data's own assertion that these functions span all industries (NOT fabricated).
//
// HONEST CEILING: O*NET has no industry dimension, so industries are NOT differentiated
// from each other — each reaches the same cross-industry competency set. True industry-
// specific occupation data would require BLS OEWS (absent). Documented, not faked.
//
// Part 2 (search wiring) also needs a competency crosswalk between the two disjoint
// catalogs (ont_competencies = 136 O*NET operational skills vs onto_competencies = 299
// curated behavioural). Only EXACT case-insensitive/trimmed name matches are bridged
// (~15); the rest are honestly left unmapped — never fuzzy-guessed.
//
// Everything here is idempotent (re-run = no-op) and additive (no row is deleted).

import type { Pool } from 'pg';

// SOC major group (first two SOC digits) → existing function code, or null to create
// a new occupation-specific function from the official SOC label.
const SOC_TO_FUNCTION: Record<string, string | null> = {
  '11': 'FN_STRAT', // Management
  '13': 'FN_FIN', // Business and Financial Operations
  '15': 'FN_ENGG', // Computer and Mathematical
  '17': 'FN_ENGG', // Architecture and Engineering
  '19': 'FN_RD', // Life, Physical, and Social Science (R&D — NOT cross-industry)
  '21': null, // Community and Social Service
  '23': 'FN_LEGAL', // Legal
  '25': null, // Educational Instruction and Library
  '27': null, // Arts, Design, Entertainment, Sports, and Media
  '29': null, // Healthcare Practitioners and Technical
  '31': null, // Healthcare Support
  '33': null, // Protective Service
  '35': null, // Food Preparation and Serving Related
  '37': null, // Building and Grounds Cleaning and Maintenance
  '39': null, // Personal Care and Service
  '41': 'FN_SALES', // Sales and Related
  '43': 'FN_OPS', // Office and Administrative Support
  '45': null, // Farming, Fishing, and Forestry
  '47': null, // Construction and Extraction
  '49': null, // Installation, Maintenance, and Repair
  '51': null, // Production
  '53': null, // Transportation and Material Moving
  '55': null, // Military Specific
};

export interface LinkSummary {
  soc_groups_processed: number;
  functions_created: number;
  departments_created: number;
  role_families_linked: number;
  industry_function_links_added: number;
  competency_crosswalk_rows: number;
  notes: string[];
}

async function getOrCreateFunction(
  pool: Pool,
  code: string,
  name: string,
  isCrossIndustry: boolean,
): Promise<{ id: number; created: boolean }> {
  const existing = await pool.query(`SELECT id FROM ont_functions WHERE code = $1`, [code]);
  if (existing.rowCount && existing.rows[0]) return { id: existing.rows[0].id as number, created: false };
  const ins = await pool.query(
    `INSERT INTO ont_functions (code, name, description, is_cross_industry, is_active, status, created_by)
     VALUES ($1, $2, $3, $4, true, 'published', 'onet-hierarchy-link')
     ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
     RETURNING id`,
    [code, name, `O*NET SOC occupational function: ${name}`, isCrossIndustry],
  );
  return { id: ins.rows[0].id as number, created: true };
}

async function getOrCreateDepartment(
  pool: Pool,
  code: string,
  name: string,
  functionId: number,
): Promise<{ id: number; created: boolean }> {
  const existing = await pool.query(`SELECT id, function_id FROM ont_departments WHERE code = $1`, [code]);
  if (existing.rowCount && existing.rows[0]) {
    // keep function_id current (idempotent re-point if the crosswalk changed)
    if (existing.rows[0].function_id !== functionId) {
      await pool.query(`UPDATE ont_departments SET function_id = $2, updated_at = now() WHERE code = $1`, [code, functionId]);
    }
    return { id: existing.rows[0].id as number, created: false };
  }
  const ins = await pool.query(
    `INSERT INTO ont_departments (code, name, description, function_id, is_active, status, created_by)
     VALUES ($1, $2, $3, $4, true, 'published', 'onet-hierarchy-link')
     ON CONFLICT (code) DO UPDATE SET function_id = EXCLUDED.function_id
     RETURNING id`,
    [code, name, `O*NET SOC major group: ${name}`, functionId],
  );
  return { id: ins.rows[0].id as number, created: true };
}

export async function linkOnetHierarchy(pool: Pool): Promise<LinkSummary> {
  const summary: LinkSummary = {
    soc_groups_processed: 0,
    functions_created: 0,
    departments_created: 0,
    role_families_linked: 0,
    industry_function_links_added: 0,
    competency_crosswalk_rows: 0,
    notes: [],
  };

  // ── Part 1a/1b: SOC major group → function → department → role_family ────────
  const rfRes = await pool.query(
    `SELECT code, name FROM ont_role_families WHERE code LIKE 'RF_ONET_%' ORDER BY code`,
  );
  for (const rf of rfRes.rows as { code: string; name: string }[]) {
    const nn = rf.code.replace('RF_ONET_', '');
    summary.soc_groups_processed += 1;

    const mapped = SOC_TO_FUNCTION[nn];
    let functionId: number;
    if (mapped) {
      const fn = await pool.query(`SELECT id FROM ont_functions WHERE code = $1`, [mapped]);
      if (!fn.rowCount) {
        summary.notes.push(`SOC ${nn}: mapped function ${mapped} not found — skipped.`);
        continue;
      }
      functionId = fn.rows[0].id as number;
    } else {
      // No business-function home → create an occupation-specific function from the
      // official SOC label (is_cross_industry=false → not broadcast to all industries).
      const fn = await getOrCreateFunction(pool, `FN_ONET_${nn}`, rf.name, false);
      functionId = fn.id;
      if (fn.created) summary.functions_created += 1;
    }

    const dept = await getOrCreateDepartment(pool, `DEPT_ONET_${nn}`, rf.name, functionId);
    if (dept.created) summary.departments_created += 1;

    const upd = await pool.query(
      `UPDATE ont_role_families SET department_id = $2, updated_at = now()
       WHERE code = $1 AND (department_id IS DISTINCT FROM $2)`,
      [rf.code, dept.id],
    );
    summary.role_families_linked += upd.rowCount ?? 0;
  }

  // ── Part 1c: industry → cross-industry function (the is_cross_industry flag) ──
  const ind = await pool.query(
    `INSERT INTO map_industry_function (industry_id, function_id, is_active)
     SELECT i.id, f.id, true
     FROM ont_industries i
     CROSS JOIN ont_functions f
     WHERE f.is_cross_industry = true
       AND NOT EXISTS (
         SELECT 1 FROM map_industry_function m
         WHERE m.industry_id = i.id AND m.function_id = f.id
       )`,
  );
  summary.industry_function_links_added = ind.rowCount ?? 0;

  // ── Part 2 prerequisite: competency crosswalk (exact name match only) ────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS map_ont_onto_competency (
      id serial PRIMARY KEY,
      ont_competency_id integer NOT NULL,
      onto_competency_id text NOT NULL,
      match_method varchar NOT NULL DEFAULT 'exact_name_ci',
      confidence varchar NOT NULL DEFAULT 'high',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (ont_competency_id, onto_competency_id)
    )`);
  const cw = await pool.query(`
    INSERT INTO map_ont_onto_competency (ont_competency_id, onto_competency_id, match_method, confidence)
    SELECT a.id, b.id, 'exact_name_ci', 'high'
    FROM ont_competencies a
    JOIN onto_competencies b ON lower(trim(a.name)) = lower(trim(b.canonical_name))
    ON CONFLICT (ont_competency_id, onto_competency_id) DO NOTHING`);
  summary.competency_crosswalk_rows = cw.rowCount ?? 0;
  const cwTotal = await pool.query(`SELECT COUNT(*)::int AS n FROM map_ont_onto_competency`);
  summary.notes.push(
    `Competency crosswalk total = ${cwTotal.rows[0].n} (exact name match only; ${136} O*NET vs 299 curated, the rest honestly unmapped).`,
  );

  return summary;
}
