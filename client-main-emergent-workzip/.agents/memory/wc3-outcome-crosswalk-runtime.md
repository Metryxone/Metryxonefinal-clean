---
name: WC-3 Outcome runtime construct resolution + L5C crosswalk tier
description: How the WC-3 Outcome layer resolves a session's constructs at runtime, the dead pattern-spine tier trap, and the flag-gated clarity-bank crosswalk fallback.
---

# WC-3 Outcome runtime construct resolution

`outcome-intelligence.ts::loadSessionConstructs` is the ONLY place the live Outcome
layer decides which constructs a session carries. Order is a strict cascade:
1. `behavioural_hypotheses` (lifecycle_state='active', construct_key) — the real spine.
2. `capadex_session_patterns` — **DEAD tier**: that table has NO `construct_key` column
   in the live schema (only `pattern_key`), so this query throws. It is wrapped in its
   own try/catch and degrades to `[]`. This is its effective result today — do NOT try to
   "repair" it by inventing a pattern_key→construct mapping (that would fabricate).
3. L5C clarity-bank crosswalk — **flag-gated empty-spine fallback only**.

**Why the per-tier try/catch matters:** before WC-10, tier-2's throw was swallowed by the
*outer* catch, which returned `[]` for the whole function. Any tier added AFTER tier-2 in
the same try block would therefore never run. When you add a tier after a query that can
throw on a schema mismatch, isolate the throwing query in its own try/catch or the new tier
is silently unreachable.

## L5C crosswalk tier (WC-10 Lever 1)
- Gate: `isWc3OutcomeCrosswalkEnabled()` (`FF_WC3_OUTCOME_CROSSWALK`, default OFF) AND spine
  yielded 0 constructs. Flag-OFF (or non-empty spine) → byte-identical to legacy.
- Resolution: session bridge tag = `capadex_sessions.master_concern_pk` →
  `capadex_concerns_master.relational_bridge_tag` → `resolveConstructForBridgeTag(tag)`.
  Mirror `outcome-projection.ts::projectOutcome` semantics exactly: HIGH→construct,
  REVIEW→ALL candidates. UNION the session's `primary_construct_key`. never-throws → [].
- UNMAPPED / absent tag + no primary construct → `[]` (never fabricate an outcome).

## Catalog folds + new model (WC-10 Levers 2/3)
- Outcome models live in `wc3_outcome_models` (`construct_keys text[]`), seeded in
  `ensureWc3OutcomeSchema` with `ON CONFLICT DO NOTHING` → seed edits never touch existing
  rows. Folds onto existing rows need explicit idempotent UPDATEs.
- **Strict write-no-op fold pattern:** guard with `WHERE NOT (construct_keys @> $1::text[])`
  (skips the row entirely once all keys present) + `ORDER BY` the rebuilt array (deterministic).
  Plain `unnest(a||b)` re-unions are idempotent in VALUE but still rewrite the row + give
  non-deterministic order every restart.
- Journey affinities (`wc3_journey_routes.model_affinities` jsonb) for a NEW outcome model
  must be added to existing rows with a guarded merge: `SET ... = x || '{...}'::jsonb WHERE
  NOT (x ? 'key')` — so a new model routes non-degraded and a manual tune is never clobbered.
- A construct can be reachable (in a model's `construct_keys`) yet have ZERO
  `intervention_library` rows (e.g. CAREER_GROWTH). That is HONEST "actionable debt": the
  outcome activates, the model's other keys supply actions. Do NOT exclude it to hide the gap.

## Measuring coverage
`scripts/wc3/build-outcome-projection.ts` is read-only (reads models from DB, projects the
whole clarity bank). It does NOT apply ensure — run the schema/ensure path first, then it.
WC-10 lifted question-level coverage 80.3%→85.6% (ceiling); NONE residual ~14.4% is honest
UNMAPPED, not a bug.
