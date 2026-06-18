# MetryxOne — World-Class Intelligence Certification Audit
### MX-WORLDCLASS-INTELLIGENCE-01 · 18 June 2026

**Mission framing:** measure whether MetryxOne's *intelligence quality* (not its UI) is world-class — i.e. whether its scores, models, benchmarks, and predictions are scientifically sound, predictive, and validated against real outcomes. This is a **certification + roadmap** exercise; per the brief, **no new dashboards, admin screens, or reports were built.**

**Method.** Every claim is grounded in (a) live database row counts (18 June 2026), (b) engine-code inspection, and (c) data-provenance spot-checks that distinguish *seeded/curated content* from *empirically computed intelligence*. Three axes are kept separate and never composited away:
- **Structural** — the code/engine exists and runs.
- **Activation** — real customer data flows through it.
- **Validity** — the numbers are empirically derived and/or validated against ground truth.

## The five readiness axes (scored 0–100 per workstream)
| Axis | Question it answers |
|---|---|
| **Scientific Readiness** | Are constructs, benchmarks, and weights empirically derived and validated (reliability, norming) — or seeded constants? |
| **Predictive Readiness** | Is there a calibrated model that predicts, with *measured* accuracy? |
| **Outcome Readiness** | Are *realized* outcomes captured and linked back to prior scores/predictions? |
| **Customer Value** | Does it deliver differentiated intelligence to a customer *today*? |
| **World-Class Readiness** | Overall standing vs best-in-class intelligence products. |

**Targets (the rubric):** all intelligence *products* > 90%, all intelligence *foundations* > 95%, and an *outcome-validation framework established*.

---

## Headline Certification

> **MetryxOne is NOT YET world-class on intelligence quality. Portfolio intelligence readiness ≈ 32/100 across the five products; no product clears 50, let alone the 90% target.**

Three findings define the gap, in priority order:

1. **The constructs are seeded, not earned.** The talent-intelligence benchmarks (`ti_industry_benchmarks`, `ti_role_benchmarks`), the future-readiness catalogs (`frp_role_evolution`, automation-risk), and the employability calibration multipliers are **hardcoded constants**, not statistics computed from real respondents. The reported `sample_size` values (50, 200) are *literals in seed code*, not real cohorts. World-class intelligence is empirically derived; MetryxOne's is largely authored.

2. **The ontology is ~1–5% of the world-class target.** Target: 1000+ competencies / 5000+ relationships. Reality: the largest single competency source is **45 rows** (`mei_competencies`); the canonical ontology tables (`ont_competencies`, `competencies`, `competency_catalog`) are **empty**; total relationships across all map/dependency tables ≈ **56** vs 5000.

3. **The outcome-validation framework already exists in code — but has never run on real data.** This *corrects* a prior, harsher assessment: `employer-tig.ts` contains a genuinely sophisticated calibration engine (Brier score, ECE, isotonic/PAV regression, `cold_start`/`provisional`/`calibrated` trust states, k-anon pooled priors). However `eios_outcome_tracking = 0`, `rie_outcomes = 0`, `employer_offers = 0`, and `ti_outcome_predictions` holds **8 `[DEMO]` rows with no realized-outcome column**. The framework is *established-as-code, un-activated-as-data*. **No MetryxOne score has ever been validated against a real-world outcome.**

**Customer verdict (inference from the evidence, not a market study):** an individual gets useful developmental breadth today; an institution or employer evaluating *intelligence quality* would find seeded benchmarks, an empty ontology, and zero predictive validity — and, on those facts, a validated incumbent would be the rational choice. The binding constraints are **empirical grounding, ontology depth, and activation of the (already-built) outcome loop** — not engineering capacity.

---

## Workstream Scorecards

### WS1 — Competency Ontology  *(foundation; target > 95%)*
**Current state.** Competency content is **fragmented across incompatible sources and largely empty**: `mei_competencies`=45, `competency_dna_master`=21, `capability_master`=12, `cb_master`=12; the canonical ontology (`ont_competencies`, `ont_micro_competencies`, `competencies`, `competency_catalog`, `competency_domains`, `competency_clusters`) is **all 0**. Relationships: `cb_competency_mapping`=48, `capability_dependency_master`=8, `capability_relationship_master`=0, all `map_*`=0 → ≈**56 total** vs 5000+ target. Benchmarks: `ti_industry_benchmarks`=66 and `ti_role_benchmarks`=60 exist but are **seeded constants** (round percentiles, NULL `rf_id`, batch timestamp); `ont_benchmarks`, `mei_benchmarks`, `stage_competency_norms` = 0.

| Scientific | Predictive | Outcome | Customer Value | **World-Class** |
|:---:|:---:|:---:|:---:|:---:|
| 25 | 20 | 0 | 30 | **22** |

**Verdict:** ~2–5% of the world-class target on every dimension (count, relationships, empirical benchmarks). This is the **foundation failure** that caps every product above it.

---

### WS2 — Employability Intelligence  *(product; target > 90%)*
**Current state.** **The best-engineered intelligence in the platform.** The MEI v2 engine (`mei-scoring-engine.ts`) is genuinely computed — a 3-tier Dimension→Subdimension→Competency hierarchical model applied to real profile data — and `mei-benchmark-engine.ts` even has an **empirical** `refreshCohortBenchmark` (computes P25–P90 from real `mei_scores` at k≥10). Industry/role readiness is real-formula-driven; future readiness (FRP) uses a real 5-signal weighted index (skill durability 30% / market alignment 25% / adaptability 20% / learning velocity 15% / role resilience 10%). **But:** `mei_scores`=0, `mei_score_history`=0, `mei_user_recommendations`=0 → **no user has an employability score**, so the empirical benchmark path can never fire; calibration multipliers are **seeds**; `talent_gaps`=0, `cg_user_skill_gaps`=6, `frp_user_readiness`=8.

| Scientific | Predictive | Outcome | Customer Value | **World-Class** |
|:---:|:---:|:---:|:---:|:---:|
| 40 | 30 | 5 | 40 | **35** |

**Verdict:** the engine deserves credit; it is starved of data and unvalidated. Activation (compute scores) would unlock its own empirical benchmarks — the single highest-leverage move in the portfolio.

---

### WS3 — Learning Behavior Intelligence  *(product; target > 90%)*
**Current state.** **A scaffold, not an intelligence product.** `lbi_score_history`=8; `lbi_subdomain_norms`, `lbi_clusters`, `lbi_cluster_map`, `lbi_learning_mappings`, `lbi_age_band_weights`=**all 0**; the sibling `sdi_*` tables are empty too. Scores are AI-generated (a prompt instructed to output a number in a fixed band), percentile is a linear rescale, "at-risk" reduces to "score < 40%". There is no learning genome, no real behavioural signal ingestion (time-on-task, retries), and no validated risk model. Learning *profiles, risks, interventions, teacher/student insights* are all template-level.

| Scientific | Predictive | Outcome | Customer Value | **World-Class** |
|:---:|:---:|:---:|:---:|:---:|
| 15 | 15 | 0 | 25 | **18** |

**Verdict:** lowest intelligence quality of the five. Either rebuild on a real derivation engine + real signals, or mark explicitly as preview.

---

### WS4 — CAPADEX Intelligence  *(product; target > 90%)*
**Current state.** **The most-exercised flow and (per prior architecture audits) the most transparent engine** — 58 sessions/reports, 578 responses, 578 evidence rows, 98 session signals, 58 behaviour-graph rows, 360 clarity questions, 40 signal profiles; the scoring path is rule-based/deterministic rather than a black-box model. **But the WS4-named intelligence targets are largely inert or absent:** `capadex_session_patterns`=0, `capadex_session_composites`=0, `capadex_recommendations`=0, `capadex_interventions`=0, `capadex_risk_flags`=0 — and there is **no archetype table in the live schema at all** (the "archetypes" capability is unmaterialised here). So *archetypes, behaviour models, pattern intelligence, growth intelligence* — the four WS4 targets — do not currently fire for customers. There is also **no psychometric validation** (no reliability α, no norming, no factor structure).

| Scientific | Predictive | Outcome | Customer Value | **World-Class** |
|:---:|:---:|:---:|:---:|:---:|
| 25 | 25 | 0 | 50 | **38** |

**Verdict:** a strong, honest *assessment*; not yet *intelligence*. The pattern/composite/archetype/growth layer is wired but unfired, and the constructs are unvalidated.

---

### WS5 — Career Intelligence  *(product; target > 90%)*
**Current state.** **The strongest activated content.** A real occupation graph — `cg_roles`=200, `cg_role_edges`=500, `cg_skill_requirements`=711, `cg_tracks`=15, `cg_track_waypoints`=76, `cg_lateral_rules`=25, `cg_promotion_rules`=40 — plus real adoption (`career_seeker_profiles`=101, `career_seeker_goals`=101). **But:** the graph is **sub-O*NET/ESCO scale** (200 roles vs thousands) and largely **1-step** (no validated multi-hop trajectories); `ont_career_paths`=0; transition intelligence is rule-based, not learned (`cg_user_career_path`=1); future-role prediction is `ti_outcome_predictions`=**8 `[DEMO]` rows**; `career_growth_patterns`=0. No transition probabilities are validated against real moves.

| Scientific | Predictive | Outcome | Customer Value | **World-Class** |
|:---:|:---:|:---:|:---:|:---:|
| 35 | 30 | 5 | 55 | **45** |

**Verdict:** the nearest product to credible — real graph, real users — but breadth-limited and predictively unproven.

---

### WS6 — Outcome Intelligence  *(foundation/framework; target = "established")*
**Current state — report on TWO axes (this is the key nuance).**
- **Structural (the framework exists and is genuinely sophisticated): ~60.** `employer-tig.ts` "Engine 8" computes **Brier score + ECE**, applies **isotonic/PAV regression** once an org has ≥30 outcomes, exposes **`cold_start`/`provisional`/`calibrated` trust states**, and can borrow **k-anon globally-pooled priors**. Ingestion exists: `POST /api/employer/eios/p22/outcomes` → `eios_outcome_tracking`; `POST /api/rie/interventions/:email/resolve` → `rie_outcomes` (`score_before/after/delta/success`). The hiring-success loop is *fully closed in code* (reads `predicted_prob_at_decision` vs final `Hired`/`Rejected`).
- **Activation (real outcomes flowing): ~5.** `eios_outcome_tracking`=0, `rie_outcomes`=0, `employer_offers`=0, `ti_prediction_history`=0, `tdt_twin_predictions`=0; `ti_outcome_predictions`=8 **`[DEMO]`** rows with **no realized-outcome column**. Retention/promotion metrics are explicit scaffolds (`"pending_90_day_reviews"`).

| Scientific (framework) | Predictive | Outcome (realized) | Customer Value | **World-Class** |
|:---:|:---:|:---:|:---:|:---:|
| 60 | 30 | 10 | 5 | **35** |

**Verdict:** the outcome-validation framework is **largely already established as code** — a real asset the platform should not rebuild. The gap is (1) **realized-outcome data** and (2) **extending this calibration discipline to the other four products**, which today emit uncalibrated formula scores.

---

## Foundations Certification (target > 95%)
| Foundation | Structural | Activation | Validity | **Readiness** |
|---|:---:|:---:|:---:|:---:|
| Competency Ontology (WS1) | 35 | 10 | 20 | **22** |
| Outcome-Validation Framework (WS6) | 60 | 5 | 30 | **35** |

Neither foundation clears the 95% bar. The ontology is the deeper problem (it is *missing*); the outcome framework is the cheaper win (it *exists but is dormant*).

## What "world-class intelligence" requires that MetryxOne lacks
1. **Empirically derived constructs** — benchmarks/weights computed from real respondents, not seed constants with literal `sample_size`.
2. **Reliability & validity evidence** — internal consistency (α), test–retest, factor structure, convergent/discriminant validity. None exists today.
3. **Calibrated prediction with measured accuracy** — the *machinery* exists (employer-TIG); it must run on real data and be extended platform-wide.
4. **A closed realized-outcome loop** — capture actual placements/promotions/performance/retention/learning-gains and link them to prior scores. Currently zero.
5. **Ontology depth** — 1000+ competencies / 5000+ relationships unifying the fragmented `mei_*`/`capability_*`/`ont_*`/`cb_*`/`competency_dna_*` sources.

See `intelligence_gap_analysis.md` for the per-target gap math and `intelligence_roadmap.md` for the sequenced path to the thresholds.
