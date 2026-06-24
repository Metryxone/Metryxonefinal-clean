/**
 * Role Library Expansion — broaden the curated role library so more free-text
 * job titles can be crosswalked to a matchable curated role.
 *
 * Why this exists
 * ---------------
 * Candidate matching (talent-matching-engine) can only rank candidates against a
 * role that exists in `onto_roles` AND carries an ACTIVE, weight-bearing profile
 * in `onto_role_competency_profiles` (see services/role-title-crosswalk.ts —
 * getMatchableCuratedRoles requires `COUNT(active) > 0`). Out of the box only a
 * handful of roles (Backend Engineer, Senior Backend Engineer, Product Manager)
 * carry such a profile, so very common titles ("Software Engineer", "Data
 * Analyst", "Frontend Engineer", …) correctly ABSTAIN (no fabrication) and
 * therefore cannot be matched.
 *
 * This module adds a curated, defensible set of additional roles — each with the
 * taxonomy chain it needs (function → subfunction → role family → role) and a
 * weight-balanced competency profile referencing EXISTING competencies. Growing
 * the curated profiles directly increases how many real job posts resolve and
 * rank candidates.
 *
 * Honesty / safety contract (do not break):
 *   - Strictly ADDITIVE + idempotent: every insert is `ON CONFLICT DO NOTHING`.
 *     Re-running inserts zero new rows. Reversible by deleting on the provenance
 *     `source = 'library_expansion'` (profiles) / the listed ids (taxonomy).
 *   - NEVER fabricates competencies: every requirement references an EXISTING
 *     `onto_competencies.id`; a missing competency is skipped + reported, never
 *     invented.
 *   - Weights per role are curated to sum to 100 (weight-balanced) and are NEVER
 *     auto-normalised at read time.
 *   - The canonical genome rows it inserts (taxonomy + roles) reuse the SAME
 *     shape as migrations/20260523_competency_ontology_seed.sql.
 *
 * Canonical record: migrations/20260624_role_library_expansion.sql.
 */

import type { Pool } from 'pg';
import { ensureRoleCompetencyProfileSchema, type Criticality } from './role-competency-profile.js';

export const ROLE_LIBRARY_EXPANSION_VERSION = 'role-library-expansion-v1';
export const ROLE_LIBRARY_EXPANSION_SOURCE = 'library_expansion';
export const ROLE_LIBRARY_EXPANSION_DNA_VERSION = '1.0.0';

/** Canonical DNA profile id for an expansion role (mirrors the seed migration's
 * `dna_<role-suffix>_v1` convention, e.g. role_software_eng → dna_software_eng_v1). */
export function expansionDnaProfileId(roleId: string): string {
  return `dna_${roleId.replace(/^role_/, '')}_v1`;
}

interface TaxFunction { id: string; industry_id: string; name: string; description: string; display_order: number }
interface TaxSubfunction { id: string; function_id: string; name: string; description: string; display_order: number }
interface TaxRoleFamily { id: string; subfunction_id: string; name: string; description: string; display_order: number }

interface ExpansionReq { competency_id: string; required_level: number; weight: number; criticality: Criticality }
interface ExpansionRole {
  role_id: string;
  role_family_id: string;
  layer_id: string;
  title: string;
  seniority: string;
  description: string;
  display_order: number;
  requirements: ExpansionReq[];
}

// --------------------------------------------------------------------------
// Taxonomy the new roles hang off. Industries (ind_it / ind_financial) and the
// functions fn_it_engineering / fn_it_product already exist (seed migration);
// we only add the NEW chain rows. All `ON CONFLICT DO NOTHING`.
// --------------------------------------------------------------------------

export const EXPANSION_FUNCTIONS: TaxFunction[] = [
  { id: 'fn_it_data', industry_id: 'ind_it', name: 'Data & Analytics', description: 'Turning data into decisions, models, and insight.', display_order: 3 },
];

export const EXPANSION_SUBFUNCTIONS: TaxSubfunction[] = [
  { id: 'sfn_software_eng',      function_id: 'fn_it_engineering', name: 'Software Engineering',  description: 'General-purpose software design and delivery.', display_order: 3 },
  { id: 'sfn_fullstack_eng',     function_id: 'fn_it_engineering', name: 'Full-Stack Engineering', description: 'End-to-end client and server development.',     display_order: 4 },
  { id: 'sfn_devops_eng',        function_id: 'fn_it_engineering', name: 'DevOps & Reliability',  description: 'Build, deploy, and operate reliable systems.',  display_order: 5 },
  { id: 'sfn_quality_eng',       function_id: 'fn_it_engineering', name: 'Quality Engineering',   description: 'Test strategy and software quality assurance.',  display_order: 6 },
  { id: 'sfn_data_analytics',    function_id: 'fn_it_data',        name: 'Data Analytics',        description: 'Descriptive and diagnostic data analysis.',     display_order: 1 },
  { id: 'sfn_data_science',      function_id: 'fn_it_data',        name: 'Data Science',          description: 'Statistical modelling and machine learning.',   display_order: 2 },
  { id: 'sfn_business_analysis', function_id: 'fn_it_product',     name: 'Business Analysis',     description: 'Bridging business needs and solution design.',  display_order: 2 },
  { id: 'sfn_project_mgmt',      function_id: 'fn_it_product',     name: 'Project Management',    description: 'Planning and delivering scoped initiatives.',   display_order: 3 },
];

export const EXPANSION_ROLE_FAMILIES: TaxRoleFamily[] = [
  { id: 'rf_software_engineer',  subfunction_id: 'sfn_software_eng',      name: 'Software Engineer',  description: 'Designs and builds software across the stack.', display_order: 1 },
  { id: 'rf_fullstack_engineer', subfunction_id: 'sfn_fullstack_eng',     name: 'Full Stack Engineer',description: 'Builds both client and server systems.',       display_order: 1 },
  { id: 'rf_devops_engineer',    subfunction_id: 'sfn_devops_eng',        name: 'DevOps Engineer',    description: 'Automates delivery and operates infrastructure.', display_order: 1 },
  { id: 'rf_qa_engineer',        subfunction_id: 'sfn_quality_eng',       name: 'QA Engineer',        description: 'Designs tests and safeguards software quality.', display_order: 1 },
  { id: 'rf_data_analyst',       subfunction_id: 'sfn_data_analytics',    name: 'Data Analyst',       description: 'Analyses data to inform decisions.',           display_order: 1 },
  { id: 'rf_data_scientist',     subfunction_id: 'sfn_data_science',      name: 'Data Scientist',     description: 'Builds models and statistical insight.',       display_order: 1 },
  { id: 'rf_business_analyst',   subfunction_id: 'sfn_business_analysis', name: 'Business Analyst',   description: 'Translates business needs into requirements.', display_order: 1 },
  { id: 'rf_project_manager',    subfunction_id: 'sfn_project_mgmt',      name: 'Project Manager',    description: 'Plans and delivers scoped projects.',          display_order: 1 },
];

// New roles. `rf_frontend_engineer` already exists in the seed migration (with
// no role yet) — we add the Frontend Engineer role onto it.
export const EXPANSION_ROLES: ExpansionRole[] = [
  {
    role_id: 'role_software_eng', role_family_id: 'rf_software_engineer', layer_id: 'layer_executive',
    title: 'Software Engineer', seniority: 'mid', description: 'Designs, builds, and maintains software systems.', display_order: 1,
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',      required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_collaboration',        required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_communication',        required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_adaptability',         required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_attention_to_detail',  required_level: 3, weight: 10, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_sr_software_eng', role_family_id: 'rf_software_engineer', layer_id: 'layer_managerial',
    title: 'Senior Software Engineer', seniority: 'senior', description: 'Senior software engineer; owns design and mentors.', display_order: 2,
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 5, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',      required_level: 5, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_decision_quality',     required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_collaboration',        required_level: 4, weight: 10, criticality: 'important' },
      { competency_id: 'comp_communication',        required_level: 4, weight: 10, criticality: 'important' },
      { competency_id: 'comp_leadership',           required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_adaptability',         required_level: 3, weight:  5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_fe_eng', role_family_id: 'rf_frontend_engineer', layer_id: 'layer_executive',
    title: 'Frontend Engineer', seniority: 'mid', description: 'Builds user-facing client applications.', display_order: 1,
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',      required_level: 3, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_design_thinking',      required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_attention_to_detail',  required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_collaboration',        required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_communication',        required_level: 3, weight: 10, criticality: 'important' },
    ],
  },
  {
    role_id: 'role_fullstack_eng', role_family_id: 'rf_fullstack_engineer', layer_id: 'layer_executive',
    title: 'Full Stack Engineer', seniority: 'mid', description: 'Builds both client and server systems end-to-end.', display_order: 1,
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',      required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_adaptability',         required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_collaboration',        required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_communication',        required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_attention_to_detail',  required_level: 2, weight:  5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_devops_eng', role_family_id: 'rf_devops_engineer', layer_id: 'layer_executive',
    title: 'DevOps Engineer', seniority: 'mid', description: 'Automates delivery and operates reliable infrastructure.', display_order: 1,
    requirements: [
      { competency_id: 'comp_technical_competence', required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',      required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_quality_focus',        required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_decision_quality',     required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_collaboration',        required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_communication',        required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_adaptability',         required_level: 2, weight:  5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_qa_eng', role_family_id: 'rf_qa_engineer', layer_id: 'layer_executive',
    title: 'QA Engineer', seniority: 'mid', description: 'Designs tests and safeguards software quality.', display_order: 1,
    requirements: [
      { competency_id: 'comp_quality_assurance',    required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_attention_to_detail',  required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',      required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_analytical_thinking',  required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_communication',        required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_collaboration',        required_level: 3, weight: 10, criticality: 'important' },
    ],
  },
  {
    role_id: 'role_data_analyst', role_family_id: 'rf_data_analyst', layer_id: 'layer_executive',
    title: 'Data Analyst', seniority: 'mid', description: 'Analyses data to inform business decisions.', display_order: 1,
    requirements: [
      { competency_id: 'comp_analytical_thinking',         required_level: 4, weight: 30, criticality: 'critical' },
      { competency_id: 'comp_data_driven_decision_making', required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_attention_to_detail',         required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_communication',               required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_problem_solving',             required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_quality_focus',               required_level: 2, weight:  5, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_data_scientist', role_family_id: 'rf_data_scientist', layer_id: 'layer_managerial',
    title: 'Data Scientist', seniority: 'mid', description: 'Builds statistical models and machine-learning insight.', display_order: 1,
    requirements: [
      { competency_id: 'comp_analytical_thinking',         required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_data_driven_decision_making', required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_problem_solving',             required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_technical_competence',        required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_critical_thinking',           required_level: 3, weight: 10, criticality: 'important' },
      { competency_id: 'comp_communication',               required_level: 3, weight: 10, criticality: 'important' },
    ],
  },
  {
    role_id: 'role_business_analyst', role_family_id: 'rf_business_analyst', layer_id: 'layer_executive',
    title: 'Business Analyst', seniority: 'mid', description: 'Translates business needs into solution requirements.', display_order: 1,
    requirements: [
      { competency_id: 'comp_analytical_thinking', required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_stakeholder_mgmt',    required_level: 3, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_communication',       required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_business_acumen',     required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_problem_solving',     required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_critical_thinking',   required_level: 3, weight: 10, criticality: 'desirable' },
    ],
  },
  {
    role_id: 'role_project_manager', role_family_id: 'rf_project_manager', layer_id: 'layer_managerial',
    title: 'Project Manager', seniority: 'mid', description: 'Plans and delivers scoped projects on time.', display_order: 1,
    requirements: [
      { competency_id: 'comp_project_management',     required_level: 4, weight: 25, criticality: 'critical' },
      { competency_id: 'comp_planning_and_organizing', required_level: 4, weight: 20, criticality: 'critical' },
      { competency_id: 'comp_stakeholder_mgmt',       required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_communication',          required_level: 4, weight: 15, criticality: 'important' },
      { competency_id: 'comp_prioritization',         required_level: 3, weight: 15, criticality: 'important' },
      { competency_id: 'comp_decision_quality',       required_level: 3, weight: 10, criticality: 'desirable' },
    ],
  },
];

export interface RoleLibraryExpansionResult {
  ok: boolean;
  version: string;
  functions_inserted: number;
  subfunctions_inserted: number;
  role_families_inserted: number;
  roles_inserted: number;
  requirements_inserted: number;
  dna_profiles_inserted: number;      // onto_dna_profiles rows created for expansion roles
  role_weights_inserted: number;      // onto_role_weights rows created for expansion roles
  roles_now_matchable: number;        // roles from this expansion with >=1 active profile row
  roles_with_dna: number;             // expansion roles that now carry a current DNA profile + weights
  skipped: { kind: string; id: string; competency?: string; reason: string }[];
}

/**
 * Seed the expanded role library. Idempotent (every insert ON CONFLICT DO
 * NOTHING). Verifies every taxonomy parent and competency EXISTS; skips +
 * reports anything missing — never fabricates.
 */
export async function runRoleLibraryExpansion(pool: Pool): Promise<RoleLibraryExpansionResult> {
  await ensureRoleCompetencyProfileSchema(pool);

  const skipped: RoleLibraryExpansionResult['skipped'] = [];
  let functionsInserted = 0;
  let subfunctionsInserted = 0;
  let roleFamiliesInserted = 0;
  let rolesInserted = 0;
  let requirementsInserted = 0;
  let dnaProfilesInserted = 0;
  let roleWeightsInserted = 0;
  let rolesWithDna = 0;

  // 1. Functions (parent industry must exist).
  for (const fn of EXPANSION_FUNCTIONS) {
    const ind = await pool.query(`SELECT id FROM onto_industries WHERE id = $1`, [fn.industry_id]);
    if (ind.rowCount === 0) { skipped.push({ kind: 'function', id: fn.id, reason: `industry ${fn.industry_id} not found` }); continue; }
    const ins = await pool.query(
      `INSERT INTO onto_functions (id, industry_id, name, description, display_order)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [fn.id, fn.industry_id, fn.name, fn.description, fn.display_order],
    );
    if (ins.rowCount) functionsInserted += 1;
  }

  // 2. Subfunctions (parent function must exist).
  for (const sf of EXPANSION_SUBFUNCTIONS) {
    const fn = await pool.query(`SELECT id FROM onto_functions WHERE id = $1`, [sf.function_id]);
    if (fn.rowCount === 0) { skipped.push({ kind: 'subfunction', id: sf.id, reason: `function ${sf.function_id} not found` }); continue; }
    const ins = await pool.query(
      `INSERT INTO onto_subfunctions (id, function_id, name, description, display_order)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [sf.id, sf.function_id, sf.name, sf.description, sf.display_order],
    );
    if (ins.rowCount) subfunctionsInserted += 1;
  }

  // 3. Role families (parent subfunction must exist).
  for (const rf of EXPANSION_ROLE_FAMILIES) {
    const sf = await pool.query(`SELECT id FROM onto_subfunctions WHERE id = $1`, [rf.subfunction_id]);
    if (sf.rowCount === 0) { skipped.push({ kind: 'role_family', id: rf.id, reason: `subfunction ${rf.subfunction_id} not found` }); continue; }
    const ins = await pool.query(
      `INSERT INTO onto_role_families (id, subfunction_id, name, description, display_order)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [rf.id, rf.subfunction_id, rf.name, rf.description, rf.display_order],
    );
    if (ins.rowCount) roleFamiliesInserted += 1;
  }

  // 4. Roles (parent family + layer must exist) + their competency profiles.
  let rolesMatchable = 0;
  for (const role of EXPANSION_ROLES) {
    const fam = await pool.query(`SELECT id FROM onto_role_families WHERE id = $1`, [role.role_family_id]);
    if (fam.rowCount === 0) { skipped.push({ kind: 'role', id: role.role_id, reason: `role family ${role.role_family_id} not found` }); continue; }
    const layer = await pool.query(`SELECT id FROM onto_layers WHERE id = $1`, [role.layer_id]);
    if (layer.rowCount === 0) { skipped.push({ kind: 'role', id: role.role_id, reason: `layer ${role.layer_id} not found` }); continue; }

    const insRole = await pool.query(
      `INSERT INTO onto_roles (id, role_family_id, layer_id, title, seniority, description, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (role_family_id, title, seniority) DO NOTHING
       RETURNING id`,
      [role.role_id, role.role_family_id, role.layer_id, role.title, role.seniority, role.description, role.display_order],
    );
    if (insRole.rowCount) rolesInserted += 1;

    // Resolve the role id actually present (in case a conflicting row pre-existed
    // under a different id but the same family+title+seniority unique key).
    const roleRow = await pool.query(
      `SELECT id FROM onto_roles WHERE role_family_id = $1 AND title = $2 AND seniority IS NOT DISTINCT FROM $3`,
      [role.role_family_id, role.title, role.seniority],
    );
    const effectiveRoleId = roleRow.rows[0]?.id ?? role.role_id;

    let activeForRole = 0;
    for (const req of role.requirements) {
      const comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [req.competency_id]);
      if (comp.rowCount === 0) { skipped.push({ kind: 'requirement', id: effectiveRoleId, competency: req.competency_id, reason: 'competency_not_found' }); continue; }
      const ins = await pool.query(
        `INSERT INTO onto_role_competency_profiles
           (role_id, competency_id, required_level, weight, criticality, source, active)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         ON CONFLICT (role_id, competency_id) DO NOTHING
         RETURNING id`,
        [effectiveRoleId, req.competency_id, req.required_level, req.weight, req.criticality, ROLE_LIBRARY_EXPANSION_SOURCE],
      );
      if (ins.rowCount) requirementsInserted += 1;
      activeForRole += 1;
    }
    if (activeForRole > 0) rolesMatchable += 1;

    // 5. Role DNA profile + competency weights (so the role appears in the admin
    //    Role DNA / weights views, which read onto_dna_profiles + onto_role_weights —
    //    a DIFFERENT surface from onto_role_competency_profiles used by matching).
    //    Weights are DERIVED from this role's curated requirements: weight/100 (the
    //    requirement weights sum to 100, so DNA weights sum to ~1.0, matching the
    //    seed migration's convention) and expected_level = required_level. References
    //    only competencies that EXIST (the same per-requirement guard above) — never
    //    fabricated. Idempotent via ON CONFLICT DO NOTHING.
    const dnaProfileId = expansionDnaProfileId(effectiveRoleId);
    const insDna = await pool.query(
      `INSERT INTO onto_dna_profiles (id, role_id, version, is_current, notes)
       VALUES ($1,$2,$3,TRUE,$4)
       ON CONFLICT (role_id, version) DO NOTHING
       RETURNING id`,
      [dnaProfileId, effectiveRoleId, ROLE_LIBRARY_EXPANSION_DNA_VERSION, `Curated DNA for ${role.title} (library expansion).`],
    );
    if (insDna.rowCount) dnaProfilesInserted += 1;

    // Resolve the DNA profile id actually present (a pre-existing profile under a
    // different id but the same role+version unique key wins).
    const dnaRow = await pool.query(
      `SELECT id FROM onto_dna_profiles WHERE role_id = $1 AND version = $2`,
      [effectiveRoleId, ROLE_LIBRARY_EXPANSION_DNA_VERSION],
    );
    const effectiveDnaId = dnaRow.rows[0]?.id ?? dnaProfileId;

    let weightsForRole = 0;
    for (const req of role.requirements) {
      const comp = await pool.query(`SELECT id FROM onto_competencies WHERE id = $1`, [req.competency_id]);
      if (comp.rowCount === 0) { continue; } // already reported as skipped above
      const insWeight = await pool.query(
        `INSERT INTO onto_role_weights (dna_profile_id, competency_id, weight, expected_level, rationale)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (dna_profile_id, competency_id) DO NOTHING
         RETURNING id`,
        [effectiveDnaId, req.competency_id, req.weight / 100, req.required_level, `Derived from curated ${role.title} requirement (${req.criticality}).`],
      );
      if (insWeight.rowCount) roleWeightsInserted += 1;
      weightsForRole += 1;
    }
    if (weightsForRole > 0) rolesWithDna += 1;
  }

  return {
    ok: true,
    version: ROLE_LIBRARY_EXPANSION_VERSION,
    functions_inserted: functionsInserted,
    subfunctions_inserted: subfunctionsInserted,
    role_families_inserted: roleFamiliesInserted,
    roles_inserted: rolesInserted,
    requirements_inserted: requirementsInserted,
    dna_profiles_inserted: dnaProfilesInserted,
    role_weights_inserted: roleWeightsInserted,
    roles_now_matchable: rolesMatchable,
    roles_with_dna: rolesWithDna,
    skipped,
  };
}
