// ============================================================
// Governance / RBAC engine (Critical Gap #2)
// ------------------------------------------------------------
// Read surfaces over the canonical role/permission tables + hierarchy resolution.
// Reads never throw (return empty); writes (grant/revoke) fail-closed and are
// audited. NOTE: this is the FORMAL model. The live enforcement path remains the
// single super_admin gate on /api/admin/* — these grants are advisory definitions
// surfaced for governance, never silently swapped into enforcement.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";
import { recordGovernanceAudit } from "./audit-engine";

export async function listRoles(pool: Pool): Promise<any[]> {
  try {
    await ensureGovernanceSchema(pool);
    return (
      await pool.query(
        `SELECT id, role_name, display_name, description, level, is_system, is_active
         FROM role_definitions ORDER BY level DESC, role_name`
      )
    ).rows;
  } catch {
    return [];
  }
}

export async function listPermissions(pool: Pool): Promise<any[]> {
  try {
    await ensureGovernanceSchema(pool);
    return (
      await pool.query(
        `SELECT id, permission_key, display_name, category, resource, action, is_active
         FROM permission_definitions ORDER BY category, resource, action`
      )
    ).rows;
  } catch {
    return [];
  }
}

export async function listGroups(pool: Pool): Promise<any[]> {
  try {
    await ensureGovernanceSchema(pool);
    const groups = (
      await pool.query(`SELECT id, group_key, display_name, description FROM rbac_permission_groups ORDER BY display_name`)
    ).rows;
    const members = (
      await pool.query(`SELECT group_id, permission_id FROM rbac_permission_group_members`)
    ).rows;
    const byGroup = new Map<string, string[]>();
    for (const m of members) {
      const arr = byGroup.get(m.group_id) || [];
      arr.push(m.permission_id);
      byGroup.set(m.group_id, arr);
    }
    return groups.map((g: any) => ({ ...g, permissionIds: byGroup.get(g.id) || [] }));
  } catch {
    return [];
  }
}

export async function listHierarchy(pool: Pool): Promise<any[]> {
  try {
    await ensureGovernanceSchema(pool);
    return (
      await pool.query(
        `SELECT h.parent_role_id, h.child_role_id, p.role_name AS parent_role, c.role_name AS child_role
         FROM rbac_role_hierarchies h
         JOIN role_definitions p ON p.id = h.parent_role_id
         JOIN role_definitions c ON c.id = h.child_role_id
         ORDER BY p.level DESC`
      )
    ).rows;
  } catch {
    return [];
  }
}

// Effective permissions for a role = its direct grants ∪ all descendants' grants
// (transitive over the hierarchy edges). Never throws.
export async function resolveEffectivePermissions(
  pool: Pool,
  roleName: string
): Promise<{ role: string; direct: string[]; inherited: string[]; effective: string[] }> {
  const empty = { role: roleName, direct: [], inherited: [], effective: [] };
  try {
    await ensureGovernanceSchema(pool);
    const roles = (await pool.query(`SELECT id, role_name FROM role_definitions`)).rows;
    const idByName = new Map<string, string>(roles.map((r: any) => [r.role_name, r.id]));
    const nameById = new Map<string, string>(roles.map((r: any) => [r.id, r.role_name]));
    const rootId = idByName.get(roleName);
    if (!rootId) return empty;

    const edges = (await pool.query(`SELECT parent_role_id, child_role_id FROM rbac_role_hierarchies`)).rows;
    const children = new Map<string, string[]>();
    for (const e of edges) {
      const arr = children.get(e.parent_role_id) || [];
      arr.push(e.child_role_id);
      children.set(e.parent_role_id, arr);
    }
    // BFS over descendants
    const descendants = new Set<string>();
    const queue = [...(children.get(rootId) || [])];
    while (queue.length) {
      const n = queue.shift()!;
      if (descendants.has(n) || n === rootId) continue;
      descendants.add(n);
      for (const c of children.get(n) || []) queue.push(c);
    }

    const grantRows = (
      await pool.query(
        `SELECT rp.role_id, pd.permission_key
         FROM role_permissions rp JOIN permission_definitions pd ON pd.id = rp.permission_id`
      )
    ).rows;
    const direct = new Set<string>();
    const inherited = new Set<string>();
    for (const g of grantRows) {
      if (g.role_id === rootId) direct.add(g.permission_key);
      else if (descendants.has(g.role_id)) inherited.add(g.permission_key);
    }
    const effective = new Set<string>([...direct, ...inherited]);
    void nameById;
    return {
      role: roleName,
      direct: [...direct].sort(),
      inherited: [...inherited].filter((k) => !direct.has(k)).sort(),
      effective: [...effective].sort(),
    };
  } catch {
    return empty;
  }
}

export async function getPermissionMatrix(pool: Pool): Promise<any> {
  const [roles, permissions, groups] = await Promise.all([
    listRoles(pool),
    listPermissions(pool),
    listGroups(pool),
  ]);
  let grants: any[] = [];
  try {
    grants = (await pool.query(`SELECT role_id, permission_id FROM role_permissions`)).rows;
  } catch {
    grants = [];
  }
  return {
    roles,
    permissions,
    groups,
    grants,
    populated: roles.length > 0 && grants.length > 0,
    honesty:
      "Formal RBAC definitions. Live enforcement remains the single super_admin gate on /api/admin/*; these grants are advisory and are not the runtime authorization path.",
  };
}

// Grant / revoke a permission to a role. Fail-closed (throws on bad input);
// audited as a permission_change.
export async function grantPermission(
  pool: Pool,
  roleId: string,
  permissionId: string,
  actor: { id?: string | null }
): Promise<void> {
  await ensureGovernanceSchema(pool);
  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id, granted_by)
     VALUES ($1,$2,$3) ON CONFLICT (role_id, permission_id) DO NOTHING`,
    [roleId, permissionId, actor.id ?? null]
  );
  await recordGovernanceAudit(pool, {
    category: "permission_change",
    adminUserId: actor.id ?? null,
    targetType: "role_permissions",
    targetId: roleId,
    newState: { roleId, permissionId, op: "grant" },
  });
}

export async function revokePermission(
  pool: Pool,
  roleId: string,
  permissionId: string,
  actor: { id?: string | null }
): Promise<void> {
  await ensureGovernanceSchema(pool);
  await pool.query(`DELETE FROM role_permissions WHERE role_id=$1 AND permission_id=$2`, [roleId, permissionId]);
  await recordGovernanceAudit(pool, {
    category: "permission_change",
    adminUserId: actor.id ?? null,
    targetType: "role_permissions",
    targetId: roleId,
    previousState: { roleId, permissionId, op: "revoke" },
  });
}
