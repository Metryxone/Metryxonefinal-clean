/**
 * CAPADEX Commercial Wave 2 — Entitlement Engine.
 *
 * COMPOSE-ONLY · READ-ONLY · FAIL-CLOSED on the ledger · NEVER-THROWS at the aggregate boundary ·
 * NO NEW TABLES · NO new intelligence.
 *
 * Resolves what a billing identity is ENTITLED to by reading ONLY the live commercial substrate:
 *   • paid CAPADEX stages   — `capadex_payments` (status='paid'), the live Razorpay ladder, and
 *   • active package grants  — `student_subscriptions` (status='active', non-expired) → `subscription_packages`.
 * Owned stages map to entitled stage reports/features via a deterministic, in-lockstep table; the
 * entitlement is the UNION over owned stages (no implicit grant of an un-purchased stage).
 *
 * FAIL-CLOSED: a ledger READ FAILURE must NEVER be mistaken for "owns nothing" (that could wrongly
 * grant or withhold access) → the per-identity resolver returns `billing_ledger_unavailable`
 * (degraded, entitles nothing) and never fabricates ownership.
 *
 * STAGE_FEATURES mirrors STAGE_PRICES / LADDER in routes/capadex-payments.ts — keep in lockstep.
 */
import type { Pool } from 'pg';
import { isCommercialEntitlementClassesEnabled } from '../../config/feature-flags';
import { parsePlanFeatures, isFeatureClass, type FeatureClass } from '../commercial/plan-features';

// Per-stage entitlement — mirrors the live ladder SKUs (CAP_INS / CAP_GRW / CAP_MAS). Each paid
// stage unlocks its own report + features; entitlement is the UNION over owned stages.
export const STAGE_FEATURES: Record<string, string[]> = {
  CAP_INS: ['insight_report'],
  CAP_GRW: ['growth_report', 'growth_plan'],
  CAP_MAS: ['mastery_report', 'mentor_access'],
};
const LADDER = ['CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;

/**
 * The canonical *report* feature unlocked by owning each paid stage — the deterministic gate key
 * used by entitlement ENFORCEMENT (WC-C4 `requireEntitlement`). DERIVED from STAGE_FEATURES (kept
 * in lockstep automatically): the single `*_report` feature each paid stage grants
 * (CAP_INS→insight_report, CAP_GRW→growth_report, CAP_MAS→mastery_report). CAP_CUR (the free
 * curiosity tier) is intentionally absent → a CAP_CUR / unknown stage is never gated. A paid stage's
 * bundled non-report features (growth_plan / mentor_access) have NO dedicated endpoint and are
 * covered TRANSITIVELY: owning the stage to read its report ≡ owning that stage's bundled features.
 */
export const STAGE_REPORT_FEATURE: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_FEATURES)
    .map(([stage, feats]) => [stage, feats.find((f) => f.endsWith('_report'))] as const)
    .filter((e): e is readonly [string, string] => typeof e[1] === 'string'),
);

export interface EntitlementState {
  has_identity: boolean;
  owned_stages: string[];
  entitled_features: string[];
  reason: string;
  degraded: boolean;
  source: 'commercial_wave2_entitlement';
  /**
   * Task #7 (only present when `commercialEntitlementClasses` is ON) — the generalized feature
   * classes (views/searches/reports/exports/assessments/ai/api) UNION-ed onto `entitled_features`
   * from the identity's ACTIVE subscriptions + manual grants. Omitted (undefined) when the flag is
   * OFF → `entitled_features` is byte-identical (stage features only).
   */
  feature_classes?: FeatureClass[];
  class_sources?: { subscriptions: FeatureClass[]; grants: string[] };
}

export interface EntitlementOverview {
  generated_at: string;
  degraded: boolean;
  /** distinct emails with ≥1 paid payment row (the paying population). */
  paying_identities: number;
  /** distinct paid emails our resolver grants ≥1 feature to. */
  entitled_identities: number;
  /** entitled / paying. `null` when there are no paying identities (n/a — never reported as 100%). */
  coverage_pct: number | null;
  owned_stage_distribution: { stage: string; identities: number }[];
  /** active, non-expired package subscriptions system-wide (linked via student/child, not email). */
  active_package_grants: number;
}

// Reads owned (paid) stages for one identity. Deliberately does NOT swallow query errors — a read
// failure must not look like "owns nothing". The caller maps a throw to a degraded billing state.
async function loadOwnedStages(pool: Pool, email: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT stage_code FROM capadex_payments WHERE lower(email) = lower($1) AND status = 'paid'`,
    [email],
  );
  return rows.map((r) => String(r.stage_code)).filter(Boolean);
}

/**
 * Task #7 — feature classes a billing identity holds via its ACTIVE subscriptions (UNION over the
 * plans of every non-expired active/trial comm_subscription). Additive: a read failure or absent
 * table withholds the EXTRA classes (fail-closed for the extra grant) but NEVER denies the stage
 * entitlement — so it can't escalate to a 503 on the core enforcement path. Returns [] on any error.
 */
async function loadSubscriptionFeatureClasses(pool: Pool, email: string): Promise<FeatureClass[]> {
  try {
    const { rows } = await pool.query(
      `SELECT p.metadata
         FROM comm_subscriptions s
         JOIN comm_customers c ON c.id = s.customer_id
         JOIN comm_plans     p ON p.id = s.plan_id
        WHERE lower(c.email) = lower($1)
          AND s.status IN ('active','trial')
          AND (s.current_period_end IS NULL OR s.current_period_end >= now())`,
      [email],
    );
    const set = new Set<FeatureClass>();
    for (const r of rows) for (const f of parsePlanFeatures(r.metadata).feature_classes) set.add(f);
    return Array.from(set);
  } catch {
    return [];
  }
}

/** Task #7 — active super-admin manual grants for an identity. Additive; [] on any error. */
async function loadActiveGrants(pool: Pool, email: string): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT feature FROM comm_entitlement_grants
        WHERE lower(email) = lower($1) AND status = 'active'
          AND (expires_at IS NULL OR expires_at >= now())`,
      [email],
    );
    return rows.map((r) => String(r.feature)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Per-identity entitlement resolution. Fail-closed on a ledger read error. */
export async function deriveEntitlement(pool: Pool, email: string | null): Promise<EntitlementState> {
  const base: EntitlementState = {
    has_identity: !!email,
    owned_stages: [],
    entitled_features: [],
    reason: 'no_billing_identity',
    degraded: false,
    source: 'commercial_wave2_entitlement',
  };
  if (!email) return base;

  let owned: string[];
  try {
    owned = await loadOwnedStages(pool, email);
  } catch {
    // Live ledger unavailable → never fabricate ownership; entitle nothing, mark degraded.
    return { ...base, reason: 'billing_ledger_unavailable', degraded: true };
  }

  const stageFeatures = Array.from(new Set(owned.flatMap((s) => STAGE_FEATURES[s] ?? [])));

  // FLAG OFF → byte-identical legacy: stage features only, no class fields on the object.
  if (!isCommercialEntitlementClassesEnabled()) {
    return {
      ...base,
      owned_stages: owned,
      entitled_features: stageFeatures,
      reason: owned.length > 0 ? 'entitled' : 'no_entitlement',
    };
  }

  // FLAG ON → UNION stage features with subscription-derived feature classes + manual grants.
  // A super-admin grant is an arbitrary feature string; the ones that are FEATURE_CLASSES surface in
  // `feature_classes`, but ALL grants are unioned into `entitled_features` (we honour what was granted).
  const [subClasses, grants] = await Promise.all([
    loadSubscriptionFeatureClasses(pool, email),
    loadActiveGrants(pool, email),
  ]);
  const grantClasses = grants.filter(isFeatureClass);
  const classes = Array.from(new Set<FeatureClass>([...subClasses, ...grantClasses]));
  const entitled = Array.from(new Set<string>([...stageFeatures, ...classes, ...grants]));

  return {
    ...base,
    owned_stages: owned,
    entitled_features: entitled,
    feature_classes: classes,
    class_sources: { subscriptions: subClasses, grants },
    reason: entitled.length > 0 ? 'entitled' : 'no_entitlement',
  };
}

/** System-wide entitlement coverage overview (admin / audit). Never throws; degrades per query. */
export async function buildEntitlementOverview(pool: Pool): Promise<EntitlementOverview> {
  let degraded = false;
  const fail = () => { degraded = true; };

  const paying = await pool
    .query(`SELECT COUNT(DISTINCT lower(email)) n FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`)
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => { fail(); return 0; });

  // entitled identities = distinct paid emails whose owned stages map to ≥1 feature. Computed (not
  // assumed equal to `paying`) so the coverage ratio is measured, never asserted.
  const stageRows = await pool
    .query(`SELECT lower(email) email, stage_code FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`)
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const byEmail = new Map<string, Set<string>>();
  for (const r of stageRows) {
    const e = String(r.email);
    if (!byEmail.has(e)) byEmail.set(e, new Set());
    byEmail.get(e)!.add(String(r.stage_code));
  }

  let entitled = 0;
  const stageCount = new Map<string, number>();
  for (const [, stages] of byEmail) {
    let any = false;
    for (const s of stages) {
      if ((STAGE_FEATURES[s] ?? []).length > 0) any = true;
      stageCount.set(s, (stageCount.get(s) ?? 0) + 1);
    }
    if (any) entitled++;
  }

  const activePkg = await pool
    .query(`SELECT COUNT(*) n FROM student_subscriptions WHERE status='active' AND (expiry_date IS NULL OR expiry_date >= now())`)
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => { fail(); return 0; });

  return {
    generated_at: new Date().toISOString(),
    degraded,
    paying_identities: paying,
    entitled_identities: entitled,
    coverage_pct: paying > 0 ? Math.round((entitled / paying) * 1000) / 10 : null,
    owned_stage_distribution: LADDER
      .map((s) => ({ stage: s, identities: stageCount.get(s) ?? 0 }))
      .filter((x) => x.identities > 0),
    active_package_grants: activePkg,
  };
}

export interface FeatureClassOverview {
  generated_at: string;
  degraded: boolean;
  /** distinct active-subscription identities that hold each feature class (UNION over their plans). */
  subscription_class_distribution: { feature: FeatureClass; identities: number }[];
  /** active manual grants per feature string (includes non-class grants for honesty). */
  grant_distribution: { feature: string; identities: number }[];
  active_subscriptions: number;
  active_grants: number;
}

/**
 * Task #7 — system-wide generalized feature-class coverage (admin / certification). Composes the
 * subscription-derived classes + active manual grants. Never throws; degrades per query. Returns
 * honest zeros when the comm_* tables are empty in dev.
 */
export async function buildFeatureClassOverview(pool: Pool): Promise<FeatureClassOverview> {
  let degraded = false;
  const fail = () => { degraded = true; };

  // distinct active-subscription identities per feature class.
  const subRows = await pool
    .query(
      `SELECT lower(c.email) AS email, p.metadata
         FROM comm_subscriptions s
         JOIN comm_customers c ON c.id = s.customer_id
         JOIN comm_plans     p ON p.id = s.plan_id
        WHERE s.status IN ('active','trial')
          AND (s.current_period_end IS NULL OR s.current_period_end >= now())`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const classIdentities = new Map<FeatureClass, Set<string>>();
  const activeSubEmails = new Set<string>();
  for (const r of subRows) {
    const email = String(r.email ?? '');
    if (email) activeSubEmails.add(email);
    for (const f of parsePlanFeatures(r.metadata).feature_classes) {
      if (!classIdentities.has(f)) classIdentities.set(f, new Set());
      if (email) classIdentities.get(f)!.add(email);
    }
  }

  const grantRows = await pool
    .query(
      `SELECT feature, COUNT(DISTINCT lower(email)) AS n
         FROM comm_entitlement_grants
        WHERE status='active' AND (expires_at IS NULL OR expires_at >= now())
        GROUP BY feature ORDER BY feature`,
    )
    .then((r) => r.rows)
    .catch(() => { fail(); return [] as any[]; });

  const activeGrants = grantRows.reduce((s, r) => s + Number(r.n ?? 0), 0);

  return {
    generated_at: new Date().toISOString(),
    degraded,
    subscription_class_distribution: Array.from(classIdentities.entries())
      .map(([feature, ids]) => ({ feature, identities: ids.size }))
      .filter((x) => x.identities > 0),
    grant_distribution: grantRows.map((r) => ({ feature: String(r.feature), identities: Number(r.n ?? 0) })),
    active_subscriptions: activeSubEmails.size,
    active_grants: activeGrants,
  };
}
