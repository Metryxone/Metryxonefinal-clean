/**
 * Task #5 — Commercial Runtime Spine · Coupon / discount resolver.
 *
 * PURE · DETERMINISTIC · NEVER FABRICATES. Given a coupon row (already loaded from the DB)
 * and the base price + purchase context, it computes the discounted price. On any failed
 * validation it returns `{ valid:false, reason }` with the base price UNCHANGED — it never
 * invents a discount on a miss.
 *
 * Prices are in PAISE (integer) throughout, matching the capadex_payments convention.
 */

export interface CouponRow {
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  currency: string;
  min_amount_paise: number;
  max_discount_paise: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  applies_to: { segments?: string[]; product_codes?: string[]; plan_codes?: string[] } | null;
  starts_at: string | Date | null;
  ends_at: string | Date | null;
  is_active: boolean;
}

export interface DiscountContext {
  base_paise: number;
  currency?: string;
  segment?: string | null;
  product_code?: string | null;
  plan_code?: string | null;
  now?: Date;
}

export interface DiscountResult {
  valid: boolean;
  reason: string;
  base_paise: number;
  discount_paise: number;
  final_paise: number;
  code: string | null;
}

const clampNonNeg = (n: number): number => (n < 0 ? 0 : Math.round(n));

/** Resolve a coupon against a base price. No coupon / invalid coupon → base price unchanged. */
export function resolveDiscount(coupon: CouponRow | null | undefined, ctx: DiscountContext): DiscountResult {
  const base = clampNonNeg(ctx.base_paise);
  const miss = (reason: string, code: string | null = coupon?.code ?? null): DiscountResult => ({
    valid: false,
    reason,
    base_paise: base,
    discount_paise: 0,
    final_paise: base,
    code,
  });

  if (!coupon) return miss('coupon_not_found', null);
  if (!coupon.is_active) return miss('coupon_inactive');

  const now = ctx.now ?? new Date();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now.getTime()) return miss('coupon_not_started');
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now.getTime()) return miss('coupon_expired');

  if (coupon.max_redemptions != null && coupon.redeemed_count >= coupon.max_redemptions) {
    return miss('coupon_redemption_limit_reached');
  }

  if (ctx.currency && coupon.currency && ctx.currency !== coupon.currency) return miss('currency_mismatch');
  if (base < clampNonNeg(coupon.min_amount_paise)) return miss('below_min_amount');

  // Scope checks — an empty/absent list means "no restriction on this axis".
  const a = coupon.applies_to ?? {};
  if (a.segments?.length && (!ctx.segment || !a.segments.includes(ctx.segment))) return miss('segment_not_eligible');
  if (a.product_codes?.length && (!ctx.product_code || !a.product_codes.includes(ctx.product_code))) {
    return miss('product_not_eligible');
  }
  if (a.plan_codes?.length && (!ctx.plan_code || !a.plan_codes.includes(ctx.plan_code))) {
    return miss('plan_not_eligible');
  }

  let discount = 0;
  if (coupon.discount_type === 'percent') {
    const pct = Math.max(0, Math.min(100, coupon.discount_value));
    discount = Math.round((base * pct) / 100);
    if (coupon.max_discount_paise != null) discount = Math.min(discount, clampNonNeg(coupon.max_discount_paise));
  } else {
    discount = clampNonNeg(coupon.discount_value);
  }
  discount = Math.min(discount, base); // never discount below zero

  return {
    valid: discount > 0,
    reason: discount > 0 ? 'applied' : 'no_effect',
    base_paise: base,
    discount_paise: discount,
    final_paise: base - discount,
    code: coupon.code,
  };
}
