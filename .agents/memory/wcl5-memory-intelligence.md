---
name: WC-L5 Memory Intelligence (compose-only persistence + retrieval)
description: Lessons for the snapshot-of-existing-intelligence memory layer (wcl5_memory) — fold/key/fail-closed/dual-axis honesty rules.
---

# WC-L5 Memory Intelligence — durable lessons

A "memory" layer that SNAPSHOTS already-computed upstream intelligence (WC-L0→L4) into one table and reads
it back. Compose-only: it must add NO new construct/scoring/AI — every row is a verbatim snapshot whose
confidence is **inherited** from its source. The table is a new namespace (`wcl5_memory`); the pre-existing
`*_memory` services (e.g. `routes/memory-architecture.ts`) are DISTINCT legacy features — never reuse them.

## Honesty rules that matter (and why)
- **Fail-closed, never placeholder**: absent / UNCLASSIFIED / empty source ⇒ NO row. Volume is bounded by
  what upstream already produced; memory never invents an atom.
- **`compose_error` only on a caught exception.** A real error must not masquerade as honest-empty. Inner
  per-source `try/catch` (trends/forecasts/intervention-read) MUST log — a silently-swallowed fault is
  indistinguishable from a legitimately-empty source otherwise.
- **Trend fold trap**: WC-L1 Trend spans **9 metrics** (4 levers + 5 behaviour dims); a forecast covers
  only **4 kinds**. Fold trend into the user-level `behaviour_memory` type (two key shapes:
  `user_intelligence` snapshot + one `trend:<metric>` row), NEVER into `forecast_memory` — that would
  silently drop 5 of 9 metrics. `getUserTrends(pool,email)` already returns ALL 9 (no behaviour_ filter),
  so do NOT also call a behaviour-only trend getter (double-count).
- **`memory_key` = STABLE SEMANTIC key**, never the salient value (`canonical_stage`, `model:<k>`, `route`,
  `trend:<metric>`, `forecast:<kind>`, `intervention:<id>`). Value-keyed + UPSERT would duplicate rows on
  every re-run. UPSERT-only on `(session_id,memory_type,memory_key)`; no stale-prune DELETE; `created_at`
  preserved on conflict; distinct `session_id` = distinct snapshot = history preserved.
- **Degraded is remembered, bucketed apart**: degraded journey/decision routes are a routing guarantee, not
  progression — store them (factual) but report real-vs-degraded separately.
- **Backfill-time anachronism**: user-level state (trend/forecast) read at backfill time is duplicated
  IDENTICALLY into each of a user's historical sessions — it is NOT a point-in-time-of-session snapshot.
  The live hook is point-in-time going forward. Disclose this in the deliverable, don't hide it.

## Dual-axis measurement
- **Structural** (is it built/wired) vs **Activation** (is real intelligence flowing) — report SEPARATELY,
  never blend. Structural rows are largely self-asserted code presence; the one *measured* structural check
  is round-trip fidelity (retrieval count == persisted count).
- **Denominators are the honest part**: recall/trend/forecast denominator = users with ≥2 sessions
  (longitudinal), NEVER total completed sessions. Anonymous sessions (no email key) are structurally
  excluded from recall/trend/forecast — state the count. Intervention memory is bounded by WC-L4
  persistence; `wcl5-backfill` MUST run AFTER `wcl4-backfill` (report empty WC-L4, never silently zero).
- Activation can legitimately read full marks when each enabler is a `≥1` "is it flowing at all" threshold
  AND every data cap is disclosed beside the score — that is honest, not an over-claim.

## Schema/flag discipline
- `ensureWcl5MemorySchema` runs ONLY in the persist path (flag-gated hook / backfill that forces the flag).
  Read path (retrieval) creates NOTHING. Flag default OFF ⇒ no module load, no DDL, no write ⇒ byte-identical.
- Snapshot only NON-PII fields from the user layer (exclude `user_email` from the value JSON — it lives in
  the dedicated column as the retrieval key). Measure masks emails with one-way sha256 before any writeFile.
