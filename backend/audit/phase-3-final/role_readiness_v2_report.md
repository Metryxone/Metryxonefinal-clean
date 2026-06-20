# Role Readiness v2 Report — Phase 3

**Subsystem:** Role Readiness v2 (Phase 3.5, `role-readiness-v2`)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm` · role `role_sr_be_eng` (Senior Backend Engineer)
**Engine version:** `phase-3.5`

> **Honesty contract.** Readiness, fit, gap, risk and potential are reported as
> distinct facets. A single blocking critical gap caps fit regardless of score —
> the cap is stated explicitly, never absorbed silently.

---

## 1. Measured result

| Facet | Value |
|---|---|
| Readiness score | **92 / 100** |
| Readiness band | **Ready** |
| Coverage | **75%** (25% of role weight unassessed — provisional) |
| Role fit | **Partial Fit** (`capped_by_critical: true`) |
| Blocking gaps | **1** |
| Role risk | **Medium (32)** |
| Role potential | **Low (3)** |

**Top / blocking gap:** `Accountability` — required level **5**, actual **4**, gap **1**,
criticality **critical**, attainment 80%, weight 30. This one critical gap is what holds fit
at **Partial** even though readiness is 92.

---

## 2. Why "92 Ready" but only "Partial Fit"

This is the core honesty mechanic of Role Readiness v2:

- **Readiness (92)** is the weighted attainment across assessed competencies — high.
- **Fit (Partial)** is gated: a single **critical, blocking** gap (`Accountability` 4 vs
  required 5) caps fit regardless of the headline score (`capped_by_critical: true`). The
  engine notes: *"1 blocking (critical) gap prevent a Low-risk classification regardless of
  the overall score."*

A system optimising for a flattering number would let 92 read as "fit." This engine refuses to.

---

## 3. Risk and potential (measured factors)

**Role risk — Medium (32)**, decomposed:
- `readiness_shortfall` — 92% (8 below target) → +3.2
- `blocking_gaps` — 1 critical competency below required → +25
- `coverage_gap` — 25% of role weight unassessed (provisional) → +3.8

**Role potential — Low (3)**, decomposed:
- `foundation` — readiness already near target → +10
- `blocking_gaps` — 1 critical gap lengthens path → −12
- `ei_growth_potential` — Moderate (headroom 25) → +6.3
- `coverage_gap` — 25% unassessed (upside provisional) → −1.3

Note: *Low* potential here is a **positive** signal — *"Readiness is already near target … little
developmental upside remains."* The engine annotates the polarity so it isn't misread.

---

## 4. Success criterion

✅ **Role readiness operational** — readiness, fit (with critical-gap cap), gap detail, risk
and potential all compute from measured data with disclosed factor contributions.

## 5. Honest limitations

- 25% of role weight is **unassessed** → coverage 75%, flagged "provisional" throughout.
- The Accountability gap is real (level 4 vs required 5); reported, not smoothed over.
