/**
 * Phase 5 — RBAC + Tenant Isolation engine.
 *
 * Roles carry permissions (e.g. 'enterprise:read', 'wos:write', 'platform:*').
 * Permission check supports wildcards via ':' segments.
 * Assignments are tenant-scoped (NULL tenant = platform-wide).
 */

import type { Pool, PoolClient } from 'pg';

export const RBAC_TENANT_VERSION = '5.0.0';

export interface RoleRow {
  id: string; role_name: string; description: string | null;
  is_system: boolean; permissions: string[];
}

export interface AssignmentRow {
  id: number; user_id: string; role_id: string; tenant_id: number | null;
  granted_by: string | null; granted_at: string; expires_at: string | null; active: boolean;
}

export async function listRoles(pool: Pool): Promise<RoleRow[]> {
  const { rows } = await pool.query<RoleRow>(
    `SELECT id, role_name, description, is_system, permissions
       FROM wos_roles ORDER BY is_system DESC, id`);
  return rows;
}

export async function listAssignments(
  pool: Pool, opts: { user_id?: string; tenant_id?: number; active?: boolean } = {},
): Promise<AssignmentRow[]> {
  const where: string[] = ['1=1']; const params: any[] = [];
  if (opts.user_id) { params.push(opts.user_id); where.push(`user_id = $${params.length}`); }
  if (opts.tenant_id != null) { params.push(opts.tenant_id); where.push(`tenant_id = $${params.length}`); }
  if (opts.active != null) { params.push(opts.active); where.push(`active = $${params.length}`); }
  const { rows } = await pool.query<AssignmentRow>(
    `SELECT id, user_id, role_id, tenant_id, granted_by, granted_at, expires_at, active
       FROM wos_role_assignments WHERE ${where.join(' AND ')}
      ORDER BY granted_at DESC`, params);
  return rows;
}

export async function assignRole(pool: Pool, args: {
  user_id: string; role_id: string; tenant_id?: number | null;
  granted_by: string; expires_at?: string | null;
}): Promise<{ id: number }> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO wos_role_assignments
       (user_id, role_id, tenant_id, granted_by, expires_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, role_id, tenant_id) DO UPDATE
        SET active = TRUE, granted_by = EXCLUDED.granted_by,
            granted_at = NOW(), expires_at = EXCLUDED.expires_at
     RETURNING id`,
    [args.user_id, args.role_id, args.tenant_id ?? null, args.granted_by, args.expires_at ?? null]);
  return { id: Number(rows[0].id) };
}

export async function revokeAssignment(pool: Pool, id: number): Promise<{ ok: true }> {
  await pool.query(`UPDATE wos_role_assignments SET active = FALSE WHERE id = $1`, [id]);
  return { ok: true };
}

/** Resolve effective permissions for a user (optionally scoped to a tenant).
 *  Returns BOTH the platform-wide grants (tenant_id IS NULL assignments) and
 *  the tenant-scoped grants separately so the matcher can refuse to honour
 *  `platform:*` from a tenant-scoped role. */
export async function effectivePermissions(
  pool: Pool, userId: string, tenantId?: number | null,
): Promise<{ permissions: string[]; roles: string[]; scoped_tenant_id: number | null;
            platform_permissions: string[]; tenant_permissions: string[] }> {
  const params: any[] = [userId];
  let tenantClause = '';
  if (tenantId != null) {
    params.push(tenantId);
    tenantClause = `AND (a.tenant_id IS NULL OR a.tenant_id = $${params.length})`;
  }
  const { rows } = await pool.query<{ role_id: string; permissions: string[]; tenant_id: number | null }>(
    `SELECT a.role_id, r.permissions, a.tenant_id
       FROM wos_role_assignments a
       JOIN wos_roles r ON r.id = a.role_id
      WHERE a.user_id = $1 AND a.active = TRUE
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        ${tenantClause}`,
    params);
  const platformSet = new Set<string>();
  const tenantSet = new Set<string>();
  const roles: string[] = [];
  for (const r of rows) {
    roles.push(r.role_id);
    const bucket = r.tenant_id == null ? platformSet : tenantSet;
    for (const p of r.permissions ?? []) bucket.add(p);
  }
  return {
    permissions: Array.from(new Set([...platformSet, ...tenantSet])),
    platform_permissions: Array.from(platformSet),
    tenant_permissions: Array.from(tenantSet),
    roles,
    scoped_tenant_id: tenantId ?? null,
  };
}

/** Permission match supporting ':*' wildcards. */
export function hasPermission(granted: string[], required: string): boolean {
  if (granted.includes(required)) return true;
  const segs = required.split(':');
  // Walk progressively: 'enterprise:write' matches granted 'enterprise:*'
  for (let i = segs.length - 1; i >= 1; i--) {
    const wildcard = segs.slice(0, i).join(':') + ':*';
    if (granted.includes(wildcard)) return true;
  }
  return false;
}

/** Permission check that refuses to honour `platform:*` from a tenant-scoped
 *  grant. Required permissions starting with `platform:` MUST be satisfied
 *  by the platform-wide set; everything else may be satisfied by either. */
export function hasPermissionScoped(
  platformGranted: string[], tenantGranted: string[], required: string,
): boolean {
  if (required.startsWith('platform:')) {
    return hasPermission(platformGranted, required);
  }
  if (hasPermission(platformGranted, required)) return true;
  // `platform:*` from platform-wide grant satisfies any non-platform check
  if (platformGranted.includes('platform:*')) return true;
  return hasPermission(tenantGranted, required);
}

export async function userHasPermission(
  pool: Pool, userId: string, required: string, tenantId?: number | null,
): Promise<boolean> {
  const eff = await effectivePermissions(pool, userId, tenantId);
  return hasPermissionScoped(eff.platform_permissions, eff.tenant_permissions, required);
}

// ── Tenant utilities ─────────────────────────────────────────────────────

export async function listTenants(pool: Pool) {
  const { rows } = await pool.query(
    `SELECT id, tenant_code, tenant_name, tenant_type, subscription_tier, max_users
       FROM tenants ORDER BY id`);
  return rows;
}

/** Best-effort tenant resolver from session/header. */
export function resolveTenantFromRequest(req: any): number | null {
  const h = req?.headers?.['x-tenant-id'];
  const u = req?.user?.tenant_id ?? req?.user?.tenantId ?? null;
  const candidate = h ?? u;
  if (candidate == null) return null;
  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Acquire a connection with `application_name` tagged to the tenant for
 *  audit visibility. Caller MUST release. */
export async function tenantConnection(pool: Pool, tenantId: number | null): Promise<PoolClient> {
  const client = await pool.connect();
  if (tenantId != null) {
    try {
      await client.query(`SET LOCAL application_name = $1`, [`tenant:${tenantId}`]);
    } catch { /* SET LOCAL needs a tx; ignore in pooled context */ }
  }
  return client;
}
