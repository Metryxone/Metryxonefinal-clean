# L5D Runtime — Report 2: Journey Coverage

Chain: Question → Bridge Tag → Construct → Outcome → Journey Route. Frequency-weighted (n=30638; 325 distinct bridge tags). Read-only projection; no runtime wiring.

| Metric | Value |
|--------|-------|
| Questions reaching ≥1 journey | **24588 (80.3%)** |
| ...reaching a **specialised** (non-fallback) journey as primary | 21185 (69.1%) |
| Questions reaching NO journey (orphan) | 6050 (19.7%) |

**Journey reach is strictly downstream of outcome reach** — a question with no outcome cannot reach a journey. Journey coverage (80.3%) therefore equals outcome coverage; among the 24588 outcome-covered questions, journey coverage is **100.0%** (the mentoring fallback has affinity for all 7 outcome models, so every outcome-bearing question reaches ≥1 route). The uncovered residual is the honest no-outcome set from L5C — never forced onto a journey.
