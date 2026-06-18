# WC-L3 — Executive Summary (Concern Linkage Intelligence Audit)
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

## Success-criteria answers
| Question | Answer |
|---|---|
| **Where is linkage lost?** | At the FIRST hop — `master_concern_pk` (1/9 stored) — and secondarily `primary_construct_key` (2/9). Everything downstream (outcome 3/9, forecast 0/2) is INHERITED loss, not its own failure. |
| **Why is linkage lost?** | NOT capture (concern_name present 100.0%) and NOT resolver quality (re-resolves 9/9 concerns today). It is **stale persistence**: the resolve runs at `/start` and these legacy sessions predate that wiring. Residuals: 4 construct mapping gaps + 3 zero-response sessions. |
| **Which fix gives the largest lift?** | A **concern re-resolve backfill of existing data** using the EXISTING resolver (Scenario A): concern 1→9, outcome 3→9, forecast 0→2/2. Construct mapping & spine wiring are largely redundant for outcome/forecast. |
| **Shortest path to >90% linkage coverage?** | Scenario A alone → 100.0% concern linkage, deterministic, no new capture, no new ontology. |
| **Shortest path to >90% forecast readiness?** | Scenario A alone → 100.0% of eligible owners. Remaining ceiling is longitudinal depth (≥2 owned outcome-bearing sessions/user), not linkage. |

## How this refines WC-L2B
WC-L2B concluded outcome activation was blocked by "upstream concern-linkage capture, unfixable by reuse."
WC-L3 sharpens that: the concern **text** IS captured; only the **resolved pk/key** went unpersisted, and the
EXISTING resolver recovers 9/9 from data on disk. So the WC-L2B backfill was a no-op only because it
re-read the stored (NULL) linkage — **re-resolving concern_name first would let that same idempotent backfill
activate outcomes for 9/9 sessions and forecasts for 2/2 eligible owners.** That is the
shortest path, and it needs no new capture pipeline — contrary to the WC-L2B framing.

## Recommendation (no work taken — STOP FOR APPROVAL)
1. **Highest leverage:** a read-then-write `master_concern_pk`/`primary_construct_key` **re-resolve backfill**
   over completed sessions (existing `resolveSeedConcernPk`/`detectCategory`; additive; never overwrite a
   non-null), THEN re-run the existing WC-L2B outcome backfill + trend recompute.
2. **Small follow-on:** add 4 curated `CONCERN_TO_CONSTRUCT` entries (`Career Anxiety`, `Work Stress`).
3. **Lower priority:** invoke hypothesis generation within `/respond` for new sessions (does not help the 3
   zero-response legacy sessions). The durable ceiling is longitudinal depth, not linkage.
