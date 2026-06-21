/**
 * Phase 6.11 — Multi-Tenant Architecture · tenant_isolation ENFORCEMENT (opt-in, flag-gated).
 *
 * True query-level isolation conflicts with "byte-identical when flag-off", so enforcement is delivered
 * as an OPT-IN mechanism behind a separate sub-flag (`tenantIsolationEnforcement`, default OFF). It does
 * NOT rewrite any existing query path. Two real, reversible primitives are provided:
 *
 *   1. A tenant-scoping guard middleware factory (createTenantScopeGuard) — NOT wired globally. Callers
 *      may opt a route in; with the sub-flag off it is a pass-through.
 *   2. RLS policy arming on the FOUR ADDITIVE relationship tables ONLY (never the legacy substrate), so
 *      arming can never alter legacy behaviour. Policies are PERMISSIVE and admin-context-bypassing
 *      (no `app.tenant_id` GUC ⇒ full access), so the read-only super-admin console keeps working.
 *
 * HONESTY: the app connects as the table owner, and a non-FORCE RLS policy does not constrain the owner.
 * We therefore enable RLS WITHOUT FORCE (safe) and the status view states plainly that real per-tenant
 * enforcement additionally requires a non-owner scoped role + FORCE — we never claim enforcement is live
 * when it is not.
 */
import pg from 'pg';
import {
  ensureTenantRelationshipSchema,
  TENANT_RELATIONSHIP_TABLES,
} from './tenant-relationship-schema';
import { isTenantIsolationEnforcementEnabled } from '../../config/feature-flags';

// Only tables carrying a literal `tenant_id` column can take the tenant-scoping policy.
const RLS_TABLES = ['tenant_category_assignments', 'tenant_partner_agreements'] as const;
const POLICY = (t: string) => `tenant_scope_${t}`;

export interface EnforcementStatus {
  generated_at: string;
  enforcement_flag: boolean;
  guard_available: boolean;
  tables: {
    table: string;
    exists: boolean;
    rls_enabled: boolean;
    rls_forced: boolean;
    policies: string[];
    armed: boolean;
  }[];
  armed_count: number;
  armable_count: number;
  notes: string[];
}

async function exists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    return r.rows[0]?.reg != null;
  } catch {
    return false;
  }
}

export async function getEnforcementStatus(pool: pg.Pool): Promise<EnforcementStatus> {
  const notes: string[] = [];
  const flag = isTenantIsolationEnforcementEnabled();
  const tables: EnforcementStatus['tables'] = [];

  for (const t of RLS_TABLES) {
    const present = await exists(pool, t);
    let rlsEnabled = false;
    let rlsForced = false;
    let policies: string[] = [];
    if (present) {
      try {
        const r = await pool.query(
          `SELECT c.relrowsecurity AS en, c.relforcerowsecurity AS forced
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = $1`, [t]);
        rlsEnabled = Boolean(r.rows[0]?.en);
        rlsForced = Boolean(r.rows[0]?.forced);
      } catch { /* honest false */ }
      try {
        const r = await pool.query(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=$1`, [t]);
        policies = r.rows.map((row) => String(row.policyname));
      } catch { /* honest empty */ }
    }
    tables.push({
      table: t,
      exists: present,
      rls_enabled: rlsEnabled,
      rls_forced: rlsForced,
      policies,
      armed: rlsEnabled && policies.includes(POLICY(t)),
    });
  }

  const armed_count = tables.filter((t) => t.armed).length;
  notes.push('Enforcement is opt-in and applied ONLY to the additive relationship tables — no existing query path is rewritten (byte-identical legacy when off).');
  notes.push('Policies bypass admin context (no app.tenant_id GUC ⇒ full access). Real per-tenant enforcement additionally requires a non-owner scoped DB role + FORCE ROW LEVEL SECURITY.');
  if (!flag) notes.push('tenantIsolationEnforcement sub-flag is OFF — arming is blocked; this is a status preview only.');

  return {
    generated_at: new Date().toISOString(),
    enforcement_flag: flag,
    guard_available: true,
    tables,
    armed_count,
    armable_count: RLS_TABLES.length,
    notes,
  };
}

/** POST-path only. Arms RLS on the additive relationship tables. No-op / throws guidance if flag off. */
export async function armTenantIsolationEnforcement(pool: pg.Pool): Promise<EnforcementStatus> {
  if (!isTenantIsolationEnforcementEnabled()) {
    throw new Error('tenantIsolationEnforcement sub-flag is OFF — refusing to arm.');
  }
  await ensureTenantRelationshipSchema(pool);
  for (const t of RLS_TABLES) {
    const ident = '"' + t.replace(/"/g, '""') + '"';
    await pool.query(`ALTER TABLE ${ident} ENABLE ROW LEVEL SECURITY`);
    // Idempotent: drop-then-create the canonical tenant-scope policy.
    await pool.query(`DROP POLICY IF EXISTS ${POLICY(t)} ON ${ident}`);
    await pool.query(`
      CREATE POLICY ${POLICY(t)} ON ${ident}
      USING (
        current_setting('app.tenant_id', true) IS NULL
        OR current_setting('app.tenant_id', true) = ''
        OR tenant_id::text = current_setting('app.tenant_id', true)
      )`);
  }
  return getEnforcementStatus(pool);
}

/** POST-path only. Reverses arming (drops policies + disables RLS) — restores byte-identical posture. */
export async function disarmTenantIsolationEnforcement(pool: pg.Pool): Promise<EnforcementStatus> {
  for (const t of RLS_TABLES) {
    const present = await exists(pool, t);
    if (!present) continue;
    const ident = '"' + t.replace(/"/g, '""') + '"';
    await pool.query(`DROP POLICY IF EXISTS ${POLICY(t)} ON ${ident}`);
    await pool.query(`ALTER TABLE ${ident} DISABLE ROW LEVEL SECURITY`);
  }
  return getEnforcementStatus(pool);
}

/**
 * Opt-in tenant-scoping guard middleware factory. NOT wired into any existing route. With the sub-flag
 * off it is a pass-through. When on, it resolves the tenant from the request and exposes it on
 * req.enforcedTenantId for downstream handlers that explicitly opt in — it never mutates global state.
 */
export function createTenantScopeGuard(resolveTenant: (req: any) => number | string | null) {
  return function tenantScopeGuard(req: any, _res: any, next: any) {
    if (!isTenantIsolationEnforcementEnabled()) return next();
    try {
      req.enforcedTenantId = resolveTenant(req);
    } catch {
      req.enforcedTenantId = null;
    }
    next();
  };
}

export { TENANT_RELATIONSHIP_TABLES };
