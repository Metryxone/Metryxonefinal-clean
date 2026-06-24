# MX-77X · Section 8 — Organization Readiness Index

**Status:** PARTIAL on demo_org seed.
**Views:** `/api/enterprise-workforce/readiness-forecasting` + capability/succession composition.
**Engine:** `m5-workforce-intelligence.readiness` + `wc3/longitudinal-consumption` (trend math).
**Tables (live):** `career_readiness_history` 4 (1 subject trend) · `m5_enterprise_capability_indices` 5 ·
(`m5_workforce_readiness_scores` 0 · department rows 0).

## Composition (task-required sub-indices)
```
Competency Readiness · Leadership Readiness · Capability Readiness · Succession Readiness · Future Readiness
                                   ↓
                        Enterprise Readiness Index
```
- **Competency / Capability Readiness** — capability indices (5) + skill-gap (Section 4).
- **Leadership Readiness** — bench strength (3) + leadership gap risks (3) (Section 5).
- **Succession Readiness** — succession candidates readiness bands (Section 5).
- **Future Readiness** — obsolescence + emergence trend (Section 9 / talent-forecasting).
- **Per-subject readiness TRENDS** — `career_readiness_history` (4 rows → 1 subject with ≥2 points).

## Honesty guards
- Enterprise readiness is measurable ONLY when `departments>0`; the engine's `readiness_score:0` empty
  sentinel is surfaced as **null**, never as a measured zero.
- Cohort latest-readiness average is k-anon gated (suppressed at n<30 distinct subjects).
- A readiness trend needs ≥2 measurable points or it abstains (no fabricated slope).

## Coverage ⟂ Confidence
- **Coverage:** capability indices present (5); subject readiness history thin (4 rows, 1 trend).
- **Confidence:** Enterprise Readiness Index is COMPOSABLE but department-level evidence is 0 → the
  enterprise roll-up abstains; only per-subject readiness is measurable.

## Honest gaps
- A single composite "Enterprise Readiness Index" number is intentionally NOT emitted while department
  evidence is absent — composing one from sub-indices alone would fabricate org-level coverage.
