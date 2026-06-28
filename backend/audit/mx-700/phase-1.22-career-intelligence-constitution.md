# CAPADEX 2.0 — Phase 1.22: Career Intelligence Constitution (Career OS + Career Builder + Career Discovery + Employability Passport)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Career Intelligence Constitution. **Do not rebuild, do not create a second career engine, do not replace Career OS, do not create Career OS V2, do not replace Career Builder, do not replace the Employability Passport, do not activate dormant career capabilities, do not modify business logic, do not bypass Assessment / Behaviour / Decision / Learning / Competency Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Career Intelligence converts measurable capability into employability, growth, mobility, readiness — it augments professional decision-making, never guarantees outcomes. **Career ≠ Job ≠ Role ≠ Competency ≠ Employability ≠ Employment ≠ Career Success · Career Match ≠ Hiring Decision · Career Recommendation ≠ Job Offer · Career Readiness ≠ Guaranteed Placement · Evidence ≠ Confidence · Confidence ≠ Probability · Potential ≠ Outcome · AI ≠ Career Counselor.** built ≠ activated; flag-ON ≠ runtime-active; **seeded framework ≠ career ecosystem;** null ≠ 0. Human remains responsible.
> **Basis:** live career / role-DNA / resume / passport / job substrate audit + Phase 1.2–1.21 constitutions + memory (`role-title-crosswalk`, `career-os-orchestration-engines`, `cgi-architecture`, `career-launchpad-experience-routing`, `employability-passport` (docs), `career-behavior-bridge`, `wcl0-user-intelligence-foundation`, `frp-platform`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.22.

---

## PART 1 — Current Career Intelligence Audit (MEASURED)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| Career engine family `routes/career-*.ts` (~40 routes) | code | present (OS · builder · discovery · genome · graph · match · readiness · recommendation · roadmap · simulation · passport · launchpad · trajectory · velocity · workforce …) | **BUILT** |
| Career seekers `career_seeker_profiles` | runtime | **4** | **LIVE (sparse)** |
| Career discovery `career_discovery_results` | runtime | **1** | **LIVE (sparse)** |
| Career memory `career_memory_snapshots` | runtime | **1** | **LIVE (sparse)** |
| Seeker jobs / goals `career_seeker_jobs` / `career_seeker_goals` | runtime | **1 / 1** | **LIVE (sparse)** |
| Interview questions `interview_questions` | catalog | **45** | **LIVE (seeded)** |
| Role definitions `role_definitions` | reference | **10** | SEEDED |
| Role evolution `frp_role_evolution` | reference | **770** | SEEDED |
| **Role-DNA matching genome** `onto_role_weights` / `map_role_competency` / `role_dna_master_profiles` / `role_competency_weights` / `role_execution_profiles` | matching substrate | **0 / 0 / 0 / 0 / 0** | DORMANT |
| Career graph `cg_role_edges` / `cg_user_role_readiness` | graph | **0 / 0** | DORMANT |
| Employability passport `cp_passport` | snapshot | **0** | DORMANT |
| Job substrate `employer_jobs` / `job_applications` / `career_match_history` | opportunity | **0 / 0 / 0** | DORMANT |
| Career history / readiness history / simulation runs | longitudinal | `career_history` **0** · `career_readiness_history` **0** · `career_simulation_runs` **0** | DORMANT |
| Interview schedules / feedback `interview_schedules` / `interview_feedback` | runtime | **0 / 0** | DORMANT |
| Market roles `m3_market_roles` / `m3_role_trends` / `m3_canonical_role_mappings` | market | **0** (all) | EMPTY |

**CRITICAL HONEST FINDING (DERIVED):** Career Intelligence is **the most code-rich AND the most LIVE layer in the platform so far — the first with genuine end-user runtime.** It carries ~40 career routes (OS, builder, discovery, genome, graph, match, readiness, recommendation, roadmap, simulation, passport, launchpad, trajectory, velocity, workforce) AND it is the only layer with real seeker activity in this DB: **4 career-seeker profiles with discovery results, memory snapshots, jobs, and goals attached** (sparse but real), plus a seeded interview-question bank (45) and role reference data (`role_definitions`=10, `frp_role_evolution`=770). **BUT the MATCHING half is entirely DORMANT: the Role-DNA matching genome is empty (`onto_role_weights`/`map_role_competency`/`role_dna_master_profiles`/`role_competency_weights`/`role_execution_profiles` all = 0), the Employability Passport snapshot is empty (`cp_passport`=0), and the opportunity/job substrate is empty (`employer_jobs`/`job_applications`/`career_match_history`=0).** So Career Intelligence can **capture and remember seekers but cannot truly MATCH, RANK against real roles, or PUBLISH passports here** — the engine has learners but no role genome to score them against and no jobs to match them to. This is a textbook **Coverage ⟂ Confidence split: presence of seeker rows ≠ a functioning matching ecosystem; seeded framework ≠ career ecosystem; built ≠ activated.** Free-text job titles must crosswalk to `onto_role_competency_profiles` (NOT `ont_roles`) — and that target is empty here, so matching abstains rather than fabricates. Populating the Role-DNA genome + job substrate + activating passport publication is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** the only platform layer with real user runtime (4 seekers, discovery/memory/jobs/goals); single canonical Career OS orchestrating ~40 routes (no fork); interview-question bank seeded (45); rich role reference data (`frp_role_evolution`=770); passport is append-only by contract; per-job ranking uses a per-row feature (not a user scalar); behaviour bridge adopted ONLY when `session_id` non-null (absent → identical to before). **Technical debt / GAPS (DERIVED):** Role-DNA matching genome empty (canonical match target `onto_role_competency_profiles` unpopulated → match abstains); passport snapshot never published (`cp_passport`=0); no job postings / applications (`employer_jobs`=0 — depends on Employer Portal, Phase 1.16); market role intelligence empty (`m3_*`=0); seeker volume too low for any cohort statistic (k-anonymity ≥30 not met → benchmarks suppressed); readiness/match/simulation history all empty (Coverage⟂Confidence reported separately). **Dormant:** Role-DNA genome + career graph + passport publication + opportunity/job matching + market roles + longitudinal career history — documented, not activated.

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

Protect Role profiles · Role competencies · Role expectations · Role relationships · Role evolution · Role matching. **Never duplicate Role Intelligence.** Binding: canonical match target is `onto_role_competency_profiles` (NOT `ont_roles`) — **empty here, so matching ABSTAINS, never fabricates;** distinctive-token guard; Career Match ≠ Hiring Decision.

## PART 9 — Opportunity Intelligence Constitution

Support Career opportunities · Internal / External mobility · Future roles · Emerging careers · Career trends · Opportunity mapping. Binding: canonical job substrate is `job_postings` (`employer_jobs` fallback) — empty here; Career Recommendation ≠ Job Offer.

## PART 10 — Employability Passport Constitution

Protect Passport · Competencies · Evidence · Projects · Achievements · Experience · Learning records · Career readiness. **Passport remains append-only.** Binding: snapshot at `career_seeker_profiles.data.passport` JSONB; **contact NEVER published;** `cp_passport`=0 here (publication dormant).

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
| Career Builder | L2 Guided (live monolith, 4 seekers) | L4 Intelligent |
| Career Discovery | L2 Guided (1 live result) | L4 Intelligent |
| Career DNA | L1 Operational (profiles present, DNA sparse) | L3 Adaptive |
| Role DNA | **L1 Operational** (matching genome EMPTY → abstains) | L4 Intelligent |
| Opportunity Intelligence | L0 Not-Activated (no jobs/applications) | L3 Adaptive |
| Employability Passport | L1 Operational (`cp_passport`=0, publication dormant) | L4 Intelligent |
| Resume Intelligence | L2 Guided (ResumeStudio built) | L4 Intelligent |
| Interview Intelligence | L2 Guided (bank=45 seeded) | L4 Intelligent |
| Career Analytics | L1 Operational (n=4 < k_min=30) | L3 Adaptive |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Career Intelligence. **Roadmap:** (separate approved phases) populate the Role-DNA matching genome (`onto_role_competency_profiles` — match abstains until then) → wire the opportunity/job substrate (`job_postings`/`employer_jobs`, depends on Employer Portal Phase 1.16) → publish Employability Passports (`cp_passport`, contact never published) → grow seeker volume past k-anonymity (≥30) before any cohort analytics → keep append-only history + Coverage⟂Confidence + developmental-signals-only language. **Career Intelligence augments professional decision-making; it never guarantees outcomes.**

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
Honesty caveats: counts are MEASURED from the live shared Postgres today. Career Intelligence is the most code-rich AND most LIVE layer so far — the first with real end-user runtime: **4 career-seeker profiles with discovery / memory / jobs / goals attached** (sparse but real), interview bank=45, role reference (`role_definitions`=10, `frp_role_evolution`=770). BUT the MATCHING half is entirely DORMANT: the Role-DNA matching genome (`onto_role_weights`/`map_role_competency`/`role_dna_master_profiles`/`role_competency_weights`) = 0, the Employability Passport snapshot (`cp_passport`) = 0, and the opportunity/job substrate (`employer_jobs`/`job_applications`/`career_match_history`) = 0. So the engine can capture and remember seekers but cannot truly MATCH, RANK, or PUBLISH passports here. Presence of seeker rows ≠ a functioning matching ecosystem; seeded framework ≠ career ecosystem; built ≠ activated; null ≠ 0. Free-text titles crosswalk to `onto_role_competency_profiles` (empty here → match ABSTAINS, never fabricates). n=4 is below k-anonymity (≥30) so cohort analytics are suppressed. Career Match ≠ Hiring Decision; Career Recommendation ≠ Job Offer; AI ≠ Career Counselor; human remains responsible. Populating the Role-DNA genome + job substrate + passport publication is a separate, approved phase — NOT performed here.
