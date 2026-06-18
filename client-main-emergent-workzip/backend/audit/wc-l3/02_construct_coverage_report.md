# WC-L3 Deliverable 2 — Construct Coverage Report
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

**`primary_construct_key` is resolved at `/start`** (client `construct_key` → else `detectCategory`
over `concern_name` against `CONCERN_TO_CONSTRUCT`/`CONSTRUCT_MAP`). We re-ran `detectCategory` read-only.

| Metric | Value | of 9 |
|---|---|---|
| `primary_construct_key` **stored** | 2 | 22.2% |
| `detectCategory` **re-resolves** a construct today | **5** | **55.6%** |
| Unmappable by existing `detectCategory` (mapping gap) | 4 | 44.4% |

| Session | concern_name | stored construct | re-resolved construct |
|---|---|---|---|
| 0731f92c | Career Anxiety | — | — (gap) |
| b883418d | Anxiety & Overthinking | — | STRESS_MANAGEMENT |
| 7828d7a3 | Anxiety & Overthinking | — | STRESS_MANAGEMENT |
| 4349237c | Anxiety & Overthinking | STRESS_MANAGEMENT | STRESS_MANAGEMENT |
| 4c9b6c0b | Anxiety & Overthinking | STRESS_MANAGEMENT | STRESS_MANAGEMENT |
| d0f54fc4 | Work Stress | — | — (gap) |
| a0924499 | Work Stress | — | — (gap) |
| 11111111 | Exam stress | — | EXAM_PERFORMANCE |
| 1cd9ca07 | Career Anxiety | — | — (gap) |

**Mapping-gap concerns** (present, meaningful, but absent from `CONCERN_TO_CONSTRUCT`): `Career Anxiety`, `Work Stress`.
**Honest finding:** construct linkage is a TWO-part loss — **3** stale (re-resolvable now)
+ **4** a genuine mapping gap that needs a small curated `CONCERN_TO_CONSTRUCT` addition.
Note the master-concern path still reaches these sessions' outcomes even without a construct key (Deliverable 4).
