# CAPADEX 2.0 — Phase 1.13: Learning Intelligence Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Learning Intelligence Constitution. **Do not rebuild, do not create a second learning engine, do not replace existing Learning Intelligence, do not replace the Competency Framework, do not activate dormant learning capabilities, do not modify business logic, do not bypass Behaviour / Decision / Journey Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Learning Intelligence CONSUMES Behaviour + Decision + Journey Intelligence — it never replaces or bypasses them. **AI never replaces human learning and never fabricates mastery.** Coverage ⟂ Confidence (⟂ Mastery) kept SEPARATE; null ≠ 0; **seeded catalog ≠ consumed runtime**; flag-ON ≠ data-flowing. Never fabricate competencies, skills, mastery, or evidence.
> **Basis:** live learning/competency audit + Phase 1.2–1.12 constitutions + memory (`competency-ontology-architecture`, `competency-framework-intelligence-phase1-index`, `competency-vs-lbi-separation`, `lbi-architecture-state`, `competency-ei-dimension-mapping`, `frp-platform`, `report-factory-engines`, `longitudinal-consumption-null-coercion`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.13.

---

## PART 1 — Current Learning Intelligence Audit (MEASURED)

| Component | As-built | **Live runtime in this DB** | Verdict |
|---|---|---|---|
| Competency genome `onto_competencies` | canonical framework | **422** | POPULATED |
| Question bank `competency_question_templates` | V1 bank | **2,665** | POPULATED |
| Competency profiles `onto_competency_profiles` | scoring runtime | **46** | LIVE |
| Score runs `onto_competency_score_runs` | normalized ledger | **24** | LIVE |
| Learn interventions `learn_interventions` | runtime | **81** | LIVE |
| Learn intervention events `learn_intervention_events` | runtime | **108** | LIVE |
| Learn outcomes `learn_outcomes` | runtime | **54** | LIVE |
| Course catalog `lip_courses` | catalog | **80** | SEEDED |
| Certification catalog `lip_certifications` | catalog | **40** | SEEDED |
| Course enrollments `lip_user_course_enrollments` | runtime | **0** | DORMANT |
| Learning recommendations `learn_recommendations` | runtime | **0** | DORMANT |
| Learning plan templates `learning_plan_templates` | config | **0** | EMPTY |
| LBI intervention library `lbi_intervention_library` | catalog | **20** | SEEDED |

**CRITICAL HONEST FINDING (DERIVED):** Learning Intelligence is **materially more live** than the Decision (1.11) and Journey (1.12) layers. The competency framework is **populated** (422 competencies, 2,665 question templates) with a **live scoring runtime** (46 profiles, 24 score runs) and **real intervention activity** (81 interventions, 108 events, 54 outcomes). Course + certification **catalogs are seeded** (80 courses, 40 certs). BUT the **user-side consumption surfaces are dormant**: `lip_user_course_enrollments`=0, `learn_recommendations`=0, `learning_plan_templates`=0, `certifications`=0. So the engine + framework are activated, while course-uptake / recommendation / plan-template surfaces are **seeded-but-not-consumed** — seeded catalog ≠ consumed runtime; flag-ON ≠ data-flowing. Activation of the dormant surfaces is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** the Competency Framework IS the canonical `onto_*` genome + `competency_question_templates` + `competency-runtime(-v2)` dual ledger — do NOT add a parallel namespace; live scoring + intervention activity proves the core engine works; FRP future-skill taxonomy + EI history layers present. **Technical debt / GAPS (DERIVED):** course-uptake/recommendation/plan surfaces dormant (above); legacy `competency_*` tables are EMPTY shells (admin reads fall back to `onto_*`) — don't mistake them for the framework; ⚠️ **Learning ⟂ LBI separation** — LBI (`lbi_*`) and Competency Assessment (`onto_*`) are TWO independent products BY DESIGN, never bridge `lbi_*`→`onto_competencies`; two `question_type` vocabularies coexist (canonical scorer keys vs short render tokens, bridged by `mapQuestionType`); longitudinal `Number()` over nullable score cols turns null→0 — map null/''→NaN BEFORE `isFinite`. **Dormant:** course/cert consumption surfaces — documented, not activated.

---

## PART 2 — Learning Philosophy

Behaviour creates awareness · Decision creates direction · Journey creates continuity · Learning creates capability. Learning Intelligence exists to Teach · Develop · Coach · Strengthen · Measure · Reinforce · Adapt · Transform. **Learning never ends; learning must remain continuous.** (Hierarchy: Behaviour=WHO · Decision=WHAT · Journey=WHEN · **Learning=HOW**.)

## PART 3 — Learning Domain Architecture

Domains: Learning Core · Intelligence · Competency Intelligence · Skill Intelligence · Adaptive Learning · Analytics · Reports · AI · Governance · Security · Journey · Enterprise. **Every learning capability belongs to ONE domain.**

## PART 4 — Competency Constitution

Protect Competencies · Framework · Categories · Levels · Relationships · Evolution · Benchmarks · Mapping · Evidence. **Never duplicate competency definitions; extend the existing framework.** Binding: the framework IS `onto_*` genome + `competency_question_templates` + dual ledger (`onto_competency_profiles` / `onto_competency_score_runs`); legacy `competency_*` are EMPTY shells; CAPADEX bridge via `concern_bridge_tag` (NOT `concern_id` — disjoint spaces).

## PART 5 — Skill Intelligence Constitution

Protect Technical · Behavioural · Leadership · Communication · Future · Industry · Role · Learning skills + Skill relationships + Skill progression. Binding: ONE AI-skill taxonomy keystone (FRP `frp_skill_taxonomy` / `ont_future_skills`); boundary short tokens (naive 'ai' over-matches 50×); occupation exposure via `occupation_skills`.

## PART 6 — Learning Path Constitution

Every learning path defines Objective · Competencies · Skills · Prerequisites · Duration · Evidence · Confidence · Milestones · Assessment · Completion. Binding: `lip_course_competency_map` links courses→`onto_*`; plan templates currently EMPTY (honest gap).

## PART 7 — Adaptive Learning Constitution

Adaptive Learning uses Behaviour · Decision · Journey · Competencies · Performance · Progress · Learning history · Career goals · Enterprise needs. **Never adapt without evidence.** Binding: a within-pool re-rank only moves dims that VARY within the pool (measure differentiability, don't tune weights); served bank is 100% medium → SERVED difficulty can't shift (honest ceiling).

## PART 8 — Micro Learning Constitution

Support Micro lessons · Daily learning · Behaviour tips · Career tips · Leadership tips · Scenario learning · Reflection · Practice · Revision.

## PART 9 — Learning Evidence Constitution

Evidence originates from Learning activities · Behaviour · Competencies · Assessments · Practice · Projects · Journey · Career · Enterprise; always includes Source · Timestamp · Coverage · Quality · Confidence. **Never fabricate evidence.**

## PART 10 — Learning Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Trust · Mastery. **Confidence must explain itself.** Binding: Coverage ⟂ Confidence ⟂ Mastery NEVER composited; abstain below k_min=30; pg `COUNT()` returns STRINGS (`Number()` before compare).

## PART 11 — Learning Explainability Constitution

Every recommendation explains Why · Competencies · Skills · Behaviour drivers · Journey context · Evidence · Confidence · Alternatives · Expected outcome.

## PART 12 — Learning Recommendation Constitution

Recommendations include Priority · Learning objective · Competencies · Skills · Estimated duration · Evidence · Confidence · Career impact · Behaviour impact. Binding: rec confidence deterministic (gap/transferability/mobility); `learn_recommendations`=0 runtime (dormant).

## PART 13 — Learning Assessment Constitution

Protect Knowledge checks · Competency validation · Skill validation · Scenario assessment · Behaviour reinforcement · Reflection · Mastery assessment. Binding: `selectAssessmentQuestionsFromAPI` → `GET /api/competency/questions/select` (requireAuth), falls back to static `ADAPTIVE_QUESTION_BANK_V2`.

## PART 14 — Learning Progression Constitution

Track Learning progress · Competency growth · Skill growth · Knowledge growth · Behaviour reinforcement · Certification progress · Learning timeline. **Append-only history** (`p4_competency_history`, `m3_*` never mutated in place); 0 snapshots → 0% honest.

## PART 15 — Learning Certification Constitution

Protect Certificates · Badges · Achievements · Competency validation · Skill validation · Enterprise recognition · Academic recognition. Binding: cert catalog seeded (`lip_certifications`=40) but user certs / `certifications`=0 (dormant); `onto_competency_certification_map` links to genome.

## PART 16 — Learning AI Constitution

**AI explains · recommends · personalizes · summarizes learning. AI never replaces human learning. AI never fabricates mastery.** (Cross-ref Phase 1.9.)

## PART 17 — Learning Analytics Constitution

Protect Learning KPIs · Completion · Drop-off · Engagement · Competency growth · Skill growth · Behaviour reinforcement · Enterprise learning. Binding: zero enrollment rows in dev = honest (no consumption yet); unmeasurable rate = null + note.

## PART 18 — Learning Report Constitution

Every report contains Learning summary · Competencies · Skills · Evidence · Confidence · Recommendations · Progress · Career alignment · Next steps. SSOT path: Report Factory engines (pdf-renderer, benchmark-engine k=30 suppression, viz-data-resolver).

## PART 19 — Enterprise Learning Constitution

Support Organizations · Departments · Managers · Teams · Learning campaigns · Compliance learning · Leadership development · Talent development. Binding: developmental signals only — never hiring/promotion predictions; role-aware scope + k-anonymity.

## PART 20 — SuperAdmin Learning Constitution

Support Learning configuration · Course templates · Competency libraries · Learning analytics · Reports · Approvals · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`, 60s cache, `?refresh=1`.

## PART 21 — Learning Security Constitution

Protect Learning data · Competencies · Evidence · Recommendations · Reports · Permissions · PII · Consent. Binding: tenant-scope every read; IDOR guard; PII masked in audit artifacts.

## PART 22 — Learning Observability

Monitor Learning engine · Adaptive learning · Recommendations · Competencies · Completion · Failures · Latency · Quality. **Honest gap:** no central learning-observability dashboard; it must surface the dormant consumption surfaces honestly (0 enrollments ≠ healthy).

## PART 23 — Learning Testing Constitution

Standardize Competency · Skill · Learning · Recommendation · Adaptive-learning · Regression tests. Current: competency scoring exercised (live runs); recommendation/enrollment paths untested at runtime (GAP, downstream of dormant surfaces).

## PART 24 — Learning Documentation

Maintain Competency · Skill · Learning · Learning-path catalogs + Recommendation guide + Analytics guide. SSOT: `docs/COMPETENCY_ASSESSMENT.md` + `docs/COMPETENCY_AND_ADAPTIVE_INTELLIGENCE.md` + `reports/competency_framework_review.md` + `.agents/memory/*`.

## PART 25 — Learning Governance

Every learning enhancement answers: Why is learning changing? · What existing capability is reused? · Does this duplicate learning logic? · Does this improve competency development? · Does this improve user growth?

## PART 26 — Learning Quality Gates

Verify Learning engine reused · Competency Framework reused · Journey reused · Behaviour reused · Decision reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 27 — Learning Review Board

```
Founder[ ] LearningArchitect[ ] BehaviourScientist[ ] DecisionArchitect[ ] JourneyArchitect[ ] AIArchitect[ ]
Enterprise[ ] Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 28 — Learning Definition of Done

- [ ] Existing learning engine reused · [ ] Competencies preserved · [ ] Skills preserved · [ ] Learning history preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Documentation updated · [ ] No regressions.

## PART 29 — Learning Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Learning engine | L3 Personalized (live scoring + interventions) | L4 Predictive |
| Competencies | L3 Personalized (422 + dual ledger live) | L4 Predictive |
| Skills | L2 Guided (taxonomy present) | L4 Predictive |
| Adaptive learning | L2 Guided (medium-only bank ceiling) | L4 Predictive |
| Recommendations | L1 Operational (0 runtime rows) | L4 Predictive |
| Analytics | L1 Operational (0 enrollments) | L3 Personalized |
| Reports | L2 Guided (Report Factory present) | L3 Personalized |
| Enterprise learning | L2 Guided (k-anon/role gated) | L4 Predictive |

Levels: 1 Operational · 2 Guided · 3 Personalized · 4 Predictive · 5 Continuous Learning Intelligence. **Roadmap:** (separate approved phase) wire course catalog → recommendations → enrollments (activate consumption surfaces) → author plan templates → broaden the served question bank beyond medium (lift the adaptive ceiling) → learning-observability dashboard (surface dormant uptake honestly). **AI tutors augment; the human always owns the learning, mastery never fabricated.**

## PART 30 — Learning Scientific Validation

Document Learning theory · Instructional design · Competency theory · Behavioural reinforcement · Educational psychology · Evidence quality · Bias review · Ethics · Population applicability.

## PART 31 — Learning Evolution Strategy

Future evolution supports New competencies · skills · learning models · industries · AI tutors · certifications · enterprise learning — **without breaking** existing learning engine · Behaviour Intelligence · Decision Intelligence · Journey Intelligence · reports · AI. (Additive + flag-gated + versioned; byte-identical flag-OFF; extend `onto_*`, never a parallel namespace.)

---

## PART 32 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Learning Intelligence Constitution | all | 14 | Learning Certification Constitution | P15 |
| 02 | Learning Architecture Report | P1 | 15 | Learning AI Constitution | P16 |
| 03 | Competency Constitution | P4 | 16 | Learning Analytics Constitution | P17 |
| 04 | Skill Intelligence Constitution | P5 | 17 | Learning Report Constitution | P18 |
| 05 | Learning Path Constitution | P6 | 18 | Enterprise Learning Constitution | P19 |
| 06 | Adaptive Learning Constitution | P7 | 19 | SuperAdmin Learning Constitution | P20 |
| 07 | Micro Learning Constitution | P8 | 20 | Learning Governance Constitution | P25 |
| 08 | Learning Evidence Constitution | P9 | 21 | Learning Quality Gates | P26 |
| 09 | Learning Confidence Constitution | P10 | 22 | Learning Review Board | P27 |
| 10 | Learning Explainability Constitution | P11 | 23 | Learning Definition of Done | P28 |
| 11 | Learning Recommendation Constitution | P12 | 24 | Learning Scientific Validation | P30 |
| 12 | Learning Assessment Constitution | P13 | 25 | Learning Evolution Strategy | P31 |
| 13 | Learning Progression Constitution | P14 | 26 | Learning Maturity Assessment | P29 |

---

**STOP — Phase 1.13 complete; Learning Intelligence Constitution ready to FREEZE on approval. Learning engine not modified, no second learning engine created, Competency Framework not replaced, no dormant learning capabilities activated, business logic not changed, Behaviour + Decision + Journey Intelligence not bypassed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today — Learning Intelligence is materially more live than the Decision/Journey layers (framework POPULATED: 422 competencies, 2,665 question templates; scoring runtime LIVE: 46 profiles, 24 runs; intervention activity LIVE: 81/108/54), with course + cert **catalogs seeded** (80 courses, 40 certs) but **consumption surfaces dormant** (`lip_user_course_enrollments`=0, `learn_recommendations`=0, `learning_plan_templates`=0, `certifications`=0). Seeded catalog ≠ consumed runtime; flag-ON ≠ data-flowing. The `onto_*` genome is the canonical framework (legacy `competency_*` are empty shells); LBI (`lbi_*`) is a SEPARATE product — never bridge it into `onto_*`. Activation of the dormant consumption surfaces is a separate, approved phase — NOT performed here.
