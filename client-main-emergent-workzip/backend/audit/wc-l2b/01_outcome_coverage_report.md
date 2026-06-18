# WC-L2B Deliverable 1 — Outcome Coverage Report
_Generated 2026-06-09T16:34:00.059Z_

Flags at run: `FF_FORECAST_INTELLIGENCE`=ON, `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON.

**Outcome coverage = completed sessions carrying ≥1 `wc3_outcome_state` row.** Owned vs anonymous are
reported separately because only OWNED sessions can ever enter a per-user trend.

| Metric | Before | After |
|---|---|---|
| Sessions with outcome state (total) | 3 | 3 |
| — owned | 1 | 1 |
| — anonymous | 2 | 2 |
| Backfill: sessions resolved (written) | — | **0** |

## Per-session backfill ledger (T002 resolvability → T003 outcome)
Backfill is **additive + never-overwrite-in-this-run**: we pre-filter to sessions with ZERO existing
outcome state before calling the engine, so its `ON CONFLICT DO UPDATE` path is never reached for an
already-covered session; nothing is ever fabricated. A session resolves ONLY if the
Question→Construct→Outcome chain has a real input (`master_concern_pk` → bridge tag → construct, OR
`primary_construct_key`, OR an active behavioural spine). The engine's tier-2 pattern path
(`capadex_session_patterns.construct_key`) is **inert in this schema** (the column does not exist), so
it cannot resolve any of the unlinked sessions — it is not omitted by oversight.

| Session | Owned | Had state | Stage | master_pk | primary_construct | active spine | Resolvable | Written | Note |
|---|---|---|---|---|---|---|---|---|---|
| user_4b262cc8a5 | yes | no | yes | no | no | no | no | no | no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input |
| user_65454b2b8b | yes | no | yes | no | no | no | no | no | no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input |
| user_65454b2b8b | yes | no | yes | no | no | no | no | no | no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input |
| anon | no | yes | yes | no | yes | no | yes | no | skipped — existing outcome state (never-overwrite) |
| anon | no | yes | yes | no | yes | no | yes | no | skipped — existing outcome state (never-overwrite) |
| anon | no | no | yes | no | no | no | no | no | no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input |
| anon | no | no | yes | no | no | no | no | no | no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input |
| user_ec082847d9 | yes | no | yes | no | no | no | no | no | no_concern_linkage — no master_concern_pk / primary_construct_key / active spine; chain has no input |
| user_4b262cc8a5 | yes | yes | yes | yes | no | no | yes | no | skipped — existing outcome state (never-overwrite) |

**Honest finding:** every completed session that *can* resolve an outcome already had one; the
remaining sessions carry **no concern-linkage input at all**, so the existing chain has nothing to
traverse. Backfill wrote **0** rows. This is a data-capture ceiling, not a wiring/flag gap —
see Deliverable 6.
