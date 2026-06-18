/**
 * Phase 1 Enhancement — Role Family Engine
 * Role families + paths + function mappings. Read-only, paginated.
 */
import type { Pool } from 'pg';

export const ROLE_FAMILY_ENGINE_VERSION = '1.0.0';

export function createRoleFamilyEngine(pool: Pool) {
  async function listFamilies(opts: { functionId?: string } = {}) {
    const params: any[] = [];
    const where: string[] = ['deleted_at IS NULL'];
    if (opts.functionId) { params.push(opts.functionId); where.push(`function_id = $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT id, name, description, function_id, onto_family_id, display_order
       FROM gro_role_families WHERE ${where.join(' AND ')} ORDER BY display_order, name`, params);
    return rows;
  }

  async function listPaths(familyId: string) {
    const { rows } = await pool.query(
      `SELECT id, family_id, path_name, description, display_order
       FROM gro_role_family_paths WHERE family_id = $1 AND deleted_at IS NULL ORDER BY display_order`, [familyId]);
    return rows;
  }

  async function getFamilyTree(familyId: string) {
    const [family, paths, roles] = await Promise.all([
      pool.query(`SELECT * FROM gro_role_families WHERE id = $1 AND deleted_at IS NULL`, [familyId]),
      listPaths(familyId),
      pool.query(`SELECT id, title, layer_id, path_id, seniority_band, experience_min, experience_max
                  FROM gro_canonical_roles WHERE family_id = $1 AND deleted_at IS NULL AND is_active = true
                  ORDER BY experience_min NULLS FIRST, title`, [familyId]),
    ]);
    return { family: family.rows[0] ?? null, paths, roles: roles.rows };
  }

  async function listFunctions() {
    const { rows } = await pool.query(
      `SELECT id, name, function_family_id, description, onto_function_id, display_order
       FROM gro_business_functions WHERE deleted_at IS NULL AND is_active = true ORDER BY display_order, name`);
    return rows;
  }

  async function listIndustries() {
    const { rows } = await pool.query(
      `SELECT id, name, code, industry_family_id, naics_code, isco_code, description, display_order
       FROM gro_industries WHERE deleted_at IS NULL AND is_active = true ORDER BY display_order, name`);
    return rows;
  }

  async function listIndustryFamilies() {
    const { rows } = await pool.query(
      `SELECT id, name, description, display_order FROM gro_industry_families
       WHERE deleted_at IS NULL ORDER BY display_order, name`);
    return rows;
  }

  async function listGeographies(industryId?: string) {
    if (industryId) {
      const { rows } = await pool.query(
        `SELECT id, industry_id, geography_code, geography_name, prevalence FROM gro_industry_geographies
         WHERE industry_id = $1 AND deleted_at IS NULL ORDER BY prevalence DESC NULLS LAST, geography_name`, [industryId]);
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT DISTINCT geography_code, geography_name FROM gro_industry_geographies
       WHERE deleted_at IS NULL ORDER BY geography_name`);
    return rows;
  }

  return { listFamilies, listPaths, getFamilyTree, listFunctions, listIndustries, listIndustryFamilies, listGeographies };
}
