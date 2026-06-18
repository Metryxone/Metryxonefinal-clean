# METRYXONE — MASTER DISCOVERY DOSSIER

**Prepared for:** External product strategist (no prior exposure to the platform)
**Method:** Direct inspection of the live codebase + production PostgreSQL database (row counts measured, not estimated). Where a claim could not be grounded in code or data, it is explicitly labelled **INFERRED** or **NOT DEFINED IN CODEBASE**.
**Stance:** Document reality. No marketing. Gaps are stated plainly.

> **The one-sentence truth:** MetryxOne is an *extraordinarily* deep behavioural-intelligence and ontology engine (hundreds of thousands of curated rows across knowledge-graph, concern, signal, and competency layers) wrapped in a broad but largely unpopulated product surface, with **4 real platform users, 12 CAPADEX users, ~27 assessment sessions, no live subscription billing, and no college library.** The intelligence is real and rare; the *business* around it is essentially pre-launch.

---

## EVIDENCE BASE (measured this session)

**Real people & usage (production DB, exact counts):**

| Table | Rows | Meaning |
|---|---|---|
| `users` | **4** | Core platform user accounts |
| `capadex_users` | **12** | CAPADEX assessment registrants |
| `career_seeker_profiles` | **2** | Career Builder profiles |
| `capadex_sessions` | **27** | Completed/started assessment sessions |
| `capadex_runtime_sessions` | **284** | Runtime session rows (incl. partial/anon/sim) |
| `capadex_responses` | **50** | Stored answers |
| `capadex_reports` | **39** | Generated reports |
| `pragati_sessions` | **30** | Conversational runtime sessions |
| `cra_profiles` / `cra_scores` | **3 / 70** | Competency assessment runs |
| `csi_profiles` | **73** | Career Stage Index profiles |
| `capadex_payments` | **6** | Payment rows (demo-mode default) |
| `tenants` | **4** | Institutional tenants (seed) |

**Intelligence / ontology content (the real asset — exact where shown):**

| Table | Rows |
|---|---|
| `pil_kg_edges` (knowledge graph edges) | **142,457** |
| `mobility_transferability_maps` | **89,401** |
| `pil_kg_nodes` | **62,095** |
| `pil_kg_similarity_index` | ~50,204 |
| `capadex_clarity_questions` | **30,638** |
| `capadex_question_metadata` (AQ-2) | **30,638** |
| `capability_problem_behavior_map` | **29,730** |
| `capadex_bridge_tag_signal_grounding` | **28,683** |
| `p4_benchmark_trends` (synthetic benchmarks) | ~26,910 |
| `capadex_atomic_signals` | **15,972** |
| `capadex_question_registry` | **14,294** |
| `capadex_concern_signal_map` | **14,200** |
| `capadex_concern_clarity_map` | **9,760** |
| `behavior_library` | **8,030** |
| `capadex_concerns_master` | **2,489** (328 distinct bridge tags) |
| `archetype_concern_map` | **2,151** (22 archetypes) |
| `recommendation_library` | **1,468** |
| `capability_problem_map` | **905** |
| `capadex_families` | **400** |
| `intervention_library` | **140** |
| `human_problem_library` | **88** |
| `capadex_signals` / `capadex_domains` | **20 / 20** |

**Catalog / content reality:**

| Asset | Status | Count | Where |
|---|---|---|---|
| Career roles taxonomy | **Real** | ~150 roles, 25 pathway nodes | `frontend/src/data/catalogs/industryRoles.ts` |
| Skill / competency framework | **Real (core IP)** | 7 domains, 20+ competencies | `data/catalogs/assessment-questions.ts` |
| Institutions | Seed | 67 (+56 rankings) | `institutions` table |
| Occupations / competencies / skills | Seed | 30 / 299 / 90 | `onto_*` tables |
| Courses / Learning Hub | **Stub** | 10 hardcoded, `#` URLs | `data/catalogs/courses.ts` |
| Mentors | **Stub** | 6 fake profiles | `data/catalogs/mentors.ts` (DB `mentors` empty) |
| Intervention programs | Seed | ~50–140 (CSV + library table) | `audit/pil_phase5/*.csv`, `intervention_library` |
| **College library** | **DOES NOT EXIST** | **0** | — |

> **Structural finding:** Hundreds of additional tables (`m3_*`, `m4_*`, `m5_*`, `wos_*`, `gro_*`, `sci_*`, `onto_*`) exist with **1–10 rows each** — an elaborate enterprise/workforce-intelligence schema that is almost entirely seed/demo. The schema describes a far larger product than the data populates.

---

## SECTION 1 — BUSINESS VISION  *(INFERRED — no vision/mission statement exists in the codebase)*

Reconstructed from `replit.md`, module naming, and the pricing UI. No formal mission/vision is documented anywhere in the repo.

- **Mission (inferred):** Turn behavioural and competency signals into honest, developmental career guidance for students and early-career individuals — and into workforce intelligence for institutions and enterprises.
- **Vision (inferred):** A "behavioural operating system" spanning the learner journey (assessment → insight → intervention → career building → mentorship) and the institutional/enterprise journey (cohort analytics → workforce planning).
- **Core problem:** Career and development guidance is generic, opinion-led, and not grounded in measured behaviour. MetryxOne's differentiator is a *measured, provenance-stamped* intelligence layer that refuses to fabricate.
- **Target outcomes (inferred):** Better self-understanding and career readiness for individuals; risk/strength visibility for institutions; workforce capability intelligence for enterprises.
- **Unique value proposition (grounded):** The CAPADEX intelligence stack — 30k+ curated clarity questions, a 4-tier signal ontology (20 domains → 400 families → 20 signals → 15,972 atomic), a 142k-edge knowledge graph, and a discipline of *honest, additive, flag-gated, never-fabricated* engines. **This depth is genuinely uncommon.**

**Brutal note:** The vision is encoded in *architecture*, not in any written strategy, customer commitment, or revenue model. It is an engineering manifesto, not yet a business plan.

---

## SECTION 2 — CUSTOMER SEGMENTS

| Segment | Needs | Current support level (grounded) |
|---|---|---|
| **Student** | Self-discovery, career direction, readiness | **Best-supported.** Real assessment → report → (partial) career builder. Tiny real usage (12 CAPADEX users). |
| **Parent** | Visibility into child's development; reassurance | Pricing tier + feature-gating logic exists; `parent_subscriptions` table is labelled "aspirational"; no live flow. |
| **School** | Cohort risk/strength dashboards | UI exists (`SchoolHealthDashboard`) on **mock data** (5 mock grades). No real school onboarded. |
| **College** | Admissions/fit, student outcomes | **No college library exists.** Effectively unsupported. |
| **Counselor** | Caseload triage, intervention guidance | Counselor stakeholder reports exist in PIL layer; no counselor account/workflow product. |
| **Mentor** | Match with mentees, deliver sessions | **Stub only** — 6 fake mentors, no booking, no real mentors, empty DB table. |
| **Corporate / Enterprise** | Workforce capability, succession, risk | Vast schema (`m3/m4/m5/wos`), all seed (1–10 rows). "Contact Sales" form only. |
| **Government** | Workforce/skills policy | `gov_*` governance tables seeded (3–47 rows). No product surface. |
| **NGO** | Access programs | **No specific support.** |

**Pain-point honesty:** Every segment beyond *Student* is currently a UI/schema promise. The platform can genuinely run a behavioural assessment and produce a grounded report; it cannot yet onboard a school, sell a parent subscription, book a mentor, or serve a college.

---

## SECTION 3 — PRODUCT ARCHITECTURE

Stack: React + Vite frontend (port 5000), Node/Express + `tsx` backend (port 8080), PostgreSQL via Drizzle. Backend is run on `tsx` in production — **never type-checked or compiled** (the only build gate is the frontend Vite build).

| Module | Purpose | Status | Completion % | User | Real usage |
|---|---|---|---|---|---|
| **CAPADEX assessment** | Behavioural concern→signal→report engine | **Functional** | ~75% | Student | 27 sessions, 39 reports |
| **CAPADEX intelligence engines** | Composites, patterns, interventions, explainability, KG, PIL | **Functional (read-only, deep)** | ~70% | System | Operates on tiny session data |
| **Pragati** | Conversational behavioural runtime (13-state FSM) | Functional | ~60% | Student | 30 sessions |
| **Career Builder** | Profile→roles→IDP→jobs→resume | Partial (monolith ~7.8k lines) | ~45% | Student | 2 profiles |
| **Competency Assessment** | 7-domain competency scoring | Functional | ~60% | Student | 3 profiles / 70 scores |
| **Employability Passport** | Shareable snapshot | Partial, flag-gated | ~40% | Student | Minimal |
| **Mentoring** | Mentor discovery/booking | **Stub** | ~10% | Student/Mentor | 0 |
| **Learning Hub** | Courses/paths | **Stub** | ~10% | Student | 10 hardcoded |
| **Institution dashboard** | Cohort analytics | UI on mock data | ~20% | School | 0 real |
| **Analytics** | Cognitive/signal/ROI analytics | **Stub/mock** | ~20% | Admin/Enterprise | 0 |
| **Enterprise/Workforce (M3–M5, WOS, GRO)** | Org capability, succession, market intel | Schema + seed | ~15% | Enterprise | seed only |
| **SuperAdmin console** | Manage frameworks, concerns, questions, reports | **Functional** | ~70% | Admin | Active |

---

## SECTION 4 — CAPADEX INVENTORY

| Layer | Count | Maturity | Known weakness |
|---|---|---|---|
| Concerns (`concerns_master`) | **2,489** | High | `concern_id` is **disjoint** from clarity questions (0% direct join); only `master_bridge_tag` bridges them |
| Bridge tags (distinct) | **328** | Medium | Age/persona inherited from tag are ambiguous (multi-persona, wide age spans) |
| Clarity questions | **30,638** | High (volume) | Provenance-derived metadata is **tag-level**, so it can't differentiate questions *within* a pool (see AQ-2R finding) |
| Question metadata (AQ-2) | **30,638** (100% join) | High coverage | Signal coverage only 55.8%; signal/age/behavior/capability fixed at tag granularity |
| Signals (4-tier) | 20 domains / 400 families / 20 signals / **15,972 atomic** | High | "GENERAL_CONCERN" catch-all is mostly positive strengths, not concerns |
| Capabilities (`capability_problem_map`) | **905** (+29,730 cap-problem-behavior) | High | Heavily synthetic; coverage ≠ chain-completeness |
| Problems (`human_problem_library`) | **88** | Medium | Curated, small |
| Behaviors (`behavior_library`) | **8,030** | High | Statements carry `{token}` slots needing rendering |
| Archetypes | **22** | Medium | ~59% "name-only" (6-input ceiling) — an honest, documented limitation |
| Interventions (`intervention_library`) | **140** | Low-Medium | Library-backed only; thin relative to concern space |
| Recommendations (`recommendation_library`) | **1,468** | Medium | Compose-only; anchored to active constructs |
| Knowledge graph (PIL) | **142,457 edges / 62,095 nodes** | High (volume) | Lineage is honestly *partial*; namespace must stay `pil_kg_*` (a bare `kg_*` clash would wipe the live Employability graph) |

**Maturity assessment:** CAPADEX is the platform's crown jewel and is genuinely sophisticated — provenance-stamped, additive, flag-gated, with a documented discipline of never fabricating. **Its principal weakness is the inverse of its strength:** much of the derived metadata is at tag/family granularity, which limits how much *per-question* runtime intelligence can actually do (proven by the AQ-2R measurement: within-pool signal/age/behaviour/capability differentiability ≈ 0%). The depth is real; the *resolution* in places is coarser than the architecture implies.

---

## SECTION 5 — ASSESSMENT ENGINE

- **Types:** Free CAPADEX behavioural assessment; Competency Assessment (7-domain); Pragati conversational; various admin-configured frameworks (LBI/SDI/competency).
- **Actual flow (CAPADEX):** `intro → analyze → clarify → preview → questions → result → register → OTP → report` (`FreeAssessmentModal.tsx`, ~4,150 lines).
- **Question engine:** 3-tier clarity picker — `pickQuestionsFromMaster` (bridge-tag join) → adaptive DB bank → static fallback; response carries a `clarity_source` provenance pill. **Never 404s** (keyword fallback).
- **Adaptive logic:** `services/adaptive/*` + `/adaptive-next` rebuilds the same pool via the analyze envelope; falls back to batch on any failure (returns 200, never 500). Flag-gated.
- **Scoring:** Answers → Evidence → Signals → Composites → Patterns inside an advisory-locked transaction; reverse-scored lived answers; CSI/competency hooks post-completion.
- **Report generation:** Multi-stakeholder (Student/Parent/Counselor/Institution) compose-only reports; readiness band **capped when chains are degraded** (honest, not optimistic).
- **Brutal note:** The engine is real and runs end-to-end, but on **~27 sessions of real data**. It has never been load- or population-tested at scale.

---

## SECTION 6 — CAREER BUILDER

- **Inputs:** Profile (role/target/industry/stage/org layer/maturity), resume, competency scores, CAPADEX behaviour graph, market/job catalogs.
- **Outputs:** Recommended roles, ranked jobs, IDP, resume (Zety-style builder embedded), behavioural growth & next-best-actions tabs, peer benchmarks.
- **AI/intelligence components:** `useCareerBrain` aggregator + pure deterministic engines (`constraintEngine`, `unifiedActionEngine`, `progressLedger`, `outcomeAttributionEngine`, `aiCareerCopilot`). All *re-shape already-computed data* — no live LLM dependency for core flows.
- **Recommendations:** Library-backed, never generic; degrade gracefully when backend data is empty (e.g. weekly-only actions).
- **Workflows / data sources:** Career taxonomy (~150 roles, real), market catalog (seed), recruiter postings (lazy table, falls back to demand-driven), behaviour bridge (adopted only on a real linked session).
- **Brutal note:** Architecturally strong and genuinely additive, but **2 real profiles**. It is a well-built engine running essentially dry. The page is a ~7.8k-line monolith mid-refactor.

---

## SECTION 7 — DEVELOPMENT JOURNEY (actual implementation status)

```
Assessment ──► Report ──► Intervention ──► Career Builder ──► Mentorship
  REAL          REAL        PARTIAL           PARTIAL            STUB
 (27 ses.)    (39 rep.)  (140 lib items,   (2 profiles,      (6 fake
                          surfaced thinly)   engines real)     mentors)
```

- **Assessment → Report:** Fully wired and the most-used path.
- **Report → Intervention:** Intervention engine + library exist (library-backed, never generic) but surfacing to end-users is thin; mostly read-only/admin.
- **Intervention → Career Builder:** Bridge exists (`career-behavior-adapter`) but adopts behaviour only on a real linked session; few such sessions exist.
- **Career Builder → Mentorship:** **Broken/absent** — mentorship is a stub. The journey terminates before its intended endpoint.

---

## SECTION 8 — CONTENT INVENTORY

| Content | Count | Quality assessment |
|---|---|---|
| Courses / Learning paths | 10 | **Stub** — hardcoded titles, `#` URLs, no LMS, no real content |
| Mentors | 6 | **Stub** — fake names/companies/ratings, no booking |
| Career library (roles) | ~150 + 25 pathways | **Real, good** — deep, hierarchical taxonomy |
| College library | **0** | **Does not exist** |
| Skill frameworks | 7 domains / 20+ competencies | **Real, strong** — core IP |
| Intervention programs | ~50–140 | **Seed** — partly trapped in `audit/*.csv`, partly in DB |
| Institution dashboards | 5 mock grades | **Mock** — UI real, data fake |
| CAPADEX intelligence content | 200k+ rows | **Real, deep** — the genuine content moat |

**Brutal note:** The platform's real content is **two-faced**: enormous, high-quality *intelligence ontology* (in PostgreSQL) and *thin, faked product content* (courses/mentors/colleges, mostly in frontend `.ts` files). Much "content" lives in frontend catalogs or `audit/` CSVs rather than being DB-served — a productization debt.

---

## SECTION 9 — MONETIZATION

- **Live billing:** **None functional.** You cannot currently charge for a subscription.
- **One-time payments:** Razorpay integration exists for CAPADEX stage payments (`routes/capadex-payments.ts`) with order creation, signature verification, webhooks — **but defaults to "Demo Mode"** (`DEMO_` orders, `razorpay_configured:false`) unless `RAZORPAY_KEY_ID` is set. `capadex_payments` has **6 rows** (demo-grade).
- **Subscriptions:** High-fidelity UI (Free/Starter/Pro/Institution, e.g. ₹999/mo) but the `/api/platform-tiers` endpoint is **missing**; `parent_subscriptions` is labelled "aspirational."
- **Feature gating:** Logic exists (`lib/featureGating.ts`) but, absent a real subscription record, effectively defaults everyone to **free**.
- **Enterprise:** "Contact Sales" / Request Demo form only; `tenants` is an admin tool, not self-service.
- **No Stripe / RevenueCat / Whop** integration present.

**Intended model (inferred from UI):** Freemium individual (Free→Starter→Pro), parent/family plans, institution licensing, enterprise/workforce contracts. **Reality:** revenue infrastructure is at UI/schema/demo stage; €0 of the model is operational.

---

## SECTION 10 — DATA ASSETS

| Asset | Count | Note |
|---|---|---|
| Users | **4** | core accounts |
| CAPADEX users | **12** | assessment registrants |
| Assessments/sessions | **27** (capadex) + 30 pragati + 3 cra | real usage |
| Reports | **39** | generated |
| Questions (clarity) | **30,638** | + 30,638 metadata + 14,294 registry |
| Signals | **15,972** atomic (+20/400/20 hierarchy) | 4-tier ontology |
| Careers/roles | ~150 (taxonomy) + 30 occupations | catalog |
| Colleges | **0** | none |
| Mentors | **6** (fake) | stub |
| Content assets (KG) | **142,457 edges / 62,095 nodes** | knowledge graph |
| Behaviour/capability | 8,030 behaviours / 905 capabilities / 29,730 cap-problem-behaviour | curated |
| Recommendations/interventions | 1,468 / 140 | libraries |
| Payments | **6** (demo) | no real revenue |

**Database total:** ~470 tables. The vast majority (`m3/m4/m5/wos/gro/sci/onto`) hold **1–10 rows** — schema vastly exceeds populated reality.

---

## SECTION 11 — PLATFORM GAPS (brutally honest)

**CRITICAL**
1. **No real users / no demand validation** — 4 platform users. Nothing is proven in market.
2. **No working monetization** — cannot charge a subscription; payments default to demo mode.
3. **College library does not exist** — a named target segment has zero supporting data.
4. **Mentorship is fake** — fabricated profiles, no booking, no supply.
5. **Backend never type-checked** — runs on `tsx`; the only build gate is the frontend Vite build. Runtime regressions can ship silently.

**HIGH**
6. Schema sprawl (~470 tables, most seeded) — heavy maintenance + cognitive load, little populated value.
7. Content trapped in frontend `.ts` / `audit/*.csv` instead of DB-served.
8. Institution/enterprise dashboards run on mock data — not sellable as-is.
9. Monolith files (`routes.ts` ~13k lines, `CareerBuilderPage.tsx` ~7.8k, `FreeAssessmentModal.tsx` ~4.1k) — change-risk and onboarding friction.
10. Intelligence metadata is tag-level in places, capping per-question runtime resolution (AQ-2R proved within-pool deltas ≈ 0 on several dims).

**MEDIUM**
11. Two parallel flag systems (file registry vs DB `feature_flags`) — easy to confuse.
12. Identity-space inconsistency across modules (BIGINT vs TEXT vs UUID user ids).
13. Analytics module is largely mock/"coming soon."
14. No automated test suite gating merges (testing via subagent is disabled).
15. `replit.md` is very large — itself a documentation-maintenance risk.

**LOW**
16. Minor resolver edge cases (e.g. `ADULT_WORK_MARKER` regex misses "workday").
17. Some intervention content thin relative to concern breadth.
18. Email is single-provider (Zoho) with no fallback.

---

## SECTION 12 — COMPETITIVE POSITIONING

| Competitor | Their strength | MetryxOne vs them |
|---|---|---|
| **CareerGuide / Mindler** | Counsellor network, college DB, brand, real users | **They win on distribution, content (colleges), and live counselling. MetryxOne wins on intelligence depth — if it ever ships.** |
| **Univariety** | School partnerships, college/alumni data | MetryxOne has *no* college data and *no* school deployments yet. |
| **MyCaptain** | Cohort courses, mentorship at scale, community | MetryxOne's courses/mentors are stubs. |
| **Coursera Career Services** | Massive course catalog, credentials, employer ties | Not comparable on content; MetryxOne is assessment/intelligence, not courseware. |
| **LinkedIn Learning** | Identity graph, content, employer reach | No overlap in scale; MetryxOne's edge is *behavioural diagnosis*, not learning content. |

**Honest positioning:** MetryxOne's *only* defensible differentiator is the **CAPADEX behavioural-intelligence engine** — a genuinely deep, provenance-disciplined ontology that competitors don't have. On every commodity dimension (colleges, courses, mentors, counsellors, brand, users, revenue) it currently **trails**. The strategy must be "intelligence as the wedge," not "broad platform."

---

## SECTION 13 — 3-YEAR STRATEGY  *(NOT DEFINED IN CODEBASE)*

There is **no roadmap, no growth target, no revenue target, and no user/institution target** documented anywhere in the repository. `docs/phase-history.md` is an *engineering* build log (phase index), not a business plan. Any 3-year strategy would be net-new. Recommended skeleton in **Section: Recommended Future Direction** below.

---

## SECTION 14 — PRODUCT MATURITY SCORECARD (0–100, justified)

| Dimension | Score | Justification |
|---|---|---|
| **Assessment** | **65** | Real end-to-end engine, multi-tier picker, honest scoring — but ~27 sessions, untested at scale |
| **Career Intelligence** | **55** | Deep ontology + real engines + role taxonomy, but operates on ~2 profiles; resolution capped by tag-level metadata |
| **Development Intelligence** | **45** | Intervention/recommendation libraries + PIL layers exist (read-only, disciplined) but thinly surfaced to users |
| **Mentoring** | **10** | Fake data, no booking, no supply |
| **Institution Platform** | **20** | Dashboards on mock data; tenants seeded; no real onboarding |
| **Analytics** | **20** | Mostly mock/"coming soon" panels |
| **Monetization** | **15** | Demo-mode payments only; no live subscriptions; gating defaults to free |
| **Scalability** | **40** | Modular, flag-gated, additive discipline (good); but `tsx`-only backend (no typecheck), monolith files, ~470-table sprawl, unproven at >4 users |

**Weighted reality:** Strong *engine*, weak *product*, absent *business*.

---

# FINAL OUTPUT

## 1. Executive Summary

MetryxOne is a **pre-launch behavioural-intelligence engine masquerading (in its schema) as a full platform.** Its CAPADEX core is genuinely world-class in depth and intellectual discipline: 30,638 clarity questions with 100%-joined metadata, a 4-tier signal ontology bottoming out at 15,972 atomic signals, a 142k-edge knowledge graph, and a strict culture of additive, flag-gated, provenance-stamped, never-fabricated engines. That is a rare and valuable asset.

Everything *around* the engine is early: **4 platform users, 12 CAPADEX users, 27 sessions, 39 reports, 2 career profiles, 6 demo payments.** Monetization cannot charge real money. Colleges don't exist as data. Mentors and courses are stubs. Institution and enterprise surfaces run on mock data atop a ~470-table schema that is 90%+ seed. The backend ships without type-checking.

The strategic question is not "what to build next" — it is **"will the team narrow from a sprawling everything-platform to the one thing it does uniquely well (CAPADEX behavioural intelligence) and put it in front of real users with a way to pay?"**

## 2. Product Architecture Map

```
┌─────────────────────────── FRONTEND (React+Vite :5000) ───────────────────────────┐
│ FreeAssessmentModal  PragatiWorkspace  CareerBuilderPage  ResumeStudio              │
│ SuperAdminDashboard (functional)  SchoolHealthDashboard (MOCK)  Analytics (STUB)    │
│ SubscriptionPricingPage (MOCK)  Mentors/Courses (STUB)                              │
└───────────────────────────────────┬────────────────────────────────────────────────┘
                              /api/* proxy
┌───────────────────────────────────┴──── BACKEND (Express+tsx :8080, no typecheck) ──┐
│ CAPADEX runtime (analyze→clarify→score→report)  ← REAL                               │
│ Engines: composites · patterns · interventions · explainability · PIL · KG  ← REAL  │
│ Career OS engines (deterministic re-shape)  ← REAL but data-starved                  │
│ Payments (Razorpay, DEMO default)  Tenants (seed)  ← THIN                            │
└───────────────────────────────────┬─────────────────────────────────────────────────┘
┌───────────────────────────────────┴──── POSTGRES (~470 tables) ─────────────────────┐
│ HEAVY: pil_kg_* (200k+) · clarity+metadata (61k) · cap-problem-behavior (30k) ...   │
│ LIGHT: users(4) · capadex_users(12) · sessions(27) · payments(6) · m3/m4/m5(1–10)   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Revenue Architecture Map

```
INDIVIDUAL      Free ─► Starter ─► Pro            UI built │ checkout MISSING │ gating→free
PARENT/FAMILY   plan + child seats                schema "aspirational" │ no flow
ONE-TIME        CAPADEX stage payment             Razorpay REAL CODE │ DEMO mode default
INSTITUTION     license                           "Contact Sales" form only
ENTERPRISE      workforce contract                vast schema, seed only, no flow
                                                  ─────────────────────────────
                                                  OPERATIONAL REVENUE TODAY: €0
```

## 4. User Journey Map

```
Student:   Land → Assess(REAL) → Report(REAL) → Intervene(PARTIAL) → Build career(PARTIAL) → Mentor(STUB ✗)
Parent:    Pricing page(MOCK) → ✗ no purchase → ✗ no dashboard
School:    Dashboard(MOCK data) → ✗ no onboarding → ✗ no real cohort
College:   ✗ nothing
Enterprise: Contact Sales form → ✗ no product
```

## 5. Capability Maturity Map

```
HIGH   ███████████  CAPADEX intelligence ontology & engines
MED-HI █████████    Assessment runtime · Career taxonomy · SuperAdmin
MED    ██████       Career Builder engines · Competency assessment · Reports
LOW-MED████         Interventions/recommendations surfacing · Passport
LOW    ██           Institution dashboards · Analytics · Monetization
NONE   ░            Mentorship · Courses · College library · Live billing
```

## 6. Top 25 Strategic Risks

1. No product-market fit signal (4 users).
2. No revenue mechanism that actually charges.
3. Founder/engineering effort spread across ~470 tables instead of the winning wedge.
4. CAPADEX depth may be over-engineered relative to what users will pay for.
5. Tag-level metadata caps runtime personalization (proven, not theoretical).
6. College/mentor/course gaps make the "platform" pitch non-credible to institutions.
7. Mock-data dashboards risk over-promising in sales demos (trust/legal risk).
8. Backend has no type/compile gate — silent production regressions.
9. No automated test gate on merges.
10. Monolith files concentrate change-risk and slow any new hire.
11. Dual flag systems → accidental exposure/hiding of features.
12. Identity-space inconsistencies (BIGINT/TEXT/UUID) → cross-module data bugs.
13. Content trapped in frontend/CSV → not queryable, not scalable.
14. Single email provider, no fallback → deliverability risk on OTP/reports.
15. Razorpay-only → limits non-India / enterprise procurement.
16. Knowledge-graph namespace fragility (`kg_*` vs `pil_kg_*`) — a wrong materialize wipes live data.
17. Heavy reliance on seed/synthetic benchmarks (`p4_benchmark_trends` 27k) presented as benchmarks.
18. No data-privacy/consent productization beyond schema (student minors = high stakes).
19. Scalability unproven; advisory-locked transactions untested under load.
20. Documentation (`replit.md`) sprawl → onboarding and accuracy risk.
21. Archetype layer ~59% "name-only" — insight quality ceiling.
22. Intervention library (140) too thin for concern breadth (2,489) → generic-feeling guidance risk.
23. No analytics → cannot measure funnel, retention, or value delivered.
24. Key-person/architecture risk: the discipline lives in memory files, not enforced in code.
25. Strategic ambiguity (student-consumer vs institution vs enterprise) dilutes execution.

## 7. Top 25 Growth Opportunities

1. **Productize CAPADEX as a standalone paid behavioural report** — the engine is ready; wire real Razorpay + a single clean paywall.
2. License the **intelligence layer/API** to existing career platforms (sell the moat, not the front-end).
3. Ship a **real, narrow institution pilot** (one school, real data) to replace mock dashboards.
4. Turn the 142k-edge KG into an **explainability/insight differentiator** in marketing.
5. Acquire/integrate a **college dataset** to unblock the college segment cheaply.
6. Move course/mentor content to **DB + partnerships** (or cut them honestly until real).
7. **Parent subscription** as the first recurring revenue (clear willingness-to-pay in India).
8. Counselor SaaS seat (caseload triage) — PIL counselor reports already exist.
9. Sell **anonymized cohort benchmarks** to institutions (once real data exists).
10. **Employability Passport** as a viral/shareable growth loop.
11. Enterprise workforce intelligence — but only after one real org validates it.
12. Re-derive metadata at **question granularity** to unlock real adaptive personalization.
13. Add a **lightweight LLM layer** for narrative reports on top of grounded data.
14. **Mobile/Expo** assessment app to lower friction for students.
15. WhatsApp/Pragati conversational funnel for Indian student acquisition.
16. White-label assessment for coaching institutes.
17. Government/NGO skilling grants (schema exists; needs one anchor program).
18. **Outcome attribution** as a retention story ("here's what changed").
19. Resume Studio as a free top-of-funnel acquisition magnet.
20. Recruiter/job marketplace fed by competency profiles.
21. Certification/verification of competencies (tables exist).
22. Developer API + docs to seed an ecosystem.
23. Cohort/community layer to add stickiness.
24. Data network effects: each assessment improves benchmarks (once n is real).
25. Sell the **methodology/IP** (the honesty-disciplined ontology) as consulting/standard.

## 8. Recommended Future Direction

**Narrow, then prove, then monetize, then expand.**

- **Phase 0 (0–3 mo) — Make ONE thing sellable.** Pick the **paid CAPADEX behavioural report** (student/parent). Wire real Razorpay (kill demo-default), one paywall, one feature gate that actually works. Add a TypeScript build gate to the backend. Add minimal funnel analytics. Goal: **first 100 paying reports.**
- **Phase 1 (3–9 mo) — Validate one institution.** Replace mock SchoolHealthDashboard with one real school's real data. Acquire a college dataset. Cut or clearly mark mentors/courses as "coming soon" (stop faking). Goal: **1 paying institution.**
- **Phase 2 (9–18 mo) — Deepen the moat that sells.** Re-derive question-level metadata; add narrative LLM reports; turn the KG into a visible explainability feature. Consolidate the ~470-table schema to what's used. Goal: **recurring revenue + retention proof.**
- **Phase 3 (18–36 mo) — Expand deliberately.** Counselor SaaS, parent subscriptions at scale, enterprise/workforce *only* after one real org validates it. License the intelligence API as a second revenue line.

**The single most important decision:** stop building breadth. The schema already describes a platform 50× larger than the data justifies. Every quarter spent adding modules (M3/M4/M5/WOS/GRO) instead of getting CAPADEX in front of paying users widens the gap between an impressive engine and a real business.

---

*End of dossier. All counts measured against the live database and codebase at time of writing; inferred/absent items are labelled as such.*
