/**
 * Phase 6.12 — Partner Ecosystem · read engine (READ-ONLY, compose-only).
 *
 * Surfaces the partner program by COMPOSING the existing relationship substrate:
 *   - partner agreements (tenant_partner_agreements) with their lifecycle state + the owning tenant,
 *   - channel referrals (tenant_channel_referrals) with attribution (channel partner → referred tenant),
 *   - a read-only commission/payout computation surface aggregated per channel-partner tenant.
 *
 * GET-NEVER-WRITES: to_regclass probes only, NO DDL. Never fabricates — absent tables render as honest
 * empties; the payout surface only sums commission_amount on CONVERTED referrals that actually carry an
 * amount, and reports converted-but-amount-missing as an explicit coverage gap (no deal-value exists in
 * the model, so commission_pct alone cannot be turned into a payout — that limitation is stated, not
 * papered over with a fabricated number).
 */
import pg from 'pg';

const N = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function exists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    return r.rows[0]?.reg != null;
  } catch {
    return false;
  }
}

async function columnExists(pool: pg.Pool, table: string, column: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
      [table, column],
    );
    return r.rowCount! > 0;
  } catch {
    return false;
  }
}

export interface PartnerAgreementRow {
  id: number;
  tenant_id: number;
  tenant_name: string | null;
  tenant_code: string | null;
  partner_type: string;
  agreement_code: string;
  status: string;
  commission_pct: number | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
}

export interface ReferralRow {
  id: number;
  channel_partner_tenant_id: number;
  channel_partner_name: string | null;
  referred_tenant_id: number | null;
  referred_tenant_name: string | null;
  referral_code: string;
  status: string;
  commission_pct: number | null;
  commission_amount: number | null;
  /** Realized deal/transaction value the commission is computed against (currency units), or null. */
  deal_value: number | null;
  /** Where deal_value came from ('manual'|'comm_subscriptions'|'capadex_payments'|'linked_ledger'), or null. */
  deal_value_source: string | null;
  /** How commission_amount was obtained ('explicit'|'derived'), or null when there is no amount. */
  commission_amount_source: string | null;
  currency: string;
  referred_at: string | null;
  converted_at: string | null;
}

export interface PayoutRow {
  channel_partner_tenant_id: number;
  channel_partner_name: string | null;
  referrals_total: number;
  converted: number;
  pending: number;
  expired: number;
  rejected: number;
  earned_commission: number;
  currencies: string[];
  converted_without_amount: number;
  /** Of the converted referrals, how many earned an amount auto-derived as commission_pct × deal_value. */
  auto_derived: number;
}

export interface PartnerEcosystem {
  generated_at: string;
  degraded: boolean;
  substrate: { agreements_table: boolean; referrals_table: boolean; events_table: boolean };
  headline: {
    total_agreements: number;
    agreements_by_status: Record<string, number>;
    total_referrals: number;
    referrals_by_status: Record<string, number>;
    conversion_rate_pct: number | null;
    total_earned_commission: number;
    partners_with_payouts: number;
    converted_without_amount: number;
    /** How many converted referrals earned an auto-derived (pct × deal_value) commission. */
    auto_derived_count: number;
  };
  agreements: PartnerAgreementRow[];
  referrals: ReferralRow[];
  payouts: PayoutRow[];
  notes: string[];
}

export async function buildPartnerEcosystem(pool: pg.Pool): Promise<PartnerEcosystem> {
  const notes: string[] = [];
  let degraded = false;
  const generated_at = new Date().toISOString();

  const hasAgreements = await exists(pool, 'tenant_partner_agreements');
  const hasReferrals = await exists(pool, 'tenant_channel_referrals');
  const hasEvents = await exists(pool, 'tenant_partner_agreement_events');
  const substrate = { agreements_table: hasAgreements, referrals_table: hasReferrals, events_table: hasEvents };

  if (!hasAgreements && !hasReferrals) {
    notes.push('Partner substrate not provisioned yet — run setup (write path) to create it. Nothing to surface.');
    return {
      generated_at, degraded, substrate,
      headline: {
        total_agreements: 0, agreements_by_status: {}, total_referrals: 0, referrals_by_status: {},
        conversion_rate_pct: null, total_earned_commission: 0, partners_with_payouts: 0, converted_without_amount: 0,
        auto_derived_count: 0,
      },
      agreements: [], referrals: [], payouts: [], notes,
    };
  }

  // ── Agreements ─────────────────────────────────────────────────────────────
  const agreements: PartnerAgreementRow[] = [];
  const agreementsByStatus: Record<string, number> = {};
  if (hasAgreements) {
    try {
      const r = await pool.query(`
        SELECT a.id, a.tenant_id, a.partner_type, a.agreement_code, a.status, a.commission_pct,
               a.start_date, a.end_date, a.updated_at,
               t.tenant_name, t.tenant_code
          FROM tenant_partner_agreements a
          LEFT JOIN tenants t ON t.id = a.tenant_id
         ORDER BY a.updated_at DESC NULLS LAST, a.id DESC`);
      for (const row of r.rows) {
        const status = String(row.status ?? 'unknown');
        agreementsByStatus[status] = (agreementsByStatus[status] ?? 0) + 1;
        agreements.push({
          id: N(row.id),
          tenant_id: N(row.tenant_id),
          tenant_name: row.tenant_name ?? null,
          tenant_code: row.tenant_code ?? null,
          partner_type: String(row.partner_type ?? ''),
          agreement_code: String(row.agreement_code ?? ''),
          status,
          commission_pct: numOrNull(row.commission_pct),
          start_date: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
          end_date: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
          updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        });
      }
    } catch (e) {
      degraded = true;
      notes.push('tenant_partner_agreements unreadable — degraded.');
    }
  }

  // ── Referrals ──────────────────────────────────────────────────────────────
  // Deal-value columns are additive; on a substrate provisioned before this phase they may be absent.
  // Probe once and SELECT a NULL fallback so a legacy DB reads cleanly instead of degrading.
  const hasDealCols = hasReferrals && (await columnExists(pool, 'tenant_channel_referrals', 'deal_value'));

  const referrals: ReferralRow[] = [];
  const referralsByStatus: Record<string, number> = {};
  if (hasReferrals) {
    try {
      const r = await pool.query(`
        SELECT cr.id, cr.channel_partner_tenant_id, cr.referred_tenant_id, cr.referral_code, cr.status,
               cr.commission_pct, cr.commission_amount, cr.currency, cr.referred_at, cr.converted_at,
               ${hasDealCols
                 ? 'cr.deal_value, cr.deal_value_source, cr.commission_amount_source'
                 : 'NULL::numeric AS deal_value, NULL::text AS deal_value_source, NULL::text AS commission_amount_source'},
               cp.tenant_name AS channel_partner_name, rt.tenant_name AS referred_tenant_name
          FROM tenant_channel_referrals cr
          LEFT JOIN tenants cp ON cp.id = cr.channel_partner_tenant_id
          LEFT JOIN tenants rt ON rt.id = cr.referred_tenant_id
         ORDER BY cr.referred_at DESC NULLS LAST, cr.id DESC`);
      for (const row of r.rows) {
        const status = String(row.status ?? 'unknown');
        referralsByStatus[status] = (referralsByStatus[status] ?? 0) + 1;
        referrals.push({
          id: N(row.id),
          channel_partner_tenant_id: N(row.channel_partner_tenant_id),
          channel_partner_name: row.channel_partner_name ?? null,
          referred_tenant_id: row.referred_tenant_id == null ? null : N(row.referred_tenant_id),
          referred_tenant_name: row.referred_tenant_name ?? null,
          referral_code: String(row.referral_code ?? ''),
          status,
          commission_pct: numOrNull(row.commission_pct),
          commission_amount: numOrNull(row.commission_amount),
          deal_value: numOrNull(row.deal_value),
          deal_value_source: row.deal_value_source ?? null,
          commission_amount_source: row.commission_amount_source ?? null,
          currency: String(row.currency ?? 'INR'),
          referred_at: row.referred_at ? new Date(row.referred_at).toISOString() : null,
          converted_at: row.converted_at ? new Date(row.converted_at).toISOString() : null,
        });
      }
    } catch (e) {
      degraded = true;
      notes.push('tenant_channel_referrals unreadable — degraded.');
    }
  }

  // ── Payouts (read-only, honest) ──────────────────────────────────────────────
  // Per channel-partner tenant: earned_commission = SUM(earned amount) over CONVERTED referrals. The earned
  // amount is the stored commission_amount, OR — when absent but a deal_value + commission_pct are both
  // present — it is derived at read-time as commission_pct × deal_value (back-stop for rows linked before a
  // writer baked the amount). Converted referrals with neither an amount nor a derivable deal value remain
  // an explicit coverage gap, never fabricated.
  const payoutMap = new Map<number, PayoutRow>();
  let convertedWithoutAmountTotal = 0;
  let autoDerivedTotal = 0;
  for (const ref of referrals) {
    const pid = ref.channel_partner_tenant_id;
    let p = payoutMap.get(pid);
    if (!p) {
      p = {
        channel_partner_tenant_id: pid,
        channel_partner_name: ref.channel_partner_name,
        referrals_total: 0, converted: 0, pending: 0, expired: 0, rejected: 0,
        earned_commission: 0, currencies: [], converted_without_amount: 0, auto_derived: 0,
      };
      payoutMap.set(pid, p);
    }
    p.referrals_total += 1;
    if (ref.status === 'converted') p.converted += 1;
    else if (ref.status === 'pending') p.pending += 1;
    else if (ref.status === 'expired') p.expired += 1;
    else if (ref.status === 'rejected') p.rejected += 1;
    if (ref.status === 'converted') {
      let amt = ref.commission_amount;
      // Persisted-derived (baked at write-time) OR read-time derived both count as auto-derived.
      let derived = ref.commission_amount_source === 'derived';
      if (amt == null && ref.deal_value != null && ref.commission_pct != null) {
        amt = Math.round((ref.commission_pct / 100) * ref.deal_value * 100) / 100;
        derived = true;
      }
      if (amt != null) {
        p.earned_commission += amt;
        if (!p.currencies.includes(ref.currency)) p.currencies.push(ref.currency);
        if (derived) { p.auto_derived += 1; autoDerivedTotal += 1; }
      } else {
        p.converted_without_amount += 1;
        convertedWithoutAmountTotal += 1;
      }
    }
  }
  const payouts = [...payoutMap.values()]
    .map((p) => ({ ...p, earned_commission: Math.round(p.earned_commission * 100) / 100 }))
    .sort((a, b) => b.earned_commission - a.earned_commission || b.referrals_total - a.referrals_total);

  const totalEarned = Math.round(payouts.reduce((s, p) => s + p.earned_commission, 0) * 100) / 100;
  const partnersWithPayouts = payouts.filter((p) => p.earned_commission > 0).length;

  const totalReferrals = referrals.length;
  const converted = referralsByStatus['converted'] ?? 0;
  const conversionRate = totalReferrals > 0 ? Math.round((converted / totalReferrals) * 1000) / 10 : null;

  if (autoDerivedTotal > 0) {
    notes.push(`${autoDerivedTotal} converted referral(s) earned a commission auto-derived as commission_pct × deal_value (no explicit amount typed).`);
  }
  if (convertedWithoutAmountTotal > 0) {
    notes.push(`${convertedWithoutAmountTotal} converted referral(s) carry neither a commission_amount nor a linkable deal value — excluded from earned totals. Coverage gap, not fabricated.`);
  }
  if (hasReferrals && totalReferrals === 0) notes.push('No channel referrals recorded yet.');
  if (hasAgreements && agreements.length === 0) notes.push('No partner agreements recorded yet.');

  return {
    generated_at, degraded, substrate,
    headline: {
      total_agreements: agreements.length,
      agreements_by_status: agreementsByStatus,
      total_referrals: totalReferrals,
      referrals_by_status: referralsByStatus,
      conversion_rate_pct: conversionRate,
      total_earned_commission: totalEarned,
      partners_with_payouts: partnersWithPayouts,
      converted_without_amount: convertedWithoutAmountTotal,
      auto_derived_count: autoDerivedTotal,
    },
    agreements, referrals, payouts, notes,
  };
}
