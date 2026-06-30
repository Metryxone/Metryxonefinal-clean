# 14 · KPI Blueprint

ONE KPI model — authored at 100% as the **canonical TARGET model**, with realized-runtime status marked
**honestly** as forward work. Promotes Operating-Model (`26`) to blueprint depth. KPIs span three tiers:
**Operational (live) · Per-capability (missing) · Business/Outcome (deferred until realized).**

## KPI tiers (canonical TARGET model)
### Tier A — Operational KPIs (IMPLEMENTED, live)
| KPI | Surface | Status |
|---|---|---|
| Platform activity (≈45 counts → 8 widgets) | Mission Control aggregator | IMPLEMENTED |
| Enterprise analytics surfaces | `FF_ENTERPRISE_ANALYTICS` | IMPLEMENTED (flag-gated) |
| Usage metering | period_count / level-latest / credit-balance | IMPLEMENTED |
| Platform/intelligence metrics (6 SEPARATE, no composite) | MX-700/MX-800 `/metrics` | DORMANT (flag-gated) |

### Tier B — Per-capability success KPIs (MISSING — forward work)
Each capability traces to reports but **not** to a bound success metric (the outcome/KPI tail break in 15).
Target: bind every capability cluster (10) to one named success KPI.

### Tier C — Business / Outcome KPIs (DEFERRED — depends on realized outcomes, 13)
| KPI (target) | Depends on outcome | Today |
|---|---|---|
| Placement rate | O1 | honest-null |
| Hire rate / quality-of-hire | O2 | honest-null (k_min=30) |
| Promotion/transition rate | O3 | honest-null |
| Improvement/growth rate | O4 | honest-null (Progress partial) |
| Cohort placement rate | O5 | honest-null |
| Recommendation effectiveness rate | O6 | honest-null |

## Findings (honest)
- **Operational KPIs are honesty-correct:** Mission Control preserves **null(absent) ≠ 0(empty)**, coverage
  denom = ALL declared sources, `sumN` preserves null. Good engineering.
- **Deliberate "NO composite/overall score"** across MX-700/MX-800 metrics is *correct honesty* (separate
  measured axes, never blended) — but means there is **no single product-health KPI** (a reporting-convenience
  gap, not a correctness gap).
- **Per-capability KPIs missing**; **business/outcome KPIs missing** because realized outcomes aren't captured
  (GAP-O1). Honest-null throughout.

## Canonical decisions (FROZEN)
1. **Do NOT invent a composite "overall health" score** — it would violate the no-blend honesty contract. KPIs
   stay as separate measured axes.
2. **Bind each capability to a success metric** (Tier B) — forward work.
3. **Define outcome KPIs (Tier C) now as targets; populate only once GAP-O1 capture exists** — never backfill
   with projections.

## Verdict
**ONE KPI model: OPERATIONAL KPIs IMPLEMENTED; PER-CAPABILITY + BUSINESS/OUTCOME KPIs defined-as-target,
not-yet-realized. FROZEN.** Enhancement = bind capability KPIs + populate outcome KPIs after realized-outcome
capture (13). null ≠ 0 honored throughout.
