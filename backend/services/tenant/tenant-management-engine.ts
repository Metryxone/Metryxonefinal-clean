/**
 * Phase 6.11 — Multi-Tenant Architecture · tenant_management engine (READ-ONLY, compose-never-recompute).
 *
 * Folds the EXISTING `tenants` table + the additive relationship rows (categories, hierarchy,
 * agreements, channel referrals) into a unified management view across the FIVE first-class
 * categories — Institutions, Employers, Partners, Franchise, Channel Partners.
 *
 * GET-NEVER-WRITES: probes every table with to_regclass and degrades to honest empties; runs NO DDL.
 * Never fabricates — absent substrate is reported as absent, counts come from real rows only.
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

/** Map a raw tenants.tenant_type onto one of the five canonical management categories. */
function categoryForType(t: string | null): string {
  switch ((t || '').toLowerCase()) {
    case 'school':
    case 'university':
    case 'college':
    case 'skilling':
    case 'ngo':
    case 'government':
      return 'institution';
    case 'enterprise':
    case 'employer':
    case 'company':
      return 'employer';
    case 'agency':
    case 'partner':
      return 'partner';
    case 'franchise':
      return 'franchise';
    case 'channel':
    case 'channel_partner':
      return 'channel_partner';
    default:
      return 'institution';
  }
}

const CATEGORIES = ['institution', 'employer', 'partner', 'franchise', 'channel_partner'] as const;

export interface TenantManagement {
  generated_at: string;
  degraded: boolean;
  headline: {
    total_tenants: number;
    active_tenants: number;
    total_seats: number;
    active_users: number;
    seat_utilization_pct: number | null;
    relationships: number;
    partner_agreements: number;
    channel_referrals: number;
  };
  categories: { category: string; tenants: number; active: number; seats: number; active_users: number }[];
  tenants: {
    id: number;
    tenant_code: string;
    tenant_name: string;
    tenant_type: string | null;
    category: string;
    extra_categories: string[];
    subscription_tier: string | null;
    max_users: number;
    active_users: number;
    seat_utilization_pct: number | null;
    is_active: boolean;
    parent_count: number;
    child_count: number;
    partner_agreements: number;
    channel_referrals: number;
  }[];
  relationships: {
    id: number;
    parent_tenant_id: number;
    parent_name: string | null;
    child_tenant_id: number;
    child_name: string | null;
    relationship_type: string;
    status: string;
  }[];
  notes: string[];
}

export async function buildTenantManagement(pool: pg.Pool): Promise<TenantManagement> {
  const notes: string[] = [];
  let degraded = false;
  const generated_at = new Date().toISOString();

  const hasTenants = await exists(pool, 'tenants');
  if (!hasTenants) {
    return {
      generated_at,
      degraded: true,
      headline: {
        total_tenants: 0, active_tenants: 0, total_seats: 0, active_users: 0,
        seat_utilization_pct: null, relationships: 0, partner_agreements: 0, channel_referrals: 0,
      },
      categories: CATEGORIES.map((c) => ({ category: c, tenants: 0, active: 0, seats: 0, active_users: 0 })),
      tenants: [],
      relationships: [],
      notes: ['tenants table not present — no tenant substrate to manage yet.'],
    };
  }

  // Base tenant rows.
  let tenantRows: any[] = [];
  try {
    const r = await pool.query(
      `SELECT id, tenant_code, tenant_name, tenant_type, subscription_tier,
              COALESCE(max_users, 0) AS max_users, COALESCE(active_users, 0) AS active_users, is_active
         FROM tenants ORDER BY tenant_name ASC`,
    );
    tenantRows = r.rows;
  } catch (e) {
    degraded = true;
    notes.push('tenants table present but unreadable — degraded.');
  }

  // Additive relationship substrate (honest empties when absent).
  const hasCategories = await exists(pool, 'tenant_category_assignments');
  const hasRelationships = await exists(pool, 'tenant_relationships');
  const hasAgreements = await exists(pool, 'tenant_partner_agreements');
  const hasReferrals = await exists(pool, 'tenant_channel_referrals');
  if (!hasCategories && !hasRelationships && !hasAgreements && !hasReferrals) {
    notes.push('Relationship models not yet provisioned — run console setup (POST) to enable partner/franchise/channel relationships.');
  }

  const extraCatByTenant = new Map<number, string[]>();
  if (hasCategories) {
    try {
      const r = await pool.query(`SELECT tenant_id, category FROM tenant_category_assignments`);
      for (const row of r.rows) {
        const arr = extraCatByTenant.get(N(row.tenant_id)) ?? [];
        arr.push(String(row.category));
        extraCatByTenant.set(N(row.tenant_id), arr);
      }
    } catch { degraded = true; }
  }

  const childCount = new Map<number, number>();
  const parentCount = new Map<number, number>();
  let relationships: TenantManagement['relationships'] = [];
  if (hasRelationships) {
    try {
      const r = await pool.query(`
        SELECT r.id, r.parent_tenant_id, r.child_tenant_id, r.relationship_type, r.status,
               p.tenant_name AS parent_name, c.tenant_name AS child_name
          FROM tenant_relationships r
          LEFT JOIN tenants p ON p.id = r.parent_tenant_id
          LEFT JOIN tenants c ON c.id = r.child_tenant_id
         ORDER BY r.created_at DESC LIMIT 500`);
      relationships = r.rows.map((row) => ({
        id: N(row.id),
        parent_tenant_id: N(row.parent_tenant_id),
        parent_name: row.parent_name ?? null,
        child_tenant_id: N(row.child_tenant_id),
        child_name: row.child_name ?? null,
        relationship_type: String(row.relationship_type),
        status: String(row.status),
      }));
      for (const rel of relationships) {
        childCount.set(rel.parent_tenant_id, (childCount.get(rel.parent_tenant_id) ?? 0) + 1);
        parentCount.set(rel.child_tenant_id, (parentCount.get(rel.child_tenant_id) ?? 0) + 1);
      }
    } catch { degraded = true; }
  }

  const agreementsByTenant = new Map<number, number>();
  let agreementsTotal = 0;
  if (hasAgreements) {
    try {
      const r = await pool.query(`SELECT tenant_id, COUNT(*)::int AS n FROM tenant_partner_agreements GROUP BY tenant_id`);
      for (const row of r.rows) { agreementsByTenant.set(N(row.tenant_id), N(row.n)); agreementsTotal += N(row.n); }
    } catch { degraded = true; }
  }

  const referralsByTenant = new Map<number, number>();
  let referralsTotal = 0;
  if (hasReferrals) {
    try {
      const r = await pool.query(`SELECT channel_partner_tenant_id AS tid, COUNT(*)::int AS n FROM tenant_channel_referrals GROUP BY channel_partner_tenant_id`);
      for (const row of r.rows) { referralsByTenant.set(N(row.tid), N(row.n)); referralsTotal += N(row.n); }
    } catch { degraded = true; }
  }

  // Compose per-tenant view.
  const tenants = tenantRows.map((t) => {
    const id = N(t.id);
    const maxUsers = N(t.max_users);
    const activeUsers = N(t.active_users);
    const extra = extraCatByTenant.get(id) ?? [];
    // Primary category: an explicit primary assignment wins, else derive from tenant_type.
    const category = extra.length ? extra[0] : categoryForType(t.tenant_type);
    return {
      id,
      tenant_code: String(t.tenant_code ?? ''),
      tenant_name: String(t.tenant_name ?? ''),
      tenant_type: t.tenant_type ?? null,
      category,
      extra_categories: extra,
      subscription_tier: t.subscription_tier ?? null,
      max_users: maxUsers,
      active_users: activeUsers,
      seat_utilization_pct: maxUsers > 0 ? Math.round((activeUsers / maxUsers) * 1000) / 10 : null,
      is_active: Boolean(t.is_active),
      parent_count: parentCount.get(id) ?? 0,
      child_count: childCount.get(id) ?? 0,
      partner_agreements: agreementsByTenant.get(id) ?? 0,
      channel_referrals: referralsByTenant.get(id) ?? 0,
    };
  });

  // Category rollup (a tenant counts in its primary category + any explicit extra categories).
  const catMap = new Map<string, { tenants: number; active: number; seats: number; active_users: number }>();
  for (const c of CATEGORIES) catMap.set(c, { tenants: 0, active: 0, seats: 0, active_users: 0 });
  for (const t of tenants) {
    const cats = new Set<string>([t.category, ...t.extra_categories].filter((c) => (CATEGORIES as readonly string[]).includes(c)));
    for (const c of cats) {
      const agg = catMap.get(c)!;
      agg.tenants += 1;
      if (t.is_active) agg.active += 1;
      agg.seats += t.max_users;
      agg.active_users += t.active_users;
    }
  }

  const totalSeats = tenants.reduce((s, t) => s + t.max_users, 0);
  const activeUsers = tenants.reduce((s, t) => s + t.active_users, 0);

  return {
    generated_at,
    degraded,
    headline: {
      total_tenants: tenants.length,
      active_tenants: tenants.filter((t) => t.is_active).length,
      total_seats: totalSeats,
      active_users: activeUsers,
      seat_utilization_pct: totalSeats > 0 ? Math.round((activeUsers / totalSeats) * 1000) / 10 : null,
      relationships: relationships.length,
      partner_agreements: agreementsTotal,
      channel_referrals: referralsTotal,
    },
    categories: CATEGORIES.map((c) => ({ category: c, ...catMap.get(c)! })),
    tenants,
    relationships,
    notes,
  };
}
