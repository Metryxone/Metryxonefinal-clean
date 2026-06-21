---
name: Usage metering dimensions (Phase 6.5)
description: Counting-kind semantics + concurrency/read-only traps when extending comm_usage_events metering to business dimensions.
---

# Usage metering across business dimensions

The append-only metering substrate (`comm_usage_events`, keyed by lowercased email)
serves 8 business dimensions with THREE distinct counting kinds — conflating them
corrupts totals:

- **period_count** (assessments, candidates, jobs, employers, institutions, api):
  usage = `SUM(quantity)` within the active quota window.
- **level / gauge** (storage): usage = the LATEST reading per identity, NOT the
  historical SUM. Overview must aggregate `SUM(latest-per-identity)` via
  `DISTINCT ON (lower(email), usage_type) ... ORDER BY occurred_at DESC` — summing
  all rows over-counts every prior reading.
- **credit_balance** (credits): NOT a usage_type at all — it lives in the credit
  ledger, bridged email→`comm_customers.id`. No customer ⇒ honest balance 0, never
  fabricate.

**Why:** "no active subscription", "no declared quota", and "absent substrate" are
distinct honest states; collapsing them to 0 fabricates data.

## Fail-closed quota enforcement must be ATOMIC
A naive `recordUsage` that reads `checkQuota` then INSERTs has a read-then-write
race: N concurrent writers all pass the pre-check and overrun the limit. Fix:
open a transaction client, take a per-identity+type transaction-scoped lock
`pg_advisory_xact_lock(hashtext(lower(email)), hashtext(usageType))`, re-check the
quota INSIDE the txn, insert, COMMIT. One lock key per write ⇒ no lock-order
deadlock; worst case is bounded serialization for the same identity+type.
**How to apply:** the count/check helpers must accept `Queryable` (Pool|PoolClient)
so they run on the txn client.

## GET-never-writes on read paths
Read endpoints/engines must NOT call any lazy `ensure*Schema()` (CREATE = a write).
Probe with `to_regclass` and degrade (empty/0) when the table is absent. Keep
ensure-schema strictly on POST/write chains. Easy miss: pre-existing legacy GET
routes (`/check`, `/overview`) that still ran ensure-schema — move them to a
read-only middleware chain.
