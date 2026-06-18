# AQ-2R · 02 — Metadata Consumption Report

How much of the AQ-2 metadata the runtime selection actually consumes.

| Measure | Value |
|---|---|
| Metadata join coverage (bank-wide) | 100.0% (30,638 / 30,638) |
| Envelopes measured | 192 |
| Metadata present in selected questions | 100% |
| Signal confidence present in selected questions | 53.1% |

### Dimension coverage of the bank (AQ-2 reconstruction, for reference)
| Dimension | Bank coverage |
|---|---|
| Age | 99.6% |
| Persona | 96.9% |
| Stage | 100% |
| Behavior | 99.9% |
| Capability | 100% |
| Signal | 55.8% |

Signal is the sparsest dimension (55.8% of the bank), which is why the post-selection
signal-confidence figure is bounded — the runtime consumes what exists and never
fabricates a signal where AQ-2 recorded none.

### Within-pool differentiability (the real value ceiling)
A dimension can only change the runtime selection if it **varies across a concern's
candidate pool**. Measured over 32 candidate pools,
the share that carry >1 distinct value for each dimension:

| Dimension | Pools with variance |
|---|---|
| Question Intelligence Score (QIS) | 100% |
| Dev stage | 100% |
| Persona (primary) | 28.1% |
| Signal confidence | 0% |
| Age band | 0% |
| Behavior | 0% |
| Capability | 0% |

**Key finding (measured, honest):** AQ-2 derived signal / age-band / behavior /
capability at **tag (family) granularity**, so they are effectively constant within a
single concern's pool and cannot move the within-pool re-rank — only QIS, dev-stage
and (partly) persona vary per question. That is precisely why the Trust and Relevance
deltas are positive while Signal and Construct deltas are ~0: the runtime exploits
exactly the per-question variance that exists, and nothing it doesn't. Raising the
signal/construct deltas would require AQ-2 to re-derive those dimensions at
per-question granularity — a data-layer change, not a runtime one.
