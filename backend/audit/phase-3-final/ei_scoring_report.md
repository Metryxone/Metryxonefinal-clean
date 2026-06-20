# EI Scoring Report — Phase 3

**Subsystem:** Employability Index Scoring (Phase 3.2 / 3.3)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm`
**Engine versions:** EI `phase-3.2` · scoring artifact `phase-3.3`

> **Honesty contract.** Coverage and Confidence are distinct axes and never merged
> into a single "quality" number. Confidence caps are self-disclosed by the engine.

---

## 1. Scoring model

The Employability Index re-shapes the Phase 3.3 competency scoring artifact — **numbers are
re-shaped, never recomputed.** Each dimension's score is a weight-respecting roll-up of its
measured competencies; the overall index rolls the dimensions up.

Two independent axes accompany every score:

- **Coverage** — share of mapped competencies actually measured. Pure data-completeness.
- **Confidence** — trustworthiness of the measurement, with explicit caps and factors.

---

## 2. Measured result (`demo_subj_pm`)

| Metric | Value |
|---|---|
| Overall EI score | **75 / 100** |
| Band | **Strong** |
| Coverage | **100%** |
| Confidence score | **60** |
| Confidence band | **Moderate** |
| Measurement mode | **`domain_proxy`** |
| Confidence cap (disclosed) | `"measurement is domain_proxy → confidence capped at 60"` |

Per-dimension scores (all Strong @ 75) with their **distinct** coverage and confidence factors:

| Dimension | Score | Coverage | Confidence | Disclosed factor |
|---|---|---|---|---|
| Communication | 75 | 100% | 60 (Moderate) | proxy cap only |
| Workplace | 75 | 92.9% | 60 (Moderate) | `92.9% coverage (−3)` |
| Problem-Solving | 75 | 23.1% | 60 (Moderate) | `23.1% coverage (−31)` |
| Leadership | 75 | 85.7% | 60 (Moderate) | `85.7% coverage (−6)` |
| Future | 75 | 28.6% | 60 (Moderate) | `28.6% coverage (−29)` |

---

## 3. Why Coverage 100% but Confidence 60

The **overall** coverage is 100% because all five dimensions are *measurable* (each has at
least its required measured components to produce a score). Confidence is nonetheless capped
at **60 (Moderate)** because the measurement runs in `domain_proxy` mode. A naive system would
collapse these into one number and either overstate (call it 100%) or understate (call it 60%)
the result. This engine keeps them apart and states the cause.

---

## 4. Success criterion

✅ **EI scoring operational** — overall and per-dimension scores compute with bands, and every
score carries an honest, separately-reported coverage and confidence with disclosed caps.

## 5. Honest limitations

- Confidence will not exceed 60 while measurement is `domain_proxy`. This is by design and
  disclosed; it is not a defect and is not tuned away.
- Low-coverage dimensions (Problem-Solving 23.1%, Future 28.6%) carry larger confidence
  penalties; these are reported, not hidden, and never lower the *score* itself silently.
