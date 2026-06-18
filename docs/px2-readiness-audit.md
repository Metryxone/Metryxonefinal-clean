# P-X2 — CAPADEX + EI + LBI + Career Builder Integrated Readiness Audit
**Generated:** 2026-06-11 | **Evidence basis:** live DB row counts + source code + route registration

---

## 1. Executive Readiness Summary

The MetryxOne platform has outstanding **structural** depth — virtually every subsystem is built, registered, and wired. The critical problem is a single chain break that propagates downstream and prevents activation of the entire intelligent product stack:

> **The Competency Assessment → MEI (Employability Index) trigger is missing.**
> `p4_competency_history` has **8,986 rows** of real competency data. `mei_scores` has **0 rows**. MEI is fully built (5 services, 11 tables, routes registered) but never called after assessment completion. This single missing hook blocks MEI → LBI bridge, MEI → Career Builder, UCIP pipeline, and downstream benchmarking — cascading to ~40% of the platform sitting idle despite being structurally complete.

The identical pattern was the LBI gap (resolved today with `calculateAndPersistLBI` post-CAPADEX hook). The fix is the same class of change: one fire-and-forget post-completion trigger.

**Platform-wide weighted readiness estimate:**
| Axis | Score |
|------|-------|
| Structural | **88%** |
| Activation | **42%** |
| Data | **31%** |
| **Overall** | **54%** |

---

## 2. Product-by-Product Scorecard

Evidence key: DB rows in brackets `[n]`

| Product | Structural | Activation | Data | Overall | Primary Blocker |
|---------|-----------|-----------|------|---------|----------------|
| CAPADEX Core | 95% | 65% | 35% | **65%** | Data density (27 sessions, 3 completers) |
| Competency Assessment | 85% | 75% | 70% | **77%** | MEI bridge trigger missing |
| EI (MEI v2) | 90% | 5% | 0% | **32%** | Post-assessment trigger not wired |
| LBI | 80% | 15% | 10% | **35%** | Trigger now wired; System B/C empty |
| Career Builder | 75% | 30% | 20% | **42%** | EI chain broken; occupation graph empty |
| WCL Chain (L0–L5) | 90% | 50% | 40% | **60%** | UCIP trigger missing; trend density |
| RIE (Recommendations) | 85% | 80% | 75% | **80%** | Lifecycle tracking incomplete |
| Commercial | 85% | 15% | 5% | **35%** | No live Razorpay keys; 6 test payments |
| FRP | 90% | 60% | 30% | **60%** | Skill taxonomy sparse (27 rows) |
| LIP | 88% | 65% | 55% | **69%** | EI/competency integration pending |
| Admin Intelligence | 80% | 55% | 40% | **58%** | MEI/LBI panels show 0 data |

---

## 3. Audit by Dimension

### A. CAPADEX

**What is built:**
- Full 4-stage assessment engine (CAP_CUR / CAP_INS / CAP_GRW / CAP_MAS) ✅
- Concern engine — 3-tier picker (master curated → adaptive → static fallback) ✅
- Scoring engine — `computeNormScore`, `buildSessionScoreTrace`, `computeItemScore` ✅
- WC-3 chain — stage / outcome / journey / longitudinal / personalization all built, flag-gated ✅
- Decision orchestrator (`wc7b/decision-orchestrator.ts`) — built, gated by `FF_DECISION_ORCHESTRATOR` ✅
- Report factory — full template/section/narrative/benchmark system ✅
- Signal capture + behavior graph + intervention intelligence — wired in post-completion chain ✅
- Commercial layer — Razorpay, `requireEntitlement`, `capadex-payments.ts` ✅
- LBI post-completion trigger — wired today ✅

**Gaps:**
- Data density: 27 sessions, 9 completed, 3 unique completers — below k-min=30 for benchmarks
- `capadex_payments`: 6 rows (all test/demo — no live revenue)
- WC-3 flags: ON via workflow env; DB `feature_flags` table defaults OFF (different table, check both systems)
- `wc3_longitudinal_trends`: 0 rows (needs ≥2 sessions/user — only 3 completers exist)

**Data evidence:**
```
capadex_sessions total:    27
capadex_sessions completed: 9  (33% completion rate)
unique completers:          3
wc3_stage_state:            9
wc3_outcome_state:         14
wc3_journey_state:          9
wc3_longitudinal_snapshots: 9
wc3_longitudinal_trends:    0  ← needs ≥2 sessions per user
wcl0_user_intelligence:     9
wcl5_memory:               94
capadex_payments:           6  (test/demo only)
signal_grounding:      28,683  (92% bridge tag coverage — healthy)
```

---

### B. Competency Assessment

**What is built:**
- `competency_question_templates`: 63 templates ✅
- `p4_competency_history`: **8,986 rows** — most activated table in the system ✅
- Assessment scoring, persistence, and append-only history ✅
- `selectAssessmentQuestionsFromAPI` with static fallback ✅
- Competency recommendations (structural) ✅

**Gaps:**
- **MEI trigger not wired** — 8,986 history rows but 0 mei_scores. MEI v2 is never called after assessment.
- Competency does NOT contribute to EI in practice (only structurally)
- Benchmarks suppressed (k-min=30; only a handful of scoreable users)
- Forecasts depend on longitudinal which requires ≥2 assessment completions per user

**Data evidence:**
```
competency_question_templates: 63
p4_competency_history:      8,986  ← high activation
mei_scores:                     0  ← CRITICAL: trigger missing
```

---

### C. Employability Index (MEI v2)

**What is built:**
- Full hierarchical engine: `mei_dimensions`, `mei_subdimensions`, `mei_competencies` ✅
- `mei-scoring-engine.ts` — dynamic calibration with industry/role multipliers ✅
- `mei-narrative-engine.ts` — text explainability ✅
- `mei-recommendation-engine.ts` — impact-weighted action items ✅
- `mei-benchmark-engine.ts` — cohort percentile comparison ✅
- Routes: `GET /api/mei/score/:userId`, `/history`, `/benchmark`, `/recommendations` ✅ (registered at routes.ts:13189)
- Frontend: `MEIDashboard.tsx` — EIGauge, dimension bars, narrative, provenance ✅
- Longitudinal: `mei_score_history` table exists ✅

**CRITICAL GAP — 0 Activation:**
- `mei_scores`: **0 rows**
- `mei_score_history`: **0 rows**
- `mei_user_recommendations`: **0 rows**
- MEI is computed on-demand (`GET /api/mei/score/:userId`) but never auto-triggered after assessment
- 8,986 competency history rows could populate MEI immediately with one trigger
- Without MEI scores: benchmarks return empty, Career Builder EI gauge shows 0, UCIP can't build

**Fix is identical to LBI (resolved today):**
```typescript
// In competency assessment completion handler:
if (userId) computeAndPersistMEI(userId, pool).catch(console.error);
```

---

### D. Learning Behavior Index (LBI)

**Architecture — 3 systems confirmed:**

| System | Tables | Status Today |
|--------|--------|-------------|
| A — CAPADEX Engine | `lbi_scores` (3 rows), `lbi_score_history` (3 rows) | **LIVE** — trigger wired today |
| B — Psychometric Framework | `lbi_domains`, `lbi_questions`, `lbi_subdomains`, `lbi_age_bands`, `lbi_response_scales` (28 tables total) | **SCHEMA ONLY** — 0 rows, needs seed |
| C — Module Institute | `lbi_modules`, `lbi_sub_modules`, `lbi_sessions`, `lbi_question_bank` | **SCHEMA ONLY** — 0 rows |

**What is built:**
- System A fully live: `calculateAndPersistLBI` wired, 3 real scores (today) ✅
- Unified profile: `services/lbi-unifier.ts` + routes ✅ (today)
- 29 LBI tables schema-created (Systems B + C ready for data)
- Admin routes: history, profiles, analytics, signal-coverage ✅
- LBI backfill script: `backend/scripts/lbi-backfill.ts` ✅

**Gaps:**
- System B needs seed data: `lbi_domains` (19 declared), `lbi_questions`, `lbi_age_bands` (3 bands)
- System C needs real student/module usage
- `lbi_domain_scores` requires session-linked domain assessment (not yet wired for Career Builder users)
- MEI → LBI bridge: MEI competency signals should feed LBI System B dimension calibration (missing integration)

**Data evidence:**
```
lbi_scores:          3  (new today — System A)
lbi_score_history:   3  (new today)
lbi_domains:         0  (System B schema only)
lbi_questions:       0  (System B schema only)
lbi_modules:         0  (System C schema only)
```

---

### E. Career Builder

**What is built:**
- `CareerBuilderPage.tsx` — monolith with tabs: jobs, growth, learning, future-readiness, mentors, assessment ✅
- `useCareerBrain.ts` — aggregates profile/resume/competency/BIOS/CAPADEX/market ✅
- Resume Studio (`ResumeStudio.tsx`) ✅
- Career graph schema: 16 `cg_*` tables ✅
- Career memory: `routes/behavioural-memory.ts` (DB-backed) ✅
- Employability Passport: `routes/career-passport.ts` ✅
- FitmentInsightsPanel, career-behavior-adapter ✅
- LIP tab: `LearningIntelligenceTab.tsx` (1,079 lines) ✅
- FRP tab: `FutureReadinessTab.tsx` (879 lines) ✅

**Gaps:**
- `cg_occupation_nodes`: **0 rows** — career graph empty → no pathways, no role recommendations, no transition planning
- EI chain broken (mei_scores=0) → EI gauge in Career Builder shows no real score
- CAPADEX→Career Builder identity gap: CAPADEX is anonymous (guest email); Career Builder requires user account — no conversion flow
- `career_seeker_profiles`: sparse in dev (no real users submitted profiles)
- Career recommendations from MEI/LBI can't fire until scores exist

---

### F. Shared Intelligence Layers (WCL + UCIP)

**What is built:**
- WCL0 (`wcl0_user_intelligence`): 9 rows — active ✅
- WCL1 (trend intelligence): Requires ≥2 sessions/user — currently 0 trends ⚠️
- WCL2 (forecast): On-demand projection from WCL1 — functional but no trends to project ⚠️
- WCL4 (`wcl4_interventions`): 6 rows — low activation ⚠️
- WCL5 (`wcl5_memory`): **94 rows** — most active WCL layer ✅
- UCIP (`ucip_profiles`): **0 rows** — pipeline built but never triggered ❌
- RIE (`rie_recommendations`): **359 rows** — most activated intelligence layer in the system ✅

**UCIP gap:** `ucip-builder-pipeline.ts` exists and fuses EI+LBI+competency into unified profile — but it needs MEI scores to run. Fix: trigger UCIP build after MEI scoring.

**Data evidence:**
```
wcl0_user_intelligence:   9
wc3_longitudinal_trends:  0  (needs ≥2 sessions/user)
wcl4_interventions:       6
wcl5_memory:             94  ← strongest WCL layer
ucip_profiles:            0  ← pipeline not triggered
rie_recommendations:    359  ← most active layer
```

---

### G. Longitudinal Intelligence

- **Snapshots**: 9 rows in `wc3_longitudinal_snapshots` — working per-session ✅
- **Trends**: 0 rows in `wc3_longitudinal_trends` — requires ≥2 sessions per user; only 3 completers, none with multiple completions
- **Forecasts**: On-demand from trend data — blocked by 0 trends
- **MEI longitudinal**: `mei_score_history` exists but 0 rows (blocked by MEI trigger)
- **LBI longitudinal**: `lbi_score_history` — 3 rows (today, new)
- **Competency longitudinal**: `p4_competency_history` — 8,986 rows ← only working longitudinal chain

---

### H. Recommendation Intelligence (RIE)

- **Generation**: Active — 359 recommendations persisted ✅
- **Domains**: 7 (Learning, Behavioural, Emotional, Resilience, Employability, Leadership, Recovery) ✅
- **Persistence**: `rie_recommendations` ✅
- **Lifecycle stages present**: `active`, `completed`
- **Missing lifecycle**: `viewed`, `accepted`, `rejected` tracking not confirmed in `rie_recommendations` schema
- **Outcomes**: `rie_outcomes` table exists; score_before/after/delta/success — but requires MEI to provide scores

---

### I. Personalization

- `wc3_personalization_profile`: table exists; driven by persona + age_band + construct_key
- `wc3_personalization_decisions`: session-level decisions with provenance stamps
- **Gap**: personalization quality is limited by thin user pool (3 completers)
- Report personalization: `report-factory.ts` has 100+ rule-based insight evaluators ✅
- Recommendation personalization: RIE uses concern + stage + severity ✅

---

### J. Admin Intelligence

**Panels confirmed in `frontend/src/components/superadmin/`:**
- CAPADEX: CapadexAnalyticsPanel, CapadexReportsPanel, CapadexPricingPanel ✅
- EI: EIHealthPanel, MEIDesignPanel ✅ (but shows 0 data)
- LBI: LBIPanel ✅ (shows 0 data before today; 3 rows now)
- Career Builder: CareerGraphPanel, CareerPathsPanel ✅ (empty — no cg_occupation_nodes)
- Analytics: EnterpriseAnalyticsPanel, PlatformAuditLogPanel, CoverageDashboardPanel ✅
- AI Governance: 14 metrics written every 5 min ✅

**Gap**: Most "data panels" show empty states because activation chain is broken at MEI.

---

### K. Commercial Intelligence

**What is built:**
- Razorpay integration: full order creation, signature verification, webhooks ✅
- `requireEntitlement` middleware: checks `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT` → `capadex_payments` ✅
- Upsell engine: `services/wc7c/upsell-engine.ts` ✅
- Subscription packages: schema defined (`subscription_packages`) ✅
- Entitlement bridge: `services/entitlement-bridge.ts` (new today) ✅
- B2C pricing: ₹99 / ₹499 / ₹999 / ₹1,999 defined in `capadex-payments.ts` ✅

**Gaps:**
- `capadex_payments`: 6 rows — all test/demo, 0 real revenue
- No confirmed live Razorpay keys (demo mode fallback active)
- `subscription_packages`: catalog needs pricing, validity and feature assignment verification
- No LBI or MEI tied to commercial unlock — only CAPADEX stage progression is monetized
- Upsell triggers exist but require real paid user population to fire

**Data evidence:**
```
capadex_payments:       6  (test/demo)
paid payments:          0
subscription_packages:  ?  (query failed — verify manually)
```

---

### L. Future Readiness

**FRP (Future Readiness Platform):**
- `frp_skill_taxonomy`: 27 rows ⚠️ (sparse — needs 200+)
- `frp_ai_impact`: ~41 rows (skill × displacement/augmentation mapping)
- Routes `/api/frp/*` all built and flag-gated ✅
- `FutureReadinessTab.tsx` — 879 lines, fully implemented ✅
- FRI (Future Readiness Index) computation engine active ✅

**LIP (Learning Intelligence Platform):**
- `lip_courses`: 80 courses ✅
- `lip_mentors`: 15 mentors ✅
- Routes `/api/lip/*` all built and flag-gated ✅
- `LearningIntelligenceTab.tsx` — 1,079 lines ✅
- Gap: Personalized path generation needs EI/competency data (blocked by MEI trigger)

---

## 4. Top 25 Gap Register

### P0 — Critical (blocks chain)

| # | Gap | Impact | Effort | Dependency |
|---|-----|--------|--------|------------|
| 1 | **MEI post-assessment trigger missing** — 8,986 competency rows, 0 MEI scores | Blocks EI, UCIP, Career Builder, benchmarks | 0.5 day | None — identical to LBI fix |
| 2 | **UCIP pipeline not triggered** — 0 ucip_profiles despite full pipeline built | Blocks unified intelligence profile for all users | 0.5 day | Depends on P0-1 (needs MEI scores) |
| 3 | **cg_occupation_nodes: 0 rows** — career graph empty | Blocks all career pathways, transition planning, role recommendations | 2-3 days | O*NET/ESCO bulk import |
| 4 | **CAPADEX → Career Builder identity gap** — anonymous CAPADEX guests can't enter Career Builder flow | Breaks intended product funnel entirely | 1-2 days | User account creation at CAPADEX completion |

### P1 — High Impact

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 5 | **wc3_longitudinal_trends: 0 rows** — needs ≥2 sessions/user; only 3 completers exist | Blocks trend, forecast, progression intelligence | Data density problem |
| 6 | **No live Razorpay keys** — all 6 payments are test | 0% commercial activation | Owner decision |
| 7 | **MEI benchmarks empty** — requires k≥30 users with MEI scores | Benchmark panel permanently suppressed | Follows P0-1 fix + user growth |
| 8 | **LBI System B seed missing** — 29 schema tables, 0 rows for domains/questions/age-bands | LBI psychometric framework can't score | 1-2 days (seed 19 domains, 3 age bands) |
| 9 | **frp_skill_taxonomy: 27 rows** — Future Skills Planner needs 200+ skills | FRP coverage too sparse for meaningful guidance | 2 days (expand seed) |
| 10 | **MEI → LBI integration bridge missing** — MEI competency scores should calibrate LBI System B | LBI misses competency-derived learning signals | 1 day (after P0-1) |

### P2 — Medium Impact

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 11 | **RIE lifecycle incomplete** — `viewed`/`accepted`/`rejected` states not confirmed tracked | Recommendation quality cannot be measured | 1 day |
| 12 | **wc3_longitudinal_trends 0** creates WCL1/WCL2 dead zones | Trend + forecast intelligence unusable | Data problem; follow user growth |
| 13 | **wcl4_interventions: 6 rows** — intervention intelligence weakly activated | Personalised interventions not surfacing | Follows MEI trigger fix |
| 14 | **Career memory dual-store** — `behavioural-memory.ts` (DB) vs `career-memory.ts` (in-memory) reconciliation | Memory consistency risk | 0.5 day audit |
| 15 | **No competency → LBI direct bridge** — competency scores feed `p4_competency_history` but not `lbi_domain_scores` | LBI System C never learns from Career Builder assessments | 1 day |
| 16 | **LIP courses not personalized to EI gaps** — 80 courses exist but path binding needs MEI competency gaps | Learning paths not truly personalized | Follows P0-1 |
| 17 | **Admin MEI panel shows 0 data** — `MEIDesignPanel` built but empty | Ops team can't monitor EI health | Follows P0-1 |

### P3 — Required for 95%

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 18 | **frp_ai_impact: ~41 rows** — sparse AI displacement/augmentation coverage | FRP AI Impact panel shallow | 1-2 days seed expansion |
| 19 | **rie_outcomes tracking absent** — `score_before/after/delta/success` not populated | Can't prove recommendations improve outcomes | 1 day |
| 20 | **Career Builder FRP needs taxonomy depth** — `FutureReadinessTab` functional but shows thin data | User value low with 27 skills | Follows P1-9 |
| 21 | **Subscription catalog validation** — package → feature entitlement mapping needs live verification | Commercial pipeline leaks if catalog is wrong | 0.5 day |
| 22 | **Employability Passport contact field exclusion** — conformance: contact NEVER in published snapshot | Privacy compliance risk | 0.5 day code review |
| 23 | **AI Governance metrics need MEI/LBI** — 14 governance metrics written but don't include EI/LBI health | Governance dashboard blind to biggest gap | 1 day (after P0-1) |
| 24 | **CAPADEX OTP flow depends on ZOHO** — single email provider, no fallback | Single point of failure for user conversion | 0.5 day (add fallback) |
| 25 | **Career graph pathway engine untested at scale** — schema ready, 0 data, algorithms unvalidated | Career path recommendations unproven | 3-5 days (after P0-3) |

---

## 5. 95% Certification Matrix

| Product | Current | Gap to 95% | Key Unlockers |
|---------|---------|------------|---------------|
| CAPADEX Core | 65% | 30% | Data density (volume), WC-3 full activation in prod |
| Competency Assessment | 77% | 18% | MEI trigger (P0-1), benchmark density |
| EI (MEI v2) | 32% | 63% | **P0-1 trigger** + data volume + live Razorpay |
| LBI | 35% | 60% | System B seed, MEI bridge, user growth |
| Career Builder | 42% | 53% | EI chain (P0-1), occupation graph (P0-3), identity bridge (P0-4) |
| WCL / UCIP / RIE | 60% | 35% | UCIP trigger (P0-2), trend density |
| Commercial | 35% | 60% | Live Razorpay keys, catalog, entitlement activation |
| FRP | 60% | 35% | Taxonomy expansion (P1-9) |
| LIP | 69% | 26% | EI integration (after P0-1) |
| **Platform Weighted** | **54%** | **41%** | The P0 sprint below |

---

## 6. Integrated Roadmap

### Phase 1 — Highest ROI (Week 1–2, ~10 days total)

**Goal:** Wire the broken chain. Each item is a single engineer-day or less.

| Task | Effort | Expected Readiness Gain | Dependency |
|------|--------|------------------------|------------|
| P0-1: MEI post-assessment trigger | 0.5 day | EI: 32% → 70%; unlocks MEI, UCIP, Career Builder EI | None |
| P0-2: UCIP pipeline trigger (after MEI scores exist) | 0.5 day | UCIP: 0% → 80% | P0-1 |
| P0-4: CAPADEX → Career Builder identity bridge | 1-2 days | Career Builder funnel +30% | None |
| P0-3: cg_occupation_nodes seed (100 O*NET occupations) | 2-3 days | Career Builder: 42% → 60% | None |
| P1-8: LBI System B seed (19 domains + questions + 3 age bands) | 1-2 days | LBI: 35% → 55% | None |

**Phase 1 outcome:** Platform weighted readiness 54% → ~72%.

---

### Phase 2 — Intelligence Completion (Weeks 3–6)

| Task | Effort | Gain |
|------|--------|------|
| MEI → LBI bridge: feed competency scores into LBI System B calibration | 1 day | LBI: 55% → 70% |
| frp_skill_taxonomy expansion to 200+ skills | 2 days | FRP: 60% → 80% |
| RIE lifecycle tracking (viewed/accepted/rejected) | 1 day | RIE: 80% → 90% |
| rie_outcomes population (score deltas after recommendations actioned) | 1 day | RIE outcome intelligence |
| LBI System C: module seed for academic segment | 2 days | LBI System C activated |
| frp_ai_impact expansion to 200+ skills | 1-2 days | FRP AI Impact depth |
| Career memory reconciliation (DB vs in-memory) | 0.5 day | Memory consistency |
| LIP path personalization using MEI competency gaps | 1 day | LIP: 69% → 80% |

---

### Phase 3 — Product Completion (Weeks 5–10)

| Task | Effort | Gain |
|------|--------|------|
| Career graph occupation seed (O*NET 1,000+ nodes, edges) | 3-5 days | Career Builder: 60% → 80% |
| UCIP-driven personalised recommendation surface in Career Builder | 2-3 days | Career Builder intelligence |
| MEI benchmark population (requires real user growth) | Ongoing | EI benchmarks: 0% → active |
| Longitudinal WCL1 trends (requires ≥2 sessions per user — scale) | Ongoing | WCL1 activated at scale |
| Admin MEI + LBI health dashboards (now MEI scores exist) | 1-2 days | Admin visibility |
| AI Governance MEI/LBI metrics addition | 1 day | Governance completeness |
| Subscription catalog live verification | 0.5 day | Commercial accuracy |
| CAPADEX OTP fallback email provider | 0.5 day | Resilience |

---

### Phase 4 — Commercial Completion (Weeks 8–14)

| Task | Effort | Gain |
|------|--------|------|
| Razorpay live keys activation (owner decision) | 0.5 day | Commercial: 35% → 70% |
| Entitlement enforcement full activation (`FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT=1`) | 0.5 day | Enforcement live |
| LBI / MEI commercial unlock (subscription → feature tier) | 2 days | LBI/EI monetized |
| Upsell trigger population (requires paid user population) | Follows revenue | Upsell intelligence |
| Commercial analytics (LTV/conversion/churn) | 2-3 days | Commercial: → 80% |

---

### Phase 5 — Future Readiness (Weeks 12–20)

| Task | Effort | Gain |
|------|--------|------|
| FRP skill taxonomy to 500+ skills + AI impact rows | 3-4 days | FRP: 80% → 92% |
| LIP intelligent path generation (MEI gap-driven) | 2-3 days | LIP: 80% → 90% |
| AI Career Navigator (CAPADEX + EI + LBI integrated guidance) | 5-7 days | New product |
| Career Transition Planner (cg_* graph + MEI + market signals) | 4-5 days | New product |
| Entrepreneurship Intelligence module | 3-4 days | Future readiness |
| Emerging Career Intelligence (market signal integration) | 3-5 days | Market intelligence |

---

## 7. Recommended Next Implementation Sprint

### Sprint: "Chain Activation" — 5 Days

This single sprint moves the platform from 54% to ~72% weighted readiness by resolving all 4 P0 gaps.

**Day 1 — MEI trigger (morning) + UCIP trigger (afternoon)**
- Wire `computeAndPersistMEI(userId, pool)` as fire-and-forget hook in the Career Builder competency assessment completion handler (mirrors the LBI fix exactly)
- Wire UCIP pipeline trigger after MEI scores are written
- Run MEI + UCIP backfill for all users with competency history
- **Unlocks:** EI chain, UCIP profiles, Career Builder EI gauge, admin MEI panel

**Day 2 — CAPADEX → Career Builder identity bridge**
- On CAPADEX session completion, if `guest_email` has no user account: create lightweight account or link to Career Builder onboarding
- Pass `session_id` into Career Builder profile creation so CAPADEX behavioral data seeds the profile
- **Unlocks:** The intended CAPADEX → Career Builder product funnel

**Days 3–5 — cg_occupation_nodes seed**
- Import 100–200 occupation nodes from O*NET open data (software engineers, product managers, etc.)
- Seed `cg_occupation_edges` (career transition relationships)
- Wire `cg_skill_requirements` for the top 50 roles
- **Unlocks:** Career Builder pathways, role fit, transition planning, Career Graph admin panel

**Sprint output (measurable):**
```
MEI scores:           0 → populated (all users with competency history)
UCIP profiles:        0 → populated
cg_occupation_nodes:  0 → 100–200
Career Builder EI:  dark → live score shown
Platform readiness:  54% → ~72%
Admin panels:        empty → data visible
```

---

## Final Answer: Highest ROI Sprint

Based on actual implementation evidence only:

> **The single highest ROI sprint is: wire the MEI post-assessment trigger (0.5 day) + UCIP pipeline trigger (0.5 day) + seed cg_occupation_nodes (3 days) + CAPADEX identity bridge (1 day).**

This 5-day sprint resolves all 4 P0 chain breaks simultaneously. It is exactly the same class of engineering work already proven today with the LBI trigger — additive, fire-and-forget, non-breaking, with immediate measurable output. It unlocks the entire CAPADEX → Competency → EI → LBI → Career Builder intelligent chain and turns on the admin visibility that makes everything else monitorable and improvable.

**STOP FOR APPROVAL.**

---

*Audit methodology: All findings derived from live DB row counts, route registration verification (routes.ts), service file existence checks, and table schema inspection. No prior audit percentages were used as ground truth.*
