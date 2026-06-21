/**
 * Phase 6.11 — Multi-Tenant Architecture · tenant_configuration engine (READ-ONLY, compose-only).
 *
 * Surfaces per-tenant configuration by COMPOSING existing config substrate: subscription_tier
 * entitlements + seat caps (max_users) from `tenants`, white-label `tenant_branding` /
 * `tenant_permissions` (when present — they are lazily created by vx-tenant-configuration), and the new
 * partner/franchise/channel relationship config. GET-NEVER-WRITES: to_regclass probes only, NO DDL.
 * Never fabricates — absent config tables render as "not configured", not as defaults.
 */
import pg from 'pg';

const N = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function exists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    return r.rows[0]?.reg != null;
  } catch {
    return false;
  }
}

export interface TenantConfiguration {
  generated_at: string;
  degraded: boolean;
  substrate: {
    branding_table: boolean;
    permissions_table: boolean;
    agreements_table: boolean;
    referrals_table: boolean;
    relationships_table: boolean;
  };
  tier_distribution: { tier: string; tenants: number; seats: number }[];
  tenants: {
    id: number;
    tenant_code: string;
    tenant_name: string;
    subscription_tier: string | null;
    max_users: number;
    active_users: number;
    seat_utilization_pct: number | null;
    seat_status: 'ok' | 'near_cap' | 'over_cap' | 'no_cap';
    has_branding: boolean;
    permission_count: number | null;
    partner_agreements: number;
    channel_referrals: number;
    child_tenants: number;
  }[];
  notes: string[];
}

export async function buildTenantConfiguration(pool: pg.Pool): Promise<TenantConfiguration> {
  const notes: string[] = [];
  let degraded = false;
  const generated_at = new Date().toISOString();

  const hasTenants = await exists(pool, 'tenants');
  const hasBranding = await exists(pool, 'tenant_branding');
  const hasPermissions = await exists(pool, 'tenant_permissions');
  const hasAgreements = await exists(pool, 'tenant_partner_agreements');
  const hasReferrals = await exists(pool, 'tenant_channel_referrals');
  const hasRelationships = await exists(pool, 'tenant_relationships');

  const substrate = {
    branding_table: hasBranding,
    permissions_table: hasPermissions,
    agreements_table: hasAgreements,
    referrals_table: hasReferrals,
    relationships_table: hasRelationships,
  };

  if (!hasTenants) {
    return {
      generated_at, degraded: true, substrate,
      tier_distribution: [], tenants: [],
      notes: ['tenants table not present — no configuration to surface.'],
    };
  }
  if (!hasBranding && !hasPermissions) {
    notes.push('tenant_branding / tenant_permissions not present yet (created lazily by the white-label config console) — branding/permission columns render as not configured.');
  }

  let tenantRows: any[] = [];
  try {
    const r = await pool.query(
      `SELECT id, tenant_code, tenant_name, subscription_tier,
              COALESCE(max_users, 0) AS max_users, COALESCE(active_users, 0) AS active_users
         FROM tenants ORDER BY tenant_name ASC`);
    tenantRows = r.rows;
  } catch {
    degraded = true;
    notes.push('tenants table unreadable — degraded.');
  }

  // Branding presence by tenant.
  const brandedTenants = new Set<number>();
  if (hasBranding) {
    try {
      const r = await pool.query(`SELECT DISTINCT tenant_id FROM tenant_branding`);
      for (const row of r.rows) brandedTenants.add(N(row.tenant_id));
    } catch { degraded = true; }
  }

  // Permission counts by tenant.
  const permByTenant = new Map<number, number>();
  if (hasPermissions) {
    try {
      const r = await pool.query(`SELECT tenant_id, COUNT(*)::int AS n FROM tenant_permissions GROUP BY tenant_id`);
      for (const row of r.rows) permByTenant.set(N(row.tenant_id), N(row.n));
    } catch { degraded = true; }
  }

  const agreementsByTenant = new Map<number, number>();
  if (hasAgreements) {
    try {
      const r = await pool.query(`SELECT tenant_id, COUNT(*)::int AS n FROM tenant_partner_agreements GROUP BY tenant_id`);
      for (const row of r.rows) agreementsByTenant.set(N(row.tenant_id), N(row.n));
    } catch { degraded = true; }
  }
  const referralsByTenant = new Map<number, number>();
  if (hasReferrals) {
    try {
      const r = await pool.query(`SELECT channel_partner_tenant_id AS tid, COUNT(*)::int AS n FROM tenant_channel_referrals GROUP BY channel_partner_tenant_id`);
      for (const row of r.rows) referralsByTenant.set(N(row.tid), N(row.n));
    } catch { degraded = true; }
  }
  const childByTenant = new Map<number, number>();
  if (hasRelationships) {
    try {
      const r = await pool.query(`SELECT parent_tenant_id AS pid, COUNT(*)::int AS n FROM tenant_relationships GROUP BY parent_tenant_id`);
      for (const row of r.rows) childByTenant.set(N(row.pid), N(row.n));
    } catch { degraded = true; }
  }

  const tenants = tenantRows.map((t) => {
    const id = N(t.id);
    const maxUsers = N(t.max_users);
    const activeUsers = N(t.active_users);
    const util = maxUsers > 0 ? Math.round((activeUsers / maxUsers) * 1000) / 10 : null;
    let seat_status: 'ok' | 'near_cap' | 'over_cap' | 'no_cap';
    if (maxUsers <= 0) seat_status = 'no_cap';
    else if (activeUsers > maxUsers) seat_status = 'over_cap';
    else if (util != null && util >= 90) seat_status = 'near_cap';
    else seat_status = 'ok';
    return {
      id,
      tenant_code: String(t.tenant_code ?? ''),
      tenant_name: String(t.tenant_name ?? ''),
      subscription_tier: t.subscription_tier ?? null,
      max_users: maxUsers,
      active_users: activeUsers,
      seat_utilization_pct: util,
      seat_status,
      has_branding: brandedTenants.has(id),
      permission_count: hasPermissions ? (permByTenant.get(id) ?? 0) : null,
      partner_agreements: agreementsByTenant.get(id) ?? 0,
      channel_referrals: referralsByTenant.get(id) ?? 0,
      child_tenants: childByTenant.get(id) ?? 0,
    };
  });

  // Tier distribution.
  const tierMap = new Map<string, { tenants: number; seats: number }>();
  for (const t of tenants) {
    const tier = t.subscription_tier ?? 'unset';
    const agg = tierMap.get(tier) ?? { tenants: 0, seats: 0 };
    agg.tenants += 1;
    agg.seats += t.max_users;
    tierMap.set(tier, agg);
  }
  const tier_distribution = [...tierMap.entries()]
    .map(([tier, v]) => ({ tier, ...v }))
    .sort((a, b) => b.tenants - a.tenants);

  return { generated_at, degraded, substrate, tier_distribution, tenants, notes };
}
