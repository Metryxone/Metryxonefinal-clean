---
name: Invoice & GST Engine
description: Honesty + doc-type↔source-status gating rules for the inv_* invoice/GST feature
---

# Invoice & GST Engine (flag `invoiceGstEngine` / env `FF_INVOICE_GST_ENGINE`, default OFF)

`inv_*` tables (inv_seller_config single active row, inv_invoices, inv_line_items, inv_number_sequence).
Sources are REAL rows only: `capadex_payments` + `comm_subscriptions` (JOIN comm_customers/comm_plans price_paise). All amounts integer paise.

## Refund evidence rule (the non-obvious one)
Refund Receipt / Credit Note may ONLY be issued from a **refunded `capadex_payments`** row (status='refunded').
`comm_subscriptions` carries **no refund ledger**, so refund/credit docs from a subscription source MUST abstain (AbstainError) — never fabricate a refund.
**Why:** honesty-over-optimism; issuing a refund doc without refund evidence is fabrication.
**How to apply:** if you later add a subscription refund/credit ledger, relax the abstain in resolveSource's subscription branch AND re-enable the disabled Subscription option for refund docs in FinancialsPanel.

## GST determinability rule (the second non-obvious one)
A GST-bearing document (tax / debit_note / credit_note / payment_receipt / refund_receipt) MUST abstain when GST is **not determinable** — i.e. seller state OR buyer state/GSTIN missing → `computeGST` returns `supply_type='undetermined'`. Only **Proforma** (a pre-tax quote) may be issued undetermined.
**Why:** issuing a zero-GST "undetermined" tax doc looks compliant but isn't — that's silent fabrication. The renderer's "not determined" note is NOT a substitute for abstaining on real tax docs.
**How to apply:** the gate lives in `generateInvoice` keyed off a GST_BEARING_DOC_TYPES map; the frontend mirrors it (blocks generate for non-proforma when neither buyer state nor GSTIN is set). Keep both in lockstep if doc types change.

## Other gating
- doc-type↔status: tax/payment_receipt/debit_note need PAID; proforma may reference unpaid; refund/credit need refunded.
- Numbering is gap-free + collision-safe only because the per-(doc_type,fiscal_year) counter bump and the invoice insert share ONE transaction — keep them atomic if refactoring.
- `getSellerConfig` lazily INSERTs the seller row with state_code=NULL — any test/seed that UPDATEs seller state must call getSellerConfig FIRST or the UPDATE hits 0 rows (caused a false "igst=0 inter-state" smoke fail).
- capadex_payments is EMPTY in dev → engine honestly abstains; seed a real row to exercise generation.
