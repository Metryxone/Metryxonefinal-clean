/**
 * Task #6 — Invoice & GST Engine · pure GST service.
 *
 * Deterministic, side-effect-free. Operates in integer paise (no float drift). NEVER fabricates:
 * intra/inter-state determination requires BOTH seller and buyer state codes; if either is absent
 * the caller must treat GST as not-determinable rather than guessing.
 *
 * GST model (Indian):
 *   • intra-state (seller state == buyer state) → CGST + SGST (each = rate/2 of taxable)
 *   • inter-state (seller state != buyer state, or buyer unregistered/other-state) → IGST (= rate)
 */

// ── Indian GST state codes (first two digits of a GSTIN). Source: GST state-code master. ──
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

export function stateNameForCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return GST_STATE_CODES[String(code).padStart(2, '0')] ?? null;
}

export interface GstinValidation {
  valid: boolean;
  gstin: string | null;
  state_code: string | null;
  state_name: string | null;
  reason: string | null;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * GSTIN checksum (the 15th character). Algorithm per GSTIN spec:
 *   for each of the first 14 chars, value = index in base-36; multiply by alternating factor
 *   (1,2,1,2,...); for the product, add quotient+remainder of (product / 36); sum; checksum digit
 *   = (36 - (sum % 36)) % 36 mapped back to the base-36 charset.
 */
function gstinChecksumChar(first14: string): string | null {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = GSTIN_CHARS.indexOf(first14[i]);
    if (code < 0) return null;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = code * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkDigit = (36 - (sum % 36)) % 36;
  return GSTIN_CHARS[checkDigit];
}

/** Validate GSTIN format + state code + checksum. Returns a structured result (never throws). */
export function validateGSTIN(raw: string | null | undefined): GstinValidation {
  const gstin = (raw ?? '').trim().toUpperCase();
  if (!gstin) {
    return { valid: false, gstin: null, state_code: null, state_name: null, reason: 'empty' };
  }
  if (gstin.length !== 15) {
    return { valid: false, gstin, state_code: null, state_name: null, reason: 'must be 15 characters' };
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, gstin, state_code: gstin.slice(0, 2), state_name: stateNameForCode(gstin.slice(0, 2)), reason: 'format invalid' };
  }
  const stateCode = gstin.slice(0, 2);
  const stateName = stateNameForCode(stateCode);
  if (!stateName) {
    return { valid: false, gstin, state_code: stateCode, state_name: null, reason: 'unknown state code' };
  }
  const expected = gstinChecksumChar(gstin.slice(0, 14));
  if (expected == null || expected !== gstin[14]) {
    return { valid: false, gstin, state_code: stateCode, state_name: stateName, reason: 'checksum mismatch' };
  }
  return { valid: true, gstin, state_code: stateCode, state_name: stateName, reason: null };
}

export interface GstComputeInput {
  /** Gross amount in paise for the line/document (interpretation depends on priceIncludesGst). */
  amountPaise: number;
  sellerStateCode: string | null | undefined;
  buyerStateCode: string | null | undefined;
  /** Whole-number percent, e.g. 18 for 18% GST on services. */
  gstRatePct: number;
  /** If true, amountPaise is GST-inclusive and taxable is back-calculated; else amountPaise is taxable. */
  priceIncludesGst?: boolean;
}

export interface GstComputeResult {
  determinable: boolean;
  supply_type: 'intra_state' | 'inter_state' | 'undetermined';
  taxable_paise: number;
  gst_rate_pct: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
  total_paise: number;
  reason: string | null;
}

const r2 = (n: number): number => Math.round(n);

/**
 * Compute GST split. Determinable only when both state codes are known. When undetermined we return
 * the taxable amount with ZERO tax and supply_type='undetermined' — the caller must NOT present this
 * as a compliant tax invoice (honest abstain, never a guessed split).
 */
export function computeGST(input: GstComputeInput): GstComputeResult {
  const rate = Number.isFinite(input.gstRatePct) ? Math.max(0, input.gstRatePct) : 0;
  const amount = Math.max(0, r2(input.amountPaise));

  // Back-calculate taxable if the amount is GST-inclusive.
  const taxable = input.priceIncludesGst && rate > 0
    ? r2((amount * 100) / (100 + rate))
    : amount;

  const seller = input.sellerStateCode ? String(input.sellerStateCode).padStart(2, '0') : null;
  const buyer = input.buyerStateCode ? String(input.buyerStateCode).padStart(2, '0') : null;

  if (!seller) {
    return {
      determinable: false, supply_type: 'undetermined', taxable_paise: taxable, gst_rate_pct: rate,
      cgst_paise: 0, sgst_paise: 0, igst_paise: 0, total_tax_paise: 0, total_paise: taxable,
      reason: 'seller state code not configured',
    };
  }
  if (!buyer) {
    return {
      determinable: false, supply_type: 'undetermined', taxable_paise: taxable, gst_rate_pct: rate,
      cgst_paise: 0, sgst_paise: 0, igst_paise: 0, total_tax_paise: 0, total_paise: taxable,
      reason: 'buyer state code not provided',
    };
  }

  const totalTax = r2((taxable * rate) / 100);
  let cgst = 0, sgst = 0, igst = 0;
  let supplyType: GstComputeResult['supply_type'];
  if (seller === buyer) {
    supplyType = 'intra_state';
    cgst = r2(totalTax / 2);
    sgst = totalTax - cgst; // ensure cgst+sgst == totalTax exactly (no rounding drift)
  } else {
    supplyType = 'inter_state';
    igst = totalTax;
  }

  return {
    determinable: true, supply_type: supplyType, taxable_paise: taxable, gst_rate_pct: rate,
    cgst_paise: cgst, sgst_paise: sgst, igst_paise: igst,
    total_tax_paise: cgst + sgst + igst, total_paise: taxable + cgst + sgst + igst,
    reason: null,
  };
}

/** Indian fiscal year string for a date (Apr 1 – Mar 31), e.g. "2026-27". */
export function fiscalYearFor(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0 = Jan
  const startYear = m >= 3 ? y : y - 1; // fiscal year starts in April (month index 3)
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

export const DOC_TYPES = [
  'tax', 'proforma', 'credit_note', 'debit_note', 'payment_receipt', 'refund_receipt',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Short uppercase code used inside the invoice number for each document type. */
export const DOC_TYPE_CODE: Record<DocType, string> = {
  tax: 'TAX', proforma: 'PRO', credit_note: 'CRN', debit_note: 'DBN',
  payment_receipt: 'RCP', refund_receipt: 'RFN',
};

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  tax: 'Tax Invoice', proforma: 'Proforma Invoice', credit_note: 'Credit Note',
  debit_note: 'Debit Note', payment_receipt: 'Payment Receipt', refund_receipt: 'Refund Receipt',
};

export function isDocType(v: unknown): v is DocType {
  return typeof v === 'string' && (DOC_TYPES as readonly string[]).includes(v);
}
