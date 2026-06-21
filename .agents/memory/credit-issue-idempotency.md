---
name: Credit-issue idempotency
description: Why issueCredit needs key-based dedup distinct from its concurrency lock, and the opt-in trap.
---
# Credit-issue idempotency (retried refund webhooks)

`issueCredit` serializes writers on a per-customer `SELECT ... FOR UPDATE` row lock so the derived
`balance_after_paise` chain stays consistent. **Serialization is NOT idempotency** — two retried
refund webhooks (same gateway refund id) each append a SEPARATE valid credit row, DOUBLING the granted
store value.

**The rule:** dedup must key on something stable. Supply an idempotency key (header `Idempotency-Key`
or body `idempotency_key`) OR derive one from the refund identity. The dedup lookup runs INSIDE the
already-held per-customer lock (check-then-insert is race-safe there), backed by a partial unique index
`(customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.

**Why ref-based dedup is OPT-IN (`dedupe_by_ref:true`), not automatic:**
The existing #28 concurrency regression fires a 12-issue storm with the SAME `ref_id='task28'` and
asserts 12 rows. If `(customer_id, ref_type, ref_id)` deduped automatically, that storm would collapse
to 1 row and break the test — and any legacy caller reusing a ref_id would silently lose credits.
**How to apply:** key-less / flag-less callers MUST stay byte-identical (append-only). New refund-to-
credit callers set the header (preferred) or `dedupe_by_ref:true` + ref_type/ref_id.

**Replay contract:** a deduped issue returns HTTP 200 + `deduped:true` (replayed existing entry); a
fresh grant returns 201 + `deduped:false`. The whole credit subsystem is behind the
`commercialSubscriptions` flag; the nullable column + partial index are additive (no migration runner —
mirror the DDL in services/commercial/catalog-schema.ts ensure-schema).
