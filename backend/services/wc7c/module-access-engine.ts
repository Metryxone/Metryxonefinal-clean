/**
 * Phase 6.4 — Entitlement Engine · `entitlement_engine` deliverable.
 *
 * Defines the PRODUCT-MODULE vocabulary (the 7 controllable surfaces) and the resolver
 * `deriveModuleAccess(pool, email)` that answers "which product modules does this billing
 * identity own?".
 *
 * COMPOSE-NEVER-RECOMPUTE: this reuses the EXISTING commercial entitlement substrate —
 *   - plan-level module entitlements via `comm_plan_entitlements` (FK → comm_features.code),
 *     joined through `comm_subscriptions` / `comm_customers` for the identity's active plans;
 *   - per-email module grants via `comm_entitlement_grants` (manual super-admin overrides),
 *     where the grant `feature` string equals a module code.
 *   It does NOT build a parallel entitlement store and introduces NO new schema (the optional
 *   `ensureModuleRegistry` only seeds registry rows into the pre-existing comm_features table).
 *
 * Note on composition choice: we read comm_plan_entitlements + comm_entitlement_grants DIRECTLY
 * rather than `deriveEntitlement()` — the latter's grant union is gated by the
 * `commercialEntitlementClasses` flag and is scoped to CAPADEX stage/feature-class entitlement,
 * which does not fit per-module access. We reuse the same SUBSTRATE (tables + grant model), not a
 * parallel store, so this stays compose-not-rebuild.
 *
 * FAIL-CLOSED + HONEST-ABSENCE:
 *   - A table that does not exist (commercial substrate never provisioned) → that source
 *     contributes the empty set (an honest "owns nothing"), NOT a degraded fault.
 *   - A genuine query error against an EXISTING table → `degraded = true` (a ledger fault is
 *     never silently read as "owns nothing"); the caller maps degraded → 503.
 *   - No billing identity (no email) → empty, `has_identity = false`.
 *   Never fabricates ownership.
 */
import type { Pool } from 'pg';

export const MODULE_CODES = [
  'competency_assessments',
  'employability_index',
  'career_builder',
  'career_passport',
  'employer_portal',
  'analytics',
  'workforce_intelligence',
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

export interface ModuleDefinition {
  code: ModuleCode;
  name: string;
  description: string;
  /** 'individual' = keyed by the signed-in person; 'employer' = org-facing surface (still
   *  email-keyed in Phase 6.4 per the approved decision; org-level keying is a future layer). */
  surface: 'individual' | 'employer';
  /** Express route prefix the access_control_engine mounts its gate on. */
  route_prefix: string;
}

export const MODULE_REGISTRY: Record<ModuleCode, ModuleDefinition> = {
  competency_assessments: {
    code: 'competency_assessments',
    name: 'Competency Assessments',
    description: 'Adaptive competency assessment runtime and scoring.',
    surface: 'individual',
    route_prefix: '/api/competency',
  },
  employability_index: {
    code: 'employability_index',
    name: 'Employability Index (EI)',
    description: 'Employability Index profiles, dimensions and intelligence.',
    surface: 'individual',
    route_prefix: '/api/competency-ei',
  },
  career_builder: {
    code: 'career_builder',
    name: 'Career Builder',
    description: 'Career intelligence: readiness, gap, match, roadmap and recommendations.',
    surface: 'individual',
    route_prefix: '/api/career/intelligence',
  },
  career_passport: {
    code: 'career_passport',
    name: 'Career Passport',
    description: 'Career Passport authoring, sections and sharing.',
    surface: 'individual',
    route_prefix: '/api/passport',
  },
  employer_portal: {
    code: 'employer_portal',
    name: 'Employer Portal',
    description: 'Employer hiring workspace, candidates and postings.',
    surface: 'employer',
    route_prefix: '/api/employer',
  },
  analytics: {
    code: 'analytics',
    name: 'Enterprise Analytics',
    description: 'Enterprise analytics dashboards and reporting.',
    surface: 'employer',
    route_prefix: '/api/analytics',
  },
  workforce_intelligence: {
    code: 'workforce_intelligence',
    name: 'Workforce Intelligence',
    description: 'Workforce intelligence planning and insights.',
    surface: 'employer',
    route_prefix: '/api/workforce-intelligence',
  },
};

export function isModuleCode(v: unknown): v is ModuleCode {
  return typeof v === 'string' && (MODULE_CODES as readonly string[]).includes(v);
}

export interface ModuleAccessState {
  has_identity: boolean;
  email: string | null;
  /** Entitled module codes (union of plan + grant sources). */
  modules: ModuleCode[];
  sources: { plans: ModuleCode[]; grants: ModuleCode[] };
  degraded: boolean;
  reason: string;
  source: 'phase64_module_access';
}

async function tableExists(pool: Pool, qualifiedName: string): Promise<boolean> {
  const { rows } = await pool.query<{ t: string | null }>('SELECT to_regclass($1) AS t', [qualifiedName]);
  return !!rows[0]?.t;
}

/** Plan-derived module entitlements for the identity's active/trial subscriptions. */
async function loadPlanModules(pool: Pool, email: string): Promise<ModuleCode[]> {
  const have =
    (await tableExists(pool, 'comm_plan_entitlements')) &&
    (await tableExists(pool, 'comm_subscriptions')) &&
    (await tableExists(pool, 'comm_customers'));
  if (!have) return [];
  const { rows } = await pool.query<{ code: string }>(
    `SELECT DISTINCT pe.feature_code AS code
       FROM comm_subscriptions s
       JOIN comm_customers c          ON c.id = s.customer_id
       JOIN comm_plan_entitlements pe ON pe.plan_id = s.plan_id
      WHERE lower(c.email) = lower($1)
        AND s.status IN ('active', 'trial')
        AND (s.current_period_end IS NULL OR s.current_period_end >= now())`,
    [email],
  );
  return rows.map((r) => String(r.code)).filter(isModuleCode);
}

/** Per-email module grants (manual super-admin overrides whose feature string is a module code). */
async function loadGrantModules(pool: Pool, email: string): Promise<ModuleCode[]> {
  if (!(await tableExists(pool, 'comm_entitlement_grants'))) return [];
  const { rows } = await pool.query<{ feature: string }>(
    `SELECT DISTINCT feature
       FROM comm_entitlement_grants
      WHERE lower(email) = lower($1)
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at >= now())`,
    [email],
  );
  return rows.map((r) => String(r.feature)).filter(isModuleCode);
}

export async function deriveModuleAccess(pool: Pool, email: string | null): Promise<ModuleAccessState> {
  const base: ModuleAccessState = {
    has_identity: !!email,
    email: email ?? null,
    modules: [],
    sources: { plans: [], grants: [] },
    degraded: false,
    reason: 'no_billing_identity',
    source: 'phase64_module_access',
  };
  if (!email) return base;

  let planModules: ModuleCode[];
  let grantModules: ModuleCode[];
  try {
    planModules = await loadPlanModules(pool, email);
    grantModules = await loadGrantModules(pool, email);
  } catch {
    // An EXISTING table that failed to read is a ledger fault → fail closed (degraded), never "owns nothing".
    return { ...base, degraded: true, reason: 'entitlement_ledger_unavailable' };
  }

  const modules = Array.from(new Set<ModuleCode>([...planModules, ...grantModules])).sort();
  return {
    ...base,
    modules,
    sources: { plans: planModules.slice().sort(), grants: grantModules.slice().sort() },
    reason: modules.length > 0 ? 'entitled' : 'no_entitlement',
  };
}

export interface ModuleAccessOverview {
  generated_at: string;
  degraded: boolean;
  reason: string;
  total_identities_with_access: number;
  per_module: Array<{ module: ModuleCode; name: string; plan_identities: number; grant_identities: number }>;
  modules: ModuleDefinition[];
  source: 'phase64_module_access';
}

/** Admin coverage view: how many distinct billing identities currently own each module. */
export async function buildModuleAccessOverview(pool: Pool): Promise<ModuleAccessOverview> {
  const overview: ModuleAccessOverview = {
    generated_at: new Date().toISOString(),
    degraded: false,
    reason: 'ok',
    total_identities_with_access: 0,
    per_module: MODULE_CODES.map((m) => ({ module: m, name: MODULE_REGISTRY[m].name, plan_identities: 0, grant_identities: 0 })),
    modules: Object.values(MODULE_REGISTRY),
    source: 'phase64_module_access',
  };
  try {
    const planMap = new Map<ModuleCode, number>();
    const grantMap = new Map<ModuleCode, number>();
    const owners = new Set<string>();

    const havePlan =
      (await tableExists(pool, 'comm_plan_entitlements')) &&
      (await tableExists(pool, 'comm_subscriptions')) &&
      (await tableExists(pool, 'comm_customers'));
    if (havePlan) {
      const { rows } = await pool.query<{ code: string; n: string; emails: string[] }>(
        `SELECT pe.feature_code AS code,
                COUNT(DISTINCT lower(c.email)) AS n,
                array_agg(DISTINCT lower(c.email)) AS emails
           FROM comm_subscriptions s
           JOIN comm_customers c          ON c.id = s.customer_id
           JOIN comm_plan_entitlements pe ON pe.plan_id = s.plan_id
          WHERE s.status IN ('active', 'trial')
            AND (s.current_period_end IS NULL OR s.current_period_end >= now())
          GROUP BY pe.feature_code`,
      );
      for (const r of rows) {
        if (!isModuleCode(r.code)) continue;
        planMap.set(r.code, Number(r.n) || 0);
        for (const e of r.emails || []) if (e) owners.add(e);
      }
    }

    if (await tableExists(pool, 'comm_entitlement_grants')) {
      const { rows } = await pool.query<{ feature: string; n: string; emails: string[] }>(
        `SELECT feature,
                COUNT(DISTINCT lower(email)) AS n,
                array_agg(DISTINCT lower(email)) AS emails
           FROM comm_entitlement_grants
          WHERE status = 'active'
            AND (expires_at IS NULL OR expires_at >= now())
          GROUP BY feature`,
      );
      for (const r of rows) {
        if (!isModuleCode(r.feature)) continue;
        grantMap.set(r.feature, Number(r.n) || 0);
        for (const e of r.emails || []) if (e) owners.add(e);
      }
    }

    overview.per_module = MODULE_CODES.map((m) => ({
      module: m,
      name: MODULE_REGISTRY[m].name,
      plan_identities: planMap.get(m) || 0,
      grant_identities: grantMap.get(m) || 0,
    }));
    overview.total_identities_with_access = owners.size;
    return overview;
  } catch {
    return { ...overview, degraded: true, reason: 'entitlement_ledger_unavailable' };
  }
}

/**
 * Idempotent registry seed: ensure the 7 product modules exist as rows in the pre-existing
 * `comm_features` table so admins can map plans → modules (comm_plan_entitlements.feature_code
 * FK-references comm_features.code). feature_class is left NULL (the CHECK only permits the 7
 * generic action classes); modules are registry rows tagged via metadata.kind = 'module'.
 *
 * WRITE-PATH ONLY: callers must gate this behind the moduleAccessControl flag + a POST handler
 * (GET handlers never write). Requires the comm_features table to exist (architecture schema).
 */
export async function ensureModuleRegistry(pool: Pool): Promise<void> {
  if (!(await tableExists(pool, 'comm_features'))) return;
  for (let i = 0; i < MODULE_CODES.length; i++) {
    const code = MODULE_CODES[i];
    const def = MODULE_REGISTRY[code];
    await pool.query(
      `INSERT INTO comm_features (code, name, feature_class, description, sort_order, metadata)
       VALUES ($1, $2, NULL, $3, $4, $5::jsonb)
       ON CONFLICT (code) DO NOTHING`,
      [code, def.name, def.description, 1000 + i, JSON.stringify({ kind: 'module', surface: def.surface })],
    );
  }
}
