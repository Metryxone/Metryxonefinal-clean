# Industry Readiness Report — Phase 3

**Subsystem:** Industry Readiness (Phase 3.6, `industry-readiness-engine`)
**Status:** ✅ Operational (measured, with honest unavailable cases)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm`
**Engine version:** `phase-3.6`

> **Honesty contract.** Where an industry's roles define no competency profile,
> readiness is reported **unavailable** (`available: false`, score `null`) — never
> assumed or zero-filled. Requirement source is always disclosed.

---

## 1. How industry requirements are derived

There is no dedicated industry→competency weighting table populated in this environment
(`map_industry_competency`, O*NET, is absent). The engine therefore **derives** industry
demand by aggregating the competency profiles of the industry's roles
(`requirement_source: "role_aggregation"` — max required level, prevalence-weighted
importance). This derivation is disclosed in every response's `notes`.

---

## 2. Measured result — available case (Information Technology)

| Metric | Value |
|---|---|
| Industry | **Information Technology** (`ind_it`) |
| Available / Measurable | **true / true** |
| Requirement source | `role_aggregation` |
| Roles aggregated | **4** |
| Competencies derived | **7** |
| Readiness score | **93.9 / 100** |
| Band | **Ready** |
| Coverage | **76.7%** |
| Fit | **Partial Fit** (`capped_by_critical: true`) |
| Blocking gaps | **1** — `Accountability` (req 5, actual 4, critical) |

## 3. Measured result — honest unavailable case (Financial Services)

| Metric | Value |
|---|---|
| Industry | **Financial Services** (`ind_financial`) |
| Available / Measurable | **false / false** |
| Readiness score | **null** |
| Fit | **Unmeasured** |
| Engine note | *"No role in 'Financial Services' defines a competency profile yet — industry readiness is unavailable (not assumed)."* |

This contrast is the point: the **same engine** returns a measured 93.9 for IT and an honest
`unavailable` for Financial Services, because IT's roles carry competency profiles and
Financial Services' roles do not. No number is invented to fill the gap.

---

## 4. Success criterion

✅ **Industry readiness operational** — derives industry demand from role aggregation,
returns measured readiness/fit/gap where data exists, and reports honest `unavailable`
where it does not.

## 5. Honest limitations

- All industry readiness is currently **derived** (role aggregation), not sourced from a
  dedicated O*NET industry→competency map; this is disclosed in `requirement_source` + notes.
- Coverage 76.7% (IT) means ~23% of derived demand is unassessed — flagged provisional.
- The 93.9 / Partial-Fit split mirrors Role Readiness: a single critical Accountability gap
  caps fit despite a high score.
