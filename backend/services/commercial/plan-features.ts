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

/** Usage types METERED (what a subscription CONSUMES). Quotas are keyed by these. */
export const USAGE_TYPES = [
  'views', 'searches', 'unlocks', 'assessments', 'downloads', 'exports', 'api',
] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

export function isFeatureClass(v: unknown): v is FeatureClass {
  return typeof v === 'string' && (FEATURE_CLASSES as readonly string[]).includes(v);
}
export function isUsageType(v: unknown): v is UsageType {
  return typeof v === 'string' && (USAGE_TYPES as readonly string[]).includes(v);
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
