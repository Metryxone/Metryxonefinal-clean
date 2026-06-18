# WC-L3 Deliverable 1 — Concern Coverage Report
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

**`master_concern_pk` is resolved at `/start`** from the free-text `concern_name` via
`resolveSeedConcernPk` (≥60% token overlap against `capadex_concerns_master`, 2489 rows).
We RE-RAN that exact resolver read-only over every stored `concern_name`.

| Metric | Value | of 9 completed |
|---|---|---|
| Sessions with `concern_name` captured (input present) | 9 | 100.0% |
| Sessions with `master_concern_pk` **stored** | 1 | 11.1% |
| Sessions where the EXISTING resolver **re-resolves** a pk today | **9** | **100.0%** |

| Session | Owned | Created | concern_name | stored pk | re-resolved pk |
|---|---|---|---|---|---|
| 0731f92c | yes | 2026-05-17 | Career Anxiety | — | 65 |
| b883418d | yes | 2026-05-18 | Anxiety & Overthinking | — | 705 |
| 7828d7a3 | yes | 2026-05-18 | Anxiety & Overthinking | — | 705 |
| 4349237c | no | 2026-05-24 | Anxiety & Overthinking | — | 705 |
| 4c9b6c0b | no | 2026-05-24 | Anxiety & Overthinking | — | 705 |
| d0f54fc4 | no | 2026-05-24 | Work Stress | — | 430 |
| a0924499 | no | 2026-05-24 | Work Stress | — | 430 |
| 11111111 | yes | 2026-05-30 | Exam stress | — | 1297 |
| 1cd9ca07 | yes | 2026-06-01 | Career Anxiety | 65 | 65 |

**Honest finding:** concern input is captured **100.0%** and the resolver
re-resolves **9/9** today — but only **1** is stored. The gap is **stale/unpersisted
linkage**, NOT a capture failure and NOT a resolver-quality failure. See Root Cause (Deliverable 5).
