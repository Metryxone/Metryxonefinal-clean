# MetryxOne Competency Assessment — World-Class Launch Certification (100X)

**Audit ID:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X
**Date:** 18 June 2026
**Scope:** Competency Assessment as (a) standalone/student/professional/institution/employer/enterprise product and (b) foundational intelligence layer for Career Builder, Employability Index, Career Passport, Future Readiness Platform, Employer Portal, LBI, Recommendation Engine.
**Method:** Evidence-only. Live shared-DB counts are authoritative for **Activation**. Code/migrations/seeds are evidence of **Structural** capability only. **Validity** = empirical evidence (calibration data, outcome correlation, norms). The three axes are reported separately and **never composited into a single inflated number**.

---

## 0. Honesty Contract (binding on every score below)

| Axis | Definition | What counts as evidence |
|---|---|---|
| **Structural** | The code/schema/algorithm exists | Source files, migrations, engine functions |
| **Activation** | Real data is flowing in the **live shared DB** | `SELECT count(*)` on the live DB this audit ran against |
| **Validity** | The output is empirically defensible | Calibrated IRT params, reliability coefficients on real samples, criterion/outcome correlation, population norms |

**Rule:** `null/absent ≠ 0`. `seeded ≠ computed ≠ validated`. A world-class *design* with zero validation data is **not** a world-class *product*. No score is inflated by implementation volume, architecture, or completed tasks.

---

## 1. Live-DB Activation Evidence (the spine of this audit)

Counts pulled from the live shared DB on 18 Jun 2026 (authoritative for Activation):

| Table | Live count | Reading |
|---|---|---|
| `competency_question_templates` | **0** | Curated/calibrated DB question bank is **empty live**. Users are served the **static frontend bank** (`assessment-question-bank-v2.ts`, ~50–100 items) — not the DB-managed, calibratable bank. |
| `lbi_clusters` | **0** | LBI framework not populated live; `lbi_subdomains`/`lbi_items` tables **do not exist** in this DB. |
| `sdi_items` | **680** | SDI item pool exists… |
| `sdi_clusters` / `sdi_domains` / `sdi_subdomains` | **0 / 0 / 0** | …but its hierarchy is unpopulated — items without a live taxonomy spine. |
| `onto_competencies` | **299** | Curated competency taxonomy partially seeded. |
| `onto_roles` / `onto_role_weights` | **5 / 35** | Only **5 roles** carry curated DNA weights live. |
| `ont_roles` / `ont_competencies` / `map_role_competency` | **0 / 0 / 0** | **O*NET import has NOT been run on this DB.** The "1016 roles / 136 comps / 49k links" is a Structural capability of `onet-import.ts`, not live data here. |
| `role_families` | **10** | Small curated role-family set. |
| `p4_competency_history` | **390** | Some per-competency history rows exist (append-only). |
| `mei_scores` / `mei_user_recommendations` | **0 / 0** | Employability Index **not activated** live; no EI-driven recommendations. |
| `cg_user_recommendations` | **8** | Career-graph recommendations: 8 rows total. |
| `capadex_sessions` / `capadex_reports` | **58 / 58** | 58 completed assessment sessions/reports — the real behavioural sample. |
| `users` / `career_seeker_profiles` | **103 / 101** | ~100 real users/profiles. |

**Headline activation finding:** The Competency Assessment is in a **cold-start** state. The curated, calibratable question bank is empty live (0 templates); the role/competency ontology is mostly unpopulated (O*NET not imported, 5 roles weighted); EI is not activated (0 scores); recommendations and benchmarks have effectively no population. The real evidentiary base is **~58 assessment sessions across ~100 users**.

> ⚠️ **Structural≠Activation discrepancy to record:** code/seed inspection reports "63 question templates, 97 LBI subdomains, 54 SDI subdomains, 1016 O*NET roles." Those are seed/migration capabilities. The **live DB** authoritative counts are 0 / 0 / 0 / not-imported. Prior memory (`merged-task-data-not-in-live-db.md`) explains why: merges carry CODE + DDL, not rows; data backfills ran in isolated task envs. **Activation scoring uses the live counts.**

---

## PHASE 1 — Competency Framework Audit

**Three frameworks of unequal maturity:**

- **LBI (Learning Behavioral Intelligence)** — student behavioural framework (19 domains / 97 subdomains by design; age-band norms AB1–AB6). *Structural: strong design. Activation: `lbi_clusters=0` live → effectively dormant in this DB.* Content is **description-led but light on explicit proficiency levels and behavioural anchors** ("label-heavy" legacy).
- **SDI (Student Development Index)** — K-12 holistic framework (18 domains / 54 subdomains; stage weights). *Activation: 680 items but 0 taxonomy rows live — items without a spine.* Same label-heavy limitation.
- **Competency / CAPADEX (modern core)** — professional 12-layer ontology, 7 clusters (Technical, Behavioural/Execution, Adaptability, Leadership, Cognitive, Digital, EI). *This is the genuinely modern layer:* `ref_proficiency_levels` (Foundational→Expert with bands), `ont_indicators` (observable behaviours), SJT/case items as live behavioural anchors.

**Coverage vs the 16 requested skill families:** behavioural/functional/leadership/digital/cognitive/EI are covered structurally. **AI skills, Green skills, Entrepreneurship, Research, Future skills, Power skills are *declared* (`ref_competency_categories`) but thinly or not populated live.** Coverage is **broad in design, shallow in live data**.

**Benchmark (SHL/Mercer Mettl/Korn Ferry/Lominger/LinkedIn/ESCO/O*NET/WEF):** Enterprise libraries ship 30–60 competencies each with rich, multi-level behavioural anchors and validated norms. MetryxOne's *modern* layer is architecturally comparable but **lacks populated anchors at scale and any norms**. The *legacy* (LBI/SDI) layer is below enterprise bar (label-heavy). **Verdict: High-potential challenger, not yet peer.**

---

## PHASE 2 — Competency Library Audit

- **Definitions / levels / indicators:** Modern ontology has the *tables* for definitions, 5 proficiency levels, and behavioural indicators. **Live population is sparse** (`onto_competencies=299`; indicator coverage unverified/low live).
- **Observable behaviours / skill linkages / examples:** Best realised in the **CAPADEX concern banks** (`capadex-concern-banks.ts`) and the static SJT bank — these are genuinely high-quality, clinically-informed behavioural content.
- **Duplication / consistency:** Moderate overlap across LBI/SDI/Competency (e.g., "Critical Thinking" appears in multiple frameworks), bridged via mapping tables — **not yet a single deduplicated canon**.
- **Measurability / actionability:** Strong where SJT/case items exist; weak for legacy label-only subdomains.

**Verdict:** Library is **world-class in pockets (SJT + concern banks), inconsistent and under-populated overall.**

---

## PHASE 3 — Competency Ontology Audit

Genuine **12-layer hierarchy**: Industry → Function → Department → Role Family → Role → Layer → Cluster → Competency → Micro-competency → Concern → Indicator → Assessment Question. Cross-domain relationships modelled in `onto_relationships` (source/target/strength) — a real graph, not a flat lookup.

- **Structural quality: high** (clear taxonomy, provenance tracking `curated` vs `onet_derived`, recursive SOC inheritance for unrated roles).
- **Activation quality: low** — live: `onto_competencies=299`, `onto_roles=5`, `ont_*=0` (O*NET not imported). Micro/sub-competency tables not present live.
- **Scalability/global applicability:** the *mechanism* scales (O*NET importer, SOC inheritance, dual-ontology bridge); the *live graph* is small.

**Missing/weak (live):** populated micro-competencies, populated indicators, cross-industry edges at scale, and the entire O*NET layer (not imported here).

**Verdict:** Real ontology, **structurally strong, empirically thin.**

---

## PHASE 4 — Role Mapping Audit

- **Role families / roles / levels:** 10 role families, 5 roles with curated DNA weights live (24 roles designed). Mobility engine (`compareRoles`) computes overlap/transferability/gap scores via competency vectors.
- **Role crosswalk:** 4-tier resolver (code → exact title → alias → partial) bridges free-text/legacy/O*NET id spaces honestly (no-match → null, never fabricated).
- **"Can every role be mapped?"** Structurally yes (crosswalk + SOC inheritance); **live, only the 5 weighted roles produce a full DNA vector** — others resolve but return thin/empty competency sets until O*NET is imported.
- **"Can every competency drive employability?"** Only once it feeds `mei_scores` — which is **0 live**. So today: **no.**

**Verdict:** Mechanism is sound; **live coverage is ~5 roles deep.**

---

## PHASE 5 — Assessment Science Audit (most important)

**Structural rigor is genuinely high — among the strongest evidence in this audit:**
- **Reliability:** Cronbach α implemented (`sci-psychometric-engine.ts`), reliability tiers A–D; per-session Reliability Index (consistency, reverse-item validity, contradiction penalty, completion quality) in `reliability-engine.ts`.
- **Calibration:** Full **IRT 3PL** with Item Information + **EAP θ** estimation (`caf/scoring-engine.ts`); T-score normalisation (50 + θ·15).
- **Bayesian mastery:** Beta-posterior mastery probability with uncertainty bands.
- **Bias/fairness:** **Four-Fifths Rule** adverse-impact; anomaly detection (straightlining, fast-response, zero-variance) to invalidate low-effort sessions.
- **Interpretability:** explainable scoring, BARS rubrics, Bloom multipliers.

**But Validity is unproven:**
- IRT a/b/c parameters are **seeded/assumed**, not empirically calibrated on a real sample (calibration needs large N; live N≈58 sessions).
- Cronbach α / adverse-impact **formulas exist but no validation study output** is present (benchmarks/cohorts empty).
- **No criterion validity** (no outcome correlation — see Phase 18).
- Construct validity uses Pearson vs an external criterion that isn't populated.

**"Would an I/O psychologist approve?"** They would respect the **architecture** and demand to see the **actual calibrated parameters and reliability coefficients on real samples** — which do not yet exist. **"Would an enterprise buyer trust it?"** The bias-detection and explainability hooks make it *defensible*, but a procurement psychometric review would mark it **"science-ready engine, not yet science-validated instrument."**

**Verdict:** **Structural science = strong; empirical validity = not yet demonstrated.** This is the single biggest gap between MetryxOne and SHL/Korn Ferry.

---

## PHASE 6 — Question Bank Audit

- **What serves users today:** the **static frontend bank** (`assessment-question-bank-v2.ts`, ~50–100 expert-style SJT/case/behavioural items with role/industry/function affinity tags, difficulty, depth). High quality per-item.
- **DB bank:** `competency_question_templates = 0 live` → the calibratable, expert-managed, adaptive-selectable bank is **empty in this environment**. Adaptive selection (`question-generation-engine.ts`: lowest-confidence × highest-weight) is built but has no DB pool to draw from live.
- **Coverage/diversity:** good across 7 domains for the static set; **thin for AI/Green/Future/Research families.**
- **Bias/redundancy/calibration:** no item-level bias analysis output, no difficulty calibration on real responses, redundancy not audited.
- **Signal quality:** the CAPADEX **signal spine** (question → concern) is a genuine differentiator, but signal coverage across tags is partial (prior audits: ~25/328 tags have signals natively).

**Verdict:** **Good content, small live bank, no empirical calibration.** Bank size is far below enterprise (SHL banks are thousands of calibrated items).

---

## PHASE 7 — Assessment Engine Audit

Sophisticated, deterministic, explainable multi-model scorer (`caf/scoring-engine.ts`):
- Behavioural → BARS; Functional → weighted CTT with Bloom multipliers; Cognitive → IRT 3PL/EAP; Leadership → SJT expert-keying + BARS.
- `finalizeScores`: domain weighting + L1–L5 proficiency bands.
- OMEGA-X atomic-signal multiplier matrix (severity × confidence × persistence).
- Gap/strength/risk detection incl. stability analysis (temporary spike, inconsistency, **coaching-contamination** ≥5 signals jumping in 7 days).

**Verdict:** **Engine is a real strength** — rule-based but principled and explainable. Activation is decent (engine runs on the 58 sessions). It is not "validated" (no outcome linkage), but it is **defensible and transparent**.

---

## PHASE 8 — Benchmark Audit

- **Method: excellent.** `peer-benchmark.ts` enforces k-anonymity `K_MIN=30`, suppresses sub-30 cohorts ("Provisional — cohort still building"), widens cohort progressively, uses Normal-CDF percentiles.
- **Activation: empty.** `ei_calculation_logs=0`, population far below k=30 in every cohort. **Every benchmark a user sees today is suppressed/provisional.**
- Industry/role/experience/leadership/student/professional benchmarks are **structurally supported, empirically unavailable.**

**Verdict:** **Legally and scientifically sound, but currently non-functional for users** due to population.

---

## PHASE 9 — Recommendation Intelligence Audit

Three engines, all real and explainable:
- **MEI engine:** `priority = impact × (1−effort) × data_confidence`; action types incl. assessment/certification/learning.
- **PIL Phase 7:** library-backed recs with full traceability (Concern→Capability→Problem→Behaviour→Archetype→Intervention→Recommendation), stored in `recommendation_explainability`.
- **Career-graph:** next-role ranking (readiness 40% / demand 20% / transition 15% …).

**Relevant/Actionable/Personalised/Explainable/Measurable/Outcome-oriented:** all **structurally yes** (behaviour-anchored, effort/point-gain metadata, link paths). **Activation: near-zero** — `mei_user_recommendations=0`, `career_recommendations=0`, `cg_user_recommendations=8`.

**Verdict:** **Best-in-class design, cold-start activation.** Personalisation/explainability are real but rarely exercised.

---

## PHASE 10 — Development Planning Audit

- Concrete IDP (`GrowthRoadmap.tsx`): planned/in-progress/completed, "EI banked" + "hours invested" → measurable, outcome-oriented.
- Gaps sync from assessment → growth plan (`/api/career/pi/growth-plan/:userId/sync`).
- **"Does assessment lead to action?"** Yes, structurally — there is a real path from result → plan → tracked items.
- **"Does it improve outcomes?"** **Unproven** — no realised outcome data (Phase 18).

**Verdict:** **Action path exists; outcome improvement unproven.**

---

## PHASES 11–14 — Journey Audits (Student / Professional / Employer / Institution)

- **Student (11):** assessment experience + report exist and are good; recommendations sparse; benchmarks suppressed. *Would a student complete/trust/act/recommend/pay?* — Complete: yes. Trust: moderate (explainable). Act: partly (recs thin). Pay: unproven (0 sales).
- **Professional (12):** career transition/promotion/upskilling logic present; **return-repeatedly depends on populated recs + benchmarks** → not yet.
- **Employer (13):** TIG/employer portal is the **most mature consumer**; success-probability engine exists; **hiring/promotion verdicts are deliberately disallowed for AI** (correct, honest) — UI has slots but production blocks unvalidated claims. *Buy/renew?* — pilot-credible on talent-intelligence value, **not on validated hiring prediction.**
- **Institution (14):** batch analysis, faculty usage, placement readiness, program outcomes are structurally supported and the **strongest go-to-market** (concierge pilots). *Renew after a year?* — plausible **if** outcome evidence accrues.

---

## PHASES 15–17 — Dependency Audits

- **Career Builder (15):** consumes `cg_user_role_readiness` + `mei_scores`. Weak/absent competency activation → **generic recs, thin role DNA**. CB is **materially dependent** on competency activation.
- **Employability Index (16):** `mei_scores=0` live → **EI is not currently activated**; it *cannot survive without competency quality* because competency + CAPADEX reports are its primary inputs (`resolveProfile → computeMEIScore`).
- **Employer Portal (17):** uses `ei_score`/`assessment_score` on candidates; trustworthy *talent intelligence* yes, *hiring decisions* intentionally gated. **Employer trust hinges on the same validity gap.**

**Verdict:** Competency is **the keystone dependency** for EI, Career Builder, and Employer value — and it is currently under-activated, so the dependents are correspondingly degraded.

---

## PHASE 18 — Outcome Validation Audit

- `career_outcomes` table exists (goal_achieved, ei_lift, hire, promotion); evidence loop (`career-evidence.ts`, `computeEvidence` with `MIN_VALIDATION_N`).
- **Live realised outcomes: effectively zero** — rows are demo/seed (`is_demo=true`/`source='demo_seed'`).
- **No correlation/predictive-validity analysis** has the N to run.

**"Do competency scores correlate with outcomes? Can predictive value be demonstrated?"** — **Not today. No outcome data, no predictive-validity claim is permitted.** (This is the honest, replit.md-mandated stance.)

---

## PHASE 19 — Industry Readiness

IT/ITES/Education/Startups: structurally serviceable (generic + student frameworks). BFSI/Healthcare/Manufacturing/Government/Global Enterprises: **require industry-specific competency packs, norms, and compliance evidence that do not exist live.** **Verdict: ready for general/education pilots; not for regulated/enterprise verticals.**

---

## PHASE 20 — Commercial Product Readiness

- Packages/pricing/entitlement spine built (`entitlement-engine.ts`; tiers defined; Razorpay integrated). **Flags default OFF; `capadex_payments` ≈ demo/₹0; zero real sales.**
- Assessment credits/usage tracking: structural.
- **"Would customers pay / renew?"** Unproven — **no transaction has occurred.**

**Verdict:** **Gated-real, pre-revenue.**

---

## PHASE 21 — SuperAdmin Support

Extensive monitoring (assessment/institution/AI-drift, `m4-observability.ts`), audit trails, RBAC, employer audit logs. **Gaps (from launch-readiness audit):** crisis detection has **no human-notify path (safety gap)**; email (Zoho) is a SPOF for MFA/OTP; no ticketing; OTP/login rate-limiting thin. **Verdict: operable for pilots, not hardened for scale.**

---

## PHASE 22 — Scale Readiness

Architecture (Postgres + Express + JSONB) is fine to ~1,000 users. **1,000–1,000,000 requires:** migration-led deploy discipline (currently lazy `ensureSchema`), connection pooling/read replicas, async assessment processing, and population of norms/banks. **Verdict: 100–1k ready; 10k+ needs hardening; 1M is a roadmap.**

---

## PHASE 23 — Competitive Benchmarking (summary; detail in `competency_competitive_benchmark.md`)

vs **SHL, Mercer Mettl, Korn Ferry, Lominger, LinkedIn Skills Graph, Eightfold, Workday Skills Cloud, Degreed, Cornerstone:**
- **Advantages:** signal/concern spine (psychological granularity), explainable traceable recommendations, dual-ontology with honest provenance, integrated CAPADEX behavioural layer.
- **Disadvantages:** no validated norms, no published reliability/validity, tiny live bank, no scaled customer base, no outcome evidence.
- **Differentiator:** behaviour-anchored, concern-linked, explainable intelligence (if validated).

---

## PHASE 24 — World-Class Certification (scores in `competency_scorecard.md`)

**Three honesty axes — reported separately, NOT composited into a single number** (compositing is forbidden by `replit.md`):
- Structural sub-score: **~80 / 100** (genuinely strong — describes *what is built*).
- Activation sub-score: **~25 / 100** (cold start — *what is live in the shared DB*).
- Validity sub-score: **~12 / 100** (unproven — *what is empirically defensible*).

There is **no platform composite score**. The verdict is a **gated conclusion**, not an average: a scientific assessment product **cannot be "world-class" without validity evidence and an activated population** — so Validity ~12 caps the platform below Launch and Activation ~25 caps it at Pilot, regardless of Structural strength.

---

## FINAL VERDICT

| Lens | Classification |
|---|---|
| **Engineering / design** | **Launch-Ready → approaching World-Class** (architecture only) |
| **Product (student/professional/commercial)** | **Beta Ready** — cold start, pre-revenue, unproven |
| **Institution (concierge pilot)** | **Pilot Ready** — on structural strength + batch features |
| **Employer (talent intelligence, not hiring verdicts)** | **Pilot Ready** (gated) |
| **Scientific instrument (I/O-grade)** | **Not Ready** — no empirical validity |
| **World-Class competency intelligence platform** | **Not Yet** |

**One-line verdict:** *MetryxOne Competency Assessment is a structurally excellent, scientifically well-architected engine in a pre-validation, cold-start state — Pilot Ready for institutions and gated employer use, Beta Ready as a commercial product, and Not Yet world-class until it has (1) empirical validity evidence, (2) populated banks/ontology/norms in the live DB, and (3) realised outcome data.*

See companion deliverables for scorecard, gaps (incl. Top 100 reasons), launch readiness by product, competitive benchmark, science validation, dependency analysis, commercial/scale readiness, roadmap, and the founder decision brief.
