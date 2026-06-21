/**
 * Task #7 — Plan feature classes + quotas (pure parser).
 *
 * PURE · NO DB · NO FLAG. The single source of truth for the generalized (non-stage) entitlement
 * vocabulary and for reading a plan's declared feature classes + usage quotas off `comm_plans.metadata`.
 *
 * A plan declares what it grants via its `metadata` JSONB — NOT a fabricated default. A plan with no
 * declaration grants NO feature classes (honest empty), so entitlement is the UNION of what plans
 * actually declare; we never invent access a plan did not sell.
 *
 *   comm_plans.metadata = {
 *     "feature_classes": ["views","searches","reports"],   // subset of FEATURE_CLASSES
 *     "quotas": { "views": 1000, "searches": 200 }          // per-period limits, usage_type → max
 *   }
 */

/** Entitlement feature classes (what a subscription UNLOCKS). */
export const FEATURE_CLASSES = [
  'views', 'searches', 'reports', 'exports', 'assessments', 'ai', 'api',
] as const;
export type FeatureClass = (typeof FEATURE_CLASSES)[number];

/**
 * Usage types METERED (what a subscription CONSUMES). Quotas are keyed by these.
 *
 * Phase 6.5 broadened this vocabulary to the eight business dimensions the product meters. The
 * original action types (views/searches/unlocks/downloads/exports) remain; `assessments` + `api` were
 * already present; `candidates`/`jobs`/`employers`/`institutions`/`storage` are added here. `credits`
 * is NOT a usage_type — it is a consumable balance handled by the credit ledger (see below).
 */
export const USAGE_TYPES = [
  'views', 'searches', 'unlocks', 'assessments', 'downloads', 'exports', 'api',
  'candidates', 'jobs', 'employers', 'institutions', 'storage',
] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

/**
 * The eight BUSINESS DIMENSIONS Phase 6.5 meters. Seven are backed by the usage-event ledger
 * (`comm_usage_events`); `credits` is backed by the append-only credit ledger (`comm_credit_ledger`).
 */
export const BUSINESS_DIMENSIONS = [
  'assessments', 'candidates', 'jobs', 'employers', 'institutions', 'api', 'storage', 'credits',
] as const;
export type BusinessDimension = (typeof BUSINESS_DIMENSIONS)[number];

/**
 * Counting semantics — tracked honestly per dimension (they are NOT all event counts):
 *   - period_count : SUM of event quantities in the current billing period (assessments, candidates,
 *                    jobs, employers, institutions, api — and the legacy action types).
 *   - level        : a current absolute reading (a gauge), not a running total — the LATEST recorded
 *                    value is the usage (storage).
 *   - credit_balance: a consumable balance drawn down by spending (credits → credit ledger).
 */
export type UsageKind = 'period_count' | 'level';
export type DimensionKind = UsageKind | 'credit_balance';

const LEVEL_USAGE_TYPES: ReadonlySet<UsageType> = new Set(['storage']);

/** Counting kind for a usage_type recorded to the event ledger. */
export function usageTypeKind(t: UsageType): UsageKind {
  return LEVEL_USAGE_TYPES.has(t) ? 'level' : 'period_count';
}

/** Counting kind for one of the eight business dimensions. */
export function dimensionKind(d: BusinessDimension): DimensionKind {
  if (d === 'credits') return 'credit_balance';
  if (d === 'storage') return 'level';
  return 'period_count';
}

export function isFeatureClass(v: unknown): v is FeatureClass {
  return typeof v === 'string' && (FEATURE_CLASSES as readonly string[]).includes(v);
}
export function isUsageType(v: unknown): v is UsageType {
  return typeof v === 'string' && (USAGE_TYPES as readonly string[]).includes(v);
}
export function isBusinessDimension(v: unknown): v is BusinessDimension {
  return typeof v === 'string' && (BUSINESS_DIMENSIONS as readonly string[]).includes(v);
}

export interface PlanFeatures {
  feature_classes: FeatureClass[];
  quotas: Partial<Record<UsageType, number>>;
}

/** Parse a plan's declared feature classes + quotas from its metadata JSONB. Never throws. */
export function parsePlanFeatures(metadata: unknown): PlanFeatures {
  const out: PlanFeatures = { feature_classes: [], quotas: {} };
  if (!metadata || typeof metadata !== 'object') return out;
  const m = metadata as Record<string, unknown>;

  const raw = m.feature_classes;
  if (Array.isArray(raw)) {
    out.feature_classes = Array.from(new Set(raw.filter(isFeatureClass)));
  }

  const q = m.quotas;
  if (q && typeof q === 'object') {
    for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
      const n = Number(v);
      if (isUsageType(k) && Number.isFinite(n) && n >= 0) out.quotas[k] = Math.trunc(n);
    }
  }
  return out;
}
