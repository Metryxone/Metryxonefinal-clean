---
name: onto_competency_type_map NOT NULL columns
description: Both confidence and evidence are NOT NULL — any upsert must supply them or it 500s
---

`onto_competency_type_map` (Phase 1.1 competency-type classification) has TWO
non-obvious NOT NULL columns beyond the keys:
- `confidence` varchar NOT NULL default `'high'` (only value seen in data: `'high'`)
- `evidence` text NOT NULL default `''`

**Rule:** any INSERT/UPSERT that lists `confidence` or `evidence` in its column
list must pass a non-null value. Passing `confidence = NULL` explicitly (even
though there's a default) violates the constraint and throws at runtime — the
default only applies when the column is OMITTED from the INSERT.

**Why:** Phase 1.7 bulk `assign_type` upsert set `confidence = NULL` to signal
"machine-unscored, flagged for review" — it 500'd. Fix: use `confidence='high'`
+ a descriptive `evidence` string, `needs_review=true`, `provenance='manual_bulk'`.

**How to apply:** for manual/bulk human assignments, mirror the existing
convention (confidence `'high'`, real evidence note, `needs_review=true`) rather
than inventing a NULL/empty sentinel. Conflict target is `(competency_id)` —
one type per competency.
