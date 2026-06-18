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

  const features = Array.from(new Set(owned.flatMap((s) => STAGE_FEATURES[s] ?? [])));
  return {
    ...base,
    owned_stages: owned,
    entitled_features: features,
    reason: owned.length > 0 ? 'entitled' : 'no_entitlement',
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
