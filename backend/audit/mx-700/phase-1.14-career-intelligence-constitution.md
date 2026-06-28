# CAPADEX 2.0 — Phase 1.14: Career Intelligence Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Career Intelligence Constitution. **Do not rebuild, do not create a second career engine, do not replace Career OS, do not replace CGI, do not activate dormant career capabilities, do not modify business logic, do not bypass Behaviour / Decision / Journey / Learning Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Career Intelligence CONSUMES Behaviour + Decision + Journey + Learning Intelligence — it never replaces or bypasses them. **Coverage ≠ Confidence ≠ Employability · Potential ≠ Readiness · Recommendation ≠ Employment Guarantee · Market Trend ≠ Individual Fit · AI Recommendation ≠ Hiring Decision.** null ≠ 0; **seeded catalog ≠ live runtime**; flag-ON ≠ data-flowing. Never fabricate market demand, salary, readiness, or evidence.
> **Basis:** live career/CGI/occupation/salary audit + Phase 1.2–1.13 constitutions + memory (`cgi-architecture`, `role-title-crosswalk`, `p-r2-occupation-snapshot-lessons`, `occupation-seed-self-contained`, `ei-formula-authority`, `career-behavior-bridge`, `career-os-orchestration-engines`, `global-intelligence-compose-never-throws`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.14.

---

## PART 1 — Current Career Intelligence Audit (MEASURED)

| Component | As-built | **Live runtime in this DB** | Verdict |
|---|---|---|---|
| Role framework `ont_roles` | reference | **1,042** | POPULATED |
| Curated Role-DNA `onto_role_competency_profiles` | matching substrate | **76** | POPULATED |
| Occupations `occupations` | reference | **116** | POPULATED |
| Occupation skills `occupation_skills` | reference | **355** | POPULATED |
| CGI roles `cg_roles` | graph substrate | **200** | POPULATED |
| Onto roles / DNA `onto_roles` / `onto_dna_profiles` | DNA substrate | **15 / 15** | SEEDED |
| Salary trends `m3_salary_trends` | market | **5** | SPARSE |
| Career seeker profiles `career_seeker_profiles` | runtime | **3** | LIVE (sparse) |
| CGI user readiness `cg_user_role_readiness` | runtime | **5** | LIVE (sparse) |
| CGI user career path `cg_user_career_path` | runtime | **4** | LIVE (sparse) |
| Canonical job substrate `job_postings` | runtime | **0** | DORMANT |
| Career recommendations `career_recommendations` | runtime | **0** | DORMANT |

**CRITICAL HONEST FINDING (DERIVED):** the Career **reference / framework layer is richly populated** (1,042 roles, 116 occupations, 355 occupation-skills, 200 CGI roles, 76 curated Role-DNA profiles) and **CGI user activation is live but sparse** (3 seeker profiles, 5 readiness rows, 4 career-path rows). BUT the **canonical job substrate `job_postings`=0** and `career_recommendations`=0 are **dormant** — so matching has a rich role/skill substrate to match *against* but no live job demand to match *to*, and the recommendation surface holds no rows. Seeded catalog ≠ live runtime; flag-ON ≠ data-flowing. Activation of the dormant job/recommendation surfaces is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** deep role/occupation/skill substrate; CGI (16 `cg_*` tables, 5 pure engines, k=10 readiness cohort) operational with real user rows; curated Role-DNA crosswalk for free-text title → `onto_role_competency_profiles` (abstain-never-fabricate, Coverage⟂Confidence, distinctive-token guard); EI employability formula single-sourced (`employabilityEngine.ts`). **Technical debt / GAPS (DERIVED):** job substrate dormant (above) AND **SPLIT** (posting→`job_postings`, assessment/interview→`employer_jobs`) — a true match needs both bridged; `onto_roles`/`onto_dna_profiles` shallow (15) vs `ont_roles` (1,042) — DNA coverage ceiling; salary trends sparse (5 rows → market confidence low, never fabricate); occupation seed must be self-contained (CREATE on a missing column silently breaks the schema promise); W9 needs O*NET/ESCO bulk import, not manual seed. **Dormant:** job_postings + career_recommendations — documented, not activated.

---

## PART 2 — Career Philosophy

Behaviour creates identity · Decision creates direction · Journey creates transformation · Learning creates capability · Career creates opportunity. Career Intelligence exists to Guide · Align · Develop · Validate · Recommend · Forecast · Coach · Transform. **Career Intelligence never guarantees employment; it improves employability.** (Hierarchy: WHO · WHAT · WHEN · HOW · **WHERE capability creates value**.)

## PART 3 — Career Domain Architecture

Domains: Career Core · Intelligence · DNA · Graph · Readiness · Role · Occupation · Industry · Future Skills · Analytics · Reports · AI · Enterprise Talent · Governance. **Every career capability belongs to ONE domain.**

## PART 4 — Career DNA Constitution

Career DNA combines Behaviour · Competencies · Skills · Interests · Learning history · Career aspirations · Work preferences · Growth patterns. **Career DNA evolves continuously; never overwrite history.** Binding: DNA substrate is `onto_dna_profiles` (15, shallow) — extend, never fork.

## PART 5 — Career Graph Constitution

Protect Career nodes · Role/Industry/Occupation/Skill/Competency relationships · Career evolution · Timeline · Explainability. Binding: CGI is the canonical graph (`cg_*`); ensureSchema via `app.use` middleware (not `requireAuth`); literal-before-param route order enforced. **Never replace CGI.**

## PART 6 — Role Intelligence Constitution

Protect Role framework · Families · Hierarchies · Role competencies · Role skills · Expectations · Evolution · Future role mapping. Binding: free-text titles → `onto_role_competency_profiles` (NOT `ont_roles`) for matching; distinctive-token guard against generic matches.

## PART 7 — Occupation Intelligence Constitution

Protect Occupation framework · DNA · Clusters · Evolution · Relationships · Demand · Skills · Benchmarks. Binding: occupation seed is idempotent + self-contained (inserts its OWN base occupation+skill rows ON CONFLICT DO NOTHING) or new domains skip at link-time.

## PART 8 — Industry Intelligence Constitution

Protect Industry framework · Trends · Competencies · Skills · Readiness · Evolution · Benchmarks. Binding: multiple industry taxonomies coexist (`ont_industry_segments`, `gro_industry_*`, `m3_industry_demand`) — reconcile, never add a parallel one.

## PART 9 — Employability Intelligence Constitution

Employability derives from Behaviour · Competencies · Skills · Learning · Experience · Projects · Journey · Career readiness · Market alignment. **Never calculate employability from skills alone.** Binding: formula single source `employabilityEngine.ts`; Coverage ≠ Confidence ≠ Employability.

## PART 10 — Career Readiness Constitution

Readiness evaluates Behaviour · Competency · Skill · Learning · Experience · Project · Interview · Market readiness + Evidence + Confidence. Binding: readiness cohort k=10; `cg_readiness_weights`/`cg_readiness_history` append-only; **Potential ≠ Readiness.**

## PART 11 — Career Matching Constitution

Every recommendation evaluates Behaviour · Competency · Skill · Learning · Culture · Industry · Role · Growth match. **Never recommend using a single score.** Binding: per-job ranking modifiers need a per-row feature (not a user scalar); CAPADEX behaviour bridge adopted ONLY when `session_id` non-null; canonical job substrate is `job_postings` (`employer_jobs` fallback).

## PART 12 — Future Skills Constitution

Protect Emerging · AI · Digital · Leadership · Green · Human · Industry · Transferable skills + Skill evolution. Binding: ONE AI-skill taxonomy keystone; boundary short tokens (naive 'ai' over-matches); `ont_future_skills` / `frp_skill_taxonomy`.

## PART 13 — Career Evidence Constitution

Evidence originates from Behaviour · Competencies · Learning · Journey · Projects · Assessments · Enterprise · Career history; documents Source · Coverage · Quality · Confidence. **Never fabricate evidence.**

## PART 14 — Career Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Market confidence · Readiness · Potential. **Never combine these into one score.** Binding: abstain below k_min; salary/market confidence low when trend rows sparse (5) — disclose, never inflate.

## PART 15 — Career Explainability Constitution

Every recommendation explains Why · Competencies · Skills · Behaviour drivers · Career drivers · Market drivers · Evidence · Confidence · Alternatives · Expected growth.

## PART 16 — Career Recommendation Constitution

Recommendations include Career options · Alternative roles · Learning requirements · Competency gaps · Skill gaps · Salary expectations · Market demand · Timeline · Priority. Binding: `career_recommendations`=0 runtime (dormant); **Recommendation ≠ Employment Guarantee.**

## PART 17 — Salary Intelligence Constitution

Protect Salary bands · Market salaries · Regional/Industry variations · Experience adjustments · Confidence · Evidence. **Salary intelligence informs; it never guarantees compensation.** Binding: `m3_salary_trends`=5 (sparse) → low market confidence, never fabricate.

## PART 18 — Career AI Constitution

**AI explains careers · compares opportunities · summarizes gaps · recommends pathways. AI never guarantees employment. AI never fabricates market demand.** (Cross-ref Phase 1.9.)

## PART 19 — Enterprise Talent Constitution

Support Talent mapping · Succession planning · Leadership development · Internal mobility · Skill-gap analysis · Capability planning · Workforce analytics. **Human approval remains mandatory.** Binding: developmental signals only — never hiring/promotion predictions; role-aware scope + k-anonymity.

## PART 20 — Career Report Constitution

Every report contains Career summary · Career DNA · Readiness · Competencies · Skills · Evidence · Confidence · Recommendations · Salary intelligence · Market alignment · Next steps. SSOT: Report Factory engines (k=30 suppression).

## PART 21 — Career Analytics Constitution

Protect Career KPIs · Employability trends · Career growth · Readiness trends · Industry demand · Skill trends · Enterprise talent. Binding: every unmeasurable rate = null + note; trend needs ≥2 MEASURED points.

## PART 22 — Career Security Constitution

Protect Career data · Evidence · Recommendations · Salary data · Enterprise talent · Permissions · PII · Consent. Binding: tenant-scope every read; IDOR guard `resolveEffectiveUserId`; contact NEVER published in passport; PII masked in audit artifacts.

## PART 23 — Career Observability

Monitor Career engine · Matching · Readiness · Recommendations · Salary models · Latency · Failures · Quality. **Honest gap:** no central career-observability dashboard; it must surface the dormant job/recommendation surfaces honestly (0 ≠ healthy).

## PART 24 — Career Testing Constitution

Standardize Matching · Readiness · Recommendation · Career-graph · Regression · Performance tests. Current: CGI readiness exercised (live user rows); matching/recommendation paths thinly tested at runtime (job substrate empty).

## PART 25 — Career Documentation

Maintain Career · Occupation · Role · Industry · Future-skills catalogs + Analytics guide + API guide. SSOT: `docs/CAREER_BUILDER.md` + `docs/EMPLOYABILITY_INDEX.md` + `docs/EMPLOYABILITY_PASSPORT.md` + `.agents/memory/*`.

## PART 26 — Career Governance

Every career enhancement answers: Why is career changing? · What existing capability is reused? · Does this duplicate career logic? · Does this improve employability? · Does this improve career outcomes?

## PART 27 — Career Quality Gates

Verify Career OS reused · CGI reused · Behaviour reused · Decision reused · Journey reused · Learning reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 28 — Career Review Board

```
Founder[ ] CareerArchitect[ ] BehaviourScientist[ ] LearningArchitect[ ] DecisionArchitect[ ] JourneyArchitect[ ]
Enterprise[ ] Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Career Definition of Done

- [ ] Existing career engine reused · [ ] Career history preserved · [ ] Behaviour preserved · [ ] Learning preserved · [ ] Journey preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Documentation updated · [ ] No regressions.

## PART 30 — Career Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Career engine (Career OS) | L3 Personalized (live seeker profiles) | L4 Predictive |
| Career graph (CGI) | L3 Personalized (200 roles, live readiness) | L4 Predictive |
| Career DNA | L2 Guided (15 DNA profiles, shallow) | L4 Predictive |
| Readiness | L3 Personalized (k=10 cohort, live rows) | L4 Predictive |
| Matching | L2 Guided (rich substrate, 0 job demand) | L4 Predictive |
| Future skills | L2 Guided | L4 Predictive |
| Salary intelligence | L1 Operational (5 trend rows) | L3 Personalized |
| Enterprise talent | L2 Guided (human-approval gated) | L4 Predictive |

Levels: 1 Operational · 2 Guided · 3 Personalized · 4 Predictive · 5 Career Intelligence Excellence. **Roadmap:** (separate approved phase) populate + bridge the SPLIT job substrate (`job_postings` ⟷ `employer_jobs`) → activate matching against live demand → deepen `onto_dna_profiles` toward `ont_roles` coverage → bulk-import occupation/skill (O*NET/ESCO) → broaden salary market data → career-observability dashboard (surface dormancy honestly). **Career Intelligence improves employability; it never guarantees employment.**

## PART 31 — Career Scientific Validation

Document Career development theory · Vocational psychology · Career construction theory · Competency theory · Human capital theory · Evidence quality · Bias review · Ethics · Population applicability.

## PART 32 — Career Evolution Strategy

Future evolution supports New industries · occupations · roles · skills · labour markets · salary models · AI capabilities · enterprise models — **without breaking** existing Career OS · Behaviour · Decision · Journey · Learning Intelligence · reports · AI. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 33 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Career Intelligence Constitution | all | 15 | Career Recommendation Constitution | P16 |
| 02 | Career Architecture Report | P1 | 16 | Salary Intelligence Constitution | P17 |
| 03 | Career DNA Constitution | P4 | 17 | Career AI Constitution | P18 |
| 04 | Career Graph Constitution | P5 | 18 | Enterprise Talent Constitution | P19 |
| 05 | Role Intelligence Constitution | P6 | 19 | Career Report Constitution | P20 |
| 06 | Occupation Intelligence Constitution | P7 | 20 | Career Analytics Constitution | P21 |
| 07 | Industry Intelligence Constitution | P8 | 21 | Career Governance Constitution | P26 |
| 08 | Employability Constitution | P9 | 22 | Career Quality Gates | P27 |
| 09 | Career Readiness Constitution | P10 | 23 | Career Review Board | P28 |
| 10 | Career Matching Constitution | P11 | 24 | Career Definition of Done | P29 |
| 11 | Future Skills Constitution | P12 | 25 | Career Scientific Validation | P31 |
| 12 | Career Evidence Constitution | P13 | 26 | Career Evolution Strategy | P32 |
| 13 | Career Confidence Constitution | P14 | 27 | Career Maturity Assessment | P30 |
| 14 | Career Explainability Constitution | P15 | | | |

---

**STOP — Phase 1.14 complete; Career Intelligence Constitution ready to FREEZE on approval. Career OS not modified, CGI not replaced, no second career engine created, no dormant career capabilities activated, business logic not changed, Behaviour + Decision + Journey + Learning Intelligence not bypassed.**
Honesty caveats: counts are MEASURED from the live shared Postgres today — the Career reference/framework layer is richly populated (1,042 roles, 116 occupations, 355 occupation-skills, 200 CGI roles, 76 curated Role-DNA) and CGI user activation is live but sparse (3 seeker profiles, 5 readiness, 4 career-path), but the **canonical job substrate `job_postings`=0** and `career_recommendations`=0 are **dormant**, and `onto_dna_profiles`/`onto_roles` (15) + `m3_salary_trends` (5) are shallow. Matching has a rich substrate to match against but no live job demand to match to. Seeded catalog ≠ live runtime; flag-ON ≠ data-flowing. Coverage ≠ Confidence ≠ Employability; Recommendation ≠ Employment Guarantee. Activation of the dormant job/recommendation surfaces is a separate, approved phase — NOT performed here.
