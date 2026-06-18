# MetryxOne — CTO Implementation Roadmap
## 12–18 Month Plan · Phases 1–6
**Version:** 1.0 · **Date:** June 2026 · **Author:** CTO Office

---

## Executive Summary

MetryxOne is a Behavioural Intelligence SaaS platform at ~65% structural completeness. The core CAPADEX assessment engine, Career Builder, Employability Index, and AI Governance are production-grade. The gaps are Learning Intelligence (no module), Future Readiness (content absent, back-half pipeline ready), Talent Passport (snapshots only — not portable credentials), and commercial activation (payment entitlement bridge missing). This roadmap closes all gaps in 6 sequential phases across 18 months, delivering a fully integrated platform with B2C revenue and enterprise analytics by Month 18.

---

## Platform Baseline (June 2026)

| Module | Structural | Data / Activation | Blocker |
|---|---|---|---|
| CAPADEX Assessment (Ontology + Flow) | ✅ 100% | ✅ 85% | — |
| PIL (Problem Intelligence Layer) | ✅ 100% | ⚠️ 40% | Curated content sparse |
| Career Builder + Career OS | ✅ 90% | ⚠️ 50% | Job market integration missing |
| Employability Index (8-dim) | ✅ 95% | ⚠️ 55% | No real peer cohort (k < 30) |
| Employability Passport | ✅ 70% | ❌ 15% | Snapshot only, not portable |
| LBI Framework | ⚠️ 60% | ❌ 5% | 3 disconnected subsystems, no data |
| WC-3 Intelligence Chain | ✅ 80% | ❌ 10% | Most flags disabled, outcome chain untested |
| Learning Intelligence | ❌ 15% | ❌ 0% | Routes exist, no module |
| Future Readiness | ⚠️ 50% | ❌ 0% | Back-half content absent |
| Talent Passport | ⚠️ 30% | ❌ 0% | JSONB snapshot, no portability |
| AI Governance | ✅ 100% | ✅ 90% | No API key in prod yet |
| Commercial Activation | ⚠️ 40% | ❌ 0% | Entitlement bridge missing, 0 paid users |

---

## Dependency Graph (Critical Path)

```
Phase 1 (Ontology + Assessment)
    └─► Phase 2 (Employability + Career Builder)   ← Parallel after Month 2
    └─► Phase 3 (Learning Intelligence)             ← Starts Month 5
             └─► Phase 4 (Future Readiness)         ← Starts Month 9
                      └─► Phase 5 (Talent Passport) ← Starts Month 11
                               └─► Phase 6 (AI Intelligence) ← Starts Month 13
```

Phase 2 and Phase 3 share the assessment data substrate from Phase 1.
Phase 4 requires the learning gap data from Phase 3.
Phase 5 aggregates all prior phases into a portable credential.
Phase 6 runs as a capability layer that enhances all phases continuously.

---

## Phase 1 — Ontology + Assessment
**Months 1–4 · Foundation · Revenue Unlock: CAPADEX B2C**

### Objective
Harden the assessment engine to production quality: consolidate the three LBI subsystems into one coherent framework, complete the CAPADEX WC-3 intelligence chain, activate commercial SKUs, and bring the assessment ontology (concerns → signals → constructs) to ≥85% coverage.

---

### 1.1 Modules

| Module | Description | Priority |
|---|---|---|
| **LBI Unification** | Merge 3 disconnected LBI systems (CAPADEX-engine, psych-framework, module-institute) into one scored output | P0 |
| **WC-3 Chain Activation** | Enable all 5 WC-3 flags (stage/outcome/journey/longitudinal/personalization) in sequence | P0 |
| **Signal Coverage Uplift** | Move from 25/328 bridge tags with signals → ≥200/328 via re-labelling existing families | P0 |
| **Competency Assessment Integration** | Wire competency questions into CAPADEX result → Career Builder handoff | P1 |
| **Commercial SKU Activation** | Complete payment entitlement bridge (Razorpay + subscription provisioning) | P0 |
| **Concern Resolver Hardening** | Promote IDF-weighted match to primary rank, retire GENERAL_CONCERN catch-all | P1 |
| **Assessment Analytics** | Admin dashboard: completion rates, funnel drop-off, question-level stats | P2 |

---

### 1.2 Dependencies

- **Identity Bridge** (blocks Commercial SKU): `users` table needs `email` column; child-keyed student subscriptions require a migration adding `users.email` + `student_subscriptions.user_id` FK. This is the single hardest dependency — it must ship in Sprint 1 or blocks all commercial work.
- **WC-3 Stage** must activate before Outcome (Outcome reads stage from L1; if L1 absent, Outcome returns UNCLASSIFIED).
- **Signal re-labelling** (1B) must precede WC-3 Outcome crosswalk or reachability ceiling stays at 7.6%.
- **Razorpay smoke test** + MFA e2e must clear before `FF_COMMERCIAL_ACTIVATION=1` goes live (per WC-C8A security audit).

---

### 1.3 Database Requirements

| Migration | Tables Affected | Notes |
|---|---|---|
| `M1-01` Add `users.email`, `users.phone` columns | `users` | Required for entitlement bridge |
| `M1-02` Add `student_subscriptions.user_id` FK | `student_subscriptions` | Links payment → user identity |
| `M1-03` Consolidate LBI subsystems | `lbi_sessions`, `lbi_scores`, `lbi_report_types` | Drop stale admin-only tables |
| `M1-04` Signal reachability index | `capadex_signal_coverage` (new) | Bridge tag → signal family → construct mapping; read-only cache |
| `M1-05` WC-3 state capture | `behavioural_hypotheses`, `capadex_session_patterns`, `wc3_stage_snapshots` | Ensure columns: `construct_key`, `primary_construct_key` |
| `M1-06` Payment ledger | `capadex_payments` (already exists, add `user_id`, `entitlement_granted_at`) | Closes the `paid → provisioned` loop |

---

### 1.4 Backend Services

| Service | File | Responsibility |
|---|---|---|
| **LBI Unifier** | `services/lbi-unifier.ts` | Aggregates psychometric scores from the 3 subsystems into a single `lbi_composite_score` object; additive + read-only |
| **Signal Linker** | `services/signal-linker.ts` | Re-links 370 existing atomic families to their correct bridge tags; dry-run + apply pattern; writes provenance rows |
| **Entitlement Bridge** | `services/entitlement-bridge.ts` | `email → users.id → student_subscriptions → active_features[]`; replaces the current UUID-only bearer token model |
| **WC-3 Activation** | `services/wc3-chain-activator.ts` | Enables flags sequentially; runs stage → outcome → journey → longitudinal backfill on existing sessions |
| **Assessment Funnel Tracker** | `services/assessment-funnel.ts` | Writes drop-off events to `capadex_funnel_events`; powers the analytics dashboard |

---

### 1.5 Frontend Screens

| Screen | Component | Scope |
|---|---|---|
| **Checkout Flow** | `CheckoutModal.tsx` | Razorpay payment widget; stage selection → payment → OTP → provisioned report |
| **Entitlement Gate** | `EntitlementGate.tsx` | Wraps paid routes; shows upgrade prompt on 402 response |
| **LBI Unified Report** | `LBIUnifiedReport.tsx` | Replaces the 3 separate LBI views with one consolidated behavioural profile |
| **Assessment Analytics** | `superadmin/AssessmentAnalyticsPanel.tsx` | Funnel chart, completion rates, question-level drop-off heatmap |
| **WC-3 Stage Banner** | Inject into `CapadexReportPhase.tsx` | Stage badge (Curiosity/Growth/Insight/Mastery) + next-stage CTA |

---

### 1.6 API Requirements

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/capadex/checkout/initiate` | POST | Create Razorpay order; returns `order_id`, `amount`, `stage_code` |
| `/api/capadex/checkout/verify` | POST | Verify Razorpay signature; write `capadex_payments`; provision entitlement |
| `/api/capadex/entitlement/:session_id` | GET | Returns `{ stage, features, expires_at }` for gating UI |
| `/api/lbi/unified-report/:user_id` | GET | Consolidated LBI composite + sub-scores |
| `/api/admin/assessment-analytics` | GET | Funnel metrics, completion rates (60s cache) |
| `/api/signals/relink` | POST (superadmin) | Trigger signal re-labelling dry-run or apply |

---

### 1.7 Testing Strategy

| Level | Method | Target |
|---|---|---|
| **Unit** | Jest on pure engines (signal linker, entitlement resolver) | 90% line coverage on new services |
| **Integration** | Razorpay sandbox e2e: initiate → pay → verify → 200/402 response | Payment flow must clear before prod flag-on |
| **Regression** | Run CAPADEX simulation harness (Phase 0C) against WC-3 active flags | Harness is allowed to fail — treat RED as honest gap, not blocker |
| **Load** | k6: 100 concurrent CAPADEX sessions, measure p95 < 800ms | `/api/capadex/analyze` is the hottest route |
| **Security** | Re-run WC-C8A checklist: MFA verify scrypt, 402 fail-closed, no route enumeration | Mandatory gate before `FF_COMMERCIAL_ACTIVATION=1` |

---

### 1.8 Deployment Strategy

```
Sprint 1 (Wks 1–2): M1-01 + M1-02 migrations → staging only
Sprint 2 (Wks 3–4): LBI Unifier + Signal Linker (additive, flag-off)
Sprint 3 (Wks 5–6): WC-3 Stage + Outcome activation (staging)
Sprint 4 (Wks 7–8): Razorpay integration + entitlement bridge (staging sandbox)
Sprint 5 (Wks 9–10): Security gate → Razorpay prod → FF_COMMERCIAL_ACTIVATION=1
Sprint 6 (Wks 11–12): WC-3 full chain (journey/longitudinal/personalization)
→ Phase 1 cutover: no feature flag rollback needed (all additive)
→ Prod DB migrations: run with zero-downtime ALTER (ADD COLUMN DEFAULT NULL)
```

---

### 1.9 Success Metrics

| Metric | Baseline | Target (Month 4) |
|---|---|---|
| Signal bridge tag coverage | 7.6% (25/328) | ≥ 60% (200/328) |
| WC-3 outcome reachability | ~0% (flags off) | ≥ 75% of sessions |
| CAPADEX paid conversions (B2C) | 0 | ≥ 50 paying users |
| Assessment completion rate | Unknown | ≥ 65% intro → result |
| LBI report generation success | < 10% (fabricated) | ≥ 80% grounded |
| p95 response time `/api/capadex/analyze` | ~2s | < 800ms |

---

### 1.10 Resource Estimates

| Role | Allocation | Duration |
|---|---|---|
| Senior Backend Engineer (assessment + LBI) | 1.0 FTE | 4 months |
| Backend Engineer (payments + entitlement) | 0.5 FTE | 6 weeks |
| Frontend Engineer | 0.5 FTE | 3 months |
| QA Engineer | 0.5 FTE | 4 months |
| **Total engineering effort** | **~7.5 person-months** | |

---

---

## Phase 2 — Employability + Career Builder
**Months 3–7 · Growth Engine · Revenue Unlock: B2B Enterprise**

### Objective
Complete the Career OS orchestration layer, achieve real peer benchmarking (k ≥ 30), integrate live job market data (O*NET/ESCO), activate the Fitment Panel with real signals, and launch the first B2B enterprise dashboard for institutional clients.

---

### 2.1 Modules

| Module | Description | Priority |
|---|---|---|
| **Peer Benchmarking Engine** | Activate k-anonymity cohort comparison once k ≥ 30; suppress until then with honest messaging | P0 |
| **Job Market Integration** | O*NET/ESCO bulk import → `occupation_skills`, `occupation_exposure` seed; real Fitment Panel | P0 |
| **Career OS Full Wiring** | Thread full context (profile/openJobs/eiScore/behavioural) into all 6 Career OS tabs | P0 |
| **Resume Studio — AI Enhancement** | AI-powered resume bullet rewriting using CAPADEX behavioural signals + governance wrapper | P1 |
| **Enterprise Analytics Dashboard** | B2B cohort view: completion rates, EI distribution, top concerns, skill gap heatmap | P0 |
| **Mentor Matching** | Wire real mentors from `mentor_profiles` into WC-6 decision destinations (currently universal fallback) | P1 |
| **Job Tracker** | Kanban board for applications; `career_job_applications` events feed behaviour graph | P2 |

---

### 2.2 Dependencies

- **Phase 1 completion** (CAPADEX behavioural signals) before Career OS full wiring (Career OS reads CAPADEX session via `career-behavior-adapter.ts`).
- **k ≥ 30 real users** before peer benchmarks show (can fake with synthetic cohort in staging only).
- **O*NET bulk import** before Fitment Panel activation — manual seed covers only ~50 occupations; W9 targets need 900+.
- **Enterprise client onboarding** (minimum 1 institution with 30+ users) before B2B dashboard is meaningful.

---

### 2.3 Database Requirements

| Migration | Tables Affected | Notes |
|---|---|---|
| `M2-01` Occupation bulk load | `cg_occupations`, `cg_occupation_skills` | O*NET 29.0 CSV → 1,110 occupations, 35k+ skill links |
| `M2-02` Peer cohort materialization | `ei_peer_cohorts` (new) | Aggregate `career_seeker_profiles` by cohort keys; k-anonymity enforced at write |
| `M2-03` Mentor profiles | `mentor_profiles` (upgrade) | Add `specialisations[]`, `availability_slots`, `booking_url`; remove stub rows |
| `M2-04` Job applications tracker | `career_job_applications` (new) | `user_id, job_id, status, applied_at, notes, source` |
| `M2-05` Enterprise client schema | `enterprise_clients`, `enterprise_users`, `enterprise_reports` | B2B multi-tenancy foundation |
| `M2-06` Resume versions | `career_resume_versions` (add `ai_enhanced_at`, `enhancement_score`) | Tracks AI-assisted improvements |

---

### 2.4 Backend Services

| Service | File | Responsibility |
|---|---|---|
| **O*NET Importer** | `scripts/import-onet.ts` | One-time bulk import; idempotent ON CONFLICT DO NOTHING; seeds 1,110 occupations |
| **Peer Cohort Builder** | `services/peer-cohort-builder.ts` | Nightly materialization of `ei_peer_cohorts`; enforces k ≥ 30 before writing |
| **Career OS Orchestrator** | `services/career-os-full.ts` | Full context assembly: profile + 3 EI dimensions + CAPADEX session + open jobs; feeds all 6 tabs |
| **Resume AI Enhancer** | `services/resume-enhancer.ts` | Uses AI Governance prompt `resume_enhancement_v1`; returns tracked rewrites with behaviour anchors |
| **Enterprise Report Generator** | `services/enterprise-report.ts` | Aggregates cohort signals → PDF/CSV export via `FF_ENTERPRISE_ANALYTICS` |
| **Mentor Recommender** | `services/mentor-recommender.ts` | Scores mentors against CAPADEX construct profile; top-3 with rationale |

---

### 2.5 Frontend Screens

| Screen | Component | Scope |
|---|---|---|
| **Fitment Panel (live)** | `FitmentInsightsPanel.tsx` (upgrade) | Replace `Provisional` flag with real signal scores once O*NET imported |
| **Peer Benchmark Card** | `PeerBenchmarkCard.tsx` | Cohort comparison charts; suppressed with `k < 30` message |
| **Job Tracker Tab** | `JobTrackerTab.tsx` in Career Builder | Kanban board: Applied → Interview → Offer → Rejected |
| **Enterprise Dashboard** | `EnterpriseAnalyticsDashboard.tsx` | Cohort EI heatmap, skill gap radar, completion funnel (admin-gated) |
| **Mentor Match UI** | `MentorMatchPanel.tsx` | Top-3 mentor cards with match rationale; booking CTA |
| **Resume AI Enhance** | `ResumeStudio.tsx` (upgrade) | "Enhance with AI" button per bullet; shows before/after + behavioural anchor |

---

### 2.6 API Requirements

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/career/peer-benchmark/:user_id` | GET | Returns cohort percentiles; 404 if k < 30 |
| `/api/career/fitment/:user_id/scores` | GET | Real O*NET-grounded fitment scores per saved job |
| `/api/career/resume/enhance` | POST | AI-enhanced bullet suggestions with governance wrapper |
| `/api/career/job-applications` | GET/POST/PUT | Job tracker CRUD |
| `/api/enterprise/dashboard` | GET | B2B cohort metrics (requireEnterpriseAdmin guard) |
| `/api/enterprise/export.csv` | GET | Cohort export with k-anonymity enforcement |
| `/api/mentors/recommend/:user_id` | GET | Top-3 mentor matches with scores |

---

### 2.7 Testing Strategy

| Level | Method | Target |
|---|---|---|
| **Unit** | Pure engine tests: peer cohort k-threshold, mentor scoring | k < 30 must never return data |
| **Integration** | Career OS tab: assert each tab receives full context object | Silent context gaps are the #1 Career OS bug class |
| **Data quality** | O*NET import validator: assert ≥ 1,000 occupations, ≥ 30,000 skill links, no orphan skills | Run before seed commit |
| **Enterprise** | Multi-tenant isolation: user A cannot see user B's data across enterprise boundaries | Security-critical |
| **Load** | Enterprise dashboard: 500 concurrent queries against aggregated cohort tables | Target: p95 < 2s with index tuning |

---

### 2.8 Deployment Strategy

```
Sprint 7  (Wks 13–14): O*NET bulk import (staging) + peer cohort schema
Sprint 8  (Wks 15–16): Career OS full wiring + mentor recommender
Sprint 9  (Wks 17–18): Enterprise schema + B2B dashboard (behind FF_ENTERPRISE_ANALYTICS)
Sprint 10 (Wks 19–20): Peer benchmarks live (k ≥ 30 gate) + Fitment Panel upgrade
Sprint 11 (Wks 21–22): Resume AI + job tracker
Sprint 12 (Wks 23–24): Enterprise client onboarding + first B2B invoice
→ Feature flags: FF_ENTERPRISE_ANALYTICS, FF_PEER_BENCHMARKING (new)
→ DB migrations: O*NET import runs as seed script (not ALTER), zero downtime
```

---

### 2.9 Success Metrics

| Metric | Baseline | Target (Month 7) |
|---|---|---|
| O*NET occupation coverage | ~50 manual | ≥ 1,000 |
| Users with peer benchmark data | 0 | ≥ 500 (requires k ≥ 30 per cohort) |
| Fitment Panel `Provisional` rate | 100% | < 20% |
| Enterprise clients onboarded | 0 | ≥ 3 institutions |
| B2B MRR | ₹0 | ≥ ₹1,50,000/month |
| Career OS full-context tab load rate | ~30% (context gaps) | ≥ 90% |

---

### 2.10 Resource Estimates

| Role | Allocation | Duration |
|---|---|---|
| Senior Backend Engineer (Career OS + O*NET) | 1.0 FTE | 5 months |
| Data Engineer (O*NET import + cohort builder) | 0.5 FTE | 6 weeks |
| Frontend Engineer | 0.75 FTE | 4 months |
| Enterprise Sales / Customer Success | 1.0 FTE | Ongoing |
| **Total engineering effort** | **~10 person-months** | |

---

---

## Phase 3 — Learning Intelligence
**Months 5–9 · New Module · Revenue Unlock: Learning Subscriptions**

### Objective
Build the Learning Intelligence module from scratch: a personalised micro-learning engine that converts CAPADEX behavioural gaps and Career OS competency deficits into structured learning paths, tracks skill acquisition over time, and integrates with external course providers.

---

### 3.1 Modules

| Module | Description | Priority |
|---|---|---|
| **Learning Gap Engine** | Derives learning priorities from CAPADEX constructs + EI dimension gaps | P0 |
| **Learning Path Builder** | Generates ordered skill sequences with milestones; keyed by occupation target | P0 |
| **Course Catalog Integration** | Integration with Coursera/NPTEL/LinkedIn Learning APIs; curated fallback catalog | P0 |
| **Micro-Learning Cards** | Short (5–10 min) behavioural habit prompts derived from intervention_library | P1 |
| **Progress Tracking** | Skill acquisition events feed back into Career OS and EI re-scoring | P1 |
| **Adaptive Difficulty** | Path adjusts based on assessment performance and self-reported progress | P2 |
| **Learning Analytics** | Admin: course engagement, completion rates, skill velocity per cohort | P2 |

---

### 3.2 Dependencies

- **Phase 1** complete: learning gaps derived from CAPADEX construct profile (needs WC-3 chain active).
- **Phase 2** O*NET import: learning paths keyed to occupation skill gaps.
- **`intervention_library`** content: micro-learning cards reuse existing behaviour/skill statements — no new content authoring needed for v1.
- **External API keys**: Coursera/NPTEL require institutional agreements; v1 ships with a curated static catalog (200 courses) as fallback.

---

### 3.3 Database Requirements

| Migration | Tables Affected | Notes |
|---|---|---|
| `M3-01` Learning paths | `li_learning_paths`, `li_path_steps` (new) | `path_id, user_id, occupation_target, steps[], status, created_at` |
| `M3-02` Course catalog | `li_courses` (new) | `course_id, title, provider, skill_tags[], duration_min, difficulty, url` |
| `M3-03` Enrollment + progress | `li_enrollments`, `li_progress_events` (new) | Append-only progress history; feeds EI re-scoring |
| `M3-04` Micro-learning cards | `li_micro_cards` (new) | References `intervention_library.id`; adds `delivery_schedule`, `completion_count` |
| `M3-05` Learning gap cache | `li_gap_snapshots` (new) | UPSERT per user; `construct_key → gap_score → recommended_path_id` |
| `M3-06` Skill acquisition events | `li_skill_events` (new) | Feeds back into `career_seeker_profiles.data.skills`; append-only |

---

### 3.4 Backend Services

| Service | File | Responsibility |
|---|---|---|
| **Learning Gap Resolver** | `services/learning-gap-resolver.ts` | Reads CAPADEX construct profile + EI gaps → ranked list of learning priorities |
| **Path Builder** | `services/learning-path-builder.ts` | Maps gap priorities → ordered course sequence using O*NET skill taxonomy |
| **Course Recommender** | `services/course-recommender.ts` | Semantic match: learning gap construct → course `skill_tags[]`; top-5 per step |
| **Progress Ingester** | `services/learning-progress.ts` | Writes `li_progress_events`; triggers EI re-score if milestone reached |
| **Micro-card Scheduler** | `services/micro-card-scheduler.ts` | Queues daily habit prompts from `intervention_library`; delivery via push or email |
| **Learning Analytics** | `services/learning-analytics.ts` | Cohort-level aggregations for enterprise dashboard |

---

### 3.5 Frontend Screens

| Screen | Component | Scope |
|---|---|---|
| **Learning Path Dashboard** | `LearningPathDashboard.tsx` | Current path + progress rings + next milestone CTA |
| **Course Browser** | `CourseBrowser.tsx` | Filterable catalog; recommended courses highlighted |
| **Skill Acquisition Timeline** | `SkillTimeline.tsx` | Visual history of completed skills + EI impact |
| **Micro-Learning Feed** | `MicroLearningFeed.tsx` | Daily habit cards with check-in + streak counter |
| **Learning Tab in Career Builder** | Inject into `CareerBuilderPage.tsx` | New `learning` tab (additive; does not touch existing tabs) |
| **Enterprise Learning Analytics** | Extend `EnterpriseAnalyticsDashboard.tsx` | Course engagement, skill velocity by cohort |

---

### 3.6 API Requirements

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/learning/gaps/:user_id` | GET | Returns ranked learning priorities from CAPADEX + EI |
| `/api/learning/paths/:user_id` | GET / POST | Get or generate a personalised learning path |
| `/api/learning/paths/:id/steps` | GET | Ordered step list with course recommendations |
| `/api/learning/courses` | GET | Paginated catalog with `?skill=&difficulty=&provider=` filters |
| `/api/learning/progress` | POST | Record a progress event (course completion, milestone, self-report) |
| `/api/learning/micro-cards/today` | GET | Today's micro-learning cards for the authenticated user |
| `/api/learning/analytics` | GET | Cohort learning metrics (enterprise-gated) |

---

### 3.7 Testing Strategy

| Level | Method | Target |
|---|---|---|
| **Unit** | Gap resolver: assert priority order matches construct deficit magnitude | Precision > 0.80 on synthetic profiles |
| **Content quality** | Audit 200 static courses: assert ≥ 3 skill tags per course, no dead URLs | Run as CI check |
| **Progress loop** | Integration: complete a skill → assert EI re-score fires within 24h | End-to-end test on staging |
| **Recommendation quality** | A/B: path-following users vs control; measure EI score delta at 60 days | Manual analysis post-launch |
| **Enterprise** | Multi-tenant: user in institution A cannot see institution B's learning data | Security-critical |

---

### 3.8 Deployment Strategy

```
Sprint 13 (Wks 25–26): DB schema (M3-01 → M3-03) + gap resolver
Sprint 14 (Wks 27–28): Path builder + static course catalog (200 courses)
Sprint 15 (Wks 29–30): Frontend — Learning Path Dashboard + Course Browser
Sprint 16 (Wks 31–32): Progress tracking + EI feedback loop
Sprint 17 (Wks 33–34): Micro-learning cards + scheduler
Sprint 18 (Wks 35–36): External API integration (Coursera/NPTEL) + analytics
→ Feature flag: FF_LEARNING_INTELLIGENCE (new)
→ New `learning` tab in Career Builder: additive, behind flag
```

---

### 3.9 Success Metrics

| Metric | Baseline | Target (Month 9) |
|---|---|---|
| Users with active learning path | 0 | ≥ 200 |
| Course catalog size | 0 | ≥ 200 static + live API access |
| EI score improvement (learning cohort vs control) | — | +8–12 points at 60 days |
| Micro-card daily active rate | 0% | ≥ 25% |
| Learning subscription MRR | ₹0 | ≥ ₹50,000/month |
| Path completion rate (30-day) | — | ≥ 30% |

---

### 3.10 Resource Estimates

| Role | Allocation | Duration |
|---|---|---|
| Backend Engineer (gap engine + path builder) | 1.0 FTE | 5 months |
| Content Specialist (course curation + micro-cards) | 0.5 FTE | 4 months |
| Frontend Engineer | 0.75 FTE | 4 months |
| Data Scientist (recommendation quality + A/B) | 0.25 FTE | Ongoing |
| **Total engineering effort** | **~9.5 person-months** | |

---

---

## Phase 4 — Future Readiness
**Months 9–13 · Intelligence Layer · Revenue Unlock: Premium Reports**

### Objective
Activate the Future Readiness module: deliver an AI exposure score per occupation, a reskilling pathway (reskill vs upskill decision), outcome projections by career timeline, and a "Future of Work" personalised report. The back-half pipeline (outcome models, journeys, reskilling seed rows) already exists in the DB — this phase is primarily content activation and front-end delivery.

---

### 4.1 Modules

| Module | Description | Priority |
|---|---|---|
| **AI Exposure Scoring** | Occupation-level AI displacement risk + augmentation opportunity score (O*NET + WEF taxonomy) | P0 |
| **Reskill/Upskill Recommender** | Binary decision engine: reskill (new domain) vs upskill (same domain); feeds Learning Intelligence paths | P0 |
| **Outcome Projection Engine** | WC-9 activation: career timeline projections keyed by construct + learning velocity | P0 |
| **Future Readiness Report** | Personalised PDF/web report: AI exposure + reskilling plan + 5-year projection | P0 |
| **Skill Taxonomy** | One shared AI-skill taxonomy bridging CAPADEX constructs ↔ occupation exposure ↔ learning paths | P1 |
| **Future Readiness Score** | Single composite score (0–100) with 4 dimensions: AI_adaptability, reskill_velocity, construct_strength, market_alignment | P1 |
| **Industry Trend Feed** | Curated weekly trend signals from WEF/McKinsey/LinkedIn Economic Graph | P2 |

---

### 4.2 Dependencies

- **Phase 3** complete: reskill/upskill recommendation needs learning gap data.
- **WC-9 seed rows**: outcome models keyed by `model_key` already exist in DB — this phase activates them by populating `outcome_models` with content.
- **AI skill taxonomy**: single shared construct vocab that learning paths (Phase 3) and occupation exposure (this phase) both consume. Must be built in Phase 3 → consumed here.
- **O*NET AI task ratings** (2024 update): required for AI exposure scoring per occupation.

---

### 4.3 Database Requirements

| Migration | Tables Affected | Notes |
|---|---|---|
| `M4-01` AI exposure scores | `fr_occupation_ai_exposure` (new) | `occupation_id, displacement_risk, augmentation_score, automation_timeline_years, source, updated_at` |
| `M4-02` Future readiness snapshots | `fr_user_snapshots` (new) | Per-user composite score + 4 dimensions; UPSERT monthly |
| `M4-03` Outcome model content | `outcome_models` (upgrade) | Populate `description`, `evidence_base`, `timeline_years` for all model_key rows |
| `M4-04` Industry trend signals | `fr_trend_signals` (new) | `trend_id, title, source, relevance_tags[], published_at, summary` |
| `M4-05` Reskill decisions | `fr_reskill_decisions` (new) | `user_id, current_role, target_role, decision (reskill/upskill), rationale, confidence, created_at` |

---

### 4.4 Backend Services

| Service | File | Responsibility |
|---|---|---|
| **AI Exposure Scorer** | `services/ai-exposure-scorer.ts` | O*NET task ratings × automation probability model → displacement + augmentation scores |
| **Reskill Decision Engine** | `services/reskill-decision-engine.ts` | Transfer gap vs new-domain gap → binary reskill/upskill with evidence rationale |
| **Outcome Projector** | `services/outcome-projector.ts` | WC-9: `last + slope` extrapolation of EI/construct trend → 1/3/5-year projection |
| **Future Readiness Composer** | `services/future-readiness-composer.ts` | Assembles all 4 dimensions into composite score; UPSERT to `fr_user_snapshots` |
| **FR Report Generator** | `services/fr-report-generator.ts` | Builds personalised Future Readiness report (markdown → PDF via `puppeteer`/`pdfkit`) |
| **Trend Ingester** | `scripts/ingest-trends.ts` | Weekly scheduled job: fetches WEF/LinkedIn Economic Graph → writes `fr_trend_signals` |

---

### 4.5 Frontend Screens

| Screen | Component | Scope |
|---|---|---|
| **Future Readiness Dashboard** | `FutureReadinessDashboard.tsx` | Composite score gauge + 4-dim radar + AI exposure card |
| **Reskill/Upskill Pathway** | `ReskillPathwayPanel.tsx` | Decision card with rationale; links to Learning Path for each option |
| **Outcome Projection Chart** | `OutcomeProjectionChart.tsx` | 1/3/5-year projection with confidence bands; keys off EI trend |
| **AI Exposure Map** | `AIExposureMap.tsx` | Occupation list sorted by displacement risk; user's role highlighted |
| **Future Readiness Report** | `FutureReadinessReport.tsx` | Web-rendered version; "Download PDF" CTA; shareable link |
| **Trend Feed Widget** | `TrendFeedWidget.tsx` | Weekly highlights in Career Builder > Future tab |

---

### 4.6 API Requirements

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/future-readiness/:user_id` | GET | Composite score + 4 dimensions + snapshot date |
| `/api/future-readiness/:user_id/ai-exposure` | GET | AI exposure score for user's current + target occupation |
| `/api/future-readiness/:user_id/reskill` | GET | Reskill vs upskill decision with evidence |
| `/api/future-readiness/:user_id/projections` | GET | 1/3/5-year outcome projections |
| `/api/future-readiness/:user_id/report` | GET | Full report payload (web render + PDF link) |
| `/api/future-readiness/trends` | GET | Weekly industry trend signals |
| `/api/admin/fr/snapshots` | GET | Cohort future readiness distribution (enterprise) |

---

### 4.7 Testing Strategy

| Level | Method | Target |
|---|---|---|
| **Content validation** | Assert all `outcome_models` rows have non-null `description`, `timeline_years`, `evidence_base` | Zero null content before flag-on |
| **AI exposure accuracy** | Compare 50 spot-checked occupations vs WEF Future of Jobs 2025 displacement ratings | Within ±15% |
| **Projection sanity** | Assert projections are bounded [0, 100], monotonic unless negative trend, confidence < 1.0 | No fabricated causation |
| **Report generation** | Generate report for 100 synthetic profiles; assert no null sections, valid PDF output | 100% generation success |
| **Load** | 1,000 concurrent future readiness score computations | p95 < 1.5s |

---

### 4.8 Deployment Strategy

```
Sprint 19 (Wks 37–38): AI exposure data import + M4-01 migration
Sprint 20 (Wks 39–40): Reskill engine + outcome projector
Sprint 21 (Wks 41–42): Future Readiness composer + snapshot persistence
Sprint 22 (Wks 43–44): FR Report Generator + PDF export
Sprint 23 (Wks 45–46): Frontend — dashboard + charts
Sprint 24 (Wks 47–48): Industry trends + enterprise cohort analytics
→ Feature flag: FF_FUTURE_READINESS (upgrade existing)
→ Premium SKU: ₹999 Future Readiness Report (adds to Phase 1 Razorpay flow)
```

---

### 4.9 Success Metrics

| Metric | Baseline | Target (Month 13) |
|---|---|---|
| Outcome model content coverage | ~5% | 100% (all model_key rows populated) |
| Future Readiness composite score coverage | 0% of users | ≥ 70% of users with ≥ 2 CAPADEX sessions |
| AI exposure scores | 0 occupations | ≥ 800 occupations scored |
| FR Report downloads | 0 | ≥ 100/month |
| Premium report revenue | ₹0 | ≥ ₹75,000/month |
| Projection accuracy (60-day track) | Unmeasurable | > 60% directional accuracy |

---

### 4.10 Resource Estimates

| Role | Allocation | Duration |
|---|---|---|
| Senior Backend Engineer (scoring + projector) | 1.0 FTE | 5 months |
| Data Scientist (AI exposure model + trend analysis) | 0.5 FTE | 4 months |
| Frontend Engineer | 0.75 FTE | 4 months |
| Content Editor (outcome model text) | 0.25 FTE | 6 weeks |
| **Total engineering effort** | **~10 person-months** | |

---

---

## Phase 5 — Talent Passport
**Months 11–15 · Credential Layer · Revenue Unlock: Employer-Facing B2B**

### Objective
Transform the current JSONB snapshot-based Employability Passport into a portable, verifiable behavioural credential that users own and can share with employers, institutions, or platforms. Deliver an employer-facing view, a public shareable profile, and structured data export (Open Badges / VC-compatible JSON-LD where feasible).

---

### 5.1 Modules

| Module | Description | Priority |
|---|---|---|
| **Portable Credential Engine** | Converts passport snapshot → signed JSON payload with expiry + integrity hash | P0 |
| **Shareable Profile** | Public URL: `metryx.one/p/{slug}` — employer-viewable profile with controlled disclosure | P0 |
| **Employer Portal** | Employer-facing dashboard: search/filter candidate passports by dimension, verify credential | P0 |
| **Controlled Disclosure** | User selects which dimensions to expose (PII never published per constraint) | P0 |
| **Passport Versioning** | Each CAPADEX completion generates a new passport version; history preserved (append-only) | P1 |
| **Open Badges Integration** | Issue Open Badge 3.0 credentials for milestone completions | P1 |
| **Institutional Verification** | Universities/employers can verify passport authenticity via `/api/passport/verify/:hash` | P1 |
| **Talent Marketplace** | Optional: anonymised talent pool for employers to discover candidates (k-anonymity enforced) | P2 |

---

### 5.2 Dependencies

- **Phase 1** (CAPADEX WC-3 chain): passport dimensions derive from behavioural constructs; stub data produces meaningless credentials.
- **Phase 2** (EI + Career OS): EI score and occupation fitment are core passport dimensions.
- **Phase 3** (Learning Intelligence): completed learning milestones appear as passport achievements.
- **Phase 4** (Future Readiness): FR score and AI adaptability are premium passport dimensions.
- **PII constraint** (immutable): contact info NEVER published to any employer view or shareable URL — enforced at the serialisation layer, not UI.

---

### 5.3 Database Requirements

| Migration | Tables Affected | Notes |
|---|---|---|
| `M5-01` Passport versions | `tp_passport_versions` (new) | `id, user_id, version, payload_hash, signed_payload JSONB, created_at`; append-only |
| `M5-02` Disclosure settings | `tp_disclosure_settings` (new) | `user_id, dimension_key, is_visible, updated_at`; user-controlled |
| `M5-03` Employer accounts | `tp_employer_accounts` (new) | B2B employer identity; `employer_id, name, domain, plan, created_at` |
| `M5-04` Passport shares | `tp_shares` (new) | `share_id (UUID), user_id, employer_id, expires_at, viewed_at, dimensions_shared[]` |
| `M5-05` Verification log | `tp_verification_log` (new) | `hash, verifier_ip, verified_at, result`; append-only; no PII stored |
| `M5-06` Open Badges | `tp_badges` (new) | `badge_id, user_id, badge_class, issued_at, evidence_url, revoked_at` |

---

### 5.4 Backend Services

| Service | File | Responsibility |
|---|---|---|
| **Passport Signer** | `services/passport-signer.ts` | Builds payload from Phase 1–4 data; HMAC-SHA256 hash; appends version to `tp_passport_versions` |
| **Disclosure Filter** | `services/passport-disclosure.ts` | Reads `tp_disclosure_settings`; strips PII and hidden dimensions before serialisation |
| **Share Controller** | `services/passport-share.ts` | Generates time-limited share URLs; logs views; enforces employer access control |
| **Credential Verifier** | `services/passport-verifier.ts` | Public route: hash lookup → signature check → returns `{ valid, issued_at, dimensions[] }` |
| **Open Badge Issuer** | `services/open-badge-issuer.ts` | Issues OB 3.0 credentials for: first report, EI > 70, learning milestone, FR score |
| **Employer Search** | `services/employer-talent-search.ts` | Anonymised cohort search with k-anonymity; returns aggregates not individuals unless consented |

---

### 5.5 Frontend Screens

| Screen | Component | Scope |
|---|---|---|
| **Passport Builder** | `PassportBuilder.tsx` | Step-by-step controlled disclosure wizard; preview public view before publishing |
| **Public Passport** | `PublicPassportPage.tsx` | Employer-viewable at `metryx.one/p/{slug}`; no PII; verified badge strip |
| **Employer Dashboard** | `EmployerDashboard.tsx` | Candidate search/filter by EI dimension, FR score, skill tags; verify credential |
| **Share Manager** | `ShareManager.tsx` | In Career Builder: manage active shares, see who viewed, set expiry |
| **Badges Gallery** | `BadgesGallery.tsx` | User's earned badges with share options |
| **Verification Page** | `VerifyPassportPage.tsx` | Public: employer pastes hash → see valid/invalid + dimension summary |

---

### 5.6 API Requirements

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/passport/:user_id/build` | POST | Generate + sign latest passport version |
| `/api/passport/:user_id/versions` | GET | Version history (no PII) |
| `/api/passport/:user_id/disclosure` | GET / PUT | View or update dimension disclosure settings |
| `/api/passport/share` | POST | Create time-limited share link |
| `/api/passport/verify/:hash` | GET | Public: verify passport integrity (no auth required) |
| `/api/passport/public/:slug` | GET | Public employer view (disclosure-filtered) |
| `/api/employer/search` | GET | Anonymised talent pool search (employer-authenticated) |
| `/api/badges/:user_id` | GET | User's Open Badge inventory |

---

### 5.7 Testing Strategy

| Level | Method | Target |
|---|---|---|
| **PII enforcement** | Static analysis: assert no email/phone field in `PublicPassportPage` or `EmployerDashboard` props | Fail build if PII field detected |
| **Signature integrity** | Generate 1,000 passports, tamper 10%, assert verifier correctly rejects all tampered | 100% detection rate |
| **Disclosure compliance** | For each hidden dimension: assert it never appears in public payload or employer view | Zero disclosure leakage |
| **Share expiry** | Assert expired shares return 403; assert non-shared dimensions return 404 | Hard security contract |
| **k-anonymity** | Employer search: assert no individual is identifiable in aggregated results | k ≥ 30 per returned cohort |

---

### 5.8 Deployment Strategy

```
Sprint 25 (Wks 49–50): Passport signer + versioning + M5-01/M5-02
Sprint 26 (Wks 51–52): Controlled disclosure + share controller
Sprint 27 (Wks 53–54): Public passport page + verification endpoint
Sprint 28 (Wks 55–56): Employer portal + talent search (gated: FF_EMPLOYER_PORTAL)
Sprint 29 (Wks 57–58): Open Badges + badges gallery
Sprint 30 (Wks 59–60): Employer onboarding + B2B pricing tier
→ Feature flag: FF_TALENT_PASSPORT (upgrade), FF_EMPLOYER_PORTAL (new)
→ New B2B tier: employer seat pricing (₹999–₹4,999/month per recruiter seat)
```

---

### 5.9 Success Metrics

| Metric | Baseline | Target (Month 15) |
|---|---|---|
| Passports generated | 0 | ≥ 500 users |
| Public passports shared | 0 | ≥ 200 (40% opt-in) |
| Employer accounts | 0 | ≥ 10 |
| Passport verifications by employers | 0 | ≥ 50/month |
| Open Badges issued | 0 | ≥ 1,000 |
| Employer B2B MRR | ₹0 | ≥ ₹2,00,000/month |
| Zero PII disclosure incidents | — | 0 (invariant) |

---

### 5.10 Resource Estimates

| Role | Allocation | Duration |
|---|---|---|
| Senior Backend Engineer (crypto + sharing) | 1.0 FTE | 5 months |
| Frontend Engineer | 0.75 FTE | 4 months |
| Security Reviewer (PII audit + signature) | 0.25 FTE | 4 weeks |
| Enterprise Sales (employer outreach) | 1.0 FTE | Ongoing |
| **Total engineering effort** | **~9.5 person-months** | |

---

---

## Phase 6 — AI Intelligence
**Months 13–18 · Platform Intelligence · Revenue Unlock: AI-as-a-Service**

### Objective
Elevate the AI layer from governance scaffold to a production intelligence platform: fine-tune models on MetryxOne behavioural data, activate real-time inference optimization, deploy multi-model routing, and launch the Pragati conversational runtime at scale. Also: complete the WC-7 decision chain, activate the WC-C8A commercial pathway, and productise the AI Governance platform as an enterprise offering.

---

### 6.1 Modules

| Module | Description | Priority |
|---|---|---|
| **Multi-Model Router** | Route inference requests to GPT-4o / GPT-4o-mini / Claude by cost–quality tradeoff per use case | P0 |
| **Behavioural Fine-Tuning** | Fine-tune `gpt-4o-mini` on MetryxOne's curated concern → insight pairs | P0 |
| **Pragati at Scale** | Production deployment of conversational runtime: Redis session store, WebSocket scaling | P0 |
| **WC-7 Decision Chain** | Complete WC-7b activation intelligence + WC-7c commercial activation (Razorpay integration) | P0 |
| **AI Governance SaaS** | Productise AI Governance platform as a standalone B2B offering | P1 |
| **Real-Time Inference Dashboard** | Live model usage, cost, latency p95, hallucination rate per use case | P1 |
| **Insight Quality Loop** | A/B testing framework: measure which prompts produce highest user-reported insight quality | P1 |
| **Predictive Risk Alerts** | Proactive push alerts: "Your risk in dimension X has increased — here's why" | P2 |

---

### 6.2 Dependencies

- **AI Governance platform** (already built + real LLM execution added): multi-model router is an extension of `ai-governance-llm.ts`.
- **Phases 1–5 data**: fine-tuning requires ≥ 10,000 curated concern → insight pairs; CAPADEX sessions provide the substrate by Month 13 if B2C is live.
- **Pragati FSM** (already built): scaling requires stateless session reconstruction — Redis session store must replace the current in-memory store.
- **WC-7b/7c**: activation intelligence composes WC-3 L1/L2/L3 — Phase 1 WC-3 chain must be complete.

---

### 6.3 Database Requirements

| Migration | Tables Affected | Notes |
|---|---|---|
| `M6-01` Fine-tuning dataset | `ai_training_pairs` (new) | `pair_id, concern_text, insight_text, quality_score, human_reviewed, created_at` |
| `M6-02` Model routing config | `aig_routing_rules` (new) | `use_case, primary_model, fallback_model, cost_threshold, quality_threshold` |
| `M6-03` Inference events | `aig_inference_events` (new) | Per-call: `model, tokens_in, tokens_out, cost_usd, latency_ms, use_case, outcome_score` |
| `M6-04` A/B experiment framework | `ai_experiments`, `ai_experiment_arms` (new) | Prompt version A vs B; user assignment; outcome tracking |
| `M6-05` Predictive alerts | `ai_predictive_alerts` (new) | `user_id, alert_type, dimension, delta, triggered_at, delivered_at, acted_at` |
| `M6-06` Pragati Redis config | `pragati_sessions` (upgrade) | Add `redis_key`, `last_sync_at`; in-memory store migrated to Redis-backed |

---

### 6.4 Backend Services

| Service | File | Responsibility |
|---|---|---|
| **Model Router** | `services/model-router.ts` | Reads `aig_routing_rules`; routes by use_case + cost budget + quality floor |
| **Fine-Tune Pipeline** | `scripts/fine-tune-pipeline.ts` | Extracts curated pairs → OpenAI fine-tuning job → stores `fine_tuned_model_id` in `aig_models` |
| **Pragati Scaler** | `services/pragati-redis.ts` | Redis-backed session store for Pragati FSM; enables horizontal scaling |
| **WC-7 Orchestrator** | `services/wc7-orchestrator.ts` | Composes L1/L2/L3 → activation intelligence → commercial decision → Razorpay intent |
| **Inference Analytics** | `services/inference-analytics.ts` | Aggregates `aig_inference_events` → real-time dashboard metrics |
| **A/B Prompt Tester** | `services/prompt-ab-tester.ts` | User assignment → variant selection → outcome logging; min 200 samples per arm |
| **Predictive Alert Engine** | `services/predictive-alert-engine.ts` | Monitors WC-L2 forecast dims → fires alert if risk delta > threshold |

---

### 6.5 Frontend Screens

| Screen | Component | Scope |
|---|---|---|
| **AI Intelligence Dashboard** | `AiIntelligenceDashboard.tsx` | Real-time: model usage, cost/hour, latency p95, hallucination rate |
| **Model Router Config** | `ModelRouterConfig.tsx` (in AiGovernancePanel) | Configure routing rules per use case |
| **Fine-Tuning Studio** | `FineTuningStudio.tsx` | Review training pairs, launch fine-tuning job, monitor status |
| **Pragati Dashboard** | `PragatiDashboard.tsx` (upgrade) | Live sessions, FSM state distribution, quality scores |
| **A/B Experiment Manager** | `ABExperimentManager.tsx` | Create experiments, monitor arms, see statistical significance |
| **Predictive Alerts** | `PredictiveAlertsPanel.tsx` | User-facing: alert history, act-on CTA; admin: alert delivery rates |

---

### 6.6 API Requirements

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/route` | POST | Model router: `{ use_case, prompt, variables }` → routed model response |
| `/api/ai/fine-tuning/dataset` | GET | Curated training pairs with quality filter |
| `/api/ai/fine-tuning/jobs` | GET / POST | List or launch fine-tuning jobs |
| `/api/ai/inference/analytics` | GET | Real-time inference metrics (last 1h/24h/7d) |
| `/api/ai/experiments` | GET / POST | A/B experiment management |
| `/api/ai/experiments/:id/results` | GET | Experiment results with statistical significance |
| `/api/alerts/predictive/:user_id` | GET | User's pending predictive alerts |
| `/api/admin/wc7/decision/:session_id` | GET | WC-7 decision chain output for a session |

---

### 6.7 Testing Strategy

| Level | Method | Target |
|---|---|---|
| **Model router** | Assert routing rules fire correctly per use_case; assert fallback triggers on cost overrun | 100% rule coverage |
| **Fine-tuning quality** | Human evaluation: 100 insight samples from fine-tuned vs base model; blind preference | Fine-tuned ≥ 70% preference |
| **Pragati scaling** | k6: 500 concurrent WebSocket sessions; simulate FSM state transitions | Zero session state loss |
| **A/B statistical validity** | Assert experiments require min 200 samples per arm before reporting significance | No under-powered results |
| **Cost governance** | Assert total daily LLM spend never exceeds configured `aig_governance_policies.daily_cost_cap` | Hard spend ceiling enforced |
| **WC-7 chain** | End-to-end: CAPADEX session → WC-7b activation → WC-7c commercial intent → Razorpay order | Must work on real session data |

---

### 6.8 Deployment Strategy

```
Sprint 31 (Wks 61–62): Model router + routing rules config UI
Sprint 32 (Wks 63–64): Inference analytics + real-time dashboard
Sprint 33 (Wks 65–66): Fine-tuning pipeline + dataset curation tooling
Sprint 34 (Wks 67–68): WC-7 orchestrator + commercial decision chain
Sprint 35 (Wks 69–70): Pragati Redis migration + scaling test
Sprint 36 (Wks 71–72): A/B framework + predictive alerts
→ Feature flags: FF_MODEL_ROUTER (new), FF_FINE_TUNING (new)
→ Phase 6 cutover: Redis dependency requires infra provisioning in Month 13
```

---

### 6.9 Success Metrics

| Metric | Baseline | Target (Month 18) |
|---|---|---|
| LLM cost per assessment | ~$0.02 (unoptimised) | < $0.005 (router + fine-tuning) |
| Pragati concurrent sessions | ~20 (in-memory) | ≥ 500 (Redis-backed) |
| Fine-tuned model preference vs base | — | ≥ 70% human preference |
| WC-7 decision chain completion rate | ~0% | ≥ 60% of eligible sessions |
| AI Governance SaaS revenue | ₹0 | ₹1,00,000/month (3 enterprise clients) |
| Predictive alert click-through | — | ≥ 15% |
| Daily LLM spend governance | Ungoverned | 100% under daily cap policy |

---

### 6.10 Resource Estimates

| Role | Allocation | Duration |
|---|---|---|
| Senior Backend Engineer (AI infra + WC-7) | 1.0 FTE | 6 months |
| ML Engineer (fine-tuning + routing) | 0.5 FTE | 5 months |
| DevOps / Infra (Redis + scaling) | 0.5 FTE | 3 months |
| Frontend Engineer | 0.75 FTE | 4 months |
| **Total engineering effort** | **~12 person-months** | |

---

---

## Consolidated Timeline

```
Month:  1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17  18
        ├───────────────────────────────────────────────────────────────────────┤

Ph.1    ████████████████████████
        Ontology + Assessment (Months 1–4)

Ph.2            ████████████████████████████████
                Employability + Career Builder (Months 3–7)

Ph.3                        ████████████████████████████
                            Learning Intelligence (Months 5–9)

Ph.4                                        ████████████████████████
                                            Future Readiness (Months 9–13)

Ph.5                                                    ████████████████████
                                                        Talent Passport (Months 11–15)

Ph.6                                                            ████████████████████
                                                                AI Intelligence (Months 13–18)
```

---

## Revenue Unlock Schedule

| Milestone | Month | Mechanism | Target MRR |
|---|---|---|---|
| CAPADEX B2C paid (Curiosity/Growth/Insight/Mastery) | Month 4 | Razorpay + entitlement bridge | ₹75,000 |
| Enterprise analytics (3 institutions) | Month 7 | B2B dashboard + CSV export | ₹1,50,000 |
| Learning subscriptions | Month 9 | Monthly learning plan | ₹2,25,000 |
| Future Readiness reports (premium) | Month 13 | ₹999 one-time + subscription | ₹3,00,000 |
| Employer passport portal (10 employers) | Month 15 | Recruiter seat pricing | ₹5,00,000 |
| AI Governance SaaS (3 enterprise clients) | Month 18 | Platform-as-a-service | ₹6,00,000 |

---

## Cumulative Resource Estimate

| Phase | Engineering (person-months) | Key Roles |
|---|---|---|
| Phase 1 | 7.5 | 2 BE, 1 FE, 1 QA |
| Phase 2 | 10.0 | 2 BE, 1 DE, 1 FE |
| Phase 3 | 9.5 | 2 BE, 1 Content, 1 FE |
| Phase 4 | 10.0 | 2 BE, 1 DS, 1 FE |
| Phase 5 | 9.5 | 2 BE, 1 FE, 1 Security |
| Phase 6 | 12.0 | 2 BE, 1 ML, 1 DevOps, 1 FE |
| **Total** | **58.5 person-months** | **Peak team: 8–10 engineers** |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Identity bridge migration breaks existing sessions | High | Critical | Feature-flag gate; zero-downtime ALTER; dual-write period |
| O*NET import license / data quality | Medium | High | Pre-negotiate institutional license; fallback to 200-occupation static seed |
| k < 30 cohort prevents peer benchmarking at launch | High | Medium | Honest `insufficient data` messaging; suppress rather than fabricate |
| LLM costs exceed daily governance cap | Medium | High | Model router routes cheap use cases to gpt-4o-mini; hard spend ceiling in `aig_governance_policies` |
| Razorpay prod approval delay | Medium | High | Begin prod onboarding at Sprint 1; run parallel with development |
| Fine-tuning data quality | Medium | Medium | Human review gate: only pairs with quality_score ≥ 0.85 enter training set |
| Pragati Redis migration causes session loss | Low | High | Dual-store period: write to both in-memory + Redis; read from Redis only after 2-week stabilisation |
| PII disclosure via passport public URL | Low | Critical | Serialisation-layer strip (not UI-layer); automated test in CI fails build if PII field detected |

---

## Non-Negotiable Constraints (Carry Throughout All Phases)

1. **Additive + flag-gated**: every new phase ships behind a feature flag; flag-off = byte-identical prior behaviour.
2. **Never fabricate**: audit scripts, AI outputs, and report data are honest (Coverage ≠ Confidence reported as separate axes). No silent fallbacks.
3. **Append-only history**: `p4_competency_history`, `m3_*` history tables, `tp_passport_versions`, `li_progress_events` — never mutated in place.
4. **Language policy**: all outputs are developmental signals — NEVER hiring/promotion/suitability predictions.
5. **k-anonymity**: peer benchmarks and talent search suppressed below `k_min = 30`.
6. **PII invariant**: contact information never published to employer view, public passport, or any third-party API.
7. **Approval gate**: additive phases stop for user approval before merge/deploy (per `replit.md` preference).
