/**
 * Phase 1 Enhancement — Global Role Engine
 * Read API for canonical roles + alias resolution. Backward-compatible:
 * never touches existing `onto_*` or `competency_*` tables.
 */
import type { Pool } from 'pg';

export const GLOBAL_ROLE_ENGINE_VERSION = '1.0.0';

export interface CanonicalRole {
  id: string; title: string; family_id: string; layer_id: string | null;
  path_id: string | null; seniority_band: string | null;
  experience_min: number | null; experience_max: number | null;
  onto_role_id: string | null; description: string | null; is_active: boolean;
}

export function createGlobalRoleEngine(pool: Pool) {
  const cache = new Map<string, { at: number; v: any }>();
  const TTL = 60_000;
  const memo = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.v as T;
    const v = await fn();
    cache.set(key, { at: Date.now(), v });
    return v;
  };

  async function listRoles(opts: { familyId?: string; layerId?: string; q?: string; limit?: number; offset?: number } = {}) {
    const lim = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const off = Math.max(opts.offset ?? 0, 0);
    const params: any[] = [];
    const where: string[] = ['deleted_at IS NULL', 'is_active = true'];
    if (opts.familyId) { params.push(opts.familyId); where.push(`family_id = $${params.length}`); }
    if (opts.layerId)  { params.push(opts.layerId);  where.push(`layer_id = $${params.length}`); }
    if (opts.q)        { params.push(`%${opts.q.toLowerCase()}%`); where.push(`LOWER(title) LIKE $${params.length}`); }
    params.push(lim, off);
    const { rows } = await pool.query(
      `SELECT id,title,family_id,layer_id,path_id,seniority_band,experience_min,experience_max,onto_role_id,description,is_active
       FROM gro_canonical_roles
       WHERE ${where.join(' AND ')}
       ORDER BY display_order, title
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as CanonicalRole[];
  }

  async function getRole(id: string) {
    const { rows } = await pool.query(
      `SELECT * FROM gro_canonical_roles WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return rows[0] ?? null;
  }

  /** Resolve any free-text role title to canonical id via title match or alias lookup. */
  async function resolveRole(text: string): Promise<CanonicalRole | null> {
    const q = (text || '').trim().toLowerCase();
    if (!q) return null;
    return memo(`resolve:${q}`, async () => {
      const t = await pool.query(
        `SELECT * FROM gro_canonical_roles WHERE LOWER(title) = $1 AND deleted_at IS NULL LIMIT 1`, [q]);
      if (t.rows[0]) return t.rows[0];
      const a = await pool.query(
        `SELECT r.* FROM gro_role_aliases a
         JOIN gro_canonical_roles r ON r.id = a.role_id
         WHERE LOWER(a.alias) = $1 AND a.deleted_at IS NULL AND r.deleted_at IS NULL LIMIT 1`, [q]);
      if (a.rows[0]) return a.rows[0];
      const f = await pool.query(
        `SELECT * FROM gro_canonical_roles WHERE LOWER(title) LIKE $1 AND deleted_at IS NULL LIMIT 1`, [`%${q}%`]);
      return f.rows[0] ?? null;
    });
  }

  async function listHierarchyFor(roleId: string) {
    const { rows } = await pool.query(
      `WITH RECURSIVE chain AS (
         SELECT id, role_id, parent_role_id, depth FROM gro_role_hierarchy WHERE role_id = $1 AND deleted_at IS NULL
         UNION
         SELECT h.id, h.role_id, h.parent_role_id, h.depth
           FROM gro_role_hierarchy h JOIN chain c ON c.parent_role_id = h.role_id WHERE h.deleted_at IS NULL
       ) SELECT * FROM chain ORDER BY depth`, [roleId]);
    return rows;
  }

  return { listRoles, getRole, resolveRole, listHierarchyFor };
}
