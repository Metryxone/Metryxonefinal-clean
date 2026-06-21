---
name: Revenue-by-geography over an invoice ledger
description: How to aggregate revenue-by-geography from inv_invoices without polluting totals or coverage math
---

# Revenue-by-geography from the GST invoice ledger

When deriving a **revenue-by-geography** breakdown from `inv_invoices` (the only place a
buyer location exists — the payment ledgers carry no state/region), two filters are mandatory or
the numbers are materially wrong:

1. **Restrict to revenue source types**: `source_type IN ('capadex_payment','comm_subscription')`.
   The ledger also holds `manual` and `refund` rows (and `doc_type` `credit_note`/`refund_receipt`),
   which are NOT new revenue. Omitting this lets a single large manual/adjustment invoice dominate the
   geography distribution and inflate the `coverage_pct` (invoiced ÷ collected).
2. **State fallback**: `COALESCE(NULLIF(buyer_state_code,''), NULLIF(place_of_supply,''), 'undeclared')`.
   `buyer_state_code` is frequently NULL; `place_of_supply` is the GST fallback. Grouping on
   `buyer_state_code` alone silently buckets real revenue into `undeclared`.

Also keep the existing `status <> 'cancelled'` and `doc_type IN ('tax','payment_receipt')` filters.

**Why:** geography is an *invoice-derived proxy*, so coverage is intrinsically partial (only invoiced
revenue has a location). That's honest — but if the aggregation also counts non-revenue invoice rows
or mis-buckets NULL states, the proxy becomes fabricated-looking rather than honestly partial.

**How to apply:** any new revenue-by-region/state/geo metric sourced from `inv_invoices`. Guard it in a
smoke test by seeding (a) a `manual` invoice that must be EXCLUDED and (b) a revenue invoice with NULL
`buyer_state_code` + populated `place_of_supply` that must resolve via the fallback.
