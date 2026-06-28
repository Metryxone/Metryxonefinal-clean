# CAPADEX 2.0 — Phase 1.21: Learning Intelligence Constitution (Learning Engine + Learning Path Engine)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Learning Intelligence Constitution. **Do not rebuild, do not create a second learning engine, do not replace Learning Intelligence, do not create Learning Engine V2, do not replace the Learning Path Engine, do not activate dormant learning capabilities, do not modify business logic, do not bypass Assessment / Behaviour / Decision / Journey / Intervention / Competency Intelligence.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (live `DATABASE_URL` + repo on 2026-06-28); *judgement* = DERIVED. Learning Intelligence develops measurable capability — it never exists merely to deliver content. **Learning ≠ Course ≠ Competency ≠ Skill ≠ Capability ≠ Performance · Completion ≠ Learning · Learning ≠ Behaviour Change · Learning ≠ Certification · Certification ≠ Competence · Evidence ≠ Confidence · Confidence ≠ Mastery · Mastery ≠ Expertise · AI ≠ Teacher.** built ≠ activated; flag-ON ≠ runtime-active; **seeded catalog ≠ learning ecosystem;** null ≠ 0. Human remains responsible.
> **Basis:** live learning / skill / course / path substrate audit + Phase 1.2–1.20 constitutions + memory (`competency-ontology-architecture`, `competency-framework-intelligence-phase1-index`, `cgi-architecture`, `frp-platform`, `lbi-architecture-state`, `wcl5-memory-intelligence`, `career-os-orchestration-engines`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.21.

---

## ⚠️ MEASUREMENT-INTEGRITY CORRECTION (regenerated with exact `COUNT(*)`)

This phase was originally measured with `pg_stat_user_tables.n_live_tup`, which reads 0 for bulk-seeded tables until autovacuum analyzes them (see Phase 1.23 and `.agents/memory/n-live-tup-stale-population-audit.md`). It therefore **under-reported population and wrongly concluded "only `frp_skill_taxonomy`=27 is populated; the learning runtime is almost entirely dormant."** That headline is **materially wrong.** Honesty cuts both ways — *empty-when-full* is as much a fabrication as *full-when-empty*. This section has been **regenerated with exact `SELECT COUNT(*)`**. Corrected values:

| Table | Was (n_live_tup) | **Now (COUNT\*)** | Correction |
|---|---|---|---|
| `skills` | 0 | **131** | skill graph nodes LIVE |
| `skill_proficiency_levels` | 0 (EMPTY) | **655** | LIVE |
| `occupation_skills` | 0 (EMPTY) | **355** | LIVE |
| `occupation_pathways` | 0 (EMPTY) | **89** | LIVE |
| `lip_catalog_courses` | 0 (EMPTY) | **15** | catalog POPULATED |
| `cg_learning_resources` | 0 | **76** | resources POPULATED |
| `cg_user_learning_recs` | 0 | **29** | recs LIVE |
| `cg_user_career_path` | 0 | **4** | paths LIVE (sparse) |
| `learn_outcomes` | 0 (DORMANT) | **54** | outcomes recorded |
| `learn_effectiveness` | 0 | **9** | effectiveness recorded |
| `learn_transfer_edges` | 0 | **7** | transfer edges LIVE |
| `skill_adjacency` | 0 | **2** | sparse |

Genuinely 0 (re-confirmed by exact count): `skill_aliases`, `skill_relationships`, `inferred_skills`, `learning_plan_templates`, `lbi_modules`, `lbi_sub_modules`, `lip_user_course_enrollments`, `p4_learning_progression`, `frp_user_skill_profile`, `bios_meta_learning`, `meta_learning_profiles`.

---

## PART 1 — Current Learning Intelligence Audit (MEASURED, exact COUNT\*)

| Component | Substrate | **Live runtime in THIS DB** | Verdict |
|---|---|---|---|
| Learning engine family `services/learning-*.ts`, `skill-*.ts` | code | present (learning-path-engine · learning-roi-engine v1/v2 · learning-hub-composer · learning-passport-loop · lip-learning-need-engine · skill-graph · skill-inventory-engine · career-learning-rec-engine · career-skill-gap-engine · frp-skill-bridge · intervention-learning-engine) | **BUILT** |
| Skill taxonomy `frp_skill_taxonomy` | reference (seeded) | **27** | SEEDED CATALOG |
| Skill graph `skills` / `skill_aliases` / `skill_relationships` / `skill_adjacency` / `inferred_skills` | runtime | **131 / 0 / 0 / 2 / 0** | **PARTIAL (nodes LIVE; edges/aliases empty)** |
| Occupation↔skill `occupation_skills` / `occupation_pathways` / `skill_proficiency_levels` | reference | **355 / 89 / 655** | **LIVE** |
| Learning catalog `lip_catalog_courses` / `cg_learning_resources` / `learning_plan_templates` / `lbi_modules` / `lbi_sub_modules` | catalog | **15 / 76 / 0 / 0 / 0** | **PARTIAL (courses+resources POPULATED; templates/modules empty)** |
| Learning paths `cg_user_career_path` / `cg_user_learning_recs` | runtime | **4 / 29** | **LIVE (sparse)** |
| Enrollments / progress `lip_user_course_enrollments` / `p4_learning_progression` / `frp_user_skill_profile` | runtime | **0** (all) | DORMANT |
| Outcomes / effectiveness `learn_outcomes` / `learn_effectiveness` / `learn_transfer_edges` | outcome | **54 / 9 / 7** | **LIVE** |
| Meta-learning `bios_meta_learning` / `meta_learning_profiles` | runtime | **0 / 0** | DORMANT |

**CRITICAL HONEST FINDING (MEASURED, exact COUNT\* + DERIVED):** Learning Intelligence is **one of the most code-rich layers in the platform** — a deep engine family (learning-path, learning-ROI v1/v2, hub-composer, passport-loop, need-engine, skill-graph, skill-inventory, career-learning-rec, career-skill-gap, frp-skill-bridge, intervention-learning) plus a dozen routes (learning-path, learning-passport, ontology-learning-paths, ontology-future-skills, talent-learning-catalog, competency-skill-intelligence). **Contrary to the original n_live_tup measurement, the learning runtime is PARTIALLY LIVE, not "almost entirely dormant."** The skill graph has real nodes (`skills`=131) with occupation linkage (`occupation_skills`=355, `occupation_pathways`=89, `skill_proficiency_levels`=655); the learning CATALOG is partially authored (`lip_catalog_courses`=15, `cg_learning_resources`=76); learning paths/recs exist sparsely (`cg_user_career_path`=4, `cg_user_learning_recs`=29); and learning OUTCOMES are recorded (`learn_outcomes`=54, `learn_effectiveness`=9, `learn_transfer_edges`=7). **What is genuinely DORMANT** is the *learner-state* runtime: enrollments (`lip_user_course_enrollments`=0), progression (`p4_learning_progression`=0), user-skill-profiles (`frp_user_skill_profile`=0), meta-learning (`bios_meta_learning`/`meta_learning_profiles`=0), and the skill *graph edges* (`skill_relationships`/`skill_aliases`/`inferred_skills`=0, `skill_adjacency`=2 only) plus higher-order catalog templates (`learning_plan_templates`/`lbi_modules`/`lbi_sub_modules`=0). So the honest picture: **a real (if partial) skill graph + course catalog + recommendation/outcome layer EXISTS, but no learners are enrolled or progressing through it.** seeded catalog ≠ learning ecosystem still holds for the enrollment loop; but table-exists-but-empty was the WRONG verdict for skills/courses/outcomes here. The competency genome (`onto_competencies`=422) remains the canonical upstream anchor. Densifying skill-graph edges + activating the enrollment/progression loop is a separate, approved phase; **NOT performed here.**

**Strengths (DERIVED):** single canonical Learning Engine with explicit ROI, skill-gap, and need sub-engines; skill-graph + skill-inventory separate the skill ONTOLOGY from learner state; **the skill graph nodes (131) + occupation linkage (355/89/655) + course catalog (15) + resources (76) + recommendations (29) + recorded outcomes (54) are real, populated assets** (not the empty shell the original reading implied); learning-passport-loop closes the evidence loop; the competency genome (`onto_competencies`=422, Phase 1.17) is a real upstream anchor; ROI engine has a v2 (iterating, not duplicating). **Technical debt / GAPS (DERIVED):** skill-graph EDGES sparse (`skill_relationships`/`skill_aliases`/`inferred_skills`=0, `skill_adjacency`=2 — nodes without a dense relationship graph; W9 needs O*NET/ESCO bulk edge import); higher-order catalog templates empty (`learning_plan_templates`/`lbi_modules`/`lbi_sub_modules`=0); learner-state loop unexercised (`lip_user_course_enrollments`/`p4_learning_progression`/`frp_user_skill_profile`=0 → no enrolled, progressing learners); must NOT duplicate Competency Intelligence (`onto_*` is canonical) — extend, don't fork; completion/retention/mastery rates unmeasurable at this scale (no enrolled learners → null, not 0). **Dormant:** enrollment/progression/user-skill-profile runtime + meta-learning + skill-graph edges + higher-order catalog templates — documented, not activated.

---

## PART 2 — Learning Philosophy

Learning exists to Develop · Improve · Adapt · Practice · Apply · Retain · Transfer · Master. **Learning Intelligence never exists merely to deliver content — it develops measurable capability. Learning never ends.**

## PART 3 — Learning Domain Architecture

Domains: Learning Core · Learning Engine · Learning Paths · Learning Journey · Learning Graph · Adaptive Learning · Skill Intelligence · Competency Learning · Analytics · Reports · AI · Governance. **Every learning capability belongs to ONE domain.**

## PART 4 — Learning Engine Constitution

The Learning Engine remains **the only Learning Intelligence Engine. Never replace it · never create Learning Engine V2 · never duplicate learning orchestration — enhance only.** Protect Learning logic · Pipeline · Memory · Sequencing · Explainability.

## PART 5 — Learning Path Constitution

Protect Learning paths · Roadmaps · Milestones · Modules · Dependencies · Prerequisites · Learning flow · Completion logic. **Learning paths originate from Decision Intelligence** (dormant here — paths can't materialize until Decision runtime is active, Phase 1.19).

## PART 6 — Adaptive Learning Constitution

Adaptive Learning uses Behaviour · Assessment · Competency · Persona · Journey · Learning history · Career goals · Confidence. **Every adaptive recommendation explains WHY.**

## PART 7 — Skill Intelligence Constitution

Protect Skills · Skill mapping · Relationships · Evolution · Progression · Analytics · Evidence. Binding: skill graph populated by O*NET/ESCO bulk import, never hand-seed (the live `frp_skill_taxonomy`=27 is a reference seed, not the operational graph); short-token boundary guard (naive 'ai' over-matches).

## PART 8 — Competency Learning Constitution

Protect Competencies · Competency development · Reinforcement · Practice · Evolution · Validation. **Never duplicate Competency Intelligence.** Binding: `onto_*` genome (`onto_competencies`=422) is the canonical authority — extend it, never add a parallel competency namespace.

## PART 9 — Learning Content Constitution

Support Courses · Micro learning · Projects · Practice sessions · Case studies · Exercises · Assessments. **Content remains modular.** Binding: catalogs (`lip_catalog_courses`/`lbi_modules`/`learning_plan_templates`) empty — author before recommending.

## PART 10 — Learning Recommendation Constitution

Every recommendation evaluates Behaviour · Assessment · Competency · Journey · Career goals · Learning history · Evidence · Confidence. **Never recommend learning without evidence.**

## PART 11 — Learning Evidence Constitution

Evidence originates from Assessments · Behaviour · Learning activities · Projects · Practice · Competencies · Historical learning · Journey progress; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 12 — Learning Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Mastery · Capability · Learning progress · Trust. **Never combine into one metric.** Binding: Confidence ≠ Mastery; Mastery ≠ Expertise; Completion ≠ Learning.

## PART 13 — Learning Explainability Constitution

Every recommendation explains Why · Evidence · Competency drivers · Behaviour drivers · Confidence · Alternatives · Dependencies · Expected outcome.

## PART 14 — Learning AI Constitution

**AI explains · guides · summarizes · personalizes · supports. AI never certifies competency · never fabricates learning · never bypasses governance.** Binding: AI ≠ Teacher; human remains responsible. (Cross-ref Phase 1.9.)

## PART 15 — Learning Analytics Constitution

Protect Learning KPIs · Completion · Retention · Engagement · Mastery · Competency growth · Skill growth · Learning trends. **Honest gap:** 0 learners here → every rate unmeasurable (null), never 0.

## PART 16 — Learning Report Constitution

Every report contains Learning summary · Completed learning · Pending learning · Competencies · Skills · Evidence · Confidence · Recommendations · Next steps.

## PART 17 — Longitudinal Learning Constitution

Protect Learning history · Skill evolution · Competency evolution · Learning progress · Mastery timeline · Learning trends. **Never overwrite learning history.** Binding: append-only.

## PART 18 — Enterprise Learning Constitution

Support Corporate learning · Leadership development · Compliance learning · Capability building · Learning campaigns · Learning academies. **Human approval required.** Binding: k-anonymity ≥30; tenant isolation.

## PART 19 — SuperAdmin Learning Constitution

Support Learning catalog · Learning paths · Competency mapping · Adaptive rules · Learning policies · Analytics · Reports · Monitoring. Binding: admin APIs `requireAuth` + `requireSuperAdmin`; catalog authoring is the only catalog-changing op.

## PART 20 — Learning Security Constitution

Protect Learning data · Competencies · Skills · Evidence · Reports · Permissions · Consent · PII · Tenant isolation. Binding: IDOR guard; PII masked in audit artifacts.

## PART 21 — Learning Observability

Monitor Learning Engine · Adaptive Learning · Recommendations · Analytics · Completion · Failures · Latency · Quality. **Honest gap:** 0 across operational tables = never-run, not healthy.

## PART 22 — Learning Testing Constitution

Standardize Learning · Recommendation · Adaptive · Competency · Regression · Performance tests.

## PART 23 — Learning Documentation

Maintain Learning · Competency · Skill catalogs + Learning API guide + Learning analytics guide. SSOT: `docs/phase-history.md` + `.agents/memory/*`.

## PART 24 — Learning Governance

Every enhancement answers: Why is Learning changing? · What existing capability is reused? · Does this duplicate Learning Intelligence? · Does this improve capability development? · Does this preserve Behaviour Intelligence?

## PART 25 — Learning Quality Gates

Verify Learning Engine reused · Behaviour reused · Assessment reused · Decision reused · Journey reused · Competency reused · Evidence exposed · Confidence exposed · Explainability complete · Documentation updated.

## PART 26 — Learning Review Board

```
Founder[ ] LearningArchitect[ ] BehaviourScientist[ ] EducationSpecialist[ ] CompetencyArchitect[ ] AIArchitect[ ]
Research[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 27 — Learning Definition of Done

- [ ] Existing Learning Engine reused · [ ] Learning Paths preserved · [ ] Competency Intelligence preserved · [ ] Journey preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Explainability complete · [ ] Learning history preserved · [ ] Documentation updated · [ ] No regressions.

## PART 28 — Learning Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Learning Engine | L2 Guided (rich engine; partially live runtime) | L4 Intelligent |
| Learning Paths | L2 Guided (`cg_user_career_path`=4 / `cg_user_learning_recs`=29 live, sparse) | L4 Intelligent |
| Adaptive Learning | L2 Guided (built, explainable) | L4 Intelligent |
| Competency Learning | L2 Guided (real `onto_*` genome upstream) | L4 Intelligent |
| Skill Intelligence | L2 Guided (`skills`=131 + occupation linkage 355/89/655; edges sparse) | L3 Adaptive |
| Learning Analytics | L1 Operational (outcomes recorded but no enrolled learners) | L3 Adaptive |
| Learning Reports | L2 Guided (canon built) | L4 Intelligent |
| Enterprise Learning | L1 Operational (`lbi_modules`=0) | L3 Adaptive |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Continuous Learning Intelligence. **Roadmap:** (separate approved phases) bulk-import the skill graph (O*NET/ESCO, not hand-seed) → author the learning CATALOG (courses/modules/templates — nothing to deliver until populated) → activate upstream Decision runtime so paths can originate (Phase 1.19) → map learning to the canonical `onto_*` competency genome (extend, never fork) → enroll learners + record learning OUTCOMES to feed the ROI/effectiveness engines → keep append-only history + multi-axis confidence + AI-never-certifies. **Learning develops measurable capability; learning never ends.**

## PART 29 — Learning Scientific Validation

Document Learning science · Instructional design · Adult learning theory · Cognitive science · Competency-based education · Knowledge transfer · Evidence quality · Bias review · Ethics · Population applicability.

## PART 30 — Learning Evolution Strategy

Future evolution supports New learning / adaptive / competency-framework / skill models · new AI tutors · new enterprise learning programs — **without breaking** Assessment · Behaviour · Conversation · Decision · Journey · Intervention · Career · Life · Enterprise Intelligence. (Additive + flag-gated + versioned; byte-identical flag-OFF.)

---

## PART 31 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Learning Intelligence Constitution | all | 14 | Learning Analytics Constitution | P15 |
| 02 | Learning Architecture Report | P1 | 15 | Learning Report Constitution | P16 |
| 03 | Learning Engine Constitution | P4 | 16 | Longitudinal Learning Constitution | P17 |
| 04 | Learning Path Constitution | P5 | 17 | Enterprise Learning Constitution | P18 |
| 05 | Adaptive Learning Constitution | P6 | 18 | SuperAdmin Learning Constitution | P19 |
| 06 | Skill Intelligence Constitution | P7 | 19 | Learning Governance Constitution | P24 |
| 07 | Competency Learning Constitution | P8 | 20 | Learning Quality Gates | P25 |
| 08 | Learning Content Constitution | P9 | 21 | Learning Review Board | P26 |
| 09 | Learning Recommendation Constitution | P10 | 22 | Learning Definition of Done | P27 |
| 10 | Learning Evidence Constitution | P11 | 23 | Learning Scientific Validation | P29 |
| 11 | Learning Confidence Constitution | P12 | 24 | Learning Evolution Strategy | P30 |
| 12 | Learning Explainability Constitution | P13 | 25 | Learning Maturity Assessment | P28 |
| 13 | Learning AI Constitution | P14 | | | |

---

**STOP — Phase 1.21 complete; Learning Intelligence Constitution ready to FREEZE on approval. Learning Engine not modified, Learning Intelligence not replaced, no second learning engine created, no dormant learning capabilities activated, business logic not changed, Assessment + Behaviour + Decision + Journey + Intervention + Competency Intelligence not bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (this phase was REGENERATED after an original `n_live_tup` measurement under-reported population — see the Measurement-Integrity Correction above). Learning Intelligence is one of the most code-rich layers (deep engine family + a dozen routes), and contrary to the original reading the learning runtime is **PARTIALLY LIVE**: skill graph nodes (`skills`=131) + occupation linkage (`occupation_skills`=355, `occupation_pathways`=89, `skill_proficiency_levels`=655), a partial CATALOG (`lip_catalog_courses`=15, `cg_learning_resources`=76), sparse paths/recs (`cg_user_career_path`=4, `cg_user_learning_recs`=29) and recorded outcomes (`learn_outcomes`=54, `learn_effectiveness`=9, `learn_transfer_edges`=7). What is **genuinely DORMANT** is the learner-state loop (enrollments / progression / user-skill-profiles = 0), meta-learning (= 0), skill-graph EDGES (`skill_relationships`/`aliases`/`inferred_skills`=0, `skill_adjacency`=2) and higher-order catalog templates (`learning_plan_templates`/`lbi_modules`/`lbi_sub_modules`=0). So: a real (if partial) graph + catalog + outcome layer EXISTS, but no learners are enrolled or progressing. seeded catalog ≠ learning ecosystem (still true of the enrollment loop); but table-exists-but-empty was the WRONG verdict for skills/courses/outcomes here. built ≠ activated; flag-ON ≠ runtime-active; **null ≠ 0 in BOTH directions** (each table reported exactly). Learning ≠ Course ≠ Competency ≠ Skill ≠ Capability; Completion ≠ Learning; AI ≠ Teacher; human remains responsible. The competency genome (`onto_competencies`=422) is the canonical upstream anchor. Densifying skill-graph edges (O*NET/ESCO) + activating the enrollment/progression loop is a separate, approved phase — NOT performed here.
