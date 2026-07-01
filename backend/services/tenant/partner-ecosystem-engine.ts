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
import { resolveReferredTenantDealValue, diagnoseReferredTenantDealValue } from './partner-ecosystem-actions';

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

/**
 * Optional, additive export filter. Absent/empty fields behave exactly as before (full export):
 *   - from/to: inclusive YYYY-MM-DD reporting window (UTC; `to` covers the whole day).
 *   - status: exact status match (applies to agreement.status / referral.status).
 * Read-only — only ever REMOVES rows from the result; never fabricates or back-fills.
 */
export interface PartnerEcosystemFilter {
  from?: string | null;
  to?: string | null;
  status?: string | null;
}

interface NormalizedFilter {
  status: string;
  fromMs: number | null;
  toMs: number | null;
  /** Trimmed, validated YYYY-MM-DD strings (null when absent/invalid) — for display + filenames. */
  fromDate: string | null;
  toDate: string | null;
  hasDate: boolean;
  active: boolean;
}

function parseDateBound(s: string | null | undefined, endOfDay: boolean): number | null {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const t = Date.parse(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isFinite(t) ? t : null;
}

function normDate(s: string | null | undefined): string | null {
  if (s == null) return null;
  const trimmed = String(s).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeFilter(f?: PartnerEcosystemFilter | null): NormalizedFilter {
  const status = f?.status ? String(f.status).trim() : '';
  const fromMs = parseDateBound(f?.from, false);
  const toMs = parseDateBound(f?.to, true);
  const hasDate = fromMs != null || toMs != null;
  return { status, fromMs, toMs, fromDate: normDate(f?.from), toDate: normDate(f?.to), hasDate, active: !!status || hasDate };
}

/**
 * Public description of the ACTIVE export filter, used to stamp a self-describing metadata block
 * (and encode the window in the filename) into filtered CSV exports. Purely derived from the same
 * normalization used to filter rows, so the stamp can never disagree with the data. When `active`
 * is false the caller emits NO metadata block (unfiltered export stays byte-identical to before).
 */
export interface ExportFilterMeta {
  active: boolean;
  status: string | null;
  from: string | null;
  to: string | null;
}

export function describeExportFilter(filter?: PartnerEcosystemFilter | null): ExportFilterMeta {
  const nf = normalizeFilter(filter);
  return { active: nf.active, status: nf.status || null, from: nf.fromDate, to: nf.toDate };
}

/** True when an ISO/date string falls inside [fromMs, toMs] (either bound may be null = open). */
function tsInRange(iso: string | null, fromMs: number | null, toMs: number | null): boolean {
  if (iso == null) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  if (fromMs != null && t < fromMs) return false;
  if (toMs != null && t > toMs) return false;
  return true;
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
  /**
   * The earned amount that ACTUALLY feeds the payout totals for this referral, and how it was obtained.
   * This is the single source of truth shared by the payout surface and the per-referral breakdown so the
   * two can never disagree. Only CONVERTED referrals earn a commission:
   *   - 'explicit'        — operator-typed commission_amount.
   *   - 'derived_persisted' — commission_amount baked at write-time as pct × deal_value (source 'derived').
   *   - 'derived_runtime' — no stored amount, derived here at read-time as commission_pct × deal_value.
   *   - 'none'            — converted but neither an amount nor a derivable deal value (coverage gap).
   * For non-converted referrals both fields are null (nothing is earned yet).
   */
  effective_commission_amount: number | null;
  effective_commission_source: 'explicit' | 'derived_persisted' | 'derived_runtime' | 'none' | null;
  /**
   * Recurring vs one-time split of a LEDGER-sourced deal value, re-resolved read-only at request time
   * (the split is computed at write time but never persisted). null for manually-typed deal values, or
   * when the referred tenant's ledgers no longer resolve. `resolved_total` is the live sum of the
   * components; `reconciles` is true when it still matches the stored deal_value (the split faithfully
   * explains the recorded amount; false signals the ledgers have drifted since conversion).
   */
  deal_value_components: {
    recurring: number;
    onetime: number;
    resolved_total: number;
    reconciles: boolean;
  } | null;
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

export async function buildPartnerEcosystem(
  pool: pg.Pool,
  filter?: PartnerEcosystemFilter | null,
): Promise<PartnerEcosystem> {
  const notes: string[] = [];
  let degraded = false;
  const generated_at = new Date().toISOString();
  const nf = normalizeFilter(filter);

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
  // Filtering is applied AFTER mapping (read-only — only removes rows). An agreement matches the
  // date window if any of its dates (start_date / end_date / updated_at) falls inside [from, to];
  // status (when given) must match exactly. With no filter, every row is kept (byte-identical).
  let agreements: PartnerAgreementRow[] = [];
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
      if (nf.active) {
        agreements = agreements.filter((a) => {
          if (nf.status && a.status !== nf.status) return false;
          if (nf.hasDate) {
            const inWindow =
              tsInRange(a.start_date, nf.fromMs, nf.toMs) ||
              tsInRange(a.end_date, nf.fromMs, nf.toMs) ||
              tsInRange(a.updated_at, nf.fromMs, nf.toMs);
            if (!inWindow) return false;
          }
          return true;
        });
      }
      for (const a of agreements) {
        agreementsByStatus[a.status] = (agreementsByStatus[a.status] ?? 0) + 1;
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

  // A referral matches the date window if referred_at OR converted_at falls inside [from, to];
  // status (when given) must match exactly. Payouts (below) are derived from the FILTERED referrals.
  let referrals: ReferralRow[] = [];
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
          effective_commission_amount: null,
          effective_commission_source: null,
          deal_value_components: null,
          currency: String(row.currency ?? 'INR'),
          referred_at: row.referred_at ? new Date(row.referred_at).toISOString() : null,
          converted_at: row.converted_at ? new Date(row.converted_at).toISOString() : null,
        });
      }
      if (nf.active) {
        referrals = referrals.filter((r2) => {
          if (nf.status && r2.status !== nf.status) return false;
          if (nf.hasDate) {
            const inWindow =
              tsInRange(r2.referred_at, nf.fromMs, nf.toMs) ||
              tsInRange(r2.converted_at, nf.fromMs, nf.toMs);
            if (!inWindow) return false;
          }
          return true;
        });
      }
      for (const r2 of referrals) {
        referralsByStatus[r2.status] = (referralsByStatus[r2.status] ?? 0) + 1;
      }
    } catch (e) {
      degraded = true;
      notes.push('tenant_channel_referrals unreadable — degraded.');
    }
  }

  // ── Deal-value component breakdown (read-only re-resolution) ─────────────────
  // The recurring vs one-time split is computed at write time (resolveReferredTenantDealValue) but never
  // persisted, so to surface it we re-resolve from the live ledgers. Only ledger-sourced deal values have
  // a breakdown — manually-typed deal values do not. resolveReferredTenantDealValue is read-only
  // (to_regclass probes, no DDL), never throws, and returns null (honest gap) when nothing resolves.
  const LEDGER_DEAL_SOURCES = new Set(['comm_subscriptions', 'capadex_payments', 'linked_ledger']);
  for (const ref of referrals) {
    if (ref.deal_value == null || ref.referred_tenant_id == null) continue;
    if (!ref.deal_value_source || !LEDGER_DEAL_SOURCES.has(ref.deal_value_source)) continue;
    try {
      const resolved = await resolveReferredTenantDealValue(pool, ref.referred_tenant_id);
      if (resolved) {
        const resolvedTotal =
          Math.round((resolved.components.recurring + resolved.components.onetime) * 100) / 100;
        ref.deal_value_components = {
          recurring: resolved.components.recurring,
          onetime: resolved.components.onetime,
          resolved_total: resolvedTotal,
          reconciles: Math.abs(resolvedTotal - ref.deal_value) < 0.01,
        };
      }
    } catch { /* honest: leave the split null rather than fabricate one */ }
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
      let source: 'explicit' | 'derived_persisted' | 'derived_runtime' | 'none' =
        amt != null ? (derived ? 'derived_persisted' : 'explicit') : 'none';
      if (amt == null && ref.deal_value != null && ref.commission_pct != null) {
        amt = Math.round((ref.commission_pct / 100) * ref.deal_value * 100) / 100;
        derived = true;
        source = 'derived_runtime';
      }
      // Stamp the per-referral effective amount so the breakdown UI mirrors payout truth exactly.
      ref.effective_commission_amount = amt;
      ref.effective_commission_source = source;
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
  if (nf.active) {
    const parts: string[] = [];
    if (nf.fromMs != null) parts.push(`from ${new Date(nf.fromMs).toISOString().slice(0, 10)}`);
    if (nf.toMs != null) parts.push(`to ${new Date(nf.toMs).toISOString().slice(0, 10)}`);
    if (nf.status) parts.push(`status=${nf.status}`);
    notes.push(`Filtered export: ${parts.join(', ')} (read-only — rows outside the window are excluded, nothing fabricated).`);
  }

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

// ── Unlinkable converted referrals (honest coverage gap, actionable) ───────────
export type UnlinkableReason = 'no_email' | 'no_realized_revenue' | 'linkable';

export interface UnlinkableReferralRow {
  id: number;
  referral_code: string;
  channel_partner_tenant_id: number;
  channel_partner_name: string | null;
  referred_tenant_id: number;
  referred_tenant_name: string | null;
  commission_pct: number | null;
  currency: string;
  converted_at: string | null;
  /** Why this conversion has no deal value: no email · no realized revenue · linkable (revenue now exists). */
  reason: UnlinkableReason;
  reason_label: string;
  /** When reason='linkable', the realized deal value (currency units) available to attach; else null. */
  linkable_value: number | null;
  linkable_source: string | null;
}

export interface UnlinkableReferrals {
  generated_at: string;
  degraded: boolean;
  substrate: { referrals_table: boolean };
  total: number;
  by_reason: Record<string, number>;
  rows: UnlinkableReferralRow[];
  notes: string[];
}

const UNLINKABLE_REASON_LABELS: Record<UnlinkableReason, string> = {
  no_email: 'Referred tenant has no contact email — no revenue ledger can ever match it.',
  no_realized_revenue: 'Referred tenant has an email but no realized (paid) revenue in the ledgers.',
  linkable: 'Realized revenue now exists for the referred tenant — it can be linked automatically.',
};

/**
 * List CONVERTED referrals that have a referred tenant but still carry NO deal value and NO commission
 * amount — the honest, unlinkable coverage gap. Each row is diagnosed (no_email vs no_realized_revenue,
 * or linkable when revenue has since appeared) so an admin can manually price it or chase the link.
 * READ-ONLY: to_regclass / information_schema probes only, never DDL, never fabricates.
 */
export async function buildUnlinkableReferrals(pool: pg.Pool): Promise<UnlinkableReferrals> {
  const generated_at = new Date().toISOString();
  const notes: string[] = [];
  let degraded = false;

  const hasReferrals = await exists(pool, 'tenant_channel_referrals');
  if (!hasReferrals) {
    notes.push('tenant_channel_referrals not provisioned yet — nothing to surface.');
    return { generated_at, degraded, substrate: { referrals_table: false }, total: 0, by_reason: {}, rows: [], notes };
  }

  // deal_value is an additive column; on a legacy substrate it may be absent (then it is NULL for all rows).
  const hasDealCols = await columnExists(pool, 'tenant_channel_referrals', 'deal_value');

  let candidates: any[] = [];
  try {
    const r = await pool.query(`
      SELECT cr.id, cr.referral_code, cr.channel_partner_tenant_id, cr.referred_tenant_id,
             cr.commission_pct, cr.currency, cr.converted_at,
             cp.tenant_name AS channel_partner_name, rt.tenant_name AS referred_tenant_name
        FROM tenant_channel_referrals cr
        LEFT JOIN tenants cp ON cp.id = cr.channel_partner_tenant_id
        LEFT JOIN tenants rt ON rt.id = cr.referred_tenant_id
       WHERE cr.status = 'converted'
         AND cr.referred_tenant_id IS NOT NULL
         AND cr.commission_amount IS NULL
         ${hasDealCols ? 'AND cr.deal_value IS NULL' : ''}
       ORDER BY cr.converted_at DESC NULLS LAST, cr.id DESC`);
    candidates = r.rows;
  } catch (e) {
    degraded = true;
    notes.push('tenant_channel_referrals unreadable — degraded.');
  }

  const rows: UnlinkableReferralRow[] = [];
  const byReason: Record<string, number> = {};
  for (const c of candidates) {
    const referredId = Number(c.referred_tenant_id);
    const diag = await diagnoseReferredTenantDealValue(pool, referredId);
    // referred_tenant_id is guaranteed non-null by the WHERE clause; map the impossible case defensively.
    const reason: UnlinkableReason = diag.reason === 'no_referred_tenant' ? 'no_email' : diag.reason;
    rows.push({
      id: N(c.id),
      referral_code: String(c.referral_code ?? ''),
      channel_partner_tenant_id: N(c.channel_partner_tenant_id),
      channel_partner_name: c.channel_partner_name ?? null,
      referred_tenant_id: referredId,
      referred_tenant_name: c.referred_tenant_name ?? null,
      commission_pct: numOrNull(c.commission_pct),
      currency: String(c.currency ?? 'INR'),
      converted_at: c.converted_at ? new Date(c.converted_at).toISOString() : null,
      reason,
      reason_label: UNLINKABLE_REASON_LABELS[reason],
      linkable_value: diag.resolved ? diag.resolved.value : null,
      linkable_source: diag.resolved ? diag.resolved.source : null,
    });
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }

  if (rows.length === 0) {
    notes.push('No converted referrals are missing a deal value — nothing to resolve.');
  } else {
    if ((byReason['linkable'] ?? 0) > 0) {
      notes.push(`${byReason['linkable']} converted referral(s) now have realized revenue available to link.`);
    }
    const stuck = (byReason['no_email'] ?? 0) + (byReason['no_realized_revenue'] ?? 0);
    if (stuck > 0) {
      notes.push(`${stuck} converted referral(s) cannot be auto-linked (no email or no realized revenue) — price them manually or chase the missing revenue link.`);
    }
  }

  return {
    generated_at, degraded, substrate: { referrals_table: true },
    total: rows.length, by_reason: byReason, rows, notes,
  };
}
