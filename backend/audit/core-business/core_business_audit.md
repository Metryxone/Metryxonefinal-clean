# MetryxOne — Core Business Product Audit
### MX-CORE-BUSINESS-AUDIT-01 · 18 June 2026

**Mandate.** Audit *product quality and customer value* — not architecture, routes, screens, or table counts. The question behind every line below is: *would a paying customer choose this over the alternatives they already have?*

**Method.** Five product-quality investigations (read of engines, docs, question banks, scoring logic) cross-checked against **live database row counts** so that "the code can do X" is never confused with "X is real for a customer today." Findings separate two axes that are never composited:
- **Design quality** — is the logic, framework, and content well-built?
- **Activation** — does real customer data and proven value actually exist?

**Honesty note.** Several subsystems are richer in *schema and documentation* than in *populated data*. Where the docs describe a large ontology (e.g. ~2,489 concerns / ~30,638 clarity items, a 12-level competency hierarchy) but the live tables are thin or empty, this report reports the **live reality**, not the aspiration.

---

## Data Density Ledger (live DB, 18 Jun 2026)
*The factual backbone for every "Activation" judgement below.*

| Product | Real usage | Content populated | Norms / Benchmarks | Realized outcomes |
|---|---|---|---|---|
| CAPADEX | **58** sessions, 58 reports, 98 signals; **patterns = 0** | clarity = **360**; core bank ~40 items; `concern_areas` = 0 | none | **0** |
| Competency | minimal; `competency_dna_master` = 21 | `competencies`/`catalog`/`ont_competencies`/`ont_micro_competencies` = **0** | `ont_benchmarks` = 0, `stage_competency_norms` = 0 | **0** |
| LBI | `lbi_score_history` = **8** | `lbi_clusters`/`learning_mappings`/`subdomain_norms`/`versions` = **0** | 0 | **0** |
| Employability (MEI) | `mei_scores` = **0**, `mei_score_history` = 0 | 45 competencies, 5 dims, 50 industry calibrations, 15 rec master | `mei_benchmarks` = 0 | **0** |
| Career Builder | **101** profiles, 101 goals; recs = 8, gaps = 6; jobs = 0 | `cg_roles` = **200**, `cg_role_edges` = **500**, `cg_skill_requirements` = **711**, tracks = 15; `ont_career_paths` = 0 | `ti_industry_benchmarks` = 66 (reference, not cohorts) | **0** |

**One number dominates the whole audit: realized outcomes = 0 across every product.** Nothing in the platform has yet observed a real-world result (a hire, a promotion, an exam outcome, a grade change). Every "predictive," "readiness," or "probability" figure the products display is therefore *a-priori model output, not validated prediction.* This is the single most important fact about MetryxOne's current product credibility.

---

## 1. CAPADEX (Behavioural / Concern Assessment)

### Current State
The most-exercised *assessment flow* (58 real completed sessions/reports — Career Builder has more profiles, but CAPADEX has the most completed assessments). A deterministic, fully explainable engine: question → keyword/token signals → concern → archetype → catalog-anchored recommendation → multi-stakeholder report. No black-box AI in the scoring path. Composite/pattern layer is wired but **not firing** (`capadex_session_patterns = 0`), so the "deeper" intelligence is currently inert for customers.

### Strengths
- **Explainability is genuinely best-in-class** — every output traces to a rule, which is rare and valuable for a trust-sensitive (student/parent/counsellor) audience.
- **Multi-stakeholder reports** (Learner / Parent / Counsellor / Employer) are real, distinct, and narrative — the strongest customer-facing artefact in the platform.
- **Honest internal archetype auditing** — archetypes carry coherence/distinctiveness scores and the system flags its own weak ones (e.g. `negotiation_advocacy`: coherence 0, 0 members).

### Weaknesses
- **Question bank is tiny (~40 core items)** → high repeat risk and thin measurement.
- **Not age-appropriate for students** — core SJTs reference "layoffs," "SLA," "C-suite," "sprint velocity"; the student demographic in the vision is served by a different, thinner path.
- **Signals are keyword/token matching**, not a validated behavioural model — defensible as "transparent," weak as "scientific."
- **Recommendations are template/catalog-anchored** — graded A–D for quality, but not individualised to behavioural nuance; some dead-end into "complete more sessions to unlock…".
- **No empirical validity** — no norming, no reliability coefficients, no external validation.

### Missing Capabilities
A validated, age-banded item bank; a firing composite/pattern layer (it exists but produces 0 rows); longitudinal re-assessment that shows change over time; intervention links that lead to *something the customer can actually do/buy*.

### Recommendation Quality
**Fair.** Structured, quality-graded, stakeholder-aware — but pre-written and triggered by tags. A counsellor gets a usable risk triage; a parent often gets generic "celebrate small wins" advice.

### World-Class Score: **45 / 100**
*(Design 70 · Content 45 · Activation 40 · Validity 15 · Value 55)*

### Top 10 Improvements
1. Run a real psychometric study (reliability α, test–retest, factor structure) on the core constructs — the single biggest credibility unlock.
2. Build an **age-banded student item bank** so the student product isn't a watered-down professional one.
3. Activate the composite/pattern layer (diagnose why `capadex_session_patterns = 0`).
4. Expand the core bank well beyond ~40 items to kill repeat-exposure.
5. Replace keyword signal matching with calibrated, evidence-weighted scoring.
6. Make recommendations individualised (blend construct + magnitude + history), not tag-templated.
7. Wire recommendations to concrete next actions/products (close the "dead-end advice" gap).
8. Add longitudinal change reporting (session-over-session deltas).
9. Establish concern-area content (`concern_areas = 0`) so concern routing has real depth.
10. Add a parent-facing layer with specific, behaviourally-grounded home actions.

---

## 2. Competency Assessment

### Current State
The **best-engineered** product on paper — a 12-level competency hierarchy, context-aware weighting (seniority/industry/scale multipliers), empirical-percentile scoring with **Wilson confidence intervals** and **reliability tiers (A–D)**, and a 3-phase Individual Development Plan. But the **live ontology tables are empty** (`competencies`, `competency_catalog`, `ont_competencies`, `ont_micro_competencies`, `ont_benchmarks` = 0); runtime leans on static frontend banks plus 21 DNA-master rows. Live benchmark tables are empty (`ont_benchmarks` = 0, `stage_competency_norms` = 0), and prior peer-benchmarking audits put real cohorts at ~17 rows — below the k=30 suppression floor — so **every user currently sees "Provisional" benchmarks**.

### Strengths
- **Measurement hygiene is real and rare** — confidence intervals, reliability grading, reverse-item agreement. This is the most psychometrically serious code in the platform.
- **Context-aware role weighting** (DB-driven role-DNA, not hardcoded constants) is a genuine differentiator over flat competency tools.
- **Individualised IDP** with rationale, evidence, and success-probability framing.

### Weaknesses
- **The ontology is largely unpopulated in the live system** — the "12 levels" are architectural headroom, not delivered content.
- **Benchmarks are provisional for everyone** (~17 < 30) → the comparative value proposition doesn't yet exist for a customer.
- **Employer value is capped by the language policy** (forbids "likely to be hired / suitable candidate / promotion prediction") — legally prudent, but it removes exactly the claim recruitment buyers want.
- **No external norming or validation** — internal reliability ≠ validated against outcomes.

### Missing Capabilities
Populated competency/micro-competency content; real peer cohorts ≥30 so benchmarks unlock; a defensible bridge from "developmental signal" to an employer-usable (and legally safe) decision aid; outcome linkage.

### Recommendation Quality
**Good (the platform's best).** The IDP is concrete, phased, personalised by seniority, and tied to interventions — limited only by the size of the intervention library.

### World-Class Score: **50 / 100**
*(Design 75 · Content 40 · Activation 30 · Validity 30 · Value 50)*

### Top 10 Improvements
1. **Populate the competency ontology** — the engine is ready; the content tables are empty.
2. Reach **k≥30 cohorts** for at least the top role families so benchmarks leave "Provisional."
3. Map skills→competency levels with more than the ~22 static rules (improves gap accuracy).
4. Norm scores against a real population, not just internal consistency.
5. Grow the intervention library so IDPs stop falling back to generic items.
6. Build an employer-safe "workforce capability" view that delivers value *within* the language policy.
7. Add longitudinal competency velocity tracking surfaced to the user.
8. Validate the reliability tiers against re-test data.
9. Seed micro-competency content so the deeper hierarchy is usable.
10. Tie competency growth to EI/Career Builder so the assessment drives downstream value.

---

## 3. Learning Behaviour Index (LBI)

### Current State
**A scaffold, not yet a product.** A strong 19-domain / 97-subdomain taxonomy and a polished admin/teacher/student UI sit on top of an engine that does not yet do real science: scoring is a simple arithmetic mean of 1–5 Likert items, percentile is `(raw/5)*100`, and reports are generated by an AI prompt instructed to output an "overallScore between 60–95." Live data is effectively nil (`lbi_score_history = 8`; clusters, mappings, norms, versions all 0).

### Strengths
- **Excellent taxonomy** (19 domains / 97 subdomains) — a credible foundation to build on.
- **High-quality UI** (radar/trend visualisations, multi-language, cohort dashboards) — demo-ready.
- **Clear three-audience framing** (teacher / student / institution).

### Weaknesses
- **No real calculation logic** — averages and AI-generated numbers, not measurement.
- **AI-hallucinated reports** — a prompt that fixes the score range is a credibility and compliance risk.
- **Empty data** — norms, clusters, and learning mappings are unpopulated; "at-risk" flags reduce to "score < 40%."
- **Security gap flagged in prior audits** — unauthenticated admin endpoints on the older LBI surface (re-verify before remediation; not re-confirmed in this product-quality pass).

### Missing Capabilities
A real derivation engine (signals → scores) that doesn't rely on an LLM for the number; populated norms/clusters; ingestion of actual learning behaviour (study time, error/retry patterns) rather than self-report MCQs; a real early-warning model.

### Recommendation Quality
**Weak.** Interventions are generic templates / LLM-filled placeholders; no evidence-based intervention library.

### World-Class Score: **28 / 100**
*(Design 45 · Content 35 · Activation 10 · Validity 10 · Value 30)*

### Top 10 Improvements
1. **Replace AI-generated scores with a real, auditable derivation engine** — non-negotiable for credibility.
2. Close the unauthenticated admin-route security hole.
3. Populate subdomain norms so percentiles mean something.
4. Ingest real behavioural signals (time-on-task, retries, error patterns), not just MCQ self-report.
5. Build an evidence-based intervention library (replace placeholders).
6. Build a real early-warning model beyond "<40%."
7. Persist a longitudinal learning "genome" rather than regenerating at request time.
8. Validate cluster/learning-style classifications against real cohorts.
9. Deliver one genuinely actionable teacher artefact (a class-level action list).
10. Pilot with one institution to convert demo UI into evidenced value.

---

## 4. Employability Index (EI / MEI v2)

### Current State
A transparent, hierarchical 0–99 composite (Validated Proficiency 28% · Professional Experience 25% · Behavioural Intelligence 22% · Knowledge Foundation 15% · Portfolio & Presence 10%) with role/industry calibration multipliers. The formula and config are real and rich (45 competencies, 5 dimensions, 50 industry calibrations). **But no scores are computed/persisted** (`mei_scores = 0`), there are **no benchmarks** (`mei_benchmarks = 0`), and **no realized outcomes** (0) — so the index is, today, an unproven a-priori model.

### Strengths
- **Transparent, defensible weighting** with sensible industry/role calibration (e.g. portfolio weighted 1.85× in creative, 0.65× in finance).
- **Auditable point caps and linear scales** — no black box.
- **Explainability and internal-validity checks** (determinism, monotonicity).

### Weaknesses
- **Predictive value is zero and honestly disclaimed** — outcome coverage 0%; the docs state "we deliberately make NO accuracy claim."
- **Closed-loop self-fulfilment** — higher inputs by construction yield higher "predicted" outcomes; no external anchor.
- **Name vs claim tension** — "Hire-Ready" bands in the UX, "developmental-only" in the audit layer.
- **Uncalibrated** — calibration architecture exists but lacks the ≥30 real hiring decisions to use it.

### Missing Capabilities
A longitudinal **outcome feedback loop** (capture real hires/promotions) — the one thing that would convert EI from a signal score into a predictive product; real benchmarks; actually computing and persisting scores for users.

### Recommendation Quality
**Fair.** `mei_recommendation_master` (15) + user recs exist conceptually, but with 0 computed scores the recommendation path is unexercised for real users.

### World-Class Score: **42 / 100**
*(Design 72 · Content 50 · Activation 10 · Validity 10 · Value 45)*

### Top 10 Improvements
1. **Stand up the outcome feedback loop** — capture real hiring/promotion results; without it EI cannot ever claim predictive value.
2. Actually compute and persist EI scores for the existing user base (`mei_scores = 0`).
3. Collect ≥30 real decisions per segment, then turn on calibration (Brier/ECE).
4. Resolve the name/claim tension — one consistent, legally-safe framing across UX and audit.
5. Build real benchmarks so a score has comparative meaning.
6. Validate dimension weights against observed outcomes, not expert priors.
7. Add confidence/uncertainty bands to displayed scores.
8. Link EI lift to concrete development actions (tie to Competency/Career Builder).
9. Publish a transparent methodology so employers can trust the construct.
10. Run a pilot cohort to first-time-measure any predictive signal.

---

## 5. Career Builder ("Career OS")

### Current State
The **strongest customer-facing experience** and the product with real adoption (101 profiles, 101 goals). A composite recommender (Demand 30% · Switchability 25% · Growth 20% · Fit 20% · Automation 5%), concrete fitment math (`Σ min(actual,required)/Σ required` over competencies), ROI-linked IDPs ("+1.5 EI points for 10 hours"), and a polished 5-zone workspace. The backend career graph is **larger than it first appears** — `cg_roles = 200`, `cg_role_edges = 500`, `cg_skill_requirements = 711`, 15 tracks — though still far short of O*NET (~1,000) / ESCO (~3,000), and the `ont_career_paths` layer is empty.

### Strengths
- **Best UX and information design** in the platform — feels like a real product, not a demo.
- **Concrete, transparent gap analysis and ROI framing** — turns "learn Python" into a quantified plan.
- **Real adoption** — 101 profiles/goals, persistent DB-backed plans with status transitions.

### Weaknesses
- **Walled-garden content** — 200 backend roles / 40 frontend catalog roles; users outside the catalog hit sparse or sample graphs.
- **No O*NET/ESCO integration** — breadth depends on manual curation.
- **Transition probabilities are heuristic** (cited to Naukri/NASSCOM) — directional, not validated.
- **Monolithic frontend** (`CareerBuilderPage.tsx` ~8k LOC) — high polish, fragile maintainability.
- **Low recommendation/gap usage** (8 recs, 6 gaps) despite 101 profiles — the intelligence isn't reaching most users.

### Missing Capabilities
A global occupation/skills ontology (O*NET/ESCO); multi-step trajectories (not just 1-step adjacencies); validated transition data; getting recommendations in front of the 101 users who have profiles but no recs.

### Recommendation Quality
**Good.** Personalised, categorised (Next Steps / Quick Wins / Laterals / Stretch), ROI-quantified — limited by catalog breadth and intervention library size.

### World-Class Score: **56 / 100** *(highest)*
*(Design 70 · Content 55 · Activation 45 · Validity 35 · Value 60)*

### Top 10 Improvements
1. **Import O*NET/ESCO** — the single biggest content unlock; ends the walled garden.
2. Get recommendations to the 101 profiled users (8 recs today is an activation failure).
3. Build multi-step trajectories, not just 1-step adjacencies.
4. Validate transition probabilities against real career-move data.
5. Reconcile the two role systems (200 backend vs 40 frontend) into one source of truth.
6. Decompose the 8k-LOC monolith for maintainability.
7. Populate `ont_career_paths` or retire it (avoid dead "ontology" surfaces).
8. Expand the intervention library so IDPs stop hitting generic fallbacks.
9. Add live labour-market/salary feeds rather than periodic manual refresh.
10. Surface the EI lift loop end-to-end (goal → action → measured EI change).

---

## Most Important Finding — *Would a customer choose MetryxOne over alternatives?*

**It depends entirely on which customer, and on one fix.**

- **An individual / student / early-professional** seeking a holistic, explainable, affordable developmental and career-planning experience: **plausibly yes.** Career Builder's "Career OS," CAPADEX's explainable reports, and the breadth of integrated signals are genuinely attractive, especially in the Indian market with localised data and multi-language support. As a *coaching and self-insight* tool, MetryxOne is competitive on breadth, UX, and integration.

- **A school or institution** buying LBI/competency analytics: **not yet.** The LBI engine generates scores with an LLM, norms are empty, and benchmarks are provisional for everyone. Established players deliver validated instruments and real cohorts; MetryxOne delivers a beautiful, empty dashboard.

- **An employer** buying Employability/Competency for selection or workforce decisions: **no.** The products carry zero predictive validity (0 realized outcomes), no calibration (0 qualifying decisions), provisional-only benchmarks, and a language policy that explicitly forbids the hiring/suitability claims this buyer needs. Against Gallup CliftonStrengths, Hogan, SHL/Aon, Mettl, or pymetrics — all of which sell *validated, predictive, normed* instruments — MetryxOne currently loses on the exact axis these buyers price on.

**The decisive gap is not features — it is evidence.** MetryxOne has built remarkable breadth, transparent logic, and strong UX. What it has not built is the thing every serious buyer ultimately pays for: **proof the scores mean something.** Realized outcomes are 0, validation is absent, and real benchmark cohorts don't yet exist. Until at least one product closes the loop from *score → real outcome → calibrated, normed, validated claim*, MetryxOne is a superbly engineered **developmental platform** rather than a defensible **measurement product** — and most competitive losses will trace to that one sentence.

**Composite world-class average: ~44 / 100.** Best: Career Builder (56), Competency (50). Weakest: LBI (28). The portfolio's ceiling is set less by engineering than by the absence of empirical proof and populated data.
