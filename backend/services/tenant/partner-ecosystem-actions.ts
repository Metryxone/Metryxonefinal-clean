/**
 * Phase 6.12 — Partner Ecosystem · write helpers (WRITE PATH — invoked only from explicit POST routes).
 *
 * Implements the partner-agreement lifecycle (draft → active → suspended → terminated, with legacy
 * pending/expired) and channel-referral attribution + status tracking. Every helper first runs
 * ensurePartnerEcosystemSchema (DDL gated behind the partnerEcosystem flag at the route layer), validates
 * its inputs against real tenants + bounded enums, and NEVER fabricates. Agreement transitions append a
 * row to the append-only tenant_partner_agreement_events log.
 */
import pg from 'pg';
import { ensurePartnerEcosystemSchema } from './partner-ecosystem-schema';

export const PARTNER_TYPES = [
  'training', 'certification', 'assessment', 'hiring', 'counseling', 'channel', 'franchise', 'other',
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const AGREEMENT_STATUSES = [
  'draft', 'active', 'suspended', 'expired', 'terminated', 'pending',
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

/** Allowed agreement lifecycle transitions. terminated is terminal. */
export const AGREEMENT_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  draft: ['active', 'terminated'],
  pending: ['active', 'draft', 'terminated'],
  active: ['suspended', 'expired', 'terminated'],
  suspended: ['active', 'expired', 'terminated'],
  expired: ['active', 'terminated'],
  terminated: [],
};

export const REFERRAL_STATUSES = ['pending', 'converted', 'expired', 'rejected'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** Allowed referral transitions. Only a pending referral can change state; the rest are terminal. */
export const REFERRAL_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  pending: ['converted', 'expired', 'rejected'],
  converted: [],
  expired: [],
  rejected: [],
};

export class PartnerActionError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function tenantExists(pool: pg.Pool, id: number): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM tenants WHERE id = $1`, [id]);
  return r.rowCount! > 0;
}

async function tableExists(pool: pg.Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
    return r.rows[0]?.reg != null;
  } catch {
    return false;
  }
}

export interface ResolvedDealValue {
  /** Realized deal/transaction value for the referred tenant, in currency units (rupees). */
  value: number;
  currency: string;
  /** Provenance: which ledger(s) the value was summed from. Never fabricated. */
  source: 'comm_subscriptions' | 'capadex_payments' | 'linked_ledger';
  components: { recurring: number; onetime: number };
}

/**
 * Resolve a referred tenant's REAL realized deal value by summing paid amounts attributed to that
 * tenant's contact_email across the live ledgers:
 *   • recurring  — comm_subscription_events (payment_succeeded/renewed) joined to comm_customers by email
 *   • one-time   — capadex_payments (status='paid') matched by email
 * Money in the ledgers is PAISE; this returns CURRENCY UNITS (rupees) to match commission_amount/deal_value.
 * Read-only (to_regclass probes, never DDL), never throws, never fabricates: returns null when the tenant
 * has no email or no realized revenue is found (so the conversion stays an honest unlinkable gap).
 */
export async function resolveReferredTenantDealValue(
  pool: pg.Pool,
  referredTenantId: number,
): Promise<ResolvedDealValue | null> {
  let email: string | null = null;
  try {
    const t = await pool.query(`SELECT contact_email FROM tenants WHERE id = $1`, [referredTenantId]);
    email = t.rows[0]?.contact_email ?? null;
  } catch {
    email = null;
  }
  if (!email || String(email).trim() === '') return null;

  let recurringPaise = 0;
  let onetimePaise = 0;
  const sources = new Set<'comm_subscriptions' | 'capadex_payments'>();

  if ((await tableExists(pool, 'comm_subscription_events')) && (await tableExists(pool, 'comm_customers'))) {
    try {
      const r = await pool.query(
        `SELECT COALESCE(SUM(e.amount_paise), 0) AS paise
           FROM comm_subscription_events e
           JOIN comm_customers c ON c.id = e.customer_id
          WHERE e.event_type IN ('payment_succeeded','renewed')
            AND e.amount_paise IS NOT NULL
            AND LOWER(c.email) = LOWER($1)`,
        [email],
      );
      recurringPaise = Number(r.rows[0]?.paise ?? 0);
      if (recurringPaise > 0) sources.add('comm_subscriptions');
    } catch { /* honest empty */ }
  }

  if (await tableExists(pool, 'capadex_payments')) {
    try {
      const r = await pool.query(
        `SELECT COALESCE(SUM(amount_paise), 0) AS paise
           FROM capadex_payments
          WHERE status = 'paid' AND amount_paise IS NOT NULL
            AND email IS NOT NULL AND LOWER(email) = LOWER($1)`,
        [email],
      );
      onetimePaise = Number(r.rows[0]?.paise ?? 0);
      if (onetimePaise > 0) sources.add('capadex_payments');
    } catch { /* honest empty */ }
  }

  const totalPaise = recurringPaise + onetimePaise;
  if (!(totalPaise > 0)) return null;

  const source = sources.size === 1 ? [...sources][0] : 'linked_ledger';
  return {
    value: Math.round(totalPaise) / 100,
    currency: 'INR',
    source,
    components: {
      recurring: Math.round(recurringPaise) / 100,
      onetime: Math.round(onetimePaise) / 100,
    },
  };
}

function asInt(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new PartnerActionError('invalid_input', `${field} must be an integer.`);
  return n;
}

function asCommissionPct(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new PartnerActionError('invalid_input', 'commission_pct must be between 0 and 100.');
  }
  return Math.round(n * 100) / 100;
}

function asAmount(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new PartnerActionError('invalid_input', 'commission_amount must be >= 0.');
  }
  return Math.round(n * 100) / 100;
}

// ── Agreements ─────────────────────────────────────────────────────────────────

export interface UpsertAgreementInput {
  tenant_id: number | string;
  partner_type: string;
  agreement_code: string;
  commission_pct?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  terms?: Record<string, unknown> | null;
  status?: string | null; // only honored on create; default 'draft'
}

/**
 * Create or update a partner agreement (keyed by UNIQUE (tenant_id, agreement_code)). On insert the
 * status defaults to 'draft' unless an explicit valid status is supplied; on conflict, status is left
 * untouched (use transitionAgreement to move the lifecycle) and the editable terms are updated.
 */
export async function upsertPartnerAgreement(pool: pg.Pool, input: UpsertAgreementInput, actor?: string) {
  await ensurePartnerEcosystemSchema(pool);
  const tenantId = asInt(input.tenant_id, 'tenant_id');
  if (!(await tenantExists(pool, tenantId))) {
    throw new PartnerActionError('tenant_not_found', `tenant ${tenantId} does not exist.`, 404);
  }
  const partnerType = String(input.partner_type ?? '');
  if (!(PARTNER_TYPES as readonly string[]).includes(partnerType)) {
    throw new PartnerActionError('invalid_input', `partner_type must be one of: ${PARTNER_TYPES.join(', ')}.`);
  }
  const code = String(input.agreement_code ?? '').trim();
  if (!code) throw new PartnerActionError('invalid_input', 'agreement_code is required.');
  const commissionPct = asCommissionPct(input.commission_pct);
  const startDate = input.start_date || null;
  const endDate = input.end_date || null;
  const terms = input.terms && typeof input.terms === 'object' ? input.terms : {};

  let createStatus: AgreementStatus = 'draft';
  if (input.status != null && input.status !== '') {
    if (!(AGREEMENT_STATUSES as readonly string[]).includes(String(input.status))) {
      throw new PartnerActionError('invalid_input', `status must be one of: ${AGREEMENT_STATUSES.join(', ')}.`);
    }
    createStatus = input.status as AgreementStatus;
  }

  const r = await pool.query(
    `INSERT INTO tenant_partner_agreements
       (tenant_id, partner_type, agreement_code, status, commission_pct, start_date, end_date, terms, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
     ON CONFLICT (tenant_id, agreement_code) DO UPDATE SET
       partner_type   = EXCLUDED.partner_type,
       commission_pct = EXCLUDED.commission_pct,
       start_date     = EXCLUDED.start_date,
       end_date       = EXCLUDED.end_date,
       terms          = EXCLUDED.terms,
       updated_at     = NOW()
     RETURNING id, tenant_id, partner_type, agreement_code, status, commission_pct, start_date, end_date, terms,
               (xmax = 0) AS inserted`,
    [tenantId, partnerType, code, createStatus, commissionPct, startDate, endDate, JSON.stringify(terms)],
  );
  const row = r.rows[0];
  const inserted = row.inserted === true;
  if (inserted) {
    await pool.query(
      `INSERT INTO tenant_partner_agreement_events (agreement_id, from_status, to_status, note, actor)
       VALUES ($1, NULL, $2, $3, $4)`,
      [row.id, createStatus, 'agreement created', actor ?? null],
    );
  }
  return { ...row, inserted };
}

export async function transitionAgreement(
  pool: pg.Pool,
  agreementId: number,
  toStatus: string,
  opts: { note?: string | null; actor?: string | null } = {},
) {
  await ensurePartnerEcosystemSchema(pool);
  if (!(AGREEMENT_STATUSES as readonly string[]).includes(toStatus)) {
    throw new PartnerActionError('invalid_input', `status must be one of: ${AGREEMENT_STATUSES.join(', ')}.`);
  }
  const cur = await pool.query(`SELECT id, status FROM tenant_partner_agreements WHERE id = $1`, [agreementId]);
  if (cur.rowCount === 0) throw new PartnerActionError('not_found', `agreement ${agreementId} not found.`, 404);
  const from = String(cur.rows[0].status) as AgreementStatus;
  if (from === (toStatus as AgreementStatus)) {
    throw new PartnerActionError('no_op', `agreement is already '${from}'.`);
  }
  const allowed = AGREEMENT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(toStatus as AgreementStatus)) {
    throw new PartnerActionError(
      'invalid_transition',
      `cannot move agreement from '${from}' to '${toStatus}'. Allowed: ${allowed.length ? allowed.join(', ') : '(terminal — none)'}.`,
    );
  }
  const upd = await pool.query(
    `UPDATE tenant_partner_agreements SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, tenant_id, agreement_code, status`,
    [toStatus, agreementId],
  );
  await pool.query(
    `INSERT INTO tenant_partner_agreement_events (agreement_id, from_status, to_status, note, actor)
     VALUES ($1, $2, $3, $4, $5)`,
    [agreementId, from, toStatus, opts.note ?? null, opts.actor ?? null],
  );
  return { ...upd.rows[0], from_status: from };
}

/**
 * READ-ONLY (safe for GET routes): no ensure-schema / DDL. Probes the events table with to_regclass and
 * returns an honest empty list when the substrate has not been provisioned yet.
 */
export async function listAgreementEvents(pool: pg.Pool, agreementId: number) {
  const reg = await pool.query(`SELECT to_regclass('public.tenant_partner_agreement_events') AS reg`);
  if (reg.rows[0]?.reg == null) return [];
  const r = await pool.query(
    `SELECT id, agreement_id, from_status, to_status, note, actor, created_at
       FROM tenant_partner_agreement_events WHERE agreement_id = $1 ORDER BY id ASC`,
    [agreementId],
  );
  return r.rows;
}

// ── Referrals ────────────────────────────────────────────────────────────────

export interface CreateReferralInput {
  channel_partner_tenant_id: number | string;
  referred_tenant_id?: number | string | null;
  referral_code: string;
  commission_pct?: number | string | null;
  commission_amount?: number | string | null;
  currency?: string | null;
  status?: string | null; // default 'pending'
  /** Explicit deal/transaction value the commission is computed against (currency units). */
  deal_value?: number | string | null;
  /** When created already 'converted' with no explicit deal_value, auto-resolve it from the referred tenant. */
  link_deal?: boolean;
}

export async function createChannelReferral(pool: pg.Pool, input: CreateReferralInput) {
  await ensurePartnerEcosystemSchema(pool);
  const partnerId = asInt(input.channel_partner_tenant_id, 'channel_partner_tenant_id');
  if (!(await tenantExists(pool, partnerId))) {
    throw new PartnerActionError('tenant_not_found', `channel partner tenant ${partnerId} does not exist.`, 404);
  }
  let referredId: number | null = null;
  if (input.referred_tenant_id != null && input.referred_tenant_id !== '') {
    referredId = asInt(input.referred_tenant_id, 'referred_tenant_id');
    if (referredId === partnerId) {
      throw new PartnerActionError('invalid_input', 'a partner cannot refer itself.');
    }
    if (!(await tenantExists(pool, referredId))) {
      throw new PartnerActionError('tenant_not_found', `referred tenant ${referredId} does not exist.`, 404);
    }
  }
  const code = String(input.referral_code ?? '').trim();
  if (!code) throw new PartnerActionError('invalid_input', 'referral_code is required.');

  let status: ReferralStatus = 'pending';
  if (input.status != null && input.status !== '') {
    if (!(REFERRAL_STATUSES as readonly string[]).includes(String(input.status))) {
      throw new PartnerActionError('invalid_input', `status must be one of: ${REFERRAL_STATUSES.join(', ')}.`);
    }
    status = input.status as ReferralStatus;
  }
  const commissionPct = asCommissionPct(input.commission_pct);
  let commissionAmount = asAmount(input.commission_amount);
  let amountSource: string | null = commissionAmount == null ? null : 'explicit';
  const currency = (String(input.currency ?? 'INR').trim() || 'INR').toUpperCase();
  const converting = status === 'converted';
  const convertedAt = converting ? new Date() : null;

  // ── Deal value + auto-derivation (only on a referral created already converted) ──
  let dealValue: number | null = null;
  let dealSource: string | null = null;
  if (converting) {
    if (input.deal_value != null && input.deal_value !== '') {
      dealValue = asAmount(input.deal_value);
      dealSource = 'manual';
    } else if (input.link_deal && referredId != null) {
      const resolved = await resolveReferredTenantDealValue(pool, referredId);
      if (resolved) { dealValue = resolved.value; dealSource = resolved.source; }
    }
    // Auto-compute the earned amount as pct × deal_value when no explicit amount was supplied.
    if (commissionAmount == null && dealValue != null && commissionPct != null) {
      commissionAmount = Math.round((commissionPct / 100) * dealValue * 100) / 100;
      amountSource = 'derived';
    }
  }

  // Honest guard: a converted referral with no amount is allowed but flagged downstream as a coverage gap.
  let dup = false;
  try {
    const r = await pool.query(
      `INSERT INTO tenant_channel_referrals
         (channel_partner_tenant_id, referred_tenant_id, referral_code, status, commission_pct,
          commission_amount, commission_amount_source, deal_value, deal_value_source, currency, converted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, channel_partner_tenant_id, referred_tenant_id, referral_code, status,
                 commission_pct, commission_amount, commission_amount_source, deal_value, deal_value_source,
                 currency, referred_at, converted_at`,
      [partnerId, referredId, code, status, commissionPct, commissionAmount, amountSource, dealValue, dealSource, currency, convertedAt],
    );
    return r.rows[0];
  } catch (e: any) {
    if (e?.code === '23505') dup = true;
    else throw e;
  }
  if (dup) {
    throw new PartnerActionError('duplicate', `referral_code '${code}' already exists for this partner.`, 409);
  }
}

export async function transitionReferral(
  pool: pg.Pool,
  referralId: number,
  toStatus: string,
  opts: {
    commission_amount?: number | string | null;
    referred_tenant_id?: number | string | null;
    /** Explicit deal/transaction value the commission is computed against (currency units). */
    deal_value?: number | string | null;
    /** When true and no explicit deal_value is given, auto-resolve it from the referred tenant's ledgers. */
    link_deal?: boolean;
  } = {},
) {
  await ensurePartnerEcosystemSchema(pool);
  if (!(REFERRAL_STATUSES as readonly string[]).includes(toStatus)) {
    throw new PartnerActionError('invalid_input', `status must be one of: ${REFERRAL_STATUSES.join(', ')}.`);
  }
  const cur = await pool.query(
    `SELECT id, status, channel_partner_tenant_id, referred_tenant_id, commission_pct, currency
       FROM tenant_channel_referrals WHERE id = $1`,
    [referralId],
  );
  if (cur.rowCount === 0) throw new PartnerActionError('not_found', `referral ${referralId} not found.`, 404);
  const from = String(cur.rows[0].status) as ReferralStatus;
  if (from === (toStatus as ReferralStatus)) {
    throw new PartnerActionError('no_op', `referral is already '${from}'.`);
  }
  const allowed = REFERRAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(toStatus as ReferralStatus)) {
    throw new PartnerActionError(
      'invalid_transition',
      `cannot move referral from '${from}' to '${toStatus}'. Allowed: ${allowed.length ? allowed.join(', ') : '(terminal — none)'}.`,
    );
  }

  // Optionally attach a referred tenant on conversion (never fabricated — only when given).
  let referredId: number | null | undefined;
  if (opts.referred_tenant_id != null && opts.referred_tenant_id !== '') {
    referredId = asInt(opts.referred_tenant_id, 'referred_tenant_id');
    const partnerId = Number(cur.rows[0].channel_partner_tenant_id);
    if (referredId === partnerId) throw new PartnerActionError('invalid_input', 'a partner cannot refer itself.');
    if (!(await tenantExists(pool, referredId))) {
      throw new PartnerActionError('tenant_not_found', `referred tenant ${referredId} does not exist.`, 404);
    }
  }

  const toConverted = toStatus === 'converted';
  // The referred tenant after this transition (new value if supplied, else the stored one).
  const effectiveReferredId =
    referredId !== undefined
      ? referredId
      : cur.rows[0].referred_tenant_id == null
        ? null
        : Number(cur.rows[0].referred_tenant_id);
  const pct = cur.rows[0].commission_pct == null ? null : Number(cur.rows[0].commission_pct);
  const explicitAmount = opts.commission_amount === undefined ? undefined : asAmount(opts.commission_amount);

  // ── Deal value (only meaningful on conversion) ──────────────────────────────
  // Capture the REAL deal value so the payout can be derived as commission_pct × deal_value. Precedence:
  //   1. explicit deal_value (operator-supplied),
  //   2. link_deal → auto-resolve from the referred tenant's realized ledgers,
  //   3. otherwise leave deal_value untouched.
  let dealValue: number | null | undefined;
  let dealSource: string | null | undefined;
  if (toConverted) {
    if (opts.deal_value !== undefined && opts.deal_value !== null && opts.deal_value !== '') {
      dealValue = asAmount(opts.deal_value);
      dealSource = 'manual';
    } else if (opts.link_deal && effectiveReferredId != null) {
      const resolved = await resolveReferredTenantDealValue(pool, effectiveReferredId);
      if (resolved) {
        dealValue = resolved.value;
        dealSource = resolved.source;
      }
    }
  }

  // ── Earned commission ───────────────────────────────────────────────────────
  // An explicit commission_amount always wins. Otherwise, when a deal value + commission_pct are both
  // present, the amount auto-computes as pct × value. When neither path applies it stays an honest gap.
  let amount: number | null | undefined = explicitAmount;
  let amountSource: string | null | undefined =
    explicitAmount === undefined ? undefined : explicitAmount == null ? null : 'explicit';
  if (toConverted && explicitAmount === undefined && dealValue != null && pct != null) {
    amount = Math.round((pct / 100) * dealValue * 100) / 100;
    amountSource = 'derived';
  }

  const convertedAt = toConverted ? new Date() : null;

  const sets: string[] = ['status = $1'];
  const params: any[] = [toStatus];
  let i = 2;
  // converted_at: set on conversion, clear otherwise (so a non-converted state never carries a stale ts).
  sets.push(`converted_at = $${i++}`); params.push(convertedAt);
  if (amount !== undefined) { sets.push(`commission_amount = $${i++}`); params.push(amount); }
  if (amountSource !== undefined) { sets.push(`commission_amount_source = $${i++}`); params.push(amountSource); }
  if (dealValue !== undefined) { sets.push(`deal_value = $${i++}`); params.push(dealValue); }
  if (dealSource !== undefined) { sets.push(`deal_value_source = $${i++}`); params.push(dealSource); }
  if (referredId !== undefined) { sets.push(`referred_tenant_id = $${i++}`); params.push(referredId); }
  params.push(referralId);

  const upd = await pool.query(
    `UPDATE tenant_channel_referrals SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id, channel_partner_tenant_id, referred_tenant_id, referral_code, status,
               commission_pct, commission_amount, commission_amount_source, deal_value, deal_value_source,
               currency, referred_at, converted_at`,
    params,
  );
  return { ...upd.rows[0], from_status: from };
}
