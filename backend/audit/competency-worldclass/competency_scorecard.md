# Competency Assessment — World-Class Scorecard

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Scoring rule (honesty contract):** every axis carries **Structural / Activation / Validity** sub-scores (0–100), reported **separately and never composited into a single number**. There is **no platform-wide composite score** in this audit — compositing S/A/V is explicitly forbidden by `replit.md`.

The **Readiness band** per axis is assigned by a **gating rule**, NOT by averaging the three sub-scores:
- **Validity gate:** an axis cannot be banded **Launch (75–90)** or **World Class (>90)** unless Validity clears that threshold. (Validity is ~12 everywhere → **nothing reaches Launch.**)
- **Activation gate:** an axis cannot exceed **Pilot (55–74)** unless Activation clears the Pilot floor. (Activation is cold-start → **nothing exceeds Pilot.**)
- **Structural enablement:** strong Structural can lift an axis to **Beta/Pilot** but can **never** lift the band above what Activation/Validity support.

The **Readiness Index** number shown per axis below is a **bounded judgement index** (0–100) reflecting this gating — it is **not** an arithmetic average of S/A/V, and it is hard-capped by the weaker of Activation/Validity. Band thresholds: World Class >90 · Launch 75–90 · Pilot 55–74 · Beta 40–54 · Not Ready <40.

---

## A. The 22 Certification Axes (Phase 24)

| # | Axis | Structural | Activation | Validity | **Score** | Band |
|---|---|---|---|---|---|---|
| 1 | Framework Quality | 80 | 35 | 20 | **52** | Beta |
| 2 | Library Quality | 75 | 35 | 25 | **51** | Beta |
| 3 | Ontology Quality | 82 | 28 | 20 | **51** | Beta |
| 4 | Assessment Science | 88 | 40 | 15 | **44** | Beta |
| 5 | Question Quality | 70 | 30 | 18 | **45** | Beta |
| 6 | Assessment Engine | 85 | 60 | 30 | **64** | Pilot |
| 7 | Benchmark Quality | 82 | 8 | 20 | **38** | Not Ready |
| 8 | Recommendation Quality | 85 | 18 | 20 | **47** | Beta |
| 9 | Development Planning | 78 | 45 | 20 | **52** | Beta |
| 10 | Student Value | 72 | 40 | 22 | **49** | Beta |
| 11 | Professional Value | 68 | 25 | 18 | **41** | Beta |
| 12 | Employer Value | 75 | 35 | 20 | **47** | Beta |
| 13 | Institution Value | 78 | 45 | 25 | **55** | Pilot |
| 14 | Career Builder Dependency Readiness | 72 | 35 | 20 | **45** | Beta |
| 15 | Employability Dependency Readiness | 70 | 10 | 12 | **30** | Not Ready |
| 16 | Employer Portal Dependency Readiness | 75 | 35 | 18 | **44** | Beta |
| 17 | Outcome Validation | 70 | 5 | 5 | **18** | Not Ready |
| 18 | Commercial Readiness | 80 | 5 | 5 | **24** | Not Ready |
| 19 | Operational Readiness | 70 | 50 | 35 | **53** | Beta |
| 20 | Scale Readiness | 65 | 40 | 30 | **46** | Beta |
| 21 | Competitive Readiness | 60 | 25 | 15 | **34** | Not Ready |
| 22 | Launch Readiness | 65 | 30 | 18 | **40** | Beta |
| — | **Platform-wide (three axes — NOT composited)** | **~80** | **~25** | **~12** | **— (no composite)** | **Not Yet world-class** |

> The platform row reports the **three honesty axes separately and refuses to composite them into one number**. The overall verdict (**Not Yet world-class**) is a **gated conclusion**: Validity ~12 → cannot be Launch/World-Class; Activation ~25 → cannot exceed Pilot. Structural ~80 describes *what is built*, not *what is proven or live*.

---

## B. Axis × Readiness Level

| Band | Axes |
|---|---|
| **World Class (>90)** | *(none)* |
| **Launch Ready (75–90)** | *(none at product level; Engine + Assessment Science reach this **Structurally** only)* |
| **Pilot Ready (55–74)** | Assessment Engine (64), Institution Value (55) |
| **Beta Ready (40–54)** | Development Planning (52), Operational Readiness (53), Framework (52), Library (51), Ontology (51), Question (45), Recommendation (47), Student (49), Professional (41), Employer (47), CB Dependency (45), Employer-Portal Dependency (44), Scale (46), Launch (40), Assessment Science *(gated by validity)* (44) |
| **Not Ready (<40)** | Benchmark (38), EI Dependency (30), Outcome Validation (18), Commercial (24), Competitive (34) |

---

## C. Honesty Sub-Score Summary (do not composite these three)

| Sub-axis | Score | Evidence |
|---|---|---|
| **Structural** | **~80 / 100** | IRT 3PL/EAP, Cronbach α, Bayesian mastery, 4/5ths adverse impact, reliability/anomaly engine, BARS, Bloom multipliers, 12-layer ontology, mobility engine, traceable recs, k-anon benchmarking. |
| **Activation** | **~25 / 100** | Live DB: question_templates 0, lbi_clusters 0, ont_* 0 (O*NET not imported), onto_comps 299/roles 5, mei_scores 0, recs ~8, sessions 58. |
| **Validity** | **~12 / 100** | No empirical IRT calibration, no reliability/validity study output, benchmarks empty (k<30), **zero realised outcomes**, no criterion validity. |

---

## D. Product-Configuration Verdicts (detail in `competency_launch_readiness.md`)

| Product | Verdict |
|---|---|
| Standalone | Beta Ready |
| Student | Beta Ready |
| Professional | Beta Ready |
| Institution | **Pilot Ready** (concierge) |
| Employer | **Pilot Ready** (gated — talent intelligence, not hiring verdicts) |
| Enterprise | Not Ready |

---

## E. Foundational-Layer Verdicts (can competency power dependents today?)

| Dependent | Verdict | Why |
|---|---|---|
| Career Builder | Partial | Consumes readiness/EI; degraded by thin activation |
| Employability Index | **Blocked** | `mei_scores=0` live — not activated |
| Career Passport | Partial | Reads competency snapshots; sparse |
| Future Readiness | Partial | Stub/secondary consumption |
| Employer Portal | Partial (gated) | Talent intel yes; hiring prediction disallowed (correct) |
| Recommendation Engine | Partial | Engines strong, near-zero population |

---

## F. Final Classification

**Not Ready → Beta → Pilot → Launch → World Class**

- **Overall product:** **Beta Ready**
- **Institution (concierge) & gated Employer:** **Pilot Ready**
- **Scientific instrument & World-Class platform:** **Not Yet / Not Ready**

**Path to World Class** requires lifting the gating axes — **Validity** (calibration, reliability, realised outcomes) and **Activation** (populated bank/ontology/EI/benchmarks) — which depend on **real population + validation data**, not more code. No single composite number is reported; the verdict is gated by the weakest evidence axis. See `competency_worldclass_roadmap.md`.
