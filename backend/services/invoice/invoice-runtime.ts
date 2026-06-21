/**
 * Task #6 — Invoice & GST Engine · runtime (numbering + source resolution + persistence).
 *
 * NEVER fabricates: every document is built from a REAL source row (capadex_payment / comm_subscription
 * / a refunded payment). If the source is missing or its status is incompatible with the requested
 * document type, we abstain (throw a typed AbstainError → mapped to 4xx by the route).
 *
 * Numbering is gap-free and collision-safe: the per-(doc_type, fiscal_year) counter is incremented
 * atomically with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` inside the SAME transaction that
 * inserts the invoice, so concurrent requests serialize on the counter row and never duplicate.
 */
import type { Pool, PoolClient } from 'pg';
import {
  computeGST, fiscalYearFor, DOC_TYPE_CODE, DOC_TYPE_LABEL, validateGSTIN,
  type DocType,
} from './gst';

/**
 * Documents that legally carry a GST split. All of these MUST have a determinable supply type before
 * issuance. Proforma is excluded — it is an explicit pre-tax quote, not a compliant tax document.
 */
const GST_BEARING_DOC_TYPES: Record<DocType, boolean> = {
  tax: true, debit_note: true, credit_note: true,
  payment_receipt: true, refund_receipt: true, proforma: false,
};

export class AbstainError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = 'AbstainError';
    this.status = status;
  }
}

export interface SellerConfig {
  legal_name: string;
  trade_name: string | null;
  gstin: string | null;
  state_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  email: string | null;
  phone: string | null;
  default_gst_rate_pct: number;
  hsn_sac: string | null;
}

/** Load the single active seller config, creating a default row on first use. */
export async function getSellerConfig(pool: Pool): Promise<SellerConfig & { id: string }> {
  const { rows } = await pool.query(
    `SELECT * FROM inv_seller_config WHERE is_active = TRUE ORDER BY created_at LIMIT 1`,
  );
  if (rows.length) return normalizeSeller(rows[0]);
  const ins = await pool.query(
    `INSERT INTO inv_seller_config (legal_name) VALUES ('MetryxOne') RETURNING *`,
  );
  return normalizeSeller(ins.rows[0]);
}

function normalizeSeller(r: any): SellerConfig & { id: string } {
  return {
    id: r.id,
    legal_name: r.legal_name ?? 'MetryxOne',
    trade_name: r.trade_name ?? null,
    gstin: r.gstin ?? null,
    state_code: r.state_code ?? null,
    address_line1: r.address_line1 ?? null,
    address_line2: r.address_line2 ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    pincode: r.pincode ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    default_gst_rate_pct: r.default_gst_rate_pct != null ? Number(r.default_gst_rate_pct) : 18,
    hsn_sac: r.hsn_sac ?? null,
  };
}

// ── Source resolution ────────────────────────────────────────────────────────────────────────

export type SourceType = 'capadex_payment' | 'comm_subscription' | 'refund' | 'comm_refund';

/**
 * Strict doc-type → allowed source-type map. `sourceType` is client-supplied, so it must NEVER be
 * allowed to override the doc-type's status semantics. In particular the 'refund' source is a
 * capadex_payment alias that is ONLY valid for refund documents — without this gate an admin could
 * request a `tax`/`debit_note`/`payment_receipt` with source_type='refund' and have it issued from a
 * refunded payment, bypassing the required 'paid' status. Refund docs accept a payment source only
 * (subscriptions carry no refund ledger — see resolveSource).
 */
const ALLOWED_SOURCE_TYPES: Record<DocType, SourceType[]> = {
  tax: ['capadex_payment', 'comm_subscription'],
  proforma: ['capadex_payment', 'comm_subscription'],
  debit_note: ['capadex_payment', 'comm_subscription'],
  payment_receipt: ['capadex_payment', 'comm_subscription'],
  credit_note: ['capadex_payment', 'refund', 'comm_refund'],
  refund_receipt: ['capadex_payment', 'refund', 'comm_refund'],
};

interface ResolvedSource {
  source_type: 'capadex_payment' | 'comm_subscription' | 'refund' | 'comm_refund';
  source_id: string;
  customer_email: string | null;
  customer_name: string | null;
  currency: string;
  /** Gross amount in paise as captured from the real payment row. */
  amount_paise: number;
  description: string;
  is_refund: boolean;
}

/**
 * Resolve a real source row for the requested document type. Doc-type ↔ source-status semantics:
 *   • refund_receipt / credit_note → require a REFUNDED payment.
 *   • payment_receipt / tax / debit_note → require a PAID payment (or active subscription).
 *   • proforma → may reference a not-yet-paid payment/subscription (a quote before payment).
 */
async function resolveSource(
  pool: Pool, docType: DocType, sourceType: SourceType, sourceId: string,
): Promise<ResolvedSource> {
  // Enforce the doc-type → source-type allow-map FIRST so a client-supplied source_type can never
  // flip the status semantics of a document (e.g. source_type='refund' on a 'tax' doc).
  const allowed = ALLOWED_SOURCE_TYPES[docType];
  if (!allowed || !allowed.includes(sourceType)) {
    throw new AbstainError(`source type '${sourceType}' is not valid for ${DOC_TYPE_LABEL[docType]}`, 400);
  }
  if (sourceType === 'capadex_payment' || sourceType === 'refund') {
    const { rows } = await pool.query(
      `SELECT id, email, participant_name, concern_name, stage_name, stage_code,
              amount_paise, currency, status
       FROM capadex_payments WHERE id = $1 LIMIT 1`,
      [sourceId],
    );
    if (!rows.length) throw new AbstainError('source payment not found', 404);
    const p = rows[0];
    const status = String(p.status ?? '').toLowerCase();
    // Refund semantics come ONLY from the doc type — never from the client-supplied source_type.
    const wantsRefund = docType === 'refund_receipt' || docType === 'credit_note';

    if (wantsRefund) {
      if (status !== 'refunded') {
        throw new AbstainError(`payment is '${status}', not 'refunded' — cannot issue ${DOC_TYPE_LABEL[docType]}`);
      }
    } else if (docType !== 'proforma') {
      if (status !== 'paid' && status !== 'captured' && status !== 'completed' && status !== 'success') {
        throw new AbstainError(`payment is '${status}', not paid — cannot issue ${DOC_TYPE_LABEL[docType]}`);
      }
    }
    const amount = Number(p.amount_paise);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AbstainError('source payment has no usable amount');
    }
    const desc = [p.stage_name, p.concern_name].filter(Boolean).join(' — ') || 'CAPADEX assessment';
    return {
      source_type: wantsRefund ? 'refund' : 'capadex_payment',
      source_id: String(p.id),
      customer_email: p.email ?? null,
      customer_name: p.participant_name ?? null,
      currency: p.currency || 'INR',
      amount_paise: amount,
      description: desc,
      is_refund: wantsRefund,
    };
  }

  // comm_refund — the subscription refund ledger (the refund evidence comm_subscriptions lack). Only
  // reachable for credit_note / refund_receipt via the allow-map above, so it can never flip a
  // non-refund doc's status semantics.
  if (sourceType === 'comm_refund') {
    const { rows } = await pool.query(
      `SELECT r.id, r.amount_paise, r.currency, r.status, r.reason,
              c.email AS customer_email, c.name AS customer_name,
              p.name AS plan_name
       FROM comm_refunds r
       JOIN comm_customers c ON c.id = r.customer_id
       LEFT JOIN comm_subscriptions s ON s.id = r.subscription_id
       LEFT JOIN comm_plans p ON p.id = s.plan_id
       WHERE r.id = $1 LIMIT 1`,
      [sourceId],
    );
    if (!rows.length) throw new AbstainError('source refund not found', 404);
    const r = rows[0];
    const rStatus = String(r.status ?? '').toLowerCase();
    if (rStatus !== 'processed') {
      throw new AbstainError(`refund is '${r.status}', not 'processed' — cannot issue ${DOC_TYPE_LABEL[docType]}`);
    }
    const amount = Number(r.amount_paise);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AbstainError('source refund has no usable amount');
    }
    const desc = `${r.plan_name ? `${r.plan_name} subscription` : 'Subscription'} refund`;
    return {
      source_type: 'comm_refund',
      source_id: String(r.id),
      customer_email: r.customer_email ?? null,
      customer_name: r.customer_name ?? null,
      currency: r.currency || 'INR',
      amount_paise: amount,
      description: desc,
      is_refund: true,
    };
  }

  // comm_subscription
  const { rows } = await pool.query(
    `SELECT s.id, s.status, s.billing_interval, s.plan_id,
            c.email AS customer_email, c.name AS customer_name,
            p.name AS plan_name, p.price_paise, p.currency
     FROM comm_subscriptions s
     JOIN comm_customers c ON c.id = s.customer_id
     LEFT JOIN comm_plans p ON p.id = s.plan_id
     WHERE s.id = $1 LIMIT 1`,
    [sourceId],
  );
  if (!rows.length) throw new AbstainError('source subscription not found', 404);
  const s = rows[0];
  const price = Number(s.price_paise);
  if (!Number.isFinite(price) || price <= 0) {
    throw new AbstainError('subscription plan has no usable price');
  }
  const status = String(s.status ?? '').toLowerCase();
  // Refund documents require verifiable refunded evidence. comm_subscriptions carry no refund
  // ledger, so we cannot honestly attest a refund from a subscription row — abstain rather than
  // fabricate one. (Refund/credit documents must originate from a refunded capadex_payment.)
  if (docType === 'refund_receipt' || docType === 'credit_note') {
    throw new AbstainError(
      `${DOC_TYPE_LABEL[docType]} cannot be issued from a subscription — no refund evidence on comm_subscriptions; use a refunded payment source`,
    );
  }
  if (docType !== 'proforma' && status !== 'active' && status !== 'trialing' && status !== 'renewed') {
    throw new AbstainError(`subscription is '${status}' — cannot issue ${DOC_TYPE_LABEL[docType]}`);
  }
  return {
    source_type: 'comm_subscription',
    source_id: String(s.id),
    customer_email: s.customer_email ?? null,
    customer_name: s.customer_name ?? null,
    currency: s.currency || 'INR',
    amount_paise: price,
    description: s.plan_name ? `${s.plan_name} subscription` : 'Subscription',
    is_refund: false,
  };
}

// ── Numbering ────────────────────────────────────────────────────────────────────────────────

/** Atomically increment & return the next sequence value for (doc_type, fiscal_year) on `client`. */
async function nextSequenceValue(client: PoolClient, docType: DocType, fiscalYear: string): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO inv_number_sequence (doc_type, fiscal_year, next_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (doc_type, fiscal_year)
     DO UPDATE SET next_value = inv_number_sequence.next_value + 1, updated_at = now()
     RETURNING next_value`,
    [docType, fiscalYear],
  );
  return Number(rows[0].next_value);
}

function formatInvoiceNumber(docType: DocType, fiscalYear: string, seq: number): string {
  return `MX/${DOC_TYPE_CODE[docType]}/${fiscalYear}/${String(seq).padStart(5, '0')}`;
}

// ── Generation ───────────────────────────────────────────────────────────────────────────────

export interface GenerateInput {
  docType: DocType;
  sourceType: SourceType;
  sourceId: string;
  buyerGstin?: string | null;
  buyerStateCode?: string | null;
  gstRatePct?: number | null;
  /** When true, the source amount is treated as GST-inclusive and taxable is back-calculated. */
  priceIncludesGst?: boolean;
  notes?: string | null;
  relatedInvoiceId?: string | null;
}

export interface GeneratedInvoice {
  invoice: any;
  line_items: any[];
}

/**
 * Build and persist an invoice document from a real source, computing GST. All writes happen inside
 * one transaction so the number, the invoice and its line items are atomic.
 */
export async function generateInvoice(pool: Pool, input: GenerateInput): Promise<GeneratedInvoice> {
  const seller = await getSellerConfig(pool);
  const source = await resolveSource(pool, input.docType, input.sourceType, input.sourceId);

  // Buyer GSTIN (optional). If supplied it must be valid, and its state code wins over a free-typed one.
  let buyerStateCode = input.buyerStateCode ? String(input.buyerStateCode).padStart(2, '0') : null;
  let buyerGstin: string | null = null;
  if (input.buyerGstin && String(input.buyerGstin).trim()) {
    const v = validateGSTIN(input.buyerGstin);
    if (!v.valid) throw new AbstainError(`buyer GSTIN invalid: ${v.reason}`, 400);
    buyerGstin = v.gstin;
    buyerStateCode = v.state_code;
  }

  const rate = input.gstRatePct != null && Number.isFinite(input.gstRatePct)
    ? Math.max(0, Number(input.gstRatePct))
    : seller.default_gst_rate_pct;

  const gst = computeGST({
    amountPaise: source.amount_paise,
    sellerStateCode: seller.state_code,
    buyerStateCode,
    gstRatePct: rate,
    priceIncludesGst: input.priceIncludesGst ?? true,
  });

  // Compliance abstain: a GST-bearing document (everything except a non-binding Proforma quote) MUST
  // carry a determinable supply type (intra/inter-state). When seller or buyer state is missing the
  // split cannot be honestly computed, so we abstain rather than issue a zero-GST 'undetermined'
  // document that falsely looks compliant. Proforma is exempt — it is explicitly a pre-tax estimate.
  if (GST_BEARING_DOC_TYPES[input.docType] && !gst.determinable) {
    throw new AbstainError(
      `cannot issue a compliant ${DOC_TYPE_LABEL[input.docType]}: GST is not determinable (${gst.reason}). ` +
      `Configure the seller state code and provide the buyer state code or a valid GSTIN, or issue a Proforma instead.`,
      422,
    );
  }

  const fiscalYear = fiscalYearFor(new Date());
  const placeOfSupply = buyerStateCode;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seq = await nextSequenceValue(client, input.docType, fiscalYear);
    const invoiceNumber = formatInvoiceNumber(input.docType, fiscalYear, seq);

    const { rows: invRows } = await client.query(
      `INSERT INTO inv_invoices (
         invoice_number, doc_type, status, fiscal_year, source_type, source_id, related_invoice_id,
         customer_email, customer_name, buyer_gstin, buyer_state_code, place_of_supply, supply_type,
         currency, subtotal_paise, discount_paise, taxable_paise, gst_rate_pct,
         cgst_paise, sgst_paise, igst_paise, total_tax_paise, total_paise,
         seller_gstin, seller_state_code, notes
       ) VALUES (
         $1,$2,'issued',$3,$4,$5,$6,
         $7,$8,$9,$10,$11,$12,
         $13,$14,$15,$16,$17,
         $18,$19,$20,$21,$22,
         $23,$24,$25
       ) RETURNING *`,
      [
        invoiceNumber, input.docType, fiscalYear, source.source_type, source.source_id,
        input.relatedInvoiceId ?? null,
        source.customer_email, source.customer_name, buyerGstin, buyerStateCode, placeOfSupply,
        gst.supply_type, source.currency,
        gst.taxable_paise, 0, gst.taxable_paise, rate,
        gst.cgst_paise, gst.sgst_paise, gst.igst_paise, gst.total_tax_paise, gst.total_paise,
        seller.gstin, seller.state_code, input.notes ?? null,
      ],
    );
    const invoice = invRows[0];

    const { rows: liRows } = await client.query(
      `INSERT INTO inv_line_items (invoice_id, line_no, description, hsn_sac, quantity, unit_paise, amount_paise)
       VALUES ($1, 1, $2, $3, 1, $4, $4) RETURNING *`,
      [invoice.id, source.description, seller.hsn_sac, gst.taxable_paise],
    );

    await client.query('COMMIT');
    return { invoice, line_items: liRows };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getInvoiceWithItems(pool: Pool, id: string): Promise<GeneratedInvoice | null> {
  const { rows } = await pool.query(`SELECT * FROM inv_invoices WHERE id = $1 LIMIT 1`, [id]);
  if (!rows.length) return null;
  const items = (await pool.query(
    `SELECT * FROM inv_line_items WHERE invoice_id = $1 ORDER BY line_no`, [id],
  )).rows;
  return { invoice: rows[0], line_items: items };
}
