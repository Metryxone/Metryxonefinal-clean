# Function Readiness Report — Phase 3

**Subsystem:** Function Readiness (Phase 3.7, `function-readiness-engine`)
**Status:** ✅ Operational (measured, with honest unavailable cases)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm`
**Engine version:** `phase-3.7`

> **Honesty contract.** A function whose roles define no competency profile is
> reported **unavailable** — not zero, not assumed. Requirement source disclosed.

---

## 1. How function requirements are derived

As with industry, there is no dedicated function→competency source in this environment.
The engine **derives** function demand by aggregating competency profiles across the
function's roles (`requirement_source: "role_aggregation"`). The derivation is disclosed
in every response.

---

## 2. Measured result — available case (Engineering)

| Metric | Value |
|---|---|
| Function | **Engineering** (`fn_it_engineering`) |
| Available / Measurable | **true / true** |
| Requirement source | `role_aggregation` |
| Roles aggregated | **3** |
| Competencies derived | **6** |
| Readiness score | **92.7 / 100** |
| Band | **Ready** |
| Coverage | **75%** |
| Fit | **Partial Fit** (`capped_by_critical: true`) |
| Blocking gaps | **1** — `Accountability` (req 5, actual 4, critical) |

## 3. Measured result — honest unavailable case (Risk)

| Metric | Value |
|---|---|
| Function | **Risk** (`fn_fs_risk`) |
| Available / Measurable | **false / false** |
| Readiness score | **null** |
| Fit | **Unmeasured** |
| Engine note | *"No role in 'Risk' defines a competency profile yet — function readiness is unavailable (not assumed)."* |

---

## 4. Success criterion

✅ **Function readiness operational** — derives function demand from role aggregation,
returns measured readiness/fit/gap where data exists, and reports honest `unavailable`
where it does not.

## 5. Honest limitations

- Function readiness is **derived** (role aggregation), not from a dedicated source; disclosed.
- Coverage 75% (Engineering) → ~25% of derived demand unassessed (provisional).
- 92.7 / Partial-Fit split is again driven by the single critical Accountability gap.
