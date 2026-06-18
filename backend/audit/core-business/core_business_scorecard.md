# MetryxOne — Core Business Scorecard
### MX-CORE-BUSINESS-AUDIT-01 · 18 June 2026

Scores are **0–100, evidence-backed**, blending five sub-axes. Design and Activation are shown separately and never composited away — a high Design score on empty data is *not* a good product.

**Sub-axes**
- **Design** — quality of the logic, framework, and engineering.
- **Content** — depth/breadth of populated, usable content.
- **Activation** — real customer data, usage, and delivered value (live DB).
- **Validity** — empirical norming / reliability / predictive proof.
- **Value** — differentiated customer value vs alternatives.

---

## Per-Product Scorecard

| Product | Design | Content | Activation | Validity | Value | **World-Class** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Career Builder | 70 | 55 | 45 | 35 | 60 | **56** |
| Competency Assessment | 75 | 40 | 30 | 30 | 50 | **50** |
| CAPADEX | 70 | 45 | 40 | 15 | 55 | **45** |
| Employability Index | 72 | 50 | 10 | 10 | 45 | **42** |
| Learning Behaviour Index | 45 | 35 | 10 | 10 | 30 | **28** |
| **Portfolio avg** | **66** | **45** | **27** | **20** | **48** | **~44** |

**The shape of the portfolio in one line:** strong Design (66), mediocre Content (45) and Value (48), weak Activation (27), and a **Validity floor (20)** that caps everything. MetryxOne is engineering-rich and evidence-poor.

---

## Dimension Scorecard (as requested per product)

### CAPADEX
| Dimension | Score | Verdict |
|---|:---:|---|
| Question Design | 45 | Well-crafted for professionals; not age-appropriate for students; ~40-item bank |
| Behaviour Signals | 50 | Transparent keyword/token matching, not a validated model |
| Archetypes | 60 | Curated + self-audited (coherence/distinctiveness); some name-only stubs |
| Recommendations | 45 | Quality-graded A–D but template/catalog-anchored |
| Reports | 70 | Strongest artefact: real multi-stakeholder narratives |
| Scientific Validity | 15 | No norming, reliability, or external validation |
| Actionability | 45 | Good counsellor triage; generic parent advice; some dead-ends |

### Competency Assessment
| Dimension | Score | Verdict |
|---|:---:|---|
| Framework Quality | 70 | Coherent 12-level hierarchy — but mostly unpopulated in live DB |
| Role Mapping | 65 | DB-driven, context-aware weighting (not hardcoded) |
| Competency Scoring | 70 | Empirical percentiles + Wilson CI + reliability tiers — best in platform |
| Benchmarks | 25 | Provisional for everyone (live `ont_benchmarks`=0; prior audit ~17 < k=30); cohorts don't exist yet |
| Development Plans | 70 | Concrete, phased, personalised IDP |
| Employer Value | 45 | Real growth signal; capped by no-hiring-claim language policy |

### Learning Behaviour Index
| Dimension | Score | Verdict |
|---|:---:|---|
| Learning Profiles | 35 | Generic templates; no longitudinal genome |
| Learning Signals | 30 | Heuristic; simple averages; AI-generated numbers |
| Interventions | 25 | Template/placeholder; no evidence-based library |
| Teacher Value | 30 | Dashboard exists; data empty; "<40%" flags |
| Student Value | 35 | High visual appeal, low utility |
| Institution Value | 30 | Demo-ready interface, functionally empty |

### Employability Index
| Dimension | Score | Verdict |
|---|:---:|---|
| Score Quality | 72 | Transparent, calibrated, auditable formula |
| Hiring Relevance | 40 | "Hire-Ready" UX vs "developmental-only" audit = unresolved tension |
| Predictive Value | 10 | Zero — outcome coverage 0%, closed-loop a-priori |
| Employer Trust | 15 | Calibration architecture present; 0 qualifying decisions |

### Career Builder
| Dimension | Score | Verdict |
|---|:---:|---|
| Career Recommendations | 60 | Strong composite logic; constrained by catalog breadth |
| Skill Gap Analysis | 65 | Concrete, transparent competency math |
| Career Paths | 50 | Real 200-role/500-edge graph; sub-O*NET; 1-step depth |
| Goal Planning | 65 | Real DB-backed ROI-linked IDP |
| User Experience | 75 | Best-in-platform; polished "Career OS"; monolith fragility |

---

## How MetryxOne stacks up vs alternatives

| Buyer | Typical alternative | Where MetryxOne wins | Where it loses |
|---|---|---|---|
| Individual / student | Generic career sites, single-test tools | Breadth, explainability, integrated Career OS, price, localisation | Thin item banks; no proof scores matter |
| School / institution | Validated learning/SEL instruments, LMS analytics | UI, taxonomy breadth, multi-stakeholder reports | Empty norms; AI-generated LBI scores; no validation |
| Employer | Gallup, Hogan, SHL/Aon, Mettl, pymetrics | Transparency, cost, developmental framing | No predictive validity, no calibration, language policy forbids the claim they buy |

**Decision rule for a buyer today:** choose MetryxOne for *developmental breadth and experience*; choose an incumbent for *validated, predictive measurement*. The gap is evidence, not engineering.

---

## What would move the scores (sensitivity)
- **Validity 20 → 50** (one real validation study + outcome loop on a single product) would lift the portfolio average more than any feature work — it is the binding constraint.
- **Activation 27 → 50** (compute EI scores, get Career recs to the 101 profiled users, run an LBI/institution pilot) converts built capability into delivered value.
- **Content 45 → 65** (populate competency ontology, import O*NET/ESCO, expand CAPADEX banks) removes the "empty dashboard" risk.

Engineering quality (Design 66) is *not* the lever — it is already the platform's strength.
