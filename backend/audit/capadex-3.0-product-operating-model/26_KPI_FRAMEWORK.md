# 26 · KPI Framework Validation

Validates whether the product defines and measures KPIs (operational + business + per-capability).

## KPI surfaces (repo-evidenced)
| KPI surface | Engine | Status |
|---|---|---|
| Mission Control aggregator | `/api/admin/mission-control` (~45 nullable counts → 8 widgets) | **IMPLEMENTED (operational)** |
| Enterprise analytics | `FF_ENTERPRISE_ANALYTICS` surfaces | **IMPLEMENTED (flag-gated)** |
| Platform/intelligence metrics | MX-700/MX-800 `/metrics` (6 SEPARATE scores, **no composite by design**) | **DORMANT (flag-gated)** |
| Usage metering | period_count / level-latest / credit-balance | **IMPLEMENTED** |
| Per-capability success KPI | — | **MISSING** |
| Outcome KPIs (placement/hire/growth rates) | depends on realized outcomes | **MISSING (honest-null)** |

## Findings (honest)
- **Operational KPIs exist and are honesty-correct:** Mission Control preserves null(absent)≠0(empty),
  coverage denom = ALL declared sources, sumN preserves null. Good engineering.
- **The deliberate "NO composite/overall score" stance** across MX-700/MX-800 metrics is *correct honesty*
  (separate measured axes, never blended) but means there is **no single product-health KPI** — a reporting-
  convenience gap, not a correctness gap.
- **Per-capability KPIs are missing** — capabilities trace to reports but not to a bound success metric (the
  outcome/KPI tail break in 17).
- **Business/outcome KPIs (placement rate, hire rate, growth rate) are MISSING** because realized outcomes
  aren't captured (GAP-O1). Honest-null.

## Verdict
**KPI framework: OPERATIONAL KPIs IMPLEMENTED; BUSINESS/OUTCOME/PER-CAPABILITY KPIs MISSING.** Enhancement =
bind each capability to a success metric and define outcome KPIs once GAP-O1 capture exists. Do **not** invent
a composite health score (would violate the no-blend honesty contract).
