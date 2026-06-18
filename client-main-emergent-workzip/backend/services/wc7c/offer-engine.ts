/**
 * CAPADEX WC-7C Wave 1 — Offer Activation Engine.
 *
 * PURE · COMPOSE-ONLY · NEVER-THROWS. Assembles a per-session OFFER from the already-composed
 * decision, the existing activation slots (product / growthPlan / mentor), and the subscription
 * recommendation. It does not query, recompute, or fabricate.
 *
 * Discipline:
 *   • NEVER sells into a stub — product routes whose underlying product is a stub
 *     (Employability / Competitive-Exam) are flagged `sellable:false` (`product_not_ready`).
 *   • D6 never auto-recommends on low confidence — when the subscription engine deferred
 *     (`show_options`), there is NO `primary` offer; the bundle is surfaced for the user to
 *     choose from.
 *   • Safety (D7) overrides commerce — `safetyBlocked` → empty offer (`safety_override`).
 */
import type { SubscriptionActivation } from './subscription-engine';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Route keys / product paths whose underlying product is a STUB → never sell. */
const STUB_PRODUCT_MATCHERS = ['employability', 'competitive_exam', 'competitive-exam', 'exam_intelligence'];

export interface OfferItem {
  slot: 'subscription' | 'report' | 'product' | 'growth_plan' | 'mentor';
  label: string;
  sellable: boolean;
  status: string;
}

export interface OfferActivation {
  ready: boolean;
  reason: string;
  primary: OfferItem | null;
  bundle: OfferItem[];
  offer_fit: number;
  /** `offer_fit` is a DIRECTIONAL ranking signal, NOT a probability/conversion estimate. */
  offer_fit_kind: 'directional';
  confidence_gated: boolean;
  source: 'wc7c_offer_engine';
}

interface SlotLike { ready: boolean; reason: string; [k: string]: unknown; }

export interface OfferEngineInput {
  decisionConfidence: number;
  product: { ready: boolean; reason: string; route_key: string | null; product_path: string | null };
  growthPlan: SlotLike;
  mentor: SlotLike;
}

function isStubProduct(routeKey: string | null, productPath: string | null): boolean {
  const hay = `${routeKey ?? ''} ${productPath ?? ''}`.toLowerCase();
  return STUB_PRODUCT_MATCHERS.some((m) => hay.includes(m));
}

export function deriveOfferActivation(
  input: OfferEngineInput,
  subscription: SubscriptionActivation,
  opts: { safetyBlocked?: boolean } = {},
): OfferActivation {
  if (opts.safetyBlocked) {
    return {
      ready: false,
      reason: 'safety_override',
      primary: null,
      bundle: [],
      offer_fit: 0,
      offer_fit_kind: 'directional',
      confidence_gated: false,
      source: 'wc7c_offer_engine',
    };
  }

  const bundle: OfferItem[] = [];

  // Subscription — the monetised primary: a live, paid CAPADEX stage upgrade.
  const subItem: OfferItem | null = subscription.target
    ? {
        slot: 'subscription',
        label: `${subscription.target.label} stage — ₹${subscription.target.price}`,
        sellable: subscription.ready,
        status: subscription.ready ? 'ready' : subscription.reason,
      }
    : null;
  if (subItem) bundle.push(subItem);

  // Paid report — unlocked by the same stage SKU.
  if (subscription.target) {
    bundle.push({
      slot: 'report',
      label: `${subscription.target.label} report`,
      sellable: subscription.ready,
      status: subscription.ready ? 'ready' : subscription.reason,
    });
  }

  // Routed product — stub guard: never sell into a stub.
  const stub = isStubProduct(input.product.route_key, input.product.product_path);
  bundle.push({
    slot: 'product',
    label: input.product.route_key ? `Product: ${input.product.route_key}` : 'Product',
    sellable: input.product.ready && !stub,
    status: stub ? 'product_not_ready' : input.product.ready ? 'ready' : input.product.reason,
  });

  // Growth plan + mentor — value-adds (not directly monetised here), honest status.
  bundle.push({
    slot: 'growth_plan',
    label: 'Growth plan',
    sellable: false,
    status: input.growthPlan.ready ? 'available' : input.growthPlan.reason,
  });
  bundle.push({
    slot: 'mentor',
    label: 'Mentor match',
    sellable: false,
    status: input.mentor.ready ? 'available' : input.mentor.reason,
  });

  // Primary offer = the subscription stage upgrade, only when it is itself sellable
  // (the D6 high-confidence gate is applied inside the subscription engine).
  const primary = subItem && subscription.ready ? subItem : null;

  const sellableCount = bundle.filter((b) => b.sellable).length;
  const offer_fit = r2(Math.min(1, Math.max(0, input.decisionConfidence)) * (sellableCount > 0 ? 1 : 0));

  const reason = primary
    ? 'recommend'
    : subscription.reason === 'show_options'
      ? 'show_options_low_confidence'
      : subscription.reason; // all_stages_owned / no_billing_identity / safety_override

  return {
    ready: !!primary,
    reason,
    primary,
    bundle,
    offer_fit,
    offer_fit_kind: 'directional',
    confidence_gated: subscription.confidence_gated,
    source: 'wc7c_offer_engine',
  };
}
