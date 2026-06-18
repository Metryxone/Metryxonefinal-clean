# AQ-2R · 05 — Assessment Intelligence Delta

**Selection AIS** = mean(Question Relevance, Signal Confidence, Construct Accuracy)
over the selected questions. This is a **SELECTION** metric and is distinct from the
AQ-2 **BANK** AIS (73.9 = coverage×confidence of the whole reconstructed bank).

| Metric | BEFORE | AFTER | Delta |
|---|---|---|---|
| Question Relevance | 27.1 | 27.8 | +0.7 |
| Signal Confidence | 31.3 | 31.3 | +0 |
| Construct Accuracy | 100 | 100 | +0 |
| **Selection AIS** | **52.8** | **53** | **+0.2** |

Construct Accuracy = mean of (primary_behavior present + primary_capability present,
excluding `UNASSIGNED_ROUTING_NODE`) / 2 over the selection.

Reference: AQ-2 BANK AIS = 73.9 (not comparable to Selection AIS above — different unit).

### Why the deltas are bounded (measured, not excused)
The re-rank can only move a metric whose underlying dimension VARIES within a
concern's candidate pool. Per deliverable 02's differentiability table, AQ-2 fixed
signal / age-band / behavior / capability at tag granularity, so Signal Confidence and
Construct Accuracy are invariant within a pool → their deltas are ~0 by construction,
not by failure. The genuine per-question variance lives in QIS, dev-stage and persona,
which is exactly where AQ-2R delivers its Trust (++3.8) and
Relevance (++0.7) lift plus a stage-ordered progression. No
metric was tuned; the ceiling is a property of the AQ-2 data layer's granularity.
