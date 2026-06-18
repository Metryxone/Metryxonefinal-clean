# WC-11 — Report 2: Decision Coverage

**Bank:** 30638 clarity questions. **Chain:** Question → Bridge Tag → Construct → Outcome → Journey → Decision.

## Per-layer coverage (the decision inputs)
| Layer | Covered | % bank |
|-------|---------|--------|
| L1 Stage | 30638 | 100% |
| L2 Outcome | 26233 | 85.6% |
| L3 Journey | 26233 | 85.6% |

## Decision completeness (how many layers each question reaches)
A unified decision is ALWAYS composed (never null); it degrades honestly when a layer is absent.
| Completeness | Meaning |
|--------------|---------|
| 3/3 layers | full decision — stage + outcome + a real route |
| stage-only | honest degraded decision (no construct → no outcome/route; deterministic mentoring fallback) |

- Construct-reachability ceiling = 26233 (85.6%): questions whose bridge
  tag resolves to ≥1 construct. L2 and L3 both sit AT this ceiling — every construct-reachable
  question reaches both an outcome and a real route; the remaining 4405
  (14.4%) have NO construct and are unreachable by any decision-layer change.
- L1 Stage is 100% (L5A stamps every question), so the decision ALWAYS carries at least a stage +
  the deterministic mentoring fallback route — no session terminates without a decision.

## Session-level (read-only, 9 completed sessions)
| Metric | Value |
|--------|-------|
| Sessions with a composed decision | 9 / 9 |
| Non-degraded decisions | 0 |
| Mean unified confidence | 0.489 |
