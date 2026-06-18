# Competency Assessment — Science & Validation Report

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Question:** Would an I/O psychologist, a research university, and an enterprise procurement psychometrician approve this instrument?
**Verdict in one line:** *A science-ready **engine** with elite architecture, but **not yet a science-validated instrument** — because validity is empirical, and the empirical evidence does not exist yet.*

---

## 1. What is genuinely implemented (Structural — strong)

| Psychometric capability | Implementation | Evidence |
|---|---|---|
| Internal consistency | Cronbach α + reliability tiers A–D | `sci-psychometric-engine.ts` |
| Per-session reliability | Reliability Index: consistency .40 / reverse-item .20 / contradiction .20 / completion .15 | `reliability-engine.ts` |
| Item response theory | **3PL** with Item Information Function | `caf/scoring-engine.ts` |
| Ability estimation | **EAP θ** (Expected A Posteriori) | `caf/scoring-engine.ts` |
| Score normalisation | T-score mapping (50 + θ·15) | `caf/scoring-engine.ts` |
| Mastery inference | Bayesian Beta-posterior + uncertainty bands | `bayesian-inference-engine.ts` |
| Adverse impact | **Four-Fifths Rule** | `sci-psychometric-engine.ts` |
| Response integrity | straightlining / fast-response / zero-variance anomaly flags | `reliability-engine.ts` |
| Scoring models | BARS (behavioural), CTT+Bloom (functional), IRT (cognitive), SJT keying (leadership) | `caf/scoring-engine.ts` |
| Stability | temporary-spike / inconsistency / coaching-contamination detection | `psychometrics.test.ts` |

This is **materially more rigorous than most ed-tech assessment products** and is the strongest single area of the platform.

---

## 2. What is missing (Validity — not demonstrated)

| Validity requirement | Status | Why it matters |
|---|---|---|
| **Empirical IRT calibration** | ✖ a/b/c seeded, not estimated from data | Uncalibrated 3PL parameters make θ estimates unverifiable |
| **Reliability on a real sample** | ✖ formula only, N≈58 too small | α/SEM cannot be claimed |
| **Test-retest reliability** | ✖ none | stability over time unproven |
| **Construct validity** | ○ Pearson vs an unpopulated criterion | factor structure of 7 domains untested |
| **Convergent/discriminant validity** | ✖ none | no comparison to an established instrument |
| **Criterion/predictive validity** | ✖ **zero realised outcomes** | cannot claim scores predict anything |
| **Norms / norm-referencing** | ✖ no population | percentiles/bands are not standardised |
| **DIF / measurement invariance** | ✖ never run on real data | fairness across groups unproven |
| **Adverse-impact on real pool** | ✖ formula only | 4/5ths never evaluated on applicants |
| **SEM surfaced to users** | ✖ | enterprise buyers expect uncertainty reporting |
| **Independent validation** | ✖ | no third-party psychometric review |

---

## 3. Sample-size reality

- Live behavioural sample: **~58 assessment sessions / ~100 users**.
- Minimum for stable IRT calibration: typically **hundreds–thousands** of responses per item.
- Minimum for benchmark cohort: **k=30** (enforced) — not met in any cohort.
- **Conclusion:** the instrument is in **pre-calibration**. Every psychometric statistic is a *capability*, not a *result*.

---

## 4. Approval simulation

- **I/O psychologist:** "Impressive engine. Show me the calibration table, the α on N≥300, the DIF report, and one criterion-validity study. Until then I can't endorse score interpretation." → **Conditional / Not yet.**
- **Research university:** "The methods are citable and sound; you have no data. This is a protocol, not a finding." → **Not yet.**
- **Enterprise procurement:** "Bias-detection and explainability are reassuring; absence of norms, validity manual, and adverse-impact evidence fails our psychometric checklist." → **Not yet (pilot to gather evidence).**

---

## 5. The validity flywheel (how to convert engine → instrument)

1. Activate a governed, calibratable item bank live (replace static-bank dependence).
2. Run a pilot to **N≥300** responses per priority competency.
3. Compute and **publish** α, SEM, IRT calibration, DIF on the real sample.
4. Capture **real outcomes** (placement/hiring/promotion) → criterion validity.
5. Build **norms** by segment once k≥30 cohorts exist.
6. Commission an **independent psychometric review**.

**Until steps 3–5 produce output, no validity claim — including any predictive or hiring claim — may be made.** (Consistent with replit.md honesty policy and the platform's own disallowed-verdict guardrails.)
