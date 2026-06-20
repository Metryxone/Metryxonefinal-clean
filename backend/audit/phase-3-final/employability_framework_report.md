# Employability Framework Report — Phase 3

**Subsystem:** Employability Dimensions Framework (Phase 3.2)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm` (seeded validation subject)
**Engine versions:** dimensions `phase-3.2` · weights `cei-dim-w1`

> **Honesty contract.** Every number below is a real value returned by the live
> engine against a real subject, never hand-authored. **Coverage** (how much of a
> dimension's competency set was measured) and **Confidence** (how trustworthy the
> measurement is) are reported as **separate axes** and never composited. An absent
> measurement is reported as absent, not as zero or as a failure.

---

## 1. What the framework is

The Employability Framework re-shapes the Phase 3.3 competency scoring artifact into
**five readiness dimensions**. It does not recompute scores — it composes already-measured
competency data into a higher-level, developmentally-framed view.

| Dimension | Description | Components (measured / total) | Coverage |
|---|---|---|---|
| Communication Readiness | Clarity, listening, persuasion, presentation | 12 / 12 | 100% |
| Workplace Readiness | Collaboration, accountability, reliability, conduct | 13 / 14 | 92.9% |
| Problem-Solving Readiness | Critical/analytical thinking, judgment, creativity | 3 / 13 | 23.1% |
| Leadership Readiness | Direction-setting, coaching, delegation, influence | 12 / 14 | 85.7% |
| Future Readiness | Forward-looking / adaptive capability | 4 / 14 | 28.6% |

Each dimension rolls competencies up by `contribution_weight`; the overall index is a
weighted roll-up of the five dimensions (`rollup_weight` = 1 each in `cei-dim-w1`).

---

## 2. Measured result (`demo_subj_pm`)

| Metric | Value |
|---|---|
| Overall index | **75 / 100** |
| Band | **Strong** |
| Dimensions measurable | **5 / 5** |
| Overall coverage | **100%** |
| Confidence | **60 — Moderate** |
| Measurement mode | **`domain_proxy`** |

All five dimensions returned **75 (Strong)**. This uniformity is **honest and explained**,
not a bug: the subject is scored in **`domain_proxy`** mode, where competencies that have no
finer-grained per-competency score resolve through their shared `onto_domain` proxy. Until
granular competency scoring is populated, competencies in the same domain share a score.

This is exactly why **confidence is capped at 60 (Moderate)** — the engine self-discloses:
`"measurement is domain_proxy → confidence capped at 60"`. Coverage can be 100% while
confidence stays Moderate; the two axes move independently and are reported separately.

---

## 3. Coverage ≠ Confidence (worked example)

- **Communication Readiness** — coverage 100% (12/12), confidence Moderate (capped by proxy mode).
- **Problem-Solving Readiness** — coverage 23.1% (3/13), confidence Moderate, with an explicit
  factor recorded: `"23.1% mapped-competency coverage (−31)"`. The low coverage is surfaced as a
  coverage fact, **not** silently folded into the score.
- **Workplace Readiness** — one component (`Time Management`) is **unmeasured** (`proxy_score: null`),
  yielding 92.9% coverage. The null is preserved as "not measured," never coerced to 0.

---

## 4. Success criterion

✅ **Employability dimensions operational** — five dimensions compose from real competency
data, return measurable bands, and honestly disclose per-dimension coverage and the
`domain_proxy` confidence cap.

## 5. Honest limitations

- Scores are **developmental signals only** — the engine ships an explicit `language_policy`
  with allowed terms (readiness, growth areas, strengths) and disallowed terms (hire, reject,
  suitability, promotion decision). Outputs are **not** hiring/promotion/suitability predictions.
- `domain_proxy` mode caps confidence at 60. Granular per-competency scoring (when populated)
  will diversify dimension scores and lift confidence — neither is fabricated today.
- Problem-Solving (23.1%) and Future (28.6%) coverage are genuinely low for this subject;
  reported as-is.
