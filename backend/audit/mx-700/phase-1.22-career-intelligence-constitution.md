# CAPADEX 2.0 — Phase 1.22: Career Intelligence Constitution (Career OS + Career Builder + Career Discovery + Employability Passport)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Career Intelligence Constitution. **Do not rebuild, do not create a second career engine, do not replace Career OS, do not create Career OS V2, do not replace Career Builder, do not replace the Employability Passport, do not activate dormant career capabilities, do not modify business logic, do not bypass Assessment / Behaviour / Decision / Learning / Competency Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Career Intelligence converts measurable capability into employability, growth, mobility, readiness — it augments professional decision-making, never guarantees outcomes. **Career ≠ Job ≠ Role ≠ Competency ≠ Employability ≠ Employment ≠ Career Success · Career Match ≠ Hiring Decision · Career Recommendation ≠ Job Offer · Career Readiness ≠ Guaranteed Placement · Evidence ≠ Confidence · Confidence ≠ Probability · Potential ≠ Outcome · AI ≠ Career Counselor.** built ≠ activated; flag-ON ≠ runtime-active; **seeded framework ≠ career ecosystem;** null ≠ 0. Human remains responsible.
> **Basis:** live career / role-DNA / resume / passport / job substrate audit + Phase 1.2–1.21 constitutions + memory (`role-title-crosswalk`, `career-os-orchestration-engines`, `cgi-architecture`, `career-launchpad-experience-routing`, `employability-passport` (docs), `career-behavior-bridge`, `wcl0-user-intelligence-foundation`, `frp-platform`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.22.

---

## ⚠️ MEASUREMENT-INTEGRITY CORRECTION (regenerated with exact `COUNT(*)`)

This phase was originally measured with `pg_stat_user_tables.n_live_tup`, which reads 0 for bulk-seeded tables until autovacuum analyzes them (see Phase 1.23 and `.agents/memory/n-live-tup-stale-population-audit.md`). It therefore **under-reported population and wrongly concluded "the MATCHING half is entirely DORMANT."** That headline is **materially wrong** — matching has in fact run. Honesty cuts both ways — *empty-when-full* is as much a fabrication as *full-when-empty*. This section has been **regenerated with exact `SELECT COUNT(*)`**. Corrected values:

| Table | Was (n_live_tup) | **Now (COUNT\*)** | Correction |
|---|---|---|---|
| `map_role_competency` | 0 (DORMANT) | **52,362** | Role-DNA genome LIVE |
| `onto_role_weights` | 0 (DORMANT) | **121** | LIVE |
| `onto_role_competency_profiles` | 0 (match abstains) | **76** | match TARGET populated |
| `role_dna_master_profiles` | 0 (DORMANT) | **38** | LIVE |
| `cg_role_edges` | 0 (DORMANT) | **500** | career graph LIVE |
| `cg_user_role_readiness` | 0 | **5** | LIVE |
| `cp_passport` | 0 (DORMANT) | **1** | passport PUBLISHED |
| `employer_jobs` | 0 (DORMANT) | **2** | jobs EXIST |
| `career_match_history` | 0 (DORMANT) | **11** | matches HAVE run |
| `career_readiness_history` | 0 | **4** | LIVE |
| `frp_role_evolution` | 770 (stale) | **10,290** | LIVE |
| `m3_market_roles` / `m3_role_trends` / `m3_canonical_role_mappings` | 0 (EMPTY) | **5 / 5 / 4** | seeded |
| `interview_schedules` | 0 | **1** | LIVE |

Genuinely 0 (re-confirmed by exact count): `role_competency_weights`, `role_execution_profiles`, `job_applications`, `career_history`, `career_simulation_runs`, `interview_feedback`, `career_seeker_jobs`, `career_seeker_goals`. Seeker volume is now `career_seeker_profiles`=**3** (`career_discovery_results`=1, `career_memory_snapshots`=1) — still far below k-anonymity (≥30).

---

## PART 1 — Current Career Intelligence Audit (MEASURED)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| Career engine family `routes/career-*.ts` (~40 routes) | code | present (OS · builder · discovery · genome · graph · match · readiness · recommendation · roadmap · simulation · passport · launchpad · trajectory · velocity · workforce …) | **BUILT** |
| Career seekers `career_seeker_profiles` | runtime | **3** | **LIVE (sparse)** |
| Career discovery `career_discovery_results` | runtime | **1** | **LIVE (sparse)** |
| Career memory `career_memory_snapshots` | runtime | **1** | **LIVE (sparse)** |
| Seeker jobs / goals `career_seeker_jobs` / `career_seeker_goals` | runtime | **0 / 0** | DORMANT |
| Interview questions `interview_questions` | catalog | **45** | **LIVE (seeded)** |
| Role definitions `role_definitions` | reference | **10** | SEEDED |
| Role evolution `frp_role_evolution` | reference | **10,290** | SEEDED |
| **Role-DNA matching genome** `map_role_competency` / `onto_role_weights` / `role_dna_master_profiles` / `onto_role_competency_profiles` / `role_competency_weights` / `role_execution_profiles` | matching substrate | **52,362 / 121 / 38 / 76 / 0 / 0** | **LIVE (legacy weights/exec-profiles empty)** |
| Career graph `cg_role_edges` / `cg_user_role_readiness` | graph | **500 / 5** | **LIVE** |
| Employability passport `cp_passport` | snapshot | **1** | **PUBLISHED (sparse)** |
| Job substrate `employer_jobs` / `job_applications` / `career_match_history` | opportunity | **2 / 0 / 11** | **PARTIAL (jobs + matches LIVE; applications 0)** |
| Career history / readiness history / simulation runs | longitudinal | `career_history` **0** · `career_readiness_history` **4** · `career_simulation_runs` **0** | **PARTIAL (readiness history LIVE)** |
| Interview schedules / feedback `interview_schedules` / `interview_feedback` | runtime | **1 / 0** | **PARTIAL (schedule LIVE; feedback 0)** |
| Market roles `m3_market_roles` / `m3_role_trends` / `m3_canonical_role_mappings` | market | **5 / 5 / 4** | **SEEDED** |

**CRITICAL HONEST FINDING (MEASURED, exact COUNT\* + DERIVED):** Career Intelligence is **the most code-rich AND the most LIVE layer in the platform so far — the first with genuine end-user runtime on BOTH halves.** It carries ~40 career routes (OS, builder, discovery, genome, graph, match, readiness, recommendation, roadmap, simulation, passport, launchpad, trajectory, velocity, workforce) AND it has real seeker activity in this DB: **3 career-seeker profiles with discovery + memory snapshots** (sparse but real), plus a seeded interview-question bank (45) and role reference data (`role_definitions`=10, `frp_role_evolution`=10,290). **Contrary to the original n_live_tup measurement, the MATCHING half is NOT dormant — it is LIVE: the Role-DNA matching genome is populated (`map_role_competency`=52,362, `onto_role_weights`=121, `role_dna_master_profiles`=38, and the canonical match target `onto_role_competency_profiles`=76), the career graph is populated (`cg_role_edges`=500, `cg_user_role_readiness`=5), the Employability Passport HAS been published (`cp_passport`=1), jobs exist (`employer_jobs`=2), matches HAVE run (`career_match_history`=11), readiness history is recorded (`career_readiness_history`=4), and market roles are seeded (`m3_market_roles`/`m3_role_trends`/`m3_canonical_role_mappings`=5/5/4).** So Career Intelligence can and DOES capture seekers AND match/rank them against a real role genome AND publish passports here. **What remains thin/empty** is the seeker-side tracking + downstream loop: `career_seeker_jobs`/`career_seeker_goals`=0, `job_applications`=0, `career_history`=0, `career_simulation_runs`=0, `interview_feedback`=0, and the legacy `role_competency_weights`/`role_execution_profiles`=0 (the live genome lives in `map_role_competency`/`onto_*`, not these legacy shells). The binding constraint is now **VOLUME, not capability**: with only 3 seekers and 11 matches the system is far below k-anonymity (≥30), so cohort analytics stay suppressed — Coverage ⟂ Confidence. Free-text job titles crosswalk to `onto_role_competency_profiles` (NOT `ont_roles`), and that target IS populated here, so matching scores rather than abstains. Scaling volume + wiring seeker-side job/application tracking is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** the only platform layer live on BOTH halves (capture AND matching) — real seekers (3) PLUS a populated Role-DNA genome (`map_role_competency`=52,362 / `onto_role_competency_profiles`=76), career graph (`cg_role_edges`=500), a published passport (`cp_passport`=1), real jobs (`employer_jobs`=2), and a match history (`career_match_history`=11); single canonical Career OS orchestrating ~40 routes (no fork); interview-question bank seeded (45); rich role reference (`frp_role_evolution`=10,290); passport append-only by contract; per-job ranking uses a per-row feature (not a user scalar); behaviour bridge adopted ONLY when `session_id` non-null (absent → identical to before). **Technical debt / GAPS (DERIVED):** seeker-side tracking empty (`career_seeker_jobs`/`career_seeker_goals`/`job_applications`=0 — no application funnel yet); legacy `role_competency_weights`/`role_execution_profiles`=0 (superseded by the live `map_role_competency`/`onto_*` genome — don't re-populate the shells); job postings still thin (`employer_jobs`=2 — depends on Employer Portal, Phase 1.16); seeker/match VOLUME too low for any cohort statistic (k-anonymity ≥30 not met → benchmarks suppressed); `career_history`/`career_simulation_runs`/`interview_feedback`=0 (Coverage⟂Confidence reported separately). **Dormant:** seeker-side job/application tracking + career simulation + interview feedback + longitudinal career history + legacy role-weight shells — documented, not activated.

---

## PART 2 — Career Philosophy

Career Intelligence exists to Discover · Develop · Prepare · Guide · Match · Recommend · Grow · Transform. **It never guarantees employment, promotion, salary, hiring, or selection — it augments professional decision-making.**

## PART 3 — Career Domain Architecture

Domains: Career Core · Career OS · Career Builder · Career Discovery · Career DNA · Role DNA · Career Graph · Opportunity Intelligence · Resume Intelligence · Interview Intelligence · Analytics · Reports · AI · Governance. **Every career capability belongs to ONE domain.**

## PART 4 — Career OS Constitution

Career OS remains **the only Career Intelligence Engine. Never replace it · never create Career OS V2 · never duplicate career orchestration — enhance only.** Protect Career logic · Pipeline · Memory · Explainability. Binding: orchestrators COMPOSE never recompute; one sole idempotent snapshot builder.

## PART 5 — Career Builder Constitution

Protect Career roadmaps · Planning · Milestones · Goals · Development · Progress · Reviews. **Career Builder originates from Decision Intelligence** (dormant here, Phase 1.19). Binding: preserve the `CareerBuilderPage` monolith + `TabId` canon (`'jobs'` not `'tracker'`, `'mentors'` not `'mentor'`); additive phases are new pages, never core edits.

## PART 6 — Career Discovery Constitution

Career Discovery uses Behaviour · Assessment · Competencies · Learning · Decision · Journey · Career history · Career goals · Confidence. **Every recommendation explains WHY.** Binding: the Career Builder mount gate must run unconditionally (`?tab=` must NOT bypass discovery).

## PART 7 — Career DNA Constitution

Protect Career DNA · Career profiles · Professional identity · Career characteristics · Career evolution · Analytics · Evidence. Binding: runtime persona ≠ user-selected; behaviour NULL when no graph (never from score).

## PART 8 — Role DNA Constitution

Protect Role profiles · Role competencies · Role expectations · Role relationships · Role evolution · Role matching. **Never duplicate Role Intelligence.** Binding: canonical match target is `onto_role_competency_profiles` (NOT `ont_roles`) — **populated here (`onto_role_competency_profiles`=76, `map_role_competency`=52,362), so matching SCORES; it abstains only on titles with no crosswalk, never fabricates;** distinctive-token guard; Career Match ≠ Hiring Decision.

## PART 9 — Opportunity Intelligence Constitution

Support Career opportunities · Internal / External mobility · Future roles · Emerging careers · Career trends · Opportunity mapping. Binding: canonical job substrate is `job_postings` (`employer_jobs` fallback) — `employer_jobs`=2 here (thin but live); Career Recommendation ≠ Job Offer.

## PART 10 — Employability Passport Constitution

Protect Passport · Competencies · Evidence · Projects · Achievements · Experience · Learning records · Career readiness. **Passport remains append-only.** Binding: snapshot at `career_seeker_profiles.data.passport` JSONB; **contact NEVER published;** `cp_passport`=1 here (publication LIVE but sparse).

## PART 11 — Resume Intelligence Constitution

Support Resume builder · Analysis · Optimization · Evidence · Recommendations · Quality · Versions. Binding: reuse `ResumeStudio` (embedded) + Fitment panel (Provisional when `sampleSize<30`); don't fork.

## PART 12 — Interview Intelligence Constitution

Support Interview preparation · Mock interviews · Readiness · Question intelligence · Feedback · Analytics · Confidence building. Binding: interview-question bank is a global shared catalog (`interview_questions`=45, super-admin writes only); honest-unavailable when AI keys absent.

## PART 13 — Career Evidence Constitution

Evidence originates from Assessment · Behaviour · Competencies · Learning · Projects · Achievements · Career history · Interview performance; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 14 — Career Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Career readiness · Employability · Capability · Trust. **Never combine into one metric.** Binding: Employability ≠ Employment; Confidence ≠ Probability.

## PART 15 — Career Explainability Constitution

Every recommendation explains Why · Evidence · Competency drivers · Behaviour drivers · Career drivers · Confidence · Alternatives · Trade-offs · Expected outcome.

## PART 16 — Career AI Constitution

**AI explains · guides · compares · summarizes · personalizes · supports. AI never guarantees employment · never fabricates opportunities · never bypasses governance.** Binding: AI ≠ Career Counselor; developmental signals only, NEVER hiring/promotion/suitability predictions. (Cross-ref Phase 1.9 + Language policy.)

## PART 17 — Career Analytics Constitution

Protect Career KPIs · Career readiness · Employability · Mobility · Opportunity fit · Resume quality · Interview readiness · Career trends. **Honest gap:** 4 seekers → below k-anonymity floor (≥30); cohort analytics suppressed (null), never 0.

## PART 18 — Career Report Constitution

Every report contains Career summary · Career DNA · Role match · Opportunity match · Resume quality · Interview readiness · Evidence · Confidence · Recommendations · Next steps.

## PART 19 — Longitudinal Career Constitution

Protect Career history · Career evolution · Competency evolution · Learning evolution · Career mobility · Career timeline. **Never overwrite career history.** Binding: append-only (`career_history`=0 here).

## PART 20 — Enterprise Career Constitution

Support Internal mobility · Career development · Leadership pipeline · Succession planning · Talent growth · Career programs. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation; succession (`m5_critical_role_successors`=0).

## PART 21 — SuperAdmin Career Constitution

Support Career frameworks · Role libraries · Career DNA · Career rules · Matching rules · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`.

## PART 22 — Career Security Constitution

Protect Career data · Resume data · Interview data · Career evidence · Reports · Permissions · Consent · PII · Tenant isolation. Binding: `resolveEffectiveUserId` IDOR guard; passport contact never published; PII masked in audit artifacts.

## PART 23 — Career Observability

Monitor Career OS · Career Builder · Career Discovery · Matching · Recommendations · Latency · Failures · Quality. **Honest gap:** match/passport/job tables = 0 means never-run, not healthy.

## PART 24 — Career Testing Constitution

Standardize Career · Matching · Resume · Interview · Regression · Performance tests.

## PART 25 — Career Documentation

Maintain Career catalog · Career DNA catalog · Role catalog + Career API guide + Career analytics guide. SSOT: `docs/CAREER_BUILDER.md`, `docs/EMPLOYABILITY_PASSPORT.md`, `docs/phase-history.md` + `.agents/memory/*`.

## PART 26 — Career Governance

Every enhancement answers: Why is Career changing? · What existing capability is reused? · Does this duplicate Career Intelligence? · Does this improve employability? · Does this preserve Learning Intelligence?

## PART 27 — Career Quality Gates

Verify Career OS reused · Learning reused · Competencies reused · Behaviour reused · Decision reused · Journey reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 28 — Career Review Board

```
Founder[ ] CareerArchitect[ ] BehaviourScientist[ ] LearningArchitect[ ] CompetencyArchitect[ ] EnterpriseArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Career Definition of Done

- [ ] Existing Career OS reused · [ ] Career Builder preserved · [ ] Career DNA preserved · [ ] Role DNA preserved · [ ] Competencies preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Career history preserved · [ ] Documentation updated · [ ] No regressions.

## PART 30 — Career Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Career OS | L2 Guided (rich; sparse live runtime) | L4 Intelligent |
| Career Builder | L2 Guided (live monolith, 3 seekers) | L4 Intelligent |
| Career Discovery | L2 Guided (1 live result) | L4 Intelligent |
| Career DNA | L1 Operational (profiles present, DNA sparse) | L3 Adaptive |
| Role DNA | **L2 Guided** (matching genome LIVE: `map_role_competency`=52,362 / `onto_role_competency_profiles`=76 → scores) | L4 Intelligent |
| Opportunity Intelligence | L1 Operational (`employer_jobs`=2 / `career_match_history`=11; applications 0) | L3 Adaptive |
| Employability Passport | L1 Operational (`cp_passport`=1, publication live but sparse) | L4 Intelligent |
| Resume Intelligence | L2 Guided (ResumeStudio built) | L4 Intelligent |
| Interview Intelligence | L2 Guided (bank=45 seeded; `interview_schedules`=1) | L4 Intelligent |
| Career Analytics | L1 Operational (n=3 seekers / 11 matches < k_min=30) | L3 Adaptive |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Career Intelligence. **Roadmap:** (separate approved phases) the Role-DNA matching genome is now LIVE (`map_role_competency`=52,362 / `onto_role_competency_profiles`=76 — matching scores) → wire the seeker-side opportunity loop (`career_seeker_jobs`/`job_applications`, plus more `employer_jobs` via Employer Portal Phase 1.16) → grow passport publication beyond the first snapshot (`cp_passport`, contact never published) → grow seeker/match VOLUME past k-anonymity (≥30) before any cohort analytics → keep append-only history + Coverage⟂Confidence + developmental-signals-only language. **Career Intelligence augments professional decision-making; it never guarantees outcomes.**

## PART 31 — Career Scientific Validation

Document Career development theory · Vocational psychology · Career construction theory · Competency science · Human capital theory · Labour market intelligence · Evidence quality · Bias review · Ethics · Population applicability.

## PART 32 — Career Evolution Strategy

Future evolution supports New career / Career-DNA / Role-DNA / labour-market models · new AI career advisors · new enterprise career programs — **without breaking** Assessment · Behaviour · Conversation · Decision · Intervention · Learning · Life · Enterprise Intelligence. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 33 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Career Intelligence Constitution | all | 15 | Career AI Constitution | P16 |
| 02 | Career Architecture Report | P1 | 16 | Career Analytics Constitution | P17 |
| 03 | Career OS Constitution | P4 | 17 | Career Report Constitution | P18 |
| 04 | Career Builder Constitution | P5 | 18 | Longitudinal Career Constitution | P19 |
| 05 | Career Discovery Constitution | P6 | 19 | Enterprise Career Constitution | P20 |
| 06 | Career DNA Constitution | P7 | 20 | SuperAdmin Career Constitution | P21 |
| 07 | Role DNA Constitution | P8 | 21 | Career Governance Constitution | P26 |
| 08 | Opportunity Intelligence Constitution | P9 | 22 | Career Quality Gates | P27 |
| 09 | Employability Passport Constitution | P10 | 23 | Career Review Board | P28 |
| 10 | Resume Intelligence Constitution | P11 | 24 | Career Definition of Done | P29 |
| 11 | Interview Intelligence Constitution | P12 | 25 | Career Scientific Validation | P31 |
| 12 | Career Evidence Constitution | P13 | 26 | Career Evolution Strategy | P32 |
| 13 | Career Confidence Constitution | P14 | 27 | Career Maturity Assessment | P30 |
| 14 | Career Explainability Constitution | P15 | | | |

---

**STOP — Phase 1.22 complete; Career Intelligence Constitution ready to FREEZE on approval. Career OS not modified, Career Builder not replaced, Employability Passport not replaced, no second career engine created, no dormant career capabilities activated, business logic not changed, Assessment + Behaviour + Decision + Learning + Competency Intelligence not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (this phase was REGENERATED after an original `n_live_tup` measurement under-reported population — see the Measurement-Integrity Correction above). Career Intelligence is the most code-rich AND most LIVE layer so far — live on BOTH halves: **3 career-seeker profiles with discovery / memory snapshots** (sparse but real), interview bank=45, role reference (`role_definitions`=10, `frp_role_evolution`=10,290). Contrary to the original reading, the MATCHING half is NOT dormant — it is LIVE: the Role-DNA matching genome (`map_role_competency`=52,362 / `onto_role_weights`=121 / `role_dna_master_profiles`=38 / `onto_role_competency_profiles`=76), the career graph (`cg_role_edges`=500), the Employability Passport (`cp_passport`=1), the job substrate (`employer_jobs`=2), and the match history (`career_match_history`=11) are all populated. So the engine DOES capture, MATCH/RANK against a real role genome, and PUBLISH passports here. What remains thin/empty is seeker-side tracking + downstream (`career_seeker_jobs`/`career_seeker_goals`/`job_applications`/`career_history`/`career_simulation_runs`/`interview_feedback`=0) and the legacy `role_competency_weights`/`role_execution_profiles`=0 shells (superseded by the live genome). The binding constraint is VOLUME, not capability: n=3 seekers / 11 matches is below k-anonymity (≥30) so cohort analytics are suppressed — Coverage ⟂ Confidence. built ≠ activated; **null ≠ 0 in BOTH directions** (each table reported exactly). Free-text titles crosswalk to `onto_role_competency_profiles` (populated here → match SCORES; abstains only on titles with no crosswalk, never fabricates). Career Match ≠ Hiring Decision; Career Recommendation ≠ Job Offer; AI ≠ Career Counselor; human remains responsible. Scaling volume + wiring seeker-side job/application tracking is a separate, approved phase — NOT performed here.
